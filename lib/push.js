'use strict';
let webpush = null;
try { webpush = require('web-push'); } catch (e) { console.warn('web-push no disponible: no habrá notificaciones al celular.'); }

function mount({ app, q, auth, wrap }) {
  let ready = null;

  // Las claves de las notificaciones se crean solas la primera vez y quedan guardadas en la base
  async function init() {
    if (!webpush) return false;
    if (ready) return ready;
    ready = (async () => {
      let { rows } = await q('select pub, priv from push_keys where id = 1');
      if (!rows[0]) {
        const k = webpush.generateVAPIDKeys();
        await q('insert into push_keys(id, pub, priv) values(1, $1, $2) on conflict do nothing', [k.publicKey, k.privateKey]);
        ({ rows } = await q('select pub, priv from push_keys where id = 1'));
      }
      const subject = process.env.VAPID_SUBJECT || process.env.RENDER_EXTERNAL_URL || 'mailto:admin@florche.local';
      webpush.setVapidDetails(subject, rows[0].pub, rows[0].priv);
      return rows[0].pub;
    })().catch((e) => { console.error('notificaciones:', e.message); ready = null; return false; });
    return ready;
  }

  /* Manda una notificación a todos los celulares/computadoras que la activaron */
  async function notify(payload) {
    try {
      if (!(await init())) return { sent: 0, total: 0 };
      const { rows } = await q('select endpoint, p256dh, auth from push_subs');
      let sent = 0;
      await Promise.all(rows.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600, urgency: 'high', timeout: 10000 });
          sent++;
        } catch (e) {
          if (e.statusCode === 404 || e.statusCode === 410) await q('delete from push_subs where endpoint = $1', [s.endpoint]).catch(() => {});
          else console.warn('notificación no enviada:', e.statusCode || e.message);
        }
      }));
      return { sent, total: rows.length };
    } catch (e) {
      return { sent: 0, total: 0, error: e.message };
    }
  }

  app.get('/api/admin/push/key', auth, wrap(async (req, res) => {
    const key = await init();
    res.json({ supported: !!key, key: key || null });
  }));

  app.post('/api/admin/push/subscribe', auth, wrap(async (req, res) => {
    const s = (req.body && req.body.subscription) || {};
    const endpoint = String(s.endpoint || '');
    const p256dh = s.keys && String(s.keys.p256dh || '');
    const authKey = s.keys && String(s.keys.auth || '');
    if (!/^https:\/\//.test(endpoint) || !p256dh || !authKey) return res.status(400).json({ error: 'Suscripción inválida.' });
    await q(
      `insert into push_subs(endpoint, p256dh, auth, ua) values($1,$2,$3,$4)
       on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, ua = excluded.ua`,
      [endpoint, p256dh, authKey, String(req.headers['user-agent'] || '').slice(0, 200)]
    );
    res.json({ ok: true });
  }));

  app.post('/api/admin/push/unsubscribe', auth, wrap(async (req, res) => {
    await q('delete from push_subs where endpoint = $1', [String((req.body && req.body.endpoint) || '')]);
    res.json({ ok: true });
  }));

  app.get('/api/admin/push/status', auth, wrap(async (req, res) => {
    const n = await q('select count(*)::int n from push_subs');
    const mine = req.query.endpoint ? await q('select 1 from push_subs where endpoint = $1', [String(req.query.endpoint)]) : { rowCount: 0 };
    res.json({ count: n.rows[0].n, subscribed: mine.rowCount > 0 });
  }));

  app.post('/api/admin/push/test', auth, wrap(async (req, res) => {
    const r = await notify({ title: 'Florche.Eternas', body: 'Las notificaciones funcionan. Así te va a avisar cada pedido nuevo.', url: '/admin', tag: 'test' });
    res.json({ ok: true, ...r });
  }));

  return { notify };
}

module.exports = { mount };
