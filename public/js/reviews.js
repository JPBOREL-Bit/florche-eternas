(() => {
'use strict';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plural = (n, a, b) => (n === 1 ? a : b);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return 'recién';
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} ${plural(h, 'hora', 'horas')}`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d} ${plural(d, 'día', 'días')}`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `hace ${mo} ${plural(mo, 'mes', 'meses')}`;
  const y = Math.floor(d / 365);
  return `hace ${y} ${plural(y, 'año', 'años')}`;
}
const fmtDate = (iso) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
async function postJSON(url, body) {
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return await r.json();
  } catch {
    return { ok: false, message: 'No pudimos conectarnos. Probá de nuevo.' };
  }
}

/* ---------- piezas visuales ---------- */
function starsHtml(value, big) {
  const pct = Math.max(0, Math.min(100, (Number(value) / 5) * 100)).toFixed(0);
  return `<span class="stars${big ? ' big' : ''}" role="img" aria-label="${Number(value).toFixed(1)} de 5 estrellas"><span class="stars-fill" style="width:${pct}%">★★★★★</span></span>`;
}

function summaryHtml(d, { clickable = false, active = 0 } = {}) {
  const total = d.count || 0;
  const bars = [5, 4, 3, 2, 1].map((k) => {
    const n = (d.dist && d.dist[k]) || 0;
    const pct = total ? ((n / total) * 100).toFixed(1) : 0;
    const inner = `<span>${k}</span><div class="bar"><i style="width:${pct}%"></i></div><b>${n}</b>`;
    return clickable
      ? `<button type="button" class="rv-bar" data-stars="${k}" aria-pressed="${active === k}" aria-label="Ver reseñas de ${k} estrellas (${n})">${inner}</button>`
      : `<div class="rv-bar">${inner}</div>`;
  }).join('');
  return `<div class="rv-top">
    <div class="rv-score">
      <div class="rv-num">${Number(d.avg || 0).toFixed(1)}</div>
      ${starsHtml(d.avg || 0, true)}
      <div class="rv-sub">Puntuación de la tienda</div>
      <div class="rv-sub">${total} ${plural(total, 'reseña', 'reseñas')}</div>
    </div>
    <div class="rv-bars">${bars}</div>
  </div>`;
}

function cardHtml(r, hidden) {
  return `<article class="rv-card"${hidden ? ' aria-hidden="true"' : ''}>
    <div class="rv-card-top">${starsHtml(r.rating)}<span class="rv-ago">${esc(timeAgo(r.updated_at || r.created_at))}</span></div>
    <p>${esc(r.comment)}</p>
    <div class="rv-who"><b>${esc(r.name)}</b><span>${esc(r.email)}</span></div>
  </article>`;
}

function stripHtml(items) {
  const loop = items.length >= 3;
  const dur = Math.max(30, items.length * 7);
  const cards = items.map((r) => cardHtml(r, false)).join('');
  const copy = loop ? items.map((r) => cardHtml(r, true)).join('') : '';
  return `<div class="rv-strip${loop ? ' loop' : ''}" style="--dur:${dur}s" aria-label="Comentarios de clientas"><div class="rv-track">${cards}${copy}</div></div>`;
}

// El movimiento solo corre mientras la sección se ve en pantalla (cuida la batería del celular)
function armStrip(root) {
  const strip = $('.rv-strip.loop', root);
  if (!strip) return;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => es.forEach((e) => strip.classList.toggle('run', e.isIntersecting)), { threshold: 0.1 }).observe(strip);
  } else strip.classList.add('run');
  let t;
  strip.addEventListener('touchstart', () => { clearTimeout(t); strip.classList.add('hold'); }, { passive: true });
  strip.addEventListener('touchend', () => { t = setTimeout(() => strip.classList.remove('hold'), 1800); }, { passive: true });
}

/* ---------- formulario ---------- */
let gisPromise = null;
function loadGis() {
  if (window.google && window.google.accounts && window.google.accounts.id) return Promise.resolve();
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = resolve;
      s.onerror = () => { gisPromise = null; reject(new Error('gis')); };
      document.head.appendChild(s);
    });
  }
  return gisPromise;
}

