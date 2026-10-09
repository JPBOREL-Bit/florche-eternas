'use strict';
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

/* ------------------------------------------------------------------ */
/* Verificación del Gmail con "Iniciar sesión con Google"              */
/* ------------------------------------------------------------------ */
// GOOGLE_CERTS_URL solo se cambia en las pruebas automáticas.
const GOOGLE_CERTS_URL = process.env.GOOGLE_CERTS_URL || 'https://www.googleapis.com/oauth2/v3/certs';
const googleClientId = () => (process.env.GOOGLE_CLIENT_ID || '').trim();

let certCache = { at: 0, keys: [] };
async function loadCerts(force) {
  if (!force && certCache.keys.length && Date.now() - certCache.at < 3600e3) return certCache.keys;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 7000);
  try {
    const r = await fetch(GOOGLE_CERTS_URL, { signal: ac.signal });
    if (!r.ok) throw new Error('certs ' + r.status);
    const j = await r.json();
    certCache = { at: Date.now(), keys: Array.isArray(j.keys) ? j.keys : [] };
    return certCache.keys;
  } finally {
    clearTimeout(t);
  }
}

// Comprueba la firma real de Google, que el token sea para esta tienda y que el mail esté verificado.
async function verifyGoogleToken(idToken) {
  const cid = googleClientId();
  if (!cid) throw new Error('not_configured');
  const dec = jwt.decode(String(idToken || ''), { complete: true });
  if (!dec || !dec.header || dec.header.alg !== 'RS256' || !dec.header.kid) throw new Error('bad_token');
  let jwk = (await loadCerts(false)).find((k) => k.kid === dec.header.kid);
  if (!jwk) jwk = (await loadCerts(true)).find((k) => k.kid === dec.header.kid);
  if (!jwk) throw new Error('bad_token');
  const pem = crypto.createPublicKey({ key: jwk, format: 'jwk' }).export({ type: 'spki', format: 'pem' });
  const p = jwt.verify(idToken, pem, {
    algorithms: ['RS256'],
    audience: cid,
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
  });
  if (p.email_verified !== true && p.email_verified !== 'true') throw new Error('unverified');
  return p;
}

/* ------------------------------------------------------------------ */
/* Filtros de palabras y datos                                         */
/* ------------------------------------------------------------------ */
const DEFAULT_BANNED = 'fuck, shit, nazi, porn, scam, spam, fake, hack, asdf, qwert, troll, mierda, pelotud';

const plain = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
// "f4k3" -> "fake", "f.u.c.k" -> "fuck"
function squash(s) {
  return plain(s)
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't').replace(/@/g, 'a')
    .replace(/[^a-z]/g, '');
}
const wordList = (txt) => [...new Set(String(txt || '').split(/[,;\n]+/).map(squash).filter((w) => w.length >= 3))];

function gmailLocal(email) {
  const m = /^([a-z0-9._+-]{3,64})@(gmail\.com|googlemail\.com)$/i.exec(String(email || '').trim());
  return m ? m[1].toLowerCase() : null;
}
// a.b+x@gmail.com y ab@gmail.com son la misma cuenta
const emailKey = (local) => local.split('+')[0].replace(/\./g, '') + '@gmail.com';

function badEmail(local, words) {
  const sq = squash(local);
  if (words.some((w) => sq.includes(w))) return true;
  if (/(.)\1{4,}/.test(local)) return true;               // aaaaaa
  if ((local.match(/\d/g) || []).length > 8) return true; // demasiados números
  return false;
}
const badName = (name, words) => {
  const sq = squash(name);
  return words.some((w) => sq.includes(w));
};
function badComment(text, words) {
  const tokens = plain(text).split(/[^a-z0-9]+/).map(squash).filter(Boolean);
  return tokens.some((t) => words.includes(t));
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function maskName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  const first = Array.from(parts[0] || '');
  if (!first.length) return 'Cliente';
  const keep = first.length <= 2 ? 1 : Math.min(3, Math.ceil(first.length / 2));
  const stars = '*'.repeat(Math.max(2, Math.min(4, first.length - keep)));
  const last = parts[1] ? ' ' + Array.from(parts[1])[0].toUpperCase() + '.' : '';
  return cap(first.slice(0, keep).join('')) + stars + last;
}
function maskEmail(email) {
  const [local, domain] = String(email || '').split('@');
  const l = Array.from(local || '');
  const shown = l.length <= 3 ? l[0] + '***' : l.slice(0, 2).join('') + '***' + l[l.length - 1];
  return shown + '@' + (domain || 'gmail.com');
}

