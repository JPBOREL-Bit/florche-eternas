'use strict';
// Páginas legales públicas. Los datos del negocio salen de Mi tienda (razón social, CUIT, domicilio, email).
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function page(title, body, s) {
  const who = s.legalName || s.storeName || 'la tienda';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · ${esc(s.storeName || '')}</title>
<link rel="stylesheet" href="/css/store.css">
<style>.legal-doc{max-width:760px;margin:24px auto;padding:0 18px;line-height:1.6;color:#333}.legal-doc h1{font-size:1.6rem}.legal-doc h2{font-size:1.1rem;margin-top:22px}.legal-doc a{color:var(--p-dark)}</style>
</head><body><div class="legal-doc"><p><a href="/">← Volver a la tienda</a></p><h1>${esc(title)}</h1>${body}
<hr><p class="small">${esc(who)}${s.legalCuit ? ' · CUIT ' + esc(s.legalCuit) : ''}${s.legalAddress ? ' · ' + esc(s.legalAddress) : ''}${s.legalEmail ? ' · ' + esc(s.legalEmail) : ''}</p></div></body></html>`;
}

function mount({ app, getSettings }) {
  const contact = (s) => (s.legalEmail ? `<a href="mailto:${esc(s.legalEmail)}">${esc(s.legalEmail)}</a>` : 'por WhatsApp');
  const wa = (s) => (s.whatsapp ? ` o por WhatsApp al <a href="https://wa.me/${esc(s.whatsapp)}">+${esc(s.whatsapp)}</a>` : '');

  app.get('/terminos', async (req, res) => {
    const s = await getSettings();
    res.type('html').send(page('Términos y condiciones', `
<p>Estos términos regulan la compra de productos en ${esc(s.storeName)} a través de este sitio. Al hacer un pedido, aceptás estas condiciones.</p>
<h2>1. Quién vende</h2>
<p>${esc(s.legalName || s.storeName)}${s.legalCuit ? ', CUIT ' + esc(s.legalCuit) : ''}${s.legalAddress ? ', domicilio ' + esc(s.legalAddress) : ''}. Contacto: ${contact(s)}${wa(s)}.</p>
<h2>2. Productos</h2>
<p>Los productos son flores de cinta de raso hechas a mano. Pueden tener pequeñas diferencias de color, forma o terminación entre una pieza y otra, propias de la artesanía. Las fotos son orientativas.</p>
<h2>3. Pedidos, precios y pagos</h2>
<p>Los precios están en pesos argentinos e incluyen los impuestos que correspondan. Al mandar un pedido, se registra y nos comunicamos por WhatsApp para confirmarlo. Los pagos online se procesan a través de Mercado Pago; la tienda no guarda datos de tarjetas.</p>
<h2>4. Tiempos de elaboración</h2>
<p>Cada producto tiene un tiempo mínimo de espera que se muestra en la ficha y en el carrito. El pedido se confirma una vez que el tiempo de elaboración está acordado.</p>
<h2>5. Envíos</h2>
<p>Los envíos a domicilio se coordinan según la opción que elijas: envío propio en Mendoza, Andreani o Correo Argentino. El costo y el plazo se informan antes de confirmar el pedido. Los plazos de los correos son estimados y los maneja cada empresa.</p>
<h2>6. Cancelaciones y cambios</h2>
<p>Ver la página <a href="/cambios-y-arrepentimiento">Cambios y arrepentimiento</a>.</p>
<h2>7. Privacidad</h2>
<p>El tratamiento de tus datos se explica en la <a href="/privacidad">Política de privacidad</a>.</p>
<h2>8. Ley aplicable</h2>
<p>Estos términos se rigen por la legislación de la República Argentina. Ante un reclamo podés acudir a la autoridad de defensa del consumidor de tu provincia.</p>`, s));
  });

  app.get('/privacidad', async (req, res) => {
    const s = await getSettings();
    res.type('html').send(page('Política de privacidad', `
<p>Esta política explica qué datos recogemos cuando usás ${esc(s.storeName)}, para qué los usamos y cómo podés pedir cambios o que los borremos.</p>
<h2>Qué datos recogemos</h2>
<ul>
<li><b>Para hacer un pedido:</b> nombre, apellido, número de WhatsApp, provincia, código postal y dirección de envío.</li>
<li><b>Si creás una cuenta:</b> usuario o email, y tu nombre. Si ingresás con Google, recibimos solo tu nombre y tu email; no recibimos tu contraseña de Google.</li>
<li><b>Si pagás online:</b> el pago lo procesa Mercado Pago. La tienda no guarda datos de tu tarjeta.</li>
<li><b>Navegación:</b> estadísticas anónimas de visitas, sin cookies de seguimiento, para mejorar la tienda.</li>
</ul>
<h2>Para qué los usamos</h2>
<p>Para procesar tu pedido, coordinar el pago y el envío, comunicarnos por WhatsApp, y mantener tu cuenta si la creaste. No vendemos tus datos ni los usamos para publicidad de terceros.</p>
<h2>Con quién los compartimos</h2>
<p>Con Mercado Pago (pagos), Andreani y Correo Argentino (envíos, solo los datos necesarios para entregar), y con los servicios de alojamiento y base de datos que usa la tienda.</p>
<h2>Cuánto tiempo los guardamos</h2>
<p>Mientras tengas cuenta o mientras sea necesario para cumplir obligaciones de venta. Los pedidos rechazados se borran con sus datos.</p>
<h2>Tus derechos</h2>
<p>Podés pedir acceso, corrección o eliminación de tus datos escribiendo a ${contact(s)}${wa(s)}. Para borrar tu cuenta, pedilo por esos medios y la eliminamos.</p>
<h2>Seguridad</h2>
<p>Las contraseñas se guardan cifradas. El acceso a los datos está restringido.</p>
<h2>Cambios</h2>
<p>Si cambiamos esta política, la fecha de actualización quedará visible en esta página.</p>`, s));
  });

  app.get('/cambios-y-arrepentimiento', async (req, res) => {
    const s = await getSettings();
    res.type('html').send(page('Cambios y arrepentimiento', `
<h2>Derecho de arrepentimiento</h2>
<p>Si comprás a distancia (por esta tienda online), podés arrepentirte de la compra dentro de los 10 días corridos desde que recibís el producto, sin dar explicaciones, según la Ley 24.240 de Defensa del Consumidor. Para hacerlo, escribinos a ${contact(s)}${wa(s)} indicando tu número de pedido. Te indicamos cómo devolver el producto y te reintegramos el pago por el mismo medio.</p>
<h2>Productos personalizados</h2>
<p>Los ramos y flores personalizados se elaboran según tu elección. Antes de confirmar, te mostramos el detalle para que lo revises. Si el producto llega con un defecto o no es lo que pediste, escribinos y lo resolvemos.</p>
<h2>Defectos y garantía</h2>
<p>Si el producto tiene un defecto, la garantía legal aplica. Escribinos con fotos del problema y te damos una solución: reemplazo o reintegro.</p>
<h2>Cancelar un pedido</h2>
<p>Podés cancelar un pedido antes de que empiece la elaboración. Escribinos por WhatsApp lo antes posible.</p>
<h2>Botón de arrepentimiento</h2>
<p>Para iniciar un arrepentimiento o un reclamo, escribinos a ${contact(s)}${wa(s)}.</p>`, s));
  });
}

module.exports = { mount };