const LABELS = ['', 'Muy mala', 'Mala', 'Regular', 'Buena', 'Excelente'];

function openForm(cfg) {
  const st = { rating: 0, token: '', emailMasked: '', busy: false };
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="rv-ov" data-x></div>
    <div class="rv-sheet" role="dialog" aria-modal="true" aria-label="Dejá tu reseña">
      <button class="sheet-close" data-x aria-label="Cerrar">×</button>
      <div class="rv-body" id="rvBody">
        <h3>Dejá tu reseña</h3>
        <div class="field">
          <label class="l">¿Cuántas estrellas le das a la tienda?</label>
          <div class="rv-pick" role="radiogroup" aria-label="Estrellas">${[1, 2, 3, 4, 5].map((i) => `<button type="button" role="radio" aria-checked="false" aria-label="${i} ${plural(i, 'estrella', 'estrellas')}" data-v="${i}">★</button>`).join('')}</div>
          <div class="rv-picklbl" id="rvLbl">Tocá una estrella</div>
        </div>
        <div class="field">
          <label class="l" for="rvC">Comentario <span style="font-weight:400;color:var(--muted)">(opcional)</span></label>
          <textarea id="rvC" maxlength="600" placeholder="Contanos cómo fue tu experiencia"></textarea>
          <small class="rv-cnt" id="rvCnt">0 / 600</small>
        </div>
        <div class="field">
          <label class="l" for="rvN">Tu nombre</label>
          <input id="rvN" type="text" maxlength="40" autocomplete="given-name" placeholder="Ej: María">
        </div>
        <div class="field">
          <label class="l">Tu Gmail (se verifica con Google)</label>
          <div id="rvG"><div id="rvGbtn" style="min-height:44px"></div></div>
          <div id="rvGok" class="rv-ok" hidden><span>✓ Gmail verificado:</span> <b id="rvGem"></b> <button type="button" class="linkbtn" id="rvChg">Cambiar</button></div>
          <small>Lo usamos solo para comprobar que sos una persona real. En la página se muestra parcialmente oculto.</small>
        </div>
        <div class="rv-err" id="rvErr" role="alert"></div>
        <button type="button" class="btn" id="rvSend" disabled>Publicar reseña</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  if (cfg.lock) cfg.lock();
  const close = () => { wrap.remove(); if (cfg.unlock) cfg.unlock(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('click', (e) => { if (e.target.closest('[data-x]')) close(); });

  const err = (m) => { $('#rvErr', wrap).textContent = m || ''; };
  const sync = () => {
    const nameOk = $('#rvN', wrap).value.trim().length >= 2;
    $('#rvSend', wrap).disabled = !(st.rating && nameOk && st.token) || st.busy;
  };

  $('.rv-pick', wrap).addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    st.rating = +b.dataset.v;
    wrap.querySelectorAll('.rv-pick button').forEach((x) => {
      const on = +x.dataset.v <= st.rating;
      x.classList.toggle('on', on);
      x.setAttribute('aria-checked', String(+x.dataset.v === st.rating));
    });
    $('#rvLbl', wrap).textContent = `${st.rating} de 5 · ${LABELS[st.rating]}`;
    err(''); sync();
  });
  $('#rvC', wrap).addEventListener('input', (e) => { $('#rvCnt', wrap).textContent = `${e.target.value.length} / 600`; });
  $('#rvN', wrap).addEventListener('input', () => { err(''); sync(); });

  const showVerified = (on) => {
    $('#rvG', wrap).hidden = on;
    $('#rvGok', wrap).hidden = !on;
    if (on) $('#rvGem', wrap).textContent = st.emailMasked;
  };
  $('#rvChg', wrap).addEventListener('click', () => { st.token = ''; showVerified(false); sync(); drawGoogle(); });

  async function onCred(resp) {
    err('');
    $('#rvErr', wrap).style.color = 'var(--muted)';
    $('#rvErr', wrap).textContent = 'Verificando tu Gmail…';
    const r = await postJSON('/api/reviews/verify', { credential: resp && resp.credential });
    $('#rvErr', wrap).style.color = '';
    if (!r.ok) { err(r.message || 'No pudimos verificar tu Gmail.'); return; }
    st.token = r.token; st.emailMasked = r.emailMasked;
    const n = $('#rvN', wrap);
    if (!n.value.trim() && r.name) n.value = r.name;
    err(''); showVerified(true); sync();
  }

  async function drawGoogle() {
    if (!cfg.google) { err('Las reseñas con Google todavía no están activadas en esta tienda.'); return; }
    try { await loadGis(); } catch { err('No pudimos cargar Google. Revisá tu conexión y probá de nuevo.'); return; }
    if (!document.body.contains(wrap)) return;
    window.google.accounts.id.initialize({ client_id: cfg.google, callback: onCred, ux_mode: 'popup', auto_select: false });
    const box = $('#rvGbtn', wrap);
    box.innerHTML = '';
    window.google.accounts.id.renderButton(box, {
      type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', locale: 'es',
      width: Math.max(220, Math.min(320, window.innerWidth - 70)),
    });
  }
  drawGoogle();

  $('#rvSend', wrap).addEventListener('click', async () => {
    if (st.busy) return;
    st.busy = true; sync(); err('');
    $('#rvSend', wrap).textContent = 'Publicando…';
    const r = await postJSON('/api/reviews', {
      token: st.token, name: $('#rvN', wrap).value, rating: st.rating, comment: $('#rvC', wrap).value,
    });
    st.busy = false;
    $('#rvSend', wrap).textContent = 'Publicar reseña';
    if (!r.ok) {
      err(r.message || 'No se pudo publicar.');
      if (/venci|verific/i.test(r.message || '')) { st.token = ''; showVerified(false); drawGoogle(); }
      sync();
      return;
    }
    $('#rvBody', wrap).innerHTML = `<div class="rv-thanks">
      <h3>${r.updated ? 'Actualizamos tu reseña' : '¡Gracias por tu reseña!'}</h3>
      <p>${r.updated ? 'Reemplazamos la anterior por esta.' : 'Ya está publicada y suma a la puntuación de la tienda.'}</p>
      <button type="button" class="btn" data-x>Cerrar</button></div>`;
    if (cfg.onDone) cfg.onDone();
  });
  return { close };
}

