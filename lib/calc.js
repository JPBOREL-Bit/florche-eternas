'use strict';
const Calc = require('../public/js/calc.js');

const txt = (v, max) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const num = (v) => Calc.toNumber(v);

function cleanMaterial(b) {
  const name = txt(b.name, 80);
  if (!name) throw new Error('Poné el nombre de la materia prima.');
  const price = num(b.price);
  if (!(price >= 0)) throw new Error('Poné cuánto pagaste.');
  const pack = num(b.pack_qty);
  if (!(pack > 0)) throw new Error('Poné cuánto trae (por ejemplo 10 metros).');
  if (!Calc.UNITS[b.unit]) throw new Error('Elegí la unidad.');
  return { name, price, pack_qty: pack, unit: b.unit, note: txt(b.note, 200) };
}

function cleanProduct(b) {
  const name = txt(b.name, 100);
  if (!name) throw new Error('Ponele un nombre al producto.');
  const src = Array.isArray(b.lines) ? b.lines.slice(0, 80) : [];
  const lines = src.map((l, i) => {
    const at = `Materia prima ${i + 1}`;
    const mat = parseInt(l.mat, 10);
    if (!Number.isInteger(mat)) throw new Error(`${at}: elegí la materia prima.`);
    if (l.mode === 'pieces') {
      const n = num(l.n), len = num(l.len);
      if (!(n > 0) || !(len > 0)) throw new Error(`${at}: poné cuántas piezas y de qué largo.`);
      return { mat, mode: 'pieces', n, len, lenUnit: l.lenUnit === 'm' ? 'm' : 'cm' };
    }
    if (l.mode === 'fraction') {
      const fracText = txt(l.fracText, 30);
      const frac = Calc.parseFraction(fracText);
      if (!frac) throw new Error(`${at}: la fracción no se entiende (probá 1/3, 25% o un cuarto).`);
      return { mat, mode: 'fraction', fracText, frac };
    }
    const qty = num(l.qty);
    if (!(qty > 0)) throw new Error(`${at}: poné la cantidad.`);
    if (!Calc.UNITS[l.unit]) throw new Error(`${at}: elegí la unidad.`);
    return { mat, mode: 'amount', qty, unit: l.unit };
  });
  const et = ['percent', 'amount'].includes(b.emergency_type) ? b.emergency_type : 'none';
  let ev = num(b.emergency_value);
  if (!(ev > 0)) ev = 0;
  const minutes = Math.min(1e6, Math.max(0, num(b.minutes) || 0));
  const ho = b.hourly_override === null || b.hourly_override === undefined || b.hourly_override === '' ? null : num(b.hourly_override);
  if (ho !== null && !(ho >= 0)) throw new Error('La ganancia por hora tiene que ser un número.');
  return { name, lines, emergency_type: et, emergency_value: et === 'none' ? 0 : ev, minutes, hourly_override: ho };
}

const fmtMat = (m) => ({ ...m, price: Number(m.price), pack_qty: Number(m.pack_qty) });
const fmtProd = (p) => ({
  ...p,
  emergency_value: Number(p.emergency_value),
  minutes: Number(p.minutes),
  hourly_override: p.hourly_override === null ? null : Number(p.hourly_override),
});

