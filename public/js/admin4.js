(() => {
'use strict';
const FL = window.FL;
const { $, esc, money, api, run, toast, fmtBytes } = FL;

let sub = 'pending';          // 'pending' | 'buyers'
let data = { pending: [], buyers: [] };

const num = (n) => Number(n || 0).toLocaleString('es-AR');
const fdate = (iso) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
const TYPE = { emprendimiento: 'Emprendimiento', negocio: 'Negocio' };
const today = () => new Date().toLocaleDateString('en-CA');
const mb = (n) => (n / 1048576).toFixed(1).replace('.', ',') + ' MB';

/* estilos propios de esta pestaña */
const st = document.createElement('style');
st.textContent = `
.kv { display:grid; grid-template-columns:130px 1fr; gap:4px 10px; font-size:.88rem; margin:8px 0; }
.kv span { color:var(--muted); } .kv b { font-weight:600; word-break:break-word; }
.whbuy { background:#faf6f9; border:1px solid var(--line); border-radius:12px; padding:12px; margin:10px 0; }
.whbuy h4 { margin:0 0 8px; font-size:.95rem; }
.whbuy .grid2 { margin-bottom:8px; }
.stbar { height:12px; border-radius:99px; background:#eadfe7; overflow:hidden; margin:8px 0; }
.stbar i { display:block; height:100%; background:var(--p); border-radius:99px; }
.ptab { width:100%; border-collapse:collapse; font-size:.86rem; margin-top:6px; }
.ptab td, .ptab th { padding:6px 4px; border-bottom:1px solid var(--line); text-align:left; }
.ptab th { color:var(--muted); font-size:.74rem; }
details > summary { cursor:pointer; font-weight:600; color:var(--p-dark); margin:6px 0; }
`;
document.head.appendChild(st);

const waLink = (c, store) => `https://wa.me/${c.whatsapp}?text=${encodeURIComponent(`Hola ${String(c.name).split(' ')[0]}, te escribimos de ${store}. Recibimos tu solicitud para ser mayorista y te queremos pasar los precios para compras mayores.`)}`;
const mailLink = (c, store) => `mailto:${c.email}?subject=${encodeURIComponent('Mayoristas · ' + store)}&body=${encodeURIComponent(`Hola ${String(c.name).split(' ')[0]},\n\nGracias por tu solicitud para ser mayorista de ${store}.\n`)}`;

function detailHtml(c) {
  const d = c.detail || {};
  const rows = [['Tipo', TYPE[c.type]], ['Nombre', d.name], ['WhatsApp', '+' + (d.phone || c.whatsapp)], ['Email', d.email], ['Ciudad', d.city], ['Flores por mes (aprox.)', num(d.qty)]];
  if (c.type === 'emprendimiento') rows.push(['Emprendimiento', d.brand], ['Hace cuánto está', d.since], ['Red social', d.social]);
  else rows.push(['Razón social', d.razon], ['Nombre de fantasía', d.fantasy], ['Dueño / responsable', d.owner], ['CUIT', d.cuit], ['Condición IVA', d.iva], ['Rubro', d.rubro], ['Domicilio comercial', d.address], ['Hace cuánto está', d.since], ['Local a la calle', d.localFisico], ['Web / Instagram', d.social]);
  rows.push(['Comentario', d.notes]);
  return `<div class="kv">${rows.filter((r) => r[1]).map(([k, v]) => `<span>${esc(k)}</span><b>${esc(v)}</b>`).join('')}</div>`;
}

function contactBtns(c, store) {
  return `<a class="btn sec sm" target="_blank" rel="noopener" href="${esc(waLink(c, store))}">Escribir por WhatsApp</a>
    <a class="btn sec sm" href="${esc(mailLink(c, store))}">Enviar email</a>`;
}

function pendingHtml(store) {
  if (!data.pending.length) return '<div class="card"><p class="hint" style="margin:0">No hay solicitudes pendientes. Cuando alguien complete el formulario de la tienda, aparece acá.</p></div>';
  return data.pending.map((c) => `
    <div class="ocard">
      <div class="ohead"><b>${esc(c.business)}</b><span class="badge warn">${TYPE[c.type]}</span></div>
      <div class="ometa">${esc(c.name)} · ${esc(c.city)} · ${esc(fdate(c.created_at))}<br>Piensa comprar unas <b>${num(c.qty)} flores por mes</b></div>
      <details><summary>Ver todos los datos</summary>${detailHtml(c)}</details>
      <div class="acts" style="justify-content:flex-start;margin-top:10px">
        ${contactBtns(c, store)}
        <button class="btn okb sm" data-w="accept" data-id="${c.id}">Aceptar comprador</button>
        <button class="btn danger sm" data-w="reject" data-id="${c.id}">Rechazar comprador</button>
      </div>
    </div>`).join('');
}

function buyersHtml(store) {
  if (!data.buyers.length) return '<div class="card"><p class="hint" style="margin:0">Todavía no aceptaste compradores. Cuando aceptes una solicitud, pasa a esta sección y podés ir anotando sus compras.</p></div>';
  return data.buyers.map((c) => `
    <div class="ocard" data-buyer="${c.id}">
      <div class="ohead"><b>${esc(c.business)}</b><span class="badge ok">Comprador</span></div>
      <div class="ometa">${esc(c.name)} · ${esc(c.city)} · aceptado el ${esc(fdate(c.decided_at))}</div>
      <div class="ototal">Compró <b>${num(c.total_flowers)} flores</b> · entró <b>${money(c.total_amount)}</b></div>
      <div class="whbuy">
        <h4>Registrar una compra</h4>
        <div class="grid2"><input type="number" min="0" inputmode="numeric" placeholder="Cantidad de flores" data-pf="flowers"><input type="number" min="0" step="any" inputmode="decimal" placeholder="Dinero que entró ($)" data-pf="amount"></div>
        <div class="grid2"><input type="date" data-pf="day" value="${today()}"><input type="text" maxlength="200" placeholder="Nota (opcional)" data-pf="note"></div>
        <button class="btn sm" data-w="addp" data-id="${c.id}">Sumar al Resumen</button>
      </div>
      ${c.purchases.length ? `<table class="ptab"><thead><tr><th>Fecha</th><th>Flores</th><th>Dinero</th><th>Nota</th><th></th></tr></thead><tbody>
        ${c.purchases.map((p) => `<tr><td>${esc(p.day.split('-').reverse().join('/'))}</td><td>${num(p.flowers)}</td><td>${money(p.amount)}</td><td>${esc(p.note)}</td><td><button class="btn danger sm" data-w="rmp" data-id="${p.id}">Quitar</button></td></tr>`).join('')}
      </tbody></table>` : '<p class="hint">Todavía no registraste compras de este comprador.</p>'}
      <details><summary>Ver todos los datos</summary>${detailHtml(c)}</details>
      <div class="acts" style="justify-content:flex-start;margin-top:8px">
        ${contactBtns(c, store)}
        <button class="btn danger sm" data-w="rmbuyer" data-id="${c.id}">Quitar comprador</button>
      </div>
    </div>`).join('');
}

function setBadge(n) {
  const el = $('#tabWhN');
  if (el) { el.textContent = n || ''; el.hidden = !n; }
}

FL.views.wholesale = async function viewWholesale() {
  const r = await run(() => api('/api/admin/wholesale'));
  if (!r) return;
  data = r;
  await FL.refresh();
  const s = FL.getData().settings;
  setBadge(data.pending.length);
  $('#view').innerHTML = `
    <div class="head"><h2>Mayoristas</h2></div>
    <details class="card" id="whSet"><summary style="margin:0">Ajustes de mayoristas</summary>
      <div style="margin-top:10px">
        <label class="chk" style="margin-bottom:10px"><input type="checkbox" data-s="wholesaleOn" ${s.wholesaleOn ? 'checked' : ''}> Mostrar la sección "Trabajá como mayorista" y recibir solicitudes</label>
        <div class="field" style="max-width:260px"><label class="l">Compra mínima (flores por mes)</label><input type="number" min="1" data-s="wholesaleMin" value="${esc(s.wholesaleMin)}"></div>
        <button class="btn sm" data-w="saveset">Guardar</button>
      </div>
    </details>
    <div class="chips" style="margin-bottom:12px">
      <button class="chipb ${sub === 'pending' ? 'on' : ''}" data-w="tab" data-v="pending">Solicitudes (${data.pending.length})</button>
      <button class="chipb ${sub === 'buyers' ? 'on' : ''}" data-w="tab" data-v="buyers">Compradores (${data.buyers.length})</button>
    </div>
    ${sub === 'pending' ? pendingHtml(s.storeName) : buyersHtml(s.storeName)}`;
};

document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-w]');
  if (!b) return;
  const w = b.dataset.w;
  const id = b.dataset.id;

  if (w === 'compress') {
    b.disabled = true; b.textContent = 'Comprimiendo…';
    const r = await run(() => api('/api/admin/storage/compress', { method: 'POST' }));
    if (r) toast(r.rolled ? `Listo: se resumieron ${num(r.rolled)} registros de visitas viejas.` : 'Todo ya estaba comprimido.');
    return FL.views.dashboard();
  }
  if (FL.currentTab() !== 'wholesale') return;

  if (w === 'tab') { sub = b.dataset.v; return FL.views.wholesale(); }
  if (w === 'saveset') {
    const body = {};
    document.querySelectorAll('#whSet [data-s]').forEach((el) => { body[el.dataset.s] = el.type === 'checkbox' ? el.checked : el.value; });
    await run(() => api('/api/admin/settings', { method: 'PUT', body }), 'Ajustes guardados');
    return FL.views.wholesale();
  }
  if (w === 'accept') {
    const r = await run(() => api(`/api/admin/wholesale/${id}/accept`, { method: 'PUT' }));
    if (r) { toast(`Comprador aceptado. Sus datos se guardaron comprimidos (${num(r.before)} B → ${num(r.after)} B).`); sub = 'buyers'; }
    return FL.views.wholesale();
  }
  if (w === 'reject') {
    if (!confirm('¿Rechazar esta solicitud? Se borra por completo y no se puede recuperar.')) return;
    await run(() => api(`/api/admin/wholesale/${id}`, { method: 'DELETE' }), 'Solicitud rechazada y borrada');
    return FL.views.wholesale();
  }
  if (w === 'rmbuyer') {
    if (!confirm('¿Quitar a este comprador? Se borran sus datos y todas sus compras, y dejan de sumar al Resumen.')) return;
    await run(() => api(`/api/admin/wholesale/${id}`, { method: 'DELETE' }), 'Comprador quitado');
    return FL.views.wholesale();
  }
  if (w === 'addp') {
    const card = b.closest('[data-buyer]');
    const val = (k) => card.querySelector(`[data-pf="${k}"]`).value;
    const body = { flowers: val('flowers'), amount: val('amount'), day: val('day'), note: val('note') };
    const r = await run(() => api(`/api/admin/wholesale/${id}/purchases`, { method: 'POST', body }), 'Compra sumada al Resumen');
    return r ? FL.views.wholesale() : undefined;
  }
  if (w === 'rmp') {
    if (!confirm('¿Quitar esta compra? Deja de sumar al Resumen.')) return;
    await run(() => api(`/api/admin/wholesale/purchases/${id}`, { method: 'DELETE' }), 'Compra quitada');
    return FL.views.wholesale();
  }
});

