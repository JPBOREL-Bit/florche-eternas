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
  } catch { /* si no responde, se usa el carrito anterior */ }
  const s = document.createElement('script');
  s.src = connected ? '/js/store.js' : '/js/store-legacy.js';
  document.body.appendChild(s);
})();
