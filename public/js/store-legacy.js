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
let form = Object.assign({ name: '', phone: '', delivery: 'envio', cp: '', address: '', coupon: '', needed: '' }, load('fl_form2', {}));
let query = '';                            // texto del buscador
let sortBy = 'default';                     // orden del catálogo
let sending = false;
let carriers = null;                       // { cp, loading, options, errors, message }
let shipOpt = 'own';                       // 'own' (envío propio) o el id de una opción de correo
let carTimer = null, cpTimer = null;
const carReady = () => { const c = S().carriersReady || {}; return !!(c.andreani || c.correo); };
const carrierOption = () => (shipOpt !== 'own' && carriers && carriers.options ? carriers.options.find((o) => o.id === shipOpt) || null : null);
let ship = null;                           // { ok, cp, km, cost } | { ok:false, ... } | { loading:true }
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
  const T = totals();
  const hint = S().progressOn && T.t.next ? ` Te faltan ${money(T.t.next.at - T.subtotal)} para ${P.tierLabel(T.t.next).toLowerCase()}.` : '';
  toast('Agregado al carrito.' + (p.lead_hours > 0 ? ` Recordá: se pide con ${leadText(p.lead_hours)} de anticipación.` : '') + hint);
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
  if (carReady() && form.delivery === 'envio' && /^\d{4}$/.test(form.cp.trim())) { carriers = null; scheduleCarriers(); }
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
  renderProg(); renderItems(); renderCoupon(); renderCartFoot(); renderDateHint();
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

const cartLeadHours = () => Math.max(0, ...view().map((x) => Number(x.p.lead_hours) || 0));
const minNeeded = () => isoDate(earliestFrom(cartLeadHours()));
function renderDateHint() {
  const el = $('#dateHint');
  if (!el) return;
  const h = cartLeadHours();
  const min = minNeeded();
  const inp = $('#fDate');
  if (inp) inp.min = min;
  let html = h > 0 ? `Tu pedido necesita al menos <b>${leadText(h)}</b> de anticipación: la fecha más próxima es <b>${whenLabel(earliestFrom(h))}</b>.` : '';
  if (form.needed && form.needed < min) html += `<div class="ferr">Esa fecha es muy pronto. Elegí una desde ${whenLabel(earliestFrom(h))}.</div>`;
  el.innerHTML = html;
}

// Cuando la clienta ingresa a su cuenta, se completan solos sus datos (sin pisar lo que ya escribió)
document.addEventListener('fl:account', (e) => {
  const a = e.detail;
  if (!a || a.mustChange) return;
  const ph = /^549\d{10}$/.test(a.phone || '') ? `${a.phone.slice(3, 6)} ${a.phone.slice(6, 9)} ${a.phone.slice(9)}` : (a.phone || '');
  let ch = false;
  if (!form.name && a.name) { form.name = a.name; ch = true; }
  if (!form.phone && ph) { form.phone = ph; ch = true; }
  if (!form.address && a.address) { form.address = a.address; ch = true; }
  if (ch) { persistForm(); if ($('#drawer') && !$('#drawer').hidden && cart.length) renderCart(); }
});

