'use strict';
// Envíos con Andreani y Correo Argentino (MiCorreo).
// Las tarifas se piden SIEMPRE desde el servidor (nunca confiamos en el precio que mande el navegador)
// y las credenciales viven en las variables de entorno de Render, nunca en la base ni en el navegador.

const TTL = 10 * 60e3;          // una cotización se reutiliza 10 minutos
const TIMEOUT = 9000;
const cache = new Map();
const env = (k) => (process.env[k] || '').trim();
const b64 = (s) => Buffer.from(s).toString('base64');
const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);

const andreaniBase = () => (env('ANDREANI_API_BASE') || 'https://apis.andreani.com').replace(/\/$/, '');
const correoBase = () => (env('MICORREO_API_BASE') || 'https://api.correoargentino.com.ar/micorreo/v1').replace(/\/$/, '');

/* ---------- qué está configurado (para el panel) ---------- */
function status() {
  const need = (list) => list.filter((k) => !env(k));
  const a = need(['ANDREANI_USER', 'ANDREANI_PASS']);
  if (!env('ANDREANI_CONTRACT_DOM') && !env('ANDREANI_CONTRACT') && !env('ANDREANI_CONTRACT_SUC')) a.push('ANDREANI_CONTRACT_DOM');
  const c = need(['MICORREO_USER', 'MICORREO_PASS', 'MICORREO_CUSTOMER_ID']);
  return {
    andreani: { configured: a.length === 0, missing: a },
    correo: { configured: c.length === 0, missing: c },
  };
}

async function fetchT(url, opts = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try { return await fetch(url, { ...opts, signal: ctl.signal }); } finally { clearTimeout(t); }
}

/* ---------- paquete: peso y medidas del pedido ---------- */
function packageOf(items, products, s) {
  const dW = Number(s.pkgWeightG) || 500, dH = Number(s.pkgH) || 15, dWi = Number(s.pkgW) || 20, dL = Number(s.pkgL) || 30;
  let weight = 0, height = 0, width = 0, length = 0;
  for (const it of items) {
    const p = products.get(it.pid) || {};
    const q = Math.max(1, it.qty || 1);
    weight += q * (Number(p.weight_g) || dW);
    height += q * (Number(p.dim_h) || dH);          // los productos se apilan
    width = Math.max(width, Number(p.dim_w) || dWi);
    length = Math.max(length, Number(p.dim_l) || dL);
  }
  return { weightG: Math.max(1, Math.round(weight)), h: Math.max(1, Math.round(height)), w: Math.max(1, Math.round(width)), l: Math.max(1, Math.round(length)) };
}

/* ---------- Andreani ---------- */
async function andreaniToken(force) {
  const c = cache.get('a:token');
  if (!force && c && c.exp > Date.now()) return c.v;
  const r = await fetchT(andreaniBase() + '/login', { headers: { Authorization: 'Basic ' + b64(env('ANDREANI_USER') + ':' + env('ANDREANI_PASS')) } });
  if (!r.ok) throw new Error(`Andreani rechazó el usuario o la contraseña (${r.status})`);
  const tok = r.headers.get('x-authorization-token');
  if (!tok) throw new Error('Andreani no devolvió el token de acceso');
  cache.set('a:token', { v: tok, exp: Date.now() + 20 * 60e3 });
  return tok;
}

async function andreaniRate(contract, cp, pkg, declared) {
  const vol = (pkg.h * pkg.w * pkg.l) / (env('ANDREANI_VOLUME_UNIT') === 'm3' ? 1e6 : 1);
  const params = new URLSearchParams({ cpDestino: cp, contrato: contract });
  if (env('ANDREANI_CLIENT')) params.set('cliente', env('ANDREANI_CLIENT'));
  if (env('ANDREANI_ORIGIN_BRANCH')) params.set('sucursalOrigen', env('ANDREANI_ORIGIN_BRANCH'));
  params.set('bultos[0][volumen]', String(vol));
  params.set('bultos[0][kilos]', String(pkg.weightG / 1000));
  params.set('bultos[0][valorDeclarado]', String(Math.round(declared)));
  const call = async (force) => fetchT(`${andreaniBase()}/v1/tarifas?${params}`, { headers: { 'x-authorization-token': await andreaniToken(force) } });
  let r = await call(false);
  if (r.status === 401) r = await call(true);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Andreani no pudo cotizar (${r.status}${j && j.message ? ': ' + j.message : ''})`);
  const price = Number((j.tarifaConIva && j.tarifaConIva.total) || (j.tarifaSinIva && j.tarifaSinIva.total));
  if (!(price > 0)) throw new Error('Andreani devolvió una tarifa vacía');
  return price;
}

async function quoteAndreani(cp, pkg, declared, s) {
  const dom = env('ANDREANI_CONTRACT_DOM') || env('ANDREANI_CONTRACT');
  const suc = env('ANDREANI_CONTRACT_SUC');
  const out = [];
  const days = String(s.andreaniDays || '').trim();
  if (dom) out.push({ id: 'andreani:dom', carrier: 'Andreani', service: 'A domicilio', price: await andreaniRate(dom, cp, pkg, declared), days });
  if (suc) out.push({ id: 'andreani:suc', carrier: 'Andreani', service: 'A sucursal', price: await andreaniRate(suc, cp, pkg, declared), days, note: 'Te escribimos para elegir la sucursal.' });
  return out;
}

/* ---------- Correo Argentino (MiCorreo) ---------- */
async function correoToken(force) {
  const c = cache.get('c:token');
  if (!force && c && c.exp > Date.now()) return c.v;
  const r = await fetchT(correoBase() + '/token', { method: 'POST', headers: { Authorization: 'Basic ' + b64(env('MICORREO_USER') + ':' + env('MICORREO_PASS')) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.token) throw new Error(`Correo Argentino rechazó el usuario o la contraseña (${r.status})`);
  cache.set('c:token', { v: j.token, exp: Date.now() + 25 * 60e3 });
  return j.token;
}

async function quoteCorreo(cp, pkg, s) {
  const dims = { weight: pkg.weightG, height: pkg.h, width: pkg.w, length: pkg.l };   // peso en gramos, medidas en cm
  const send = async (dimensions, force) => fetchT(correoBase() + '/rates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (await correoToken(force)) },
    body: JSON.stringify({ customerId: env('MICORREO_CUSTOMER_ID'), postalCodeOrigin: String(s.originCP || '5500'), postalCodeDestination: cp, dimensions }),
  });
  let r = await send(dims, false);
  if (r.status === 401) r = await send(dims, true);
  if (r.status === 400 || r.status === 422) r = await send([dims], false);     // por si la API espera una lista
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Correo Argentino no pudo cotizar (${r.status}${j && j.message ? ': ' + j.message : ''})`);
  return (j.rates || []).filter((x) => Number(x.price) > 0).map((x) => {
    const t = x.deliveredType === 'S' ? 'S' : 'D';
    const a = x.deliveryTimeMin, b = x.deliveryTimeMax;
    return {
      id: `correo:${t}:${slug(x.productName)}`, carrier: 'Correo Argentino',
      service: (t === 'S' ? 'A sucursal' : 'A domicilio') + (x.productName ? ` · ${x.productName}` : ''),
      price: Number(x.price), days: a && b ? `${a} a ${b} días hábiles` : a ? `${a} días hábiles` : '',
      note: t === 'S' ? 'Te escribimos para elegir la sucursal.' : '',
    };
  });
}

