import { useState } from "react";
import { X, Trash2 } from "lucide-react";
import { ent } from "@/lib/freshEntities";
import { buildMonths, monthOf } from "@/lib/spending";

const mkey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const r2 = (n) => Math.round(Number(n) * 100) / 100;
const money = (n) => `$${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const shortDay = (d) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const FIELD = "bg-background border border-border rounded-lg px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-[#A7773F]";

// Lists the purchases behind a month (or one place in it) and lets each one be edited or removed.
// Statements saved with their purchases are edited purchase by purchase. Older statements only kept
// totals per place, so those are edited as "n purchases · $total".
export default function PurchasesSheet({ statements, monthKey, merchant, categories = [], onClose, onSaved }) {
  const [editing, setEditing] = useState(null); // { sid, idx } or { sid, agg: name }
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const match = (name) => !merchant || mkey(name) === mkey(merchant);

  const groups = statements.map((s) => {
    const m = s.months?.[monthKey];
    if (!m) return null;
    if (Array.isArray(s.rows)) {
      const rows = s.rows.map((r, idx) => ({ ...r, idx })).filter((r) => monthOf(r.d) === monthKey && match(r.m))
        .sort((a, b) => String(b.d).localeCompare(String(a.d)));
      return rows.length ? { s, rows } : null;
    }
    const aggs = (m.merchants || []).filter((e) => match(e.name));
    return aggs.length ? { s, aggs } : null;
  }).filter(Boolean);

  const saveRows = async (s, rows) => {
    const clean = rows.map((r) => { const c = { ...r }; delete c.idx; return c; });
    if (!clean.length) await ent.SpendingStatement.delete(s.id);
    else await ent.SpendingStatement.update(s.id, { rows: clean, count: clean.length, months: buildMonths(clean.map((r) => ({ ...r, t: "purchase" }))) });
  };
  const run = async (fn) => { setBusy(true); try { await fn(); } catch { /* reload shows what saved */ } setBusy(false); setEditing(null); onSaved(); };

  const saveRow = (s, idx) => run(() => saveRows(s, s.rows.map((r, i) => (i === idx ? { ...r, m: form.m.trim() || r.m, a: r2(form.a) || r.a, c: form.c.trim() || r.c, d: form.d || r.d } : r))));
  const deleteRow = (s, idx) => { if (confirm("Remove this purchase?")) run(() => saveRows(s, s.rows.filter((_, i) => i !== idx))); };

  // Older statements: change a place's purchase count and total, and keep the month's sums in step.
  const saveAgg = (s, name, count, total) => run(async () => {
    const months = JSON.parse(JSON.stringify(s.months));
    const mo = months[monthKey];
    const e = mo.merchants.find((x) => x.name === name);
    if (!e) return;
    const dTotal = r2(total - e.total), dCount = count - e.count;
    mo.total = r2(mo.total + dTotal); mo.count = Math.max(0, mo.count + dCount);
    const c = e.c || "Other";
    mo.categories[c] = r2((mo.categories[c] || 0) + dTotal);
    if (mo.categories[c] <= 0) delete mo.categories[c];
    if (count <= 0 || total <= 0) mo.merchants = mo.merchants.filter((x) => x !== e);
    else { e.count = count; e.total = r2(total); }
    if (mo.count <= 0 || mo.total <= 0) delete months[monthKey];
    if (!Object.keys(months).length) await ent.SpendingStatement.delete(s.id);
    else await ent.SpendingStatement.update(s.id, { months, count: Math.max(0, (s.count || 0) + dCount) });
  });

  const label = new Date(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5)) - 1, 1).toLocaleDateString("en-US", { month: "long" });
  return (
    <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-background w-full md:max-w-lg rounded-t-3xl md:rounded-3xl max-h-[88vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <h3 className="font-heading text-[20px] text-foreground">{merchant || "All purchases"} <span className="text-muted-foreground text-[15px]">· {label}</span></h3>
          <button onClick={onClose} aria-label="Close" className="p-1 text-muted-foreground"><X className="w-5 h-5" strokeWidth={1.5} /></button>
        </div>
        <p className="text-[12.5px] text-muted-foreground mb-3">Tap a purchase to change it, or remove one that was counted twice.</p>
        <datalist id="spend-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        {groups.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No purchases here.</p>}
        {groups.map(({ s, rows, aggs }) => (
          <div key={s.id} className="mb-3">
            <p className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-muted-foreground mb-1.5">From {s.label}</p>
            <div className="bg-card border border-border rounded-2xl divide-y divide-border/60">
              {rows && rows.map((r) => {
                const on = editing && editing.sid === s.id && editing.idx === r.idx;
                return on ? (
                  <div key={r.idx} className="p-3 space-y-2">
                    <div className="flex gap-2">
                      <input value={form.m} onChange={(e) => setForm({ ...form, m: e.target.value })} className={`${FIELD} flex-1 min-w-0`} aria-label="Place" />
                      <input value={form.a} onChange={(e) => setForm({ ...form, a: e.target.value })} inputMode="decimal" className={`${FIELD} w-24`} aria-label="Amount" />
                    </div>
                    <div className="flex gap-2">
                      <input type="date" value={form.d} onChange={(e) => setForm({ ...form, d: e.target.value })} className={`${FIELD} flex-1`} aria-label="Date" />
                      <input list="spend-cats" value={form.c} onChange={(e) => setForm({ ...form, c: e.target.value })} className={`${FIELD} flex-1 min-w-0`} aria-label="Category" />
                    </div>
                    <div className="flex items-center gap-4">
                      <button disabled={busy} onClick={() => saveRow(s, r.idx)} className="bg-[#A7773F] text-[#F7F3EC] rounded-full px-4 py-1.5 text-[13px] font-medium disabled:opacity-50">Save</button>
                      <button onClick={() => setEditing(null)} className="text-[13px] text-muted-foreground">Cancel</button>
                      <button disabled={busy} onClick={() => deleteRow(s, r.idx)} className="ml-auto inline-flex items-center gap-1 text-[13px] text-[#8F5F65]"><Trash2 className="w-3.5 h-3.5" /> Remove</button>
                    </div>
                  </div>
                ) : (
                  <button key={r.idx} onClick={() => { setEditing({ sid: s.id, idx: r.idx }); setForm({ m: r.m, a: String(r.a), c: r.c || "", d: r.d }); }} className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left">
                    <span className="min-w-0">
                      <span className="block text-[13.5px] text-foreground truncate">{r.m}</span>
                      <span className="block text-[11.5px] text-muted-foreground">{shortDay(r.d)} · {r.c}</span>
                    </span>
                    <span className="text-[13.5px] text-foreground">{money(r.a)}</span>
                  </button>
                );
              })}
              {aggs && aggs.map((e) => {
                const on = editing && editing.sid === s.id && editing.agg === e.name;
                return on ? (
                  <div key={e.name} className="p-3 space-y-2">
                    <p className="text-[13.5px] text-foreground">{e.name}</p>
                    <div className="flex gap-2 items-center text-[12.5px] text-muted-foreground">
                      <input value={form.count} onChange={(x) => setForm({ ...form, count: x.target.value })} inputMode="numeric" className={`${FIELD} w-16`} aria-label="Purchases" /> purchases for
                      <input value={form.total} onChange={(x) => setForm({ ...form, total: x.target.value })} inputMode="decimal" className={`${FIELD} w-24`} aria-label="Total" />
                    </div>
                    <p className="text-[11.5px] text-muted-foreground">This file was added before Guía kept each purchase, so it's edited as a total.</p>
                    <div className="flex items-center gap-4">
                      <button disabled={busy} onClick={() => saveAgg(s, e.name, Math.round(Number(form.count) || 0), Number(form.total) || 0)} className="bg-[#A7773F] text-[#F7F3EC] rounded-full px-4 py-1.5 text-[13px] font-medium disabled:opacity-50">Save</button>
                      <button onClick={() => setEditing(null)} className="text-[13px] text-muted-foreground">Cancel</button>
                      <button disabled={busy} onClick={() => { if (confirm(`Remove ${e.name} from ${s.label}?`)) saveAgg(s, e.name, 0, 0); }} className="ml-auto inline-flex items-center gap-1 text-[13px] text-[#8F5F65]"><Trash2 className="w-3.5 h-3.5" /> Remove</button>
                    </div>
                  </div>
                ) : (
                  <button key={e.name} onClick={() => { setEditing({ sid: s.id, agg: e.name }); setForm({ count: String(e.count), total: String(e.total) }); }} className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left">
                    <span className="min-w-0">
                      <span className="block text-[13.5px] text-foreground truncate">{e.name}</span>
                      <span className="block text-[11.5px] text-muted-foreground">{e.count} {e.count === 1 ? "purchase" : "purchases"} · {e.c}</span>
                    </span>
                    <span className="text-[13.5px] text-foreground">{money(e.total)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
