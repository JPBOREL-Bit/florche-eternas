/* Cálculo de precios compartido entre la tienda (navegador) y el servidor.
   Así el precio que ve el cliente es siempre el mismo que registra el pedido. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Pricing = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const money = (n) => '$ ' + Math.round(Number(n) || 0).toLocaleString('es-AR');
  const repOf = (g) => (g.type === 'single' ? Math.max(1, (g.repeat | 0) || 1) : 1);
  function mapById(opts) {
    const m = Object.create(null);
    for (const o of opts || []) m[o.id] = o;
    return m;
  }

  /* Precio de un producto según lo que eligió el cliente (antes de descuentos). */
  function calcSelection(p, sel) {
    sel = sel && typeof sel === 'object' ? sel : {};
    let price = Number(p.base_price) || 0;
    const rows = [];
    const idx = Object.create(null);
    const missing = [];
    const addRow = (k, v) => {
      if (idx[k] === undefined) { idx[k] = rows.length; rows.push({ k, vals: [v] }); } else rows[idx[k]].vals.push(v);
    };
    for (const g of p.groups || []) {
      const byId = mapById(g.options);
      const v = sel[g.id];
      if (g.type === 'single') {
        const n = repOf(g);
        const arr = Array.isArray(v) ? v : [];
        for (let i = 0; i < n; i++) {
          const o = byId[arr[i]];
          if (o) {
            price += Number(o.price) || 0;
            if (n > 1) addRow(`${g.repeatLabel || 'Opción'} ${i + 1}`, o.name);
            else rows.push({ k: g.name, vals: [o.name] });
          } else if (g.required) {
            missing.push({ gid: g.id, text: n > 1 ? `${g.name} (${g.repeatLabel || 'Opción'} ${i + 1})` : g.name });
          }
        }
      } else if (g.type === 'multi') {
        let ids = Array.isArray(v) ? v.filter((x, i, a) => a.indexOf(x) === i) : [];
        let chosen = ids.map((id) => byId[id]).filter(Boolean);
        if (g.max) chosen = chosen.slice(0, g.max);
        chosen.forEach((o) => { price += Number(o.price) || 0; });
        if (chosen.length) rows.push({ k: g.name, vals: chosen.map((o) => o.name) });
        else if (g.required) missing.push({ gid: g.id, text: g.name });
      } else {
        const m = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
        const parts = [];
        for (const o of g.options || []) {
          const qn = Math.max(0, Math.min(99, parseInt(m[o.id], 10) || 0));
          if (qn > 0) { price += (Number(o.price) || 0) * qn; parts.push(`${o.name} x${qn}`); }
        }
        if (parts.length) rows.push({ k: g.name, vals: parts });
        else if (g.required) missing.push({ gid: g.id, text: g.name });
      }
    }
    return { price, lines: rows.map((r) => `${r.k}: ${r.vals.join(' · ')}`), missing };
  }

  /* Precio "desde" que se muestra en el catálogo (antes de descuentos). */
  function minPrice(p) {
    let price = Number(p.base_price) || 0;
    for (const g of p.groups || []) {
      if (!g.required || !(g.options || []).length) continue;
      const lowest = Math.min(...g.options.map((o) => Number(o.price) || 0));
      price += lowest * repOf(g);
    }
    return price;
  }

  /* Descuento propio del producto (porcentaje o monto fijo), si está vigente. */
  function activeDiscount(p, now) {
    const t = p.discount_type;
    const v = Number(p.discount_value);
    if ((t !== 'percent' && t !== 'amount') || !(v > 0)) return null;
    if (p.discount_ends && new Date(p.discount_ends).getTime() < (now || Date.now())) return null;
    return { type: t, value: v };
  }

  function discounted(price, p, now) {
    const d = activeDiscount(p, now);
    if (!d) return { price, original: price, off: 0, pct: 0, active: false };
    let off = d.type === 'percent' ? (price * Math.min(d.value, 100)) / 100 : d.value;
    off = Math.min(Math.round(off), Math.round(price));
    return { price: Math.round(price) - off, original: price, off, pct: price ? Math.round((off / price) * 100) : 0, active: off > 0 };
  }

  /* Niveles de la barra de progreso (beneficios automáticos según el total). */
  function tierLabel(t) {
    if (t.label) return t.label;
    if (t.type === 'free_shipping') return 'Envío gratis';
    if (t.type === 'percent') return `${t.value}% de descuento`;
    if (t.type === 'amount') return `${money(t.value)} de descuento`;
    return 'Regalo';
  }

  function sortedTiers(tiers) {
    return (Array.isArray(tiers) ? tiers : [])
      .filter((t) => Number(t.at) > 0)
      .map((t) => ({ ...t, at: Number(t.at), value: Number(t.value) || 0 }))
      .sort((a, b) => a.at - b.at);
  }

  function tierEffects(subtotal, tiers) {
    const list = sortedTiers(tiers);
    const unlocked = list.filter((t) => subtotal >= t.at);
    const next = list.find((t) => subtotal < t.at) || null;
    let discount = 0;
    let applied = null;
    let freeShipping = false;
    const benefits = [];
    for (const t of unlocked) {
      if (t.type === 'free_shipping') { freeShipping = true; benefits.push(tierLabel(t)); }
      else if (t.type === 'gift') benefits.push(tierLabel(t));
      else if (t.type === 'percent' || t.type === 'amount') {
        const d = t.type === 'percent' ? Math.round((subtotal * Math.min(t.value, 100)) / 100) : Math.min(Math.round(t.value), Math.round(subtotal));
        if (d > discount) { discount = d; applied = t; }
      }
    }
    return { tiers: list, unlocked, next, discount, applied, freeShipping, benefits };
  }

  /* Cuánto se llenó la barra de progreso (tramos iguales entre niveles). */
  function progressPct(subtotal, tiers) {
    const list = sortedTiers(tiers).map((t) => t.at);
    const n = list.length;
    if (!n) return 0;
    let prev = 0;
    for (let i = 0; i < n; i++) {
      if (subtotal < list[i]) return Math.max(0, ((i + (subtotal - prev) / (list[i] - prev)) / n) * 100);
      prev = list[i];
    }
    return 100;
  }

  return { money, calcSelection, minPrice, activeDiscount, discounted, tierLabel, tierEffects, sortedTiers, progressPct };
});
