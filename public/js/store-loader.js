/* Elige la versión del carrito según el envío por correo:
   - si Andreani o Correo Argentino están conectados -> carrito nuevo en dos pasos (store.js)
   - si no -> carrito anterior, como estaba (store-legacy.js) */
(async () => {
  let connected = false;
  try {
    const r = await fetch('/api/store', { cache: 'no-store' });
    const j = await r.json();
    const c = (j.settings && j.settings.carriersReady) || {};
    connected = !!(c.andreani || c.correo);
    const st = j.settings || {};
    if (st.umamiHost && st.umamiId) {
      const u = document.createElement('script');
      u.defer = true; u.src = st.umamiHost + '/script.js'; u.setAttribute('data-website-id', st.umamiId);
      document.head.appendChild(u);
    }
  } catch { /* si no responde, se usa el carrito anterior */ }
  const s = document.createElement('script');
  s.src = connected ? '/js/store.js' : '/js/store-legacy.js';
  document.body.appendChild(s);
})();
