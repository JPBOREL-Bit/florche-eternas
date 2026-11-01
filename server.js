'use strict';
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const compression = require('compression');
const reviewsLib = require('./lib/reviews.js');

let sharp = null;
try { sharp = require('sharp'); } catch (e) { console.warn('sharp no disponible: las fotos se guardan como las comprime el navegador.'); }

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const JWT_SECRET =
  process.env.JWT_SECRET ||
  crypto.createHash('sha256').update('florche:' + ADMIN_PASSWORD).digest('hex');
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Falta la variable DATABASE_URL.');
  process.exit(1);
}

const isLocal = /localhost|127\.0\.0\.1/.test(DATABASE_URL);
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 8,
  idleTimeoutMillis: 30000,         // las conexiones sin uso se cierran a los 30 s
  connectionTimeoutMillis: 10000,    // si no hay conexión disponible en 10 s, falla en vez de colgarse
});
// Si se corta la conexión con la base (reinicio, pausa, red), no se cae el servidor: se reconecta sola.
pool.on('error', (e) => console.error('Conexión con la base interrumpida (se reintenta sola):', e.message));
const q = (text, params) => pool.query(text, params);
const rid = () => crypto.randomBytes(4).toString('hex');

/* ------------------------------------------------------------------ */
/* Configuración por defecto de la tienda                              */
/* ------------------------------------------------------------------ */
const DEFAULT_SETTINGS = {
  storeName: 'Florche.Eternas',
  tagline: 'Flores de cinta de raso que duran para siempre',
  heroTitle: 'Flores que no se marchitan',
  heroSubtitle:
    'Ramos y arreglos hechos a mano con cinta de raso. Elegí el estilo, los colores y el envoltorio a tu gusto.',
  about:
    'Cada flor se arma a mano, pétalo por pétalo, con cinta de raso. Podés pedir tu ramo con los colores y estilos que quieras, o contarnos tu idea y la hacemos realidad.',
  whatsapp: '',
  instagram: '',
  footerText: 'Hecho a mano en Mendoza, Argentina',
  primaryColor: '#A23B72',
  logoId: null,
  heroImageId: null,
  // Mensajes de la barra superior (uno por línea)
  announceOn: false,
  announcements: '',
  // Barra de progreso de beneficios en el carrito
  progressOn: false,
  progressTiers: [],
  // Reseñas y favoritos
  reviewsOn: true,
  reviewBannedWords: reviewsLib.DEFAULT_BANNED,
  showLikes: false,
  // Envíos por correo
  shipAndreaniOn: false,
  shipCorreoOn: false,
  pkgWeightG: 500,
  pkgH: 15,
  pkgW: 20,
  pkgL: 30,
  carrierHandling: 0,
  andreaniDays: '',
  // Pagos
  payOn: false,
  payAlias: '',
  payHolder: '',
  // Botón flotante de WhatsApp
  waFloatOn: true,
  waFloatText: 'Hola, tengo una consulta sobre sus flores',
  // Umami (análisis sin cookies). Vacío = apagado. host = dirección de tu Umami (Cloud o autoalojado), id = ID del sitio.
  umamiHost: '',
  umamiId: '',
  // Mayoristas
  wholesaleOn: true,
  wholesaleMin: 20,
  // Envíos
  originCP: '5500',
  pricePerKm: 300,
  kmMultiplier: 1,
  shippingBase: 0,
  shippingMin: 0,
  shippingRound: 50,
  allowPickup: true,
  pickupText: 'Retiro en persona (a coordinar por WhatsApp)',
  shippingNote: 'El costo del envío es aproximado y se confirma por WhatsApp.',
};

const NUM_KEYS = ['pricePerKm', 'kmMultiplier', 'shippingBase', 'shippingMin', 'shippingRound', 'wholesaleMin', 'pkgWeightG', 'pkgH', 'pkgW', 'pkgL', 'carrierHandling'];
const BOOL_KEYS = ['allowPickup', 'announceOn', 'progressOn', 'reviewsOn', 'showLikes', 'wholesaleOn', 'waFloatOn', 'payOn', 'shipAndreaniOn', 'shipCorreoOn'];
const ID_KEYS = ['logoId', 'heroImageId'];

async function getSettings() {
  const { rows } = await q('select key, value from settings');
  const s = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in DEFAULT_SETTINGS) s[r.key] = r.value;
  return s;
}

function cleanTiers(v) {
  const arr = Array.isArray(v) ? v : [];
  return arr
    .slice(0, 8)
    .map((t) => {
      const type = ['free_shipping', 'percent', 'amount', 'gift'].includes(t.type) ? t.type : 'free_shipping';
      let value = Math.max(0, Number(t.value) || 0);
      if (type === 'percent') value = Math.min(100, value);
      if (type === 'free_shipping' || type === 'gift') value = 0;
      return {
        id: String(t.id || rid()).slice(0, 20),
        at: Math.max(0, Number(t.at) || 0),
        type,
        value,
        label: String(t.label || '').trim().slice(0, 80),
      };
    })
    .filter((t) => t.at > 0)
    .sort((a, b) => a.at - b.at);
}

