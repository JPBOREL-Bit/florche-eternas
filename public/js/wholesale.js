(() => {
'use strict';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function mixHex(hex, target, t) {
  const n = parseInt(hex.slice(1), 16);
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * (1 - t) + target * t).toString(16).padStart(2, '0')).join('');
}
function applyTheme(c) {
  if (!/^#[0-9a-fA-F]{6}$/.test(c || '')) return;
  const r = document.documentElement.style;
  r.setProperty('--p', c);
  r.setProperty('--p-dark', mixHex(c, 0, 0.28));
  r.setProperty('--p-soft', mixHex(c, 255, 0.88));
  r.setProperty('--p-pale', mixHex(c, 255, 0.78));
  r.setProperty('--p-light', mixHex(c, 255, 0.45));
  r.setProperty('--p-faint', mixHex(c, 255, 0.6));
  r.setProperty('--p-edge', mixHex(c, 255, 0.5));
}

async function init() {
  const root = $('#ws');
  let cfg;
  try {
    const r = await fetch('/api/wholesale/config');
    cfg = await r.json();
  } catch {
    root.innerHTML = '<p class="empty" style="text-align:center;padding:40px 0">No pudimos cargar la página. Probá recargar.</p>';
    return;
  }
  applyTheme(cfg.store.primaryColor);
  document.title = 'Trabajá como mayorista · ' + cfg.store.name;
  $('#top').innerHTML = `<a class="brand" href="/" aria-label="${esc(cfg.store.name)}">${cfg.store.logoId ? `<img src="/img/${cfg.store.logoId}" alt="">` : ''}<span>${esc(cfg.store.name)}</span></a><a class="rvp-back" href="/" style="color:var(--p-dark);font-weight:600;text-decoration:none;white-space:nowrap">← Volver a la tienda</a>`;

  if (!cfg.on) {
    root.innerHTML = '<div class="wsp-head"><h1>Trabajá como mayorista</h1><p>Por ahora no estamos recibiendo solicitudes. Volvé a pasar más adelante.</p></div>';
    return;
  }

  const min = cfg.min;
  let type = '';
  const opts = (list, ph) => `<option value="">${ph}</option>${list.map((x) => `<option>${esc(x)}</option>`).join('')}`;
  const field = (id, label, input, hint, optional) => `<div class="field" data-f="${id}"><label class="l" for="f_${id}">${label}${optional ? ' <span class="opt-tag">(opcional)</span>' : ''}</label>${input}${hint ? `<p class="hint">${hint}</p>` : ''}<div class="ferr" hidden></div></div>`;
  const inp = (id, t, extra = '') => `<input id="f_${id}" name="${id}" type="${t}" ${extra}>`;

  function businessFields() {
    if (type === 'emprendimiento') {
      return `<h2>Sobre tu emprendimiento</h2>
        ${field('brand', 'Nombre del emprendimiento', inp('brand', 'text', 'maxlength="80" autocomplete="organization"'))}
        ${field('since', '¿Hace cuánto está en marcha? (aproximado)', `<select id="f_since" name="since">${opts(cfg.since, 'Elegí una opción')}</select>`)}
        ${field('social', 'Instagram o red social', inp('social', 'text', 'maxlength="80" placeholder="@tuemprendimiento"'), '', true)}`;
    }
    return `<h2>Sobre tu negocio</h2>
      ${field('razon', 'Razón social', inp('razon', 'text', 'maxlength="100" autocomplete="organization"'))}
      ${field('fantasy', 'Nombre de fantasía', inp('fantasy', 'text', 'maxlength="80"'), '', true)}
      ${field('owner', 'Nombre del dueño o responsable', inp('owner', 'text', 'maxlength="80"'))}
      ${field('cuit', 'CUIT', inp('cuit', 'text', 'inputmode="numeric" maxlength="13" placeholder="30-12345678-9"'))}
      ${field('iva', 'Condición frente al IVA', `<select id="f_iva" name="iva">${opts(cfg.iva, 'Elegí una opción')}</select>`)}
      ${field('rubro', 'Rubro', `<select id="f_rubro" name="rubro">${opts(cfg.rubro, 'Elegí una opción')}</select>`)}
      ${field('address', 'Domicilio comercial', inp('address', 'text', 'maxlength="120" autocomplete="street-address" placeholder="Calle y número"'))}
      ${field('since', '¿Hace cuánto está en marcha? (aproximado)', `<select id="f_since" name="since">${opts(cfg.since, 'Elegí una opción')}</select>`)}
      <div class="field" data-f="localFisico"><label class="l">¿Tenés local a la calle?</label>
        <div class="radios"><label><input type="radio" name="localFisico" value="si"> Sí</label><label><input type="radio" name="localFisico" value="no"> No</label></div><div class="ferr" hidden></div></div>
      ${field('social', 'Web o Instagram', inp('social', 'text', 'maxlength="80"'), '', true)}`;
  }

  function draw() {
    root.innerHTML = `
      <div class="wsp-head"><h1>Trabajá como mayorista</h1>
        <p>Si tenés un emprendimiento o un negocio y querés comprar flores de cinta de raso en cantidad, completá tus datos y nos ponemos en contacto.</p></div>
      <div class="wsp-info">
        <div><i>1</i><span>Compra mínima: <b>${min} flores por mes</b>.</span></div>
        <div><i>2</i><span>Cuando envíes la solicitud te escribimos por <b>WhatsApp</b>: ahí te pasamos los <b>precios de las flores para compras mayores</b> y charlamos todo.</span></div>
        <div><i>3</i><span>También te mandamos la información a tu email.</span></div>
      </div>
      <form class="wf" id="wf" novalidate>
        <h2>¿Qué sos?</h2>
        <div class="tgl" role="group" aria-label="Tipo">
          <button type="button" data-t="emprendimiento" aria-pressed="${type === 'emprendimiento'}">Emprendimiento<small>Vendo por redes o por mi cuenta</small></button>
          <button type="button" data-t="negocio" aria-pressed="${type === 'negocio'}">Negocio<small>Tengo razón social y CUIT</small></button>
        </div>
        <div class="ferr" id="e_type" hidden></div>
        <div id="wfMore" ${type ? '' : 'hidden'}>
          ${type ? businessFields() : ''}
          <h2>Tus datos de contacto</h2>
          ${field('name', 'Tu nombre y apellido', inp('name', 'text', 'maxlength="80" autocomplete="name"'))}
          ${field('phone', 'Tu WhatsApp', inp('phone', 'tel', 'inputmode="tel" maxlength="24" autocomplete="tel" placeholder="261 456 7890"'), 'Es <b>obligatorio</b>: por ahí nos vamos a comunicar. Escribilo con el código de área.')}
          ${field('email', 'Tu email (Gmail)', inp('email', 'email', 'maxlength="120" autocomplete="email" placeholder="tunombre@gmail.com"'), 'Ahí te mandamos toda la información.')}
          ${field('city', 'Ciudad donde vivís', inp('city', 'text', 'maxlength="80" autocomplete="address-level2" placeholder="Ej: Godoy Cruz, Mendoza"'))}
          <h2>Tu compra</h2>
          ${field('qty', '¿Cuántas flores pensás comprar por mes? (aproximado)', inp('qty', 'number', 'inputmode="numeric" min="1" max="10000000" placeholder="Ej: 60"'), 'Es solo para conocerte. <b>No cambia en nada el trato</b>: tanto si ponés 10 como 1000, te atendemos igual.')}
          ${field('notes', 'Algo más que quieras contarnos', '<textarea id="f_notes" name="notes" maxlength="500"></textarea>', '', true)}
          <div class="hp" aria-hidden="true"><label>No completar <input type="text" name="website2" tabindex="-1" autocomplete="off"></label></div>
          <div class="field" data-f="consent"><label class="chk3"><input type="checkbox" id="f_consent" name="consent"> <span>Acepto que me contacten por WhatsApp y por email para hablar de mi compra.</span></label><div class="ferr" hidden></div></div>
          <button type="submit" class="btn" id="wfSend">Enviar solicitud</button>
          <p class="wf-err" id="wfErr" hidden></p>
        </div>
      </form>`;
    wire();
  }

  function clearErrors() {
    root.querySelectorAll('.field.err').forEach((f) => f.classList.remove('err'));
    root.querySelectorAll('.ferr').forEach((e) => { e.hidden = true; e.textContent = ''; });
    $('#wfErr') && ($('#wfErr').hidden = true);
  }
  function showError(field, msg) {
    if (field === 'type') { const e = $('#e_type'); e.textContent = msg; e.hidden = false; e.scrollIntoView({ block: 'center' }); return; }
    const box = root.querySelector(`.field[data-f="${field}"]`);
    if (box) {
      box.classList.add('err');
      const e = $('.ferr', box); e.textContent = msg; e.hidden = false;
      box.scrollIntoView({ block: 'center' });
      const i = $('input, select, textarea', box); if (i && i.type !== 'radio' && i.type !== 'checkbox') i.focus({ preventScroll: true });
    } else { const e = $('#wfErr'); e.textContent = msg; e.hidden = false; }
  }

  function wire() {
    root.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => {
      if (type === b.dataset.t) return;
      const keep = {};
      root.querySelectorAll('#wfMore [name]').forEach((el) => { if (['name', 'phone', 'email', 'city', 'qty', 'notes', 'since', 'social'].includes(el.name)) keep[el.name] = el.value; });
      type = b.dataset.t;
      draw();
      Object.entries(keep).forEach(([k, v]) => { const el = $(`#wfMore [name="${k}"]`); if (el) el.value = v; });
      $('#wfMore').scrollIntoView({ block: 'start' });
    }));
    const form = $('#wf');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors();
      if (!type) return showError('type', 'Elegí si es un emprendimiento o un negocio.');
      const fd = new FormData(form);
      const body = Object.fromEntries(fd.entries());
      body.type = type;
      body.phone = body.phone || '';
      body.consent = $('#f_consent').checked;
      const btn = $('#wfSend');
      btn.disabled = true; btn.textContent = 'Enviando…';
      let res;
      try {
        const r = await fetch('/api/wholesale', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        res = await r.json();
      } catch { res = { ok: false, error: 'No pudimos conectarnos. Probá de nuevo.' }; }
      btn.disabled = false; btn.textContent = 'Enviar solicitud';
      if (!res.ok) return showError(res.field || '', res.error || 'No se pudo enviar.');
      done(body);
    });
  }

  function done(b) {
    root.innerHTML = `<div class="wsp-done">
      <div class="ok" aria-hidden="true">✓</div>
      <h1>¡Recibimos tu solicitud!</h1>
      <p>Te vamos a escribir por <b>WhatsApp</b> al número que dejaste (<b>${esc(b.phone)}</b>).</p>
      <p>Ahí te pasamos los <b>precios de las flores para compras mayores</b> (compra mínima: <b>${min} flores por mes</b>) y charlamos todo.</p>
      <p>También te mandamos la información a <b>${esc(b.email)}</b>.</p>
      <a class="btn" href="/">Volver a la tienda</a></div>`;
    window.scrollTo(0, 0);
  }

  draw();
}

init();
})();