/* ---------- cotización completa (con caché y tolerancia a fallas) ---------- */
async function quote({ cp, pkg, declared, settings }) {
  const st = status();
  const errors = [];
  const handling = Math.max(0, Number(settings.carrierHandling) || 0);
  const key = [cp, pkg.weightG, pkg.h, pkg.w, pkg.l, Math.round(declared / 1000), settings.shipAndreaniOn ? 1 : 0, settings.shipCorreoOn ? 1 : 0, settings.originCP, handling, settings.andreaniDays || ''].join('|');
  const hit = cache.get('q:' + key);
  if (hit && hit.exp > Date.now()) return { options: hit.options.map((o) => ({ ...o })), errors: hit.errors };
  const jobs = [];
  if (settings.shipAndreaniOn && st.andreani.configured) jobs.push(['Andreani', quoteAndreani(cp, pkg, declared, settings)]);
  if (settings.shipCorreoOn && st.correo.configured) jobs.push(['Correo Argentino', quoteCorreo(cp, pkg, settings)]);
  const res = await Promise.allSettled(jobs.map((j) => j[1]));
  const options = [];
  res.forEach((r, i) => {
    if (r.status === 'fulfilled') options.push(...r.value);
    else { errors.push(jobs[i][0]); console.error('envío ' + jobs[i][0] + ':', r.reason && r.reason.message); }
  });
  options.forEach((o) => { o.price = Math.ceil(o.price + handling); });
  options.sort((a, b) => a.price - b.price);
  if (!errors.length) cache.set('q:' + key, { options, errors, exp: Date.now() + TTL });
  if (cache.size > 500) cache.clear();
  return { options, errors };
}

function mount({ app, q, auth, wrap, rateOk, getSettings }) {
  const { loadProducts, priceCart } = require('./cart.js');

  // Público: opciones de envío por correo para el carrito
  app.post('/api/shipping/carriers', wrap(async (req, res) => {
    if (!rateOk(req.ip, 'carriers', 40, 60e3)) return res.status(429).json({ ok: false, message: 'Demasiadas consultas. Probá en un minuto.' });
    const cp = String((req.body && req.body.cp) || '').replace(/\D/g, '').slice(0, 4);
    if (cp.length !== 4) return res.json({ ok: false, message: 'Ingresá un código postal de 4 números.' });
    const settings = await getSettings();
    const products = await loadProducts(q);
    const cart = priceCart(req.body && req.body.items, products);
    if (cart.error) return res.json({ ok: false, message: cart.error });
    const r = await quote({ cp, pkg: packageOf(cart.items, products, settings), declared: cart.subtotal, settings });
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, options: r.options, errors: r.errors });
  }));

  // Panel: qué está configurado y prueba de conexión
  app.get('/api/admin/carriers/status', auth, wrap(async (req, res) => res.json(status())));
  app.post('/api/admin/carriers/test', auth, wrap(async (req, res) => {
    const cp = String((req.body && req.body.cp) || '1000').replace(/\D/g, '').slice(0, 4) || '1000';
    const settings = await getSettings();
    const pkg = { weightG: 1000, h: 15, w: 20, l: 30 };
    cache.clear();
    const r = await quote({ cp, pkg, declared: 10000, settings: { ...settings, shipAndreaniOn: true, shipCorreoOn: true } });
    res.json({ ok: true, cp, options: r.options, errors: r.errors, status: status() });
  }));
}

module.exports = { mount, quote, packageOf, status };