async function saveSettings(input) {
  const clean = {};
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (!(key in input)) continue;
    let v = input[key];
    if (NUM_KEYS.includes(key)) {
      v = Number(v);
      if (!Number.isFinite(v) || v < 0) throw new Error('Valor inválido en ' + key);
    } else if (BOOL_KEYS.includes(key)) {
      v = !!v;
    } else if (ID_KEYS.includes(key)) {
      v = v === null || v === '' ? null : parseInt(v, 10);
      if (v !== null && !Number.isInteger(v)) throw new Error('Imagen inválida');
    } else if (key === 'progressTiers') {
      v = cleanTiers(v);
    } else {
      v = String(v ?? '').trim().slice(0, 5000);
      if (key === 'originCP' && !/^\d{4}$/.test(v)) throw new Error('El código postal de origen debe tener 4 números.');
      if (key === 'umamiHost') { v = v.replace(/\/+$/, ''); if (v && !/^https:\/\/[a-z0-9.-]+(:\d+)?(\/[a-z0-9._~\/-]*)?$/i.test(v)) throw new Error('La dirección de Umami tiene que empezar con https:// (por ejemplo https://cloud.umami.is).'); }
      if (key === 'umamiId' && v && !/^[a-z0-9-]{8,60}$/i.test(v)) throw new Error('El ID de Umami no es válido.');
      if (key === 'primaryColor' && !/^#[0-9a-fA-F]{6}$/.test(v)) throw new Error('Color inválido.');
      if (key === 'whatsapp') v = v.replace(/\D/g, '');
    }
    clean[key] = v;
  }
  for (const [k, v] of Object.entries(clean)) {
    await q(
      'insert into settings(key, value) values($1, $2::jsonb) on conflict (key) do update set value = excluded.value',
      [k, JSON.stringify(v)]
    );
  }
}

/* ------------------------------------------------------------------ */
/* Base de datos                                                       */
/* ------------------------------------------------------------------ */
async function initDb() {
  await q(`
    create table if not exists settings (key text primary key, value jsonb);
    create table if not exists categories (
      id serial primary key,
      name text not null,
      position int not null default 0
    );
    create table if not exists products (
      id serial primary key,
      category_id int references categories(id) on delete set null,
      name text not null,
      description text not null default '',
      base_price numeric not null default 0,
      images jsonb not null default '[]',
      groups jsonb not null default '[]',
      active boolean not null default true,
      position int not null default 0,
      created_at timestamptz not null default now()
    );
    alter table products add column if not exists pinned boolean not null default false;
    alter table products add column if not exists discount_type text;
    alter table products add column if not exists discount_value numeric not null default 0;
    alter table products add column if not exists discount_ends timestamptz;
    alter table products add column if not exists lead_hours int not null default 0;
    alter table products add column if not exists weight_g int not null default 0;
    alter table products add column if not exists dim_h int not null default 0;
    alter table products add column if not exists dim_w int not null default 0;
    alter table products add column if not exists dim_l int not null default 0;

    create table if not exists images (
      id serial primary key,
      mime text not null,
      data bytea not null,
      created_at timestamptz not null default now()
    );
    alter table images add column if not exists thumb bytea;
    alter table images add column if not exists thumb_mime text;

    create table if not exists postal_codes (
      cp text primary key,
      label text,
      lat double precision,
      lon double precision,
      km numeric,
      manual boolean not null default false,
      origin text,
      source text,
      updated_at timestamptz not null default now()
    );

    create table if not exists events (
      id bigserial primary key,
      ts timestamptz not null default now(),
      vid text not null,
      sid text not null,
      type text not null,
      pid int,
      qty int
    );
    create index if not exists events_ts on events(ts);
    create index if not exists events_type_ts on events(type, ts);

    create table if not exists orders (
      id serial primary key,
      created_at timestamptz not null default now(),
      client_token text unique,
      name text not null,
      items jsonb not null default '[]',
      subtotal numeric not null default 0,
      tier_discount numeric not null default 0,
      coupon_code text,
      coupon_discount numeric not null default 0,
      benefits jsonb not null default '[]',
      total numeric not null default 0,
      delivery text,
      cp text,
      address text,
      ship_estimate numeric,
      status text not null default 'pendiente',
      decided_at timestamptz,
      vid text,
      sid text
    );
    create index if not exists orders_status on orders(status);
    create index if not exists orders_created on orders(created_at);
    alter table orders add column if not exists needed_for date;
    alter table orders add column if not exists ship_carrier text;
    alter table orders add column if not exists ship_service text;
    alter table orders add column if not exists ship_cost numeric;
    alter table orders add column if not exists ship_days text;
    alter table orders add column if not exists phone text;
    alter table events add column if not exists src text;
    create table if not exists push_keys (id int primary key, pub text not null, priv text not null);
    create table if not exists push_subs (
      endpoint text primary key,
      p256dh text not null,
      auth text not null,
      ua text,
      created_at timestamptz not null default now()
    );

    create table if not exists reviews (
      id serial primary key,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      email text not null,
      email_key text not null unique,
      name text not null,
      rating smallint not null check (rating between 1 and 5),
      comment text not null default '',
      hidden boolean not null default false
    );
    create index if not exists reviews_created on reviews(created_at desc);

    create table if not exists likes (
      pid int not null,
      vid text not null,
      created_at timestamptz not null default now(),
      primary key (pid, vid)
    );

    create table if not exists wholesalers (
      id serial primary key,
      created_at timestamptz not null default now(),
      decided_at timestamptz,
      status text not null default 'pendiente',
      type text not null,
      name text not null,
      business text not null,
      city text not null,
      qty int not null default 0,
      whatsapp text not null,
      email text not null,
      data jsonb,
      data_z bytea
    );
    create index if not exists wholesalers_status on wholesalers(status);
    create index if not exists wholesalers_wa on wholesalers(whatsapp);

    create table if not exists wholesale_purchases (
      id serial primary key,
      wid int not null references wholesalers(id) on delete cascade,
      day date not null,
      flowers int not null default 0,
      amount numeric not null default 0,
      note text not null default '',
      created_at timestamptz not null default now()
    );
    create index if not exists wholesale_purchases_day on wholesale_purchases(day);

    create table if not exists events_daily (
      day date not null,
      type text not null,
      pid int not null default 0,
      n int not null default 0,
      uvid int not null default 0,
      usid int not null default 0,
      primary key (day, type, pid)
    );

    create table if not exists calc_materials (
      id serial primary key,
      name text not null,
      price numeric not null default 0,
      pack_qty numeric not null default 1,
      unit text not null default 'u',
      note text not null default '',
      created_at timestamptz not null default now()
    );
    create table if not exists calc_products (
      id serial primary key,
      name text not null,
      lines jsonb not null default '[]',
      emergency_type text not null default 'none',
      emergency_value numeric not null default 0,
      minutes numeric not null default 0,
      hourly_override numeric,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table if not exists calc_config (k text primary key, v numeric not null);

    create table if not exists accounts (
      id serial primary key,
      username text,
      email text,
      pass_hash text,
      google_sub text unique,
      name text not null default '',
      phone text,
      address text,
      status text not null default 'activa',
      must_change boolean not null default false,
      device text,
      last_device text,
      token_ver int not null default 0,
      created_at timestamptz not null default now(),
      last_login timestamptz
    );
    create unique index if not exists accounts_username_u on accounts (lower(username)) where username is not null;
    create unique index if not exists accounts_email_u on accounts (lower(email)) where email is not null;
    create table if not exists password_resets (
      id serial primary key,
      account_id int references accounts(id) on delete cascade,
      ident text not null,
      phone text,
      status text not null default 'pendiente',
      created_at timestamptz not null default now()
    );
    alter table orders add column if not exists account_id int references accounts(id) on delete set null;
    alter table orders add column if not exists token text;
    alter table orders add column if not exists paid boolean not null default false;
    alter table orders add column if not exists paid_at timestamptz;
    alter table orders add column if not exists pay_id text;
    alter table orders add column if not exists pay_status text;
    alter table orders add column if not exists pay_amount numeric;
    alter table orders add column if not exists mp_pref_id text;
    create index if not exists orders_account on orders(account_id);

    create table if not exists coupons (
      id serial primary key,
      code text not null unique,
      type text not null default 'percent',
      value numeric not null default 0,
      min_purchase numeric not null default 0,
      max_discount numeric not null default 0,
      product_ids jsonb not null default '[]',
      expires_at timestamptz,
      active boolean not null default true,
      usage_limit int,
      used int not null default 0,
      exclude_discounted boolean not null default false,
      created_at timestamptz not null default now()
    );
  `);
  await hardenDb();
  await seedIfEmpty();
}

