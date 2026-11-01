(() => {
'use strict';
const FL = window.FL;
const C = window.Calc;
const { $, esc, api, run, toast } = FL;

let st = { materials: [], products: [], config: { hourly: 0, round: 100 } };
let sub = 'products';      // products | materials | config
let ed = null;             // producto que se está armando
let edId = null;
let mEd = null;            // materia prima que se está cargando
let mEdId = null;

/* ---------- formato ---------- */
const nf = (n, max = 2) => {
  const r = Math.round((Number(n) || 0) * 10 ** max) / 10 ** max;
  return r.toLocaleString('es-AR', { minimumFractionDigits: Number.isInteger(r) ? 0 : Math.min(2, max), maximumFractionDigits: max });
};
const money = (n) => '$ ' + nf(n, 2);
const clone = (o) => JSON.parse(JSON.stringify(o));
const matById = (id) => st.materials.find((m) => String(m.id) === String(id));

const UNIT_GROUPS = [
  ['Largo', ['cm', 'm']],
  ['Cantidad', ['u']],
  ['Peso', ['g', 'kg']],
  ['Líquido', ['ml', 'l']],
];
const unitOptions = (selected, onlyBase) => UNIT_GROUPS
  .map(([label, list]) => {
    const keep = list.filter((k) => !onlyBase || C.UNITS[k].base === onlyBase);
    return keep.length ? `<optgroup label="${label}">${keep.map((k) => `<option value="${k}" ${k === selected ? 'selected' : ''}>${C.UNITS[k].label}</option>`).join('')}</optgroup>` : '';
  }).join('');

/* ---------- estilos de esta pestaña ---------- */
const css = document.createElement('style');
css.textContent = `
.cm-line { background:#fff; border:1.5px solid var(--line); border-radius:14px; padding:12px; margin-bottom:10px; }
.cm-line .top { display:flex; gap:8px; align-items:center; margin-bottom:8px; }
.cm-line .top select { flex:1; min-width:0; }
.cm-line .x { border:0; background:none; color:var(--bad); font-size:1.3rem; line-height:1; padding:4px 8px; }
.cm-line .f2 { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:8px; }
.cm-line label.s { display:block; font-size:.76rem; color:var(--muted); margin:0 0 3px; }
.cm-cost { margin-top:8px; font-size:.9rem; background:#faf6f9; border-radius:10px; padding:8px 10px; }
.cm-cost b { color:var(--p-dark); }
.cm-cost.err { background:#fdecea; color:var(--bad); }
.cm-chips { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
.cm-chips button { border:1.5px solid var(--line); background:#fff; border-radius:99px; padding:4px 11px; font-weight:600; font-size:.85rem; }
.cm-chips button:hover { background:var(--p-soft); }
.cm-res { background:linear-gradient(135deg,var(--p),var(--p-dark)); color:#fff; border-radius:16px; padding:16px; margin-top:16px; }
.cm-res .big small { display:block; opacity:.85; font-size:.82rem; }
.cm-res .big b { font-size:2rem; line-height:1.15; }
.cm-res table { width:100%; border-collapse:collapse; margin-top:10px; font-size:.9rem; }
.cm-res td { padding:5px 0; border-bottom:1px solid rgba(255,255,255,.2); }
.cm-res td:last-child { text-align:right; font-weight:700; }
.cm-bar { display:flex; height:12px; border-radius:99px; overflow:hidden; background:rgba(255,255,255,.25); margin:12px 0 6px; }
.cm-bar i { display:block; height:100%; }
.cm-leg { font-size:.8rem; opacity:.95; display:flex; flex-wrap:wrap; gap:4px 12px; }
.cm-leg span::before { content:''; display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:5px; background:var(--c); }
.cm-note { background:#fff8e1; border:1px solid #f1dc9a; border-radius:12px; padding:10px 12px; font-size:.88rem; margin-bottom:12px; }
.cm-pill { display:inline-block; background:var(--p-soft); color:var(--p-dark); font-weight:700; border-radius:99px; padding:3px 10px; font-size:.85rem; }
.cm-sub { font-size:.84rem; color:var(--muted); }
#cmodal .mfoot { justify-content:space-between; align-items:center; gap:8px; flex-wrap:nowrap; }
#cmodal .mfoot .row { flex-wrap:nowrap; gap:8px; }
#cmodal .mfoot .btn { padding:10px 14px; white-space:nowrap; }
#cmodal .sumf { min-width:0; }
#cmodal .sumf { font-weight:700; }
#cmodal .sumf small { display:block; font-weight:400; color:var(--muted); font-size:.74rem; }
`;
document.head.appendChild(css);

const modal = document.createElement('div');
modal.className = 'modal';
modal.id = 'cmodal';
modal.hidden = true;
document.body.appendChild(modal);
const closeModal = () => { modal.hidden = true; modal.innerHTML = ''; ed = null; mEd = null; };

/* ---------- pantalla principal ---------- */
FL.views.calc = async function viewCalc() {
  const r = await run(() => api('/api/admin/calc'));
  if (!r) return;
  st = r;
  draw();
};

const priceOf = (p) => C.productCalc(p, st.materials, st.config);

function barHtml(c) {
  const s = c.shares;
  return `<div class="cm-bar" style="background:#eadfe7;margin:8px 0"><i style="width:${s.materials}%;background:var(--p)"></i><i style="width:${s.emergency}%;background:#e0a526"></i><i style="width:${s.profit}%;background:#3f8f64"></i></div>`;
}

function productsHtml() {
  if (!st.materials.length) {
    return `<div class="cm-note">Para empezar, cargá tu <b>materia prima</b> (con lo que pagaste por cada cosa). Después armás tus productos con eso.<br><button class="btn sm" style="margin-top:8px" data-k="newmat">Agregar materia prima</button></div>`;
  }
  if (!st.products.length) return '<div class="card"><p class="hint" style="margin:0">Todavía no creaste productos. Tocá "Crear nuevo producto".</p></div>';
  return st.products.map((p) => {
    const c = priceOf(p);
    return `<div class="ocard">
      <div class="ohead"><b>${esc(p.name)}</b><span class="cm-pill">Precio ${money(c.price)}</span></div>
      <div class="ometa">Materia prima <b>${money(c.materials)}</b>${c.emergency ? ` · Emergencia <b>${money(c.emergency)}</b>` : ''}${c.minutes ? ` · Tiempo <b>${nf(c.minutes, 1)} min</b>` : ''} · Ganancia <b>${money(c.profit)}</b></div>
      ${c.hasErrors ? '<div class="cm-cost err">Alguna materia prima de este producto tiene un problema. Abrilo para revisarlo.</div>' : ''}
      ${barHtml(c)}
      <div class="acts" style="justify-content:flex-start">
        <button class="btn sec sm" data-k="editprod" data-id="${p.id}">Abrir / editar</button>
        <button class="btn sec sm" data-k="dupprod" data-id="${p.id}">Duplicar</button>
        <button class="btn danger sm" data-k="delprod" data-id="${p.id}">Borrar</button>
      </div></div>`;
  }).join('');
}

function materialsHtml() {
  if (!st.materials.length) return '<div class="card"><p class="hint" style="margin:0">Todavía no cargaste materia prima. Tocá "Agregar materia prima".</p></div>';
  return st.materials.map((m) => {
    const pb = C.perBase(m);
    const base = C.baseOf(m);
    return `<div class="ocard">
      <div class="ohead"><b>${esc(m.name)}</b><span class="cm-pill">${pb === null ? '—' : `${money(pb)} por ${C.BASE_LABEL[base]}`}</span></div>
      <div class="ometa">Pagaste <b>${money(m.price)}</b> · trae <b>${nf(m.pack_qty, 3)} ${C.UNITS[m.unit].label}</b>${m.note ? `<br>${esc(m.note)}` : ''}</div>
      <div class="acts" style="justify-content:flex-start;margin-top:8px">
        <button class="btn sec sm" data-k="editmat" data-id="${m.id}">Editar</button>
        <button class="btn danger sm" data-k="delmat" data-id="${m.id}">Borrar</button>
      </div></div>`;
  }).join('');
}

function configHtml() {
  const c = st.config;
  const opts = [[0, 'No redondear'], [10, 'De a $10'], [50, 'De a $50'], [100, 'De a $100'], [500, 'De a $500'], [1000, 'De a $1.000']];
  return `<div class="card" id="cmCfg">
    <div class="field"><label class="l">¿Cuánto querés ganar por hora? (en pesos)</label>
      <input type="text" inputmode="decimal" data-cf="hourly" value="${c.hourly ? nf(c.hourly, 2).replace(/\./g, '') : ''}" placeholder="Ej: 2000">
      <p class="hint">Se usa para calcular la ganancia según el tiempo que tardás en hacer cada producto. En cada producto podés poner otra distinta.</p></div>
    <div class="field"><label class="l">Redondear el precio recomendado hacia arriba</label>
      <select data-cf="round">${opts.map(([v, l]) => `<option value="${v}" ${Number(c.round) === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <p class="hint">Si te da $1.730 y elegís "De a $100", te queda $1.800. Si se pasa aunque sea por un peso, sube al siguiente (1.801 pasa a 1.900).</p></div>
    <button class="btn" data-k="savecfg">Guardar ajustes</button></div>`;
}

function draw() {
  $('#view').innerHTML = `
    <div class="head"><h2>Calculadora</h2></div>
    <p class="hint" style="margin:-6px 0 12px">Es solo para tus cuentas: no tiene nada que ver con la tienda ni con lo que ven tus clientes.</p>
    <div class="row" style="margin-bottom:12px"><button class="btn" data-k="newprod">Crear nuevo producto</button><button class="btn sec" data-k="newmat">Agregar materia prima</button></div>
    <div class="chips" style="margin-bottom:12px">
      <button class="chipb ${sub === 'products' ? 'on' : ''}" data-k="tab" data-v="products">Productos (${st.products.length})</button>
      <button class="chipb ${sub === 'materials' ? 'on' : ''}" data-k="tab" data-v="materials">Materia prima (${st.materials.length})</button>
      <button class="chipb ${sub === 'config' ? 'on' : ''}" data-k="tab" data-v="config">Ajustes</button>
    </div>
    ${sub === 'products' ? productsHtml() : sub === 'materials' ? materialsHtml() : configHtml()}`;
}

/* ---------- materia prima (alta / edición) ---------- */
function openMat(m) {
  mEdId = m ? m.id : null;
  mEd = m ? { name: m.name, price: String(m.price).replace('.', ','), pack_qty: String(m.pack_qty).replace('.', ','), unit: m.unit, note: m.note }
          : { name: '', price: '', pack_qty: '', unit: 'm', note: '' };
  modal.innerHTML = `<div class="mbox">
    <div class="mhead"><h3>${mEdId ? 'Editar materia prima' : 'Agregar materia prima'}</h3><button class="btn sec sm" data-k="mclose">Cerrar</button></div>
    <div class="mbody">
      <div class="field"><label class="l">Nombre</label><input type="text" data-mf="name" maxlength="80" value="${esc(mEd.name)}"></div>
      <div class="field"><label class="l">¿Cuánto pagaste? ($)</label><input type="text" inputmode="decimal" data-mf="price" value="${esc(mEd.price)}" placeholder="Precio de lo que comprás"></div>
      <div class="field"><label class="l">¿Qué trae eso que pagaste?</label>
        <div class="grid2"><input type="text" inputmode="decimal" data-mf="pack_qty" value="${esc(mEd.pack_qty)}" placeholder="Cantidad"><select data-mf="unit">${unitOptions(mEd.unit)}</select></div>
        <p class="hint">Si comprás una caja con muchas unidades, poné el precio de la caja y cuántas trae.</p></div>
      <div class="field"><label class="l">Nota (opcional)</label><input type="text" data-mf="note" maxlength="200" value="${esc(mEd.note)}"></div>
      <div class="cm-note" id="mPrev"></div>
    </div>
    <div class="mfoot"><button class="btn sec" data-k="mclose">Cancelar</button><button class="btn" data-k="msave">Guardar</button></div></div>`;
  modal.hidden = false;
  matPreview();
}
function matPreview() {
  const m = { price: C.toNumber(mEd.price), pack_qty: C.toNumber(mEd.pack_qty), unit: mEd.unit };
  const pb = C.perBase(m);
  $('#mPrev').innerHTML = pb === null ? 'Poné el precio y cuánto trae para ver cuánto te sale cada parte.'
    : `Cada <b>${C.BASE_LABEL[C.baseOf(m)]}</b> te sale <b>${money(pb)}</b>.`;
}

/* ---------- producto (alta / edición) ---------- */
const blankLine = () => ({ mat: '', mode: 'amount', qty: '', unit: '', n: '', len: '', lenUnit: 'cm', fracText: '' });

function openProd(p) {
  edId = p ? p.id : null;
  if (p) {
    ed = {
      name: p.name,
      lines: p.lines.map((l) => ({ ...blankLine(), ...l, qty: l.qty !== undefined ? String(l.qty).replace('.', ',') : '', n: l.n !== undefined ? String(l.n).replace('.', ',') : '', len: l.len !== undefined ? String(l.len).replace('.', ',') : '', unit: l.unit || '' })),
      emergency_type: p.emergency_type, emergency_value: p.emergency_value ? String(p.emergency_value).replace('.', ',') : '',
      h: String(Math.floor(p.minutes / 60) || ''), mi: String(Math.round(p.minutes % 60) || ''),
      hourly_override: p.hourly_override === null ? '' : String(p.hourly_override).replace('.', ','),
    };
  } else {
    ed = { name: '', lines: [], emergency_type: 'none', emergency_value: '', h: '', mi: '', hourly_override: '' };
  }
  renderEditor();
  modal.hidden = false;
}

function lineHtml(l, i) {
  const mat = matById(l.mat);
  const base = mat ? C.baseOf(mat) : null;
  const matOpts = `<option value="">Elegí la materia prima</option>${st.materials.map((m) => `<option value="${m.id}" ${String(m.id) === String(l.mat) ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}`;
  const modes = [['amount', 'Una cantidad (centímetros, unidades, gramos…)']];
  if (base === 'cm') modes.push(['pieces', 'Piezas de cierto largo (pétalos, hojas…)']);
  modes.push(['fraction', 'Una fracción o porcentaje (1/3, 25%…)']);
  let fields = '';
  if (mat) {
    if (l.mode === 'pieces') {
      fields = `<div class="f2"><div><label class="s">Cantidad de piezas</label><input type="text" inputmode="decimal" data-ln="${i}" data-lf="n" value="${esc(l.n)}"></div>
        <div><label class="s">Largo de cada una</label><div style="display:flex;gap:6px"><input type="text" inputmode="decimal" data-ln="${i}" data-lf="len" value="${esc(l.len)}" style="min-width:0"><select data-ln="${i}" data-lf="lenUnit" style="width:84px"><option value="cm" ${l.lenUnit === 'cm' ? 'selected' : ''}>cm</option><option value="m" ${l.lenUnit === 'm' ? 'selected' : ''}>m</option></select></div></div></div>`;
    } else if (l.mode === 'fraction') {
      fields = `<div style="margin-top:8px"><label class="s">¿Qué parte de lo que compraste usás?</label>
        <input type="text" data-ln="${i}" data-lf="fracText" value="${esc(l.fracText)}" placeholder="1/3, 25%, un cuarto…" autocomplete="off">
        <div class="cm-chips">${['1/2', '1/3', '1/4', '1/5', '1/8', '1/10', '1/16'].map((f) => `<button type="button" data-k="frac" data-ln="${i}" data-v="${f}">${f}</button>`).join('')}</div></div>`;
    } else {
      fields = `<div class="f2"><div><label class="s">Cantidad</label><input type="text" inputmode="decimal" data-ln="${i}" data-lf="qty" value="${esc(l.qty)}"></div>
        <div><label class="s">Unidad</label><select data-ln="${i}" data-lf="unit">${unitOptions(l.unit || mat.unit, base)}</select></div></div>`;
    }
  }
  return `<div class="cm-line" data-line="${i}">
    <div class="top"><select data-ln="${i}" data-lf="mat">${matOpts}</select><button class="x" type="button" data-k="rmline" data-ln="${i}" aria-label="Quitar">×</button></div>
    ${mat ? `<select data-ln="${i}" data-lf="mode">${modes.map(([v, t]) => `<option value="${v}" ${l.mode === v ? 'selected' : ''}>${t}</option>`).join('')}</select>` : ''}
    ${fields}
    <div class="cm-cost" data-cost="${i}"></div></div>`;
}

function renderEditor() {
  const y = $('#cmodal .mbody') ? $('#cmodal .mbody').scrollTop : 0;
  modal.innerHTML = `<div class="mbox">
    <div class="mhead"><h3>${edId ? 'Editar producto' : 'Crear nuevo producto'}</h3><button class="btn sec sm" data-k="pclose">Cerrar</button></div>
    <div class="mbody">
      <div class="field"><label class="l">Nombre del producto</label><input type="text" data-pf="name" maxlength="100" value="${esc(ed.name)}" placeholder="Ponele un nombre"></div>
      <h3 style="margin:18px 0 8px;font-size:1.05rem">Materia prima que lleva</h3>
      <div id="cLines">${ed.lines.map(lineHtml).join('')}</div>
      <button class="btn sec" type="button" data-k="addline">+ Agregar materia prima</button>
      ${st.materials.length ? '' : '<p class="hint">Todavía no cargaste materia prima. Cerrá esto y agregala primero.</p>'}
      <h3 style="margin:22px 0 8px;font-size:1.05rem">Emergencia <span class="cm-sub">(opcional)</span></h3>
      <div class="grid2"><select data-pf="emergency_type"><option value="none" ${ed.emergency_type === 'none' ? 'selected' : ''}>Sin emergencia</option><option value="percent" ${ed.emergency_type === 'percent' ? 'selected' : ''}>Un porcentaje más (%)</option><option value="amount" ${ed.emergency_type === 'amount' ? 'selected' : ''}>Un monto fijo ($)</option></select>
        <input type="text" inputmode="decimal" data-pf="emergency_value" value="${esc(ed.emergency_value)}" placeholder="${ed.emergency_type === 'percent' ? '% a sumar' : '$ a sumar'}" ${ed.emergency_type === 'none' ? 'hidden' : ''}></div>
      <h3 style="margin:22px 0 8px;font-size:1.05rem">Tiempo que tardás en hacerlo <span class="cm-sub">(opcional)</span></h3>
      <div class="grid2"><div><label class="s" style="font-size:.76rem;color:var(--muted)">Horas</label><input type="text" inputmode="numeric" data-pf="h" value="${esc(ed.h)}" placeholder="0"></div>
        <div><label class="s" style="font-size:.76rem;color:var(--muted)">Minutos</label><input type="text" inputmode="numeric" data-pf="mi" value="${esc(ed.mi)}" placeholder="0"></div></div>
      <div class="field" style="margin-top:10px"><label class="l">Ganancia por hora de este producto <span class="cm-sub">(opcional)</span></label>
        <input type="text" inputmode="decimal" data-pf="hourly_override" value="${esc(ed.hourly_override)}" placeholder="${st.config.hourly ? 'Si lo dejás vacío se usa ' + money(st.config.hourly) : 'Si lo dejás vacío se usa lo de Ajustes'}"></div>
      <div id="cRes"></div>
    </div>
    <div class="mfoot"><div class="sumf"><small>Precio recomendado</small><span id="cSum">—</span></div><div class="row"><button class="btn sec" data-k="pclose">Cancelar</button><button class="btn" data-k="psave">Guardar producto</button></div></div></div>`;
  const mb = $('#cmodal .mbody'); if (mb) mb.scrollTop = y;
  recalc();
}

const asProduct = () => ({
  lines: ed.lines,
  emergency_type: ed.emergency_type,
  emergency_value: C.toNumber(ed.emergency_value),
  minutes: (C.toNumber(ed.h) || 0) * 60 + (C.toNumber(ed.mi) || 0),
  hourly_override: ed.hourly_override === '' ? null : C.toNumber(ed.hourly_override),
});

function lineCostText(l, r) {
  if (!l.mat) return '';
  if (r.error) return r.error;
  const mat = matById(l.mat);
  const base = C.baseOf(mat);
  let eq = '';
  if (r.qtyBase !== undefined && l.mode !== 'amount') eq = ` <span class="cm-sub">(= ${nf(r.qtyBase, 2)} ${C.BASE_SHORT[base]}${l.mode === 'fraction' ? ` · ${nf(r.frac * 100, 2)}% de lo comprado` : ''})</span>`;
  return `Esta materia prima te cuesta <b>${money(r.cost)}</b>${eq}`;
}

function recalc() {
  if (!ed) return;
  const c = C.productCalc(asProduct(), st.materials, st.config);
  c.lines.forEach((x, i) => {
    const el = document.querySelector(`[data-cost="${i}"]`);
    if (!el) return;
    const txt = lineCostText(ed.lines[i], x);
    el.className = 'cm-cost' + (x.error && ed.lines[i].mat ? ' err' : '');
    el.hidden = !txt;
    el.innerHTML = txt;
  });
  const res = $('#cRes');
  if (!res) return;
  if (!ed.lines.length) {
    res.innerHTML = '<p class="hint">Agregá la materia prima que lleva y acá te aparece el precio.</p>';
    $('#cSum').textContent = '—';
    return;
  }
  const s = c.shares;
  const rows = [['Materia prima', c.materials]];
  if (c.emergency > 0) rows.push(['Emergencia', c.emergency]);
  if (c.labor > 0) rows.push([`Tu tiempo (${nf(c.minutes, 1)} min × ${money(c.hourly)}/hora)`, c.labor]);
  if (c.rounding > 0.004) rows.push(['Redondeo hacia arriba', c.rounding]);
  res.innerHTML = `<div class="cm-res">
    <div class="big"><small>Precio recomendado de venta</small><b>${money(c.price)}</b></div>
    <table>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${money(v)}</td></tr>`).join('')}
      <tr><td>Ganancia total</td><td>${money(c.profit)}</td></tr></table>
    <div class="cm-bar"><i style="width:${s.materials}%;background:#fff"></i><i style="width:${s.emergency}%;background:#f3c969"></i><i style="width:${s.profit}%;background:#7fd6a4"></i></div>
    <div class="cm-leg"><span style="--c:#fff">Materia prima ${nf(s.materials, 1)}%</span>${s.emergency > 0 ? `<span style="--c:#f3c969">Emergencia ${nf(s.emergency, 1)}%</span>` : ''}<span style="--c:#7fd6a4">Ganancia ${nf(s.profit, 1)}%</span></div>
    ${c.realHourly !== null ? `<p style="margin:8px 0 0;font-size:.85rem">Ganancia real por hora: <b>${money(c.realHourly)}</b></p>` : ''}
    ${c.minutes > 0 && !c.hourly ? '<p style="margin:8px 0 0;font-size:.82rem">Para que cuente tu tiempo, poné cuánto querés ganar por hora en Ajustes.</p>' : ''}
  </div>`;
  $('#cSum').textContent = money(c.price);
}

/* ---------- eventos ---------- */
modal.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.mf) { mEd[t.dataset.mf] = t.value; matPreview(); return; }
  if (!ed) return;
  if (t.dataset.pf) {
    ed[t.dataset.pf] = t.value;
    return recalc();
  }
  if (t.dataset.ln !== undefined && t.tagName === 'INPUT') {
    ed.lines[+t.dataset.ln][t.dataset.lf] = t.value;
    recalc();
  }
});

modal.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.mf) { mEd[t.dataset.mf] = t.value; matPreview(); return; }
  if (!ed) return;
  if (t.dataset.pf === 'emergency_type') { ed.emergency_type = t.value; return renderEditor(); }
  if (t.dataset.pf) { ed[t.dataset.pf] = t.value; return recalc(); }
  if (t.dataset.ln === undefined) return;
  const l = ed.lines[+t.dataset.ln];
  const f = t.dataset.lf;
  l[f] = t.value;
  if (f === 'mat') {
    const m = matById(t.value);
    l.unit = m ? m.unit : '';
    if (!m || (l.mode === 'pieces' && C.baseOf(m) !== 'cm')) l.mode = 'amount';
    return renderEditor();
  }
  if (f === 'mode') { if (l.mode === 'amount' && !l.unit) { const m = matById(l.mat); l.unit = m ? m.unit : ''; } return renderEditor(); }
  recalc();
});

modal.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-k]');
  if (!b) return;
  const k = b.dataset.k;
  if (k === 'mclose' || k === 'pclose') return closeModal();
  if (k === 'addline') { ed.lines.push(blankLine()); return renderEditor(); }
  if (k === 'rmline') { ed.lines.splice(+b.dataset.ln, 1); return renderEditor(); }
  if (k === 'frac') {
    const l = ed.lines[+b.dataset.ln];
    l.fracText = b.dataset.v;
    const inp = document.querySelector(`[data-ln="${b.dataset.ln}"][data-lf="fracText"]`);
    if (inp) inp.value = b.dataset.v;
    return recalc();
  }
  if (k === 'msave') {
    const body = { name: mEd.name, price: C.toNumber(mEd.price), pack_qty: C.toNumber(mEd.pack_qty), unit: mEd.unit, note: mEd.note };
    const ok = await run(async () => {
      if (mEdId) await api('/api/admin/calc/materials/' + mEdId, { method: 'PUT', body });
      else await api('/api/admin/calc/materials', { method: 'POST', body });
      return true;
    }, 'Materia prima guardada');
    if (ok) { closeModal(); FL.views.calc(); }
    return;
  }
  if (k === 'psave') {
    if (!ed.name.trim()) return toast('Ponele un nombre al producto', true);
    const p = asProduct();
    const body = {
      name: ed.name,
      lines: ed.lines.map((l) => (l.mode === 'pieces' ? { mat: l.mat, mode: 'pieces', n: l.n, len: l.len, lenUnit: l.lenUnit }
        : l.mode === 'fraction' ? { mat: l.mat, mode: 'fraction', fracText: l.fracText }
        : { mat: l.mat, mode: 'amount', qty: l.qty, unit: l.unit || (matById(l.mat) || {}).unit })),
      emergency_type: p.emergency_type, emergency_value: p.emergency_value || 0, minutes: p.minutes, hourly_override: p.hourly_override,
    };
    const ok = await run(async () => {
      if (edId) await api('/api/admin/calc/products/' + edId, { method: 'PUT', body });
      else await api('/api/admin/calc/products', { method: 'POST', body });
      return true;
    }, 'Producto guardado');
    if (ok) { closeModal(); sub = 'products'; FL.views.calc(); }
  }
});

document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-k]');
  if (!b || modal.contains(b) || FL.currentTab() !== 'calc') return;
  const k = b.dataset.k;
  const id = +b.dataset.id;
  if (k === 'tab') { sub = b.dataset.v; return draw(); }
  if (k === 'newmat') return openMat(null);
  if (k === 'newprod') return openProd(null);
  if (k === 'editmat') return openMat(matById(id));
  if (k === 'editprod') return openProd(st.products.find((p) => p.id === id));
  if (k === 'dupprod') {
    const p = st.products.find((x) => x.id === id);
    const body = { ...clone(p), name: p.name + ' (copia)' };
    await run(() => api('/api/admin/calc/products', { method: 'POST', body }), 'Producto duplicado');
    return FL.views.calc();
  }
  if (k === 'delprod') {
    if (!confirm('¿Borrar este producto de la calculadora?')) return;
    await run(() => api('/api/admin/calc/products/' + id, { method: 'DELETE' }), 'Producto borrado');
    return FL.views.calc();
  }
  if (k === 'delmat') {
    if (!confirm('¿Borrar esta materia prima?')) return;
    const r = await run(() => api('/api/admin/calc/materials/' + id, { method: 'DELETE' }), 'Materia prima borrada');
    if (r !== undefined) return FL.views.calc();
    return;
  }
  if (k === 'savecfg') {
    const body = {};
    document.querySelectorAll('#cmCfg [data-cf]').forEach((el) => { body[el.dataset.cf] = el.value; });
    body.hourly = C.toNumber(body.hourly) || 0;
    await run(() => api('/api/admin/calc/config', { method: 'PUT', body }), 'Ajustes guardados');
    return FL.views.calc();
  }
});
})();