function renderForm() {
  setTimeout(() => { if (form.delivery === 'envio' && /^\d{4}$/.test(form.cp.trim()) && carReady() && !carriers) calcCarriers(); }, 0);
  const el = $('#cForm');
  if (!el) return;
  const s = S();
  const envio = form.delivery === 'envio';
  el.innerHTML = `<div class="form">
    <h3>Tus datos</h3>
    ${window.FLAccount && !window.FLAccount.me ? '<p class="hint acct-nudge">¿Ya tenés cuenta? <button type="button" data-acct="login">Ingresá</button> y completamos tus datos.</p>' : ''}
    <div class="field"><label class="l" for="fName">Nombre</label><input id="fName" type="text" autocomplete="name" value="${esc(form.name)}"></div>
    <div class="field"><label class="l" for="fPhone">Tu WhatsApp</label><input id="fPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="Ej: 261 456 7890" value="${esc(form.phone)}"><p class="hint">Te escribimos por ahí para terminar el pedido.</p></div>
    <div class="field"><label class="l">¿Cómo lo recibís?</label>
      <label class="opt ${envio ? 'on' : ''}"><input type="radio" name="deliv" value="envio" ${envio ? 'checked' : ''}><span><b>Envío a domicilio</b><br><small>Mendoza. Calculamos un costo estimado con tu código postal.</small></span></label>
      ${s.allowPickup ? `<label class="opt ${!envio ? 'on' : ''}"><input type="radio" name="deliv" value="retiro" ${!envio ? 'checked' : ''}><span><b>${esc(s.pickupText || 'Retiro en persona')}</b></span></label>` : ''}
    </div>
    ${envio ? `
    <div class="field"><label class="l" for="fCp">Código postal</label>
      <div class="cprow"><input id="fCp" type="text" inputmode="numeric" maxlength="4" placeholder="Ej: 5539" value="${esc(form.cp)}"><button class="btn ghost" type="button" data-cact="ship">Calcular envío</button></div>
      <div id="shipMsg">${shipMsgHtml()}</div>
    </div>
    <div id="carrierOpts"></div>
    <div class="field"><label class="l" for="fAddr">Dirección (calle, número, barrio)</label><input id="fAddr" type="text" autocomplete="street-address" value="${esc(form.address)}"></div>` : ''}
    <div class="field"><label class="l" for="fDate">¿Para cuándo lo necesitás? <span class="opt-tag">(opcional)</span></label><input id="fDate" type="date" value="${esc(form.needed)}" min="${minNeeded()}"><div class="hint" id="dateHint"></div></div>
  </div>`;
  renderDateHint();
  renderCarriers();
}

