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

const HEART_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21C12 21 3 15.5 3 9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 9 2.5C21 15.5 12 21 12 21z"/></svg>';
const SHARE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13"/></svg>';
const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const productPath = (p) => `/p/${p.id}-${slug(p.name)}`;

const CLOCK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
const SEARCH_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const leadText = (h) => {
  h = Number(h) || 0;
  if (h >= 24 && h % 24 === 0) { const d = h / 24; return `${d} ${d === 1 ? 'día' : 'días'}`; }
  return `${h} ${h === 1 ? 'hora' : 'horas'}`;
};
const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const earliestFrom = (hours) => new Date(Date.now() + (Number(hours) || 0) * 3600e3);
function whenLabel(d) {
  const t = new Date();
  const tm = new Date(Date.now() + 864e5);
  if (isoDate(d) === isoDate(t)) return 'hoy';
  if (isoDate(d) === isoDate(tm)) return `mañana (${DAYS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1})`;
  return `${DAYS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}
// De dónde llegó la persona: ?origen=instagram en el link, o la página desde la que vino
function sourceOf() {
  const clean = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 24);
  try {
    const p = new URL(location.href).searchParams;
    const raw = clean(p.get('origen') || p.get('utm_source') || p.get('ref') || p.get('src'));
    if (raw) return raw;
    if (!document.referrer) return 'directo';
    const h = new URL(document.referrer).hostname.toLowerCase().replace(/^(www|m|l|lm)\./, '');
    if (h === location.hostname.replace(/^www\./, '')) return 'directo';
    if (/instagram\.com$/.test(h)) return 'instagram';
    if (/(facebook\.com|fb\.com|fb\.me)$/.test(h)) return 'facebook';
    if (/(whatsapp\.com|wa\.me)$/.test(h)) return 'whatsapp';
    if (/google\./.test(h)) return 'google';
    if (/tiktok\.com$/.test(h)) return 'tiktok';
    if (/(youtube\.com|youtu\.be)$/.test(h)) return 'youtube';
    if (/(t\.co|twitter\.com|x\.com)$/.test(h)) return 'twitter';
    return clean(h.split('.')[0]) || 'otro';
  } catch { return 'directo'; }
}

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

/* Caja de confirmación en el medio de la pantalla (Sí / No) */
const TRASH_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6"/></svg>';
function confirmBox({ title, text, yes = 'Sí', no = 'No' }) {
  return new Promise((resolve) => {
    const w = document.createElement('div');
    w.className = 'cbx';
    w.innerHTML = `<div class="cbx-ov"></div>
      <div class="cbx-box" role="alertdialog" aria-modal="true" aria-labelledby="cbxT">
        <div class="cbx-ic">${TRASH_SVG}</div>
        <h3 id="cbxT">${esc(title)}</h3>
        <p>${esc(text || '')}</p>
        <div class="cbx-act"><button type="button" class="btn ghost" data-v="0">${esc(no)}</button><button type="button" class="btn danger" data-v="1">${esc(yes)}</button></div>
      </div>`;
    document.body.appendChild(w);
    const done = (v) => { document.removeEventListener('keydown', onKey, true); w.remove(); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
    document.addEventListener('keydown', onKey, true);
    w.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (b) done(b.dataset.v === '1');
      else if (e.target.classList.contains('cbx-ov')) done(false);
    });
    w.querySelector('[data-v="0"]').focus();
  });
}
async function askClearCart() {
  const yes = await confirmBox({ title: '¿Vaciar el carrito?', text: 'Se van a sacar todos los productos que agregaste.', yes: 'Sí, vaciar', no: 'No, dejarlo' });
  if (yes) { cart = []; cartChanged(); }
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
  // el encabezado usa el color de la marca: el texto se pone claro u oscuro según qué tan claro sea ese color
  const n = parseInt(c.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  r.setProperty('--on-p', lum > 0.62 ? '#2b2b2b' : '#ffffff');
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
function track(type, pid, qty, extra) {
  if (noTrack) return;
  try { if (window.umami && typeof umami.track === 'function') umami.track(type, { ...(pid ? { pid } : {}), ...(qty ? { qty } : {}), ...(extra || {}) }); } catch {}
  try {
    const body = JSON.stringify({ vid, sid, type, pid: pid || null, qty: qty || null, ...(extra || {}) });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
    else fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true });
  } catch {}
}

/* ---------- estado ---------- */
let store = { settings: {}, categories: [], products: [] };
let activeCat = 'all';
let cart = load('fl_cart2', []);           // [{ id, pid, sel, qty, note, key }]
let orderToken = load('fl_tok', null) || uid();
let form = Object.assign({ name: '', last: '', phone: '', delivery: 'envio', province: '', cp: '', address: '', coupon: '', shipOpt: '' }, load('fl_form2', {}));
let query = '';                            // texto del buscador
let sortBy = 'default';                     // orden del catálogo
let sending = false;
const carReady = () => { const c = S().carriersReady || {}; return !!(c.andreani || c.correo); };
let ck = { step: 'cart', ship: null, quote: null, done: null, sending: false };   // estado del carrito y del envío
let couponRes = null, couponBusy = false, couponOpen = false, couponMsg = '', couponReq = 0, couponTimer = null;
let prevUnlocked = new Set();
let cur = null;                            // producto abierto
let annT = null;
let likes = new Set(load('fl_likes', []));   // favoritos de este dispositivo
let pushed = false;                          // si abrimos el producto agregando una entrada al historial

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
  renderAnn(); renderTop(); renderHero(); renderCats(); renderGrid(); renderAbout(); renderWholesale(); renderFoot(); renderWaFloat(); renderTools();
  pruneCart();
  renderCartBadge();
  wireGlobal();
  if (window.FLReviews) window.FLReviews.renderSection($('#reviews'), store.reviews, { lock: lockScroll, unlock: unlockScroll });
  if (newSession) track('visit', null, null, { src: sourceOf() });
  if (form.coupon && cart.length) checkCoupon();
  checkReturnFromPay();
  // Link de un producto (/p/12-nombre): se abre directo
  const m = /^\/p\/(\d+)/.exec(location.pathname);
  if (m) {
    if (prodById(+m[1])) openProduct(+m[1], { fromUrl: true });
    else history.replaceState(null, '', '/');
  }
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
    <div class="hact"><button class="cart-btn" id="openCart" aria-label="Abrir carrito">${BAG_SVG}<span class="lbl">Carrito</span><span class="n" id="cartN" data-n="0"></span></button></div>`;
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
  if (!store.products.length) { el.innerHTML = ''; return; }
  const used = new Set(store.products.map((p) => p.category_id));
  const cats = store.categories.filter((c) => used.has(c.id));
  const hasUncat = store.products.some((p) => !p.category_id);
  const favN = store.products.filter((p) => likes.has(p.id)).length;
  const items = [{ id: 'all', name: 'Todo' }, ...cats, ...(hasUncat && cats.length ? [{ id: 'none', name: 'Otros' }] : []), { id: 'fav', name: `♥ Favoritos (${favN})` }];
  el.innerHTML = items.map((c) => `<button class="cat" role="tab" data-cat="${c.id}" aria-selected="${String(c.id) === String(activeCat)}">${esc(c.name)}</button>`).join('');
}

