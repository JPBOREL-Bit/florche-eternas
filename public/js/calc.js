/* Motor de la calculadora de costos (se usa en el panel y en las pruebas del servidor). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Calc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Unidades: cada una se convierte a una unidad base (cm, unidad, gramo, mililitro)
  const UNITS = {
    cm: { base: 'cm', f: 1, label: 'centímetros', short: 'cm' },
    m: { base: 'cm', f: 100, label: 'metros', short: 'm' },
    u: { base: 'u', f: 1, label: 'unidades', short: 'u' },
    g: { base: 'g', f: 1, label: 'gramos', short: 'g' },
    kg: { base: 'g', f: 1000, label: 'kilos', short: 'kg' },
    ml: { base: 'ml', f: 1, label: 'mililitros', short: 'ml' },
    l: { base: 'ml', f: 1000, label: 'litros', short: 'l' },
  };
  const BASE_LABEL = { cm: 'centímetro', u: 'unidad', g: 'gramo', ml: 'mililitro' };
  const BASE_SHORT = { cm: 'cm', u: 'u', g: 'g', ml: 'ml' };

  const WORDS = {
    medio: 1 / 2, mitad: 1 / 2, tercio: 1 / 3, cuarto: 1 / 4, quinto: 1 / 5, sexto: 1 / 6, septimo: 1 / 7, octavo: 1 / 8,
    noveno: 1 / 9, decimo: 1 / 10, onceavo: 1 / 11, doceavo: 1 / 12, dieciseisavo: 1 / 16, treintaidosavo: 1 / 32,
  };
  const NUMW = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7 };

  /* Acepta 1/3, 1/16, 0,25, 25%, 1 1/2, "un tercio", "dos tercios", "medio", "una décima"... Devuelve un número o null. */
  function parseFraction(text) {
    let t = String(text == null ? '' : text).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    t = t.replace(/\s+/g, ' ').replace(/,/g, '.');
    if (!t) return null;
    let m;
    if ((m = /^(\d+(?:\.\d+)?)\s*%$/.exec(t))) { const v = parseFloat(m[1]) / 100; return v > 0 ? v : null; }
    if ((m = /^(\d+) (\d+)\s*\/\s*(\d+)$/.exec(t))) { const den = +m[3]; return den ? +m[1] + +m[2] / den : null; }
    if ((m = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(t))) { const den = parseFloat(m[2]); const v = den ? parseFloat(m[1]) / den : null; return v > 0 ? v : null; }
    if (/^\d+(\.\d+)?$/.test(t)) { const v = parseFloat(t); return v > 0 ? v : null; }
    if ((m = /^(?:(\d+|un|una|uno|dos|tres|cuatro|cinco|seis|siete) )?(medios?|medias?|mitad|tercios?|terceras?|cuart[oa]s?|quint[oa]s?|sext[oa]s?|septim[oa]s?|octav[oa]s?|noven[oa]s?|decim[oa]s?|onceav[oa]s?|doceav[oa]s?|dieciseisav[oa]s?|treintaidosav[oa]s?)$/.exec(t))) {
      const n = m[1] ? (NUMW[m[1]] !== undefined ? NUMW[m[1]] : +m[1]) : 1;
      let w = m[2] === 'mitad' ? 'mitad' : m[2].replace(/s$/, '').replace(/a$/, 'o');   // femenino -> masculino
      if (w === 'tercero') w = 'tercio';
      return WORDS[w] ? n * WORDS[w] : null;
    }
    return null;
  }

  // Números escritos con coma o punto ("1,5"). Devuelve NaN si no es un número.
  function toNumber(v) {
    if (typeof v === 'number') return v;
    const s = String(v == null ? '' : v).trim().replace(/\s/g, '').replace(',', '.');
    return s === '' ? NaN : Number(s);
  }

  /* Cuánto cuesta cada unidad base (cada cm, cada unidad, cada gramo...) de una materia prima */
  function perBase(mat) {
    const u = UNITS[mat && mat.unit];
    if (!u) return null;
    const pack = Number(mat.pack_qty) * u.f;
    const price = Number(mat.price);
    if (!(pack > 0) || !(price >= 0)) return null;
    return price / pack;
  }
  const baseOf = (mat) => (UNITS[mat && mat.unit] ? UNITS[mat.unit].base : null);

  /* Costo de una línea de la receta. mode: 'amount' (cantidad), 'pieces' (N piezas de cierto largo) o 'fraction' (fracción de lo comprado) */
  function lineCost(line, mat) {
    if (!mat) return { cost: 0, error: 'Esa materia prima ya no existe.' };
    const pb = perBase(mat);
    if (pb === null) return { cost: 0, error: 'Revisá el precio de esta materia prima.' };
    const base = baseOf(mat);
    const mode = line.mode;
    if (mode === 'fraction') {
      const frac = parseFraction(line.fracText !== undefined ? line.fracText : line.frac);
      if (!frac) return { cost: 0, error: 'Escribí una fracción o porcentaje válido (1/3, 25%...).' };
      const pack = Number(mat.pack_qty) * UNITS[mat.unit].f;
      return { cost: frac * Number(mat.price), qtyBase: frac * pack, base, frac };
    }
    if (mode === 'pieces') {
      if (base !== 'cm') return { cost: 0, error: 'Las piezas solo sirven para materiales que se miden en largo.' };
      const n = toNumber(line.n);
      const len = toNumber(line.len) * (UNITS[line.lenUnit || 'cm'] ? UNITS[line.lenUnit || 'cm'].f : 1);
      if (!(n > 0) || !(len > 0)) return { cost: 0, error: 'Poné cuántas piezas y de qué largo.' };
      return { cost: n * len * pb, qtyBase: n * len, base };
    }
    // cantidad directa
    const uk = line.unit || mat.unit;
    if (!UNITS[uk] || UNITS[uk].base !== base) return { cost: 0, error: 'Esa unidad no sirve para este material.' };
    const q = toNumber(line.qty);
    if (!(q > 0)) return { cost: 0, error: 'Poné la cantidad.' };
    const qb = q * UNITS[uk].f;
    return { cost: qb * pb, qtyBase: qb, base };
  }

  /* Redondea hacia ARRIBA al siguiente múltiplo de step (1730 -> 1800; 1801 -> 1900; 1800 -> 1800) */
  function roundUp(v, step) {
    v = Math.round(v * 1e6) / 1e6;
    step = Number(step);
    if (!(step > 1)) return Math.round(v * 100) / 100;
    return Math.ceil(v / step - 1e-9) * step;
  }

  /* Cuenta completa de un producto */
  function productCalc(prod, mats, cfg) {
    const byId = new Map((mats || []).map((m) => [m.id, m]));
    const lines = (prod.lines || []).map((l) => ({ ...lineCost(l, byId.get(Number(l.mat))), line: l }));
    const materials = lines.reduce((a, x) => a + (x.cost || 0), 0);
    let emergency = 0;
    const ev = toNumber(prod.emergency_value);
    if (prod.emergency_type === 'percent' && ev > 0) emergency = (materials * ev) / 100;
    else if (prod.emergency_type === 'amount' && ev > 0) emergency = ev;
    const subtotal = materials + emergency;
    const minutes = Math.max(0, toNumber(prod.minutes) || 0);
    const ho = prod.hourly_override === null || prod.hourly_override === undefined || prod.hourly_override === '' ? NaN : toNumber(prod.hourly_override);
    const hourly = Number.isFinite(ho) && ho >= 0 ? ho : Math.max(0, Number(cfg && cfg.hourly) || 0);
    const labor = (minutes / 60) * hourly;
    const raw = subtotal + labor;
    const price = roundUp(raw, cfg ? cfg.round : 100);
    const profit = price - subtotal;
    const share = (x) => (price > 0 ? (x / price) * 100 : 0);
    return {
      lines, materials, emergency, subtotal, minutes, hourly, labor, raw, price, profit,
      rounding: price - raw,
      shares: { materials: share(materials), emergency: share(emergency), profit: share(profit) },
      realHourly: minutes > 0 ? profit / (minutes / 60) : null,
      hasErrors: lines.some((x) => x.error),
    };
  }

  return { UNITS, BASE_LABEL, BASE_SHORT, parseFraction, toNumber, perBase, baseOf, lineCost, roundUp, productCalc };
});
