(() => {
'use strict';
const FL = window.FL;
const { $, esc, api, run, toast } = FL;
let filter = 'all';

const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
const when = (iso) => new Date(iso).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });

FL.views.reviews = async function viewReviews() {
  const r = await run(() => api('/api/admin/reviews'));
  if (!r) return;
  await FL.refresh();
  const s = FL.getData().settings;
  const shown = r.rows.filter((x) => (filter === 'hidden' ? x.hidden : filter === 'all' ? true : x.rating === Number(filter)));
  const g = r.google;
  $('#view').innerHTML = `
    <div class="head"><h2>Reseñas</h2><span class="hint" style="margin:0">Puntuación actual: <b>${Number(r.avg).toFixed(1)}</b> con ${r.count} ${r.count === 1 ? 'reseña visible' : 'reseñas visibles'}</span></div>

    <div class="card">
      <h3 style="margin:0 0 6px">Verificación con Google</h3>
      ${g.configured
        ? `<p style="margin:0;color:var(--ok);font-weight:600">✓ Conectado. Los clientes verifican su Gmail con Google antes de opinar.</p>
           <p class="hint">ID de cliente: ${esc(g.clientId)}</p>`
        : `<p style="margin:0 0 8px;color:var(--bad);font-weight:600">Todavía falta conectar Google. Hasta entonces los clientes no pueden dejar reseñas.</p>
           <details open><summary style="cursor:pointer;font-weight:600">Cómo se conecta (10 minutos, gratis)</summary>
             <ol style="padding-left:20px;line-height:1.6;margin:8px 0 0">
               <li>Entrá a <b>console.cloud.google.com</b> con tu cuenta de Google y creá un proyecto (por ejemplo "Florche").</li>
               <li>Andá a <b>APIs y servicios &gt; Pantalla de consentimiento de OAuth</b>, elegí <b>Externo</b>, poné el nombre de tu tienda y tu mail, y al final tocá <b>Publicar aplicación</b>.</li>
               <li>Andá a <b>Credenciales &gt; Crear credenciales &gt; ID de cliente de OAuth</b> y elegí <b>Aplicación web</b>.</li>
               <li>En <b>Orígenes autorizados de JavaScript</b> agregá la dirección de tu tienda: <b>${esc(location.origin)}</b></li>
               <li>Copiá el <b>ID de cliente</b> (termina en <i>.apps.googleusercontent.com</i>).</li>
               <li>En <b>Render &gt; Environment</b> agregá una variable <b>GOOGLE_CLIENT_ID</b> con ese valor y guardá. Render se reinicia solo.</li>
             </ol>
             <p class="hint">Si alguna pantalla de Google se ve distinta, mandame una captura y te guío.</p>
           </details>`}
    </div>

    <div class="card" id="rvSettings">
      <h3 style="margin:0 0 10px">Ajustes</h3>
      <label class="chk" style="margin-bottom:12px"><input type="checkbox" data-s="reviewsOn" ${s.reviewsOn ? 'checked' : ''}> Reseñas activadas (si lo apagás, la sección desaparece de la tienda)</label>
      <div class="field"><label class="l">Palabras que no se permiten</label>
        <textarea data-s="reviewBannedWords" style="min-height:90px">${esc(s.reviewBannedWords)}</textarea>
        <p class="hint">Separadas por coma. Si el Gmail o el nombre tiene alguna (aunque la escondan con números o puntos, como "f4ke"), no puede dejar la reseña. También se revisan los comentarios.
          También se rechazan Gmails con letras repetidas (aaaaaa) o con demasiados números.</p>
        <button class="btn sec sm" data-rv="reset">Volver a la lista inicial</button></div>
      <label class="chk" style="margin-bottom:12px"><input type="checkbox" data-s="showLikes" ${s.showLikes ? 'checked' : ''}> Mostrar a los clientes cuántos favoritos tiene cada producto (si está apagado, solo lo ves vos)</label>
      <button class="btn" data-rv="save">Guardar ajustes</button>
    </div>

    <div class="head" style="margin-top:18px"><h3 style="margin:0">Todas las reseñas</h3>
      <select id="rvFilter" style="width:auto;min-width:160px">
        <option value="all">Todas (${r.rows.length})</option>
        ${[5, 4, 3, 2, 1].map((k) => `<option value="${k}" ${String(filter) === String(k) ? 'selected' : ''}>${k} estrellas (${r.rows.filter((x) => x.rating === k).length})</option>`).join('')}
        <option value="hidden" ${filter === 'hidden' ? 'selected' : ''}>Ocultas (${r.rows.filter((x) => x.hidden).length})</option>
      </select></div>
    ${shown.map((x) => `
      <div class="card" style="${x.hidden ? 'opacity:.6' : ''}">
        <div class="row" style="justify-content:space-between;align-items:flex-start">
          <div><b style="color:#d98f00;letter-spacing:.05em">${stars(x.rating)}</b> ${x.hidden ? '<span class="badge">Oculta</span>' : ''}<br>
            <b>${esc(x.name)}</b> · <span class="hint" style="margin:0">${esc(x.email)}</span></div>
          <span class="hint" style="margin:0">${esc(when(x.updated_at))}</span>
        </div>
        ${x.comment ? `<p style="margin:8px 0;white-space:pre-line">${esc(x.comment)}</p>` : '<p class="hint" style="margin:8px 0">Solo dejó la puntuación, sin comentario.</p>'}
        <div class="acts" style="justify-content:flex-start">
          <button class="btn sec sm" data-rv="toggle" data-id="${x.id}" data-hidden="${x.hidden ? 0 : 1}">${x.hidden ? 'Volver a mostrar' : 'Ocultar'}</button>
          <button class="btn danger sm" data-rv="del" data-id="${x.id}">Borrar</button>
        </div>
      </div>`).join('') || '<div class="card"><p class="hint" style="margin:0">No hay reseñas con este filtro.</p></div>'}
    <p class="hint">Aquí ves el Gmail completo. Los clientes solo ven una parte (por ejemplo ma***z@gmail.com).</p>`;
  $('#rvFilter').onchange = (e) => { filter = e.target.value; FL.views.reviews(); };
};

document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-rv]');
  if (!b || FL.currentTab() !== 'reviews') return;
  const a = b.dataset.rv;
  if (a === 'save') {
    const body = {};
    document.querySelectorAll('#rvSettings [data-s]').forEach((el) => { body[el.dataset.s] = el.type === 'checkbox' ? el.checked : el.value; });
    await run(() => api('/api/admin/settings', { method: 'PUT', body }), 'Ajustes guardados');
    return FL.views.reviews();
  }
  if (a === 'reset') {
    const r = await run(() => api('/api/admin/reviews'));
    if (r) { document.querySelector('#rvSettings [data-s="reviewBannedWords"]').value = r.defaultBanned; toast('Lista inicial restaurada. Tocá "Guardar ajustes".'); }
    return;
  }
  if (a === 'toggle') {
    await run(() => api('/api/admin/reviews/' + b.dataset.id, { method: 'PUT', body: { hidden: b.dataset.hidden === '1' } }), b.dataset.hidden === '1' ? 'Reseña oculta' : 'Reseña visible');
    return FL.views.reviews();
  }
  if (a === 'del') {
    if (!confirm('¿Borrar esta reseña para siempre?')) return;
    await run(() => api('/api/admin/reviews/' + b.dataset.id, { method: 'DELETE' }), 'Reseña borrada');
    return FL.views.reviews();
  }
});
})();
