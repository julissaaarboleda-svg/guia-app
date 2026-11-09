// Spending habits: turn a statement's rows into saved monthly totals, then
// compare months. Only totals are stored (never the rows or the file).
const num = (v) => Number(v) || 0;
const r2 = (n) => Math.round(n * 100) / 100;
const mkey = (name) => String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
export const SMALL = 10;
export const monthOf = (d) => String(d).slice(0, 7);

// rows: [{ d, m, a, c, t }] -> { "2026-10": { total, count, categories, merchants[], small } }
export function buildMonths(rows) {
  const months = {};
  for (const r of rows) {
    if (r.t !== "purchase" || !(r.a > 0)) continue;
    const k = monthOf(r.d);
    const m = (months[k] = months[k] || { total: 0, count: 0, categories: {}, merch: {}, small: { count: 0, total: 0 }, from: r.d, to: r.d });
    if (r.d < m.from) m.from = r.d;
    if (r.d > m.to) m.to = r.d;
    m.total += r.a; m.count += 1;
    m.categories[r.c] = (m.categories[r.c] || 0) + r.a;
    const mk = mkey(r.m);
    const e = (m.merch[mk] = m.merch[mk] || { name: r.m, total: 0, count: 0, c: r.c });
    e.total += r.a; e.count += 1;
    if (r.a < SMALL) { m.small.count += 1; m.small.total += r.a; }
  }
  const out = {};
  for (const [k, m] of Object.entries(months)) {
    out[k] = {
      total: r2(m.total), count: m.count, from: m.from, to: m.to,
      categories: Object.fromEntries(Object.entries(m.categories).map(([c, v]) => [c, r2(v)])),
      merchants: Object.values(m.merch).map((e) => ({ ...e, total: r2(e.total) })).sort((a, b) => b.total - a.total).slice(0, 40),
      small: { count: m.small.count, total: r2(m.small.total) },
    };
  }
  return out;
}

// All statements -> one combined view of a month
export function monthView(statements, key) {
  const parts = statements.map((s) => s.months?.[key]).filter(Boolean);
  if (!parts.length) return null;
  const categories = {}; const merch = {}; let total = 0; let count = 0; const small = { count: 0, total: 0 }; let from = null; let to = null;
  for (const p of parts) {
    if (p.from && (!from || p.from < from)) from = p.from;
    if (p.to && (!to || p.to > to)) to = p.to;
    total += p.total; count += p.count; small.count += p.small?.count || 0; small.total += p.small?.total || 0;
    for (const [c, v] of Object.entries(p.categories || {})) categories[c] = (categories[c] || 0) + v;
    for (const e of p.merchants || []) {
      const k = mkey(e.name);
      const x = (merch[k] = merch[k] || { name: e.name, total: 0, count: 0, c: e.c });
      x.total += e.total; x.count += e.count;
    }
  }
  return {
    key, from, to, total: r2(total), count, small: { count: small.count, total: r2(small.total) }, statements: parts.length,
    categories: Object.entries(categories).map(([name, v]) => ({ name, total: r2(v) })).sort((a, b) => b.total - a.total),
    merchants: Object.values(merch).map((e) => ({ ...e, total: r2(e.total) })).sort((a, b) => b.total - a.total),
  };
}

export const monthsWithData = (statements) =>
  [...new Set(statements.flatMap((s) => Object.keys(s.months || {})))].sort();

const pct = (a, b) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);
const monthName = (k) => new Date(Number(k.slice(0, 4)), Number(k.slice(5)) - 1, 1).toLocaleDateString("en-US", { month: "long" });

// Plain-language observations. tracked = names of existing bills/subscriptions.
export function habits(cur, prev, tracked = []) {
  const out = [];
  if (!cur) return out;
  if (prev) {
    const prevBy = Object.fromEntries(prev.categories.map((c) => [c.name, c.total]));
    const up = cur.categories
      .map((c) => ({ ...c, before: prevBy[c.name] || 0 }))
      .filter((c) => c.before > 0 && c.total - c.before >= 50 && c.total / c.before >= 1.2)
      .sort((a, b) => b.total - b.before - (a.total - a.before))[0];
    if (up) out.push({ tone: "bad", text: `${up.name} up ${pct(up.total, up.before)}% from ${monthName(prev.key)}.`, sub: "The biggest change this month." });
    const down = cur.categories
      .map((c) => ({ ...c, before: prevBy[c.name] || 0 }))
      .filter((c) => c.before > 0 && c.before - c.total >= 50 && c.total / c.before <= 0.8)
      .sort((a, b) => b.before - b.total - (a.before - a.total))[0];
    if (down) out.push({ tone: "good", text: `${down.name} down ${Math.abs(pct(down.total, down.before))}% from ${monthName(prev.key)}.`, sub: `About $${Math.round(down.before - down.total)} less.` });
  }
  if (cur.small.count >= 10) out.push({ tone: "neutral", text: `${cur.small.count} small purchases under $${SMALL} added up to $${Math.round(cur.small.total)}.`, sub: "Easy to miss, adds up fast." });
  if (prev) {
    const trackedKeys = new Set(tracked.map(mkey));
    const prevM = Object.fromEntries(prev.merchants.map((e) => [mkey(e.name), e]));
    const rep = cur.merchants.filter((e) => {
      const p = prevM[mkey(e.name)];
      return p && e.count === 1 && p.count === 1 && e.total < 100 && Math.abs(e.total - p.total) <= Math.max(1, p.total * 0.05) && !trackedKeys.has(mkey(e.name));
    }).slice(0, 2);
    rep.forEach((e) => out.push({ tone: "note", text: `${e.name} $${e.total.toFixed(2)} repeats monthly`, sub: "It isn't in your bills or subscriptions yet.", add: e }));
  }
  return out.slice(0, 5);
}

const dayShort = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
// "Nov 3–7", "Oct 28 – Nov 3", or "" when the dates weren't saved
export function rangeLabel(from, to) {
  if (!from || !to) return "";
  if (from === to) return dayShort(from);
  const same = from.slice(0, 7) === to.slice(0, 7);
  return same ? `${dayShort(from)}–${Number(to.slice(8))}` : `${dayShort(from)} – ${dayShort(to)}`;
}
export const throughLabel = (to) => (to ? `through ${dayShort(to)}` : "");
export function statementRange(s) {
  const ms = Object.values(s.months || {}).filter((m) => m.from && m.to);
  if (!ms.length) return "";
  return rangeLabel(ms.map((m) => m.from).sort()[0], ms.map((m) => m.to).sort().slice(-1)[0]);
}

// Is this file's spending already in a saved statement? Same month, overlapping dates, and
// mostly the same merchants. Works whatever the file is called (screenshots, re-exports).
export function findOverlaps(built, statements) {
  const out = [];
  for (const [key, m] of Object.entries(built || {})) {
    for (const st of statements || []) {
      const old = st.months?.[key];
      if (!old || !old.from || !old.to || !m.from || !m.to) continue;
      if (!(m.from <= old.to && old.from <= m.to)) continue;
      const oldSet = new Set((old.merchants || []).map((e) => mkey(e.name)));
      const total = (m.merchants || []).reduce((t, e) => t + e.total, 0) || 1;
      const shared = (m.merchants || []).filter((e) => oldSet.has(mkey(e.name))).reduce((t, e) => t + e.total, 0);
      if (shared / total >= 0.6) { out.push({ key, label: st.label || st.filename || "an earlier statement", from: m.from, to: m.to }); break; }
    }
  }
  return out;
}
