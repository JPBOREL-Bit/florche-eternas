(() => {
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '$ ' + Math.round(Number(n) || 0).toLocaleString('es-AR');
const USER_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>';

let me = null;
let googleId = '';
let view = 'login';
let box = null;
let gisReady = false;
let ordersCache = null;

async function api(path, method = 'GET', body) {
  let r;
  try { r = await fetch(path, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); }
  catch { return { ok: false, message: 'No pudimos conectarnos. Probá de nuevo.' }; }
  let j = {};
  try { j = await r.json(); } catch { /* sin cuerpo */ }
  j._status = r.status;
  return j;
}
async function deviceInfo() {
  try {
    const u = navigator.userAgentData;
    if (u && u.getHighEntropyValues) { const h = await u.getHighEntropyValues(['model']); if (h.model) return h.model; }
  } catch { /* el navegador no lo informa */ }
  return '';
}
// 5492614567890 -> 261 456 7890
const showPhone = (p) => (/^549\d{10}$/.test(p || '') ? `${p.slice(3, 6)} ${p.slice(6, 9)} ${p.slice(9)}` : (p || ''));
const changed = () => document.dispatchEvent(new CustomEvent('fl:account', { detail: me }));

/* ---------- botón del encabezado ---------- */
function paintButton() {
  const top = $('#top');
  if (!top) return;
  let b = $('#acctBtn');
  if (!b) {
    const cart = $('#openCart', top);
    if (!cart) return;
    b = document.createElement('button');
    b.id = 'acctBtn'; b.type = 'button'; b.className = 'acct-btn';
    cart.parentNode.insertBefore(b, cart);
  }
  b.setAttribute('aria-label', me ? 'Mi cuenta' : 'Ingresar');
  b.innerHTML = `${USER_SVG}<span class="lbl">${me ? esc(String(me.name || 'Mi cuenta').split(' ')[0]) : 'Ingresar'}</span>`;
}

/* ---------- ventana ---------- */
const field = (id, label, input, hint) => `<div class="af" data-f="${id}"><label for="a_${id}">${label}</label>${input}${hint ? `<p class="ah">${hint}</p>` : ''}<div class="ae" hidden></div></div>`;
const text = (id, extra = '') => `<input id="a_${id}" name="${id}" type="text" ${extra}>`;
const pass = (id, auto) => `<div class="pwrap"><input id="a_${id}" name="${id}" type="password" autocomplete="${auto}"><button type="button" class="eye" data-eye="a_${id}">Ver</button></div>`;

function frame(title, body, back) {
  return `<div class="acct-ov" data-a="close-ov"></div><div class="acct-box" role="dialog" aria-modal="true" aria-labelledby="acctT">
    <div class="acct-head">${back ? `<button type="button" class="acct-back" data-a="${back}" aria-label="Volver">←</button>` : ''}<h2 id="acctT">${title}</h2><button type="button" class="acct-x" data-a="close" aria-label="Cerrar">×</button></div>
    <div class="acct-body">${body}</div></div>`;
}

const views = {
  login: () => frame('Ingresar', `
    ${googleId ? '<div id="gBtn" class="gbtn"></div><div class="sep"><span>o</span></div>' : ''}
    ${field('ident', 'Usuario o email', text('ident', 'autocomplete="username" autocapitalize="none" autocorrect="off"'))}
    ${field('password', 'Contraseña', pass('password', 'current-password'))}
    <div class="aerr" id="aerr" hidden></div>
    <button type="button" class="abtn" data-a="login">Ingresar</button>
    <div class="alinks"><button type="button" data-a="go-register">Crear cuenta</button><button type="button" data-a="go-forgot">Olvidé mi contraseña</button></div>
    <p class="anote">Para comprar no hace falta tener cuenta: es solo para que no tengas que escribir tus datos cada vez y ver tus pedidos.</p>`),
  register: () => frame('Crear cuenta', `
    ${googleId ? '<div id="gBtn" class="gbtn"></div><div class="sep"><span>o con usuario y contraseña</span></div>' : ''}
    ${field('ident', 'Usuario o Gmail', text('ident', 'autocomplete="username" autocapitalize="none" autocorrect="off"'), 'Elegí un usuario (por ejemplo mari.flores) o escribí tu Gmail.')}
    ${field('name', 'Tu nombre y apellido', text('name', 'autocomplete="name" maxlength="80"'))}
    ${field('phone', 'Tu número de WhatsApp', '<input id="a_phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="261 456 7890">', 'Lo usamos solo para escribirte por tus pedidos.')}
    ${field('password', 'Contraseña', pass('password', 'new-password'), 'Mínimo 8 caracteres.')}
    <div class="aerr" id="aerr" hidden></div>
    <button type="button" class="abtn" data-a="register">Crear cuenta</button>`, 'go-login'),
  forgot: () => frame('Recuperar contraseña', `
    <p class="anote" style="margin-top:0">Escribí tu usuario o email y tu WhatsApp. Te vamos a escribir para confirmar que sos vos y darte una contraseña temporal.</p>
    ${field('ident', 'Usuario o email', text('ident', 'autocapitalize="none" autocorrect="off"'))}
    ${field('phone', 'Tu número de WhatsApp', '<input id="a_phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="261 456 7890">')}
    <div class="aerr" id="aerr" hidden></div>
    <button type="button" class="abtn" data-a="forgot">Enviar</button>`, 'go-login'),
  forgotDone: () => frame('Listo', `<div class="adone"><div class="ok" aria-hidden="true">✓</div><p>Recibimos tu pedido. Te vamos a escribir por <b>WhatsApp</b> para ayudarte a recuperar tu cuenta.</p><button type="button" class="abtn" data-a="close">Entendido</button></div>`),
  mustChange: () => frame('Creá tu contraseña nueva', `
    <p class="anote" style="margin-top:0">Entraste con una contraseña temporal. Para seguir, elegí una contraseña nueva que solo vos conozcas.</p>
    ${field('next', 'Contraseña nueva', pass('next', 'new-password'), 'Mínimo 8 caracteres.')}
    ${field('next2', 'Repetila', pass('next2', 'new-password'))}
    <div class="aerr" id="aerr" hidden></div>
    <button type="button" class="abtn" data-a="setpass">Guardar contraseña</button>`),
  phone: () => frame('Un último paso', `
    <p class="anote" style="margin-top:0">Hola${me && me.name ? ' ' + esc(me.name.split(' ')[0]) : ''}. Dejanos tu WhatsApp para poder escribirte por tus pedidos.</p>
    ${field('name', 'Tu nombre y apellido', text('name', `maxlength="80" value="${esc(me ? me.name : '')}"`))}
    ${field('phone', 'Tu número de WhatsApp', '<input id="a_phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="261 456 7890">')}
    <div class="aerr" id="aerr" hidden></div>
    <button type="button" class="abtn" data-a="saveme">Guardar</button>`),
  me: () => frame('Mi cuenta', `
    <p class="amail">${esc(me.username || me.email || '')}${me.google ? ' · Google' : ''}</p>
    <h3>Mis datos</h3>
    ${field('name', 'Nombre y apellido', text('name', `maxlength="80" value="${esc(me.name)}"`))}
    ${field('phone', 'WhatsApp', `<input id="a_phone" name="phone" type="tel" inputmode="tel" value="${esc(showPhone(me.phone))}">`)}
    ${field('address', 'Dirección de envío (opcional)', text('address', `maxlength="200" autocomplete="street-address" value="${esc(me.address || '')}"`))}
    <div class="aerr" id="aerr" hidden></div>
    <button type="button" class="abtn" data-a="saveme">Guardar mis datos</button>
    <h3>Mis pedidos</h3><div id="aorders"><p class="anote">Cargando…</p></div>
    ${me.google ? '' : `<details class="apw"><summary>Cambiar contraseña</summary>
      ${field('current', 'Contraseña actual', pass('current', 'current-password'))}${field('next', 'Contraseña nueva', pass('next', 'new-password'), 'Mínimo 8 caracteres.')}
      <div class="aerr" id="aerr2" hidden></div><button type="button" class="abtn sec" data-a="changepass">Cambiar contraseña</button></details>`}
    <button type="button" class="abtn sec" data-a="logout" style="margin-top:14px">Cerrar sesión</button>`),
};

function render(v) {
  view = v;
  if (!box) { box = document.createElement('div'); box.id = 'acct'; document.body.appendChild(box); box.addEventListener('click', onClick); box.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { const b = $('.abtn:not(.sec)', box); if (b) b.click(); } }); }
  box.innerHTML = views[v]();
  box.hidden = false;
  document.body.classList.add('lock-acct');
  if ($('#gBtn')) mountGoogle();
  const first = $('input:not([type=hidden])', box); if (first && v !== 'me') first.focus({ preventScroll: true });
  if (v === 'me') loadOrders();
}
function close() { if (box) { box.hidden = true; box.innerHTML = ''; } document.body.classList.remove('lock-acct'); }
function open(v) {
  if (me && me.mustChange) return render('mustChange');
  if (me && me.needPhone) return render('phone');
  render(v || (me ? 'me' : 'login'));
}

