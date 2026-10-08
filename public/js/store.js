(() => {
'use strict';

const P = window.Pricing;

/* ---------- utilidades ---------- */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = P.money;
const uid = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 8);
const imgUrl = (id) => '/img/' + id;
const thumbUrl = (id) => '/img/' + id + '/t';
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const FLOWER_SVG = '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="32" cy="26" r="5"/><path d="M32 21c-6-12 10-12 0 0zM37 26c12-6 12 10 0 0zM32 31c6 12-10 12 0 0zM27 26c-12 6-12-10 0 0z"/><path d="M32 36v22M32 48c-7-1-11-5-12-10M32 52c6-1 10-4 11-9"/></svg>';
const BAG_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8a3 3 0 0 1 6 0"/></svg>';
const ICONS = {
  free_shipping: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7.5" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/></svg>',
  discount: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1.3"/></svg>',
  gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7c-2-4-6-3-5 0 .5 1.5 3 1 5 0zM12 7c2-4 6-3 5 0-.5 1.5-3 1-5 0z"/></svg>',
};

let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 3200);
}

/* Bloqueo del scroll de fondo (también en iPhone) */
let lockY = 0, locks = 0;
function lockScroll() {
  if (locks++ === 0) {
    lockY = window.scrollY || 0;
    document.body.style.top = `-${lockY}px`;
    document.body.classList.add('lock');
  }
}
function unlockScroll() {
  if (--locks <= 0) {
    locks = 0;
    document.body.classList.remove('lock');
    document.body.style.top = '';
    window.scrollTo(0, lockY);
  }
}

/* ---------- colores del tema (sin depender de funciones nuevas del navegador) ---------- */
function mixHex(hex, target, t) {
  const n = parseInt(hex.slice(1), 16);
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((v) => Math.round(v * (1 - t) + target * t).toString(16).padStart(2, '0')).join('');
}
function applyTheme() {
  const s = S();
  const c = /^#[0-9a-fA-F]{6}$/.test(s.primaryColor || '') ? s.primaryColor : '#A23B72';
  const r = document.documentElement.style;
  r.setProperty('--p', c);
  r.setProperty('--p-dark', mixHex(c, 0, 0.28));
  r.setProperty('--p-soft', mixHex(c, 255, 0.88));
  r.setProperty('--p-pale', mixHex(c, 255, 0.78));
  r.setProperty('--p-light', mixHex(c, 255, 0.45));
  r.setProperty('--p-faint', mixHex(c, 255, 0.6));
  r.setProperty('--p-edge', mixHex(c, 255, 0.5));
  const m = document.querySelector('meta[name=theme-color]');
  if (m) m.content = c;
  document.title = s.storeName + (s.tagline ? ' · ' + s.tagline : '');
  const d = document.querySelector('meta[name=description]');
  if (d) d.content = s.tagline || '';
}

/* ---------- estadísticas (anónimas) ---------- */
const noTrack = !!localStorage.getItem('fl_notrack'); // las visitas del panel de administración no cuentan
let vid = localStorage.getItem('fl_vid');
if (!vid) { vid = uid(); try { localStorage.setItem('fl_vid', vid); } catch {} }
let sid = null, newSession = false;
try {
  sid = sessionStorage.getItem('fl_sid');
  if (!sid) { sid = uid(); sessionStorage.setItem('fl_sid', sid); newSession = true; }
} catch { sid = uid(); newSession = true; }
function track(type, pid, qty) {
  if (noTrack) return;
  try {
    const body = JSON.stringify({ vid, sid, type, pid: pid || null, qty: qty || null });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
    else fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true });
  } catch {}
}

/* ---------- estado ---------- */
let store = { settings: {}, categories: [], products: [] };
let activeCat = 'all';
let cart = load('fl_cart2', []);           // [{ id, pid, sel, qty, note, key }]
let orderToken = load('fl_tok', null) || uid();
let form = Object.assign({ name: '', delivery: 'envio', cp: '', address: '', coupon: '' }, load('fl_form2', {}));
let ship = null;                           // { ok, cp, km, cost } | { ok:false, ... } | { loading:true }
let sent = null;                           // { url }
let couponRes = null, couponBusy = false, couponOpen = false, couponMsg = '', couponReq = 0, couponTimer = null;
let prevUnlocked = new Set();
let cur = null;                            // producto abierto
let annT = null;