/* ---- aviso de solicitud nueva ---- */
function beep() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [660, 880].forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + i * 0.2;
      o.frequency.value = f; o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.start(t); o.stop(t + 0.2);
    });
  } catch (e) { /* sin sonido */ }
}
function showAlert(c, more) {
  let bar = $('#whAlert');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'whAlert';
    bar.className = 'alertbar';
    bar.style.top = '74px';
    document.body.appendChild(bar);
  }
  bar.innerHTML = `<div><b>Nueva solicitud de mayorista${more ? 's' : ''}</b><span>${more ? `${more + 1} solicitudes nuevas` : `${esc(c.business)} · ${esc(c.city)}`}</span></div>
    <button class="btn sm" id="whGo">Ver</button><button class="x" id="whX" aria-label="Cerrar">×</button>`;
  bar.hidden = false;
  $('#whGo').onclick = () => { bar.hidden = true; sub = 'pending'; FL.setTab('wholesale'); };
  $('#whX').onclick = () => { bar.hidden = true; };
}
async function poll() {
  if (!localStorage.getItem('fl_admin')) return;
  try {
    const seen = localStorage.getItem('fl_wh_seen');
    const r = await api('/api/admin/wholesale/poll?after=' + (seen === null ? 0 : Number(seen)));
    setBadge(r.pending);
    if (seen === null) { localStorage.setItem('fl_wh_seen', r.max); return; }
    if (r.news.length) {
      localStorage.setItem('fl_wh_seen', r.news[r.news.length - 1].id);
      showAlert(r.news[r.news.length - 1], r.news.length - 1);
      beep();
      if (FL.currentTab() === 'wholesale') FL.views.wholesale();
    }
  } catch (e) { /* se reintenta en 15 segundos */ }
}
const prevReady = FL.onReady;
FL.onReady = () => {
  if (prevReady) prevReady();
  poll();
  setInterval(() => { if (!document.hidden) poll(); }, 15000);
};

