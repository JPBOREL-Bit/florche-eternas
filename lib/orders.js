'use strict';
const Pricing = require('../public/js/pricing.js');
const { loadProducts, priceCart } = require('./cart.js');
const { evalCoupon, normCode } = require('./coupons.js');

const STATUSES = ['pendiente', 'realizada', 'rechazada'];

function mount({ app, q, auth, wrap, rateOk, getSettings }) {
  /* Público: se registra el pedido cuando el cliente toca "Enviar por WhatsApp" */
  app.post('/api/orders', wrap(async (req, res) => {
    if (!rateOk(req.ip, 'order', 12, 60e3)) return res.status(429).json({ ok: false, message: 'Demasiados pedidos seguidos.' });
    const b = req.body || {};
    const name = String(b.name || '').trim().slice(0, 80);
    if (!name) return res.status(400).json({ ok: false, message: 'Falta el nombre.' });
    const token = String(b.token || '').replace(/[^a-z0-9]/gi, '').slice(0, 40) || null;

    // Si el cliente toca dos veces el botón no se duplica el pedido
    if (token) {
      const dup = await q('select id, total from orders where client_token = $1', [token]);
      if (dup.rowCount) return res.json({ ok: true, id: dup.rows[0].id, total: Number(dup.rows[0].total), duplicate: true });
    }

    const products = await loadProducts(q);
    const cart = priceCart(b.items, products);
    if (cart.error) return res.status(400).json({ ok: false, message: cart.error });

    const settings = await getSettings();
    const tiers = Pricing.tierEffects(cart.subtotal, settings.progressOn ? settings.progressTiers : []);
    const benefits = [...tiers.benefits];
    let couponCode = null;
    let couponDiscount = 0;

    const code = normCode(b.coupon);
    if (code) {
      const { rows } = await q('select * from coupons where code = $1', [code]);
      const ev = evalCoupon(rows[0], cart.items, cart.subtotal);
      if (ev.ok) {
        // Descuenta un uso solo si todavía quedan (evita pasarse del límite)
        const upd = await q(
          'update coupons set used = used + 1 where id = $1 and (usage_limit is null or used < usage_limit) returning id',
          [rows[0].id]
        );
        if (upd.rowCount) {
          couponCode = rows[0].code;
          couponDiscount = ev.discount;
          if (ev.freeShipping) benefits.push('Envío gratis (cupón)');
        }
      }
    }

    const total = Math.max(0, cart.subtotal - tiers.discount - couponDiscount);
    const delivery = b.delivery === 'retiro' ? 'retiro' : 'envio';
    const est = Number.isFinite(Number(b.shipEstimate)) && b.shipEstimate !== null ? Number(b.shipEstimate) : null;
    const ids = (v) => String(v || '').replace(/[^a-z0-9]/gi, '').slice(0, 40) || null;

    try {
      const { rows } = await q(
        `insert into orders(client_token, name, items, subtotal, tier_discount, coupon_code, coupon_discount, benefits, total,
                            delivery, cp, address, ship_estimate, vid, sid)
         values($1,$2,$3::jsonb,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15) returning id`,
        [
          token, name, JSON.stringify(cart.items), cart.subtotal, tiers.discount, couponCode, couponDiscount,
          JSON.stringify(benefits), total, delivery, String(b.cp || '').replace(/\D/g, '').slice(0, 4) || null,
          String(b.address || '').trim().slice(0, 200) || null, est, ids(b.vid), ids(b.sid),
        ]
      );
      res.json({ ok: true, id: rows[0].id, total });
    } catch (e) {
      if (e.code === '23505' && token) {
        const dup = await q('select id, total from orders where client_token = $1', [token]);
        return res.json({ ok: true, id: dup.rows[0].id, total: Number(dup.rows[0].total), duplicate: true });
      }
      throw e;
    }
  }));

  /* Admin */
  const fmt = (o) => ({
    ...o,
    subtotal: Number(o.subtotal),
    tier_discount: Number(o.tier_discount),
    coupon_discount: Number(o.coupon_discount),
    total: Number(o.total),
    ship_estimate: o.ship_estimate === null ? null : Number(o.ship_estimate),
  });

  app.get('/api/admin/orders', auth, wrap(async (req, res) => {
    const st = STATUSES.includes(req.query.status) ? req.query.status : null;
    const { rows } = await q(
      `select id, created_at, name, items, subtotal, tier_discount, coupon_code, coupon_discount, benefits, total,
              delivery, cp, address, ship_estimate, status, decided_at
       from orders ${st ? 'where status = $1' : ''} order by id desc limit 300`,
      st ? [st] : []
    );
    const counts = await q('select status, count(*)::int n from orders group by status');
    res.json({ rows: rows.map(fmt), counts: Object.fromEntries(counts.rows.map((r) => [r.status, r.n])) });
  }));

  app.put('/api/admin/orders/:id/status', auth, wrap(async (req, res) => {
    const st = req.body.status;
    if (!STATUSES.includes(st)) return res.status(400).json({ error: 'Estado inválido.' });
    await q(
      "update orders set status = $2, decided_at = case when $2 = 'pendiente' then null else now() end where id = $1",
      [req.params.id, st]
    );
    res.json({ ok: true });
  }));

  app.delete('/api/admin/orders/:id', auth, wrap(async (req, res) => {
    await q('delete from orders where id = $1', [req.params.id]);
    res.json({ ok: true });
  }));

  /* El panel consulta esto cada pocos segundos para avisar de pedidos nuevos */
  app.get('/api/admin/orders/poll', auth, wrap(async (req, res) => {
    const after = parseInt(req.query.after, 10) || 0;
    const [pending, max, news] = await Promise.all([
      q("select count(*)::int n from orders where status = 'pendiente'"),
      q('select coalesce(max(id), 0)::int m from orders'),
      q('select id, name, total, created_at from orders where id > $1 order by id limit 10', [after]),
    ]);
    res.json({
      pending: pending.rows[0].n,
      max: max.rows[0].m,
      news: news.rows.map((o) => ({ ...o, total: Number(o.total) })),
    });
  }));
}

module.exports = { mount };
