(() => {
'use strict';

/* ---------- utilidades ---------- */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '$ ' + Math.round(Number(n) || 0).toLocaleString('es-AR');
const uid = () => Math.random().toString(36).slice(2, 10);
const imgUrl = (id) => '/img/' + id;
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const FLOWER_SVG = '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="32" cy="26" r="5"/><path d="M32 21c-6-12 10-12 0 0zM37 26c12-6 12 10 0 0zM32 31c6 12-10 12 0 0zM27 26c-12 6-12-10 0 0z"/><path d="M32 36v22M32 48c-7-1-11-5-12-10M32 52c6-1 10-4 11-9"/></svg>';
const BAG_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8a3 3 0 0 1 6 0"/></svg>';

let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- estado ---------- */
let store = { settings: {}, categories: [], products: [] };
let activeCat = 'all';
let cart = load('fl_cart', []);
let form = Object.assign({ name: '', delivery: 'envio', cp: '', address: '', when: '', notes: '' }, load('fl_form', {}));
let ship = null; // { ok, cp, km, cost } | { unknown:true, cp } | null
let sent = false;
let cur = null; // producto abierto { p, sel, qty, note, img }

const S = () => store.settings;
const prodById = (id) => store.products.find((p) => p.id === id);

/* ---------- carga ---------- */
async function init() {
  try {
    const r = await fetch('/api/store');
    if (!r.ok) throw new Error();
    store = await r.json();
  } catch {
    $('#grid').innerHTML = '<p class="empty">No pudimos cargar el catálogo. Probá recargar la página.</p>';
    return;
  }
  applyTheme();
  renderTop(); renderHero(); renderCats(); renderGrid(); renderAbout(); renderFoot();
  renderCartBadge();
  wireGlobal();
}

function applyTheme() {
  const s = S();
  if (/^#[0-9a-fA-F]{6}$/.test(s.primaryColor || '')) {
    document.documentElement.style.setProperty('--p', s.primaryColor);
    const m = document.querySelector('meta[name=theme-color]');
    if (m) m.content = s.primaryColor;
  }
  document.title = s.storeName + (s.tagline ? ' · ' + s.tagline : '');
  const d = document.querySelector('meta[name=description]');
  if (d) d.content = s.tagline || '';
}

/* ---------- secciones ---------- */
function renderTop() {
  const s = S();
  $('#top').innerHTML = `
    <a class="brand" href="#" aria-label="${esc(s.storeName)}">
      ${s.logoId ? `<img src="${imgUrl(s.logoId)}" alt="">` : ''}
      <span>${esc(s.storeName)}</span>
    </a>
    <button class="cart-btn" id="openCart" aria-label="Abrir carrito">${BAG_SVG}<span>Carrito</span><span class="n" id="cartN" data-n="0"></span></button>`;
}

function renderHero() {
  const s = S();
  const img = s.heroImageId
    ? `<div class="hero-img"><img src="${imgUrl(s.heroImageId)}" alt=""></div>` : '';
  $('#hero').innerHTML = `
    <svg class="ribbon" viewBox="0 0 1200 520" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="satin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style="stop-color:color-mix(in srgb,var(--p) 55%,white)"/>
          <stop offset=".35" style="stop-color:color-mix(in srgb,var(--p) 18%,white)"/>
          <stop offset=".55" style="stop-color:var(--p)"/>
          <stop offset="1" style="stop-color:var(--p-dark)"/>
        </linearGradient>
        <linearGradient id="satin2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style="stop-color:color-mix(in srgb,var(--p) 30%,white)"/>
          <stop offset="1" style="stop-color:color-mix(in srgb,var(--p) 80%,white)"/>
        </linearGradient>
      </defs>
      <g class="sway">
        <path d="M-40 330 C 180 150, 360 470, 620 290 S 1000 110, 1260 250 L1260 330 C 1000 190, 800 420, 620 380 S 180 250, -40 420 Z" fill="url(#satin2)" opacity=".35"/>
        <path d="M-40 250 C 200 70, 380 400, 640 220 S 1010 40, 1260 170 L1260 245 C 1010 120, 820 340, 640 300 S 200 180, -40 340 Z" fill="url(#satin)" opacity=".92"/>
      </g>
    </svg>
    <div class="hero-in ${img ? 'has-img' : ''}">
      <div>
        <h1>${esc(s.heroTitle)}</h1>
        <p>${esc(s.heroSubtitle)}</p>
        <a class="btn" href="#catalogo">Ver catálogo</a>
      </div>
      ${img}
    </div>`;
}

function renderCats() {
  const el = $('#cats');
  if (!store.categories.length) { el.innerHTML = ''; return; }
  const used = new Set(store.products.map((p) => p.category_id));
  const cats = store.categories.filter((c) => used.has(c.id));
  const hasUncat = store.products.some((p) => !p.category_id);
  const items = [{ id: 'all', name: 'Todo' }, ...cats, ...(hasUncat && cats.length ? [{ id: 'none', name: 'Otros' }] : [])];
  el.innerHTML = items.map((c) => `<button class="cat" role="tab" data-cat="${c.id}" aria-selected="${String(c.id) === String(activeCat)}">${esc(c.name)}</button>`).join('');
}

function minPrice(p) {
  let price = Number(p.base_price) || 0;
  for (const g of p.groups || []) {
    if (!g.required || !g.options.length) continue;
    if (g.type === 'single') price += Math.min(...g.options.map((o) => o.price)) * (g.repeat || 1);
    else if (g.type === 'multi' || g.type === 'quantity') price += Math.min(...g.options.map((o) => o.price));
  }
  return price;
}

function renderGrid() {
  const list = store.products.filter((p) =>
    activeCat === 'all' ? true : activeCat === 'none' ? !p.category_id : String(p.category_id) === String(activeCat));
  $('#grid').innerHTML = list.length
    ? list.map((p) => {
        const hasOpts = (p.groups || []).some((g) => g.options.length);
        return `<button class="card" data-pid="${p.id}">
          <div class="ph">${p.images && p.images[0] ? `<img loading="lazy" src="${imgUrl(p.images[0])}" alt="${esc(p.name)}">` : FLOWER_SVG}</div>
          <h3>${esc(p.name)}</h3>
          <div class="price">${hasOpts ? 'Desde ' : ''}<b>${money(minPrice(p))}</b></div>
        </button>`;
      }).join('')
    : '<p class="empty">Todavía no hay productos en esta categoría.</p>';
}

function renderAbout() {
  const s = S();
  $('#about').innerHTML = s.about ? `<div class="wrap"><p>${esc(s.about)}</p></div>` : '';
}

function renderFoot() {
  const s = S();
  const links = [];
  if (s.instagram) {
    const h = s.instagram.startsWith('http') ? s.instagram : 'https://instagram.com/' + s.instagram.replace(/^@/, '');
    links.push(`<a href="${esc(h)}" target="_blank" rel="noopener">Instagram</a>`);
  }
  if (s.whatsapp) links.push(`<a href="https://wa.me/${esc(s.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>`);
  $('#foot').innerHTML = `<div class="name">${esc(s.storeName)}</div>
    ${links.length ? `<div class="links">${links.join('')}</div>` : ''}
    <small>${esc(s.footerText)}</small>`;
}

/* ---------- opciones y precio ---------- */
function buildBlocks(p) {
  const blocks = [];
  for (const g of p.groups) {
    const rep = g.type === 'single' ? Math.max(1, g.repeat | 0) : 1;
    if (rep > 1) {
      const last = blocks[blocks.length - 1];
      const label = g.repeatLabel || 'Opción';
      if (last && last.rep === rep && last.label === label) { last.groups.push(g); continue; }
      blocks.push({ rep, label, groups: [g] });
    } else blocks.push({ rep: 1, groups: [g] });
  }
  return blocks;
}

function initSel(p) {
  const sel = {};
  for (const g of p.groups) {
    if (g.type === 'single') sel[g.id] = new Array(Math.max(1, g.repeat | 0)).fill(null);
    else if (g.type === 'multi') sel[g.id] = [];
    else sel[g.id] = {};
  }
  return sel;
}

function calc(p, sel) {
  let price = Number(p.base_price) || 0;
  const rows = [];
  const idx = {};
  const addRow = (k, v) => {
    if (idx[k] === undefined) { idx[k] = rows.length; rows.push({ k, vals: [v] }); } else rows[idx[k]].vals.push(v);
  };
  const missing = [];
  for (const g of p.groups) {
    const byId = Object.fromEntries(g.options.map((o) => [o.id, o]));
    const v = sel[g.id];
    if (g.type === 'single') {
      const rep = Math.max(1, g.repeat | 0);
      for (let i = 0; i < rep; i++) {
        const o = byId[v[i]];
        if (o) {
          price += Number(o.price) || 0;
          if (rep > 1) addRow(`${g.repeatLabel || 'Opción'} ${i + 1}`, o.name);
          else rows.push({ k: g.name, vals: [o.name] });
        } else if (g.required) {
          missing.push({ gid: g.id, text: rep > 1 ? `${g.name} (${g.repeatLabel || 'Opción'} ${i + 1})` : g.name });
        }
      }
    } else if (g.type === 'multi') {
      const chosen = v.map((id) => byId[id]).filter(Boolean);
      chosen.forEach((o) => { price += Number(o.price) || 0; });
      if (chosen.length) rows.push({ k: g.name, vals: chosen.map((o) => o.name) });
      else if (g.required) missing.push({ gid: g.id, text: g.name });
    } else {
      const parts = [];
      for (const o of g.options) {
        const qn = v[o.id] | 0;
        if (qn > 0) { price += (Number(o.price) || 0) * qn; parts.push(`${o.name} x${qn}`); }
      }
      if (parts.length) rows.push({ k: g.name, vals: parts });
      else if (g.required) missing.push({ gid: g.id, text: g.name });
    }
  }
  const lines = rows.map((r) => `${r.k}: ${r.vals.join(' · ')}`);
  return { price, lines, missing };
}

/* ---------- ficha de producto ---------- */
function openProduct(id) {
  const p = prodById(id);
  if (!p) return;
  cur = { p, sel: initSel(p), qty: 1, note: '', img: 0, showErr: false };
  const sh = $('#sheet');
  sh.innerHTML = `
    <button class="sheet-close" data-act="close" aria-label="Cerrar">×</button>
    <div class="sheet-scroll"><div class="sheet-body">
      <div class="gal" id="shGal"></div>
      <div class="sheet-info">
        <h2>${esc(p.name)}</h2>
        ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ''}
        <div id="shOpts"></div>
        <div class="grp">
          <h4>¿Querés aclarar algo?</h4>
          <textarea class="note" id="shNote" placeholder="Ej: para un cumpleaños, con tarjeta, etc."></textarea>
        </div>
      </div>
    </div></div>
    <div class="sheet-foot" id="shFoot"></div>`;
  $('#sheetOverlay').hidden = false;
  sh.hidden = false;
  document.body.classList.add('lock');
  renderGal(); renderOpts(); renderFoot2();
}

function closeProduct() {
  $('#sheet').hidden = true;
  $('#sheetOverlay').hidden = true;
  cur = null;
  if ($('#drawer').hidden) document.body.classList.remove('lock');
}

function renderGal() {
  const p = cur.p;
  const imgs = p.images || [];
  $('#shGal').innerHTML = `
    <div class="gal-main">${imgs.length ? `<img src="${imgUrl(imgs[cur.img])}" alt="${esc(p.name)}">` : FLOWER_SVG}</div>
    ${imgs.length > 1 ? `<div class="thumbs">${imgs.map((id, i) => `<button data-act="img" data-i="${i}" aria-current="${i === cur.img}" aria-label="Foto ${i + 1}"><img src="${imgUrl(id)}" alt=""></button>`).join('')}</div>` : ''}`;
}

function chip(o, on, attrs) {
  const plus = Number(o.price) ? `<span class="plus">+${money(o.price)}</span>` : '';
  return `<button type="button" class="chip ${on ? 'on' : ''}" ${attrs} aria-pressed="${on}">${o.color ? `<span class="dot" style="background:${esc(o.color)}"></span>` : ''}${esc(o.name)}${plus}</button>`;
}

function renderOpts() {
  const { p, sel } = cur;
  const errIds = cur.showErr ? new Set(calc(p, sel).missing.map((m) => m.gid)) : new Set();
  const blocks = buildBlocks(p);
  let html = '';
  blocks.forEach((b, bi) => {
    if (b.rep > 1) {
      const anyErr = b.groups.some((g) => errIds.has(g.id));
      html += `<div class="grp ${anyErr ? 'err' : ''}">`;
      html += `<h4>${esc(b.groups.map((g) => g.name).join(' y '))}${b.groups.some((g) => g.required) ? '<span class="req">obligatorio</span>' : ''}</h4>`;
      for (let i = 0; i < b.rep; i++) {
        html += `<div class="rep"><h5><span>${esc(b.label)} ${i + 1}</span>${i === 0 && b.rep > 1 ? `<button type="button" class="linkbtn" data-act="copy" data-b="${bi}">Usar igual en todas</button>` : ''}</h5>`;
        for (const g of b.groups) {
          html += `<div class="fld"><span>${esc(g.name)}</span><div class="chips">${g.options.map((o) =>
            chip(o, sel[g.id][i] === o.id, `data-act="pick" data-g="${esc(g.id)}" data-i="${i}" data-o="${esc(o.id)}"`)).join('')}</div></div>`;
        }
        html += '</div>';
      }
      html += '</div>';
      return;
    }
    const g = b.groups[0];
    const err = errIds.has(g.id);
    html += `<div class="grp ${err ? 'err' : ''}"><h4>${esc(g.name)}${g.required ? '<span class="req">obligatorio</span>' : ''}</h4>`;
    if (g.type === 'single') {
      html += `<div class="chips">${g.options.map((o) => chip(o, sel[g.id][0] === o.id, `data-act="pick" data-g="${esc(g.id)}" data-i="0" data-o="${esc(o.id)}"`)).join('')}</div>`;
    } else if (g.type === 'multi') {
      html += `<p class="hint">${g.max ? `Elegí hasta ${g.max}` : 'Podés elegir varias'}</p><div class="chips">${g.options.map((o) => chip(o, sel[g.id].includes(o.id), `data-act="multi" data-g="${esc(g.id)}" data-o="${esc(o.id)}"`)).join('')}</div>`;
    } else {
      html += g.options.map((o) => {
        const qn = sel[g.id][o.id] | 0;
        return `<div class="qrow"><div class="qn">${o.color ? `<span class="dot" style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${esc(o.color)};border:1px solid rgba(0,0,0,.2);margin-right:6px;vertical-align:-2px"></span>` : ''}${esc(o.name)}<small>${Number(o.price) ? '+' + money(o.price) + ' c/u' : 'Sin costo extra'}</small></div>
          <div class="stepper"><button type="button" data-act="q" data-d="-1" data-g="${esc(g.id)}" data-o="${esc(o.id)}" aria-label="Menos">−</button><output>${qn}</output><button type="button" data-act="q" data-d="1" data-g="${esc(g.id)}" data-o="${esc(o.id)}" aria-label="Más">+</button></div></div>`;
      }).join('');
    }
    html += '</div>';
  });
  $('#shOpts').innerHTML = html;
}

function renderFoot2() {
  const r = calc(cur.p, cur.sel);
  $('#shFoot').innerHTML = `
    <div class="stepper"><button type="button" data-act="qty" data-d="-1" aria-label="Menos">−</button><output>${cur.qty}</output><button type="button" data-act="qty" data-d="1" aria-label="Más">+</button></div>
    <div class="tot"><small>Total</small><b>${money(r.price * cur.qty)}</b></div>
    <button type="button" class="btn" data-act="add">Agregar</button>`;
}

function onSheetClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b || !cur) return;
  const act = b.dataset.act;
  const { p, sel } = cur;
  if (act === 'close') return closeProduct();
  if (act === 'img') { cur.img = +b.dataset.i; return renderGal(); }
  if (act === 'pick') {
    const arr = sel[b.dataset.g];
    const i = +b.dataset.i;
    arr[i] = arr[i] === b.dataset.o ? null : b.dataset.o;
  } else if (act === 'multi') {
    const g = p.groups.find((x) => x.id === b.dataset.g);
    const arr = sel[g.id];
    const at = arr.indexOf(b.dataset.o);
    if (at >= 0) arr.splice(at, 1);
    else if (g.max && arr.length >= g.max) return toast(`Podés elegir hasta ${g.max}`);
    else arr.push(b.dataset.o);
  } else if (act === 'q') {
    const m = sel[b.dataset.g];
    const n = Math.max(0, Math.min(99, (m[b.dataset.o] | 0) + +b.dataset.d));
    if (n) m[b.dataset.o] = n; else delete m[b.dataset.o];
  } else if (act === 'copy') {
    const blk = buildBlocks(p)[+b.dataset.b];
    for (const g of blk.groups) { const first = sel[g.id][0]; sel[g.id] = sel[g.id].map(() => first); }
  } else if (act === 'qty') {
    cur.qty = Math.max(1, Math.min(99, cur.qty + +b.dataset.d));
    return renderFoot2();
  } else if (act === 'add') {
    return addToCart();
  }
  renderOpts(); renderFoot2();
}

function addToCart() {
  const { p, sel, qty } = cur;
  const r = calc(p, sel);
  if (r.missing.length) {
    cur.showErr = true;
    renderOpts();
    const first = document.querySelector('#shOpts .grp.err');
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return toast('Falta elegir: ' + r.missing[0].text);
  }
  const note = ($('#shNote').value || '').trim();
  const key = [p.id, r.price, r.lines.join('|'), note].join('#');
  const found = cart.find((c) => c.key === key);
  if (found) found.qty += qty;
  else cart.push({ id: uid(), key, pid: p.id, name: p.name, img: p.images && p.images[0] || null, unit: r.price, qty, lines: r.lines, note });
  save('fl_cart', cart);
  sent = false;
  renderCartBadge();
  closeProduct();
  toast('Agregado al carrito');
}

/* ---------- carrito ---------- */
const cartCount = () => cart.reduce((a, c) => a + c.qty, 0);
const subtotal = () => cart.reduce((a, c) => a + c.unit * c.qty, 0);
function renderCartBadge() {
  const n = $('#cartN');
  if (!n) return;
  const c = cartCount();
  n.textContent = c || '';
  n.dataset.n = c;
}

function shipCost() {
  return form.delivery === 'envio' && ship && ship.ok ? ship.cost : 0;
}

function openCart() {
  $('#cartOverlay').hidden = false;
  $('#drawer').hidden = false;
  document.body.classList.add('lock');
  renderCart();
}
function closeCart() {
  $('#drawer').hidden = true;
  $('#cartOverlay').hidden = true;
  if ($('#sheet').hidden) document.body.classList.remove('lock');
}

function renderCart() {
  const d = $('#drawer');
  const s = S();
  if (!cart.length) {
    d.innerHTML = `<button class="drawer-close" data-cact="close" aria-label="Cerrar">×</button>
      <div class="drawer-head"><h2>Tu carrito</h2></div>
      <div class="drawer-body"><div class="cart-empty">${FLOWER_SVG}<p>Todavía no agregaste nada.</p><button class="btn ghost" data-cact="close">Ver catálogo</button></div></div>`;
    return;
  }
  const items = cart.map((c) => `
    <div class="item">
      <div class="im">${c.img ? `<img src="${imgUrl(c.img)}" alt="">` : FLOWER_SVG}</div>
      <div>
        <h3>${esc(c.name)}</h3>
        ${c.lines.length ? `<ul>${c.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
        ${c.note ? `<div class="inote">“${esc(c.note)}”</div>` : ''}
        <div class="row">
          <div class="stepper"><button data-cact="dec" data-id="${c.id}" aria-label="Menos">−</button><output>${c.qty}</output><button data-cact="inc" data-id="${c.id}" aria-label="Más">+</button></div>
          <b>${money(c.unit * c.qty)}</b>
        </div>
        <button class="rm" data-cact="rm" data-id="${c.id}">Quitar</button>
      </div>
    </div>`).join('');

  const envio = form.delivery === 'envio';
  d.innerHTML = `
    <button class="drawer-close" data-cact="close" aria-label="Cerrar">×</button>
    <div class="drawer-head"><h2>Tu pedido</h2></div>
    <div class="drawer-body">
      ${items}
      <div class="form">
        <h3>Tus datos</h3>
        <div class="field"><label for="fName">Nombre</label><input id="fName" type="text" autocomplete="name" value="${esc(form.name)}"></div>
        <div class="field"><label>¿Cómo lo recibís?</label>
          <label class="opt ${envio ? 'on' : ''}"><input type="radio" name="deliv" value="envio" ${envio ? 'checked' : ''}><span><b>Envío a domicilio</b><br><small>Mendoza. Calculamos el costo con tu código postal.</small></span></label>
          ${s.allowPickup ? `<label class="opt ${!envio ? 'on' : ''}"><input type="radio" name="deliv" value="retiro" ${!envio ? 'checked' : ''}><span><b>${esc(s.pickupText || 'Retiro en persona')}</b></span></label>` : ''}
        </div>
        ${envio ? `
        <div class="field"><label for="fCp">Código postal</label>
          <div class="cprow"><input id="fCp" type="text" inputmode="numeric" maxlength="4" placeholder="Ej: 5539" value="${esc(form.cp)}"><button class="btn ghost" type="button" data-cact="ship">Calcular envío</button></div>
          <div id="shipMsg">${shipMsgHtml()}</div>
        </div>
        <div class="field"><label for="fAddr">Dirección (calle, número, barrio)</label><input id="fAddr" type="text" autocomplete="street-address" value="${esc(form.address)}"></div>` : ''}
        <div class="field"><label for="fWhen">¿Para cuándo lo necesitás? (opcional)</label><input id="fWhen" type="text" placeholder="Ej: el sábado 12" value="${esc(form.when)}"></div>
        <div class="field"><label for="fNotes">Comentarios (opcional)</label><textarea id="fNotes" class="note">${esc(form.notes)}</textarea></div>
      </div>
    </div>
    <div class="drawer-foot">
      ${sent ? '<div class="sent">Si no se abrió WhatsApp, tocá de nuevo el botón verde.</div>' : ''}
      <div class="sum"><span>Productos</span><span>${money(subtotal())}</span></div>
      ${envio ? `<div class="sum"><span>Envío ${ship && ship.ok ? '(aprox.)' : ''}</span><span id="sumShip">${ship && ship.ok ? money(ship.cost) : 'a confirmar'}</span></div>` : ''}
      <div class="sum total"><span>Total aprox.</span><b id="sumTotal">${money(subtotal() + shipCost())}</b></div>
      <button class="btn wa" data-cact="send">Enviar pedido por WhatsApp</button>
      <p class="small">Te respondemos por WhatsApp para confirmar y coordinar el pago.</p>
      ${cart.length ? '<p class="small"><button class="rm" data-cact="clear" style="color:var(--muted)">Vaciar carrito</button></p>' : ''}
    </div>`;
}

function shipMsgHtml() {
  const s = S();
  if (!ship) return '';
  if (ship.loading) return '<span style="color:var(--muted)">Calculando…</span>';
  if (ship.ok) return `<div class="ship-msg ok">${ship.label ? esc(ship.label) + ' · ' : ''}A unos ${ship.km} km. Envío aprox. <b>${money(ship.cost)}</b>.<br><small style="color:var(--muted)">${esc(s.shippingNote || '')}</small></div>`;
  return `<div class="ship-msg ${ship.reason === 'outside' || ship.reason === 'invalid' ? 'bad' : 'warn'}">${esc(ship.message || 'No pudimos calcular el envío.')}</div>`;
}

function onCartInput(e) {
  const t = e.target;
  if (t.id === 'fName') form.name = t.value;
  else if (t.id === 'fAddr') form.address = t.value;
  else if (t.id === 'fWhen') form.when = t.value;
  else if (t.id === 'fNotes') form.notes = t.value;
  else if (t.id === 'fCp') {
    t.value = t.value.replace(/\D/g, '').slice(0, 4);
    form.cp = t.value;
    if (ship && ship.cp !== form.cp) { ship = null; $('#shipMsg').innerHTML = ''; updateTotals(); }
  } else if (t.name === 'deliv') {
    form.delivery = t.value;
    save('fl_form', form);
    return renderCart();
  }
  save('fl_form', form);
}

function updateTotals() {
  const a = $('#sumShip'), b = $('#sumTotal');
  if (a) a.textContent = ship && ship.ok ? money(ship.cost) : 'a confirmar';
  if (b) b.textContent = money(subtotal() + shipCost());
}

async function calcShip() {
  const cp = form.cp.trim();
  if (!/^\d{4}$/.test(cp)) { ship = { ok: false, reason: 'invalid', cp, message: 'Ingresá un código postal de 4 números.' }; $('#shipMsg').innerHTML = shipMsgHtml(); return; }
  ship = { loading: true, cp };
  $('#shipMsg').innerHTML = shipMsgHtml();
  try {
    const r = await fetch('/api/shipping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cp }) });
    const j = await r.json();
    if (form.cp !== cp) return;
    ship = Object.assign({ cp }, j);
  } catch {
    ship = { ok: false, reason: 'net', cp, message: 'No pudimos calcular el envío ahora. Igual podés enviar el pedido y te lo confirmamos por WhatsApp.' };
  }
  $('#shipMsg').innerHTML = shipMsgHtml();
  updateTotals();
}

function onCartClick(e) {
  const b = e.target.closest('[data-cact]');
  if (!b) return;
  const a = b.dataset.cact;
  const item = cart.find((c) => c.id === b.dataset.id);
  if (a === 'close') return closeCart();
  if (a === 'inc' && item) item.qty = Math.min(99, item.qty + 1);
  else if (a === 'dec' && item) { item.qty -= 1; if (item.qty <= 0) cart = cart.filter((c) => c !== item); }
  else if (a === 'rm' && item) cart = cart.filter((c) => c !== item);
  else if (a === 'clear') { if (confirm('¿Vaciar el carrito?')) cart = []; else return; }
  else if (a === 'ship') return calcShip();
  else if (a === 'send') return sendOrder();
  save('fl_cart', cart);
  renderCartBadge();
  renderCart();
}

/* ---------- pedido por WhatsApp ---------- */
function buildMessage() {
  const s = S();
  const L = [];
  L.push(s.orderIntro || '¡Hola! Quiero hacer este pedido:');
  L.push('');
  L.push(`👤 *${form.name.trim()}*`);
  if (form.delivery === 'envio') {
    L.push('🚚 Envío a domicilio');
    L.push(`📍 CP ${form.cp.trim()}${ship && ship.ok ? ` (a unos ${ship.km} km)` : ''}`);
    if (form.address.trim()) L.push(`🏠 ${form.address.trim()}`);
  } else {
    L.push(`🛍️ ${s.pickupText || 'Retiro en persona'}`);
  }
  if (form.when.trim()) L.push(`📅 Para: ${form.when.trim()}`);
  L.push('', '*PEDIDO*');
  cart.forEach((c, i) => {
    L.push(`${i + 1}) *${c.name}* x${c.qty} — ${money(c.unit * c.qty)}`);
    c.lines.forEach((l) => L.push(`   • ${l}`));
    if (c.note) L.push(`   📝 ${c.note}`);
  });
  L.push('', `Productos: ${money(subtotal())}`);
  if (form.delivery === 'envio') L.push(ship && ship.ok ? `Envío (aprox.): ${money(ship.cost)}` : 'Envío: a confirmar');
  L.push(`*Total aprox.: ${money(subtotal() + shipCost())}*`);
  if (form.notes.trim()) L.push('', `💬 ${form.notes.trim()}`);
  return L.join('\n');
}

function sendOrder() {
  const s = S();
  if (!cart.length) return;
  if (!form.name.trim()) { toast('Escribí tu nombre'); const i = $('#fName'); if (i) i.focus(); return; }
  if (form.delivery === 'envio') {
    if (!/^\d{4}$/.test(form.cp.trim())) { toast('Ingresá tu código postal'); const i = $('#fCp'); if (i) i.focus(); return; }
    if (ship && ship.reason === 'outside') { toast('Solo enviamos dentro de Mendoza'); return; }
    if (!form.address.trim()) { toast('Escribí tu dirección'); const i = $('#fAddr'); if (i) i.focus(); return; }
  }
  if (!s.whatsapp) { toast('La tienda todavía no configuró su WhatsApp.'); return; }
  const url = `https://wa.me/${s.whatsapp}?text=${encodeURIComponent(buildMessage())}`;
  sent = true;
  save('fl_form', form);
  renderCart();
  window.open(url, '_blank', 'noopener') || (location.href = url);
}

/* ---------- eventos globales ---------- */
function wireGlobal() {
  document.addEventListener('click', (e) => {
    if (e.target.closest('#openCart')) return openCart();
    const cat = e.target.closest('[data-cat]');
    if (cat) { activeCat = cat.dataset.cat; renderCats(); renderGrid(); return; }
    const card = e.target.closest('[data-pid]');
    if (card) return openProduct(+card.dataset.pid);
  });
  $('#sheet').addEventListener('click', onSheetClick);
  $('#sheet').addEventListener('input', (e) => { if (e.target.id === 'shNote' && cur) cur.note = e.target.value; });
  $('#sheetOverlay').addEventListener('click', closeProduct);
  $('#cartOverlay').addEventListener('click', closeCart);
  $('#drawer').addEventListener('click', onCartClick);
  $('#drawer').addEventListener('input', onCartInput);
  $('#drawer').addEventListener('change', onCartInput);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#sheet').hidden) closeProduct();
    else if (!$('#drawer').hidden) closeCart();
  });
}

init();
})();