const publicReview = (r) => ({
  id: r.id,
  rating: r.rating,
  comment: r.comment,
  name: maskName(r.name),
  email: maskEmail(r.email),
  created_at: r.created_at,
  updated_at: r.updated_at,
});

/* ------------------------------------------------------------------ */
/* Rutas                                                               */
/* ------------------------------------------------------------------ */
function mount({ app, q, auth, wrap, rateOk, getSettings, jwtSecret }) {
  // Los tokens de reseña usan otra clave distinta a la del panel
  const reviewSecret = crypto.createHash('sha256').update('review:' + jwtSecret).digest('hex');

  async function summary() {
    const { rows } = await q(`
      select count(*)::int n, coalesce(round(avg(rating)::numeric, 1), 0) avg,
        count(*) filter (where rating = 5)::int s5, count(*) filter (where rating = 4)::int s4,
        count(*) filter (where rating = 3)::int s3, count(*) filter (where rating = 2)::int s2,
        count(*) filter (where rating = 1)::int s1
      from reviews where not hidden`);
    const r = rows[0];
    return { count: r.n, avg: Number(r.avg), dist: { 5: r.s5, 4: r.s4, 3: r.s3, 2: r.s2, 1: r.s1 } };
  }

  async function featured(limit = 14) {
    const { rows } = await q(
      `select id, rating, comment, name, email, created_at, updated_at from reviews
       where not hidden and comment <> '' order by updated_at desc limit $1`, [limit]);
    return rows.map(publicReview);
  }

  // Lo que necesita la tienda para dibujar la sección (se manda junto con /api/store)
  async function storeBlock() {
    const s = await getSettings();
    const google = googleClientId();
    const sum = await summary();
    const on = !!s.reviewsOn && (!!google || sum.count > 0);
    return { on, google, ...sum, featured: on ? await featured() : [] };
  }

  app.get('/api/reviews/summary', wrap(async (req, res) => {
    const s = await getSettings();
    const block = await storeBlock();
    res.set('Cache-Control', 'no-store');
    res.json({ ...block, store: { name: s.storeName, primaryColor: s.primaryColor, logoId: s.logoId } });
  }));

  app.get('/api/reviews', wrap(async (req, res) => {
    const stars = parseInt(req.query.stars, 10);
    const before = parseInt(req.query.before, 10);
    const limit = Math.max(1, Math.min(30, parseInt(req.query.limit, 10) || 15));
    const cond = ['not hidden'];
    const params = [];
    if (stars >= 1 && stars <= 5) { params.push(stars); cond.push(`rating = $${params.length}`); }
    if (req.query.comment === '1') cond.push("comment <> ''");
    if (before > 0) { params.push(before); cond.push(`id < $${params.length}`); }
    params.push(limit + 1);
    const { rows } = await q(
      `select id, rating, comment, name, email, created_at, updated_at from reviews
       where ${cond.join(' and ')} order by id desc limit $${params.length}`, params);
    const more = rows.length > limit;
    const items = rows.slice(0, limit).map(publicReview);
    res.set('Cache-Control', 'no-store');
    res.json({ items, next: more ? items[items.length - 1].id : null });
  }));

  // Paso 1: la clienta entra con Google y el servidor comprueba que el Gmail sea real
  app.post('/api/reviews/verify', wrap(async (req, res) => {
    if (!rateOk(req.ip, 'rvverify', 20, 10 * 60e3)) return res.status(429).json({ ok: false, message: 'Demasiados intentos. Esperá unos minutos.' });
    const s = await getSettings();
    if (!s.reviewsOn) return res.json({ ok: false, message: 'Las reseñas están desactivadas por ahora.' });
    let p;
    try {
      p = await verifyGoogleToken(req.body && req.body.credential);
    } catch (e) {
      const msg = {
        not_configured: 'Las reseñas todavía no están activadas en esta tienda.',
        unverified: 'Ese Gmail no está verificado por Google.',
      }[e.message] || 'No pudimos verificar tu cuenta de Google. Probá de nuevo.';
      return res.json({ ok: false, message: msg });
    }
    const local = gmailLocal(p.email);
    if (!local) return res.json({ ok: false, message: 'Tiene que ser un Gmail (terminado en @gmail.com).' });
    if (badEmail(local, wordList(s.reviewBannedWords))) {
      return res.json({ ok: false, message: 'Ese Gmail no está permitido. Usá otra cuenta.' });
    }
    const email = local + '@gmail.com';
    const token = jwt.sign({ purpose: 'review', email, name: String(p.name || '').slice(0, 60) }, reviewSecret, { expiresIn: '30m' });
    res.json({ ok: true, token, emailMasked: maskEmail(email), name: String(p.given_name || p.name || '').slice(0, 40) });
  }));

  // Paso 2: publicar la reseña
  app.post('/api/reviews', wrap(async (req, res) => {
    if (!rateOk(req.ip, 'rvpost', 10, 60 * 60e3)) return res.status(429).json({ ok: false, message: 'Demasiadas reseñas seguidas. Probá más tarde.' });
    const s = await getSettings();
    if (!s.reviewsOn) return res.json({ ok: false, message: 'Las reseñas están desactivadas por ahora.' });
    const b = req.body || {};
    let t;
    try {
      t = jwt.verify(String(b.token || ''), reviewSecret);
      if (t.purpose !== 'review') throw new Error('x');
    } catch {
      return res.json({ ok: false, message: 'Tu verificación de Gmail venció. Volvé a verificar tu cuenta.' });
    }
    const rating = parseInt(b.rating, 10);
    if (!(rating >= 1 && rating <= 5)) return res.json({ ok: false, message: 'Elegí de 1 a 5 estrellas.' });
    const name = String(b.name || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!/\p{L}{2,}/u.test(name)) return res.json({ ok: false, message: 'Escribí tu nombre.' });
    const comment = String(b.comment || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, 600);
    const words = wordList(s.reviewBannedWords);
    const local = gmailLocal(t.email);
    if (!local || badEmail(local, words)) return res.json({ ok: false, message: 'Ese Gmail no está permitido.' });
    if (badName(name, words)) return res.json({ ok: false, message: 'Ese nombre no está permitido.' });
    if (comment && badComment(comment, words)) return res.json({ ok: false, message: 'Tu comentario tiene palabras que no se pueden publicar. Probá reescribirlo.' });

    // Una reseña por cuenta de Gmail: si vuelve a opinar, se actualiza la anterior
    const { rows } = await q(
      `insert into reviews(email, email_key, name, rating, comment) values($1,$2,$3,$4,$5)
       on conflict (email_key) do update set name = excluded.name, rating = excluded.rating,
         comment = excluded.comment, updated_at = now(), hidden = false
       returning id, (xmax = 0) as inserted`,
      [t.email, emailKey(local), name, rating, comment]
    );
    res.json({ ok: true, updated: !rows[0].inserted });
  }));

  /* Panel de administración */
  app.get('/api/admin/reviews', auth, wrap(async (req, res) => {
    const { rows } = await q('select id, created_at, updated_at, email, name, rating, comment, hidden from reviews order by id desc limit 500');
    const all = await q('select count(*)::int n, coalesce(round(avg(rating)::numeric,1),0) avg from reviews where not hidden');
    res.json({
      rows,
      avg: Number(all.rows[0].avg),
      count: all.rows[0].n,
      google: { configured: !!googleClientId(), clientId: googleClientId() },
      defaultBanned: DEFAULT_BANNED,
    });
  }));
  app.put('/api/admin/reviews/:id', auth, wrap(async (req, res) => {
    await q('update reviews set hidden = $2 where id = $1', [req.params.id, !!req.body.hidden]);
    res.json({ ok: true });
  }));
  app.delete('/api/admin/reviews/:id', auth, wrap(async (req, res) => {
    await q('delete from reviews where id = $1', [req.params.id]);
    res.json({ ok: true });
  }));

  /* Favoritos: un voto por dispositivo (se identifica con un código guardado en el navegador) */
  app.post('/api/likes', wrap(async (req, res) => {
    if (!rateOk(req.ip, 'like', 40, 60e3)) return res.status(429).json({ ok: false });
    const pid = parseInt(req.body.pid, 10);
    const vid = String(req.body.vid || '').replace(/[^a-z0-9]/gi, '').slice(0, 40);
    if (!Number.isInteger(pid) || vid.length < 6) return res.status(400).json({ ok: false });
    const exists = await q('select 1 from products where id = $1 and active', [pid]);
    if (!exists.rowCount) return res.status(404).json({ ok: false });
    if (req.body.on === false) await q('delete from likes where pid = $1 and vid = $2', [pid, vid]);
    else await q('insert into likes(pid, vid) values($1,$2) on conflict do nothing', [pid, vid]);
    const c = await q('select count(*)::int n from likes where pid = $1', [pid]);
    res.json({ ok: true, liked: req.body.on !== false, count: c.rows[0].n });
  }));

  return { storeBlock };
}

module.exports = { mount, DEFAULT_BANNED, maskName, maskEmail, gmailLocal, emailKey, badEmail, wordList };