function shipMsgHtml() {
  const s = S();
  if (!ship) return '';
  if (ship.loading) return '<div class="ship-msg" style="color:var(--muted)">Calculando…</div>';
  if (ship.ok) return `<div class="ship-msg ok">${ship.label ? esc(ship.label) + ' · ' : ''}A unos ${ship.km} km. Envío estimado <b>${money(ship.cost)}</b>.<br><small style="color:var(--muted)">${esc(s.shippingNote || '')}</small></div>`;
  if (ship.reason === 'outside' && carReady()) return '<div class="ship-msg ok">Ese código postal está fuera de Mendoza: lo enviamos por correo. Elegí abajo cómo.</div>';
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
  const cOpt = envio ? carrierOption() : null;
  const cCost = cOpt ? (T.freeShip ? 0 : cOpt.price) : null;
  el.innerHTML = `
    ${hasDisc ? `<div class="sum"><span>Productos</span><span>${money(T.subtotal)}</span></div>` : ''}
    ${T.t.discount > 0 ? `<div class="sum disc"><span>Promo: ${esc(P.tierLabel(T.t.applied))}</span><span>-${money(T.t.discount)}</span></div>` : ''}
    ${T.cOk && T.cDisc > 0 ? `<div class="sum disc"><span>Cupón ${esc(couponRes.code)}</span><span>-${money(T.cDisc)}</span></div>` : ''}
    ${extra.map((b) => `<div class="sum disc"><span>${esc(b)}</span><span></span></div>`).join('')}
    <div class="sum total"><span>${cOpt ? 'Productos' : 'Total'}</span><b>${money(T.total)}</b></div>
    ${cOpt ? `<div class="sum"><span>Envío ${esc(cOpt.carrier)} · ${esc(cOpt.service)}</span><span>${cCost === 0 ? 'Gratis' : money(cCost)}</span></div><div class="sum total"><span>Total con envío</span><b>${money(T.total + cCost)}</b></div>` : (envio ? `<div class="sum"><span>Envío estimado · no incluido</span><span>${shipTxt}</span></div>` : '')}
    <button class="btn" data-cact="send" style="margin-top:6px" ${sending ? 'disabled' : ''}>${sending ? 'Mandando…' : 'Mandar pedido'}</button>
    ${S().payReady ? `<button class="btn wa" data-cact="pay" style="margin-top:8px" ${sending ? 'disabled' : ''}>Terminar pedido (pagar con Mercado Pago)</button>` : ''}
    <p class="small">${S().payReady ? (cOpt ? '"Mandar pedido" lo guarda y te escribimos por WhatsApp para coordinar el pago. "Terminar pedido" te lleva a pagar los productos y el envío con Mercado Pago.' : '"Mandar pedido" lo guarda y te escribimos por WhatsApp para terminar todo. "Terminar pedido" te lleva a pagar los productos con Mercado Pago: el envío no está incluido y se coordina aparte por WhatsApp.') : 'Después de mandarlo, te escribimos por WhatsApp para confirmar todo.'}</p>`;
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

/* ---------- envío por correo (Andreani / Correo Argentino) ---------- */
function autoPickCarrier() {
  // Fuera de Mendoza no hay envío propio: se deja elegida la opción de correo más barata
  if (ship && ship.reason === 'outside' && carriers && carriers.options && carriers.options.length && !carrierOption()) shipOpt = carriers.options[0].id;
}
async function calcCarriers() {
  if (!carReady() || form.delivery !== 'envio') return;
  const cp = form.cp.trim();
  if (!/^\d{4}$/.test(cp) || !cart.length) { carriers = null; renderCarriers(); return; }
  carriers = { cp, loading: true, options: [], errors: [] }; renderCarriers();
  let j;
  try {
    const r = await fetch('/api/shipping/carriers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cp, items: couponItems() }) });
    j = await r.json();
  } catch { j = { ok: false, message: 'No pudimos consultar los correos ahora.' }; }
  if (form.cp.trim() !== cp) return;
  carriers = { cp, loading: false, options: j.ok ? j.options : [], errors: j.ok ? j.errors : [], message: j.ok ? '' : j.message };
  if (shipOpt !== 'own' && !carrierOption()) shipOpt = 'own';
  autoPickCarrier();
  renderCarriers(); renderCartFoot();
}
const scheduleCarriers = () => { clearTimeout(carTimer); carTimer = setTimeout(calcCarriers, 400); };
function renderCarriers() {
  const el = $('#carrierOpts');
  if (!el) return;
  if (!carReady() || form.delivery !== 'envio' || !carriers) { el.innerHTML = ''; return; }
  if (carriers.loading) { el.innerHTML = '<div class="ship-msg" style="color:var(--muted)">Buscando precios de envío por correo…</div>'; return; }
  const T = totals();
  const rows = [];
  if (ship && ship.ok) {
    const c = T.freeShip ? 'Gratis' : money(ship.cost);
    rows.push(`<label class="opt ${shipOpt === 'own' ? 'on' : ''}"><input type="radio" name="shipopt" value="own" ${shipOpt === 'own' ? 'checked' : ''}><span><b>Envío propio (Mendoza)</b><br><small>Lo coordinamos por WhatsApp</small></span><b class="opr">${c}</b></label>`);
  }
  for (const o of carriers.options) {
    const svc = String(o.service || '').split(' · ')[0];   // 'A sucursal' / 'A domicilio' (el nombre del correo ya está en la marca)
    rows.push(`<label class="opt ${shipOpt === o.id ? 'on' : ''}"><input type="radio" name="shipopt" value="${esc(o.id)}" ${shipOpt === o.id ? 'checked' : ''}><span><b>${esc(o.carrier)} · ${esc(svc)}</b><br><small>${o.days ? esc(o.days) + ' · ' : ''}Se paga junto con el pedido${o.note ? ' · ' + esc(o.note) : ''}</small></span><b class="opr">${T.freeShip ? 'Gratis' : money(o.price)}</b></label>`);
  }
  let msg = '';
  if (!carriers.options.length) msg = carriers.message || (carriers.errors.length ? 'No pudimos consultar los correos ahora. Probá de nuevo en un rato.' : 'No hay envíos por correo disponibles para ese código postal.');
  else if (carriers.errors.length) msg = `No pudimos consultar ${carriers.errors.join(' ni ')} ahora.`;
  el.innerHTML = `<div class="field"><label class="l">¿Cómo lo enviamos?</label>${rows.join('')}${msg ? `<div class="ship-msg warn">${esc(msg)}</div>` : ''}</div>`;
}

/* ---------- envío estimado ---------- */
async function calcShip() {
  const cp = form.cp.trim();
  const box = $('#shipMsg');
  // Si el formulario no está en pantalla (por ejemplo, justo después de mandar el pedido), no hay nada que dibujar.
  if (!box) return;
  if (!/^\d{4}$/.test(cp)) { ship = { ok: false, reason: 'invalid', cp, message: 'Ingresá un código postal de 4 números.' }; box.innerHTML = shipMsgHtml(); return; }
  ship = { loading: true, cp };
  box.innerHTML = shipMsgHtml();
  calcCarriers();
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
  autoPickCarrier();
  renderCarriers();
  renderCartFoot();
}

/* ---------- eventos del carrito ---------- */
function onCartInput(e) {
  const t = e.target;
  if (t.id === 'fName') form.name = t.value;
  else if (t.id === 'fAddr') form.address = t.value;
  else if (t.id === 'fPhone') form.phone = t.value;
  else if (t.id === 'fDate') { form.needed = t.value; renderDateHint(); }
  else if (t.id === 'fCoupon') { t.value = t.value.toUpperCase().replace(/\s+/g, ''); return; }
  else if (t.id === 'fCp') {
    t.value = t.value.replace(/\D/g, '').slice(0, 4);
    form.cp = t.value;
    if (ship && ship.cp !== form.cp) { ship = null; carriers = null; shipOpt = 'own'; const b = $('#shipMsg'); if (b) b.innerHTML = ''; renderCarriers(); renderCartFoot(); }
    if (/^\d{4}$/.test(form.cp)) { clearTimeout(cpTimer); cpTimer = setTimeout(calcShip, 500); }
  } else if (t.name === 'shipopt' && e.type === 'change') {
    shipOpt = t.value; renderCarriers(); renderCartFoot();
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
  if (a === 'pay') return sendOrder(true);
  if (a === 'cpnopen') { couponOpen = true; renderCoupon(); const i = $('#fCoupon'); if (i) i.focus(); return; }
  if (a === 'applycoupon') return applyCoupon();
  if (a === 'rmcoupon') { form.coupon = ''; couponRes = null; couponOpen = false; couponMsg = ''; couponReq++; persistForm(); renderCoupon(); renderCartFoot(); return; }
  if (a === 'inc' && item) item.qty = Math.min(99, item.qty + 1);
  else if (a === 'dec' && item) { item.qty -= 1; if (item.qty <= 0) cart = cart.filter((c) => c !== item); }
  else if (a === 'rm' && item) cart = cart.filter((c) => c !== item);
  else if (a === 'clear') { askClearCart(); return; }
  else return;
  cartChanged();
}

/* ---------- pedido por WhatsApp ---------- */
function showDone(sh) {
  $('#drawer').innerHTML = `<button class="drawer-close" data-cact="close" aria-label="Cerrar">×</button>
    <div class="drawer-head"><h2>¡Pedido enviado!</h2></div>
    <div class="drawer-body"><div class="done"><div class="ok" aria-hidden="true">✓</div>
      <h3>Tu pedido ya fue mandado</h3>
      <p>Nos comunicamos por <b>WhatsApp</b> al <b>${esc(form.phone)}</b> para terminar con todo.</p>
      ${sh ? `<p>El envío con <b>${esc(sh.carrier)}</b> (${sh.cost === 0 ? 'gratis' : money(sh.cost)}) se paga junto con el pedido: te escribimos para coordinar el pago.</p>` : ''}
      <p class="small">Ahí confirmamos tu pedido, el envío y cómo seguimos.</p></div></div>
    <div class="drawer-foot"><button class="btn" data-cact="close">Seguir mirando</button></div>`;
}

let lastOrder = null;   // pedido mandado en esta visita: { id, token }

async function sendOrder(thenPay) {
  if (!cart.length || sending) return;
  const focus = (id) => { const i = $(id); if (i) i.focus(); };
  if (!form.name.trim()) { toast('Escribí tu nombre'); return focus('#fName'); }
  if (form.phone.replace(/\D/g, '').length < 8) { toast('Escribí tu número de WhatsApp'); return focus('#fPhone'); }
  if (form.delivery === 'envio') {
    if (!/^\d{4}$/.test(form.cp.trim())) { toast('Ingresá tu código postal'); return focus('#fCp'); }
    if (ship && ship.reason === 'outside' && !(carReady() && carrierOption())) { toast(carReady() ? 'Elegí cómo querés que lo enviemos' : 'Solo enviamos dentro de Mendoza'); return; }
    if (shipOpt !== 'own' && !carrierOption()) { toast('Esperá un segundo: estamos calculando el envío'); return; }
    if (!form.address.trim()) { toast('Escribí tu dirección'); return focus('#fAddr'); }
  }
  if (form.needed && form.needed < minNeeded()) { toast('Elegí otra fecha: tus productos necesitan más anticipación'); return focus('#fDate'); }
  if (form.coupon && couponBusy) { toast('Verificando el cupón, esperá un segundo'); return; }

  const T = totals();
  const payload = {
    name: form.name.trim(), phone: form.phone, items: couponItems(), coupon: T.cOk ? couponRes.code : '', token: orderToken,
    delivery: form.delivery, cp: form.cp, address: form.address, neededFor: form.needed || '',
    shipEstimate: form.delivery === 'envio' && ship && ship.ok && !T.freeShip && !carrierOption() ? ship.cost : null,
    shipOpt: form.delivery === 'envio' && carrierOption() ? shipOpt : '', vid, sid,
  };
  sending = true; renderCartFoot();
  let res;
  try {
    const r = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    res = await r.json();
  } catch { res = { ok: false, message: 'No pudimos conectarnos. Probá de nuevo.' }; }
  sending = false;
  if (!res.ok) { toast(res.message || 'No se pudo mandar el pedido'); renderCartFoot(); if (res.field === 'phone') focus('#fPhone'); return; }
  persistForm();
  lastOrder = { id: res.id, token: orderToken };
  if (thenPay) return payOrder(lastOrder);
  const shDone = carrierOption() && res.shipCost !== null && res.shipCost !== undefined ? { carrier: carrierOption().carrier, cost: res.shipCost } : null;
  cart = []; orderToken = uid(); persist(); renderCartBadge();
  carriers = null; shipOpt = 'own';
  track('order_sent', null, null, { delivery: form.delivery });
  showDone(shDone);
}

async function payOrder(o) {
  sending = true; renderCartFoot();
  let r;
  try {
    const x = await fetch(`/api/orders/${o.id}/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: o.token }) });
    r = await x.json();
  } catch { r = { ok: false, message: 'No pudimos conectarnos. Probá de nuevo.' }; }
  sending = false;
  if (r.paid) { cart = []; orderToken = uid(); persist(); renderCartBadge(); return toast(r.message); }
  if (!r.ok || !r.url) { toast(r.message || 'No pudimos abrir el pago.'); renderCartFoot(); return; }
  cart = []; orderToken = uid(); persist(); renderCartBadge();
  location.href = r.url;     // a Mercado Pago
}

/* Al volver de Mercado Pago: se muestra el resultado. La confirmación real llega por el aviso de Mercado Pago. */
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

/* ---------- eventos globales ---------- */
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