const S = () => store.settings;
const prodById = (id) => store.products.find((p) => p.id === id);
const persist = () => { save('fl_cart2', cart); save('fl_tok', orderToken); };
const persistForm = () => save('fl_form2', form);

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
  renderAnn(); renderTop(); renderHero(); renderCats(); renderGrid(); renderAbout(); renderFoot();
  pruneCart();
  renderCartBadge();
  wireGlobal();
  if (newSession) track('visit');
  if (form.coupon && cart.length) checkCoupon();
}

/* ---------- secciones ---------- */
function renderAnn() {
  const s = S();
  const el = $('#ann');
  clearInterval(annT);
  const msgs = String(s.announcements || '').split('\n').map((x) => x.trim()).filter(Boolean);
  if (!s.announceOn || !msgs.length) { el.hidden = true; return; }
  el.hidden = false;
  let i = 0;
  const show = () => { el.innerHTML = `<span>${esc(msgs[i % msgs.length])}</span>`; };
  show();
  if (msgs.length > 1) annT = setInterval(() => { i++; show(); }, 4500);
}

function renderTop() {
  const s = S();
  $('#top').innerHTML = `
    <a class="brand" href="#" aria-label="${esc(s.storeName)}">
      ${s.logoId ? `<img src="${imgUrl(s.logoId)}" alt="">` : ''}
      <span>${esc(s.storeName)}</span>
    </a>
    <button class="cart-btn" id="openCart" aria-label="Abrir carrito">${BAG_SVG}<span class="lbl">Carrito</span><span class="n" id="cartN" data-n="0"></span></button>`;
}