let shownCount = 0;
function paintCount() {
  const rc = $('#resCount');
  if (rc) rc.textContent = `${shownCount} ${shownCount === 1 ? 'producto' : 'productos'}`;
}

function renderTools() {
  const el = $('#tools');
  if (!el) return;
  if (!store.products.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="tl">
    <div class="srch">${SEARCH_SVG}<input id="q" type="search" placeholder="Buscar flores…" autocomplete="off" aria-label="Buscar" value="${esc(query)}"><button type="button" id="qClear" aria-label="Borrar búsqueda" ${query ? '' : 'hidden'}>×</button></div>
    <select id="sortBy" aria-label="Ordenar"><option value="default">Ordenar: destacados</option><option value="asc">Menor precio</option><option value="desc">Mayor precio</option><option value="off">Con descuento primero</option></select>
  </div>`;
  $('#sortBy').value = sortBy;
}


function renderWaFloat() {
  const a = $('#waFloat');
  if (!a) return;
  const s = S();
  if (!s.waFloatOn || !s.whatsapp) { a.hidden = true; return; }
  a.href = `https://wa.me/${s.whatsapp}?text=${encodeURIComponent(s.waFloatText || '')}`;
  a.hidden = false;
}

function renderGrid() {
  let list = store.products.filter((p) =>
    activeCat === 'all' ? true : activeCat === 'fav' ? likes.has(p.id) : activeCat === 'none' ? !p.category_id : String(p.category_id) === String(activeCat));
  const words = norm(query).trim().split(/\s+/).filter(Boolean);
  if (words.length) list = list.filter((p) => { const hay = norm(p.name + ' ' + (p.description || '')); return words.every((w) => hay.includes(w)); });
  const priceOf = (p) => P.discounted(P.minPrice(p), p).price;
  if (sortBy === 'asc') list = [...list].sort((a, b) => priceOf(a) - priceOf(b));
  else if (sortBy === 'desc') list = [...list].sort((a, b) => priceOf(b) - priceOf(a));
  else if (sortBy === 'off') list = [...list].sort((a, b) => Number(P.discounted(P.minPrice(b), b).active) - Number(P.discounted(P.minPrice(a), a).active));
  let empty = '<p class="empty">Todavía no hay productos en esta categoría.</p>';
  if (words.length) empty = `<p class="empty">No encontramos nada con “${esc(query)}”. Probá con otra palabra.</p>`;
  else if (activeCat === 'fav') empty = '<p class="empty">Todavía no marcaste favoritos. Tocá el corazón de los productos que te gusten.</p>';
  $('#grid').innerHTML = list.length
    ? list.map((p) => {
        const hasOpts = (p.groups || []).some((g) => g.options.length);
        const d = P.discounted(P.minPrice(p), p);
        return `<button class="card" data-pid="${p.id}">
          <div class="ph">${p.images && p.images[0] ? `<img loading="lazy" decoding="async" src="${thumbUrl(p.images[0])}" alt="${esc(p.name)}">` : FLOWER_SVG}
            ${d.active ? `<span class="tag-off">-${d.pct}%</span>` : ''}
            ${p.pinned ? '<span class="tag-pin">Destacado</span>' : ''}
            <span class="heart ${likes.has(p.id) ? 'on' : ''}" role="button" tabindex="0" aria-label="Marcar ${esc(p.name)} como favorito" aria-pressed="${likes.has(p.id)}" data-like="${p.id}">${HEART_SVG}</span></div>
          <h3>${esc(p.name)}</h3>
          <div class="price">${hasOpts ? 'Desde ' : ''}${d.active ? `<s>${money(d.original)}</s> ` : ''}<b>${money(d.price)}</b></div>
          ${p.lead_hours > 0 ? `<div class="lead">${CLOCK_SVG}Pedir con ${leadText(p.lead_hours)} de anticipación</div>` : ''}
        </button>`;
      }).join('')
    : empty;
  shownCount = list.length;
  paintCount();
}

function renderWholesale() {
  // El bloque de mayoristas no se muestra en la tienda: los mayoristas entran desde la página /mayoristas.
  const el = $('#wholesale');
  if (el) { el.hidden = true; el.innerHTML = ''; }
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
  links.push('<a href="/terminos">Términos y condiciones</a>', '<a href="/privacidad">Privacidad</a>', '<a href="/cambios-y-arrepentimiento">Cambios y arrepentimiento</a>');
  $('#foot').innerHTML = `<div class="name">${esc(s.storeName)}</div>
    ${links.length ? `<div class="links">${links.join('')}</div>` : ''}
    <small>${esc(s.footerText)}</small>`;
  const legalBits = [];
  if (s.legalName) legalBits.push(esc(s.legalName));
  if (s.legalCuit) legalBits.push('CUIT ' + esc(s.legalCuit));
  if (s.legalAddress) legalBits.push(esc(s.legalAddress));
  if (s.legalEmail) legalBits.push(`<a href="mailto:${esc(s.legalEmail)}">${esc(s.legalEmail)}</a>`);
  if (legalBits.length) $('#foot').insertAdjacentHTML('beforeend', `<div class="legal-data">${legalBits.join(' · ')}</div>`);
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

function openProduct(id, opts = {}) {
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
        <div class="sh-actions">
          <button type="button" class="pill-btn ${likes.has(p.id) ? 'on' : ''}" data-act="like" data-like="${p.id}" aria-pressed="${likes.has(p.id)}">${HEART_SVG}<span id="shLikeLbl"></span></button>
          <button type="button" class="pill-btn" data-act="share">${SHARE_SVG}<span>Compartir</span></button>
        </div>
        ${p.lead_hours > 0 ? `<div class="lead-box">${CLOCK_SVG}<div><b>Pedilo con ${leadText(p.lead_hours)} de anticipación</b><span>Si lo pedís ahora, lo tenés desde ${whenLabel(earliestFrom(p.lead_hours))}.</span></div></div>` : ''}
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
  renderGal(); renderOpts(); renderSheetFoot(); paintLikes(p.id);
  document.title = `${p.name} · ${S().storeName}`;
  if (!opts.fromUrl) { try { history.pushState({ fl: 1 }, '', productPath(p)); pushed = true; } catch { pushed = false; } } else pushed = false;
  track('product_view', p.id);
}

function closeProduct(fromPop) {
  if ($('#sheet').hidden) return;
  $('#sheet').hidden = true;
  $('#sheetOverlay').hidden = true;
  cur = null;
  unlockScroll();
  applyTheme();   // restaura el título de la página
  if (fromPop === true) { pushed = false; return; }
  if (pushed) { pushed = false; history.back(); }
  else if (/^\/p\//.test(location.pathname)) history.replaceState(null, '', '/');
}

/* ---------- favoritos y compartir ---------- */
function paintLikes(pid) {
  const on = likes.has(pid);
  document.querySelectorAll(`[data-like="${pid}"]`).forEach((el) => { el.classList.toggle('on', on); el.setAttribute('aria-pressed', String(on)); });
  const lbl = $('#shLikeLbl');
  if (lbl && cur && cur.p.id === pid) lbl.textContent = (on ? 'En tus favoritos' : 'Me gusta') + (typeof cur.p.likes === 'number' ? ` · ${cur.p.likes}` : '');
}
async function toggleLike(pid) {
  const on = !likes.has(pid);
  if (on) likes.add(pid); else likes.delete(pid);
  save('fl_likes', [...likes]);
  paintLikes(pid);
  renderCats();
  if (activeCat === 'fav') renderGrid();
  try {
    const r = await fetch('/api/likes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pid, vid, on }) });
    const j = await r.json();
    if (!j.ok) throw new Error('x');
    const p = prodById(pid);
    if (p && typeof p.likes === 'number') { p.likes = j.count; paintLikes(pid); }
  } catch {
    if (on) likes.delete(pid); else likes.add(pid);
    save('fl_likes', [...likes]);
    paintLikes(pid);
    toast('No pudimos guardar tu favorito. Probá de nuevo.');
  }
}

async function shareProduct(p) {
  const url = location.origin + productPath(p) + '?origen=compartir';
  if (navigator.share) {
    try { await navigator.share({ title: `${p.name} · ${S().storeName}`, text: `Mirá este producto: ${p.name}`, url }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  openShareBox(p, url);
}
function closeShareBox() { const b = $('#shareBox'); if (b) b.remove(); }
function openShareBox(p, url) {
  closeShareBox();
  const box = document.createElement('div');
  box.className = 'share-box';
  box.id = 'shareBox';
  box.innerHTML = `<div class="share-in"><h3>Compartir producto</h3>
    <input id="shUrl" type="text" readonly value="${esc(url)}" aria-label="Link del producto">
    <div class="row2"><button type="button" class="btn" data-sh="copy">Copiar link</button>
    <a class="btn wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(p.name + ' ' + url)}">WhatsApp</a></div>
    <button type="button" class="linkbtn" data-sh="close">Cerrar</button></div>`;
  $('#sheet').appendChild(box);
  box.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-sh]');
    if (e.target === box || (b && b.dataset.sh === 'close')) return closeShareBox();
    if (b && b.dataset.sh === 'copy') {
      try { await navigator.clipboard.writeText(url); }
      catch { const i = $('#shUrl'); i.select(); try { document.execCommand('copy'); } catch {} }
      toast('Link copiado');
    }
  });
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
  if (act === 'like') return toggleLike(cur.p.id);
  if (act === 'share') return shareProduct(cur.p);
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
  toast('Agregado al carrito.' + (p.lead_hours > 0 ? ` Recordá: se pide con ${leadText(p.lead_hours)} de anticipación.` : ''));
}

/* ---------- carrito ---------- */
const PROVINCES = ['Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Ciudad Autónoma de Buenos Aires', 'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'];

function view() {
  return cart.map((c) => {
    const p = prodById(c.pid);
    if (!p) return null;
    const r = P.calcSelection(p, c.sel);
    if (r.missing.length) return null;
    const d = P.discounted(r.price, p);
    return { c, p, unit: d.price, original: r.price, disc: d.active, qty: c.qty, line: d.price * c.qty };
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
  const discount = (t.discount || 0) + cDisc;
  const total = Math.max(0, subtotal - discount);
  return {
    v, subtotal, t, cOk, cDisc, discount, total,
    freeShip: !!(t.freeShipping || (cOk && couponRes.freeShipping)),
    leadHours: v.reduce((m, x) => Math.max(m, Number(x.p.lead_hours) || 0), 0),
  };
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
  orderToken = uid();     // un carrito distinto es un pedido distinto
  ck.ship = null; ck.quote = null;   // el envío depende de lo que hay en el carrito
  if (form.coupon) scheduleCoupon();
  persist();
  renderCartBadge();
  if (!$('#drawer').hidden) renderCart();
  if (cart.length && form.delivery === 'envio') refreshShipping();
}

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
  ck.done = null; ck.step = 'cart';
}

let ckTimer = null;

function itemHtml(x) {
  return `<li class="ck-item">
    <div class="ck-info"><b>${esc(x.p.name)}</b><span>${x.disc ? `<s>${money(x.original * x.qty)}</s> ` : ''}${money(x.line)}</span></div>
    <div class="ck-qty">
      <button type="button" data-cact="dec" data-id="${x.c.id}" aria-label="Quitar uno">−</button>
      <b>${x.qty}</b>
      <button type="button" data-cact="inc" data-id="${x.c.id}" aria-label="Agregar uno">+</button>
      <button type="button" class="ck-rm" data-cact="rm" data-id="${x.c.id}" aria-label="Quitar del pedido">Quitar</button>
    </div></li>`;
}

function renderCart() {
  const d = $('#drawer');
  if (ck.done) return paintDone(d);
  if (!cart.length) {
    d.innerHTML = `<button class="drawer-close" data-cact="close" aria-label="Cerrar">×</button>
      <div class="drawer-head"><h2>Tu pedido</h2></div>
      <div class="drawer-body"><div class="cart-empty">${FLOWER_SVG}<p>Todavía no agregaste nada.</p><button class="btn ghost" data-cact="close">Ver catálogo</button></div></div>`;
    return;
  }
  if (ck.step === 'datos') return paintCheckout(d);
  const T = totals();
  d.innerHTML = `<button class="drawer-close" data-cact="close" aria-label="Cerrar">×</button>
    <div class="drawer-head"><h2>Tu pedido</h2></div>
    <div class="drawer-body">
      <div id="cProg"></div>
      <ul class="ck-items">${T.v.map(itemHtml).join('')}</ul>
      <div id="cCpn"></div>
      <button class="ck-clear" type="button" data-cact="clear">Vaciar carrito</button>
    </div>
    <div class="drawer-foot">
      <div class="sum"><span>Subtotal</span><b>${money(T.subtotal)}</b></div>
      ${T.discount > 0 ? `<div class="sum"><span>Descuentos</span><span>- ${money(T.discount)}</span></div><div class="sum total"><span>Total</span><b>${money(T.total)}</b></div>` : ''}
      <button class="btn" type="button" data-cact="hacer">Hacer pedido</button>
    </div>`;
  renderProg(); renderCoupon();
}

function shippingFields() {
  return `<div class="field"><label class="l" for="ckProv">Provincia *</label>
      <select id="ckProv"><option value="">Elegí tu provincia</option>${PROVINCES.map((p) => `<option value="${esc(p)}" ${form.province === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></div>
    ${form.province ? `<div class="field"><label class="l" for="ckCp">Código postal *</label>
      <input id="ckCp" inputmode="numeric" maxlength="4" placeholder="Ej: 5500" value="${esc(form.cp)}"></div>
    <div class="field"><label class="l" for="ckAddr">Calle y número *</label>
      <input id="ckAddr" autocomplete="street-address" value="${esc(form.address)}"></div>` : ''}
    <div id="ckShip"></div>`;
}

function paintCheckout(d) {
  const isEnvio = form.delivery === 'envio';
  d.innerHTML = `<button class="drawer-close" data-cact="close" aria-label="Cerrar">×</button>
    <div class="drawer-head"><button class="ck-back" type="button" data-cact="volver">← Volver</button><h2>Tus datos</h2></div>
    <div class="drawer-body">
      ${window.FLAccount && !window.FLAccount.me ? '<p class="hint">¿Ya tenés cuenta? <button type="button" class="ck-back" data-acct="login">Ingresá</button> y completamos tus datos.</p>' : ''}
      <div class="field"><label class="l" for="ckName">Nombre *</label><input id="ckName" autocomplete="given-name" value="${esc(form.name)}"></div>
      <div class="field"><label class="l" for="ckLast">Apellido *</label><input id="ckLast" autocomplete="family-name" value="${esc(form.last)}"></div>
      <div class="field"><label class="l" for="ckPhone">Número de WhatsApp *</label><input id="ckPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="261 456 7890" value="${esc(form.phone)}"></div>
      <div class="field"><label class="l">¿Cómo lo querés recibir?</label>
        <label class="opt ${isEnvio ? '' : 'on'}"><input type="radio" name="ckDeliv" value="retiro" ${isEnvio ? '' : 'checked'}><span><b>Punto de encuentro</b><br><small>Solo disponible en Ciudad de Mendoza.</small></span></label>
        <label class="opt ${isEnvio ? 'on' : ''}"><input type="radio" name="ckDeliv" value="envio" ${isEnvio ? 'checked' : ''}><span><b>Envío a domicilio</b></span></label>
      </div>
      ${isEnvio ? shippingFields() : ''}
      <div id="cCpn"></div>
    </div>
    <div class="drawer-foot">
      <div id="ckSum"></div>
      ${S().payReady ? `<button class="btn wa" type="button" data-cact="pagar" ${ck.sending ? 'disabled' : ''}>Pagar con Mercado Pago</button>
      <p class="small">Pagás los productos${isEnvio && form.province !== 'Mendoza' ? ' y el envío por correo' : ''} con Mercado Pago. ${isEnvio && form.province === 'Mendoza' ? 'El envío en Mendoza se coordina por WhatsApp. ' : ''}Si preferís, mandá el pedido y pagás después.</p>` : ''}
      <button class="btn${S().payReady ? ' sec' : ''}" type="button" data-cact="mandar" ${ck.sending ? 'disabled' : ''}>${ck.sending ? 'Mandando…' : 'Mandar pedido'}</button>
    </div>`;
  paintShipping();
  renderCoupon();
}

/* costo del envío tal como queda elegido */
function shipInfo() {
  if (form.delivery !== 'envio') return { ok: true, cost: 0, label: 'Sin costo (punto de encuentro)' };
  if (!form.province) return { ok: false, label: 'a elegir' };
  if (form.province === 'Mendoza') {
    if (!ck.ship || ck.ship.loading || !ck.ship.ok) return { ok: false, label: 'a calcular' };
    if (totals().freeShip) return { ok: true, cost: 0, label: 'Gratis' };
    return { ok: true, cost: ck.ship.cost, label: ck.ship.cost === 0 ? 'Gratis' : money(ck.ship.cost) };
  }
  if (!form.shipOpt) return { ok: false, label: 'a elegir' };
  if (form.shipOpt === 'wa') return { ok: true, cost: null, label: 'A confirmar por WhatsApp' };
  const o = ((ck.quote && ck.quote.options) || []).find((x) => x.id === form.shipOpt);
  if (!o) return { ok: false, label: 'a elegir' };
  if (o.price == null) return { ok: true, cost: null, label: 'A confirmar por WhatsApp' };
  if (totals().freeShip) return { ok: true, cost: 0, label: 'Gratis' };
  return { ok: true, cost: o.price, label: money(o.price) };
}

function shipHtml() {
  if (form.delivery !== 'envio') return '';
  if (!form.province) return '<p class="hint">Elegí tu provincia para calcular el envío.</p>';
  if (!/^\d{4}$/.test(form.cp)) return '<p class="hint">Escribí tu código postal para calcular el envío.</p>';
  if (form.province === 'Mendoza') {
    if (!ck.ship || ck.ship.loading) return '<p class="hint">Calculando el envío…</p>';
    if (!ck.ship.ok) return `<div class="ship-msg bad">${esc(ck.ship.reason === 'outside' ? 'Ese código postal no es de Mendoza. Si vivís en otra provincia, elegila arriba.' : (ck.ship.message || 'No pudimos calcular el envío. Revisá el código postal.'))}</div>`;
    return '';
  }
  if (!ck.quote || ck.quote.loading) return '<p class="hint">Buscando opciones de envío…</p>';
  const opts = ck.quote.options || [];
  const errs = ck.quote.errors && ck.quote.errors.length ? `<div class="ship-msg warn">No pudimos consultar ${esc(ck.quote.errors.join(' ni '))} ahora.</div>` : '';
  if (!opts.length) return `<div class="ship-msg warn">Por ahora coordinamos el envío a ${esc(form.province)} por WhatsApp. Te confirmamos el costo.</div>${errs}`;
  const rows = opts.map((o) => `<label class="opt ${form.shipOpt === o.id ? 'on' : ''}">
      <input type="radio" name="ckOpt" value="${esc(o.id)}" ${form.shipOpt === o.id ? 'checked' : ''}>
      <span><b>${esc(o.carrier)} · ${esc(o.service)}</b><br><small>${o.price == null ? esc(o.note || 'Te confirmamos el costo por WhatsApp.') : esc(o.days || '')}</small></span>
      <b class="opr">${o.price == null ? 'A confirmar' : money(o.price)}</b></label>`).join('');
  return `<div class="field"><label class="l">¿Con qué correo lo enviamos?</label>${rows}</div>${errs}`;
}

function summaryHtml() {
  const T = totals();
  const sh = shipInfo();
  const total = sh.ok && sh.cost != null ? T.total + sh.cost : T.total;
  const pendingShip = sh.ok && sh.cost == null;
  return `<div class="sum"><span>Productos${T.discount > 0 ? ' (con descuentos)' : ''}</span><b>${money(T.total)}</b></div>
    <div class="sum"><span>Envío</span><span>${sh.label}</span></div>
    <div class="sum total"><span>Total a pagar</span><b>${money(total)}</b></div>
    ${!sh.ok && form.delivery === 'envio' ? '<p class="small">Falta elegir el envío para ver el total final.</p>' : ''}
    ${pendingShip ? '<p class="small">El total final se confirma por WhatsApp junto con el costo del envío.</p>' : ''}
    ${T.leadHours > 0 ? `<div class="ck-lead">${CLOCK_SVG}<span>Tiempo mínimo de espera: <b>${leadText(T.leadHours)}</b></span></div>` : ''}`;
}

function paintShipping() {
  const box = $('#ckShip');
  if (box) box.innerHTML = shipHtml();
  const sum = $('#ckSum');
  if (sum) sum.innerHTML = summaryHtml();
}

function itemsForServer() {
  return view().map((x) => ({ pid: x.c.pid, sel: x.c.sel, qty: x.c.qty, note: x.c.note || '' }));
}

function refreshShipping() {
  paintShipping();
  clearTimeout(ckTimer);
  ckTimer = setTimeout(fetchShipping, 250);
}

async function fetchShipping() {
  if (form.delivery !== 'envio' || !form.province || !/^\d{4}$/.test(form.cp)) { ck.ship = null; ck.quote = null; return paintShipping(); }
  const cp = form.cp, prov = form.province;
  if (prov === 'Mendoza') {
    ck.ship = { loading: true, cp }; ck.quote = null; paintShipping();
    let j;
    try {
      const r = await fetch('/api/shipping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cp }) });
      j = await r.json();
    } catch { j = { ok: false, message: 'No pudimos calcular el envío ahora. Probá de nuevo.' }; }
    if (form.cp !== cp || form.province !== prov) return;
    ck.ship = Object.assign({ cp }, j);
  } else {
    ck.ship = null; ck.quote = { loading: true, cp }; paintShipping();
    let j;
    try {
      const r = await fetch('/api/shipping/carriers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cp, items: itemsForServer() }) });
      j = await r.json();
    } catch { j = { ok: false }; }
    if (form.cp !== cp || form.province !== prov) return;
    const options = j.ok ? (j.options || []) : [];
    ck.quote = { cp, options, errors: j.ok ? (j.errors || []) : ['los correos'] };
    if (!options.length) form.shipOpt = 'wa';
    else if (!options.some((o) => o.id === form.shipOpt)) form.shipOpt = '';
    persistForm();
  }
  paintShipping();
}

// Si la clienta ingresa a su cuenta, se completan sus datos en el carrito (sin pisar lo que ya escribió)
document.addEventListener('fl:account', (e) => {
  const a = e.detail;
  if (!a || a.mustChange) return;
  const ph = /^549\d{10}$/.test(a.phone || '') ? `${a.phone.slice(3, 6)} ${a.phone.slice(6, 9)} ${a.phone.slice(9)}` : (a.phone || '');
  const parts = String(a.name || '').trim().split(/\s+/);
  let ch = false;
  if (!form.name && parts[0]) { form.name = parts[0]; ch = true; }
  if (!form.last && parts.length > 1) { form.last = parts.slice(1).join(' '); ch = true; }
  if (!form.phone && ph) { form.phone = ph; ch = true; }
  if (!form.address && a.address) { form.address = a.address; ch = true; }
  if (ch) { persistForm(); if (!$('#drawer').hidden && cart.length) renderCart(); }
});

function paintDone(d) {
  d.innerHTML = `<button class="drawer-close" data-cact="close" aria-label="Cerrar">×</button>
    <div class="drawer-head"><h2>¡Gracias!</h2></div>
    <div class="drawer-body"><div class="done">
      <div class="ok" aria-hidden="true">✓</div>
      <h3>Gracias por realizar el pedido</h3>
      <p>Te hablamos por WhatsApp dentro de las próximas 24 horas para confirmar tu pedido y coordinar el pago y el envío.</p>
      <p class="small">Pedido #${esc(ck.done.id)}</p>
    </div></div>
    <div class="drawer-foot"><button class="btn" type="button" data-cact="close">Listo</button></div>`;
}

async function sendCart(thenPay) {
  if (ck.sending || !cart.length) return;
  const first = form.name.trim(), last = form.last.trim(), phone = form.phone.trim();
  const isEnvio = form.delivery === 'envio';
  const focus = (id) => { const i = $('#' + id); if (i) i.focus(); };
  if (!first) { toast('Escribí tu nombre'); return focus('ckName'); }
  if (!last) { toast('Escribí tu apellido'); return focus('ckLast'); }
  if (phone.replace(/\D/g, '').length < 8) { toast('Escribí tu número de WhatsApp'); return focus('ckPhone'); }
  let shipOpt = '', shipEstimate = null;
  if (isEnvio) {
    if (!form.province) { toast('Elegí tu provincia'); return focus('ckProv'); }
    if (!/^\d{4}$/.test(form.cp)) { toast('Escribí tu código postal'); return focus('ckCp'); }
    if (!form.address.trim()) { toast('Escribí la calle y el número'); return focus('ckAddr'); }
    if (form.province === 'Mendoza') {
      if (!ck.ship || ck.ship.loading || !ck.ship.ok) { toast(ck.ship && ck.ship.reason === 'outside' ? 'Ese código postal no es de Mendoza' : ((ck.ship && ck.ship.message) || 'Revisá tu código postal de Mendoza')); return; }
      shipEstimate = totals().freeShip ? null : ck.ship.cost;
    } else {
      if (!form.shipOpt) { toast('Elegí con qué correo lo enviamos'); return; }
      if (form.shipOpt !== 'wa') shipOpt = form.shipOpt;
    }
  }
  const payload = {
    name: `${first} ${last}`, phone, items: itemsForServer(), token: orderToken,
    delivery: isEnvio ? 'envio' : 'retiro',
    cp: isEnvio ? form.cp : '', address: isEnvio ? `${form.address.trim()}, ${form.province}` : '',
    shipOpt, shipEstimate, neededFor: '', coupon: totals().cOk ? couponRes.code : '', vid, sid,
  };
  ck.sending = true; renderCart();
  let res;
  try {
    const r = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    res = await r.json();
  } catch { res = { ok: false, message: 'No pudimos conectarnos. Probá de nuevo.' }; }
  ck.sending = false;
  if (!res.ok) { toast(res.message || 'No se pudo mandar el pedido'); renderCart(); return; }
  persistForm();
  if (thenPay) return payOrderNow(res.id, payload.token);
  cart = []; orderToken = uid(); persist(); renderCartBadge();
  track('order_sent', null, null, { delivery: payload.delivery, total: totals().total });
  ck.done = { id: res.id }; ck.step = 'cart'; ck.ship = null; ck.quote = null;
  renderCart();
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
  renderCoupon(); renderCart();
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
  renderCoupon(); renderCart();
}

function onCartClick(e) {
  const b = e.target.closest('[data-cact]');
  if (!b) return;
  const a = b.dataset.cact, id = b.dataset.id;
  if (a === 'close') return closeCart();
  if (a === 'clear') return askClearCart();
  if (a === 'inc' || a === 'dec' || a === 'rm') {
    const it = cart.find((c) => c.id === id);
    if (!it) return;
    if (a === 'inc') it.qty = Math.min(99, it.qty + 1);
    if (a === 'dec') it.qty -= 1;
    if (a === 'rm' || it.qty < 1) cart = cart.filter((c) => c.id !== id);
    return cartChanged();
  }
  if (a === 'cpnopen') { couponOpen = true; renderCoupon(); const i = $('#fCoupon'); if (i) i.focus(); return; }
  if (a === 'applycoupon') return applyCoupon();
  if (a === 'rmcoupon') { form.coupon = ''; couponRes = null; couponOpen = false; couponMsg = ''; couponReq++; persistForm(); renderCoupon(); renderCartFoot(); return; }
  if (a === 'hacer') {
    track('checkout_start', null, cartCount());
    ck.step = 'datos'; renderCart();
    if (form.delivery === 'envio') refreshShipping();
    return;
  }
  if (a === 'volver') { ck.step = 'cart'; renderCart(); return; }
  if (a === 'mandar') return sendCart(false);
  if (a === 'pagar') return sendCart(true);
}

function onCartInput(e) {
  const t = e.target;
  if (t.id === 'ckName') form.name = t.value;
  else if (t.id === 'ckLast') form.last = t.value;
  else if (t.id === 'ckPhone') form.phone = t.value;
  else if (t.id === 'ckAddr') form.address = t.value;
  else if (t.id === 'fCoupon') { t.value = t.value.toUpperCase().replace(/\s+/g, ''); return; }
  else if (t.id === 'ckCp') {
    t.value = t.value.replace(/\D/g, '').slice(0, 4);
    if (form.cp !== t.value) { form.cp = t.value; form.shipOpt = ''; ck.ship = null; ck.quote = null; }
    persistForm();
    if (/^\d{4}$/.test(t.value)) refreshShipping(); else paintShipping();
    return;
  } else if (t.id === 'ckProv') {
    form.province = t.value; form.shipOpt = ''; ck.ship = null; ck.quote = null;
    persistForm(); renderCart();
    if (form.province && /^\d{4}$/.test(form.cp)) refreshShipping();
    return;
  } else if (t.name === 'ckDeliv') {
    form.delivery = t.value; persistForm(); renderCart();
    if (form.delivery === 'envio' && form.province && /^\d{4}$/.test(form.cp)) refreshShipping();
    return;
  } else if (t.name === 'ckOpt') {
    form.shipOpt = t.value; persistForm(); paintShipping();
    return;
  } else return;
  persistForm();
  paintShipping();
}

// Abre el cobro del pedido recién guardado. Si el cobro falla, el pedido igual queda guardado.
async function payOrderNow(id, token) {
  let r;
  try {
    r = await (await fetch(`/api/orders/${id}/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })).json();
  } catch { r = { ok: false, message: 'No pudimos conectarnos con Mercado Pago.' }; }
  cart = []; orderToken = uid(); persist(); renderCartBadge();
  if (r.paid) { toast(r.message || 'Ese pedido ya está pagado.'); ck.done = { id }; ck.step = 'cart'; ck.sending = false; return renderCart(); }
  if (!r.ok || !r.url) {
    // el pedido quedó guardado: se muestra la confirmación y el pago se coordina por WhatsApp
    toast((r.message || 'No pudimos abrir el pago.') + ' Tu pedido quedó guardado.');
    ck.done = { id }; ck.step = 'cart'; ck.sending = false; ck.ship = null; ck.quote = null;
    return renderCart();
  }
  location.href = r.url;   // a Mercado Pago
}

/* Al volver de Mercado Pago: se muestra el resultado (la confirmación real llega por el aviso de Mercado Pago). */
function checkReturnFromPay() {
  const p = new URLSearchParams(location.search);
  const st = p.get('pago'), id = p.get('pedido');
  if (!st || !id) return;
  history.replaceState(null, '', '/');
  const msg = st === 'ok' ? '¡Gracias! Recibimos tu pago. Te escribimos por WhatsApp para coordinar el envío.'
    : st === 'pendiente' ? 'Tu pago quedó pendiente de confirmación. Te escribimos por WhatsApp cuando se confirme.'
    : 'El pago no se completó. Podés intentarlo de nuevo o terminar el pedido por WhatsApp.';
  openCart();
  $('#drawer').innerHTML = `<button class="drawer-close" data-cact="close" aria-label="Cerrar">×</button>
    <div class="drawer-head"><h2>${st === 'ok' ? '¡Pago recibido!' : 'Pago'}</h2></div>
    <div class="drawer-body"><div class="done"><div class="ok" aria-hidden="true">${st === 'ok' ? '✓' : '!'}</div>
      <h3>Pedido #${esc(id)}</h3><p>${esc(msg)}</p></div></div>
    <div class="drawer-foot"><button class="btn" data-cact="close">Listo</button></div>`;
}



function wireGlobal() {
  document.addEventListener('click', (e) => {
    if (e.target.closest('#openCart')) return openCart();
    const cat = e.target.closest('[data-cat]');
    if (cat) { activeCat = cat.dataset.cat; renderCats(); renderGrid(); return; }
    const heart = e.target.closest('.heart[data-like]');
    if (heart) { e.preventDefault(); return toggleLike(+heart.dataset.like); }
    const card = e.target.closest('[data-pid]');
    if (card) return openProduct(+card.dataset.pid);
  });
  document.addEventListener('keydown', (e) => {
    const heart = e.target.closest && e.target.closest('.heart[data-like]');
    if (heart && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); toggleLike(+heart.dataset.like); }
  }, true);
  window.addEventListener('popstate', () => {
    const m = /^\/p\/(\d+)/.exec(location.pathname);
    if (!$('#sheet').hidden) { if (!m || !cur || +m[1] !== cur.p.id) closeProduct(true); }
    else if (m && prodById(+m[1])) openProduct(+m[1], { fromUrl: true });
  });
  let qT;
  document.addEventListener('input', (e) => {
    if (e.target.id !== 'q') return;
    query = e.target.value;
    const c = $('#qClear'); if (c) c.hidden = !query;
    clearTimeout(qT); qT = setTimeout(renderGrid, 120);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#qClear')) return;
    query = ''; const q = $('#q'); if (q) { q.value = ''; q.focus(); }
    e.target.closest('#qClear').hidden = true; renderGrid();
  });
  document.addEventListener('change', (e) => { if (e.target.id === 'sortBy') { sortBy = e.target.value; renderGrid(); } });
  document.addEventListener('submit', (e) => {
    if (e.target.id !== 'hsearch') return;
    e.preventDefault(); const g = $('#catalogo'); if (g) g.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('#sheet').addEventListener('click', onSheetClick);
  $('#sheetOverlay').addEventListener('click', closeProduct);
  $('#cartOverlay').addEventListener('click', closeCart);
  $('#drawer').addEventListener('click', onCartClick);
  $('#drawer').addEventListener('input', onCartInput);
  $('#drawer').addEventListener('change', onCartInput);
  $('#drawer').addEventListener('keydown', (e) => {
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'fCoupon') { e.preventDefault(); applyCoupon(); return; }
    if (e.key !== 'Escape') return;
    if (!$('#sheet').hidden) closeProduct();
    else if (!$('#drawer').hidden) closeCart();
  });
}

init();
})();
