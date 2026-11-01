'use strict';

const TZ = 'America/Argentina/Mendoza';
const KEEP_DAYS = 90;                       // los registros sueltos de visitas se guardan 90 días
const FREE_LIMIT = 500 * 1024 * 1024;       // límite de la base gratis de Supabase

// Los registros de visitas más viejos se resumen por día (misma información para el panel, mucho menos espacio)
const CUTOFF = `((date_trunc('day', now() at time zone '${TZ}') - interval '${KEEP_DAYS} days') at time zone '${TZ}')`;

const GROUPS = [
  ['Fotos', ['images']],
  ['Visitas y estadísticas', ['events', 'events_daily']],
  ['Pedidos', ['orders']],
  ['Reseñas', ['reviews']],
  ['Mayoristas', ['wholesalers', 'wholesale_purchases']],
  ['Productos, cupones y ajustes', ['products', 'categories', 'settings', 'coupons', 'likes', 'postal_codes', 'calc_materials', 'calc_products', 'calc_config']],
];

function mount({ app, q, auth, wrap, pool, cleanupImages }) {
  async function report() {
    const { rows } = await q(`select c.relname, pg_total_relation_size(c.oid)::bigint bytes
      from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'`);
    const size = Object.fromEntries(rows.map((r) => [r.relname, Number(r.bytes)]));
    const db = (await q('select pg_database_size(current_database())::bigint b')).rows[0].b;
    const raw = (await q('select count(*)::int n from events')).rows[0].n;
    const tables = GROUPS.map(([label, names]) => ({ label, bytes: names.reduce((a, n) => a + (size[n] || 0), 0) }));
    return { total: Number(db), limit: FREE_LIMIT, tables, events_raw: raw, keep_days: KEEP_DAYS };
  }

  async function rollupEvents() {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(`
        insert into events_daily(day, type, pid, n, uvid, usid)
        select (ts at time zone '${TZ}')::date, type, coalesce(pid, 0), count(*)::int, count(distinct vid)::int, count(distinct sid)::int
        from events where ts < ${CUTOFF} group by 1, 2, 3
        on conflict (day, type, pid) do update set
          n = events_daily.n + excluded.n, uvid = events_daily.uvid + excluded.uvid, usid = events_daily.usid + excluded.usid`);
      const del = await client.query(`delete from events where ts < ${CUTOFF}`);
      await client.query('commit');
      await q('vacuum events').catch(() => {});   // devuelve el espacio liberado
      return del.rowCount;
    } catch (e) {
      await client.query('rollback').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }

  async function run() {
    const before = await report();
    const rolled = await rollupEvents();
    await cleanupImages();
    const after = await report();
    return { rolled, before: before.total, after: after.total };
  }

  app.get('/api/admin/storage', auth, wrap(async (req, res) => res.json(await report())));
  app.post('/api/admin/storage/compress', auth, wrap(async (req, res) => res.json({ ok: true, ...(await run()) })));

  return { run, report };
}

module.exports = { mount };
