'use strict';
const zlib = require('zlib');

const SINCE = ['Menos de 6 meses', 'Entre 6 meses y 1 año', 'Entre 1 y 2 años', 'Entre 2 y 5 años', 'Más de 5 años'];
const IVA = ['Monotributista', 'Responsable Inscripto', 'Exento', 'Otro'];
const RUBRO = ['Florería', 'Regalería', 'Eventos y casamientos', 'Decoración', 'Tienda de ropa o accesorios', 'Otro'];

/* Los datos de un comprador aceptado se guardan comprimidos (gzip) */
const pack = (obj) => zlib.gzipSync(Buffer.from(JSON.stringify(obj), 'utf8'), { level: 9 });
const unpack = (buf) => JSON.parse(zlib.gunzipSync(buf).toString('utf8'));

const txt = (v, max) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/* WhatsApp argentino: acepta 261 456 7890, 0261 15 456 7890, +54 9 261 456 7890, etc. y lo deja como 5492614567890 */
function normPhone(raw) {
  const s = String(raw || '').trim();
  let d = s.replace(/\D/g, '');
  if (!d) return null;
  if (s.startsWith('+') && !d.startsWith('54')) return d.length >= 8 && d.length <= 15 ? d : null; // otro país
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('54')) d = d.slice(2);
  if (d.startsWith('9')) d = d.slice(1);
  d = d.replace(/^0+/, '');
  if (d.length === 12) {
    for (const L of [2, 3, 4]) {
      if (d.slice(L, L + 2) === '15') { d = d.slice(0, L) + d.slice(L + 2); break; }
    }
  }
  return /^\d{10}$/.test(d) ? '549' + d : null;
}