/* ---------- sección dentro de la tienda ---------- */
function renderSection(el, data, opts = {}) {
  if (!el) return;
  if (!data || !data.on) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  el.innerHTML = `<div class="wrap">
    <h2 class="sec-title">Reseñas</h2>
    ${summaryHtml(data)}
    ${data.featured && data.featured.length ? stripHtml(data.featured) : '<p class="rv-empty">Todavía no hay comentarios. ¡Podés ser la primera persona en dejar el suyo!</p>'}
    <div class="rv-actions">
      <button type="button" class="btn" data-rv="new">Dejá tu reseña</button>
      <a class="btn ghost" href="/resenas">Ver todos los comentarios</a>
    </div>
  </div>`;
  armStrip(el);
  $('[data-rv="new"]', el).addEventListener('click', () => {
    openForm({
      google: data.google, lock: opts.lock, unlock: opts.unlock,
      onDone: async () => {
        try { const fresh = await getJSON('/api/reviews/summary'); renderSection(el, fresh, opts); } catch {}
      },
    });
  });
}

/* ---------- página /resenas ---------- */
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

async function initPage() {
  const root = $('#rvp');
  let sum;
  try { sum = await getJSON('/api/reviews/summary'); } catch { root.innerHTML = '<p class="rvp-empty">No pudimos cargar las reseñas. Probá recargar la página.</p>'; return; }
  applyTheme(sum.store.primaryColor);
  document.title = 'Reseñas · ' + sum.store.name;
  $('#top').innerHTML = `<a class="brand" href="/" aria-label="${esc(sum.store.name)}">${sum.store.logoId ? `<img src="/img/${sum.store.logoId}" alt="">` : ''}<span>${esc(sum.store.name)}</span></a><a class="rvp-back" href="/">← Volver a la tienda</a>`;
  if (!sum.on) { root.innerHTML = '<div class="rvp-head"><h1>Reseñas</h1></div><p class="rvp-empty">Las reseñas no están disponibles por ahora.</p>'; return; }

  const state = { stars: 0, comment: false, next: null };
  const lock = () => { document.body.style.overflow = 'hidden'; };
  const unlock = () => { document.body.style.overflow = ''; };

  function draw(data) {
    const chips = [{ k: 0, label: `Todas (${data.count})` }, ...[5, 4, 3, 2, 1].map((k) => ({ k, label: `${k} ★ (${data.dist[k] || 0})` }))];
    root.innerHTML = `
      <div class="rvp-head"><h1>Reseñas de la tienda</h1></div>
      ${summaryHtml(data, { clickable: true, active: state.stars })}
      <div class="rv-actions" style="margin-bottom:22px"><button type="button" class="btn" data-rv="new">Dejá tu reseña</button></div>
      <div class="rvp-filters" role="tablist" aria-label="Filtrar por estrellas">${chips.map((c) => `<button type="button" class="cat" role="tab" data-f="${c.k}" aria-selected="${state.stars === c.k}">${c.label}</button>`).join('')}</div>
      <div class="rvp-opts"><label class="chk2"><input type="checkbox" id="onlyC" ${state.comment ? 'checked' : ''}> Solo con comentario</label></div>
      <div class="rvp-list" id="rvList" aria-live="polite"></div>
      <div class="rvp-more" id="rvMore"></div>`;
    $('[data-rv="new"]', root).addEventListener('click', () => openForm({
      google: data.google, lock, unlock,
      onDone: async () => { try { sum = await getJSON('/api/reviews/summary'); draw(sum); loadList(true); } catch {} },
    }));
    root.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { state.stars = +b.dataset.f; draw(sum); loadList(true); }));
    root.querySelectorAll('button.rv-bar').forEach((b) => b.addEventListener('click', () => { state.stars = state.stars === +b.dataset.stars ? 0 : +b.dataset.stars; draw(sum); loadList(true); }));
    $('#onlyC', root).addEventListener('change', (e) => { state.comment = e.target.checked; loadList(true); });
  }

  async function loadList(reset) {
    const list = $('#rvList', root), more = $('#rvMore', root);
    if (reset) { list.innerHTML = '<p class="rvp-empty">Cargando…</p>'; state.next = null; }
    const q = new URLSearchParams({ limit: 12 });
    if (state.stars) q.set('stars', state.stars);
    if (state.comment) q.set('comment', '1');
    if (!reset && state.next) q.set('before', state.next);
    let d;
    try { d = await getJSON('/api/reviews?' + q); } catch { list.innerHTML = '<p class="rvp-empty">No pudimos cargar las reseñas.</p>'; return; }
    const html = d.items.map((r) => `<article class="rvp-item">
      <div class="top2">${starsHtml(r.rating)}<span class="when">${esc(fmtDate(r.updated_at || r.created_at))} · ${esc(timeAgo(r.updated_at || r.created_at))}</span></div>
      ${r.comment ? `<p>${esc(r.comment)}</p>` : '<p style="color:var(--muted)">Solo dejó su puntuación.</p>'}
      <div class="who"><b>${esc(r.name)}</b><span>${esc(r.email)}</span></div></article>`).join('');
    if (reset) list.innerHTML = html || '<p class="rvp-empty">Todavía no hay reseñas con este filtro.</p>';
    else list.insertAdjacentHTML('beforeend', html);
    state.next = d.next;
    more.innerHTML = d.next ? '<button type="button" class="btn ghost" id="moreBtn">Ver más reseñas</button>' : '';
    const mb = $('#moreBtn', root);
    if (mb) mb.addEventListener('click', () => loadList(false));
  }

  draw(sum);
  loadList(true);
}

window.FLReviews = { renderSection, openForm, timeAgo, fmtDate };
if (document.body && document.body.dataset.page === 'reviews') initPage();
})();