/* Seguridad de la base y rendimiento (recomendaciones de Supabase/Postgres).
   - Se activa RLS en TODAS las tablas de la tienda y se le sacan los permisos a los roles públicos de Supabase
     (anon y authenticated): así nadie puede leer cuentas, pedidos ni teléfonos usando la API pública de Supabase.
     La tienda no se ve afectada: se conecta con el usuario principal, que no está sujeto a RLS.
   - Se agregan índices a las claves foráneas que no tenían (acelera borrados en cascada y búsquedas). */
const OWN_TABLES = ['settings', 'categories', 'products', 'images', 'postal_codes', 'events', 'events_daily', 'orders', 'coupons', 'likes', 'reviews',
  'wholesalers', 'wholesale_purchases', 'calc_materials', 'calc_products', 'calc_config', 'push_keys', 'push_subs', 'accounts', 'password_resets'];
async function hardenDb() {
  // 1) Índices: cada uno solo si su tabla y columna existen (una base vieja puede no tenerlas).
  const idx = [
    ['password_resets', 'account_id', 'create index if not exists password_resets_account on password_resets(account_id)'],
    ['wholesale_purchases', 'wid', 'create index if not exists wholesale_purchases_wid on wholesale_purchases(wid)'],
    ['products', 'category_id', 'create index if not exists products_category on products(category_id)'],
    ['orders', 'sid', 'create index if not exists orders_sid on orders(sid)'],
  ];
  for (const [table, col, sql] of idx) {
    try {
      const has = await q("select 1 from information_schema.columns where table_schema='public' and table_name=$1 and column_name=$2", [table, col]);
      if (has.rowCount) await q(sql);
    } catch (e) { console.error('índice omitido (' + table + '.' + col + '):', e.message); }
  }
  // 2) RLS y permisos: se hace tabla por tabla, así un problema con una no frena las demás.
  try {
    const su = await q("select (rolsuper or rolbypassrls) as ok from pg_roles where rolname = current_user");
    if (!su.rows[0] || !su.rows[0].ok) return;
  } catch (e) { return; }
  for (const t of OWN_TABLES) {
    try {
      const exists = await q("select to_regclass($1) is not null as ok", ['public.' + t]);
      if (!exists.rows[0].ok) continue;
      await q(`alter table public.${t} enable row level security`);
      await q(`do $$ begin
        if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on public.${t} from anon'; end if;
        if exists (select 1 from pg_roles where rolname = 'authenticated') then execute 'revoke all on public.${t} from authenticated'; end if;
      end $$`);
    } catch (e) { console.error('no se pudo proteger la tabla ' + t + ':', e.message); }
  }
}