/* ---- tarjeta "Espacio usado" al final del Resumen ---- */
const origDash = FL.views.dashboard;
FL.views.dashboard = async function viewDashboardWithStorage() {
  await origDash();
  try {
    const r = await api('/api/admin/storage');
    const pct = Math.min(100, Math.max(1, (r.total / r.limit) * 100));
    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'stCard';
    card.innerHTML = `<h3 class="ct" style="margin:0 0 4px">Espacio usado</h3>
      <div class="stbar"><i style="width:${pct.toFixed(1)}%"></i></div>
      <p style="margin:0 0 8px"><b>${mb(r.total)}</b> de ${mb(r.limit)} <span class="hint">(límite del plan gratis de Supabase · ${pct.toFixed(1).replace('.', ',')}%)</span></p>
      <table class="ptab"><tbody>${r.tables.map((t) => `<tr><td>${esc(t.label)}</td><td style="text-align:right"><b>${fmtBytes(t.bytes)}</b></td></tr>`).join('')}</tbody></table>
      <p class="hint">El total incluye lo básico de la base de datos. Las fotos se guardan comprimidas. Las visitas de hace más de ${r.keep_days} días se resumen por día solas (los números del Resumen no cambian), los datos de los compradores aceptados se guardan comprimidos y los pedidos rechazados se borran.</p>
      <button class="btn sec sm" data-w="compress">Comprimir ahora</button>`;
    $('#view').appendChild(card);
  } catch (e) { /* si falla, el Resumen igual se ve */ }
};
})();
