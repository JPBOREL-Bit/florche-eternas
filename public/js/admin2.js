(() => {
'use strict';
const FL = window.FL;
const { $, esc, money, api, run, toast, clone, rid } = FL;

const fdate = (iso) => new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const fday = (d) => d.slice(8, 10) + '/' + d.slice(5, 7);
const num = (n) => Number(n || 0).toLocaleString('es-AR');

/* =====================================================================
   RESUMEN (estadísticas)
   ===================================================================== */
let range = '7d';
const RANGES = [['today', 'Hoy'], ['7d', '7 días'], ['30d', '30 días'], ['all', 'Todo']];

function bars(vals, labels, fmt) {
  const W = 340, H = 110, pad = 4;
  const max = Math.max(1, ...vals);
  const bw = (W - pad * 2) / vals.length;
  return `<svg viewBox="0 0 ${W} ${H + 18}" class="chart" role="img" aria-label="Gráfico por día">
    ${vals.map((v, i) => {
      const h = Math.round((v / max) * H);
      return `<rect x="${(pad + i * bw + 2).toFixed(1)}" y="${H - h}" width="${Math.max(2, bw - 4).toFixed(1)}" height="${Math.max(h, v ? 2 : 0)}" rx="3" fill="var(--p)"><title>${labels[i]}: ${fmt(v)}</title></rect>`;
    }).join('')}
    <line x1="0" x2="${W}" y1="${H + .5}" y2="${H + .5}" stroke="#e5d8e0"/>
    <text x="${pad}" y="${H + 13}" font-size="9" fill="#7a6872">${labels[0]}</text>
    <text x="${W - pad}" y="${H + 13}" text-anchor="end" font-size="9" fill="#7a6872">${labels[labels.length - 1]}</text>
  </svg>`;
}

FL.views.dashboard = async function () {
  $('#view').innerHTML = '<p class="hint">Cargando resumen…</p>';
  const s = await run(() => api('/api/admin/stats?range=' + range));
  if (!s) return;
  if (FL.currentTab && FL.currentTab() !== 'dashboard') return;
  const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '—');
  const avg = s.sales.done ? s.sales.revenue / s.sales.done : 0;
  const steps = [
    ['Entraron a la tienda', s.sessions],
    ['Vieron un producto', s.product_viewers],
    ['Agregaron al carrito', s.carts],
    ['Enviaron el pedido por WhatsApp', s.orders_sent],
    ['Venta realizada', s.sales.done],
  ];
  const top = Math.max(1, ...steps.map((x) => x[1]));
  const stat = (label, value, sub) => `<div class="stat"><span>${label}</span><b>${value}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
  const labels = s.series.map((r) => fday(r.day));

  $('#view').innerHTML = `
    <div class="head"><h2>Resumen</h2>
      <div class="chips">${RANGES.map(([k, l]) => `<button class="chipb ${k === range ? 'on' : ''}" data-r="${k}">${l}</button>`).join('')}</div></div>

    <div class="card money">
      <span>Ganancias</span>
      <b>${money(s.sales.revenue)}</b>
      <small>${s.sales.done} venta(s) realizada(s) en este período · Total histórico: ${money(s.all_time.revenue)} (${s.all_time.sales} ventas)</small>
    </div>

    <div class="stats">
      ${stat('Visitantes', num(s.visitors), 'personas distintas')}
      ${stat('Carritos creados', num(s.carts), 'agregaron algo')}
      ${stat('Pedidos a WhatsApp', num(s.orders_sent), pct(s.orders_sent, s.carts) + ' de los carritos')}
      ${stat('Ventas realizadas', num(s.sales.done), 'ticket promedio ' + money(avg))}
      ${stat('Pendientes', num(s.pending), 'esperando tu respuesta')}
      ${stat('Rechazadas', num(s.sales.rejected), '')}
    </div>

    <div class="card">
      <h3 class="ct">Del primer vistazo a la venta</h3>
      ${steps.map(([l, v], i) => `
        <div class="fun"><div class="fl"><span>${l}</span><b>${num(v)}</b>${i ? `<em>${pct(v, steps[i - 1][1])}</em>` : ''}</div>
        <div class="fb"><i style="width:${Math.max(v ? 2 : 0, Math.round((v / top) * 100))}%"></i></div></div>`).join('')}
      <p class="hint">Carritos abandonados (agregaron algo pero no enviaron el pedido): <b>${num(Math.max(0, s.carts - s.orders_sent))}</b>. Abrieron el carrito: <b>${num(s.cart_opens)}</b>.</p>
    </div>

    <div class="grid2">
      <div class="card"><h3 class="ct">Visitantes por día</h3>${bars(s.series.map((r) => r.visitors), labels, num)}</div>
      <div class="card"><h3 class="ct">Ganancias por día</h3>${bars(s.series.map((r) => r.revenue), labels, money)}</div>
    </div>

    <div class="card">
      <h3 class="ct">Cada producto</h3>
      <div class="tw"><table>
        <thead><tr><th>Producto</th><th>Vistas</th><th>Personas</th><th>Al carrito</th><th>Favoritos</th><th>En pedidos</th><th>Vendidos</th><th>Ingresos</th></tr></thead>
        <tbody>${s.products.map((p) => `<tr><td>${esc(p.name)}</td><td>${num(p.views)}</td><td>${num(p.viewers)}</td><td>${num(p.adds)}</td><td>${num(p.likes)}</td><td>${num(p.orders)}</td><td>${num(p.sold)}</td><td>${money(p.revenue)}</td></tr>`).join('') || '<tr><td colspan="8" class="hint">Todavía no hay productos.</td></tr>'}</tbody>
      </table></div>
      <p class="hint">“Vistas” cuenta cada vez que alguien abre el producto; “Personas”, cuántas personas distintas lo abrieron. “Vendidos” e “Ingresos” solo cuentan ventas que marcaste como realizadas (los ingresos por producto no descuentan cupones). Tus propias visitas desde este dispositivo no se cuentan.</p>
    </div>`;
};

/* =====================================================================
   PEDIDOS + aviso de pedido nuevo
   ===================================================================== */
let ordFilter = 'pendiente';
const STATUS_LABEL = { pendiente: 'Pendiente', realizada: 'Venta realizada', rechazada: 'Venta rechazada' };
const BADGE = { pendiente: 'warn', realizada: 'ok', rechazada: 'bad' };
const ls = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lset = (k, v) => { try { localStorage.setItem(k, String(v)); } catch {} };

FL.views.orders = async function () {
  $('#view').innerHTML = '<p class="hint">Cargando pedidos…</p>';
  const r = await run(() => api('/api/admin/orders' + (ordFilter ? '?status=' + ordFilter : '')));
  if (!r) return;
  const c = r.counts || {};
  const total = (c.pendiente || 0) + (c.realizada || 0) + (c.rechazada || 0);
  const seen = Number(ls('fl_seen')) || 0;
  const filters = [['pendiente', 'Pendientes', c.pendiente || 0], ['realizada', 'Realizadas', c.realizada || 0], ['rechazada', 'Rechazadas', c.rechazada || 0], ['', 'Todos', total]];
  const maxId = r.rows.reduce((m, o) => Math.max(m, o.id), 0);

  $('#view').innerHTML = `
    <div class="head"><h2>Pedidos</h2>
      <div class="chips">${filters.map(([k, l, n]) => `<button class="chipb ${k === ordFilter ? 'on' : ''}" data-of="${k}">${l} (${n})</button>`).join('')}</div></div>
    <p class="hint" style="margin:-4px 0 12px">Cuando un cliente toca “Enviar por WhatsApp”, el pedido aparece acá. Cuando se concrete, marcalo como <b>Venta realizada</b> y se suma a tus ganancias.</p>
    ${r.rows.map((o) => orderCard(o, o.id > seen && o.status === 'pendiente')).join('') || '<div class="card"><p class="hint" style="margin:0">No hay pedidos en esta lista.</p></div>'}`;
  if (maxId > seen) lset('fl_seen', Math.max(maxId, seen));
  pollOnce();
};

function orderCard(o, isNew) {
  const items = o.items.map((i) => `<li><b>${i.qty}× ${esc(i.name)}</b> — ${money(i.line)}${(i.lines || []).length ? `<div class="sub">${i.lines.map(esc).join(' · ')}</div>` : ''}${i.note ? `<div class="sub">Aclaración: ${esc(i.note)}</div>` : ''}</li>`).join('');
  const deliv = o.delivery === 'retiro' ? 'Retiro en persona'
    : `Envío${o.cp ? ' · CP ' + esc(o.cp) : ''}${o.address ? ' · ' + esc(o.address) : ''}${o.ship_estimate !== null ? ' · estimado ' + money(o.ship_estimate) : ''}`;
  const extra = [];
  if (o.tier_discount > 0) extra.push(`Promo automática: -${money(o.tier_discount)}`);
  if (o.coupon_code) extra.push(`Cupón ${esc(o.coupon_code)}${o.coupon_discount ? ': -' + money(o.coupon_discount) : ''}`);
  (o.benefits || []).forEach((b) => extra.push(esc(b)));
  return `<div class="ocard ${isNew ? 'new' : ''}">
    <div class="ohead"><b>${isNew ? '<span class="newtag">NUEVO</span> ' : ''}#${o.id} · ${esc(o.name)}</b><span class="badge ${BADGE[o.status]}">${STATUS_LABEL[o.status]}</span></div>
    <div class="ometa">${fdate(o.created_at)} · ${deliv}</div>
    <ul class="oitems">${items}</ul>
    ${extra.length ? `<div class="oextra">${extra.join(' · ')}</div>` : ''}
    <div class="ototal">Total del pedido <b>${money(o.total)}</b></div>
    <div class="acts" style="justify-content:flex-start">
      ${o.status !== 'realizada' ? `<button class="btn okb sm" data-o="realizada" data-id="${o.id}">Venta realizada</button>` : ''}
      ${o.status !== 'rechazada' ? `<button class="btn danger sm" data-o="rechazada" data-id="${o.id}">Venta rechazada</button>` : ''}
      ${o.status !== 'pendiente' ? `<button class="btn sec sm" data-o="pendiente" data-id="${o.id}">Volver a pendiente</button>` : ''}
      <button class="btn sec sm" data-o="del" data-id="${o.id}">Borrar</button>
    </div>
  </div>`;
}

/* ---- aviso de pedido nuevo (suena y muestra una barra mientras tengas el panel abierto) ---- */
function beep() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [880, 1175, 1480].forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + i * 0.16;
      o.frequency.value = f; o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      o.start(t); o.stop(t + 0.16);
    });
  } catch (e) { /* sin sonido */ }
}

function setBadge(n) {
  const el = $('#tabOrdersN');
  if (el) { el.textContent = n || ''; el.hidden = !n; }
  document.title = (n ? `(${n}) ` : '') + 'Panel · Florche.Eternas';
}

function showAlert(o, more) {
  let bar = $('#alertBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'alertBar';
    bar.className = 'alertbar';
    document.body.appendChild(bar);
  }
  bar.innerHTML = `<div><b>Nuevo pedido${more ? 's' : ''}</b><span>${more ? `${more + 1} pedidos nuevos` : `${esc(o.name)} · ${money(o.total)}`}</span></div>
    <button class="btn sm" id="alertGo">Ver pedidos</button><button class="x" id="alertX" aria-label="Cerrar">×</button>`;
  bar.hidden = false;
  $('#alertGo').onclick = () => { bar.hidden = true; ordFilter = 'pendiente'; FL.setTab('orders'); };
  $('#alertX').onclick = () => { bar.hidden = true; };
}

async function pollOnce() {
  if (!localStorage.getItem('fl_admin')) return;
  try {
    const alerted = ls('fl_alerted');
    const r = await api('/api/admin/orders/poll?after=' + (alerted === null ? 0 : Number(alerted)));
    setBadge(r.pending);
    if (alerted === null) { lset('fl_alerted', r.max); return; }   // la primera vez no avisa por pedidos viejos
    if (r.news.length) {
      lset('fl_alerted', r.news[r.news.length - 1].id);
      showAlert(r.news[r.news.length - 1], r.news.length - 1);
      beep();
      if (FL.currentTab && FL.currentTab() === 'orders') FL.views.orders();
    }
  } catch (e) { /* si falla un aviso, se reintenta en 15 segundos */ }
}

let pollTimer = null;
const prevReady = FL.onReady;
FL.onReady = () => {
  if (prevReady) prevReady();
  pollOnce();
  clearInterval(pollTimer);
  pollTimer = setInterval(() => { if (!document.hidden) pollOnce(); }, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pollOnce(); });
};

/* =====================================================================
   CUPONES
   ===================================================================== */
let coupons = [];
let cp = null; // cupón en edición
const cpTypeLabel = { percent: 'Porcentaje (%)', amount: 'Monto fijo ($)', shipping: 'Envío gratis' };

function cpSummary(c) {
  const what = c.type === 'percent' ? `${Number(c.value)}% de descuento` : c.type === 'amount' ? `${money(c.value)} de descuento` : 'Envío gratis';
  const parts = [what];
  if (c.product_ids.length) parts.push(`solo en ${c.product_ids.length} producto(s) elegido(s)`);
  if (c.min_purchase > 0) parts.push(`compra mínima ${money(c.min_purchase)}`);
  if (c.max_discount > 0) parts.push(`tope ${money(c.max_discount)}`);
  if (c.exclude_discounted) parts.push('no suma con productos en oferta');
  return parts.join(' · ');
}
function cpState(c) {
  if (!c.active) return ['Desactivado', ''];
  if (c.expires_at && new Date(c.expires_at) < new Date()) return ['Vencido', 'bad'];
  if (c.usage_limit !== null && c.used >= c.usage_limit) return ['Agotado', 'bad'];
  return ['Activo', 'ok'];
}

FL.views.coupons = async function () {
  $('#view').innerHTML = '<p class="hint">Cargando cupones…</p>';
  const r = await run(() => api('/api/admin/coupons'));
  if (!r) return;
  coupons = r.rows;
  $('#view').innerHTML = `
    <div class="head"><h2>Cupones</h2><button class="btn" data-c="new">+ Nuevo cupón</button></div>
    <p class="hint" style="margin:-4px 0 12px">Tus clientas escriben el cupón al final del carrito. Vos elegís cuánto descuenta, desde qué compra, hasta qué tope, a qué productos aplica, cuándo vence y cuántas veces se puede usar.</p>
    ${coupons.map((c) => {
      const [st, cls] = cpState(c);
      return `<div class="ocard">
        <div class="ohead"><b class="code">${esc(c.code)}</b><span class="badge ${cls}">${st}</span></div>
        <div class="ometa">${cpSummary(c)}</div>
        <div class="ometa">Usos: <b>${c.used}${c.usage_limit !== null ? ' de ' + c.usage_limit : ''}</b>${c.expires_at ? ' · vence ' + fdate(c.expires_at) : ' · sin vencimiento'}</div>
        <div class="acts" style="justify-content:flex-start;margin-top:8px">
          <button class="btn sec sm" data-c="edit" data-id="${c.id}">Editar</button>
          <button class="btn sec sm" data-c="toggle" data-id="${c.id}">${c.active ? 'Desactivar' : 'Activar'}</button>
          <button class="btn danger sm" data-c="del" data-id="${c.id}">Borrar</button>
        </div></div>`;
    }).join('') || '<div class="card"><p class="hint" style="margin:0">Todavía no creaste cupones. Ejemplos: “50% off en productos elegidos” o “$ 4.000 off comprando más de $ 20.000”.</p></div>'}`;
};

function blankCoupon() {
  return { code: '', type: 'percent', value: 10, min_purchase: 0, max_discount: 0, product_ids: [], expires_at: null, active: true, usage_limit: null, used: 0, exclude_discounted: false };
}

function renderCoupon() {
  const products = FL.getData().products;
  const scoped = cp.product_ids.length > 0 || cp._scoped;
  $('#modal2').innerHTML = `
  <div class="mbox">
    <div class="mhead"><h3>${cp.id ? 'Editar cupón' : 'Nuevo cupón'}</h3><button class="btn sec sm" data-cm="close">Cerrar</button></div>
    <div class="mbody">
      <div class="card">
        <div class="field"><label class="l">Nombre del cupón (lo que escribe la clienta)</label><input type="text" data-cf="code" value="${esc(cp.code)}" placeholder="Ej: VERANO20" style="text-transform:uppercase"></div>
        <div class="grid2">
          <div class="field"><label class="l">Tipo de descuento</label><select data-cf="type" data-rerender="1">${Object.entries(cpTypeLabel).map(([k, v]) => `<option value="${k}" ${cp.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
          ${cp.type !== 'shipping' ? `<div class="field"><label class="l">${cp.type === 'percent' ? 'Porcentaje (1 a 100)' : 'Pesos que descuenta'}</label><input type="number" min="0" step="any" data-cf="value" value="${esc(cp.value)}"></div>` : '<div></div>'}
        </div>
        <div class="grid2">
          <div class="field"><label class="l">Compra mínima ($)</label><input type="number" min="0" step="any" data-cf="min_purchase" value="${esc(cp.min_purchase || '')}" placeholder="0 = sin mínimo"><p class="hint">Ej: 20000 para “comprando más de $ 20.000”.</p></div>
          ${cp.type !== 'shipping' ? `<div class="field"><label class="l">Descuento máximo ($)</label><input type="number" min="0" step="any" data-cf="max_discount" value="${esc(cp.max_discount || '')}" placeholder="0 = sin tope"><p class="hint">Tope de pesos que puede descontar (útil en porcentajes).</p></div>` : '<div></div>'}
        </div>
      </div>
      <div class="card">
        <label class="l">¿A qué productos aplica?</label>
        <label class="chk" style="margin-bottom:6px"><input type="radio" name="scope" value="all" data-cs="1" ${!scoped ? 'checked' : ''}> A toda la compra</label>
        <label class="chk"><input type="radio" name="scope" value="some" data-cs="1" ${scoped ? 'checked' : ''}> Solo a productos que elija</label>
        ${scoped ? `<div class="plist">${products.map((p) => `<label class="chk"><input type="checkbox" data-cpid="${p.id}" ${cp.product_ids.includes(p.id) ? 'checked' : ''}> ${esc(p.name)}</label>`).join('') || '<p class="hint">No hay productos.</p>'}</div>` : ''}
        <label class="chk" style="margin-top:10px"><input type="checkbox" data-cf="exclude_discounted" data-type="check" ${cp.exclude_discounted ? 'checked' : ''}> No aplicar a productos que ya tienen descuento</label>
      </div>
      <div class="card">
        <div class="grid2">
          <div class="field"><label class="l">Vence el (opcional)</label><input type="datetime-local" data-cdt="expires_at" value="${FL.toLocalInput(cp.expires_at)}"><p class="hint">Vacío = no vence.</p></div>
          <div class="field"><label class="l">Cantidad de usos disponibles</label><input type="number" min="1" step="1" data-cf="usage_limit" value="${cp.usage_limit ?? ''}" placeholder="Vacío = ilimitado"><p class="hint">Ej: 50 → se agota después de 50 pedidos.</p></div>
        </div>
        ${cp.id ? `<div class="field" style="max-width:220px"><label class="l">Usos hasta ahora</label><input type="number" min="0" step="1" data-cf="used" value="${cp.used}"></div>` : ''}
        <label class="chk"><input type="checkbox" data-cf="active" data-type="check" ${cp.active ? 'checked' : ''}> Cupón activo</label>
      </div>
    </div>
    <div class="mfoot"><button class="btn sec" data-cm="close">Cancelar</button><button class="btn" data-cm="save">Guardar cupón</button></div>
  </div>`;
}

function openCoupon(c) {
  cp = clone(c);
  renderCoupon();
  $('#modal2').hidden = false;
}
function closeCoupon() { $('#modal2').hidden = true; $('#modal2').innerHTML = ''; cp = null; }

async function saveCoupon() {
  const body = { ...cp };
  delete body._scoped;
  if (cp._scoped === false) body.product_ids = [];
  body.code = String(body.code || '').toUpperCase();
  const ok = await run(async () => {
    if (cp.id) await api('/api/admin/coupons/' + cp.id, { method: 'PUT', body });
    else await api('/api/admin/coupons', { method: 'POST', body });
    return true;
  }, 'Cupón guardado');
  if (ok) { closeCoupon(); FL.views.coupons(); }
}

const m2 = $('#modal2');
m2.addEventListener('input', (e) => {
  const t = e.target;
  if (!cp) return;
  if (t.dataset.cf) {
    const f = t.dataset.cf;
    cp[f] = t.dataset.type === 'check' ? t.checked : t.value;
    if (f === 'usage_limit') cp.usage_limit = t.value === '' ? null : Number(t.value);
  } else if (t.dataset.cdt) {
    cp[t.dataset.cdt] = t.value ? new Date(t.value).toISOString() : null;
  } else if (t.dataset.cpid) {
    const id = Number(t.dataset.cpid);
    cp.product_ids = t.checked ? [...new Set([...cp.product_ids, id])] : cp.product_ids.filter((x) => x !== id);
  }
});
m2.addEventListener('change', (e) => {
  const t = e.target;
  if (!cp) return;
  if (t.dataset.cs) { cp._scoped = t.value === 'some'; if (!cp._scoped) cp.product_ids = []; renderCoupon(); }
  else if (t.dataset.rerender) renderCoupon();
});
m2.addEventListener('click', (e) => {
  const b = e.target.closest('[data-cm]');
  if (!b || !cp) return;
  if (b.dataset.cm === 'close') closeCoupon();
  if (b.dataset.cm === 'save') saveCoupon();
});

/* =====================================================================
   PROMOS: mensajes de arriba + barra de progreso
   ===================================================================== */
let tiers = [];
const TIER_LABEL = { free_shipping: 'Envío gratis', percent: 'Descuento en %', amount: 'Descuento en $', gift: 'Regalo / beneficio' };

function tierName(t) {
  if (t.label) return t.label;
  if (t.type === 'free_shipping') return 'Envío gratis';
  if (t.type === 'percent') return `${t.value || 0}% de descuento`;
  if (t.type === 'amount') return `${money(t.value || 0)} de descuento`;
  return 'Regalo';
}

function tierRows() {
  return tiers.map((t, i) => `
    <div class="trow">
      <div><label class="l">Al llegar a ($)</label><input type="number" min="1" step="any" data-t="${i}.at" value="${esc(t.at || '')}" placeholder="15000"></div>
      <div><label class="l">Beneficio</label><select data-t="${i}.type" data-rerender="1">${Object.entries(TIER_LABEL).map(([k, v]) => `<option value="${k}" ${t.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      ${t.type === 'percent' || t.type === 'amount' ? `<div><label class="l">${t.type === 'percent' ? 'Porcentaje' : 'Pesos'}</label><input type="number" min="0" step="any" data-t="${i}.value" value="${esc(t.value || '')}"></div>` : '<div></div>'}
      <div><label class="l">Texto (opcional)</label><input type="text" data-t="${i}.label" value="${esc(t.label || '')}" placeholder="${t.type === 'gift' ? 'Ej: Tarjeta de regalo' : 'Se arma solo'}"></div>
      <button class="rm" data-p="rmtier" data-i="${i}" title="Quitar">×</button>
    </div>`).join('');
}

function tierPreview() {
  const list = tiers.filter((t) => Number(t.at) > 0).sort((a, b) => a.at - b.at);
  if (!list.length) return '';
  return `<div class="pv"><div class="pvt"><i style="width:${(100 / (list.length + 1)).toFixed(0)}%"></i>
    ${list.map((t, i) => `<span class="pvm" style="left:${(((i + 1) / list.length) * 100).toFixed(1)}%"><u></u><em>${esc(tierName(t))}<br>${money(t.at)}</em></span>`).join('')}</div></div>`;
}

FL.views.promos = function () {
  const s = FL.getData().settings;
  tiers = clone(s.progressTiers || []).map((t) => ({ ...t, id: t.id || rid() }));
  const msgs = String(s.announcements || '');
  $('#view').innerHTML = `
    <div class="head"><h2>Promociones</h2></div>

    <div class="card" id="annCard">
      <h3 class="ct">Mensajes en la parte de arriba</h3>
      <p class="hint" style="margin:0 0 10px">Una barra fina arriba de toda la tienda. Si escribís varios mensajes, van rotando.</p>
      <label class="chk" style="margin-bottom:10px"><input type="checkbox" id="annOn" ${s.announceOn ? 'checked' : ''}> Mostrar la barra de mensajes</label>
      <div class="field"><label class="l">Mensajes (uno por línea)</label><textarea id="annText" placeholder="Envíos gratis desde $ 15.000&#10;Promo en ramos: 20% off">${esc(msgs)}</textarea></div>
      <button class="btn" data-p="saveann">Guardar mensajes</button>
    </div>

    <div class="card" id="progCard">
      <h3 class="ct">Barra de progreso en el carrito</h3>
      <p class="hint" style="margin:0 0 10px">La clienta ve una barra que se va llenando a medida que suma productos. Cada nivel desbloquea un beneficio automático: envío gratis, un descuento o un regalo. Si hay varios descuentos desbloqueados, se aplica el mejor.</p>
      <label class="chk" style="margin-bottom:12px"><input type="checkbox" id="progOn" ${s.progressOn ? 'checked' : ''}> Mostrar la barra de progreso</label>
      <div id="tierBox">${tierRows()}</div>
      <button class="btn sec sm" data-p="addtier" style="margin:6px 0 12px">+ Agregar nivel</button>
      <div id="tierPv">${tierPreview()}</div>
      <div><button class="btn" data-p="saveprog">Guardar barra de progreso</button></div>
    </div>`;
};

function refreshTiers(full) {
  if (full) $('#tierBox').innerHTML = tierRows();
  $('#tierPv').innerHTML = tierPreview();
}

/* =====================================================================
   Eventos de la vista (resumen, pedidos, cupones, promos)
   ===================================================================== */
const view = $('#view');
view.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.t !== undefined) {
    const [i, f] = t.dataset.t.split('.');
    tiers[+i][f] = t.type === 'number' ? (t.value === '' ? '' : Number(t.value)) : t.value;
    refreshTiers(false);
  }
});
view.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.t !== undefined && t.dataset.rerender) {
    const [i, f] = t.dataset.t.split('.');
    tiers[+i][f] = t.value;
    refreshTiers(true);
  }
});

view.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-r],[data-of],[data-o],[data-c],[data-p]');
  if (!b) return;
  const id = +b.dataset.id;

  if (b.dataset.r) { range = b.dataset.r; return FL.views.dashboard(); }
  if (b.dataset.of !== undefined) { ordFilter = b.dataset.of; return FL.views.orders(); }

  if (b.dataset.o) {
    const o = b.dataset.o;
    if (o === 'del') {
      if (!confirm('¿Borrar este pedido? Si ya estaba marcado como venta realizada, deja de sumar a tus ganancias.')) return;
      await run(() => api('/api/admin/orders/' + id, { method: 'DELETE' }), 'Pedido borrado');
    } else {
      const msg = { realizada: 'Venta realizada: se sumó a tus ganancias', rechazada: 'Venta rechazada', pendiente: 'Vuelve a pendiente' }[o];
      await run(() => api('/api/admin/orders/' + id + '/status', { method: 'PUT', body: { status: o } }), msg);
    }
    return FL.views.orders();
  }

  if (b.dataset.c) {
    const c = b.dataset.c;
    if (c === 'new') return openCoupon(blankCoupon());
    const cur = coupons.find((x) => x.id === id);
    if (c === 'edit') return openCoupon(cur);
    if (c === 'toggle') {
      await run(() => api('/api/admin/coupons/' + id, { method: 'PUT', body: { ...cur, active: !cur.active } }), cur.active ? 'Cupón desactivado' : 'Cupón activado');
      return FL.views.coupons();
    }
    if (c === 'del') {
      if (!confirm('¿Borrar el cupón ' + cur.code + '?')) return;
      await run(() => api('/api/admin/coupons/' + id, { method: 'DELETE' }), 'Cupón borrado');
      return FL.views.coupons();
    }
  }

  if (b.dataset.p) {
    const p = b.dataset.p;
    if (p === 'addtier') { tiers.push({ id: rid(), at: '', type: 'free_shipping', value: 0, label: '' }); return refreshTiers(true); }
    if (p === 'rmtier') { tiers.splice(+b.dataset.i, 1); return refreshTiers(true); }
    if (p === 'saveann') {
      await run(async () => {
        await api('/api/admin/settings', { method: 'PUT', body: { announceOn: $('#annOn').checked, announcements: $('#annText').value } });
        await FL.refresh();
      }, 'Mensajes guardados');
      return;
    }
    if (p === 'saveprog') {
      const clean = tiers.filter((t) => Number(t.at) > 0).map((t) => ({ ...t, at: Number(t.at), value: Number(t.value) || 0 }));
      if (tiers.length && clean.length !== tiers.length) return toast('Cada nivel necesita un monto mayor a 0', true);
      await run(async () => {
        await api('/api/admin/settings', { method: 'PUT', body: { progressOn: $('#progOn').checked, progressTiers: clean } });
        await FL.refresh();
      }, 'Barra de progreso guardada');
      return FL.views.promos();
    }
  }
});
})();