async function seedIfEmpty() {
  const seeded = await q("select 1 from settings where key = 'seeded'");
  if (seeded.rowCount) return;
  const prods = await q('select 1 from products limit 1');
  if (prods.rowCount === 0) {
    const cat = await q("insert into categories(name, position) values('Ramos de cinta de raso', 1) returning id");
    const colors = [
      ['Rojo', '#C62828'], ['Rosa', '#F48FB1'], ['Fucsia', '#D81B60'], ['Lila', '#B39DDB'],
      ['Celeste', '#81D4FA'], ['Amarillo', '#FDD835'], ['Blanco', '#FFFFFF'], ['Dorado', '#C9A227'],
    ];
    const groups = [
      {
        id: rid(), name: 'Estilo de flor', type: 'single', required: true, repeat: 3, repeatLabel: 'Flor', max: null,
        options: [
          { id: rid(), name: 'Rosa clásica', price: 0, color: '' },
          { id: rid(), name: 'Rosa abierta', price: 500, color: '' },
          { id: rid(), name: 'Margarita', price: 0, color: '' },
        ],
      },
      {
        id: rid(), name: 'Color', type: 'single', required: true, repeat: 3, repeatLabel: 'Flor', max: null,
        options: colors.map(([name, color]) => ({ id: rid(), name, price: 0, color })),
      },
      {
        id: rid(), name: 'Color del envoltorio', type: 'single', required: true, repeat: 1, repeatLabel: '', max: null,
        options: [
          { id: rid(), name: 'Papel kraft', price: 0, color: '#C8A97E' },
          { id: rid(), name: 'Papel negro', price: 0, color: '#222222' },
          { id: rid(), name: 'Papel blanco', price: 0, color: '#FFFFFF' },
        ],
      },
      {
        id: rid(), name: 'Flores extra', type: 'quantity', required: false, repeat: 1, repeatLabel: '', max: null,
        options: [{ id: rid(), name: 'Flor extra', price: 2500, color: '' }],
      },
    ];
    await q(
      `insert into products(category_id, name, description, base_price, groups, position)
       values($1, $2, $3, $4, $5::jsonb, 1)`,
      [
        cat.rows[0].id,
        'Ramo de 3 flores (producto de ejemplo)',
        'Ramo de 3 flores de cinta de raso. Elegí el estilo y el color de cada flor y el envoltorio. Podés editar o borrar este producto desde el panel.',
        12000,
        JSON.stringify(groups),
      ]
    );
  }
  await q("insert into settings(key, value) values('seeded', 'true'::jsonb) on conflict do nothing");
}

async function cleanupImages() {
  try {
    await q(`
      delete from images i
      where i.created_at < now() - interval '2 days'
        and not exists (select 1 from products p where p.images @> to_jsonb(i.id))
        and not exists (select 1 from settings s where s.key in ('logoId','heroImageId') and s.value = to_jsonb(i.id))
    `);
  } catch (e) {
    console.error('cleanupImages:', e.message);
  }
}

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */
const hits = new Map();
function rateOk(ip, bucket, max, windowMs) {
  const key = bucket + ':' + ip;
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    hits.set(key, arr);
    return false;
  }
  arr.push(now);
  hits.set(key, arr);
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, arr] of hits) {
    const f = arr.filter((t) => now - t < 3600e3);
    if (f.length) hits.set(k, f);
    else hits.delete(k);
  }
}, 600e3).unref();

const wrap = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((e) => {
    console.error(e);
    res.status(500).json({ error: e.message || 'Error del servidor' });
  });

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload || payload.admin !== true) throw new Error('no es administradora');
    next();
  } catch {
    res.status(401).json({ error: 'Sesión vencida. Volvé a ingresar.' });
  }
}

function cleanProduct(b) {
  const name = String(b.name || '').trim().slice(0, 200);
  if (!name) throw new Error('El producto necesita un nombre.');
  const price = Number(b.base_price);
  if (!Number.isFinite(price) || price < 0) throw new Error('El precio base es inválido.');
  const catId = b.category_id === null || b.category_id === '' || b.category_id === undefined ? null : parseInt(b.category_id, 10);
  const images = (Array.isArray(b.images) ? b.images : []).map((x) => parseInt(x, 10)).filter(Number.isInteger).slice(0, 12);
  const groups = (Array.isArray(b.groups) ? b.groups : []).slice(0, 30).map((g) => {
    const type = ['single', 'multi', 'quantity'].includes(g.type) ? g.type : 'single';
    let repeat = parseInt(g.repeat, 10);
    if (!(repeat >= 1)) repeat = 1;
    if (repeat > 30) repeat = 30;
    if (type !== 'single') repeat = 1;
    let max = g.max === null || g.max === '' || g.max === undefined ? null : parseInt(g.max, 10);
    if (!(max >= 1)) max = null;
    return {
      id: String(g.id || rid()).slice(0, 40),
      name: String(g.name || 'Opción').trim().slice(0, 120),
      type,
      required: !!g.required,
      repeat,
      repeatLabel: String(g.repeatLabel || '').trim().slice(0, 40),
      max: type === 'multi' ? max : null,
      options: (Array.isArray(g.options) ? g.options : [])
        .filter((o) => String(o.name || '').trim())
        .slice(0, 80)
        .map((o) => ({
          id: String(o.id || rid()).slice(0, 40),
          name: String(o.name).trim().slice(0, 120),
          price: Number.isFinite(Number(o.price)) ? Number(o.price) : 0,
          color: /^#[0-9a-fA-F]{6}$/.test(o.color || '') ? o.color : '',
        })),
    };
  });
  let dType = ['percent', 'amount'].includes(b.discount_type) ? b.discount_type : null;
  let dValue = Number(b.discount_value) || 0;
  if (!dType || dValue <= 0) { dType = null; dValue = 0; }
  if (dType === 'percent' && dValue > 100) dValue = 100;
  let dEnds = null;
  if (dType && b.discount_ends) {
    const d = new Date(b.discount_ends);
    if (!Number.isNaN(d.getTime())) dEnds = d.toISOString();
  }
  return {
    name,
    description: String(b.description || '').trim().slice(0, 4000),
    base_price: price,
    category_id: Number.isInteger(catId) ? catId : null,
    images,
    groups,
    active: b.active === undefined ? true : !!b.active,
    pinned: !!b.pinned,
    lead_hours: Math.max(0, Math.min(2160, parseInt(b.lead_hours, 10) || 0)),
    weight_g: Math.max(0, Math.min(60000, parseInt(b.weight_g, 10) || 0)),
    dim_h: Math.max(0, Math.min(300, parseInt(b.dim_h, 10) || 0)),
    dim_w: Math.max(0, Math.min(300, parseInt(b.dim_w, 10) || 0)),
    dim_l: Math.max(0, Math.min(300, parseInt(b.dim_l, 10) || 0)),
    discount_type: dType,
    discount_value: dValue,
    discount_ends: dEnds,
  };
}