function renderHero() {
  const s = S();
  const hero = $('#hero');
  hero.className = 'hero' + (s.heroImageId ? ' with-banner' : '');
  hero.innerHTML = `
    ${s.heroImageId ? `<div class="banner"><img src="${imgUrl(s.heroImageId)}" alt="${esc(s.storeName)}"></div>` : ''}
    <svg class="ribbon" viewBox="0 0 1200 300" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="satin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--p-light)"/>
          <stop offset=".35" stop-color="var(--p-soft)"/>
          <stop offset=".55" stop-color="var(--p)"/>
          <stop offset="1" stop-color="var(--p-dark)"/>
        </linearGradient>
      </defs>
      <path d="M-40 190 C 180 70, 360 270, 620 170 S 1000 60, 1260 150 L1260 220 C 1000 120, 800 250, 620 230 S 180 150, -40 250 Z" fill="var(--p-pale)" opacity=".7"/>
      <path d="M-40 130 C 200 20, 380 230, 640 120 S 1010 10, 1260 100 L1260 150 C 1010 70, 820 200, 640 175 S 200 110, -40 200 Z" fill="url(#satin)" opacity=".95"/>
    </svg>
    <div class="hero-in">
      <h1>${esc(s.heroTitle)}</h1>
      <p>${esc(s.heroSubtitle)}</p>
      <a class="btn" href="#catalogo">Ver catálogo</a>
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

function renderGrid() {
  const list = store.products.filter((p) =>
    activeCat === 'all' ? true : activeCat === 'none' ? !p.category_id : String(p.category_id) === String(activeCat));
  $('#grid').innerHTML = list.length
    ? list.map((p) => {
        const hasOpts = (p.groups || []).some((g) => g.options.length);
        const d = P.discounted(P.minPrice(p), p);
        return `<button class="card" data-pid="${p.id}">
          <div class="ph">${p.images && p.images[0] ? `<img loading="lazy" decoding="async" src="${thumbUrl(p.images[0])}" alt="${esc(p.name)}">` : FLOWER_SVG}
            ${d.active ? `<span class="tag-off">-${d.pct}%</span>` : ''}
            ${p.pinned ? '<span class="tag-pin">Destacado</span>' : ''}</div>
          <h3>${esc(p.name)}</h3>
          <div class="price">${hasOpts ? 'Desde ' : ''}${d.active ? `<s>${money(d.original)}</s>` : ''}<b>${money(d.price)}</b></div>
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

/* ---------- ficha de producto ---------- */
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

function openProduct(id) {
  const p = prodById(id);
  if (!p) return;
  cur = { p, sel: initSel(p), qty: 1, img: 0, showErr: false };
  const d = P.discounted(P.minPrice(p), p);
  const sh = $('#sheet');
  sh.innerHTML = `
    <button class="sheet-close" data-act="close" aria-label="Cerrar">×</button>
    <div class="sheet-scroll"><div class="sheet-body">
      <div class="gal" id="shGal"></div>
      <div class="sheet-info">
        ${d.active ? `<span class="badge-off">${d.pct}% de descuento</span>` : ''}
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
  lockScroll();
  renderGal(); renderOpts(); renderSheetFoot();
  track('product_view', p.id);
}

function closeProduct() {
  if ($('#sheet').hidden) return;
  $('#sheet').hidden = true;
  $('#sheetOverlay').hidden = true;
  cur = null;
  unlockScroll();
}

function renderGal() {
  const p = cur.p;
  const imgs = p.images || [];
  $('#shGal').innerHTML = `
    <div class="gal-main">${imgs.length ? `<img src="${imgUrl(imgs[cur.img])}" alt="${esc(p.name)}">` : FLOWER_SVG}</div>
    ${imgs.length > 1 ? `<div class="thumbs">${imgs.map((id, i) => `<button data-act="img" data-i="${i}" aria-current="${i === cur.img}" aria-label="Foto ${i + 1}"><img src="${thumbUrl(id)}" alt=""></button>`).join('')}</div>` : ''}`;
}

function chip(o, on, attrs) {
  const plus = Number(o.price) ? `<span class="plus">+${money(o.price)}</span>` : '';
  return `<button type="button" class="chip ${on ? 'on' : ''}" ${attrs} aria-pressed="${on}">${o.color ? `<span class="dot" style="background:${esc(o.color)}"></span>` : ''}${esc(o.name)}${plus}</button>`;
}

function renderOpts() {
  const { p, sel } = cur;
  const errIds = cur.showErr ? new Set(P.calcSelection(p, sel).missing.map((m) => m.gid)) : new Set();
  const blocks = buildBlocks(p);
  let html = '';
  blocks.forEach((b, bi) => {
    if (b.rep > 1) {
      const anyErr = b.groups.some((g) => errIds.has(g.id));
      html += `<div class="grp ${anyErr ? 'err' : ''}">`;
      html += `<h4>${esc(b.groups.map((g) => g.name).join(' y '))}${b.groups.some((g) => g.required) ? '<span class="req">obligatorio</span>' : ''}</h4>`;
      for (let i = 0; i < b.rep; i++) {
        html += `<div class="rep"><h5><span>${esc(b.label)} ${i + 1}</span>${i === 0 ? `<button type="button" class="linkbtn" data-act="copy" data-b="${bi}">Usar igual en todas</button>` : ''}</h5>`;
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
        return `<div class="qrow"><div class="qn">${esc(o.name)}<small>${Number(o.price) ? '+' + money(o.price) + ' c/u' : 'Sin costo extra'}</small></div>
          <div class="stepper"><button type="button" data-act="q" data-d="-1" data-g="${esc(g.id)}" data-o="${esc(o.id)}" aria-label="Menos">−</button><output>${qn}</output><button type="button" data-act="q" data-d="1" data-g="${esc(g.id)}" data-o="${esc(o.id)}" aria-label="Más">+</button></div></div>`;
      }).join('');
    }
    html += '</div>';
  });
  $('#shOpts').innerHTML = html;
}

function renderSheetFoot() {
  const r = P.calcSelection(cur.p, cur.sel);
  const d = P.discounted(r.price, cur.p);
  $('#shFoot').innerHTML = `
    <div class="stepper"><button type="button" data-act="qty" data-d="-1" aria-label="Menos">−</button><output>${cur.qty}</output><button type="button" data-act="qty" data-d="1" aria-label="Más">+</button></div>
    <div class="tot"><small>Total</small><b>${money(d.price * cur.qty)}</b>${d.active ? `<s>${money(d.original * cur.qty)}</s>` : ''}</div>
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
    return renderSheetFoot();
  } else if (act === 'add') {
    return addToCart();
  }
  renderOpts(); renderSheetFoot();
}