function showErr(id, msg, field) {
  const e = $('#' + id, box) || $('#aerr', box);
  if (field) { const f = $(`.af[data-f="${field}"]`, box); if (f) { f.classList.add('err'); const fe = $('.ae', f); fe.textContent = msg; fe.hidden = false; const i = $('input', f); if (i) i.focus({ preventScroll: true }); return; } }
  if (e) { e.textContent = msg; e.hidden = false; }
}
function clearErr() { box.querySelectorAll('.af.err').forEach((f) => f.classList.remove('err')); box.querySelectorAll('.ae, .aerr').forEach((e) => { e.hidden = true; e.textContent = ''; }); }
const val = (id) => { const e = $('#a_' + id, box); return e ? e.value : ''; };

/* ---------- Google ---------- */
function mountGoogle() {
  const draw = () => {
    if (!window.google || !google.accounts || !google.accounts.id) return;
    if (!gisReady) { google.accounts.id.initialize({ client_id: googleId, callback: onGoogle }); gisReady = true; }
    const el = $('#gBtn'); if (el) google.accounts.id.renderButton(el, { theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', width: 300 });
  };
  if (window.google && google.accounts && google.accounts.id) return draw();
  if (!document.getElementById('gsi')) {
    const s = document.createElement('script'); s.id = 'gsi'; s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = draw; document.head.appendChild(s);
  } else setTimeout(draw, 400);
}
async function onGoogle(resp) {
  const r = await api('/api/account/google', 'POST', { credential: resp.credential, device: await deviceInfo() });
  if (!r.ok) return showErr('aerr', r.message || 'No pudimos ingresar con Google.');
  me = r.account; changed(); paintButton(); open();
}

/* ---------- acciones ---------- */
async function onClick(e) {
  const eye = e.target.closest('[data-eye]');
  if (eye) { const i = $('#' + eye.dataset.eye, box); const show = i.type === 'password'; i.type = show ? 'text' : 'password'; eye.textContent = show ? 'Ocultar' : 'Ver'; return; }
  const b = e.target.closest('[data-a]');
  if (!b) return;
  const a = b.dataset.a;
  clearErr();
  if (a === 'close' || a === 'close-ov') return close();
  if (a === 'go-login') return render('login');
  if (a === 'go-register') return render('register');
  if (a === 'go-forgot') return render('forgot');
  b.disabled = true;
  try {
    if (a === 'login') {
      const r = await api('/api/account/login', 'POST', { ident: val('ident'), password: val('password'), device: await deviceInfo() });
      if (!r.ok) return showErr('aerr', r.message || 'No pudimos ingresar.');
      me = r.account; changed(); paintButton(); open();
    } else if (a === 'register') {
      const r = await api('/api/account/register', 'POST', { ident: val('ident'), name: val('name'), phone: val('phone'), password: val('password'), device: await deviceInfo() });
      if (!r.ok) return showErr('aerr', r.message || 'No pudimos crear la cuenta.', r.field);
      me = r.account; changed(); paintButton(); close(); toast('¡Cuenta creada! Ya podés comprar con tus datos guardados.');
    } else if (a === 'forgot') {
      const r = await api('/api/account/forgot', 'POST', { ident: val('ident'), phone: val('phone') });
      if (!r.ok) return showErr('aerr', r.message || 'No se pudo enviar.', r.field);
      render('forgotDone');
    } else if (a === 'setpass') {
      if (val('next') !== val('next2')) return showErr('aerr', 'Las contraseñas no coinciden.', 'next2');
      const r = await api('/api/account/password', 'POST', { next: val('next') });
      if (!r.ok) return showErr('aerr', r.message || 'No se pudo guardar.', r.field);
      me = r.account; changed(); paintButton(); close(); toast('Contraseña nueva guardada.');
    } else if (a === 'saveme') {
      const r = await api('/api/account/me', 'PUT', { name: val('name'), phone: val('phone'), address: val('address') });
      if (!r.ok) return showErr('aerr', r.message || 'No se pudo guardar.', r.field);
      const wasPhone = view === 'phone';
      me = r.account; changed(); paintButton();
      if (wasPhone) { close(); toast('¡Listo! Ya podés comprar con tus datos guardados.'); } else toast('Datos guardados.');
    } else if (a === 'changepass') {
      const r = await api('/api/account/password', 'POST', { current: val('current'), next: val('next') });
      if (!r.ok) return showErr('aerr2', r.message || 'No se pudo cambiar.', r.field);
      me = r.account; toast('Contraseña cambiada.'); render('me');
    } else if (a === 'logout') {
      await api('/api/account/logout', 'POST'); me = null; ordersCache = null; changed(); paintButton(); close(); toast('Cerraste sesión.');
    }
  } finally { b.disabled = false; }
}

async function loadOrders() {
  const r = await api('/api/account/orders');
  const el = $('#aorders', box);
  if (!el) return;
  if (!r.ok || !r.orders.length) { el.innerHTML = '<p class="anote">Todavía no tenés pedidos hechos con tu cuenta.</p>'; return; }
  const lab = { pendiente: ['En proceso', 'p'], realizada: ['Confirmado', 'ok'], rechazada: ['Rechazado', 'x'] };
  el.innerHTML = r.orders.map((o) => {
    const [t, c] = lab[o.status] || [o.status, 'p'];
    const items = o.items.length ? o.items.map((i) => `${i.qty} × ${esc(i.name)}`).join(', ') : 'Pedido rechazado';
    return `<div class="aord"><div class="ah2"><b>Pedido #${o.id}</b><span class="st ${c}">${t}</span></div>${o.paid ? '<div class="am" style="color:var(--ok);font-weight:700">✓ Pagado con Mercado Pago</div>' : ''}<div class="am">${new Date(o.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })} · ${money(o.total)}</div><div class="ai">${items}</div></div>`;
  }).join('');
}

function toast(msg) {
  const t = $('#toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3200);
}

/* ---------- arranque ---------- */
async function init() {
  const r = await api('/api/account/me');
  me = r.account || null; googleId = r.google || '';
  paintButton();
  new MutationObserver(paintButton).observe($('#top') || document.body, { childList: true });
  document.addEventListener('click', (e) => {
    if (e.target.closest('#acctBtn')) return open();
    const b = e.target.closest('[data-acct]'); if (b) { const d = $('#drawer'); open(b.dataset.acct); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && box && !box.hidden) { e.stopPropagation(); close(); } }, true);
  changed();
  if (me && me.mustChange) open();   // si entró con una contraseña temporal, no puede seguir sin cambiarla
}
window.FLAccount = { open, get me() { return me; } };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
