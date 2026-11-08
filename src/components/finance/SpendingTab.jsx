import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { ent } from "@/lib/freshEntities";
import { buildMonths, monthView, monthsWithData, habits } from "@/lib/spending";

const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString()}`;
const monthLabel = (k) => new Date(Number(k.slice(0, 4)), Number(k.slice(5)) - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
const mk = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const CATS = ["Groceries", "Dining", "Transportation", "Utilities", "Housing", "Insurance", "Healthcare", "Personal", "Shopping", "Entertainment", "Travel", "Subscriptions", "Other"];
const TONE_DOT = { bad: "#8F5F65", good: "#566033", neutral: "#A7773F", note: "#566033" };
const card = "bg-card border border-border rounded-2xl p-4 mb-3";

export default function SpendingTab({ items = [] }) {
  const [statements, setStatements] = useState([]);
  const [buckets, setBuckets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(null);
  const [adding, setAdding] = useState(false);
  const [step, setStep] = useState("pick"); // pick | reading | review | saving
  const [error, setError] = useState("");
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [fixes, setFixes] = useState({}); // merchant key -> category | "skip"
  const [review, setReview] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [dismissed, setDismissed] = useState([]);
  const fileRef = useRef(null);

  const load = async () => {
    try {
      const [s, b] = await Promise.all([ent.SpendingStatement.list("-created_date"), ent.BudgetBucket.list()]);
      setStatements(s || []); setBuckets(b || []);
    } catch { /* ignore */ }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const months = useMemo(() => monthsWithData(statements), [statements]);
  useEffect(() => { if (months.length && (!key || !months.includes(key))) setKey(months[months.length - 1]); }, [months, key]);

  const idx = months.indexOf(key);
  const prevKey = idx > 0 ? months[idx - 1] : null;
  const cur = useMemo(() => (key ? monthView(statements, key) : null), [statements, key]);
  const prev = useMemo(() => (prevKey ? monthView(statements, prevKey) : null), [statements, prevKey]);
  const tracked = items.filter((i) => i.type === "bill" || i.type === "subscription").map((i) => i.name);
  const notes = useMemo(() => habits(cur, prev, tracked).filter((n) => !dismissed.includes(n.text)), [cur, prev, items, dismissed]);

  const budgetFor = (cat) => {
    const b = buckets.find((x) => x.month === key && mk(x.name) === mk(cat));
    return b ? Number(b.allocated_amount) || 0 : null;
  };

  useEffect(() => {
    if (!cur) { setReview(""); return; }
    try { setReview(localStorage.getItem(`guia:spend-review:${cur.key}:${Math.round(cur.total)}`) || ""); } catch { setReview(""); }
  }, [cur?.key, cur?.total]);

  const writeReview = async () => {
    if (!cur) return;
    setReviewBusy(true);
    try {
      const cats = cur.categories.map((c) => `${c.name} $${Math.round(c.total)}`).join(", ");
      const before = prev ? prev.categories.map((c) => `${c.name} $${Math.round(c.total)}`).join(", ") : "none";
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a warm, practical money coach. Using ONLY the numbers below, write a spending-habits review of at most 45 words: first sentence names the single most important pattern, second sentence gives ONE specific, realistic way to save with a rough dollar amount. No lists, no semicolons, no judgment.
${monthLabel(cur.key)} total $${Math.round(cur.total)}. By category: ${cats}.
Top places: ${cur.merchants.slice(0, 6).map((m) => `${m.name} $${Math.round(m.total)} (${m.count}x)`).join(", ")}.
Previous month total: ${prev ? "$" + Math.round(prev.total) : "unknown"}. Previous by category: ${before}.
Return JSON: {"review": "..."}`,
        response_json_schema: { type: "object", properties: { review: { type: "string" } } },
      });
      const text = (res?.review || "").trim();
      if (text) { setReview(text); try { localStorage.setItem(`guia:spend-review:${cur.key}:${Math.round(cur.total)}`, text); } catch { /* ignore */ } }
    } catch { /* leave */ }
    setReviewBusy(false);
  };

  // ---- adding a statement ----
  const reset = () => { setAdding(false); setStep("pick"); setError(""); setFile(null); setRows([]); setFixes({}); };
  const readFile = async (f) => {
    if (!f) return;
    setFile(f); setError(""); setStep("reading");
    try {
      const { transactions } = await base44.integrations.Core.ImportFinanceFile({ file: f, mode: "spending" });
      if (!transactions?.length) throw new Error("No purchases were found in that file.");
      setRows(transactions); setFixes({}); setStep("review");
    } catch (e) { setError(e.message || "Couldn't read that file."); setStep("pick"); }
  };

  const fixed = useMemo(() => rows.map((r) => {
    const f = fixes[mk(r.m)];
    return f ? (f === "skip" ? { ...r, t: "skip" } : { ...r, c: f }) : r;
  }), [rows, fixes]);
  const built = useMemo(() => buildMonths(fixed), [fixed]);
  const builtKeys = Object.keys(built).sort();
  const topMerch = useMemo(() => {
    const m = {};
    rows.filter((r) => r.t === "purchase").forEach((r) => { const k = mk(r.m); (m[k] = m[k] || { k, name: r.m, total: 0, c: r.c }).total += r.a; });
    return Object.values(m).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [rows]);
  const dup = file && statements.find((s) => s.filename === file.name && s.count === rows.filter((r) => r.t === "purchase").length);

  const save = async () => {
    setStep("saving");
    try {
      await ent.SpendingStatement.create({
        label: (file?.name || "Statement").replace(/\.[^.]+$/, "").slice(0, 60), filename: file?.name || "",
        count: rows.filter((r) => r.t === "purchase").length, months: built,
      });
      await load();
      if (builtKeys.length) setKey(builtKeys[builtKeys.length - 1]);
      reset();
    } catch (e) { setError(e.message || "Couldn't save that."); setStep("review"); }
  };

  const removeStatement = async (s) => {
    if (!confirm(`Remove ${s.label}? Its totals will be deleted.`)) return;
    try { await ent.SpendingStatement.delete(s.id); } catch { /* ignore */ }
    load();
  };

  const addSub = async (e) => {
    try { await ent.FinanceItem.create({ type: "subscription", name: e.name, amount: e.total, billing_cycle: "monthly", renewal_date: null, notes: "" }); } catch { /* ignore */ }
    setDismissed((d) => [...d, `${e.name} $${e.total.toFixed(2)} repeats monthly`]);
  };

  const delta = cur && prev && prev.total > 0 ? Math.round(((cur.total - prev.total) / prev.total) * 100) : null;
  const maxCat = cur ? Math.max(1, ...cur.categories.map((c) => c.total)) : 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-xl text-foreground">Spending</h2>
        {!adding && <button onClick={() => setAdding(true)} className="bg-[#A7773F] text-[#F7F3EC] rounded-full font-heading text-[13px] px-4 py-1.5 hover:opacity-90">+ Add statement</button>}
      </div>

      {adding && (
        <div className={card}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-heading text-base text-foreground">{step === "review" || step === "saving" ? "Check and save" : "Add a statement"}</h3>
            <button onClick={reset} className="text-muted-foreground"><X className="w-4 h-4" /></button>
          </div>
          {error && <p className="text-[13px] text-[#8F5F65] mb-2">{error}</p>}

          {(step === "pick" || step === "reading") && (
            <>
              <p className="text-[13px] text-muted-foreground leading-snug mb-3">Upload a bank or card statement (PDF, photo or CSV). Guía reads it once to total up your spending.</p>
              <input ref={fileRef} type="file" className="hidden" accept="application/pdf,image/*,image/heic,image/heif,.heic,.heif,.csv,.txt,text/csv" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; readFile(f); }} />
              <button disabled={step === "reading"} onClick={() => fileRef.current?.click()}
                className="w-full border-[1.5px] border-dashed border-border rounded-2xl py-6 text-[13px] text-muted-foreground disabled:opacity-60">
                {step === "reading" ? "Reading your statement… this can take a little while" : "Choose a file"}
              </button>
              <p className="text-[12px] text-muted-foreground leading-snug mt-3"><span className="text-foreground">What's kept:</span> monthly totals by category and place. <span className="text-foreground">Not kept:</span> the file, account numbers, or a list of every purchase.</p>
            </>
          )}

          {(step === "review" || step === "saving") && (
            <>
              <p className="text-[13px] text-foreground mb-2">
                Found <b className="font-medium">{fixed.filter((r) => r.t === "purchase").length} purchases</b>
                {builtKeys.length ? <> totaling <b className="font-medium">{money(builtKeys.reduce((s, k) => s + built[k].total, 0))}</b></> : null}.
              </p>
              {dup && <p className="text-[12.5px] text-[#8A5F27] bg-[#F3E8D6] rounded-lg px-3 py-2 mb-2">This looks like a statement you already added ({dup.label}). Saving it again would count it twice.</p>}
              {builtKeys.map((k) => (
                <div key={k} className="mb-2">
                  <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground mb-1">{monthLabel(k)} · {money(built[k].total)}</p>
                  {Object.entries(built[k].categories).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c, v]) => (
                    <div key={c} className="flex justify-between text-[13px] py-0.5"><span className="text-muted-foreground">{c}</span><span className="text-foreground">{money(v)}</span></div>
                  ))}
                </div>
              ))}
              <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground mt-3 mb-1">Fix a label</p>
              {topMerch.map((m) => (
                <div key={m.k} className="flex items-center justify-between gap-2 py-1">
                  <span className="text-[13px] text-foreground truncate">{m.name} <span className="text-muted-foreground">· {money(m.total)}</span></span>
                  <select value={fixes[m.k] || m.c} onChange={(e) => setFixes((f) => ({ ...f, [m.k]: e.target.value }))}
                    className="text-[12px] bg-background border border-border rounded-lg px-2 py-1 text-foreground max-w-[130px]">
                    {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
                    <option value="skip">Not spending</option>
                  </select>
                </div>
              ))}
              <p className="text-[11.5px] text-muted-foreground mt-2 mb-3">Totals for the same month from different statements are added together, so add each card or account once.</p>
              <div className="flex gap-2">
                <button disabled={step === "saving"} onClick={save} className="bg-[#A7773F] text-[#F7F3EC] rounded-full text-[13px] px-5 py-2 disabled:opacity-60">{step === "saving" ? "Saving…" : "Save"}</button>
                <button onClick={reset} className="text-[13px] text-muted-foreground px-3">Cancel</button>
              </div>
            </>
          )}
        </div>
      )}

      {loading && <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>}

      {!loading && !cur && !adding && (
        <div className="text-center py-10">
          <p className="font-heading text-base text-foreground mb-1">No spending yet.</p>
          <p className="text-[13px] text-muted-foreground max-w-xs mx-auto leading-snug mb-4">Add a bank or card statement and Guía will show where your money goes and what has changed.</p>
          <button onClick={() => setAdding(true)} className="bg-[#A7773F] text-[#F7F3EC] rounded-full font-heading text-[13px] px-4 py-1.5">+ Add statement</button>
        </div>
      )}

      {cur && (
        <>
          <div className="flex items-center justify-center gap-4 mb-3">
            <button disabled={idx <= 0} onClick={() => setKey(months[idx - 1])} className="p-2 text-muted-foreground disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-[15px] text-foreground min-w-[140px] text-center">{monthLabel(key)}</span>
            <button disabled={idx >= months.length - 1} onClick={() => setKey(months[idx + 1])} className="p-2 text-muted-foreground disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
          </div>

          <div className={card}>
            <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground">Spent in {monthLabel(key).split(" ")[0]}</p>
            <p className="font-heading text-xl text-foreground mt-0.5">{money(cur.total)}</p>
            <p className="text-[12.5px] text-muted-foreground mt-1">
              {delta != null && <span className={`text-[11px] px-2 py-0.5 rounded-full mr-1.5 ${delta > 0 ? "bg-[#F4E6E7] text-[#8F5F65]" : "bg-[#E4E9D5] text-[#566033]"}`}>{delta > 0 ? "▲" : "▼"} {Math.abs(delta)}%</span>}
              {delta != null ? "vs last month · " : ""}{cur.statements} statement{cur.statements === 1 ? "" : "s"} · {cur.count} purchases
            </p>
          </div>

          <div className="bg-secondary/60 border border-border rounded-2xl p-4 mb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-[#A7773F]" strokeWidth={1.5} /><h3 className="font-heading text-base font-bold text-foreground">Habits review</h3></div>
              {review && <button onClick={writeReview} disabled={reviewBusy} className="text-xs text-[#A7773F]">{reviewBusy ? "Writing…" : "Refresh"}</button>}
            </div>
            {review ? <p className="text-[15px] text-foreground leading-snug">{review}</p> : (
              <button onClick={writeReview} disabled={reviewBusy} className="border border-[#A7773F] text-[#A7773F] rounded-full text-[13px] px-4 py-1.5 disabled:opacity-60">{reviewBusy ? "Reviewing…" : "Review my habits"}</button>
            )}
          </div>

          <div className={card}>
            <h3 className="font-heading text-base text-foreground mb-2">Where it went</h3>
            {cur.categories.map((c) => {
              const b = budgetFor(c.name);
              const over = b != null && c.total > b;
              return (
                <div key={c.name} className="my-3 first:mt-1">
                  <div className="flex justify-between text-[13px]"><span className="text-foreground">{c.name}</span><span className="text-muted-foreground">{money(c.total)} · {Math.round((c.total / cur.total) * 100)}%</span></div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1.5"><div className="h-full rounded-full" style={{ width: `${(c.total / maxCat) * 100}%`, background: over ? "#8F5F65" : "#A7773F" }} /></div>
                  {b != null && <p className="text-[11.5px] mt-1" style={{ color: over ? "#8F5F65" : undefined }}>{over ? `Budget ${money(b)} · ${money(c.total - b)} over` : <span className="text-muted-foreground">Budget {money(b)} · on track</span>}</p>}
                </div>
              );
            })}
          </div>

          <div className={card}>
            <h3 className="font-heading text-base text-foreground mb-1">Top places</h3>
            {cur.merchants.slice(0, 6).map((m) => (
              <div key={m.name} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                <div><p className="text-[13.5px] text-foreground">{m.name}</p><p className="text-[11.5px] text-muted-foreground">{m.count} {m.count === 1 ? "purchase" : "purchases"}</p></div>
                <span className="text-[13.5px] text-foreground">{money(m.total)}</span>
              </div>
            ))}
          </div>

          {notes.length > 0 && (
            <div className={card}>
              <h3 className="font-heading text-base text-foreground mb-1">Worth noticing</h3>
              {notes.map((n) => (
                <div key={n.text} className="flex gap-2.5 py-2.5 border-b border-border last:border-0 text-[13px] leading-snug">
                  <span className="w-[7px] h-[7px] rounded-full mt-1.5 flex-shrink-0" style={{ background: TONE_DOT[n.tone] }} />
                  <div className="flex-1"><p className="text-foreground">{n.text}</p><p className="text-muted-foreground text-[12px]">{n.sub}</p></div>
                  {n.add && <button onClick={() => addSub(n.add)} className="text-[12.5px] text-[#A7773F] self-start flex-shrink-0">Add it</button>}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {statements.length > 0 && (
        <div className={card}>
          <h3 className="font-heading text-base text-foreground mb-1">Statements added</h3>
          {statements.map((s) => (
            <div key={s.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div className="min-w-0"><p className="text-[13.5px] text-foreground truncate">{s.label}</p>
                <p className="text-[11.5px] text-muted-foreground">{Object.keys(s.months || {}).sort().map((k) => monthLabel(k).split(" ")[0].slice(0, 3)).join(", ")} · {s.count} purchases</p></div>
              <button onClick={() => removeStatement(s)} className="text-[12px] text-[#8F5F65] flex-shrink-0 ml-3">Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
