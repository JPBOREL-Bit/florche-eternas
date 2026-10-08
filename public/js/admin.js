(() => {
'use strict';
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const money = (n) => '$ ' + Math.round(Number(n) || 0).toLocaleString('es-AR');
const rid = () => Math.random().toString(16).slice(2, 10);

let token = localStorage.getItem('fl_admin') || '';
let data = { settings: {}, categories: [], products: [] };
let postal = [];
let tab = 'dashboard';
let ed = null;      // producto en edición
let edId = null;    // id del producto en edición (null = nuevo)

/* ---------- API ---------- */
async function api(url, { method = 'GET', body } = {}) {
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let j = {};
  try { j = await r.json(); } catch {}
  if (r.status === 401 && token) { logout(); throw new Error(j.error || 'Sesión vencida'); }
  if (!r.ok) throw new Error(j.error || 'Algo salió mal');
  return j;
}
let tt;
function toast(msg, bad) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(tt);
  tt = setTimeout(() => (t.className = 'toast'), bad ? 4500 : 2400);
}
const run = async (fn, okMsg) => {
  try { const r = await fn(); if (okMsg) toast(okMsg); return r; }
  catch (e) { toast(e.message, true); }
};

/* ---------- Login ---------- */
function logout() {
  token = '';
  localStorage.removeItem('fl_admin');
  $('#app').hidden = true;
  $('#login').hidden = false;
}
async function doLogin() {
  $('#loginErr').textContent = '';
  try {
    const r = await api('/api/admin/login', { method: 'POST', body: { password: $('#pw').value } });
    token = r.token;
    localStorage.setItem('fl_admin', token);
    localStorage.setItem('fl_notrack', '1'); // tus visitas desde este dispositivo no cuentan en las estadísticas
    $('#pw').value = '';
    start();
  } catch (e) { $('#loginErr').textContent = e.message; }
}
$('#loginBtn').onclick = doLogin;
$('#pw').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
$('#logout').onclick = logout;

async function start() {
  try {
    data = await api('/api/admin/store');
  } catch { return; }
  $('#login').hidden = true;
  $('#app').hidden = false;
  $('#barName').textContent = data.settings.storeName;
  localStorage.setItem('fl_notrack', '1');
  setTab(tab);
  if (window.FL && FL.onReady) FL.onReady();
}
async function refresh() { data = await api('/api/admin/store'); $('#barName').textContent = data.settings.storeName; }

document.querySelectorAll('.tab').forEach((b) => (b.onclick = () => setTab(b.dataset.tab)));
function setTab(t) {
  tab = t;
  document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === t));
  const views = Object.assign({ products: viewProducts, categories: viewCategories, shipping: viewShipping, store: viewStore }, window.FL ? FL.views : {});
  (views[t] || viewProducts)();
}

/* ---------- Imágenes: se comprimen siempre antes de subirlas ---------- */
const fmtBytes = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
let webpOk = null;
function supportsWebp() {
  if (webpOk === null) {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    webpOk = c.toDataURL('image/webp').startsWith('data:image/webp');
  }
  return webpOk;
}
function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const im = new Image();
    im.onload = () => { URL.revokeObjectURL(url); resolve(im); };
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Esa imagen no se pudo abrir')); };
    im.src = url;
  });
}
// Achica la foto y baja la calidad hasta que pese menos que el objetivo.
function encodeImage(im, maxSide, targetBytes, keepAlpha) {
  const type = supportsWebp() ? 'image/webp' : keepAlpha ? 'image/png' : 'image/jpeg';
  let scale = Math.min(1, maxSide / Math.max(im.naturalWidth, im.naturalHeight));
  let last = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const w = Math.max(1, Math.round(im.naturalWidth * scale));
    const h = Math.max(1, Math.round(im.naturalHeight * scale));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
    ctx.drawImage(im, 0, 0, w, h);
    for (let q = 0.8; q >= 0.45; q -= 0.07) {
      const url = c.toDataURL(type, q);
      const bytes = Math.round((url.length - url.indexOf(',') - 1) * 0.75);
      last = { dataUrl: url, bytes };
      if (bytes <= targetBytes || type === 'image/png') break;
    }
    if (last.bytes <= targetBytes) return last;
    scale *= 0.85;
  }
  return last;
}
const IMG_SPEC = {
  product: { max: 1000, target: 110e3, alpha: false },
  banner: { max: 1800, target: 260e3, alpha: false },
  logo: { max: 360, target: 40e3, alpha: true },
};
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error('No se pudo leer la imagen'));
    fr.readAsDataURL(file);
  });
}
// reuse = true: si la foto ya es liviana se conserva igual (sin volver a comprimirla) y solo se le crea la miniatura.
async function uploadImage(file, { kind = 'product', reuse = false } = {}) {
  const spec = IMG_SPEC[kind] || IMG_SPEC.product;
  const im = await loadImage(file);
  let main;
  if (reuse && file.size <= spec.target * 1.15 && /^image\/(jpeg|png|webp)$/.test(file.type)) {
    main = { dataUrl: await fileToDataUrl(file), bytes: file.size };
  } else {
    main = encodeImage(im, spec.max, spec.target, spec.alpha);
  }
  const body = { dataUrl: main.dataUrl, kind };
  if (kind === 'product') body.thumbUrl = encodeImage(im, 420, 30e3, false).dataUrl;
  const r = await api('/api/admin/upload', { method: 'POST', body });
  return { id: r.id, before: file.size, after: r.bytes || main.bytes, thumb: r.thumbBytes || 0 };
}

