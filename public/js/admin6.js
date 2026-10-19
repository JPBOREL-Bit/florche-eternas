(() => {
'use strict';
const FL = window.FL;
const { $, esc, api, run, toast } = FL;

FL.views.push = async function viewPush() {
  const [keyR, statusR] = await Promise.all([
    run(() => api('/api/admin/push/key')),
    fetch('/api/admin/push/status?' + new URLSearchParams({ endpoint: (await getSub()).endpoint || '' })).then(r => r.json()).catch(() => ({ count: 0, subscribed: false })),
  ]);
  if (!keyR) return;
  const sup = keyR.supported && ('serviceWorker' in navigator) && ('PushManager' in window);
  $('#view').innerHTML = `
    <div class="head"><h2>Notificaciones al celular</h2></div>
    <div class="card">
      <h3 style="margin:0 0 8px">¿Qué son?</h3>
      <p class="hint">Con las notificaciones push el panel te avisa en la pantalla de tu celular o computadora cada vez que entra un pedido nuevo o una solicitud de mayorista, aunque tengas el panel cerrado. Solo funciona en Android (Chrome) y en computadoras. <b>No funciona en iPhone.</b></p>
      ${sup
        ? `<div id="pushStatus">${pushStatusHtml(statusR)}</div>`
        : `<div class="cm-note">Tu navegador no soporta notificaciones push, o el sitio no está en HTTPS. Abrí el panel en Chrome en un Android o en una computadora.</div>`}
      ${statusR.count > 0 ? `<p class="hint" style="margin-top:8px">Dispositivos activos: <b>${statusR.count}</b></p>` : ''}
      <button class="btn sec" data-push="test" style="margin-top:12px">Probar notificación ahora</button>
    </div>
    <div class="card">
      <h3 style="margin:0 0 8px">Cómo activarlas en Android (una sola vez)</h3>
      <ol style="padding-left:20px;line-height:1.8;margin:0;font-size:.95rem">
        <li>Abrí el panel en <b>Chrome</b> en tu celular Android.</li>
        <li>Tocá el botón <b>"Activar en este celular"</b> de arriba.</li>
        <li>Cuando Chrome pregunte si querés recibir notificaciones, tocá <b>Permitir</b>.</li>
        <li>Listo. Cada pedido nuevo te llega aunque el panel esté cerrado.</li>
      </ol>
    </div>`;
};

function pushStatusHtml(s) {
  if (s.subscribed) return `<div style="display:flex;gap:10px;align-items:center;background:var(--p-soft);border-radius:12px;padding:12px 14px"><span style="font-size:1.5rem">🔔</span><div><b>Notificaciones activas en este dispositivo</b><p class="hint" style="margin:2px 0 0">Vas a recibir un aviso cada vez que entre un pedido o una solicitud de mayorista.</p></div></div>
    <button class="btn sec sm" data-push="off" style="margin-top:10px">Desactivar en este dispositivo</button>`;
  return `<button class="btn" data-push="on">Activar en este celular</button>`;
}

async function getSub() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return {};
    const sub = await reg.pushManager.getSubscription();
    return sub ? { endpoint: sub.endpoint, keys: { p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))), auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))) } } : {};
  } catch { return {}; }
}

async function registerSW() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    let reg = await navigator.serviceWorker.getRegistration('/sw-push.js');
    if (!reg) reg = await navigator.serviceWorker.register('/sw-push.js');
    await navigator.serviceWorker.ready;
    return reg;
  } catch (e) { console.error('SW:', e); return null; }
}

async function subscribe(pubKey) {
  const reg = await registerSW();
  if (!reg) { toast('No se pudo registrar el Service Worker'); return null; }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { toast('Permiso de notificaciones denegado'); return null; }
  const raw = Uint8Array.from(atob(pubKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  try {
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: raw });
    return { endpoint: sub.endpoint, keys: { p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))), auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))) } };
  } catch (e) { toast('No se pudo suscribir: ' + e.message); return null; }
}

document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-push]');
  if (!b || FL.currentTab() !== 'push') return;
  const a = b.dataset.push;
  if (a === 'test') {
    const r = await run(() => api('/api/admin/push/test', { method: 'POST' }), 'Notificación enviada');
    if (r) toast(`Enviada a ${r.sent} de ${r.total} dispositivo(s)`);
    return;
  }
  if (a === 'on') {
    const kr = await run(() => api('/api/admin/push/key'));
    if (!kr || !kr.key) return;
    const sub = await subscribe(kr.key);
    if (!sub) return;
    await run(() => api('/api/admin/push/subscribe', { method: 'POST', body: { subscription: sub } }), 'Notificaciones activadas');
    return FL.views.push();
  }
  if (a === 'off') {
    const sub = await getSub();
    if (sub.endpoint) {
      const reg = await registerSW();
      if (reg) { const s = await reg.pushManager.getSubscription(); if (s) await s.unsubscribe(); }
      await run(() => api('/api/admin/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } }), 'Notificaciones desactivadas');
    }
    return FL.views.push();
  }
});
})();
