import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { ent } from "@/lib/freshEntities";
import { monthView, monthsWithData, habits, throughLabel, statementRange, findRepeatedRows, overlappingOldStatements, buildMonths } from "@/lib/spending";

const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString()}`;
const monthLabel = (k) => new Date(Number(k.slice(0, 4)), Number(k.slice(5)) - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
const mk = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const TONE_DOT = { bad: "#8F5F65", good: "#566033", neutral: "#A7773F", note: "#566033" };
const card = "bg-card border border-border rounded-2xl p-4 mb-3";

export default function SpendingTab({ items = [], onImport }) {
  const [statements, setStatements] = useState([]);
  const [buckets, setBuckets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(null);
  const [review, setReview] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [dismissed, setDismissed] = useState([]);
  const [allCats, setAllCats] = useState(false);
  const [allPlaces, setAllPlaces] = useState(false);
  const [showStatements, setShowStatements] = useState(false);
  const [dupCheck, setDupCheck] = useState(null); // { repeated, old } after "Check for duplicates"
  const [fixing, setFixing] = useState(false);

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

  const [viewer, setViewer] = useState(null); // { url, type, label }
  const openFile = async (s) => {
    try { setViewer({ url: await base44.integrations.Core.GetPrivateFile({ file_url: s.file_url }), type: s.file_type || "", label: s.label }); }
    catch { alert("Couldn't open that file."); }
  };
  const closeViewer = () => { if (viewer?.url) URL.revokeObjectURL(viewer.url); setViewer(null); };

  const removeStatement = async (s) => {
    if (!confirm(`Remove ${s.label}? Its totals will be deleted.`)) return;
    try { await ent.SpendingStatement.delete(s.id); } catch { /* ignore */ }
    if (s.file_url) { try { await base44.integrations.Core.DeletePrivateFile({ file_url: s.file_url }); } catch { /* ignore */ } }
    load();
  };

  const checkDuplicates = () => setDupCheck({ repeated: findRepeatedRows(statements), old: overlappingOldStatements(statements) });
  const fixRepeated = async () => {
    setFixing(true);
    try {
      for (const { statement, keep } of dupCheck.repeated) {
        if (!keep.length) await ent.SpendingStatement.delete(statement.id);
        else await ent.SpendingStatement.update(statement.id, { rows: keep, count: keep.length, months: buildMonths(keep.map((r) => ({ ...r, t: "purchase" }))) });
      }
    } catch { /* reload shows what saved */ }
    setFixing(false); setDupCheck(null); load();
  };
  const shortDay = (d) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

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
        <button onClick={onImport} className="bg-[#A7773F] text-[#F7F3EC] rounded-full font-heading text-[13px] px-4 py-1.5 hover:opacity-90">+ Add statement</button>
      </div>

      {loading && <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>}

      {!loading && !cur && (
        <div className="text-center py-10">
          <p className="font-heading text-base text-foreground mb-1">No spending yet.</p>
          <p className="text-[13px] text-muted-foreground max-w-xs mx-auto leading-snug mb-4">Add a bank or card statement and Guía will show where your money goes and what has changed. The same upload also updates your bills and loans.</p>
          <button onClick={onImport} className="bg-[#A7773F] text-[#F7F3EC] rounded-full font-heading text-[13px] px-4 py-1.5">+ Add statement</button>
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
              {delta != null ? "vs last month · " : ""}{throughLabel(cur.to) ? `${throughLabel(cur.to)} · ` : ""}{cur.count} purchases from {cur.statements} statement{cur.statements === 1 ? "" : "s"}
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
            {(allCats ? cur.categories : cur.categories.slice(0, 5)).map((c) => {
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

          {cur.categories.length > 5 && <button onClick={() => setAllCats((v) => !v)} className="text-xs text-[#A7773F] -mt-1 mb-3 ml-1">{allCats ? "Show fewer categories" : `Show all ${cur.categories.length} categories ›`}</button>}

          <div className={card}>
            <h3 className="font-heading text-base text-foreground mb-1">Top places</h3>
            {(allPlaces ? cur.merchants.slice(0, 20) : cur.merchants.slice(0, 4)).map((m) => (
              <div key={m.name} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                <div><p className="text-[13.5px] text-foreground">{m.name}</p><p className="text-[11.5px] text-muted-foreground">{m.count} {m.count === 1 ? "purchase" : "purchases"}</p></div>
                <span className="text-[13.5px] text-foreground">{money(m.total)}</span>
              </div>
            ))}
            {cur.merchants.length > 4 && <button onClick={() => setAllPlaces((v) => !v)} className="text-xs text-[#A7773F] pt-2">{allPlaces ? "Show fewer" : `Show more places ›`}</button>}
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
          <button onClick={() => setShowStatements((v) => !v)} className="w-full flex items-center justify-between">
            <h3 className="font-heading text-base text-foreground">Statements added <span className="text-muted-foreground text-sm">· {statements.length}</span></h3>
            <span className="text-xs text-[#A7773F]">{showStatements ? "Hide" : "Show"}</span>
          </button>
          {showStatements && (
            <div className="mt-2 mb-1">
              {!dupCheck ? (
                <button onClick={checkDuplicates} className="text-[12.5px] font-medium text-[#A7773F]">Check for duplicates</button>
              ) : (
                <div className="bg-secondary/60 rounded-xl p-3 text-[12.5px] text-foreground space-y-2">
                  {dupCheck.repeated.length === 0 && dupCheck.old.length === 0 && <p>No duplicates found.</p>}
                  {dupCheck.repeated.length > 0 && (
                    <>
                      <p>{dupCheck.repeated.reduce((t, x) => t + x.drop.length, 0)} purchases appear in more than one statement, for example {dupCheck.repeated[0].drop.slice(0, 2).map((r) => `${r.m} on ${shortDay(r.d)}`).join(" and ")}. The first copy is kept.</p>
                      <button disabled={fixing} onClick={fixRepeated} className="bg-[#A7773F] text-[#F7F3EC] rounded-full px-3.5 py-1.5 text-[12.5px] font-medium disabled:opacity-50">{fixing ? "Removing…" : "Remove the repeats"}</button>
                    </>
                  )}
                  {dupCheck.old.map((o, i) => (
                    <p key={i}><b className="font-medium">{o.a.label}</b> and <b className="font-medium">{o.b.label}</b> both cover {o.from === o.to ? shortDay(o.from) : `${shortDay(o.from)} to ${shortDay(o.to)}`}. They were added before Guía kept each purchase, so the overlap can't be split out. Remove both and upload the two files again together; purchases that appear in both are counted once.</p>
                  ))}
                  <button onClick={() => setDupCheck(null)} className="text-[12px] text-muted-foreground">Done</button>
                </div>
              )}
            </div>
          )}
          {showStatements && statements.map((s) => (
            <div key={s.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 mt-1">
              <div className="min-w-0">{s.file_url
                ? <button onClick={() => openFile(s)} className="text-[13.5px] text-foreground truncate block max-w-full text-left underline decoration-[#A7773F]/50 underline-offset-2">{s.label}</button>
                : <p className="text-[13.5px] text-foreground truncate">{s.label}</p>}
                <p className="text-[11.5px] text-muted-foreground">{statementRange(s) || Object.keys(s.months || {}).sort().map((k) => monthLabel(k).split(" ")[0].slice(0, 3)).join(", ")} · {s.count} purchases{s.file_url ? "" : " · file not kept"}</p></div>
              <button onClick={() => removeStatement(s)} className="text-[12px] text-[#8F5F65] flex-shrink-0 ml-3">Remove</button>
            </div>
          ))}
        </div>
      )}
      {viewer && (
        <div className="fixed inset-0 z-[80] bg-black/80 flex flex-col" onClick={closeViewer}>
          <div className="flex items-center justify-between px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
            <span className="text-sm truncate pr-3">{viewer.label}</span>
            <button onClick={closeViewer} className="text-sm">Close</button>
          </div>
          <div className="flex-1 overflow-auto flex items-start justify-center p-3" onClick={(e) => e.stopPropagation()}>
            {viewer.type === "application/pdf"
              ? <iframe title={viewer.label} src={viewer.url} className="w-full h-full bg-white rounded-lg" />
              : viewer.type.startsWith("image/") || !viewer.type
                ? <img src={viewer.url} alt={viewer.label} className="max-w-full h-auto rounded-lg" />
                : <a href={viewer.url} download className="text-white underline mt-10">Download file</a>}
          </div>
        </div>
      )}
    </div>
  );
}
