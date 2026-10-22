'use strict';
const crypto = require('crypto');
const { promisify } = require('util');
const { normPhone } = require('./wholesale.js');
const reviews = require('./reviews.js');

const scrypt = promisify(crypto.scrypt);
const COOKIE = 'fl_acc';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const COMMON = new Set(['12345678', '123456789', '1234567890', 'password', 'password1', 'contraseña', 'qwertyui', 'qwerty123', 'abcd1234', '11111111', '00000000', 'florche123', 'iloveyou', '87654321']);

const txt = (v, max) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/* ---------- contraseñas (se guardan cifradas con scrypt, nunca en texto) ---------- */
async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString('base64')}$${h.toString('base64')}`;
}
async function checkPassword(pw, stored) {
  const [alg, s, h] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !s || !h) return false;
  const exp = Buffer.from(h, 'base64');
  const got = await scrypt(pw, Buffer.from(s, 'base64'), exp.length);
  return got.length === exp.length && crypto.timingSafeEqual(got, exp);
}
function passwordProblem(pw, ident) {
  if (pw.length < 8) return 'La contraseña tiene que tener al menos 8 caracteres.';
  if (pw.length > 72) return 'La contraseña es demasiado larga (máximo 72).';
  if (COMMON.has(pw.toLowerCase()) || (ident && pw.toLowerCase() === String(ident).toLowerCase())) return 'Esa contraseña es muy fácil de adivinar. Elegí otra.';
  return null;
}
const TEMP_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const tempPassword = () => Array.from({ length: 10 }, () => TEMP_CHARS[crypto.randomInt(TEMP_CHARS.length)]).join('');

/* ---------- dispositivo (modelo de celular o computadora) ---------- */
function deviceOf(req, fromClient) {
  const ua = String(req.headers['user-agent'] || '');
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
  let model = '';
  const client = txt(fromClient, 60);
  if (client.length > 1 && client !== 'K') model = client;
  else if (/iPhone/.test(ua)) { const m = /OS (\d+)[_.]/.exec(ua); model = 'iPhone' + (m ? ` (iOS ${m[1]})` : ''); }
  else if (/iPad/.test(ua)) model = 'iPad';
  else if (/Android/.test(ua)) {
    const m = /Android[^;)]*;\s*([^;)]+?)(?:\sBuild|\)|;)/.exec(ua);
    const mod = m && m[1].trim();
    const v = /Android (\d+)/.exec(ua);
    model = (mod && mod !== 'K' && mod.length > 1 ? mod : 'Android') + (v ? ` (Android ${v[1]})` : '');
  } else if (/Windows/.test(ua)) model = 'PC con Windows';
  else if (/Macintosh/.test(ua)) model = 'Mac';
  else if (/Linux/.test(ua)) model = 'PC con Linux';
  else model = 'Desconocido';
  return (browser ? `${model} · ${browser}` : model).slice(0, 100);
}

function mount({ app, q, auth, wrap, rateOk, jwtSecret, notify }) {
  const SECRET = 'acc:' + jwtSecret;

  /* ---------- sesión: cookie firmada, solo del servidor (HttpOnly) ---------- */
  const b64u = (b) => Buffer.from(b).toString('base64url');
  const sign = (payload) => {
    const body = b64u(JSON.stringify(payload));
    return body + '.' + crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  };
  function verify(tok) {
    const [body, mac] = String(tok || '').split('.');
    if (!body || !mac) return null;
    const exp = crypto.createHmac('sha256', SECRET).update(body).digest();
    const got = Buffer.from(mac, 'base64url');
    if (got.length !== exp.length || !crypto.timingSafeEqual(got, exp)) return null;
    try { const p = JSON.parse(Buffer.from(body, 'base64url').toString()); return p.exp > Date.now() ? p : null; } catch { return null; }
  }
  const readCookie = (req, name) => {
    const m = String(req.headers.cookie || '').split(';').map((c) => c.trim()).find((c) => c.startsWith(name + '='));
    return m ? decodeURIComponent(m.slice(name.length + 1)) : '';
  };
  const setSession = (req, res, acc) => {
    res.cookie(COOKIE, sign({ a: acc.id, v: acc.token_ver, exp: Date.now() + 30 * 864e5 }), {
      httpOnly: true, sameSite: 'lax', path: '/', maxAge: 30 * 864e5,
      secure: req.secure || String(req.headers['x-forwarded-proto'] || '').includes('https'),
    });
  };

  async function getAccount(req) {
    if (req._acc !== undefined) return req._acc;
    const p = verify(readCookie(req, COOKIE));
    let acc = null;
    if (p) {
      const { rows } = await q('select * from accounts where id = $1', [p.a]);
      if (rows[0] && rows[0].token_ver === p.v && rows[0].status === 'activa') acc = rows[0];
    }
    req._acc = acc;
    return acc;
  }

  const pub = (a) => ({
    id: a.id, name: a.name, username: a.username, email: a.email, phone: a.phone, address: a.address || '',
    google: !!a.google_sub, mustChange: !!a.must_change, needPhone: !a.phone,
  });
  const fail = (res, field, message, status = 400) => res.status(status).json({ ok: false, field, message });
  const googleId = () => (process.env.GOOGLE_CLIENT_ID || '').trim();

  /* intentos fallidos de ingreso: 6 seguidos y se frena 15 minutos */
  const fails = new Map();
  const locked = (k) => { const f = fails.get(k); return f && f.n >= 6 && f.until > Date.now(); };
  const addFail = (k) => { const f = fails.get(k) || { n: 0, until: 0 }; f.n += 1; f.until = Date.now() + 15 * 60e3; fails.set(k, f); if (fails.size > 5000) fails.clear(); };

  /* ------------------------- Público ------------------------- */
  app.get('/api/account/me', wrap(async (req, res) => {
    const a = await getAccount(req);
    res.set('Cache-Control', 'no-store');
    res.json({ account: a ? pub(a) : null, google: googleId() });
  }));

  app.post('/api/account/register', wrap(async (req, res) => {
    if (!rateOk(req.ip, 'acc_reg', 8, 3600e3)) return fail(res, '', 'Creaste varias cuentas seguidas. Probá más tarde.', 429);
    const b = req.body || {};
    const ident = txt(b.ident, 120).toLowerCase();
    let username = null, email = null;
    if (ident.includes('@')) {
      if (!EMAIL.test(ident)) return fail(res, 'ident', 'Revisá tu email.');
      email = ident;
    } else {
      if (!/^[a-z0-9_.-]{3,24}$/.test(ident)) return fail(res, 'ident', 'El usuario tiene que tener entre 3 y 24 letras o números (sin espacios). Puede llevar punto, guión o guión bajo.');
      username = ident;
    }
    const pw = String(b.password || '');
    const pe = passwordProblem(pw, ident);
    if (pe) return fail(res, 'password', pe);
    const name = txt(b.name, 80);
    if (name.length < 2) return fail(res, 'name', 'Escribí tu nombre.');
    const phone = normPhone(b.phone);
    if (!phone) return fail(res, 'phone', 'Revisá tu número de WhatsApp (por ejemplo 261 456 7890).');
    const dup = await q('select 1 from accounts where lower(username) = $1 or lower(email) = $1', [ident]);
    if (dup.rowCount) return fail(res, 'ident', 'Ya existe una cuenta con ese usuario o email. Probá ingresar.', 409);
    const dev = deviceOf(req, b.device);
    const hash = await hashPassword(pw);
    const { rows } = await q(
      `insert into accounts(username, email, pass_hash, name, phone, device, last_device, last_login)
       values($1,$2,$3,$4,$5,$6,$6, now()) returning *`, [username, email, hash, name, phone, dev]);
    setSession(req, res, rows[0]);
    res.json({ ok: true, account: pub(rows[0]) });
  }));

  app.post('/api/account/login', wrap(async (req, res) => {
    const b = req.body || {};
    const ident = txt(b.ident, 120).toLowerCase();
    const pw = String(b.password || '').slice(0, 200);
    const key = ident + '|' + req.ip;
    if (locked(key) || locked('ip|' + req.ip)) return fail(res, '', 'Hiciste muchos intentos. Esperá 15 minutos o recuperá tu contraseña.', 429);
    const { rows } = await q('select * from accounts where lower(username) = $1 or lower(email) = $1 limit 1', [ident]);
    const acc = rows[0];
    // si no existe, igual se hace el cálculo para que tarde lo mismo
    const okPw = acc && acc.pass_hash ? await checkPassword(pw, acc.pass_hash) : (await checkPassword(pw, 'scrypt$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64')), false);
    if (!okPw) { addFail(key); addFail('ip|' + req.ip); return fail(res, '', 'Usuario o contraseña incorrectos.', 401); }
    if (acc.status !== 'activa') return fail(res, '', 'Tu cuenta fue bloqueada. Escribinos por WhatsApp para resolverlo.', 403);
    fails.delete(key);
    const dev = deviceOf(req, b.device);
    await q('update accounts set last_login = now(), last_device = $2 where id = $1', [acc.id, dev]);
    setSession(req, res, acc);
    res.json({ ok: true, account: pub(acc) });
  }));

  app.post('/api/account/google', wrap(async (req, res) => {
    if (!rateOk(req.ip, 'acc_google', 20, 10 * 60e3)) return fail(res, '', 'Demasiados intentos. Esperá unos minutos.', 429);
    let p;
    try { p = await reviews.verifyGoogleToken(req.body && req.body.credential); } catch (e) {
      return fail(res, '', e.message === 'not_configured' ? 'El ingreso con Google todavía no está activado.' : e.message === 'unverified' ? 'Ese email no está verificado por Google.' : 'No pudimos verificar tu cuenta de Google. Probá de nuevo.', 401);
    }
    const email = String(p.email || '').toLowerCase();
    const dev = deviceOf(req, req.body && req.body.device);
    let { rows } = await q('select * from accounts where google_sub = $1', [String(p.sub)]);
    let acc = rows[0];
    if (!acc && email) {
      ({ rows } = await q('select * from accounts where lower(email) = $1', [email]));
      acc = rows[0];
      if (acc) {
        // Google confirma que el email es de esta persona: se vincula y se anula cualquier contraseña anterior (por si alguien lo registró antes)
        await q('update accounts set google_sub = $2, pass_hash = null, must_change = false, token_ver = token_ver + 1 where id = $1', [acc.id, String(p.sub)]);
        acc = (await q('select * from accounts where id = $1', [acc.id])).rows[0];
      }
    }
    if (!acc) {
      const name = txt(p.name || p.given_name || email.split('@')[0], 80) || 'Cliente';
      acc = (await q('insert into accounts(email, google_sub, name, device, last_device, last_login) values($1,$2,$3,$4,$4, now()) returning *', [email || null, String(p.sub), name, dev])).rows[0];
    }
    if (acc.status !== 'activa') return fail(res, '', 'Tu cuenta fue bloqueada. Escribinos por WhatsApp para resolverlo.', 403);
    await q('update accounts set last_login = now(), last_device = $2 where id = $1', [acc.id, dev]);
    setSession(req, res, acc);
    res.json({ ok: true, account: pub(acc) });
  }));

  app.post('/api/account/logout', wrap(async (req, res) => {
    res.clearCookie(COOKIE, { path: '/' });
    res.json({ ok: true });
  }));

  const needLogin = async (req, res) => {
    const a = await getAccount(req);
    if (!a) { res.status(401).json({ ok: false, message: 'Ingresá a tu cuenta.' }); return null; }
    return a;
  };

  app.put('/api/account/me', wrap(async (req, res) => {
    const a = await needLogin(req, res); if (!a) return;
    if (a.must_change) return fail(res, '', 'Primero creá tu contraseña nueva.', 403);
    const b = req.body || {};
    const name = txt(b.name, 80);
    if (name.length < 2) return fail(res, 'name', 'Escribí tu nombre.');
    const phone = normPhone(b.phone);
    if (!phone) return fail(res, 'phone', 'Revisá tu número de WhatsApp (por ejemplo 261 456 7890).');
    const { rows } = await q('update accounts set name = $2, phone = $3, address = $4 where id = $1 returning *', [a.id, name, phone, txt(b.address, 200) || null]);
    res.json({ ok: true, account: pub(rows[0]) });
  }));

  app.post('/api/account/password', wrap(async (req, res) => {
    const a = await needLogin(req, res); if (!a) return;
    if (!rateOk(req.ip, 'acc_pw', 10, 3600e3)) return fail(res, '', 'Demasiados intentos. Probá más tarde.', 429);
    const next = String(req.body && req.body.next || '');
    if (!a.must_change) {
      if (!a.pass_hash) return fail(res, '', 'Tu cuenta entra con Google: no tiene contraseña.');
      if (!(await checkPassword(String(req.body.current || ''), a.pass_hash))) return fail(res, 'current', 'La contraseña actual no es correcta.');
    }
    const pe = passwordProblem(next, a.username || a.email);
    if (pe) return fail(res, 'next', pe);
    if (a.pass_hash && (await checkPassword(next, a.pass_hash))) return fail(res, 'next', 'La contraseña nueva tiene que ser distinta de la anterior.');
    const { rows } = await q('update accounts set pass_hash = $2, must_change = false, token_ver = token_ver + 1 where id = $1 returning *', [a.id, await hashPassword(next)]);
    setSession(req, res, rows[0]);
    res.json({ ok: true, account: pub(rows[0]) });
  }));

  app.get('/api/account/orders', wrap(async (req, res) => {
    const a = await needLogin(req, res); if (!a) return;
    if (a.must_change) return fail(res, '', 'Primero creá tu contraseña nueva.', 403);
    const { rows } = await q('select id, created_at, status, total, items, delivery, paid from orders where account_id = $1 order by id desc limit 50', [a.id]);
    res.json({ ok: true, orders: rows.map((o) => ({ id: o.id, created_at: o.created_at, status: o.status, total: Number(o.total), delivery: o.delivery, paid: !!o.paid, items: (o.items || []).map((i) => ({ name: i.name, qty: i.qty })) })) });
  }));

  /* "Olvidé mi contraseña": no se le muestra nada de la cuenta; le llega a la dueña al panel */
  app.post('/api/account/forgot', wrap(async (req, res) => {
    if (!rateOk(req.ip, 'acc_forgot', 5, 3600e3)) return fail(res, '', 'Hiciste varios pedidos seguidos. Probá más tarde.', 429);
    const b = req.body || {};
    const ident = txt(b.ident, 120).toLowerCase();
    if (ident.length < 3) return fail(res, 'ident', 'Escribí tu usuario o tu email.');
    const phone = normPhone(b.phone);
    if (!phone) return fail(res, 'phone', 'Revisá tu número de WhatsApp (por ejemplo 261 456 7890).');
    const acc = (await q('select id from accounts where lower(username) = $1 or lower(email) = $1 limit 1', [ident])).rows[0];
    const open = acc
      ? await q('select id from password_resets where account_id = $1 limit 1', [acc.id])
      : await q('select id from password_resets where account_id is null and ident = $1 and phone = $2 limit 1', [ident, phone]);
    if (open.rowCount) {
      await q("update password_resets set phone = $2, ident = $3, created_at = now(), status = 'pendiente' where id = $1", [open.rows[0].id, phone, ident]);
    } else {
      const n = (await q('select count(*)::int n from password_resets')).rows[0].n;
      if (n < 300) await q('insert into password_resets(account_id, ident, phone) values($1,$2,$3)', [acc ? acc.id : null, ident, phone]);
      if (notify) notify({ title: 'Olvidó su contraseña', body: `${ident} · +${phone}`, url: '/admin', tag: 'reset' }).catch(() => {});
    }
    res.json({ ok: true });
  }));

  /* ------------------------- Panel ------------------------- */
  app.get('/api/admin/accounts', auth, wrap(async (req, res) => {
    const { rows } = await q(`select a.id, a.username, a.email, a.google_sub is not null as google, a.name, a.phone, a.address, a.status,
        a.device, a.last_device, a.created_at, a.last_login, a.must_change,
        (select count(*)::int from orders o where o.account_id = a.id) as orders
      from accounts a order by a.id desc`);
    res.json({ accounts: rows });
  }));

  app.put('/api/admin/accounts/:id/block', auth, wrap(async (req, res) => {
    const blocked = !!(req.body && req.body.blocked);
    await q('update accounts set status = $2, token_ver = token_ver + 1 where id = $1', [req.params.id, blocked ? 'bloqueada' : 'activa']);
    res.json({ ok: true });
  }));

  app.delete('/api/admin/accounts/:id', auth, wrap(async (req, res) => {
    await q('delete from accounts where id = $1', [req.params.id]);
    res.json({ ok: true });
  }));

  app.get('/api/admin/resets', auth, wrap(async (req, res) => {
    const { rows } = await q(`select r.id, r.ident, r.phone, r.status, r.created_at, r.account_id,
        a.username, a.email, a.name, a.phone as acc_phone, a.created_at as acc_created, a.status as acc_status
      from password_resets r left join accounts a on a.id = r.account_id order by r.created_at desc`);
    res.json({ resets: rows });
  }));

  // Crear contraseña temporal: la elegís vos (o se genera una). Al entrar, la clienta tiene que cambiarla.
  app.post('/api/admin/resets/:id/password', auth, wrap(async (req, res) => {
    const r = (await q('select account_id from password_resets where id = $1', [req.params.id])).rows[0];
    if (!r) return res.status(404).json({ error: 'Esa solicitud ya no existe.' });
    if (!r.account_id) return res.status(400).json({ error: 'No se encontró una cuenta con ese usuario o email, así que no hay a quién crearle la contraseña.' });
    let pw = String((req.body && req.body.password) || '').trim();
    if (!pw) pw = tempPassword();
    else if (pw.length < 8 || pw.length > 72) return res.status(400).json({ error: 'La contraseña temporal tiene que tener entre 8 y 72 caracteres.' });
    await q('update accounts set pass_hash = $2, must_change = true, token_ver = token_ver + 1 where id = $1', [r.account_id, await hashPassword(pw)]);
    await q("update password_resets set status = 'con_clave' where id = $1", [req.params.id]);
    res.json({ ok: true, password: pw });
  }));

  // Finalizado y Rechazar: la solicitud se borra
  app.post('/api/admin/resets/:id/done', auth, wrap(async (req, res) => { await q('delete from password_resets where id = $1', [req.params.id]); res.json({ ok: true }); }));
  app.delete('/api/admin/resets/:id', auth, wrap(async (req, res) => { await q('delete from password_resets where id = $1', [req.params.id]); res.json({ ok: true }); }));

  app.get('/api/admin/accounts/poll', auth, wrap(async (req, res) => {
    const after = parseInt(req.query.after, 10) || 0;
    const [pending, max, news] = await Promise.all([
      q("select count(*)::int n from password_resets where status = 'pendiente'"),
      q('select coalesce(max(id), 0)::int m from password_resets'),
      q("select id, ident from password_resets where id > $1 and status = 'pendiente' order by id limit 10", [after]),
    ]);
    res.json({ pending: pending.rows[0].n, max: max.rows[0].m, news: news.rows });
  }));

  return { getAccount };
}

module.exports = { mount, deviceOf, passwordProblem };
