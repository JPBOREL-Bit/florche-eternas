'use strict';
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

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
});
const q = (text, params) => pool.query(text, params);

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
  orderIntro: '¡Hola! Quiero hacer este pedido desde la web:',
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

const NUM_KEYS = ['pricePerKm', 'kmMultiplier', 'shippingBase', 'shippingMin', 'shippingRound'];
const BOOL_KEYS = ['allowPickup'];
const ID_KEYS = ['logoId', 'heroImageId'];

async function getSettings() {
  const { rows } = await q('select key, value from settings');
  const s = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in DEFAULT_SETTINGS) s[r.key] = r.value;
  return s;
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
    } else {
      v = String(v ?? '').trim().slice(0, 5000);
      if (key === 'originCP' && !/^\d{4}$/.test(v)) throw new Error('El código postal de origen debe tener 4 números.');
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
    create table if not exists images (
      id serial primary key,
      mime text not null,
      data bytea not null,
      created_at timestamptz not null default now()
    );
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
  `);
  await seedIfEmpty();
}

const rid = () => crypto.randomBytes(4).toString('hex');

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
    jwt.verify(token, JWT_SECRET);
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
      options: (Array.isArray(g.options) ? g.options : []).filter((o) => String(o.name || '').trim()).slice(0, 80).map((o) => ({
        id: String(o.id || rid()).slice(0, 40),
        name: String(o.name || 'Sin nombre').trim().slice(0, 120),
        price: Number.isFinite(Number(o.price)) ? Number(o.price) : 0,
        color: /^#[0-9a-fA-F]{6}$/.test(o.color || '') ? o.color : '',
      })),
    };
  });
  return {
    name,
    description: String(b.description || '').trim().slice(0, 4000),
    base_price: price,
    category_id: Number.isInteger(catId) ? catId : null,
    images,
    groups,
    active: b.active === undefined ? true : !!b.active,
  };
}

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
/* App                                                                 */
/* ------------------------------------------------------------------ */
const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '8mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Imágenes guardadas en la base de datos
app.get('/img/:id', wrap(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(404).end();
  const { rows } = await q('select mime, data from images where id = $1', [id]);
  if (!rows[0]) return res.status(404).end();
  res.set('Content-Type', rows[0].mime);
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(rows[0].data);
}));

// Datos públicos de la tienda
app.get('/api/store', wrap(async (req, res) => {
  const [settings, cats, prods] = await Promise.all([
    getSettings(),
    q('select id, name from categories order by position, id'),
    q('select id, category_id, name, description, base_price, images, groups from products where active order by position, id'),
  ]);
  res.set('Cache-Control', 'no-store');
  res.json({ settings, categories: cats.rows, products: prods.rows.map((p) => ({ ...p, base_price: Number(p.base_price) })) });
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
    q('select id, category_id, name, description, base_price, images, groups, active from products order by position, id'),
  ]);
  res.json({ settings, categories: cats.rows, products: prods.rows.map((p) => ({ ...p, base_price: Number(p.base_price) })) });
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
    `insert into products(category_id, name, description, base_price, images, groups, active, position)
     values($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7, coalesce((select max(position) from products), 0) + 1) returning id`,
    [p.category_id, p.name, p.description, p.base_price, JSON.stringify(p.images), JSON.stringify(p.groups), p.active]
  );
  res.json({ id: rows[0].id });
}));
app.put('/api/admin/products/:id', auth, wrap(async (req, res) => {
  let p;
  try { p = cleanProduct(req.body); } catch (e) { return res.status(400).json({ error: e.message }); }
  await q(
    `update products set category_id=$2, name=$3, description=$4, base_price=$5, images=$6::jsonb, groups=$7::jsonb, active=$8 where id=$1`,
    [req.params.id, p.category_id, p.name, p.description, p.base_price, JSON.stringify(p.images), JSON.stringify(p.groups), p.active]
  );
  res.json({ ok: true });
}));
app.delete('/api/admin/products/:id', auth, wrap(async (req, res) => {
  await q('delete from products where id = $1', [req.params.id]);
  res.json({ ok: true });
}));

app.put('/api/admin/reorder', auth, wrap(async (req, res) => {
  const table = req.body.table === 'categories' ? 'categories' : req.body.table === 'products' ? 'products' : null;
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map((x) => parseInt(x, 10)).filter(Number.isInteger) : [];
  if (!table) return res.status(400).json({ error: 'Tabla inválida' });
  for (let i = 0; i < ids.length; i++) await q(`update ${table} set position = $2 where id = $1`, [ids[i], i + 1]);
  res.json({ ok: true });
}));

// Subida de imágenes (llegan ya reducidas desde el navegador)
app.post('/api/admin/upload', auth, wrap(async (req, res) => {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body.dataUrl || ''));
  if (!m) return res.status(400).json({ error: 'Imagen inválida.' });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 4 * 1024 * 1024) return res.status(400).json({ error: 'La imagen es demasiado pesada.' });
  const { rows } = await q('insert into images(mime, data) values($1,$2) returning id', [m[1], buf]);
  res.json({ id: rows[0].id });
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

/* --------------------------- Archivos estáticos --------------------- */
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

initDb()
  .then(() => {
    app.listen(PORT, () => console.log('Florche.Eternas escuchando en el puerto ' + PORT));
    cleanupImages();
    setInterval(cleanupImages, 24 * 3600e3).unref();
  })
  .catch((e) => {
    console.error('No se pudo iniciar la base de datos:', e.message);
    process.exit(1);
  });