const PRODUCT_COLS = 'id, category_id, name, description, base_price, images, groups, pinned, discount_type, discount_value, discount_ends, lead_hours, weight_g, dim_h, dim_w, dim_l';
const fmtProduct = (p) => ({ ...p, base_price: Number(p.base_price), discount_value: Number(p.discount_value) });

/* ------------------------------------------------------------------ */
/* Envíos por código postal (Mendoza)                                  */
/* ------------------------------------------------------------------ */
const MENDOZA_CP = /^5[56]\d{2}$/;
const inMendoza = (lat, lon) => lat > -37.8 && lat < -32 && lon > -70.8 && lon < -66.3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJSON(url, ms = 7000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: ac.signal,
      headers: { 'User-Agent': 'FlorcheEternas/1.0 (tienda online Mendoza)', Accept: 'application/json', 'Accept-Language': 'es' },
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

// Cola para respetar el límite de 1 consulta por segundo del servicio gratuito de mapas
let queue = Promise.resolve();
function enqueue(fn) {
  const p = queue.then(fn, fn);
  queue = p.catch(() => {});
  return p;
}

async function geocodeCP(cp) {
  const base = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ar&';
  const queries = [
    `postalcode=${cp}&country=Argentina&state=Mendoza`,
    `q=${encodeURIComponent(cp + ' Mendoza Argentina')}`,
    `postalcode=${cp}&country=Argentina`,
  ];
  for (const qs of queries) {
    try {
      const arr = await fetchJSON(base + qs);
      const hit = (arr || []).find((x) => inMendoza(+x.lat, +x.lon));
      if (hit) return { lat: +hit.lat, lon: +hit.lon, label: String(hit.display_name || '').split(',').slice(0, 3).join(',').trim(), source: 'auto' };
    } catch (e) {
      /* probamos la siguiente */
    }
    await sleep(1100);
  }
  try {
    const z = await fetchJSON(`https://api.zippopotam.us/ar/${cp}`);
    const p = z && z.places && z.places[0];
    if (p && inMendoza(+p.latitude, +p.longitude)) {
      return { lat: +p.latitude, lon: +p.longitude, label: `${p['place name']}, ${p.state || 'Mendoza'}`, source: 'auto' };
    }
  } catch (e) {
    /* sin resultado */
  }
  return null;
}

function haversineKm(a, b) {
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function routeKm(a, b) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`;
    const data = await fetchJSON(url, 8000);
    const m = data && data.routes && data.routes[0] && data.routes[0].distance;
    if (m && m > 0) return m / 1000;
  } catch (e) {
    /* usamos la distancia en línea recta */
  }
  return haversineKm(a, b) * 1.35; // aproximación por calles
}

async function getLocation(cp) {
  const { rows } = await q('select * from postal_codes where cp = $1', [cp]);
  const row = rows[0];
  if (row && row.lat !== null && row.lon !== null) return { lat: row.lat, lon: row.lon, label: row.label };
  const loc = await enqueue(() => geocodeCP(cp));
  if (!loc) return null;
  await q(
    `insert into postal_codes(cp, label, lat, lon, source) values($1,$2,$3,$4,$5)
     on conflict (cp) do update set label = excluded.label, lat = excluded.lat, lon = excluded.lon, source = excluded.source, updated_at = now()`,
    [cp, loc.label, loc.lat, loc.lon, loc.source]
  );
  return loc;
}

async function getKm(cp) {
  const s = await getSettings();
  const origin = String(s.originCP);
  const { rows } = await q('select * from postal_codes where cp = $1', [cp]);
  const row = rows[0];
  if (row && row.km !== null && (row.manual || row.origin === origin)) {
    return { km: Number(row.km), label: row.label };
  }
  if (cp === origin) {
    await q(
      `insert into postal_codes(cp, km, origin, source) values($1, 0, $1, 'auto')
       on conflict (cp) do update set km = 0, origin = $1, updated_at = now()`,
      [cp]
    );
    return { km: 0, label: row && row.label };
  }
  const dest = await getLocation(cp);
  if (!dest) return { km: null, reason: 'not_found' };
  const from = await getLocation(origin);
  if (!from) return { km: null, reason: 'origin_not_found' };
  const km = Math.round((await routeKm(from, dest)) * 10) / 10;
  await q('update postal_codes set km = $2, manual = false, origin = $3, updated_at = now() where cp = $1', [cp, km, origin]);
  return { km, label: dest.label };
}

function shippingCost(km, s) {
  let c = Number(s.shippingBase) + km * Number(s.kmMultiplier) * Number(s.pricePerKm);
  c = Math.max(c, Number(s.shippingMin));
  const r = Number(s.shippingRound) || 0;
  if (r > 0) c = Math.round(c / r) * r;
  return Math.round(c);
}

/* ------------------------------------------------------------------ */
/* Imágenes: siempre se guardan comprimidas                            */
/* ------------------------------------------------------------------ */
const SIZES = { product: { max: 1000, q: 76 }, banner: { max: 1800, q: 76 }, logo: { max: 400, q: 80 } };

function decodeDataUrl(s) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(s || ''));
  return m ? { mime: m[1], buf: Buffer.from(m[2], 'base64') } : null;
}

// Si hay sharp, vuelve a comprimir en el servidor (por si el navegador mandó algo pesado).
async function shrink(img, maxSide, quality) {
  if (!sharp) return img;
  try {
    const out = await sharp(img.buf, { failOn: 'none' })
      .rotate()
      .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
    return out.length < img.buf.length ? { mime: 'image/webp', buf: out } : img;
  } catch (e) {
    return img;
  }
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */
const app = express();
app.set('trust proxy', 1);
app.use(compression());
app.use(express.json({ limit: '8mb' }));
// Con dominio propio (PUBLIC_URL), la dirección vieja de onrender.com manda a la nueva (solo páginas, no la API ni los avisos de pago)
const PUBLIC_HOST = (() => { try { return process.env.PUBLIC_URL ? new URL(process.env.PUBLIC_URL).host.toLowerCase() : ''; } catch { return ''; } })();
app.use((req, res, next) => {
  if (!PUBLIC_HOST || (req.method !== 'GET' && req.method !== 'HEAD') || req.path.startsWith('/api/')) return next();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
  if (host !== PUBLIC_HOST && host.endsWith('.onrender.com')) return res.redirect(301, process.env.PUBLIC_URL.replace(/\/$/, '') + req.originalUrl);
  next();
});

// Sirve para los monitores externos y también mantiene activa la base de datos (Supabase gratis se pausa si no se usa)
let selfPings = 0;
app.get('/api/health', async (req, res) => {
  let db = false;
  try {
    // si la base no contesta en 4 segundos, se informa como caída (no se queda colgado)
    await Promise.race([q('select 1'), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))]);
    db = true;
  } catch (e) { /* igual responde */ }
  res.set('Cache-Control', 'no-store');
  res.status(db ? 200 : 503).json({ ok: db, db, pings: selfPings }); // 503 si la base no responde: el monitor te avisa
});

// Modo "no dormir" (opcional): con KEEP_AWAKE=on la tienda se consulta a sí misma cada 10 minutos,
// así Render no la apaga por inactividad mientras esté despierta.
function startKeepAwake() {
  const url = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL;
  if (String(process.env.KEEP_AWAKE || '').toLowerCase() !== 'on' || !url) return;
  const every = Math.max(500, Number(process.env.KEEP_AWAKE_MS) || 10 * 60e3);
  console.log(`Modo "no dormir" activado: la tienda se consulta a sí misma cada ${Math.round((every / 60e3) * 10) / 10} min.`);
  const t = setInterval(async () => {
    try {
      const r = await fetch(url.replace(/\/$/, '') + '/api/health');
      if (r.ok) selfPings++;
    } catch (e) { console.warn('keep-awake falló:', e.message); }
  }, every);
  if (t.unref) t.unref();
}

// Imágenes guardadas en la base de datos (/img/ID = grande, /img/ID/t = miniatura)
app.get('/img/:id/:v?', wrap(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(404).end();
  const { rows } = await q('select mime, data, thumb, thumb_mime from images where id = $1', [id]);
  const r = rows[0];
  if (!r) return res.status(404).end();
  if (req.params.v === 'og' && sharp) {
    try {
      const out = await sharp(r.data, { failOn: 'none' }).rotate()
        .resize(1200, 630, { fit: 'contain', background: '#ffffff' }).jpeg({ quality: 80 }).toBuffer();
      res.set('Content-Type', 'image/jpeg');
      res.set('Cache-Control', 'public, max-age=86400');
      return res.send(out);
    } catch (e) { /* si falla se manda la foto original */ }
  }
  const useThumb = req.params.v === 't' && r.thumb;
  res.set('Content-Type', useThumb ? r.thumb_mime || 'image/webp' : r.mime);
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(useThumb ? r.thumb : r.data);
}));

// Datos públicos de la tienda
app.get('/api/store', wrap(async (req, res) => {
  const [settings, cats, prods, reviews] = await Promise.all([
    getSettings(),
    q('select id, name from categories order by position, id'),
    q(`select ${PRODUCT_COLS}, (select count(*)::int from likes l where l.pid = products.id) as likes
       from products where active order by pinned desc, position, id`),
    revApi.storeBlock(),
  ]);
  res.set('Cache-Control', 'no-store');
  const products = prods.rows.map((p) => {
    const f = fmtProduct(p);
    if (!settings.showLikes) delete f.likes; // los clientes no ven la cantidad salvo que lo actives
    return f;
  });
  settings.payReady = !!settings.payOn && !!(process.env.MP_ACCESS_TOKEN || '').trim();
  const cst = carriersApi.status();
  settings.carriersReady = { andreani: !!settings.shipAndreaniOn && cst.andreani.configured, correo: !!settings.shipCorreoOn && cst.correo.configured };
  res.json({ settings, categories: cats.rows, products, reviews });
}));

// Cotización de envío
app.post('/api/shipping', wrap(async (req, res) => {
  if (!rateOk(req.ip, 'ship', 25, 60e3)) return res.status(429).json({ ok: false, message: 'Demasiadas consultas. Probá de nuevo en un minuto.' });
  const cp = String(req.body.cp || '').trim();
  if (!/^\d{4}$/.test(cp)) return res.json({ ok: false, reason: 'invalid', message: 'Ingresá un código postal de 4 números.' });
  if (!MENDOZA_CP.test(cp)) return res.json({ ok: false, reason: 'outside', message: 'Por ahora hacemos envíos solo dentro de Mendoza.' });
  const s = await getSettings();
  const r = await getKm(cp);
  if (r.km === null) return res.json({ ok: false, reason: r.reason || 'not_found', message: 'No pudimos calcular el envío automáticamente. Igual podés enviar el pedido y te lo confirmamos por WhatsApp.' });
  res.json({ ok: true, cp, km: Math.round(r.km * 10) / 10, cost: shippingCost(r.km, s), label: r.label || '' });
}));

/* --------------------------- Admin ---------------------------------- */
app.post('/api/admin/login', (req, res) => {
  if (!ADMIN_PASSWORD) return res.status(500).json({ error: 'Falta configurar ADMIN_PASSWORD en Render.' });
  if (!rateOk(req.ip, 'login', 8, 15 * 60e3)) return res.status(429).json({ error: 'Demasiados intentos. Esperá unos minutos.' });
  const a = Buffer.from(String(req.body.password || ''));
  const b = Buffer.from(ADMIN_PASSWORD);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) return res.status(401).json({ error: 'Contraseña incorrecta.' });
  res.json({ token: jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '30d' }) });
});

app.get('/api/admin/store', auth, wrap(async (req, res) => {
  const [settings, cats, prods] = await Promise.all([
    getSettings(),
    q('select id, name from categories order by position, id'),
    q(`select ${PRODUCT_COLS}, active, (select count(*)::int from likes l where l.pid = products.id) as likes from products order by position, id`),
  ]);
  res.json({ settings, categories: cats.rows, products: prods.rows.map(fmtProduct) });
}));

app.put('/api/admin/settings', auth, wrap(async (req, res) => {
  try {
    await saveSettings(req.body || {});
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  res.json({ settings: await getSettings() });
}));

// Categorías
app.post('/api/admin/categories', auth, wrap(async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 120);
  if (!name) return res.status(400).json({ error: 'Poné un nombre.' });
  const { rows } = await q("insert into categories(name, position) values($1, coalesce((select max(position) from categories), 0) + 1) returning id, name", [name]);
  res.json(rows[0]);
}));
app.put('/api/admin/categories/:id', auth, wrap(async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 120);
  if (!name) return res.status(400).json({ error: 'Poné un nombre.' });
  await q('update categories set name = $2 where id = $1', [req.params.id, name]);
  res.json({ ok: true });
}));
app.delete('/api/admin/categories/:id', auth, wrap(async (req, res) => {
  await q('delete from categories where id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// Productos
app.post('/api/admin/products', auth, wrap(async (req, res) => {
  let p;
  try { p = cleanProduct(req.body); } catch (e) { return res.status(400).json({ error: e.message }); }
  const { rows } = await q(
    `insert into products(category_id, name, description, base_price, images, groups, active, pinned, discount_type, discount_value, discount_ends, lead_hours, weight_g, dim_h, dim_w, dim_l, position)
     values($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, coalesce((select max(position) from products), 0) + 1) returning id`,
    [p.category_id, p.name, p.description, p.base_price, JSON.stringify(p.images), JSON.stringify(p.groups), p.active, p.pinned, p.discount_type, p.discount_value, p.discount_ends, p.lead_hours, p.weight_g, p.dim_h, p.dim_w, p.dim_l]
  );
  res.json({ id: rows[0].id });
}));
app.put('/api/admin/products/:id', auth, wrap(async (req, res) => {
  let p;
  try { p = cleanProduct(req.body); } catch (e) { return res.status(400).json({ error: e.message }); }
  await q(
    `update products set category_id=$2, name=$3, description=$4, base_price=$5, images=$6::jsonb, groups=$7::jsonb, active=$8,
       pinned=$9, discount_type=$10, discount_value=$11, discount_ends=$12, lead_hours=$13, weight_g=$14, dim_h=$15, dim_w=$16, dim_l=$17 where id=$1`,
    [req.params.id, p.category_id, p.name, p.description, p.base_price, JSON.stringify(p.images), JSON.stringify(p.groups), p.active, p.pinned, p.discount_type, p.discount_value, p.discount_ends, p.lead_hours, p.weight_g, p.dim_h, p.dim_w, p.dim_l]
  );
  res.json({ ok: true });
}));
app.delete('/api/admin/products/:id', auth, wrap(async (req, res) => {
  await q('delete from products where id = $1', [req.params.id]);
  await q('delete from likes where pid = $1', [req.params.id]);
  res.json({ ok: true });
}));

app.put('/api/admin/reorder', auth, wrap(async (req, res) => {
  const table = req.body.table === 'categories' ? 'categories' : req.body.table === 'products' ? 'products' : null;
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map((x) => parseInt(x, 10)).filter(Number.isInteger) : [];
  if (!table) return res.status(400).json({ error: 'Tabla inválida' });
  for (let i = 0; i < ids.length; i++) await q(`update ${table} set position = $2 where id = $1`, [ids[i], i + 1]);
  res.json({ ok: true });
}));

// Subida de imágenes: el navegador las reduce y el servidor las vuelve a comprimir
app.post('/api/admin/upload', auth, wrap(async (req, res) => {
  const kind = SIZES[req.body.kind] ? req.body.kind : 'product';
  let main = decodeDataUrl(req.body.dataUrl);
  if (!main) return res.status(400).json({ error: 'Imagen inválida.' });
  if (main.buf.length > 6 * 1024 * 1024) return res.status(400).json({ error: 'La imagen es demasiado pesada.' });
  const originalBytes = main.buf.length;
  main = await shrink(main, SIZES[kind].max, SIZES[kind].q);

  let thumb = null;
  if (kind === 'product') {
    thumb = decodeDataUrl(req.body.thumbUrl);
    if (thumb && thumb.buf.length > 600 * 1024) thumb = null;
    thumb = await shrink(thumb || main, 420, 70);
    if (thumb && thumb.buf.length >= main.buf.length && !thumb.mime) thumb = null;
  }
  const { rows } = await q(
    'insert into images(mime, data, thumb, thumb_mime) values($1,$2,$3,$4) returning id',
    [main.mime, main.buf, thumb ? thumb.buf : null, thumb ? thumb.mime : null]
  );
  res.json({ id: rows[0].id, bytes: main.buf.length, thumbBytes: thumb ? thumb.buf.length : 0, received: originalBytes });
}));

// Códigos postales / km
app.get('/api/admin/postal', auth, wrap(async (req, res) => {
  const { rows } = await q('select cp, label, lat, lon, km, manual, origin, source from postal_codes order by cp');
  res.json({ rows: rows.map((r) => ({ ...r, km: r.km === null ? null : Number(r.km) })) });
}));
app.post('/api/admin/postal', auth, wrap(async (req, res) => {
  const cp = String(req.body.cp || '').trim();
  if (!MENDOZA_CP.test(cp)) return res.status(400).json({ error: 'Código postal de Mendoza inválido (debe empezar con 55 o 56).' });
  if (req.body.km !== undefined && req.body.km !== '' && req.body.km !== null) {
    const km = Number(req.body.km);
    if (!Number.isFinite(km) || km < 0) return res.status(400).json({ error: 'Km inválidos.' });
    const s = await getSettings();
    await q(
      `insert into postal_codes(cp, km, manual, origin, source) values($1,$2,true,$3,'manual')
       on conflict (cp) do update set km = $2, manual = true, origin = $3, source = 'manual', updated_at = now()`,
      [cp, km, String(s.originCP)]
    );
    return res.json({ ok: true });
  }
  const r = await getKm(cp);
  if (r.km === null) return res.status(404).json({ error: 'No se pudo ubicar ese código postal automáticamente. Cargale los km a mano.' });
  res.json({ ok: true, km: r.km });
}));
app.post('/api/admin/postal/bulk', auth, wrap(async (req, res) => {
  const list = [...new Set(String(req.body.cps || '').split(/[^0-9]+/).filter((x) => MENDOZA_CP.test(x)))].slice(0, 200);
  res.json({ started: list.length });
  (async () => {
    for (const cp of list) {
      try { await getKm(cp); } catch (e) { console.error('bulk', cp, e.message); }
    }
  })();
}));
app.put('/api/admin/postal/:cp', auth, wrap(async (req, res) => {
  const km = Number(req.body.km);
  if (!Number.isFinite(km) || km < 0) return res.status(400).json({ error: 'Km inválidos.' });
  const s = await getSettings();
  await q(
    `insert into postal_codes(cp, km, manual, origin, source) values($1,$2,true,$3,'manual')
     on conflict (cp) do update set km = $2, manual = true, origin = $3, source = 'manual', updated_at = now()`,
    [req.params.cp, km, String(s.originCP)]
  );
  res.json({ ok: true });
}));
app.post('/api/admin/postal/:cp/recalc', auth, wrap(async (req, res) => {
  await q('update postal_codes set km = null, manual = false, lat = null, lon = null, label = null where cp = $1', [req.params.cp]);
  const r = await getKm(req.params.cp);
  if (r.km === null) return res.status(404).json({ error: 'No se pudo ubicar automáticamente. Cargale los km a mano.' });
  res.json({ ok: true, km: r.km });
}));
app.delete('/api/admin/postal/:cp', auth, wrap(async (req, res) => {
  await q('delete from postal_codes where cp = $1', [req.params.cp]);
  res.json({ ok: true });
}));

// Cupones, pedidos y estadísticas
const ctx = { app, q, auth, wrap, rateOk, getSettings, jwtSecret: JWT_SECRET, pool, cleanupImages };
// Primero las notificaciones, para que pedidos y mayoristas puedan avisar al celular
const pushApi = require('./lib/push.js').mount(ctx);
ctx.notify = pushApi.notify;
ctx.getAccount = require('./lib/accounts.js').mount(ctx).getAccount;
ctx.publicUrl = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '';
const carriersApi = require('./lib/carriers.js');
ctx.carriers = carriersApi;
carriersApi.mount(ctx);
require('./lib/payments.js').mount(ctx);
const revApi = reviewsLib.mount(ctx);
require('./lib/coupons.js').mount(ctx);
require('./lib/orders.js').mount(ctx);
require('./lib/analytics.js').mount(ctx);
require('./lib/share.js').mount(ctx);
require('./lib/wholesale.js').mount(ctx);
require('./lib/calc.js').mount(ctx);
const maintenance = require('./lib/maintenance.js').mount(ctx);

/* --------------------------- Archivos estáticos --------------------- */
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/sw-push.js', (req, res) => res.sendFile('sw-push.js', { root: path.join(__dirname, 'public'), headers: { 'Service-Worker-Allowed': '/', 'Cache-Control': 'no-cache' } }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

initDb()
  .then(() => {
    app.listen(PORT, () => console.log('Florche.Eternas escuchando en el puerto ' + PORT));
    startKeepAwake();
    cleanupImages();
    setInterval(cleanupImages, 24 * 3600e3).unref();
    // Cada día se resumen las visitas viejas para ahorrar espacio
    const nightly = () => maintenance.run().catch((e) => console.error('mantenimiento:', e.message));
    setTimeout(nightly, 90e3).unref();
    setInterval(nightly, 24 * 3600e3).unref();
  })
  .catch((e) => {
    console.error('No se pudo iniciar la base de datos:', e.message);
    process.exit(1);
  });
