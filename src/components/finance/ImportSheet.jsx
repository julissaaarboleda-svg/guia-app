import { useState, useRef } from "react";
import { X, FileText, Upload, Check, ChevronDown } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { ent } from "@/lib/freshEntities";
import { buildMonths, monthOf } from "@/lib/spending";
import { paidPatch, monthKeyOf, isPaid } from "@/lib/financeHelpers";

const KIND_LABEL = { bill: "Bill", subscription: "Subscription", loan: "Loan", credit_card: "Credit card", savings_goal: "Savings goal" };
const PICKABLE = ["bill", "subscription", "loan", "credit_card", "savings_goal"];
const fmt = (n) => (n == null ? "—" : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2, maximumFractionDigits: 2 })}`);
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const MAX_FILES = 10;
const money0 = (n) => `$${Math.round(Number(n) || 0).toLocaleString()}`;
const CATS = ["Groceries", "Dining", "Transportation", "Utilities", "Housing", "Insurance", "Healthcare", "Personal", "Shopping", "Entertainment", "Travel", "Subscriptions", "Other"];
const monthName = (k) => new Date(Number(k.slice(0, 4)), Number(k.slice(5)) - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
const nameHit = (a, b) => { const x = norm(a), y = norm(b); return x.length >= 4 && y.length >= 4 && (x.includes(y) || y.includes(x)); };

// Which rows in the file are payments to a bill or loan already in Guía?
function findMatches(prepared, spendRows, existing) {
  const out = []; const used = new Set(); const nowKey = monthKeyOf();
  for (const r of prepared) {
    const t = r.mergeId ? existing.find((e) => e.id === r.mergeId) : null;
    if (!t || (t.type !== "bill" && t.type !== "loan") || r.amount == null) continue;
    let ti = -1;
    spendRows.forEach((x, i) => { if (ti < 0 && !used.has(i) && x.t === "purchase" && (nameHit(x.m, r.name) || nameHit(x.m, t.name)) && Math.abs(x.a - r.amount) <= 1) ti = i; });
    const date = ti >= 0 ? spendRows[ti].d : null;
    if (ti >= 0) used.add(ti);
    if (t.type === "bill") {
      if (isPaid(t) || (t.paid && !(t.billing_cycle && t.billing_cycle !== "one_time"))) continue;
      if (date && monthOf(date) !== nowKey && t.billing_cycle && t.billing_cycle !== "one_time") continue;
      const cur = Number(t.amount);
      out.push({ id: `m-${t.id}`, kind: "bill", itemId: t.id, name: t.name, amount: r.amount, date, tick: !Number.isFinite(cur) || Math.abs(cur - r.amount) <= 1, note: Number.isFinite(cur) && Math.abs(cur - r.amount) > 1 ? `Bill is ${money0(cur)}, statement shows ${r.amount.toFixed(2)}` : null });
    } else {
      const sched = Array.isArray(t.schedule) ? t.schedule : [];
      const open = sched.filter((p) => !p.paid && Math.abs(Number(p.amount) - r.amount) <= 1).sort((a, b) => (date ? Math.abs(new Date(a.date) - new Date(date)) - Math.abs(new Date(b.date) - new Date(date)) : String(a.date).localeCompare(String(b.date))));
      if (!open.length) continue;
      out.push({ id: `m-${t.id}-${open[0].id}`, kind: "loan", itemId: t.id, payId: open[0].id, name: t.name, amount: r.amount, date, tick: true, note: null });
    }
  }
  return { matches: out, usedIdx: used };
}

const AMOUNT_FIELD = { bill: "amount", subscription: "amount", loan: "monthly_payment", savings_goal: "target_amount" };
const amtOf = (e) => (e ? e[AMOUNT_FIELD[e.type]] ?? null : null);

function toRecord(it) {
  const base = { type: it.kind, name: it.name, notes: "" };
  if (it.kind === "savings_goal") return { ...base, current_amount: 0, target_amount: it.amount || null };
  if (it.kind === "loan" || it.kind === "credit_card") {
    return { ...base, type: "loan", ...(it.kind === "credit_card" ? { subtype: "credit_card" } : {}), monthly_payment: it.amount || null, total_amount: null, amount_paid: 0, due_date: null, paid: false };
  }
  if (it.kind === "subscription") return { ...base, amount: it.amount || null, billing_cycle: it.billing_cycle === "one_time" ? "monthly" : it.billing_cycle, renewal_date: null };
  const recurring = it.billing_cycle && it.billing_cycle !== "one_time";
  return {
    ...base, amount: it.amount || null, paid: false, is_fixed: !!it.is_fixed && recurring,
    category: it.category || "", billing_cycle: it.billing_cycle || "monthly",
    due_day: recurring ? it.due_day : null, due_date: null,
  };
}

export default function ImportSheet({ open, onClose, existing = [], statements = [], onDone }) {
  const [step, setStep] = useState("pick"); // pick | reading | review | saving
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [spendRows, setSpendRows] = useState([]);
  const [fixes, setFixes] = useState({});
  const [includeSpend, setIncludeSpend] = useState(true);
  const [matches, setMatches] = useState([]);
  const [usedIdx, setUsedIdx] = useState(new Set());
  const [note, setNote] = useState("");
  const [fileObjs, setFileObjs] = useState([]);
  const [progress, setProgress] = useState([]);
  const fileRef = useRef(null);

  if (!open) return null;

  const mergeable = existing.filter((e) => AMOUNT_FIELD[e.type]);
  const byId = (id) => existing.find((e) => e.id === id);

  const reset = () => { setStep("pick"); setError(""); setRows([]); setFileName(""); setEditing(null); setSpendRows([]); setFixes({}); setIncludeSpend(true); setMatches([]); setUsedIdx(new Set()); setNote(""); setFileObjs([]); setProgress([]); };
  const close = () => { reset(); onClose(); };
  const setRow = (id, patch) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const readFiles = async (list) => {
    const totalPicked = list?.length || 0;
    const picked = Array.from(list || []).slice(0, MAX_FILES);
    if (!picked.length) return;
    setFileObjs(picked); setFileName(picked.length === 1 ? picked[0].name : `${picked.length} files`);
    setError(""); setNote(""); setProgress(picked.map((f) => ({ name: f.name, state: "reading" }))); setStep("reading");
    const results = new Array(picked.length);
    const existingArg = mergeable.map((e) => ({ name: e.name, amount: amtOf(e), type: e.type }));
    let next = 0;
    const worker = async () => {
      while (next < picked.length) {
        const i = next++;
        const [a, b] = await Promise.allSettled([
          base44.integrations.Core.ImportFinanceFile({ file: picked[i], existing: existingArg }),
          base44.integrations.Core.ImportFinanceFile({ file: picked[i], mode: "spending" }),
        ]);
        results[i] = { a, b };
        const state = a.status === "rejected" && b.status === "rejected" ? "failed" : a.status === "rejected" || b.status === "rejected" ? "partial" : "done";
        setProgress((p) => p.map((x, j) => (j === i ? { ...x, state } : x)));
      }
    };
    try {
      await Promise.all(Array.from({ length: Math.min(3, picked.length) }, worker));
      if (!results.some((r) => r.a.status === "fulfilled" || r.b.status === "fulfilled")) throw results[0].a.reason;
      const notes = [];
      const failed = picked.filter((_, i) => results[i].a.status === "rejected" && results[i].b.status === "rejected").map((f) => f.name);
      if (failed.length) notes.push(`Couldn't read: ${failed.join(", ")}.`);
      const partial = picked.filter((_, i) => (results[i].a.status === "rejected") !== (results[i].b.status === "rejected")).map((f) => f.name);
      if (partial.length) notes.push(`Only part of ${partial.join(", ")} could be read. Try it again on its own.`);
      if (totalPicked > MAX_FILES) notes.push(`Only the first ${MAX_FILES} files were used.`);
      setNote(notes.join(" "));

      // Bills, subscriptions and loans: the same item from two files is one item.
      const seen = new Set();
      const items = [];
      results.forEach((r) => (r.a.status === "fulfilled" ? r.a.value.items || [] : []).forEach((it) => {
        const k = `${norm(it.name)}|${it.amount}`;
        if (!seen.has(k)) { seen.add(k); items.push(it); }
      }));

      // Spending: the same purchase in two files counts once (use the file that lists it most).
      const per = results.map((r, f) => (r.b.status === "fulfilled" ? r.b.value.transactions || [] : []).map((t) => ({ ...t, f })));
      const byKey = {};
      per.forEach((rowsF, f) => rowsF.forEach((t) => { const k = `${t.d}|${norm(t.m)}|${t.a}`; ((byKey[k] = byKey[k] || {})[f] = byKey[k][f] || []).push(t); }));
      const tx = [];
      Object.values(byKey).forEach((byFile) => {
        const best = Object.keys(byFile).map(Number).sort((x, y) => byFile[y].length - byFile[x].length || x - y)[0];
        tx.push(...byFile[best]);
      });
      tx.sort((x, y) => String(x.d).localeCompare(String(y.d)));

      const prepared = items.map((it, i) => {
        const exact = mergeable.find((e) => norm(e.name) === norm(it.name));
        const guess = !exact && it.matches_existing ? mergeable.find((e) => norm(e.name) === norm(it.matches_existing)) : null;
        const target = exact || guess;
        const differs = target && it.amount != null && Number(amtOf(target)) !== Number(it.amount);
        return {
          ...it, id: i,
          exact: !!exact,
          action: exact ? (differs ? "merge" : "skip") : guess ? "merge" : "new",
          mergeId: target ? target.id : null,
          updateAmount: !!differs,
          needsCall: !exact && (!!guess || it.confidence < 0.8),
        };
      }).filter((r) => r.kind !== "skip" || r.exact || r.mergeId);
      const found = findMatches(prepared, tx, existing);
      setRows(prepared); setSpendRows(tx); setFixes({}); setMatches(found.matches); setUsedIdx(found.usedIdx);
      setIncludeSpend(tx.filter((r) => r.t === "purchase").length > 0);
      setStep("review");
    } catch (err) {
      setError(err.message || "Couldn't read those files.");
      setStep("pick");
    }
  };

  const chooseKind = (r, kind) => setRow(r.id, { action: "new", kind, mergeId: null, updateAmount: false, needsCall: false });
  const chooseMerge = (r, id) => {
    if (!id) return;
    const target = byId(id);
    const differs = r.amount != null && Number(amtOf(target)) !== Number(r.amount);
    setRow(r.id, { action: "merge", mergeId: id, updateAmount: !!differs, needsCall: false });
  };
  const chooseSkip = (r) => setRow(r.id, { action: "skip", needsCall: false });

  const dups = rows.filter((r) => r.exact && !r.needsCall);
  const asks = rows.filter((r) => r.needsCall);
  const ready = rows.filter((r) => !r.needsCall && !r.exact);

  const willCreate = rows.filter((r) => !r.needsCall && r.action === "new").length;
  const willUpdate = rows.filter((r) => !r.needsCall && r.action === "merge" && r.updateAmount && r.amount != null).length;
  const willPay = matches.filter((m) => m.tick).length;

  // Spending: bill and loan payments found above are left out so nothing is counted twice.
  const fixedSpend = spendRows.map((r, i) => {
    if (usedIdx.has(i)) return { ...r, t: "skip" };
    const f = fixes[norm(r.m)];
    return f ? (f === "skip" ? { ...r, t: "skip" } : { ...r, c: f }) : r;
  });
  const built = buildMonths(fixedSpend);
  const builtKeys = Object.keys(built).sort();
  const spendCount = fixedSpend.filter((r) => r.t === "purchase").length;
  const spendTotal = builtKeys.reduce((t, k) => t + built[k].total, 0);
  const willSpend = includeSpend && spendCount > 0 ? 1 : 0;
  const topMerch = Object.values(spendRows.reduce((m, r, i) => {
    if (r.t !== "purchase" || usedIdx.has(i)) return m;
    const k = norm(r.m); (m[k] = m[k] || { k, name: r.m, total: 0, c: r.c }).total += r.a; return m;
  }, {})).sort((a, b) => b.total - a.total).slice(0, 8);
  const rawCount = (f) => spendRows.filter((r) => r.f === f && r.t === "purchase").length;
  const dupFiles = fileObjs.filter((fo, i) => rawCount(i) > 0 && statements.some((x) => x.filename === fo.name && x.count === rawCount(i))).map((fo) => fo.name);
  const total = willCreate + willUpdate + willPay + willSpend;

  const save = async () => {
    setStep("saving");
    try {
      for (const r of rows) {
        if (r.needsCall) continue;
        if (r.action === "new") await ent.FinanceItem.create(toRecord(r));
        else if (r.action === "merge" && r.updateAmount && r.amount != null) {
          const t = byId(r.mergeId);
          if (t) await ent.FinanceItem.update(t.id, { [AMOUNT_FIELD[t.type]]: r.amount });
        }
      }
      for (const m of matches) {
        if (!m.tick) continue;
        const t = byId(m.itemId);
        if (!t) continue;
        if (m.kind === "bill") await ent.FinanceItem.update(t.id, paidPatch(t, true));
        else await ent.FinanceItem.update(t.id, { schedule: (t.schedule || []).map((p) => (p.id === m.payId ? { ...p, paid: true } : p)) });
      }
      if (willSpend) {
        for (let i = 0; i < fileObjs.length; i++) {
          const mine = fixedSpend.filter((r) => r.f === i);
          if (!mine.some((r) => r.t === "purchase")) continue;
          await ent.SpendingStatement.create({
            label: fileObjs[i].name.replace(/\.[^.]+$/, "").slice(0, 60), filename: fileObjs[i].name,
            count: rawCount(i), months: buildMonths(mine),
          });
        }
      }
      onDone && onDone({ spending: !!willSpend, items: willCreate + willUpdate, paid: willPay });
      close();
    } catch (err) {
      setError(err.message || "Something went wrong while saving.");
      setStep("review");
    }
  };

  const chip = (active, label, onClick) => (
    <button key={label} onClick={onClick}
      className={`px-3 py-1 rounded-full text-[11px] whitespace-nowrap ${active ? "bg-[#A7773F] text-[#F7F3EC]" : "border border-dashed border-[#A7773F] text-[#A7773F]"}`}>
      {label}
    </button>
  );

  const rowLabel = (r) => (r.action === "merge" ? byId(r.mergeId)?.name || "Existing" : r.action === "skip" ? "Skip" : `${KIND_LABEL[r.kind]}${r.kind === "bill" && r.is_fixed ? " · fixed" : ""}`);

  const renderEditor = (r, confirmed) => {
    const t = r.mergeId ? byId(r.mergeId) : null;
    const differs = t && r.amount != null && Number(amtOf(t)) !== Number(r.amount);
    const guess = !confirmed && t ? t : null;
    return (
      <div className="px-3 pb-3 space-y-2.5">
        <div className="flex flex-wrap gap-1.5">
          {guess && chip(false, `Add to ${guess.name}`, () => chooseMerge(r, guess.id))}
          {PICKABLE.map((k) => chip(confirmed && r.action === "new" && r.kind === k, KIND_LABEL[k], () => chooseKind(r, k)))}
          {chip(confirmed && r.action === "skip", "Skip", () => chooseSkip(r))}
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="whitespace-nowrap">Or add to existing</span>
          <span className="relative flex-1">
            <select value={confirmed && r.action === "merge" ? r.mergeId || "" : ""} onChange={(e) => chooseMerge(r, e.target.value)}
              className="w-full appearance-none bg-secondary border border-input rounded-full pl-3 pr-7 py-1.5 text-xs text-foreground outline-none">
              <option value="">Choose…</option>
              {mergeable.map((e) => <option key={e.id} value={e.id}>{e.name} · {KIND_LABEL[e.type] || e.type}</option>)}
            </select>
            <ChevronDown className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </span>
        </label>
        {confirmed && r.action === "merge" && differs && (
          <button onClick={() => setRow(r.id, { updateAmount: !r.updateAmount })} className="flex items-center gap-2 text-xs text-foreground">
            <span className={`w-[18px] h-[18px] rounded-[5px] flex items-center justify-center ${r.updateAmount ? "bg-[#A7773F] text-[#F7F3EC]" : "border border-border"}`}>
              {r.updateAmount && <Check className="w-3 h-3" strokeWidth={2.5} />}
            </span>
            Update {t.name} from {fmt(amtOf(t))} to {fmt(r.amount)}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={step === "reading" || step === "saving" ? undefined : close} />
      <div className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-background rounded-t-3xl sm:rounded-3xl border border-border p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="font-heading text-[22px] text-foreground leading-tight">Import from a file</h2>
            <p className="font-heading italic text-[14px] text-muted-foreground mt-0.5">
              {step === "review" ? "Check what we found. Nothing is saved until you tap the button." : "Bills, loans and spending in one go."}
            </p>
          </div>
          <button onClick={close} aria-label="Close" className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        {(step === "pick" || step === "reading") && (
          <div>
            <input ref={fileRef} type="file" multiple accept=".pdf,.csv,.txt,image/*,image/heic,image/heif,.heic,.heif" className="hidden" onChange={(e) => { readFiles(e.target.files); e.target.value = ""; }} />
            <button onClick={() => fileRef.current?.click()} disabled={step === "reading"}
              className="w-full border border-dashed border-border bg-card rounded-2xl py-8 flex flex-col items-center gap-2 text-center disabled:opacity-60">
              {step === "reading"
                ? <><span className="w-5 h-5 border-2 border-muted border-t-[#A7773F] rounded-full animate-spin" /><span className="font-heading text-base text-foreground">Reading {fileName}…</span><span className="text-xs text-muted-foreground">Reading both your bills and spending, this can take up to a minute.</span>{progress.length > 1 && <span className="mt-2 space-y-1 text-left">{progress.map((p) => <span key={p.name} className="flex items-center gap-2 text-xs text-muted-foreground"><span className="w-3.5 text-center" style={{ color: p.state === "failed" ? "#8F5F65" : "#A7773F" }}>{p.state === "reading" ? "…" : p.state === "failed" ? "✕" : "✓"}</span><span className="truncate max-w-[220px]">{p.name}</span></span>)}</span>}</>
                : <><Upload className="w-5 h-5 text-[#A7773F]" strokeWidth={1.5} /><span className="font-heading text-base text-foreground">Choose files</span><span className="text-xs text-muted-foreground px-6">Statements or bills as PDF, photos or screenshots, or CSV. You can pick up to 10 at once, such as a checking and a card statement.</span></>}
            </button>
            {error && <p className="text-xs text-destructive mt-3">{error}</p>}
            <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
              The file is read once to find your bills and total your spending, and isn't saved. Only totals are kept. It's sent to an AI service to do that, so hide account numbers first if you'd rather not share them.
            </p>
          </div>
        )}

        {(step === "review" || step === "saving") && (
          <div>
            <div className="bg-card border border-border rounded-2xl p-3 mb-3 flex items-center gap-3">
              <FileText className="w-5 h-5 text-[#A7773F]" strokeWidth={1.5} />
              <div className="flex-1 min-w-0"><p className="text-[13px] text-foreground truncate">{fileObjs.length > 1 ? `${fileObjs.length} files` : fileName}</p>{fileObjs.length > 1 && <p className="text-[11.5px] text-muted-foreground truncate">{fileObjs.map((f) => f.name).join(", ")}</p>}</div>
              <button onClick={reset} className="text-xs text-[#A7773F]">Change</button>
            </div>

            {rows.length === 0 && spendCount === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Nothing to add was found in that file.</p>}
            {note && <p className="text-[12.5px] text-[#8A5F27] bg-[#F3E8D6] rounded-lg px-3 py-2 mb-3">{note}</p>}

            {matches.length > 0 && (
              <>
                <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground mt-4 mb-1">Payments found</p>
                <p className="text-xs text-muted-foreground mb-2">These match bills and loans you already track. Ticked ones are marked paid.</p>
                <div className="bg-card border border-border rounded-2xl divide-y divide-border">
                  {matches.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 p-3">
                      <button onClick={() => setMatches((ms) => ms.map((x) => (x.id === m.id ? { ...x, tick: !x.tick } : x)))} aria-label="Mark paid"
                        className={`w-[18px] h-[18px] rounded-[5px] flex items-center justify-center flex-shrink-0 ${m.tick ? "bg-[#A7773F] text-[#F7F3EC]" : "border border-border"}`}>
                        {m.tick && <Check className="w-3 h-3" strokeWidth={2.5} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="font-heading text-[15px] text-foreground truncate">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.kind === "loan" ? "Loan payment" : "Bill"}{m.date ? ` · ${new Date(m.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}{m.note ? ` · ${m.note}` : ""}</p>
                      </div>
                      <span className="text-[14px] text-foreground">${m.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {asks.length > 0 && (
              <>
                <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground mt-4 mb-2">Needs your call</p>
                <div className="space-y-2">
                  {asks.map((r) => (
                    <div key={r.id} className="bg-card border border-border rounded-2xl">
                      <div className="p-3 pb-2">
                        <p className="font-heading text-[15px] text-foreground">{r.name} <span className="text-muted-foreground text-sm">· {fmt(r.amount)}</span></p>
                        {r.reason && <p className="text-xs text-muted-foreground mt-0.5">{r.reason}</p>}
                      </div>
                      {renderEditor(r, false)}
                    </div>
                  ))}
                </div>
              </>
            )}

            {ready.length > 0 && (
              <>
                <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground mt-5 mb-2">Ready to add</p>
                <div className="bg-card border border-border rounded-2xl divide-y divide-border">
                  {ready.map((r) => (
                    <div key={r.id}>
                      <div className="flex items-center gap-3 p-3">
                        <button onClick={() => setRow(r.id, r.action === "skip" ? { action: "new" } : { action: "skip" })} aria-label="Include"
                          className={`w-[18px] h-[18px] rounded-[5px] flex items-center justify-center flex-shrink-0 ${r.action !== "skip" ? "bg-[#A7773F] text-[#F7F3EC]" : "border border-border"}`}>
                          {r.action !== "skip" && <Check className="w-3 h-3" strokeWidth={2.5} />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`font-heading text-[15px] truncate ${r.action === "skip" ? "text-muted-foreground" : "text-foreground"}`}>{r.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.action === "merge" ? (r.updateAmount ? `Updates ${rowLabel(r)} to ${fmt(r.amount)}` : `Joins ${rowLabel(r)}`) : `${fmt(r.amount)}${r.due_day ? ` · Day ${r.due_day}` : ""}${r.billing_cycle && r.billing_cycle !== "one_time" ? ` · ${r.billing_cycle}` : ""}`}
                          </p>
                        </div>
                        <button onClick={() => setEditing(editing === r.id ? null : r.id)}
                          className="text-[11px] pl-2.5 pr-2 py-0.5 rounded-full bg-[#F0E6D6] text-[#8B6B3E] whitespace-nowrap flex items-center gap-1">
                          {rowLabel(r)} <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                      {editing === r.id && renderEditor(r, true)}
                    </div>
                  ))}
                </div>
              </>
            )}

            {dups.length > 0 && (
              <>
                <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground mt-5 mb-2">Already in Finance</p>
                <div className="bg-card border border-border rounded-2xl divide-y divide-border">
                  {dups.map((r) => {
                    const t = byId(r.mergeId);
                    const differs = t && r.amount != null && Number(amtOf(t)) !== Number(r.amount);
                    return (
                      <div key={r.id} className="flex items-center justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <p className="font-heading text-[15px] text-muted-foreground truncate">{r.name}</p>
                          {differs && <p className="text-xs text-muted-foreground">{fmt(amtOf(t))} now · {fmt(r.amount)} in this file</p>}
                        </div>
                        {differs ? (
                          <button onClick={() => setRow(r.id, r.action === "merge" ? { action: "skip", updateAmount: false } : { action: "merge", updateAmount: true })}
                            className={`text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap ${r.action === "merge" ? "bg-[#A7773F] text-[#F7F3EC]" : "border border-dashed border-[#A7773F] text-[#A7773F]"}`}>
                            Update to {fmt(r.amount)}
                          </button>
                        ) : <span className="text-[11px] text-muted-foreground">Skipped</span>}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {spendCount > 0 && (
              <>
                <div className="flex items-center justify-between mt-5 mb-2">
                  <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground">Spending</p>
                  <button onClick={() => setIncludeSpend((v) => !v)} className="flex items-center gap-2 text-xs text-foreground">
                    <span className={`w-[18px] h-[18px] rounded-[5px] flex items-center justify-center ${includeSpend ? "bg-[#A7773F] text-[#F7F3EC]" : "border border-border"}`}>{includeSpend && <Check className="w-3 h-3" strokeWidth={2.5} />}</span>
                    Include
                  </button>
                </div>
                <div className={`bg-card border border-border rounded-2xl p-3 ${includeSpend ? "" : "opacity-50"}`}>
                  <p className="text-[13px] text-foreground mb-2">Found <b className="font-medium">{spendCount} purchases</b> totaling <b className="font-medium">{money0(spendTotal)}</b>.</p>
                  {dupFiles.length > 0 && <p className="text-[12.5px] text-[#8A5F27] bg-[#F3E8D6] rounded-lg px-3 py-2 mb-2">{dupFiles.join(", ")} look{dupFiles.length === 1 ? "s" : ""} like {dupFiles.length === 1 ? "a statement" : "statements"} you already added. Saving again would count {dupFiles.length === 1 ? "it" : "them"} twice.</p>}
                  {builtKeys.map((k) => (
                    <div key={k} className="mb-2">
                      <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground mb-1">{monthName(k)} · {money0(built[k].total)}</p>
                      {Object.entries(built[k].categories).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c, v]) => (
                        <div key={c} className="flex justify-between text-[13px] py-0.5"><span className="text-muted-foreground">{c}</span><span className="text-foreground">{money0(v)}</span></div>
                      ))}
                    </div>
                  ))}
                  <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground mt-3 mb-1">Fix a label</p>
                  {topMerch.map((m) => (
                    <div key={m.k} className="flex items-center justify-between gap-2 py-1">
                      <span className="text-[13px] text-foreground truncate">{m.name} <span className="text-muted-foreground">· {money0(m.total)}</span></span>
                      <select value={fixes[m.k] || m.c} onChange={(e) => setFixes((f) => ({ ...f, [m.k]: e.target.value }))}
                        className="text-[12px] bg-background border border-border rounded-lg px-2 py-1 text-foreground max-w-[130px]">
                        {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
                        <option value="skip">Not spending</option>
                      </select>
                    </div>
                  ))}
                  <p className="text-[11.5px] text-muted-foreground mt-2">Payments found above are left out, so nothing is counted twice. Totals for the same month from different statements are added together.</p>
                </div>
              </>
            )}

            {error && <p className="text-xs text-destructive mt-3">{error}</p>}
            <button onClick={save} disabled={step === "saving" || total === 0}
              className="w-full mt-5 bg-[#A7773F] text-[#F7F3EC] rounded-full py-2.5 font-heading text-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
              {step === "saving" ? "Saving…" : total === 0 ? "Nothing to add yet" : `Save · ${[willCreate ? `add ${willCreate}` : "", willUpdate ? `update ${willUpdate}` : "", willPay ? `mark ${willPay} paid` : "", willSpend ? "add spending" : ""].filter(Boolean).join(", ")}${asks.length ? ` · ${asks.length} to choose` : ""}`}
              </button>
            <p className="text-xs text-muted-foreground text-center mt-2">Nothing is saved until you tap the button.</p>
          </div>
        )}
      </div>
    </div>
  );
}