async function optimizeAll() {
  if (!confirm('Esto vuelve a comprimir todas las fotos que ya subiste. Puede tardar un minuto. ¿Seguimos?')) return;
  let before = 0, after = 0, n = 0;
  const redo = async (id, kind) => {
    const blob = await (await fetch('/img/' + id)).blob();
    const r = await uploadImage(new File([blob], 'foto', { type: blob.type }), { kind, reuse: true });
    before += blob.size; after += r.after; n++;
    return r.id;
  };
  toast('Optimizando fotos… no cierres esta pantalla');
  await run(async () => {
    for (const p of data.products) {
      if (!p.images.length) continue;
      const ids = [];
      for (const id of p.images) ids.push(await redo(id, 'product'));
      await api('/api/admin/products/' + p.id, { method: 'PUT', body: { ...p, images: ids } });
    }
    const st = data.settings, upd = {};
    if (st.logoId) upd.logoId = await redo(st.logoId, 'logo');
    if (st.heroImageId) upd.heroImageId = await redo(st.heroImageId, 'banner');
    if (Object.keys(upd).length) await api('/api/admin/settings', { method: 'PUT', body: upd });
    await refresh();
    viewStore();
    toast(n ? `Listo: ${n} fotos pasaron de ${fmtBytes(before)} a ${fmtBytes(after)}` : 'No había fotos para optimizar');
  });
}

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* ---------- Productos ---------- */
const catName = (id) => (data.categories.find((c) => c.id === id) || {}).name || 'Sin categoría';

function discBadge(p) {
  if (!p.discount_type || !(Number(p.discount_value) > 0)) return '';
  if (p.discount_ends && new Date(p.discount_ends) < new Date()) return '<span class="badge">Descuento vencido</span>';
  return `<span class="badge ok">${p.discount_type === 'percent' ? Number(p.discount_value) + '% off' : money(p.discount_value) + ' off'}</span>`;
}

function viewProducts() {
  const list = data.products.map((p, i) => `
    <div class="prow">
      <div class="th">${p.images[0] ? `<img src="/img/${p.images[0]}" alt="">` : '✿'}</div>
      <div class="info"><b>${esc(p.name)}${p.active ? '' : '<span class="badge">Oculto</span>'}${p.pinned ? '<span class="badge ok">Fijado</span>' : ''}${discBadge(p)}</b>
        <small>${esc(catName(p.category_id))} · base ${money(p.base_price)} · ${p.groups.length} opción(es)</small></div>
      <div class="acts">
        <button class="btn sec sm" data-a="up" data-i="${i}" ${i === 0 ? 'disabled' : ''} title="Subir">↑</button>
        <button class="btn sec sm" data-a="down" data-i="${i}" ${i === data.products.length - 1 ? 'disabled' : ''} title="Bajar">↓</button>
        <button class="btn sec sm" data-a="pin" data-id="${p.id}">${p.pinned ? 'Desfijar' : 'Fijar'}</button>
        <button class="btn sec sm" data-a="edit" data-id="${p.id}">Editar</button>
        <button class="btn sec sm" data-a="dup" data-id="${p.id}">Duplicar</button>
        <button class="btn danger sm" data-a="del" data-id="${p.id}">Borrar</button>
      </div>
    </div>`).join('');
  $('#view').innerHTML = `
    <div class="head"><h2>Productos</h2><button class="btn" data-a="new">+ Nuevo producto</button></div>
    ${list || '<div class="card">Todavía no cargaste productos. Tocá “Nuevo producto”.</div>'}`;
}

async function moveItem(table, arr, i, d, after) {
  const j = i + d;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  await run(() => api('/api/admin/reorder', { method: 'PUT', body: { table, ids: arr.map((x) => x.id) } }));
  after();
}

const blankProduct = () => ({ name: '', description: '', base_price: 0, category_id: data.categories[0] ? data.categories[0].id : null, images: [], groups: [], active: true, pinned: false, discount_type: '', discount_value: 0, discount_ends: null });
const clone = (o) => JSON.parse(JSON.stringify(o));

function openEditor(p, id) {
  ed = clone(p);
  edId = id;
  renderEditor();
  $('#modal').hidden = false;
}
function closeEditor() { $('#modal').hidden = true; $('#modal').innerHTML = ''; ed = null; }

const TYPE_LABEL = { single: 'Elegir una opción', multi: 'Elegir varias', quantity: 'Cantidad de cada una' };