function mount({ app, q, auth, wrap }) {
  async function config() {
    const { rows } = await q('select k, v from calc_config');
    const c = { hourly: 0, round: 100 };
    for (const r of rows) c[r.k] = Number(r.v);
    return c;
  }

  // Todo lo de la calculadora es privado: solo se ve con la contraseña del panel
  app.get('/api/admin/calc', auth, wrap(async (req, res) => {
    const [mats, prods, cfg] = await Promise.all([
      q('select id, name, price, pack_qty, unit, note from calc_materials order by lower(name), id'),
      q('select id, name, lines, emergency_type, emergency_value, minutes, hourly_override from calc_products order by lower(name), id'),
      config(),
    ]);
    res.json({ materials: mats.rows.map(fmtMat), products: prods.rows.map(fmtProd), config: cfg });
  }));

  app.put('/api/admin/calc/config', auth, wrap(async (req, res) => {
    const hourly = num(req.body.hourly);
    const round = num(req.body.round);
    if (!(hourly >= 0)) return res.status(400).json({ error: 'Poné cuánto querés ganar por hora (en pesos).' });
    if (!(round >= 0) || round > 1e6) return res.status(400).json({ error: 'El redondeo es inválido.' });
    for (const [k, v] of [['hourly', hourly], ['round', Math.round(round)]]) {
      await q('insert into calc_config(k, v) values($1,$2) on conflict (k) do update set v = excluded.v', [k, v]);
    }
    res.json(await config());
  }));

  /* Materia prima */
  app.post('/api/admin/calc/materials', auth, wrap(async (req, res) => {
    let m;
    try { m = cleanMaterial(req.body); } catch (e) { return res.status(400).json({ error: e.message }); }
    const { rows } = await q('insert into calc_materials(name, price, pack_qty, unit, note) values($1,$2,$3,$4,$5) returning id', [m.name, m.price, m.pack_qty, m.unit, m.note]);
    res.json({ id: rows[0].id });
  }));
  app.put('/api/admin/calc/materials/:id', auth, wrap(async (req, res) => {
    let m;
    try { m = cleanMaterial(req.body); } catch (e) { return res.status(400).json({ error: e.message }); }
    await q('update calc_materials set name=$2, price=$3, pack_qty=$4, unit=$5, note=$6 where id=$1', [req.params.id, m.name, m.price, m.pack_qty, m.unit, m.note]);
    res.json({ ok: true });
  }));
  app.delete('/api/admin/calc/materials/:id', auth, wrap(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const used = await q('select name from calc_products where lines @> $1::jsonb order by name', [JSON.stringify([{ mat: id }])]);
    if (used.rowCount) {
      return res.status(409).json({ error: `No se puede borrar: la usás en ${used.rows.map((r) => r.name).join(', ')}. Sacala de esos productos primero.` });
    }
    await q('delete from calc_materials where id = $1', [id]);
    res.json({ ok: true });
  }));

  /* Productos */
  async function checkMaterials(lines) {
    const ids = [...new Set(lines.map((l) => l.mat))];
    if (!ids.length) return;
    const { rows } = await q('select id from calc_materials where id = any($1::int[])', [ids]);
    if (rows.length !== ids.length) throw new Error('Una de las materias primas de la receta ya no existe.');
  }
  app.post('/api/admin/calc/products', auth, wrap(async (req, res) => {
    let p;
    try { p = cleanProduct(req.body); await checkMaterials(p.lines); } catch (e) { return res.status(400).json({ error: e.message }); }
    const { rows } = await q(
      'insert into calc_products(name, lines, emergency_type, emergency_value, minutes, hourly_override) values($1,$2::jsonb,$3,$4,$5,$6) returning id',
      [p.name, JSON.stringify(p.lines), p.emergency_type, p.emergency_value, p.minutes, p.hourly_override]
    );
    res.json({ id: rows[0].id });
  }));
  app.put('/api/admin/calc/products/:id', auth, wrap(async (req, res) => {
    let p;
    try { p = cleanProduct(req.body); await checkMaterials(p.lines); } catch (e) { return res.status(400).json({ error: e.message }); }
    await q(
      'update calc_products set name=$2, lines=$3::jsonb, emergency_type=$4, emergency_value=$5, minutes=$6, hourly_override=$7, updated_at=now() where id=$1',
      [req.params.id, p.name, JSON.stringify(p.lines), p.emergency_type, p.emergency_value, p.minutes, p.hourly_override]
    );
    res.json({ ok: true });
  }));
  app.delete('/api/admin/calc/products/:id', auth, wrap(async (req, res) => {
    await q('delete from calc_products where id = $1', [req.params.id]);
    res.json({ ok: true });
  }));
}

module.exports = { mount };
