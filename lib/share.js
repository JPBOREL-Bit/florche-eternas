'use strict';
const fs = require('fs');
const path = require('path');
const Pricing = require('../public/js/pricing.js');

const INDEX = path.join(__dirname, '..', 'public', 'index.html');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function render(tpl, { title, desc, image, url }) {
  let html = tpl.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  html = html.replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(desc)}">`);
  const meta = [
    `<link rel="canonical" href="${esc(url)}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    image ? `<meta property="og:image" content="${esc(image)}">` : '',
    image ? '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">' : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`,
  ].filter(Boolean).join('\n');
  return html.replace('</head>', meta + '\n</head>');
}

const slugify = (s) =>
  String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

function mount({ app, q, wrap, getSettings }) {
  const origin = (req) => `${req.protocol}://${req.get('host')}`;
  const read = () => fs.readFileSync(INDEX, 'utf8');

  // Página principal (con vista previa al compartir la tienda)
  app.get('/', wrap(async (req, res) => {
    const s = await getSettings();
    const o = origin(req);
    res.type('html').send(render(read(), {
      title: s.storeName + (s.tagline ? ' · ' + s.tagline : ''),
      desc: s.tagline || s.heroSubtitle || '',
      image: s.heroImageId ? `${o}/img/${s.heroImageId}/og` : s.logoId ? `${o}/img/${s.logoId}/og` : '',
      url: o + '/',
    }));
  }));

  // Link único de cada producto: /p/12-ramo-de-3-flores
  app.get('/p/:slug', wrap(async (req, res) => {
    const id = parseInt(req.params.slug, 10);
    const s = await getSettings();
    const o = origin(req);
    const { rows } = Number.isInteger(id)
      ? await q('select id, name, description, base_price, images, groups, discount_type, discount_value, discount_ends from products where id = $1 and active', [id])
      : { rows: [] };
    const p = rows[0];
    if (!p) return res.redirect(302, '/');
    const prod = { ...p, base_price: Number(p.base_price), discount_value: Number(p.discount_value) };
    const d = Pricing.discounted(Pricing.minPrice(prod), prod);
    const hasOpts = (p.groups || []).some((g) => (g.options || []).length);
    const price = `${hasOpts ? 'Desde ' : ''}${Pricing.money(d.price)}${d.active ? ` (${d.pct}% OFF)` : ''}`;
    const text = String(p.description || '').replace(/\s+/g, ' ').trim().slice(0, 140);
    const image = p.images && p.images[0] ? `${o}/img/${p.images[0]}/og` : s.heroImageId ? `${o}/img/${s.heroImageId}/og` : '';
    res.type('html').send(render(read(), {
      title: `${p.name} · ${s.storeName}`,
      desc: `${price}${text ? ' · ' + text : ''}`,
      image,
      url: `${o}/p/${p.id}-${slugify(p.name)}`,
    }));
  }));
}

module.exports = { mount, slugify };