function renderEditor() {
  const scroll = $('#modal .mbody') ? $('#modal .mbody').scrollTop : 0;
  const groups = ed.groups.map((g, gi) => groupHtml(g, gi)).join('');
  $('#modal').innerHTML = `
  <div class="mbox">
    <div class="mhead"><h3>${edId ? 'Editar producto' : 'Nuevo producto'}</h3><button class="btn sec sm" data-m="close">Cerrar</button></div>
    <div class="mbody">
      <div class="card">
        <div class="field"><label class="l">Nombre</label><input type="text" data-path="name" value="${esc(ed.name)}" placeholder="Ej: Ramo de 3 flores"></div>
        <div class="grid2">
          <div class="field"><label class="l">Categoría</label>
            <select data-path="category_id" data-num="1"><option value="">Sin categoría</option>${data.categories.map((c) => `<option value="${c.id}" ${c.id === ed.category_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
          <div class="field"><label class="l">Precio base ($)</label><input type="number" min="0" step="any" data-path="base_price" value="${esc(ed.base_price)}">
            <p class="hint">Es lo que cuesta el producto sin elegir nada. Cada opción suma su precio.</p></div>
        </div>
        <div class="field"><label class="l">Descripción</label><textarea data-path="description">${esc(ed.description)}</textarea></div>
        <label class="chk"><input type="checkbox" data-path="active" data-type="check" ${ed.active ? 'checked' : ''}> Mostrar en la tienda</label>
        <label class="chk" style="margin-top:8px"><input type="checkbox" data-path="pinned" data-type="check" ${ed.pinned ? 'checked' : ''}> Fijar arriba del catálogo (producto destacado)</label>
        <div class="note" style="margin-top:12px"><b>Descuento de este producto</b>
          <div class="grid2" style="margin-top:8px">
            <div><label class="l">Tipo</label><select data-path="discount_type"><option value="">Sin descuento</option><option value="percent" ${ed.discount_type === 'percent' ? 'selected' : ''}>Porcentaje (%)</option><option value="amount" ${ed.discount_type === 'amount' ? 'selected' : ''}>Monto fijo ($)</option></select></div>
            <div><label class="l">Cuánto descuenta</label><input type="number" min="0" step="any" data-path="discount_value" value="${esc(ed.discount_value || '')}" placeholder="Ej: 20"></div>
          </div>
          <div style="margin-top:8px"><label class="l">Termina el (opcional)</label><input type="datetime-local" data-dt="discount_ends" value="${toLocalInput(ed.discount_ends)}"><p class="hint">Si lo dejás vacío, el descuento no vence. Se aplica al precio final con las opciones elegidas.</p></div>
        </div>
      </div>

      <div class="card">
        <label class="l">Fotos</label>
        <div class="imgs">
          ${ed.images.map((id, i) => `<div class="im ${i === 0 ? 'main' : ''}"><img src="/img/${id}" alt=""><button class="x" data-m="rmimg" data-i="${i}" aria-label="Quitar">×</button>${i === 0 ? '<span class="mk" style="background:var(--p)">Principal</span>' : `<button class="mk" data-m="mainimg" data-i="${i}">Hacer principal</button>`}</div>`).join('')}
          <button class="add" data-m="addimg">+ Foto</button>
        </div>
        <input type="file" id="edFile" accept="image/*" multiple hidden>
      </div>

      <div class="head" style="margin-top:6px"><h3>Opciones que elige el cliente</h3></div>
      <div class="note">Acá armás lo que el cliente puede elegir: estilo de flor, colores, envoltorio, cantidad de flores, etc. Cada opción puede sumar un precio. Si una opción es “Elegir una”, podés pedir que se repita (por ejemplo 3 veces, una por cada flor del ramo).</div>
      ${groups}
      <button class="btn sec" data-m="addgroup">+ Agregar una opción al producto</button>
    </div>
    <div class="mfoot"><button class="btn sec" data-m="close">Cancelar</button><button class="btn" data-m="save">Guardar producto</button></div>
  </div>`;
  const mb = $('#modal .mbody');
  if (mb) mb.scrollTop = scroll;
}

function groupHtml(g, gi) {
  const p = `groups.${gi}`;
  const opts = g.options.map((o, oi) => `
    <div class="opt">
      ${o.color
        ? `<input type="color" data-path="${p}.options.${oi}.color" value="${esc(o.color)}" title="Color (tocá para cambiar)">`
        : `<button class="nocolor" data-m="addcolor" data-gi="${gi}" data-oi="${oi}" title="Agregar color de muestra">+ color</button>`}
      <input type="text" data-path="${p}.options.${oi}.name" value="${esc(o.name)}" placeholder="Nombre">
      <div class="price"><span>+$</span><input type="number" step="any" data-path="${p}.options.${oi}.price" value="${esc(o.price)}"></div>
      <button class="rm" data-m="rmopt" data-gi="${gi}" data-oi="${oi}" title="Quitar">×</button>
    </div>`).join('');
  return `
  <div class="gcard">
    <div class="ghead">
      <input type="text" data-path="${p}.name" value="${esc(g.name)}" placeholder="Ej: Color de la flor">
      <div class="gbtns">
        <button class="btn sec sm" data-m="gup" data-gi="${gi}" ${gi === 0 ? 'disabled' : ''}>↑</button>
        <button class="btn sec sm" data-m="gdown" data-gi="${gi}" ${gi === ed.groups.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="btn sec sm" data-m="gdup" data-gi="${gi}">Duplicar</button>
        <button class="btn danger sm" data-m="gdel" data-gi="${gi}">Borrar</button>
      </div>
    </div>
    <div class="row" style="margin-bottom:10px">
      <div style="min-width:200px;flex:1"><select data-path="${p}.type" data-rerender="1">${Object.entries(TYPE_LABEL).map(([k, v]) => `<option value="${k}" ${g.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <label class="chk"><input type="checkbox" data-path="${p}.required" data-type="check" ${g.required ? 'checked' : ''}> Obligatorio</label>
    </div>
    ${g.type === 'single' ? `
    <div class="grid2" style="margin-bottom:6px">
      <div><label class="l">¿Cuántas veces se elige?</label><input type="number" min="1" max="30" data-path="${p}.repeat" value="${esc(g.repeat || 1)}"><p class="hint">Ramo de 3 flores → 3</p></div>
      <div><label class="l">Cómo se llama cada una</label><input type="text" data-path="${p}.repeatLabel" value="${esc(g.repeatLabel)}" placeholder="Flor"><p class="hint">Solo si se repite. Ej: Flor 1, Flor 2…</p></div>
    </div>` : ''}
    ${g.type === 'multi' ? `<div class="field" style="max-width:240px"><label class="l">Máximo a elegir (opcional)</label><input type="number" min="1" data-path="${p}.max" value="${esc(g.max ?? '')}"></div>` : ''}
    ${g.type === 'quantity' ? '<p class="hint" style="margin:0 0 8px">El cliente elige cuántas quiere de cada una. Cada unidad suma su precio (ej: “Flor extra +$2500”).</p>' : ''}
    <div class="opthead"><span></span><span>Opción</span><span>Suma al precio</span><span></span></div>
    ${opts || '<p class="hint">Todavía no hay opciones.</p>'}
    <div class="row" style="margin-top:8px">
      <button class="btn sec sm" data-m="addopt" data-gi="${gi}">+ Agregar opción</button>
      <button class="btn sec sm" data-m="bulkopt" data-gi="${gi}">+ Agregar varias a la vez</button>
    </div>
  </div>`;
}

const COLOR_MAP = {
  rojo:'#C62828', rosa:'#F48FB1', fucsia:'#D81B60', lila:'#B39DDB', violeta:'#7E57C2', azul:'#1E4FA3', celeste:'#81D4FA',
  verde:'#43A047', 'verde agua':'#80CBC4', amarillo:'#FDD835', naranja:'#FB8C00', blanco:'#FFFFFF', negro:'#212121',
  dorado:'#C9A227', plateado:'#B0B7BD', bordo:'#7B1E3A', beige:'#E8D8C3', crema:'#F5EBD7', salmon:'#FA8072',
  turquesa:'#26C6DA', marron:'#6D4C41', gris:'#9E9E9E', coral:'#FF7F6E', mostaza:'#D9A520', 'rosa viejo':'#C99AA5',
  bordeaux:'#7B1E3A', purpura:'#7B1FA2', 'azul marino':'#1A2A55', mint:'#A5D6A7', menta:'#A5D6A7', durazno:'#FFCBA4', champagne:'#EBD9B4',
};
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
  o[keys[keys.length - 1]] = value;
}

// Edición de campos del producto (sin redibujar para no perder el foco)
function onEditorInput(e) {
  const t = e.target;
  if (t.dataset && t.dataset.dt && ed) { ed[t.dataset.dt] = t.value ? new Date(t.value).toISOString() : null; return; }
  if (!t.dataset || !t.dataset.path || !ed) return;
  let v;
  if (t.dataset.type === 'check') v = t.checked;
  else if (t.dataset.num) v = t.value === '' ? null : Number(t.value);
  else v = t.value;
  setPath(ed, t.dataset.path, v);
  if (t.dataset.rerender && e.type === 'change') renderEditor();
}

async function onEditorClick(e) {
  const b = e.target.closest('[data-m]');
  if (!b || !ed) return;
  const m = b.dataset.m;
  const gi = +b.dataset.gi, oi = +b.dataset.oi, i = +b.dataset.i;
  if (m === 'close') return closeEditor();
  if (m === 'save') return saveProduct();
  if (m === 'addimg') return $('#edFile').click();
  if (m === 'rmimg') ed.images.splice(i, 1);
  else if (m === 'mainimg') ed.images.unshift(ed.images.splice(i, 1)[0]);
  else if (m === 'addgroup') ed.groups.push({ id: rid(), name: '', type: 'single', required: true, repeat: 1, repeatLabel: '', max: null, options: [{ id: rid(), name: '', price: 0, color: '' }] });
  else if (m === 'gup' && gi > 0) [ed.groups[gi - 1], ed.groups[gi]] = [ed.groups[gi], ed.groups[gi - 1]];
  else if (m === 'gdown' && gi < ed.groups.length - 1) [ed.groups[gi + 1], ed.groups[gi]] = [ed.groups[gi], ed.groups[gi + 1]];
  else if (m === 'gdup') { const c = clone(ed.groups[gi]); c.id = rid(); c.options.forEach((o) => (o.id = rid())); c.name += ' (copia)'; ed.groups.splice(gi + 1, 0, c); }
  else if (m === 'gdel') { if (!confirm('¿Borrar esta opción del producto?')) return; ed.groups.splice(gi, 1); }
  else if (m === 'addopt') ed.groups[gi].options.push({ id: rid(), name: '', price: 0, color: '' });
  else if (m === 'rmopt') ed.groups[gi].options.splice(oi, 1);
  else if (m === 'addcolor') ed.groups[gi].options[oi].color = '#cccccc';
  else if (m === 'bulkopt') {
    const txt = prompt('Escribí los nombres separados por coma.\nEj: Rojo, Rosa, Fucsia, Lila, Celeste\n(Si son colores comunes, les pongo la muestra de color solos).');
    if (!txt) return;
    ed.groups[gi].options = ed.groups[gi].options.filter((o) => o.name.trim());
    txt.split(',').map((s) => s.trim()).filter(Boolean).forEach((name) => {
      ed.groups[gi].options.push({ id: rid(), name, price: 0, color: COLOR_MAP[norm(name)] || '' });
    });
  } else return;
  renderEditor();
}

async function saveProduct() {
  if (!ed.name.trim()) return toast('Poné un nombre al producto', true);
  const body = clone(ed);
  body.base_price = Number(body.base_price) || 0;
  body.groups.forEach((g) => {
    g.options = g.options.filter((o) => String(o.name).trim());
    g.options.forEach((o) => { o.price = Number(o.price) || 0; });
    g.repeat = Math.max(1, parseInt(g.repeat, 10) || 1);
  });
  const ok = await run(async () => {
    if (edId) await api('/api/admin/products/' + edId, { method: 'PUT', body });
    else await api('/api/admin/products', { method: 'POST', body });
    await refresh();
    return true;
  }, 'Producto guardado');
  if (ok) { closeEditor(); viewProducts(); }
}

$('#modal').addEventListener('input', onEditorInput);
$('#modal').addEventListener('change', async (e) => {
  if (e.target.id === 'edFile') {
    const files = [...e.target.files];
    if (!files.length) return;
    toast('Subiendo fotos…');
    for (const f of files) {
      try { const r = await uploadImage(f); ed.images.push(r.id); toast('Foto optimizada: ' + fmtBytes(r.before) + ' → ' + fmtBytes(r.after)); } catch (err) { toast(err.message, true); }
    }
    renderEditor();
    return;
  }
  onEditorInput(e);
});
$('#modal').addEventListener('click', onEditorClick);

/* ---------- Categorías ---------- */
function viewCategories() {
  $('#view').innerHTML = `
    <div class="head"><h2>Categorías</h2></div>
    <div class="card">
      ${data.categories.map((c, i) => `
        <div class="row" style="margin-bottom:8px;flex-wrap:nowrap">
          <input type="text" value="${esc(c.name)}" data-a="ren" data-id="${c.id}">
          <button class="btn sec sm" data-a="cup" data-i="${i}" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="btn sec sm" data-a="cdown" data-i="${i}" ${i === data.categories.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="btn danger sm" data-a="cdel" data-id="${c.id}">Borrar</button>
        </div>`).join('') || '<p class="hint">Todavía no hay categorías.</p>'}
      <div class="row" style="margin-top:12px;flex-wrap:nowrap"><input type="text" id="newCat" placeholder="Nueva categoría (ej: Ramos, Flores sueltas, Cajas…)"><button class="btn" data-a="cadd">Agregar</button></div>
      <p class="hint">Los cambios de nombre se guardan solos al salir del campo. Si borrás una categoría, sus productos quedan en “Otros”.</p>
    </div>`;
}

/* ---------- Envíos ---------- */
function estCost(km) {
  const s = data.settings;
  let c = Number(s.shippingBase) + km * Number(s.kmMultiplier) * Number(s.pricePerKm);
  c = Math.max(c, Number(s.shippingMin));
  const r = Number(s.shippingRound) || 0;
  if (r > 0) c = Math.round(c / r) * r;
  return Math.round(c);
}

async function viewShipping() {
  const s = data.settings;
  $('#view').innerHTML = `
    <div class="head"><h2>Envíos</h2></div>
    <div class="card" id="shipForm">
      <p class="hint" style="margin:0 0 12px">El sistema busca solo la distancia en km entre tu código postal y el del cliente (solo Mendoza), y multiplica por el valor que pongas acá.</p>
      <div class="grid2">
        <div class="field"><label class="l">Tu código postal (desde dónde salen los envíos)</label><input type="text" inputmode="numeric" maxlength="4" data-s="originCP" value="${esc(s.originCP)}"></div>
        <div class="field"><label class="l">Precio por kilómetro ($)</label><input type="number" min="0" step="any" data-s="pricePerKm" value="${esc(s.pricePerKm)}"></div>
        <div class="field"><label class="l">Costo fijo extra por envío ($)</label><input type="number" min="0" step="any" data-s="shippingBase" value="${esc(s.shippingBase)}"><p class="hint">Se suma siempre. Dejalo en 0 si no querés.</p></div>
        <div class="field"><label class="l">Envío mínimo ($)</label><input type="number" min="0" step="any" data-s="shippingMin" value="${esc(s.shippingMin)}"><p class="hint">Aunque el cliente esté muy cerca, se cobra al menos esto.</p></div>
        <div class="field"><label class="l">Redondear a ($)</label><input type="number" min="0" step="any" data-s="shippingRound" value="${esc(s.shippingRound)}"><p class="hint">Ej: 50 → el envío queda en múltiplos de $50.</p></div>
        <div class="field"><label class="l">Km a cobrar</label>
          <select data-s="kmMultiplier"><option value="1" ${Number(s.kmMultiplier) === 1 ? 'selected' : ''}>Solo ida</option><option value="2" ${Number(s.kmMultiplier) === 2 ? 'selected' : ''}>Ida y vuelta (x2)</option></select></div>
      </div>
      <label class="chk" style="margin-bottom:10px"><input type="checkbox" data-s="allowPickup" ${s.allowPickup ? 'checked' : ''}> Ofrecer retiro en persona (sin costo)</label>
      <div class="field"><label class="l">Texto del retiro</label><input type="text" data-s="pickupText" value="${esc(s.pickupText)}"></div>
      <div class="field"><label class="l">Aviso debajo del costo de envío</label><input type="text" data-s="shippingNote" value="${esc(s.shippingNote)}"></div>
      <button class="btn" data-a="saveship">Guardar envíos</button>
    </div>

    <div class="head" style="margin-top:20px"><h2 style="font-size:1.1rem">Códigos postales y distancias</h2><button class="btn sec sm" data-a="refreshpostal">Actualizar lista</button></div>
    <div class="card">
      <div class="row" style="flex-wrap:nowrap"><input type="text" inputmode="numeric" maxlength="4" id="newCp" placeholder="Código postal, ej: 5539"><button class="btn" data-a="addcp">Calcular</button></div>
      <p class="hint">Cuando un cliente escribe un código nuevo, el sistema lo busca solo y lo guarda acá. Podés agregar los más comunes de antemano o corregir los km a mano.</p>
      <details style="margin-top:10px"><summary style="cursor:pointer;font-weight:600">Agregar muchos de una vez</summary>
        <textarea id="bulkCp" placeholder="5500, 5539, 5550, 5519…" style="margin-top:8px"></textarea>
        <button class="btn sec sm" data-a="bulkcp" style="margin-top:8px">Calcular todos</button>
        <p class="hint">Se calculan de a uno (unos segundos cada uno). Tocá “Actualizar lista” en un rato para ver los resultados.</p>
      </details>
    </div>
    <div id="postalTable"><p class="hint">Cargando…</p></div>`;
  loadPostal();
}

async function loadPostal() {
  const r = await run(() => api('/api/admin/postal'));
  if (!r) return;
  postal = r.rows;
  const el = $('#postalTable');
  if (!el) return;
  el.innerHTML = postal.length ? `
    <div class="tw"><table>
      <thead><tr><th>CP</th><th>Lugar encontrado</th><th>Km</th><th>Envío</th><th></th></tr></thead>
      <tbody>${postal.map((r) => `
        <tr>
          <td><b>${esc(r.cp)}</b> ${r.manual ? '<span class="tag man">a mano</span>' : r.km !== null ? '<span class="tag">auto</span>' : ''}</td>
          <td>${r.lat ? `<a href="https://www.google.com/maps?q=${r.lat},${r.lon}" target="_blank" rel="noopener">${esc(r.label || 'Ver en mapa')}</a>` : '<span class="hint">—</span>'}</td>
          <td><input type="number" min="0" step="0.1" value="${r.km ?? ''}" placeholder="?" data-a="setkm" data-cp="${esc(r.cp)}"></td>
          <td>${r.km !== null ? money(estCost(r.km)) : '—'}</td>
          <td><div class="acts"><button class="btn sec sm" data-a="recalc" data-cp="${esc(r.cp)}">Recalcular</button><button class="btn danger sm" data-a="delcp" data-cp="${esc(r.cp)}">×</button></div></td>
        </tr>`).join('')}</tbody></table></div>`
    : '<div class="card"><p class="hint" style="margin:0">Todavía no hay códigos cargados. Se van agregando solos a medida que tus clientes cotizan.</p></div>';
}

/* ---------- Mi tienda ---------- */
function viewStore() {
  const s = data.settings;
  const f = (k, label, extra = '', hint = '') => `<div class="field"><label class="l">${label}</label><input type="text" data-s="${k}" value="${esc(s[k])}" ${extra}>${hint ? `<p class="hint">${hint}</p>` : ''}</div>`;
  $('#view').innerHTML = `
    <div class="head"><h2>Mi tienda</h2></div>
    <div class="card" id="storeForm">
      ${f('storeName', 'Nombre de la tienda')}
      ${f('tagline', 'Frase corta (aparece en el buscador)')}
      ${f('heroTitle', 'Título grande de la portada')}
      <div class="field"><label class="l">Texto debajo del título</label><textarea data-s="heroSubtitle">${esc(s.heroSubtitle)}</textarea></div>
      <div class="field"><label class="l">Sobre vos / tu emprendimiento</label><textarea data-s="about">${esc(s.about)}</textarea></div>
      ${f('whatsapp', 'Tu WhatsApp (adonde llegan los pedidos)', 'inputmode="tel"', 'Con código de país, sin + ni espacios ni 0 ni 15. Ejemplo celular de Mendoza: 5492614567890')}
      ${f('instagram', 'Instagram (usuario o link)', '', 'Ej: florche.eternas')}
      ${f('footerText', 'Texto al pie de la página')}
      <div class="field"><label class="l">Color principal</label><div class="row"><input type="color" data-s="primaryColor" value="${esc(s.primaryColor)}" style="width:60px;height:40px;padding:2px;border:1.5px solid var(--line);border-radius:9px"><span class="hint">Cambia botones, cinta y detalles de toda la tienda.</span></div></div>
      <div class="field"><label class="l">Logo (opcional)</label>
        <div class="row">${s.logoId ? `<img class="logo-prev" src="/img/${s.logoId}" alt="">` : ''}
        <button class="btn sec sm" data-a="logo">${s.logoId ? 'Cambiar logo' : 'Subir logo'}</button>${s.logoId ? '<button class="btn danger sm" data-a="rmlogo">Quitar</button>' : ''}</div>
        <input type="file" id="logoFile" accept="image/*" hidden></div>
      <div class="field"><label class="l">Banner de la portada (opcional)</label>
        <p class="hint" style="margin:0 0 6px">Se muestra completo, de lado a lado. Lo ideal es una imagen horizontal (por ejemplo 1600 × 600).</p>
        <div class="row">${s.heroImageId ? `<img class="logo-prev" src="/img/${s.heroImageId}" alt="">` : ''}
        <button class="btn sec sm" data-a="hero">${s.heroImageId ? 'Cambiar foto' : 'Subir foto'}</button>${s.heroImageId ? '<button class="btn danger sm" data-a="rmhero">Quitar</button>' : ''}</div>
        <input type="file" id="heroFile" accept="image/*" hidden></div>
      <button class="btn" data-a="savestore">Guardar cambios</button>
    </div>
    <div class="card">
      <label class="l">Optimizar fotos</label>
      <p class="hint" style="margin:0 0 10px">Las fotos nuevas se comprimen solas al subirlas. Este botón achica las que ya subiste antes, para que la tienda cargue más rápido.</p>
      <button class="btn sec" data-a="optimize">Optimizar fotos ya subidas</button>
    </div>`;
  $('#logoFile').onchange = (e) => setImageSetting(e, 'logoId', { kind: 'logo' });
  $('#heroFile').onchange = (e) => setImageSetting(e, 'heroImageId', { kind: 'banner' });
}
async function setImageSetting(e, key, opts) {
  const f = e.target.files[0];
  if (!f) return;
  toast('Subiendo…');
  await run(async () => {
    const r = await uploadImage(f, opts);
    await api('/api/admin/settings', { method: 'PUT', body: { [key]: r.id } });
    await refresh();
    viewStore();
    toast('Foto optimizada: ' + fmtBytes(r.before) + ' → ' + fmtBytes(r.after));
  });
}
function collect(sel) {
  const out = {};
  document.querySelectorAll(sel + ' [data-s]').forEach((el) => {
    out[el.dataset.s] = el.type === 'checkbox' ? el.checked : el.value;
  });
  return out;
}

/* ---------- Eventos de la vista ---------- */
$('#view').addEventListener('change', async (e) => {
  const t = e.target;
  if (t.dataset.a === 'ren') {
    await run(() => api('/api/admin/categories/' + t.dataset.id, { method: 'PUT', body: { name: t.value } }), 'Guardado');
    await refresh();
  } else if (t.dataset.a === 'setkm') {
    if (t.value === '') return;
    await run(() => api('/api/admin/postal/' + t.dataset.cp, { method: 'PUT', body: { km: t.value } }), 'Km guardados');
    loadPostal();
  }
});

$('#view').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-a]');
  if (!b || b.tagName === 'INPUT') return;
  const a = b.dataset.a;
  const id = +b.dataset.id, i = +b.dataset.i;

  // Productos
  if (a === 'new') return openEditor(blankProduct(), null);
  if (a === 'edit') return openEditor(data.products.find((p) => p.id === id), id);
  if (a === 'dup') {
    const p = clone(data.products.find((x) => x.id === id));
    p.name += ' (copia)';
    await run(async () => { await api('/api/admin/products', { method: 'POST', body: p }); await refresh(); }, 'Producto duplicado');
    return viewProducts();
  }
  if (a === 'del') {
    if (!confirm('¿Borrar este producto? No se puede deshacer.')) return;
    await run(async () => { await api('/api/admin/products/' + id, { method: 'DELETE' }); await refresh(); }, 'Producto borrado');
    return viewProducts();
  }
  if (a === 'pin') {
    const p = clone(data.products.find((x) => x.id === id));
    p.pinned = !p.pinned;
    await run(async () => { await api('/api/admin/products/' + id, { method: 'PUT', body: p }); await refresh(); }, p.pinned ? 'Producto fijado arriba' : 'Producto desfijado');
    return viewProducts();
  }
  if (a === 'optimize') return optimizeAll();
  if (a === 'up' || a === 'down') return moveItem('products', data.products, i, a === 'up' ? -1 : 1, viewProducts);

  // Categorías
  if (a === 'cadd') {
    const name = $('#newCat').value.trim();
    if (!name) return toast('Escribí un nombre', true);
    await run(async () => { await api('/api/admin/categories', { method: 'POST', body: { name } }); await refresh(); }, 'Categoría creada');
    return viewCategories();
  }
  if (a === 'cdel') {
    if (!confirm('¿Borrar esta categoría? Sus productos quedan sin categoría.')) return;
    await run(async () => { await api('/api/admin/categories/' + id, { method: 'DELETE' }); await refresh(); }, 'Categoría borrada');
    return viewCategories();
  }
  if (a === 'cup' || a === 'cdown') return moveItem('categories', data.categories, i, a === 'cup' ? -1 : 1, viewCategories);

  // Envíos
  if (a === 'saveship') {
    const body = collect('#shipForm');
    await run(async () => { await api('/api/admin/settings', { method: 'PUT', body }); await refresh(); }, 'Envíos guardados');
    return viewShipping();
  }
  if (a === 'refreshpostal') return loadPostal();
  if (a === 'addcp') {
    const cp = $('#newCp').value.trim();
    toast('Buscando ' + cp + '… puede tardar unos segundos');
    b.disabled = true;
    await run(() => api('/api/admin/postal', { method: 'POST', body: { cp } }), 'Calculado');
    b.disabled = false;
    return loadPostal();
  }
  if (a === 'bulkcp') {
    const r = await run(() => api('/api/admin/postal/bulk', { method: 'POST', body: { cps: $('#bulkCp').value } }));
    if (r) toast(r.started + ' códigos en proceso. Actualizá la lista en un rato.');
    return;
  }
  if (a === 'recalc') {
    toast('Buscando de nuevo…');
    await run(() => api(`/api/admin/postal/${b.dataset.cp}/recalc`, { method: 'POST' }), 'Recalculado');
    return loadPostal();
  }
  if (a === 'delcp') {
    if (!confirm('¿Quitar este código postal de la lista? Se vuelve a calcular si un cliente lo usa.')) return;
    await run(() => api('/api/admin/postal/' + b.dataset.cp, { method: 'DELETE' }));
    return loadPostal();
  }

  // Mi tienda
  if (a === 'savestore') {
    const body = collect('#storeForm');
    await run(async () => { await api('/api/admin/settings', { method: 'PUT', body }); await refresh(); }, 'Cambios guardados');
    return viewStore();
  }
  if (a === 'logo') return $('#logoFile').click();
  if (a === 'hero') return $('#heroFile').click();
  if (a === 'rmlogo' || a === 'rmhero') {
    const key = a === 'rmlogo' ? 'logoId' : 'heroImageId';
    await run(async () => { await api('/api/admin/settings', { method: 'PUT', body: { [key]: null } }); await refresh(); }, 'Quitado');
    return viewStore();
  }
});

/* ---------- Puente con admin2.js (resumen, pedidos, cupones, promos) ---------- */
window.FL = { $, esc, money, api, run, toast, fmtBytes, toLocalInput, clone, rid, getData: () => data, refresh, setTab, currentTab: () => tab, views: {}, onReady: null };

/* ---------- Arranque ---------- */
window.addEventListener('load', () => {
  if (token) start().then(() => { if ($('#app').hidden) $('#login').hidden = false; });
  else $('#login').hidden = false;
});
})();