function addToCart() {
  const { p, sel, qty } = cur;
  const r = P.calcSelection(p, sel);
  if (r.missing.length) {
    cur.showErr = true;
    renderOpts();
    const first = document.querySelector('#shOpts .grp.err');
    if (first) first.scrollIntoView({ block: 'center' });
    return toast('Falta elegir: ' + r.missing[0].text);
  }
  const note = ($('#shNote').value || '').trim();
  const key = [p.id, JSON.stringify(sel), note].join('#');
  const found = cart.find((c) => c.key === key);
  if (found) found.qty = Math.min(99, found.qty + qty);
  else cart.push({ id: uid(), key, pid: p.id, sel: JSON.parse(JSON.stringify(sel)), qty, note });
  track('add_to_cart', p.id, qty);
  cartChanged();
  closeProduct();
  const T = totals();
  const hint = S().progressOn && T.t.next ? ` Te faltan ${money(T.t.next.at - T.subtotal)} para ${P.tierLabel(T.t.next).toLowerCase()}.` : '';
  toast('Agregado al carrito.' + hint);
}

/* ---------- carrito: cálculo ---------- */
function view() {
  return cart.map((c) => {
    const p = prodById(c.pid);
    if (!p) return null;
    const r = P.calcSelection(p, c.sel);
    if (r.missing.length) return null;
    const d = P.discounted(r.price, p);
    return { c, p, lines: r.lines, unit: d.price, original: r.price, disc: d.active, qty: c.qty, line: d.price * c.qty };
  }).filter(Boolean);
}

function pruneCart() {
  const ok = new Set(view().map((x) => x.c.id));
  if (ok.size !== cart.length) { cart = cart.filter((c) => ok.has(c.id)); persist(); }
}

function totals() {
  const v = view();
  const subtotal = v.reduce((a, x) => a + x.line, 0);
  const t = P.tierEffects(subtotal, S().progressOn ? S().progressTiers : []);
  const cOk = !!(couponRes && couponRes.ok);
  const cDisc = cOk ? couponRes.discount : 0;
  const total = Math.max(0, subtotal - t.discount - cDisc);
  return { v, subtotal, t, cOk, cDisc, total, freeShip: t.freeShipping || (cOk && couponRes.freeShipping) };
}

const cartCount = () => cart.reduce((a, c) => a + c.qty, 0);
function renderCartBadge() {
  const n = $('#cartN');
  if (!n) return;
  const c = cartCount();
  n.textContent = c || '';
  n.dataset.n = c;
}

function cartChanged() {
  orderToken = uid();   // un carrito distinto es un pedido distinto
  sent = null;
  persist();
  renderCartBadge();
  if (!$('#drawer').hidden) refreshCart();
  if (form.coupon) scheduleCoupon();
}

/* ---------- carrito: pantalla ---------- */
function openCart() {
  $('#cartOverlay').hidden = false;
  $('#drawer').hidden = false;
  lockScroll();
  renderCart();
  track('cart_open');
}
function closeCart() {
  if ($('#drawer').hidden) return;
  $('#drawer').hidden = true;
  $('#cartOverlay').hidden = true;
  unlockScroll();
}

function renderCart() {
  const d = $('#drawer');
  if (!cart.length) {
    d.innerHTML = `<button class="drawer-close" data-cact="close" aria-label="Cerrar">×</button>
      <div class="drawer-head"><h2>Tu carrito</h2></div>
      <div class="drawer-body"><div class="cart-empty">${FLOWER_SVG}<p>Todavía no agregaste nada.</p><button class="btn ghost" data-cact="close">Ver catálogo</button></div></div>`;
    return;
  }
  d.innerHTML = `
    <button class="drawer-close" data-cact="close" aria-label="Cerrar">×</button>
    <div class="drawer-head"><h2>Tu pedido</h2></div>
    <div class="drawer-body">
      <div id="cProg"></div>
      <div id="cItems"></div>
      <div id="cForm"></div>
      <div id="cCpn"></div>
    </div>
    <div class="drawer-foot" id="cFoot"></div>`;
  renderProg(); renderItems(); renderForm(); renderCoupon(); renderCartFoot();
}