/* CUIT/CUIL con dígito verificador */
function cuitOk(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.length !== 11) return null;
  const w = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(d[i]) * w[i];
  let v = 11 - (sum % 11);
  if (v === 11) v = 0;
  if (v === 10 || v !== Number(d[10])) return null;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d[10]}`;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function clean(b) {
  const fail = (field, error) => ({ error, field });
  const type = b.type === 'negocio' ? 'negocio' : b.type === 'emprendimiento' ? 'emprendimiento' : null;
  if (!type) return fail('type', 'Elegí si es un emprendimiento o un negocio.');
  const d = { type };

  if (type === 'emprendimiento') {
    d.brand = txt(b.brand, 80);
    if (d.brand.length < 2) return fail('brand', 'Escribí el nombre de tu emprendimiento.');
    d.since = SINCE.includes(b.since) ? b.since : '';
    if (!d.since) return fail('since', 'Contanos hace cuánto está en marcha, aproximadamente.');
    d.social = txt(b.social, 80);
  } else {
    d.razon = txt(b.razon, 100);
    if (d.razon.length < 2) return fail('razon', 'Escribí la razón social.');
    d.fantasy = txt(b.fantasy, 80);
    d.owner = txt(b.owner, 80);
    if (d.owner.length < 2) return fail('owner', 'Escribí el nombre del dueño o responsable.');
    d.cuit = cuitOk(b.cuit);
    if (!d.cuit) return fail('cuit', 'Revisá el CUIT: tiene que ser válido (11 números).');
    d.iva = IVA.includes(b.iva) ? b.iva : '';
    if (!d.iva) return fail('iva', 'Elegí la condición frente al IVA.');
    d.rubro = RUBRO.includes(b.rubro) ? b.rubro : '';
    if (!d.rubro) return fail('rubro', 'Elegí el rubro de tu negocio.');
    d.address = txt(b.address, 120);
    if (d.address.length < 5) return fail('address', 'Escribí el domicilio comercial (calle y número).');
    d.since = SINCE.includes(b.since) ? b.since : '';
    if (!d.since) return fail('since', 'Contanos hace cuánto está en marcha, aproximadamente.');
    d.localFisico = b.localFisico === 'si' ? 'Sí' : b.localFisico === 'no' ? 'No' : '';
    if (!d.localFisico) return fail('localFisico', 'Indicá si tenés local a la calle.');
    d.social = txt(b.social, 80);
  }

  d.name = txt(b.name, 80);
  if (d.name.length < 2) return fail('name', 'Escribí tu nombre y apellido.');
  d.phone = normPhone(b.phone);
  if (!d.phone) return fail('phone', 'Revisá tu WhatsApp. Escribilo con el código de área, por ejemplo 261 456 7890.');
  d.email = txt(b.email, 120).toLowerCase();
  if (!EMAIL.test(d.email)) return fail('email', 'Revisá tu email.');
  d.city = txt(b.city, 80);
  if (d.city.length < 2) return fail('city', 'Escribí en qué ciudad vivís.');
  d.qty = parseInt(b.qty, 10);
  if (!(d.qty >= 1 && d.qty <= 10000000)) return fail('qty', 'Escribí cuántas flores pensás comprar por mes, aproximadamente.');
  d.notes = txt(b.notes, 500);
  if (b.consent !== true) return fail('consent', 'Tenés que aceptar que te contactemos para enviar la solicitud.');
  return { data: d };
}

function mount({ app, q, auth, wrap, rateOk, getSettings }) {
  /* ------------------------- Público ------------------------- */
  app.get('/api/wholesale/config', wrap(async (req, res) => {
    const s = await getSettings();
    res.set('Cache-Control', 'no-store');
    res.json({
      on: !!s.wholesaleOn,
      min: Number(s.wholesaleMin) || 20,
      store: { name: s.storeName, primaryColor: s.primaryColor, logoId: s.logoId },
      since: SINCE, iva: IVA, rubro: RUBRO,
    });
  }));

  app.post('/api/wholesale', wrap(async (req, res) => {
    const b = req.body || {};
    if (b.website2) return res.json({ ok: true });            // trampa para robots: se ignora sin avisar
    const s = await getSettings();
    if (!s.wholesaleOn) return res.json({ ok: false, error: 'Por ahora no estamos recibiendo solicitudes de mayoristas.' });
    const r = clean(b);
    if (r.error) return res.json({ ok: false, error: r.error, field: r.field });   // los errores de formulario no cuentan para el límite
    if (!rateOk(req.ip, 'wholesale', 6, 3600e3)) return res.status(429).json({ ok: false, error: 'Enviaste varias solicitudes seguidas. Probá más tarde.' });
    const d = r.data;
    // Si ya mandó una solicitud hace poco con el mismo WhatsApp, no se duplica
    const dup = await q("select id from wholesalers where whatsapp = $1 and created_at > now() - interval '30 days'", [d.phone]);
    if (dup.rowCount) return res.json({ ok: true, duplicate: true });
    await q(
      `insert into wholesalers(type, name, business, city, qty, whatsapp, email, data)
       values($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [d.type, d.name, d.type === 'negocio' ? d.razon : d.brand, d.city, d.qty, d.phone, d.email, JSON.stringify(d)]
    );
    res.json({ ok: true });
  }));

  /* ------------------------- Panel ------------------------- */
  const card = (r) => ({
    id: r.id, created_at: r.created_at, decided_at: r.decided_at, status: r.status, type: r.type,
    name: r.name, business: r.business, city: r.city, qty: r.qty, whatsapp: r.whatsapp, email: r.email,
    detail: r.data_z ? unpack(r.data_z) : r.data,
  });

  app.get('/api/admin/wholesale', auth, wrap(async (req, res) => {
    const [rows, pur] = await Promise.all([
      q('select * from wholesalers order by id desc'),
      q('select id, wid, day, flowers, amount, note from wholesale_purchases order by day desc, id desc'),
    ]);
    const byW = {};
    for (const p of pur.rows) (byW[p.wid] = byW[p.wid] || []).push({ ...p, amount: Number(p.amount), day: String(p.day).slice(0, 10) });
    const all = rows.rows.map(card);
    const buyers = all.filter((c) => c.status === 'aceptado').map((c) => {
      const list = byW[c.id] || [];
      return { ...c, purchases: list, total_flowers: list.reduce((a, p) => a + p.flowers, 0), total_amount: list.reduce((a, p) => a + p.amount, 0) };
    });
    res.json({ pending: all.filter((c) => c.status === 'pendiente'), buyers });
  }));

  // Aceptar: pasa a "Compradores" y sus datos quedan guardados comprimidos
  app.put('/api/admin/wholesale/:id/accept', auth, wrap(async (req, res) => {
    const { rows } = await q("select data from wholesalers where id = $1 and status = 'pendiente'", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Esa solicitud ya no está pendiente.' });
    const before = Buffer.byteLength(JSON.stringify(rows[0].data));
    const z = pack(rows[0].data);
    await q("update wholesalers set status = 'aceptado', decided_at = now(), data = null, data_z = $2 where id = $1", [req.params.id, z]);
    res.json({ ok: true, before, after: z.length });
  }));

  // Rechazar (o quitar un comprador): se borra todo, incluidas sus compras
  app.delete('/api/admin/wholesale/:id', auth, wrap(async (req, res) => {
    await q('delete from wholesalers where id = $1', [req.params.id]);
    res.json({ ok: true });
  }));

  app.post('/api/admin/wholesale/:id/purchases', auth, wrap(async (req, res) => {
    const flowers = Math.max(0, parseInt(req.body.flowers, 10) || 0);
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: 'El monto es inválido.' });
    if (flowers <= 0 && amount <= 0) return res.status(400).json({ error: 'Poné cuántas flores y/o cuánto dinero entró.' });
    const day = /^\d{4}-\d{2}-\d{2}$/.test(req.body.day || '') ? req.body.day : null;
    const ok = await q("select 1 from wholesalers where id = $1 and status = 'aceptado'", [req.params.id]);
    if (!ok.rowCount) return res.status(404).json({ error: 'Ese comprador no existe.' });
    const { rows } = await q(
      `insert into wholesale_purchases(wid, day, flowers, amount, note)
       values($1, coalesce($2::date, (now() at time zone 'America/Argentina/Mendoza')::date), $3, $4, $5) returning id`,
      [req.params.id, day, flowers, amount, txt(req.body.note, 200)]
    );
    res.json({ ok: true, id: rows[0].id });
  }));

  app.delete('/api/admin/wholesale/purchases/:pid', auth, wrap(async (req, res) => {
    await q('delete from wholesale_purchases where id = $1', [req.params.pid]);
    res.json({ ok: true });
  }));

  // El panel pregunta esto cada pocos segundos para avisar de solicitudes nuevas
  app.get('/api/admin/wholesale/poll', auth, wrap(async (req, res) => {
    const after = parseInt(req.query.after, 10) || 0;
    const [pending, max, news] = await Promise.all([
      q("select count(*)::int n from wholesalers where status = 'pendiente'"),
      q('select coalesce(max(id), 0)::int m from wholesalers'),
      q("select id, name, business, city from wholesalers where id > $1 and status = 'pendiente' order by id limit 10", [after]),
    ]);
    res.json({ pending: pending.rows[0].n, max: max.rows[0].m, news: news.rows });
  }));
}

module.exports = { mount, normPhone, cuitOk, pack, unpack };
