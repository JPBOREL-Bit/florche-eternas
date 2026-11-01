'use strict';

const TZ = 'America/Argentina/Mendoza';
const TYPES = ['visit', 'product_view', 'add_to_cart', 'cart_open'];

function mount({ app, q, auth, wrap, rateOk }) {
  /* Público: eventos de la tienda (visita, vio un producto, agregó al carrito) */
  app.post('/api/track', (req, res) => {
    res.status(204).end();
    try {
      if (!rateOk(req.ip, 'track', 240, 60e3)) return;
      const b = req.body || {};
      const type = String(b.type || '');
      const vid = String(b.vid || '').replace(/[^a-z0-9]/gi, '').slice(0, 40);
      const sid = String(b.sid || '').replace(/[^a-z0-9]/gi, '').slice(0, 40);
      if (!TYPES.includes(type) || vid.length < 6 || sid.length < 6) return;
      const pid = Number.isInteger(parseInt(b.pid, 10)) ? parseInt(b.pid, 10) : null;
      const qty = Math.max(1, Math.min(99, parseInt(b.qty, 10) || 1));
      const src = type === 'visit' && /^[a-z0-9_.-]{1,24}$/i.test(String(b.src || '')) ? String(b.src).toLowerCase() : null;
      q('insert into events(vid, sid, type, pid, qty, src) values($1,$2,$3,$4,$5,$6)', [vid, sid, type, pid, qty, src]).catch(() => {});
    } catch (e) { /* las estadísticas nunca rompen la tienda */ }
  });

  const dayStart = `(date_trunc('day', now() at time zone '${TZ}') at time zone '${TZ}')`;
  const FROM = {
    today: dayStart,
    '7d': `(${dayStart} - interval '6 days')`,
    '30d': `(${dayStart} - interval '29 days')`,
    all: 'to_timestamp(0)',
  };

  app.get('/api/admin/stats', auth, wrap(async (req, res) => {
    const range = FROM[req.query.range] ? req.query.range : '7d';
    const from = FROM[range];
    const chartDays = range === '30d' || range === 'all' ? 29 : 6;

    const [ev, sent, decided, pending, allRev, series, prodEv, prodOrd, prods, likesRows, whRange, whAll, rollRows, rollProd] = await Promise.all([
      q(`select
           count(distinct vid) filter (where type = 'visit')::int visitors,
           count(distinct sid) filter (where type = 'visit')::int sessions,
           count(*) filter (where type = 'product_view')::int product_views,
           count(distinct sid) filter (where type = 'product_view')::int product_viewers,
           count(*) filter (where type = 'add_to_cart')::int cart_adds,
           count(distinct sid) filter (where type = 'add_to_cart')::int carts,
           count(distinct sid) filter (where type = 'cart_open')::int cart_opens
         from events where ts >= ${from}`),
      q(`select count(*)::int n from orders where created_at >= ${from}`),
      q(`select status, count(*)::int n, coalesce(sum(total), 0) total
         from orders where decided_at >= ${from} and status in ('realizada','rechazada') group by status`),
      q("select count(*)::int n from orders where status = 'pendiente'"),
      q("select coalesce(sum(total), 0) t, count(*)::int n from orders where status = 'realizada'"),
      q(`with days as (
           select generate_series((now() at time zone '${TZ}')::date - ${chartDays}, (now() at time zone '${TZ}')::date, interval '1 day')::date d
         )
         select to_char(d, 'YYYY-MM-DD') as day,
           (select count(distinct vid) from events e where e.type = 'visit' and (e.ts at time zone '${TZ}')::date = d)::int visitors,
           (select count(*) from orders o where (o.created_at at time zone '${TZ}')::date = d)::int orders,
           ((select coalesce(sum(total), 0) from orders o where o.status = 'realizada' and (o.decided_at at time zone '${TZ}')::date = d)
            + (select coalesce(sum(amount), 0) from wholesale_purchases w where w.day = d)) revenue
         from days order by d`),
      q(`select pid,
           count(*) filter (where type = 'product_view')::int views,
           count(distinct sid) filter (where type = 'product_view')::int viewers,
           count(*) filter (where type = 'add_to_cart')::int adds,
           count(distinct sid) filter (where type = 'add_to_cart')::int adders
         from events where pid is not null and ts >= ${from} group by pid`),
      q(`select (i->>'pid')::int pid,
           count(distinct o.id)::int orders,
           coalesce(sum((i->>'qty')::int) filter (where o.status = 'realizada'), 0)::int sold,
           coalesce(sum((i->>'line')::numeric) filter (where o.status = 'realizada'), 0) revenue
         from orders o, jsonb_array_elements(o.items) i
         where o.created_at >= ${from} group by 1`),
      q('select id, name from products order by position, id'),
      q('select pid, count(*)::int n from likes group by pid'),
      q(`select coalesce(sum(amount), 0) revenue, coalesce(sum(flowers), 0)::int flowers, count(*)::int n
         from wholesale_purchases where day >= (${from} at time zone '${TZ}')::date`),
      q('select coalesce(sum(amount), 0) revenue, coalesce(sum(flowers), 0)::int flowers, count(*)::int n from wholesale_purchases'),
      range === 'all'
        ? q('select type, coalesce(sum(n), 0)::int n, coalesce(sum(uvid), 0)::int uvid, coalesce(sum(usid), 0)::int usid from events_daily group by type')
        : Promise.resolve({ rows: [] }),
      range === 'all'
        ? q(`select pid, coalesce(sum(n) filter (where type = 'product_view'), 0)::int views,
               coalesce(sum(usid) filter (where type = 'product_view'), 0)::int viewers,
               coalesce(sum(n) filter (where type = 'add_to_cart'), 0)::int adds,
               coalesce(sum(usid) filter (where type = 'add_to_cart'), 0)::int adders
             from events_daily where pid > 0 group by pid`)
        : Promise.resolve({ rows: [] }),
    ]);

    // De dónde llegaron las visitas (solo de los últimos 90 días, mientras se guardan los registros sueltos)
    const [srcV, srcO] = await Promise.all([
      q(`select v.src, count(*)::int visits, count(c.sid)::int carts
         from (select distinct on (sid) sid, coalesce(src, 'directo') src from events where type = 'visit' and ts >= ${from} order by sid, ts) v
         left join (select distinct sid from events where type = 'add_to_cart' and ts >= ${from}) c on c.sid = v.sid
         group by v.src`),
      q(`select coalesce(v.src, 'directo') src, count(*)::int orders,
           count(*) filter (where o.status = 'realizada')::int sales,
           coalesce(sum(o.total) filter (where o.status = 'realizada'), 0) revenue
         from orders o
         left join (select distinct on (sid) sid, src from events where type = 'visit' order by sid, ts) v on v.sid = o.sid
         where o.created_at >= ${from} group by 1`),
    ]);
    const srcMap = {};
    for (const r of srcV.rows) srcMap[r.src] = { src: r.src, visits: r.visits, carts: r.carts, orders: 0, sales: 0, revenue: 0 };
    for (const r of srcO.rows) {
      const x = srcMap[r.src] || (srcMap[r.src] = { src: r.src, visits: 0, carts: 0, orders: 0, sales: 0, revenue: 0 });
      x.orders = r.orders; x.sales = r.sales; x.revenue = Number(r.revenue);
    }
    const sources = Object.values(srcMap).sort((a, b) => b.visits - a.visits || b.orders - a.orders);

    const e = { ...ev.rows[0] };
    // Visitas de hace más de 90 días: están resumidas por día (se suman al total histórico)
    const R = Object.fromEntries(rollRows.rows.map((x) => [x.type, x]));
    if (range === 'all') {
      e.visitors += (R.visit || {}).uvid || 0;
      e.sessions += (R.visit || {}).usid || 0;
      e.product_views += (R.product_view || {}).n || 0;
      e.product_viewers += (R.product_view || {}).usid || 0;
      e.cart_adds += (R.add_to_cart || {}).n || 0;
      e.carts += (R.add_to_cart || {}).usid || 0;
      e.cart_opens += (R.cart_open || {}).usid || 0;
    }
    const d = Object.fromEntries(decided.rows.map((r) => [r.status, r]));
    const done = d.realizada ? d.realizada.n : 0;
    const revenue = d.realizada ? Number(d.realizada.total) : 0;

    const byEv = Object.fromEntries(prodEv.rows.map((r) => [r.pid, { ...r }]));
    for (const r of rollProd.rows) {
      const x = byEv[r.pid] || (byEv[r.pid] = { views: 0, viewers: 0, adds: 0, adders: 0 });
      x.views += r.views; x.viewers += r.viewers; x.adds += r.adds; x.adders += r.adders;
    }
    const byOrd = Object.fromEntries(prodOrd.rows.map((r) => [r.pid, r]));
    const byLike = Object.fromEntries(likesRows.rows.map((r) => [r.pid, r.n]));
    const products = prods.rows
      .map((p) => {
        const a = byEv[p.id] || {};
        const o = byOrd[p.id] || {};
        return {
          id: p.id, name: p.name,
          views: a.views || 0, viewers: a.viewers || 0, adds: a.adds || 0, adders: a.adders || 0,
          orders: o.orders || 0, sold: o.sold || 0, revenue: Number(o.revenue || 0),
          likes: byLike[p.id] || 0,
        };
      })
      .sort((x, y) => y.views - x.views || y.adds - x.adds);

    res.json({
      range,
      visitors: e.visitors, sessions: e.sessions,
      product_views: e.product_views, product_viewers: e.product_viewers,
      cart_adds: e.cart_adds, carts: e.carts, cart_opens: e.cart_opens,
      orders_sent: sent.rows[0].n,
      sales: { done, rejected: d.rechazada ? d.rechazada.n : 0, revenue },
      wholesale: { revenue: Number(whRange.rows[0].revenue), flowers: whRange.rows[0].flowers, purchases: whRange.rows[0].n },
      all_time_wholesale: { revenue: Number(whAll.rows[0].revenue), flowers: whAll.rows[0].flowers, purchases: whAll.rows[0].n },
      pending: pending.rows[0].n,
      all_time: { revenue: Number(allRev.rows[0].t), sales: allRev.rows[0].n },
      series: series.rows.map((r) => ({ ...r, revenue: Number(r.revenue) })),
      sources,
      keep_days: 90,
      products,
    });
  }));
}

module.exports = { mount };
