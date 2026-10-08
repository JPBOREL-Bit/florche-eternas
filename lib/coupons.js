'use strict';
const Pricing = require('../public/js/pricing.js');
const { loadProducts, priceCart } = require('./cart.js');

const money = Pricing.money;
const normCode = (c) => String(c || '').trim().toUpperCase().replace(/\s+/g, '').slice(0, 40);

function couponLabel(c) {
  if (c.type === 'shipping') return 'Envío gratis';
  if (c.type === 'percent') return `${Number(c.value)}% de descuento`;
  return `${money(c.value)} de descuento`;
}

/* Revisa si un cupón se puede usar con este carrito y cuánto descuenta. */
function evalCoupon(c, lines, subtotal) {
  if (!c || !c.active) return { ok: false, message: 'Ese cupón no existe o no está disponible.' };
  if (c.expires_at && new Date(c.expires_at).getTime() < Date.now()) return { ok: false, message: 'Ese cupón ya venció.' };
  if (c.usage_limit !== null && Number(c.used) >= Number(c.usage_limit)) return { ok: false, message: 'Ese cupón ya se agotó.' };
  const min = Number(c.min_purchase) || 0;
  if (min > 0 && subtotal < min) {
    return { ok: false, message: `Este cupón se usa en compras desde ${money(min)}. Te faltan ${money(min - subtotal)}.` };
  }
  const ids = Array.isArray(c.product_ids) ? c.product_ids : [];
  const eligible = lines.filter((l) => (!ids.length || ids.includes(l.pid)) && !(c.exclude_discounted && l.discounted));
  const base = eligible.reduce((a, l) => a + l.line, 0);
  if (c.type !== 'shipping' && base <= 0) {
    return { ok: false, message: 'Este cupón no aplica a los productos de tu carrito.' };
  }
  let discount = 0;
  if (c.type === 'percent') discount = Math.round((base * Math.min(Number(c.value), 100)) / 100);
  else if (c.type === 'amount') discount = Math.min(Math.round(Number(c.value)), base);
  const cap = Number(c.max_discount) || 0;
  if (cap > 0) discount = Math.min(discount, cap);
  return { ok: true, discount, freeShipping: c.type === 'shipping', label: couponLabel(c), code: c.code };
}

function cleanCoupon(b) {
  const code = normCode(b.code);
  if (!code) throw new Error('Poné un nombre para el cupón.');
  const type = ['percent', 'amount', 'shipping'].includes(b.type) ? b.type : 'percent';
  let value = Number(b.value) || 0;
  if (type === 'percent' && (value <= 0 || value > 100)) throw new Error('El porcentaje tiene que ser entre 1 y 100.');
  if (type === 'amount' && value <= 0) throw new Error('Poné cuántos pesos descuenta.');
  if (type === 'shipping') value = 0;
  const num = (x) => (Number.isFinite(Number(x)) && Number(x) > 0 ? Number(x) : 0);
  let expires = null;
  if (b.expires_at) {
    const d = new Date(b.expires_at);
    if (Number.isNaN(d.getTime())) throw new Error('La fecha de vencimiento es inválida.');
    expires = d.toISOString();
  }
  let limit = null;
  if (b.usage_limit !== null && b.usage_limit !== '' && b.usage_limit !== undefined) {
    limit = parseInt(b.usage_limit, 10);
    if (!(limit >= 1)) throw new Error('La cantidad de usos tiene que ser 1 o más (o dejalo vacío para ilimitado).');
  }
  return {
    code,
    type,
    value,
    min_purchase: num(b.min_purchase),
    max_discount: num(b.max_discount),
    product_ids: (Array.isArray(b.product_ids) ? b.product_ids : []).map((x) => parseInt(x, 10)).filter(Number.isInteger),
    expires_at: expires,
    active: b.active === undefined ? true : !!b.active,
    usage_limit: limit,
    used: Math.max(0, parseInt(b.used, 10) || 0),
    exclude_discounted: !!b.exclude_discounted,
  };
}

function mount({ app, q, auth, wrap, rateOk }) {
  /* Público: el cliente prueba un cupón */
  app.post('/api/coupons/validate', wrap(async (req, res) => {
    if (!rateOk(req.ip, 'coupon', 40, 60e3)) return res.json({ ok: false, message: 'Demasiados intentos. Esperá un minuto.' });
    const code = normCode(req.body.code);
    if (!code) return res.json({ ok: false, message: 'Escribí el código del cupón.' });
    const products = await loadProducts(q);
    const cart = priceCart(req.body.items, products);
    if (cart.error) return res.json({ ok: false, message: cart.error });
    const { rows } = await q('select * from coupons where code = $1', [code]);
    const r = evalCoupon(rows[0], cart.items, cart.subtotal);
    res.json(r);
  }));

  /* Admin */
  app.get('/api/admin/coupons', auth, wrap(async (req, res) => {
    const { rows } = await q('select * from coupons order by id desc');
    res.json({ rows: rows.map((c) => ({ ...c, value: Number(c.value), min_purchase: Number(c.min_purchase), max_discount: Number(c.max_discount) })) });
  }));

  const dupMsg = (e) => (e.code === '23505' ? 'Ya existe un cupón con ese nombre.' : e.message);

  app.post('/api/admin/coupons', auth, wrap(async (req, res) => {
    let c;
    try { c = cleanCoupon(req.body); } catch (e) { return res.status(400).json({ error: e.message }); }
    try {
      const { rows } = await q(
        `insert into coupons(code, type, value, min_purchase, max_discount, product_ids, expires_at, active, usage_limit, used, exclude_discounted)
         values($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11) returning id`,
        [c.code, c.type, c.value, c.min_purchase, c.max_discount, JSON.stringify(c.product_ids), c.expires_at, c.active, c.usage_limit, c.used, c.exclude_discounted]
      );
      res.json({ id: rows[0].id });
    } catch (e) { res.status(400).json({ error: dupMsg(e) }); }
  }));

  app.put('/api/admin/coupons/:id', auth, wrap(async (req, res) => {
    let c;
    try { c = cleanCoupon(req.body); } catch (e) { return res.status(400).json({ error: e.message }); }
    try {
      await q(
        `update coupons set code=$2, type=$3, value=$4, min_purchase=$5, max_discount=$6, product_ids=$7::jsonb,
           expires_at=$8, active=$9, usage_limit=$10, used=$11, exclude_discounted=$12 where id=$1`,
        [req.params.id, c.code, c.type, c.value, c.min_purchase, c.max_discount, JSON.stringify(c.product_ids), c.expires_at, c.active, c.usage_limit, c.used, c.exclude_discounted]
      );
      res.json({ ok: true });
    } catch (e) { res.status(400).json({ error: dupMsg(e) }); }
  }));

  app.delete('/api/admin/coupons/:id', auth, wrap(async (req, res) => {
    await q('delete from coupons where id = $1', [req.params.id]);
    res.json({ ok: true });
  }));
}

module.exports = { mount, evalCoupon, normCode };
