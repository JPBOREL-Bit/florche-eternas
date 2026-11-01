'use strict';
// Mercado Pago (checkout Pro). Solo cobra los PRODUCTOS: el envío se coordina por WhatsApp.
// Se confirma con el aviso automático de Mercado Pago (webhook), nunca con lo que diga el cliente.
const crypto = require('crypto');

const API = (process.env.MP_API_BASE || 'https://api.mercadopago.com').replace(/\/$/, '');

function mount({ app, q, auth, wrap, rateOk, getSettings, getAccount, notify, publicUrl }) {
  const token = () => (process.env.MP_ACCESS_TOKEN || '').trim();

  async function mp(path, opts = {}) {
    const r = await fetch(API + path, {
      method: opts.method || 'GET',
      headers: { 'Authorization': 'Bearer ' + token(), 'Content-Type': 'application/json', ...(opts.headers || {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.message || 'Mercado Pago respondió con error'), { status: r.status, detail: j });
    return j;
  }

  /* ---- estado de la configuración (para el panel) ---- */
  app.get('/api/admin/payments/status', auth, wrap(async (req, res) => {
    const t = token();
    const s = await getSettings();
    res.json({
      configured: !!t,
      mode: t.startsWith('TEST-') ? 'prueba' : t.startsWith('APP_USR-') ? 'real' : (t ? 'desconocido' : 'sin configurar'),
      alias: s.payAlias || '', holder: s.payHolder || '', payOn: !!s.payOn,
      webhook: (publicUrl || '') + '/api/mp/webhook',
    });
  }));

  /* ---- Terminar pedido: crea la preferencia de pago para un pedido ya guardado ---- */
  app.post('/api/orders/:id/pay', wrap(async (req, res) => {
    if (!rateOk(req.ip, 'pay', 20, 3600e3)) return res.status(429).json({ ok: false, message: 'Demasiados intentos. Probá más tarde.' });
    const s = await getSettings();
    if (!s.payOn || !token()) return res.json({ ok: false, message: 'Por ahora el pago con Mercado Pago no está disponible. Terminá el pedido por WhatsApp.' });
    const { rows } = await q("select id, name, phone, items, total, status, client_token as token, account_id, mp_pref_id, paid, ship_carrier, ship_service, ship_cost from orders where id = $1", [req.params.id]);
    const o = rows[0];
    // Solo quien hizo el pedido puede pagarlo: se valida con el token del pedido que guarda el navegador
    if (!o || String(req.body.token || '') !== String(o.token || '')) return res.status(404).json({ ok: false, message: 'No encontramos ese pedido.' });
    if (o.status === 'rechazada') return res.json({ ok: false, message: 'Ese pedido fue cancelado.' });
    if (o.paid) return res.json({ ok: true, paid: true, message: 'Ese pedido ya está pagado. ¡Gracias!' });
    // Se cobra el total REAL del pedido (ya con cupones y descuentos aplicados) y el envío del correo si lo eligió.
    const total = Math.round(Number(o.total));
    const items = [];
    if (total > 0) items.push({ id: 'pedido-' + o.id, title: `Pedido #${o.id} · ${(o.items || []).map((i) => `${i.qty}× ${i.name}`).join(', ')}`.slice(0, 250), quantity: 1, unit_price: total, currency_id: 'ARS' });
    if (Number(o.ship_cost) > 0) items.push({ id: 'envio-' + o.id, title: `Envío ${o.ship_carrier || ''} ${o.ship_service || ''}`.trim().slice(0, 250), quantity: 1, unit_price: Math.round(Number(o.ship_cost)), currency_id: 'ARS' });
    if (!items.length) return res.json({ ok: false, message: 'El pedido no tiene nada para cobrar.' });
    const base = (publicUrl || '').replace(/\/$/, '');
    try {
      // API de Orders (la que se eligió en la aplicación de Mercado Pago). Un cobro por pedido, con el total exacto.
      const amount = (items.reduce((a, i) => a + i.unit_price * i.quantity, 0)).toFixed(2);
      // Cuerpo según la documentación de Orders para Checkout Pro (manual, online).
      const order = await mp('/v1/orders', {
        method: 'POST',
        headers: { 'X-Idempotency-Key': 'order-' + o.id + '-' + crypto.randomUUID() },
        body: {
          type: 'online',
          processing_mode: 'manual',
          total_amount: amount,
          external_reference: String(o.id),
          expiration_time: 'P1D',
          items: items.map((i) => ({ title: i.title, unit_price: (i.unit_price).toFixed(2), quantity: i.quantity })),
        },
      });
      const pay = order.checkout_url || (order.checkout_pro && order.checkout_pro.init_point);
      if (!pay) throw new Error('Mercado Pago no devolvió la dirección de pago');
      await q('update orders set mp_pref_id = $2 where id = $1', [o.id, String(order.id)]);
      res.json({ ok: true, url: pay });
    } catch (e) {
      console.error('MP orden:', e.message, JSON.stringify(e.detail || {}));
      res.json({ ok: false, message: 'No pudimos abrir el pago ahora. Probá de nuevo o terminá el pedido por WhatsApp.' });
    }
  }));

  /* ---- Aviso automático de Mercado Pago: confirma el pago consultándolo directamente ---- */
  app.post('/api/mp/webhook', wrap(async (req, res) => {
    res.sendStatus(200);                       // responder rápido; el trabajo sigue abajo
    try {
      const id = (req.query && (req.query['data.id'] || req.query.id)) || (req.body && req.body.data && req.body.data.id);
      const type = (req.query && req.query.type) || (req.body && req.body.type) || (req.body && req.body.topic);
      if (!id) return;
      let pay;
      if (/order/i.test(String(type || ''))) {
        // Aviso de una orden (API de Orders): se consulta la orden y su pago asociado
        const ord = await mp('/v1/orders/' + encodeURIComponent(id));
        const p = ((ord.transactions && ord.transactions.payments) || []).find((x) => x.status === 'approved' || x.status === 'processed') || ((ord.transactions && ord.transactions.payments) || [])[0] || {};
        pay = { id: p.id || ord.id, status: p.status === 'processed' ? 'approved' : (p.status || ord.status), transaction_amount: Number(p.amount || ord.total_amount), external_reference: ord.external_reference };
      } else if (/payment/i.test(String(type || 'payment'))) {
        pay = await mp('/v1/payments/' + encodeURIComponent(id));
      } else return;
      const orderId = parseInt(pay.external_reference, 10);
      if (!orderId) return;
      const { rows } = await q('select id, total, ship_cost, status, paid, pay_id from orders where id = $1', [orderId]);
      const o = rows[0];
      if (!o || o.status === 'rechazada') return;
      // Solo se confirma si Mercado Pago dice aprobado y por el monto del pedido
      if (pay.status === 'approved' && Math.round(Number(pay.transaction_amount)) >= Math.round((Number(o.total) + Number(o.ship_cost || 0)) * 0.99)) {
        if (!o.paid) {
          await q("update orders set paid = true, paid_at = now(), pay_id = $2, pay_status = 'approved', pay_amount = $3 where id = $1", [o.id, String(pay.id), Number(pay.transaction_amount)]);
          if (notify) notify({ title: 'Pago confirmado', body: `Pedido #${o.id} · $ ${Math.round(Number(pay.transaction_amount)).toLocaleString('es-AR')}`, url: '/admin', tag: 'paid-' + o.id }).catch(() => {});
        }
      } else {
        await q('update orders set pay_status = $2 where id = $1', [o.id, String(pay.status || 'desconocido')]);
      }
    } catch (e) { console.error('MP webhook:', e.message); }
  }));

  /* ---- el cliente vuelve del pago: consulta el estado del pedido (sin datos sensibles) ---- */
  app.get('/api/orders/:id/paystatus', wrap(async (req, res) => {
    const { rows } = await q('select paid, pay_status, status, client_token as token from orders where id = $1', [req.params.id]);
    const o = rows[0];
    if (!o || String(req.query.token || '') !== String(o.token || '')) return res.status(404).json({ ok: false });
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, paid: !!o.paid, status: o.pay_status || '' });
  }));
}

module.exports = { mount };
