(() => {
'use strict';
const FL = window.FL;
const { $, esc, api, run, toast } = FL;

let data = { accounts: [], resets: [] };
let search = '';
const shown = {};       // contraseñas temporales recién creadas (se ven hasta marcar Finalizado)
const creating = {};    // solicitudes con la cajita de "crear contraseña" abierta

const fdate = (iso) => (iso ? new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const fdt = (iso) => (iso ? new Date(iso).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'nunca');
const TEMP = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const suggest = () => { const a = new Uint32Array(10); crypto.getRandomValues(a); return Array.from(a, (n) => TEMP[n % TEMP.length]).join(''); };
const waLink = (phone, msg) => `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;

const st = document.createElement('style');
st.textContent = `
.acx { border:1.5px solid var(--line); border-radius:14px; padding:12px; margin-bottom:10px; background:#fff; }
.acx.warn { border-color:#e0a526; background:#fffaf0; }
.acx .ahd { display:flex; justify-content:space-between; gap:8px; align-items:center; flex-wrap:wrap; }
.acx .am { font-size:.86rem; color:var(--muted); margin:4px 0; line-height:1.5; }
.acx .am b { color:var(--ink); }
.acx .bad { color:var(--bad); font-weight:600; }
.tmpbox { background:#f3eef2; border-radius:12px; padding:10px; margin-top:8px; }
.tmpbox .pw { font:700 1.25rem/1.2 ui-monospace,Menlo,monospace; letter-spacing:.04em; user-select:all; background:#fff; border:1.5px dashed var(--p); border-radius:10px; padding:10px; text-align:center; margin:6px 0; }
`;
document.head.appendChild(st);

function setBadge(n) { const el = $('#tabAccN'); if (el) { el.textContent = n || ''; el.hidden = !n; } }

function resetHtml(r) {
  const pend = r.status === 'pendiente';
  const phoneMatch = r.acc_phone && r.acc_phone === r.phone;
  return `<div class="acx ${pend ? 'warn' : ''}" data-reset="${r.id}">
    <div class="ahd"><b>${esc(r.ident)}</b><span class="badge ${pend ? 'warn' : 'ok'}">${pend ? 'Pendiente' : 'Contraseña creada'}</span></div>
    <div class="am">Pidió ayuda el ${esc(fdt(r.created_at))}<br>
      WhatsApp que escribió: <b>+${esc(r.phone || '')}</b> <a class="btn sec sm" target="_blank" rel="noopener" href="${esc(waLink(r.phone, 'Hola' + (r.name ? ' ' + String(r.name).split(' ')[0] : '') + ', te escribimos por tu pedido de ayuda con la contraseña. ¿Sos vos?'))}">Escribirle</a><br>
      ${r.account_id
        ? `Cuenta encontrada: <b>${esc(r.name || '—')}</b> (${esc(r.username || r.email || '')}), creada el ${esc(fdate(r.acc_created))}. Número registrado: <b>+${esc(r.acc_phone || 'ninguno')}</b> ${phoneMatch ? '<span style="color:var(--ok);font-weight:600">· coincide</span>' : '<span class="bad">· NO coincide con el que escribió</span>'}${r.acc_status !== 'activa' ? '<br><span class="bad">La cuenta está bloqueada.</span>' : ''}`
        : '<span class="bad">No se encontró ninguna cuenta con ese usuario o email.</span>'}</div>
    ${creating[r.id] ? `<div class="tmpbox"><label style="font-size:.85rem;font-weight:600">Contraseña temporal (mínimo 8 caracteres)</label>
      <input type="text" data-tmp="${r.id}" value="${esc(creating[r.id])}" style="width:100%;margin:6px 0" autocomplete="off">
      <div class="acts" style="justify-content:flex-start"><button class="btn sm" data-x="savepw" data-id="${r.id}">Guardar contraseña temporal</button><button class="btn sec sm" data-x="newpw" data-id="${r.id}">Otra al azar</button></div></div>` : ''}
    ${shown[r.id] ? `<div class="tmpbox"><b>Contraseña temporal creada</b>
      <div class="pw">${esc(shown[r.id])}</div>
      <p class="hint" style="margin:0 0 8px">Pasásela por WhatsApp. Cuando entre, el sistema le pide crear una nueva. Después volvé acá y tocá <b>Finalizado</b>.</p>
      <a class="btn sm" target="_blank" rel="noopener" href="${esc(waLink(r.acc_phone || r.phone, `Hola${r.name ? ' ' + String(r.name).split(' ')[0] : ''}, tu contraseña temporal es: ${shown[r.id]}\nAl entrar te va a pedir que crees una nueva.`))}">Abrir WhatsApp con la contraseña</a></div>` : ''}
    <div class="acts" style="justify-content:flex-start;margin-top:10px">
      <button class="btn danger sm" data-x="reject" data-id="${r.id}">Rechazar</button>
      ${r.account_id ? `<button class="btn okb sm" data-x="create" data-id="${r.id}">Crear contraseña</button>` : ''}
      <button class="btn sec sm" data-x="done" data-id="${r.id}">Finalizado</button>
    </div></div>`;
}

function accountHtml(a) {
  const ident = [a.username, a.email].filter(Boolean).join(' · ');
  const blocked = a.status !== 'activa';
  return `<div class="acx" style="${blocked ? 'opacity:.75' : ''}">
    <div class="ahd"><b>${esc(a.name || '(sin nombre)')}</b><span>${a.google ? '<span class="badge">Google</span> ' : ''}<span class="badge ${blocked ? 'warn' : 'ok'}">${blocked ? 'Bloqueada' : 'Activa'}</span></span></div>
    <div class="am">${esc(ident)}<br>
      WhatsApp: ${a.phone ? `<b>+${esc(a.phone)}</b> <a class="btn sec sm" target="_blank" rel="noopener" href="https://wa.me/${esc(a.phone)}">Escribirle</a>` : '<span class="bad">sin cargar</span>'}<br>
      Cuenta creada: <b>${esc(fdate(a.created_at))}</b> desde <b>${esc(a.device || '—')}</b><br>
      Último ingreso: ${esc(fdt(a.last_login))}${a.last_device && a.last_device !== a.device ? ` desde ${esc(a.last_device)}` : ''}<br>
      Pedidos con su cuenta: <b>${a.orders}</b></div>
    <div class="acts" style="justify-content:flex-start">
      <button class="btn ${blocked ? 'okb' : 'sec'} sm" data-x="block" data-id="${a.id}" data-b="${blocked ? 0 : 1}">${blocked ? 'Desbloquear' : 'Bloquear usuario'}</button>
      <button class="btn danger sm" data-x="del" data-id="${a.id}">Eliminar cuenta</button>
    </div></div>`;
}

function draw() {
  const q = search.trim().toLowerCase();
  const list = data.accounts.filter((a) => !q || [a.name, a.username, a.email, a.phone].some((x) => String(x || '').toLowerCase().includes(q)));
  setBadge(data.resets.filter((r) => r.status === 'pendiente').length);
  $('#view').innerHTML = `
    <div class="head"><h2>Cuentas de clientes</h2></div>
    <p class="hint" style="margin:-6px 0 12px">Las clientas no necesitan cuenta para comprar. La cuenta les guarda sus datos y sus pedidos.</p>
    <h3 style="margin:0 0 8px">Solicitudes de contraseña (${data.resets.length})</h3>
    ${data.resets.length ? data.resets.map(resetHtml).join('') : '<div class="card"><p class="hint" style="margin:0">No hay solicitudes. Cuando alguien toque "Olvidé mi contraseña" aparece acá con su número.</p></div>'}
    <h3 style="margin:20px 0 8px">Cuentas (${data.accounts.length})</h3>
    <input type="search" id="accQ" placeholder="Buscar por nombre, usuario, email o teléfono" value="${esc(search)}" style="width:100%;margin-bottom:10px">
    ${list.length ? list.map(accountHtml).join('') : '<div class="card"><p class="hint" style="margin:0">No hay cuentas que mostrar.</p></div>'}`;
}

FL.views.accounts = async function viewAccounts() {
  const [a, r] = await Promise.all([run(() => api('/api/admin/accounts')), run(() => api('/api/admin/resets'))]);
  if (!a || !r) return;
  data = { accounts: a.accounts, resets: r.resets };
  draw();
};

document.addEventListener('input', (e) => {
  if (e.target.id === 'accQ' && FL.currentTab() === 'accounts') { search = e.target.value; const pos = e.target.selectionStart; draw(); const i = $('#accQ'); i.focus(); i.setSelectionRange(pos, pos); }
  if (e.target.dataset && e.target.dataset.tmp) creating[e.target.dataset.tmp] = e.target.value;
});

document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-x]');
  if (!b || FL.currentTab() !== 'accounts') return;
  const x = b.dataset.x, id = b.dataset.id;
  if (x === 'create') { creating[id] = creating[id] ? '' : suggest(); if (!creating[id]) delete creating[id]; return draw(); }
  if (x === 'newpw') { creating[id] = suggest(); return draw(); }
  if (x === 'savepw') {
    const pw = (creating[id] || '').trim();
    const r = await run(() => api(`/api/admin/resets/${id}/password`, { method: 'POST', body: { password: pw } }));
    if (r) { shown[id] = r.password; delete creating[id]; toast('Contraseña temporal creada'); }
    return FL.views.accounts();
  }
  if (x === 'reject') {
    if (!confirm('¿Rechazar esta solicitud? Se borra y listo.')) return;
    await run(() => api(`/api/admin/resets/${id}`, { method: 'DELETE' }), 'Solicitud rechazada');
    delete shown[id]; delete creating[id]; return FL.views.accounts();
  }
  if (x === 'done') {
    if (!shown[id] && !confirm('Todavía no creaste una contraseña temporal para esta solicitud. ¿Marcarla como finalizada igual?')) return;
    await run(() => api(`/api/admin/resets/${id}/done`, { method: 'POST' }), 'Solicitud finalizada');
    delete shown[id]; delete creating[id]; return FL.views.accounts();
  }
  if (x === 'block') {
    const blocking = b.dataset.b === '1';
    if (blocking && !confirm('¿Bloquear a este usuario? Se le cierra la sesión y no puede volver a entrar hasta que lo desbloquees.')) return;
    await run(() => api(`/api/admin/accounts/${id}/block`, { method: 'PUT', body: { blocked: blocking } }), blocking ? 'Usuario bloqueado' : 'Usuario desbloqueado');
    return FL.views.accounts();
  }
  if (x === 'del') {
    if (!confirm('¿Eliminar esta cuenta? Sus pedidos quedan en Pedidos, pero la cuenta no se puede recuperar.')) return;
    await run(() => api(`/api/admin/accounts/${id}`, { method: 'DELETE' }), 'Cuenta eliminada');
    return FL.views.accounts();
  }
});

/* ---- aviso de solicitud de contraseña nueva ---- */
function beep() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [520, 700].forEach((f, i) => { const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + i * 0.2; o.frequency.value = f; o.connect(g); g.connect(ac.destination); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); o.start(t); o.stop(t + 0.2); });
  } catch (e) { /* sin sonido */ }
}
function showAlert(n) {
  let bar = $('#accAlert');
  if (!bar) { bar = document.createElement('div'); bar.id = 'accAlert'; bar.className = 'alertbar'; bar.style.top = '134px'; document.body.appendChild(bar); }
  bar.innerHTML = `<div><b>Una clienta olvidó su contraseña</b><span>${esc(n.ident)}</span></div><button class="btn sm" id="accGo">Ver</button><button class="x" id="accX" aria-label="Cerrar">×</button>`;
  bar.hidden = false;
  $('#accGo').onclick = () => { bar.hidden = true; FL.setTab('accounts'); };
  $('#accX').onclick = () => { bar.hidden = true; };
}
async function poll() {
  if (!localStorage.getItem('fl_admin')) return;
  try {
    const seen = localStorage.getItem('fl_acc_seen');
    const r = await api('/api/admin/accounts/poll?after=' + (seen === null ? 0 : Number(seen)));
    setBadge(r.pending);
    if (seen === null) { localStorage.setItem('fl_acc_seen', r.max); return; }
    if (r.news.length) {
      localStorage.setItem('fl_acc_seen', r.news[r.news.length - 1].id);
      showAlert(r.news[r.news.length - 1]); beep();
      if (FL.currentTab() === 'accounts') FL.views.accounts();
    }
  } catch (e) { /* se reintenta en 15 segundos */ }
}
const prevReady = FL.onReady;
FL.onReady = () => { if (prevReady) prevReady(); poll(); setInterval(() => { if (!document.hidden) poll(); }, 15000); };
})();