function refreshCart() {
  if (!cart.length || !$('#cItems')) return renderCart();
  renderProg(); renderItems(); renderCoupon(); renderCartFoot();
}

function progressPct(subtotal, tiers) {
  const n = tiers.length;
  if (!n) return 0;
  let prev = 0;
  for (let i = 0; i < n; i++) {
    if (subtotal < tiers[i].at) return ((i + Math.max(0, (subtotal - prev) / (tiers[i].at - prev))) / n) * 100;
    prev = tiers[i].at;
  }
  return 100;
}

function renderProg() {
  const el = $('#cProg');
  if (!el) return;
  const s = S();
  const tiers = P.sortedTiers(s.progressTiers);
  if (!s.progressOn || !tiers.length) { el.innerHTML = ''; return; }
  const T = totals();
  const unlockedIds = new Set(T.t.unlocked.map((t) => t.id));
  let msg;
  if (T.t.next) msg = `Sumá <b>${money(T.t.next.at - T.subtotal)}</b> más y conseguí: <b>${esc(P.tierLabel(T.t.next))}</b>`;
  else msg = '¡Desbloqueaste todos los beneficios!';
  el.innerHTML = `<div class="prog">
    <p class="prog-msg">${msg}</p>
    <div class="prog-wrap"><div class="track">
      <div class="fill" style="width:${progressPct(T.subtotal, tiers).toFixed(1)}%"></div>
      ${tiers.map((t, i) => {
        const on = unlockedIds.has(t.id);
        const pop = on && !prevUnlocked.has(t.id) && prevUnlocked.size >= 0 && renderProg.ready;
        const icon = t.type === 'free_shipping' ? ICONS.free_shipping : t.type === 'gift' ? ICONS.gift : ICONS.discount;
        return `<div class="mk ${on ? 'on' : ''} ${pop ? 'pop' : ''}" style="left:${(((i + 1) / tiers.length) * 100).toFixed(1)}%">
          <span class="ic">${icon}</span><span class="lb">${esc(P.tierLabel(t))}<i>${money(t.at)}</i></span></div>`;
      }).join('')}
    </div></div></div>`;
  prevUnlocked = unlockedIds;
  renderProg.ready = true;
}

