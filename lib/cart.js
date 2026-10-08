'use strict';
const Pricing = require('../public/js/pricing.js');

/* Productos activos, listos para calcular precios. */
async function loadProducts(q) {
  const { rows } = await q(
    'select id, name, base_price, groups, discount_type, discount_value, discount_ends from products where active'
  );
  return new Map(
    rows.map((p) => [p.id, { ...p, base_price: Number(p.base_price), discount_value: Number(p.discount_value) }])
  );
}

/* Recalcula el carrito en el servidor (precio real, sin confiar en lo que mande el navegador). */
function priceCart(items, products) {
  const out = [];
  let subtotal = 0;
  for (const it of (Array.isArray(items) ? items : []).slice(0, 50)) {
    const p = products.get(parseInt(it && it.pid, 10));
    if (!p) return { error: 'Un producto de tu carrito ya no está disponible.' };
    const qty = Math.max(1, Math.min(99, parseInt(it.qty, 10) || 1));
    const r = Pricing.calcSelection(p, it.sel);
    if (r.missing.length) return { error: `Falta elegir opciones en "${p.name}".` };
    const d = Pricing.discounted(r.price, p);
    const line = d.price * qty;
    out.push({
      pid: p.id,
      name: p.name,
      qty,
      unit: d.price,
      original: r.price,
      line,
      lines: r.lines,
      note: String(it.note || '').trim().slice(0, 300),
      discounted: d.active,
    });
    subtotal += line;
  }
  if (!out.length) return { error: 'El carrito está vacío.' };
  return { items: out, subtotal };
}

module.exports = { loadProducts, priceCart };