function renderItems() {
  const el = $('#cItems');
  if (!el) return;
  el.innerHTML = view().map((x) => `
    <div class="item">
      <div class="im">${x.p.images && x.p.images[0] ? `<img src="${thumbUrl(x.p.images[0])}" alt="">` : FLOWER_SVG}</div>
      <div>
        <h3>${esc(x.p.name)}</h3>
        ${x.lines.length ? `<ul>${x.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
        ${x.c.note ? `<div class="inote">“${esc(x.c.note)}”</div>` : ''}
        <div class="row">
          <div class="stepper"><button data-cact="dec" data-id="${x.c.id}" aria-label="Menos">−</button><output>${x.qty}</output><button data-cact="inc" data-id="${x.c.id}" aria-label="Más">+</button></div>
          <div><b>${money(x.line)}</b>${x.disc ? `<s>${money(x.original * x.qty)}</s>` : ''}</div>
        </div>
        <button class="rm" data-cact="rm" data-id="${x.c.id}">Quitar</button>
      </div>
    </div>`).join('');
}

function renderForm() {
  const el = $('#cForm');
  if (!el) return;
  const s = S();
  const envio = form.delivery === 'envio';
  el.innerHTML = `<div class="form">
    <h3>Tus datos</h3>
    <div class="field"><label class="l" for="fName">Nombre</label><input id="fName" type="text" autocomplete="name" value="${esc(form.name)}"></div>
    <div class="field"><label class="l">¿Cómo lo recibís?</label>
      <label class="opt ${envio ? 'on' : ''}"><input type="radio" name="deliv" value="envio" ${envio ? 'checked' : ''}><span><b>Envío a domicilio</b><br><small>Mendoza. Calculamos un costo estimado con tu código postal.</small></span></label>
      ${s.allowPickup ? `<label class="opt ${!envio ? 'on' : ''}"><input type="radio" name="deliv" value="retiro" ${!envio ? 'checked' : ''}><span><b>${esc(s.pickupText || 'Retiro en persona')}</b></span></label>` : ''}
    </div>
    ${envio ? `
    <div class="field"><label class="l" for="fCp">Código postal</label>
      <div class="cprow"><input id="fCp" type="text" inputmode="numeric" maxlength="4" placeholder="Ej: 5539" value="${esc(form.cp)}"><button class="btn ghost" type="button" data-cact="ship">Calcular envío</button></div>
      <div id="shipMsg">${shipMsgHtml()}</div>
    </div>
    <div class="field"><label class="l" for="fAddr">Dirección (calle, número, barrio)</label><input id="fAddr" type="text" autocomplete="street-address" value="${esc(form.address)}"></div>` : ''}
  </div>`;
}

function shipMsgHtml() {
  const s = S();
  if (!ship) return '';
  if (ship.loading) return '<div class="ship-msg" style="color:var(--muted)">Calculando…</div>';
  if (ship.ok) return `<div class="ship-msg ok">${ship.label ? esc(ship.label) + ' · ' : ''}A unos ${ship.km} km. Envío estimado <b>${money(ship.cost)}</b>.<br><small style="color:var(--muted)">${esc(s.shippingNote || '')}</small></div>`;
  return `<div class="ship-msg ${ship.reason === 'outside' || ship.reason === 'invalid' ? 'bad' : 'warn'}">${esc(ship.message || 'No pudimos calcular el envío.')}</div>`;
}

function renderCoupon() {
  const el = $('#cCpn');
  if (!el) return;
  let html;
  if (form.coupon) {
    const r = couponRes;
    if (couponBusy || !r) {
      html = `<div class="cpn-applied"><div><b>${esc(form.coupon)}</b><small>Verificando…</small></div></div>`;
    } else if (r.ok) {
      html = `<div class="cpn-applied"><div><b>${esc(r.code)}</b><small>${esc(r.label)}${r.discount ? ' · ahorrás ' + money(r.discount) : ''}</small></div><button class="rm" data-cact="rmcoupon" style="color:var(--muted)">Quitar</button></div>`;
    } else {
      html = `<div class="cpn-applied" style="border-color:var(--bad);background:#fff"><div><b>${esc(form.coupon)}</b><small style="color:var(--bad)">${esc(r.message || 'No se pudo aplicar.')}</small></div><button class="rm" data-cact="rmcoupon" style="color:var(--muted)">Quitar</button></div>`;
    }
  } else if (couponOpen) {
    html = `<h3>Cupón de descuento</h3>
      <div class="cprow"><input id="fCoupon" type="text" autocapitalize="characters" autocomplete="off" placeholder="Escribí tu cupón"><button class="btn ghost" type="button" data-cact="applycoupon">Aplicar</button></div>
      ${couponMsg ? `<div class="cpn-msg bad">${esc(couponMsg)}</div>` : ''}`;
  } else {
    html = '<button class="cpn-toggle" data-cact="cpnopen">¿Tenés un cupón de descuento?</button>';
  }
  el.innerHTML = `<div class="cpn">${html}</div>
    <p class="small">El costo de envío es orientativo y no está incluido en el total: se confirma por WhatsApp. Te respondemos por ahí para coordinar el pago.</p>
    <p class="small"><button class="rm" data-cact="clear" style="color:var(--muted)">Vaciar carrito</button></p>`;
}

function renderCartFoot() {
  const el = $('#cFoot');
  if (!el) return;
  const T = totals();
  const envio = form.delivery === 'envio';
  const hasDisc = T.t.discount > 0 || T.cDisc > 0;
  const extra = [...T.t.benefits.filter((b) => !/env[ií]o/i.test(b))];
  const shipTxt = T.freeShip ? 'Gratis' : ship && ship.ok ? money(ship.cost) : 'a confirmar';
  el.innerHTML = `
    ${sent ? `<div class="sent">Se abrió WhatsApp con tu pedido. Si no se abrió, tocá el botón.<a class="btn wa" href="${esc(sent.url)}" target="_blank" rel="noopener">Abrir WhatsApp de nuevo</a></div>` : ''}
    ${hasDisc ? `<div class="sum"><span>Productos</span><span>${money(T.subtotal)}</span></div>` : ''}
    ${T.t.discount > 0 ? `<div class="sum disc"><span>Promo: ${esc(P.tierLabel(T.t.applied))}</span><span>-${money(T.t.discount)}</span></div>` : ''}
    ${T.cOk && T.cDisc > 0 ? `<div class="sum disc"><span>Cupón ${esc(couponRes.code)}</span><span>-${money(T.cDisc)}</span></div>` : ''}
    ${extra.map((b) => `<div class="sum disc"><span>${esc(b)}</span><span></span></div>`).join('')}
    <div class="sum total"><span>Total</span><b>${money(T.total)}</b></div>
    ${envio ? `<div class="sum"><span>Envío estimado · no incluido</span><span>${shipTxt}</span></div>` : ''}
    <button class="btn wa" data-cact="send" style="margin-top:6px">Enviar pedido por WhatsApp</button>`;
}

/* ---------- cupón ---------- */
function couponItems() {
  return cart.map((c) => ({ pid: c.pid, sel: c.sel, qty: c.qty, note: c.note }));
}
function scheduleCoupon() {
  clearTimeout(couponTimer);
  couponTimer = setTimeout(checkCoupon, 250);
}
async function checkCoupon() {
  if (!form.coupon || !cart.length) return;
  const my = ++couponReq;
  couponBusy = true;
  renderCoupon();
  let res;
  try {
    const r = await fetch('/api/coupons/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: form.coupon, items: couponItems() }) });
    res = await r.json();
  } catch {
    res = { ok: false, message: 'No pudimos verificar el cupón. Probá de nuevo.' };
  }
  if (my !== couponReq) return;
  couponBusy = false;
  couponRes = res;
  renderCoupon(); renderCartFoot();
}
async function applyCoupon() {
  const inp = $('#fCoupon');
  const code = (inp ? inp.value : '').trim().toUpperCase().replace(/\s+/g, '');
  if (!code) { couponMsg = 'Escribí el código del cupón.'; return renderCoupon(); }
  const my = ++couponReq;
  couponBusy = true; couponMsg = '';
  form.coupon = code;
  renderCoupon();
  let res;
  try {
    const r = await fetch('/api/coupons/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, items: couponItems() }) });
    res = await r.json();
  } catch {
    res = { ok: false, message: 'No pudimos verificar el cupón. Probá de nuevo.' };
  }
  if (my !== couponReq) return;
  couponBusy = false;
  if (res.ok) { couponRes = res; couponMsg = ''; persistForm(); toast('Cupón aplicado'); }
  else { form.coupon = ''; couponRes = null; couponMsg = res.message || 'No se pudo aplicar el cupón.'; couponOpen = true; }
  persistForm();
  renderCoupon(); renderCartFoot();
}

/* ---------- envío estimado ---------- */
async function calcShip() {
  const cp = form.cp.trim();
  const box = $('#shipMsg');
  if (!/^\d{4}$/.test(cp)) { ship = { ok: false, reason: 'invalid', cp, message: 'Ingresá un código postal de 4 números.' }; box.innerHTML = shipMsgHtml(); return; }
  ship = { loading: true, cp };
  box.innerHTML = shipMsgHtml();
  try {
    const r = await fetch('/api/shipping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cp }) });
    const j = await r.json();
    if (form.cp !== cp) return;
    ship = Object.assign({ cp }, j);
  } catch {
    ship = { ok: false, reason: 'net', cp, message: 'No pudimos calcular el envío ahora. Igual podés enviar el pedido y te lo confirmamos por WhatsApp.' };
  }
  const b2 = $('#shipMsg');
  if (b2) b2.innerHTML = shipMsgHtml();
  renderCartFoot();
}

/* ---------- eventos del carrito ---------- */
function onCartInput(e) {
  const t = e.target;
  if (t.id === 'fName') form.name = t.value;
  else if (t.id === 'fAddr') form.address = t.value;
  else if (t.id === 'fCoupon') { t.value = t.value.toUpperCase().replace(/\s+/g, ''); return; }
  else if (t.id === 'fCp') {
    t.value = t.value.replace(/\D/g, '').slice(0, 4);
    form.cp = t.value;
    if (ship && ship.cp !== form.cp) { ship = null; const b = $('#shipMsg'); if (b) b.innerHTML = ''; renderCartFoot(); }
  } else if (t.name === 'deliv' && e.type === 'change') {
    form.delivery = t.value;
    persistForm();
    renderForm(); renderCartFoot();
    return;
  }
  persistForm();
}

function onCartClick(e) {
  const b = e.target.closest('[data-cact]');
  if (!b) return;
  const a = b.dataset.cact;
  const item = cart.find((c) => c.id === b.dataset.id);
  if (a === 'close') return closeCart();
  if (a === 'ship') return calcShip();
  if (a === 'send') return sendOrder();
  if (a === 'cpnopen') { couponOpen = true; renderCoupon(); const i = $('#fCoupon'); if (i) i.focus(); return; }
  if (a === 'applycoupon') return applyCoupon();
  if (a === 'rmcoupon') { form.coupon = ''; couponRes = null; couponOpen = false; couponMsg = ''; couponReq++; persistForm(); renderCoupon(); renderCartFoot(); return; }
  if (a === 'inc' && item) item.qty = Math.min(99, item.qty + 1);
  else if (a === 'dec' && item) { item.qty -= 1; if (item.qty <= 0) cart = cart.filter((c) => c !== item); }
  else if (a === 'rm' && item) cart = cart.filter((c) => c !== item);
  else if (a === 'clear') { if (confirm('¿Vaciar el carrito?')) cart = []; else return; }
  else return;
  cartChanged();
}

/* ---------- pedido por WhatsApp ---------- */
function buildMessage(T) {
  const L = [];
  L.push(`Hola, soy ${form.name.trim()}. Quiero hacer este pedido:`);
  L.push('');
  T.v.forEach((x, i) => {
    L.push(`${i + 1}) ${x.p.name} x${x.qty} - ${money(x.line)}`);
    x.lines.forEach((l) => L.push(`   - ${l}`));
    if (x.c.note) L.push(`   Aclaración: ${x.c.note}`);
  });
  L.push('');
  if (T.t.discount > 0 || T.cOk) L.push(`Subtotal: ${money(T.subtotal)}`);
  if (T.t.discount > 0) L.push(`Promo ${P.tierLabel(T.t.applied)}: -${money(T.t.discount)}`);
  if (T.cOk) L.push(`Cupón ${couponRes.code}${T.cDisc ? ': -' + money(T.cDisc) : ''}`);
  T.t.benefits.filter((b) => !/env[ií]o/i.test(b)).forEach((b) => L.push(`Beneficio: ${b}`));
  L.push(`Total: ${money(T.total)}`);
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
  if (form.coupon && couponBusy) { toast('Verificando el cupón, esperá un segundo'); return; }

  const T = totals();
  const url = `https://wa.me/${s.whatsapp}?text=${encodeURIComponent(buildMessage(T))}`;

  // Se registra el pedido en el panel (si se toca dos veces no se duplica)
  const payload = {
    name: form.name.trim(), items: couponItems(), coupon: T.cOk ? couponRes.code : '', token: orderToken,
    delivery: form.delivery, cp: form.cp, address: form.address,
    shipEstimate: form.delivery === 'envio' && ship && ship.ok && !T.freeShip ? ship.cost : null, vid, sid,
  };
  try {
    fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true }).catch(() => {});
  } catch {}

  sent = { url };
  persistForm();
  renderCartFoot();
  const w = window.open(url, '_blank');
  if (!w) location.href = url;
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
  $('#sheetOverlay').addEventListener('click', closeProduct);
  $('#cartOverlay').addEventListener('click', closeCart);
  $('#drawer').addEventListener('click', onCartClick);
  $('#drawer').addEventListener('input', onCartInput);
  $('#drawer').addEventListener('change', onCartInput);
  $('#drawer').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'fCoupon') { e.preventDefault(); applyCoupon(); }
    if (e.key === 'Enter' && e.target.id === 'fCp') { e.preventDefault(); calcShip(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#sheet').hidden) closeProduct();
    else if (!$('#drawer').hidden) closeCart();
  });
}

init();
})();
