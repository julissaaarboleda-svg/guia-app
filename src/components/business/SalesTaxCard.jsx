import { useEffect, useMemo, useState } from "react";
import { ReceiptText, ExternalLink, Check, Bell, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { ent } from "@/lib/freshEntities";
import { monthKeyOf } from "@/lib/financeHelpers";
import { keyOf, quarterOf, shift, nextReturn, daysUntil, niceDate, quarterSales, money, WEBFILE_URL, WAIVER_URL } from "@/lib/salesTax";

// Sales tax for the business: catch up on late quarters (tax and penalty tracked apart, with the
// penalty waiver flow), the next return with that quarter's sales, and a history.
// Amounts owed become one-time bills in Finance, so they count in the budget; paying either place syncs.

const today = () => keyOf(new Date());
const plus = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return keyOf(d); };
const num = (v) => { const n = Number(String(v || "").replace(/[$,\s]/g, "")); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0; };

function MoneyInput({ label, value, onChange }) {
  return (
    <label className="block flex-1 min-w-0">
      <span className="block text-[11.5px] text-muted-foreground mb-1">{label}</span>
      <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0.00"
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-[16px] md:text-[14px] text-foreground outline-none focus:border-[#A7773F]" />
    </label>
  );
}

const Btn = ({ onClick, children, solid, href, disabled }) => {
  const cls = `inline-flex items-center gap-1 text-[12.5px] rounded-full px-3 py-1.5 whitespace-nowrap ${solid ? "bg-[#2E2A27] text-[#F7F3EC]" : "border border-[#A7773F]/70 text-[#8A5F2F]"} disabled:opacity-50`;
  if (href) return <a href={href} target="_blank" rel="noreferrer" onClick={onClick} className={cls}>{children}<ExternalLink className="w-3 h-3" /></a>;
  return <button type="button" onClick={onClick} disabled={disabled} className={cls}>{children}</button>;
};

export default function SalesTaxCard({ business, entries, readOnly, onEntriesChange, onBusinessChange }) {
  const [periods, setPeriods] = useState(null);
  const [bills, setBills] = useState([]);
  const [open, setOpen] = useState({});
  const [draft, setDraft] = useState({});
  const [filing, setFiling] = useState(null); // { tax, paid }
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [exp, setExp] = useState({});
  const [histOpen, setHistOpen] = useState(null);
  const enabled = !!business?.sales_tax?.enabled;
  const bizId = business?.id;

  const [loadFailed, setLoadFailed] = useState(false);
  // A failed load keeps what's already on screen (retrying once) instead of acting as if nothing was
  // ever filed, which would move the filing reminder back to a quarter that's already done.
  const load = async () => {
    const attempt = () => Promise.all([ent.SalesTaxPeriod.list(), ent.FinanceItem.list()]);
    let res;
    try { res = await attempt(); } catch {
      await new Promise((r) => setTimeout(r, 1500));
      try { res = await attempt(); } catch (e) { console.error("Sales tax failed to load:", e); setLoadFailed(true); return; }
    }
    const [p, b] = res;
    setLoadFailed(false);
    setPeriods((p || []).filter((x) => x.business_id === bizId));
    setBills((b || []).filter((x) => x.source === "sales_tax"));
  };
  useEffect(() => { if (enabled && bizId) load(); }, [enabled, bizId]);

  const byId = useMemo(() => Object.fromEntries((periods || []).map((p) => [p.period, p])), [periods]);
  const billOf = (id) => bills.find((b) => b.id === id);

  // Keep in step with Finance: a bill marked paid there counts here, and a pending penalty's
  // placeholder date keeps moving out so it never shows as overdue while the waiver is reviewed.
  useEffect(() => {
    if (!periods || readOnly) return;
    periods.forEach(async (p) => {
      const tb = p.tax_bill_id && billOf(p.tax_bill_id);
      if (tb && tb.paid && !p.tax_paid) await markTaxPaid(p, true);
      const pb = p.penalty_bill_id && billOf(p.penalty_bill_id);
      if (pb && pb.paid && p.penalty_status !== "paid") await setPenalty(p, "paid", true);
      if (pb && !pb.paid && p.penalty_status === "pending" && String(pb.due_date || "") < plus(7)) {
        try { await ent.FinanceItem.update(pb.id, { due_date: plus(30) }); } catch { /* ignore */ }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periods, bills]);

  // The to-do that reminds you to file (and shows on Home, the welcome screen and your calendar).
  const ensureFilingTask = async (qtr) => {
    try {
      const tasks = (await ent.Task.list()) || [];
      // Clear reminders for quarters past the one that's actually next (left over from a mis-tap).
      await Promise.all(tasks.filter((t) => t.source === "sales_tax" && !t.completed && t.tax_period && t.tax_period > qtr.id).map((t) => ent.Task.delete(t.id).catch(() => {})));
      const has = tasks.find((t) => t.source === "sales_tax" && t.tax_period === qtr.id);
      if (!has) await ent.Task.create({ title: `File Texas sales tax (${qtr.label})`, notes: `Return for ${qtr.longLabel}. File and pay in Webfile on the Comptroller's site.`, priority: "high", due_date: qtr.due, completed: false, source: "sales_tax", tax_period: qtr.id, category: "business" });
    } catch { /* reminders are a bonus */ }
  };
  const completeFilingTask = async (qid) => {
    try {
      const tasks = (await ent.Task.list()) || [];
      await Promise.all(tasks.filter((t) => t.source === "sales_tax" && t.tax_period === qid && !t.completed).map((t) => ent.Task.update(t.id, { completed: true, completed_at: new Date().toISOString() })));
    } catch { /* ignore */ }
  };

  // A quarter can only be filed once it has started; ignore anything marked filed before that.
  const filedIds = useMemo(() => new Set((periods || []).filter((p) => p.filed && quarterStart(p.period) <= today()).map((p) => p.period)), [periods]);
  const next = useMemo(() => nextReturn(new Date(), filedIds), [filedIds]);
  useEffect(() => { if (enabled && periods && !readOnly) ensureFilingTask(next); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [enabled, periods, next.id]);

  const logExpense = async (name, amount) => {
    if (!amount) return;
    try { await ent.BusinessEntry.create({ category: "Expense", name, date: today(), revenue: null, expense: amount, business_id: bizId, location: "", description: "", notes: "From Sales tax", document_id: null }); onEntriesChange?.(); } catch { /* ignore */ }
  };

  const savePeriod = async (qid, patch) => {
    const cur = byId[qid];
    const rec = cur ? await ent.SalesTaxPeriod.update(cur.id, patch) : await ent.SalesTaxPeriod.create({ business_id: bizId, period: qid, ...patch });
    setPeriods((list) => [...(list || []).filter((x) => x.period !== qid), { ...(cur || {}), ...rec }]);
    return { ...(cur || {}), ...rec };
  };

  const billFor = async (existingId, data) => {
    if (existingId && billOf(existingId)) { const u = await ent.FinanceItem.update(existingId, data); setBills((l) => l.map((b) => (b.id === existingId ? { ...b, ...u } : b))); return existingId; }
    const c = await ent.FinanceItem.create({ type: "bill", billing_cycle: "one_time", paid: false, category: "Taxes", is_fixed: false, notes: "", source: "sales_tax", ...data });
    setBills((l) => [...l, c]);
    return c.id;
  };
  const dropBill = async (id) => { if (!id) return; try { await ent.FinanceItem.delete(id); } catch { /* gone */ } setBills((l) => l.filter((b) => b.id !== id)); };

  // Save what you owe for a late quarter: tax becomes a bill due now, the penalty its own bill.
  const saveOwed = async (qtr) => {
    const d = draft[qtr.id] || {};
    const tax = num(d.tax), penalty = num(d.penalty);
    if (!tax && !penalty) { setErr("Enter the tax, the penalty, or both."); return; }
    setBusy(qtr.id); setErr("");
    try {
      const cur = byId[qtr.id] || {};
      let tax_bill_id = cur.tax_bill_id || null, penalty_bill_id = cur.penalty_bill_id || null;
      if (tax) tax_bill_id = await billFor(tax_bill_id, { name: `Texas sales tax, ${qtr.label}`, amount: tax, due_date: today() });
      else if (tax_bill_id) { await dropBill(tax_bill_id); tax_bill_id = null; }
      const pStatus = cur.penalty_status && cur.penalty_status !== "paid" ? cur.penalty_status : "due";
      if (penalty) penalty_bill_id = await billFor(penalty_bill_id, { name: `Sales tax penalty, ${qtr.label}${pStatus === "pending" ? " (waiver pending)" : ""}`, amount: penalty, due_date: pStatus === "pending" ? plus(30) : today() });
      else if (penalty_bill_id) { await dropBill(penalty_bill_id); penalty_bill_id = null; }
      await savePeriod(qtr.id, { filed: true, late: true, filed_date: cur.filed_date || today(), tax_owed: tax, tax_paid: tax ? !!cur.tax_paid && cur.tax_owed === tax : true, tax_bill_id, penalty, penalty_status: penalty ? pStatus : null, penalty_bill_id });
      setDraft((x) => ({ ...x, [qtr.id]: undefined }));
      setOpen((o) => ({ ...o, [qtr.id]: false }));
      await completeFilingTask(qtr.id);
    } catch { setErr("Couldn't save. Try again."); }
    setBusy("");
  };

  const markTaxPaid = async (p, fromBill = false) => {
    setBusy(p.period);
    try {
      if (!fromBill && p.tax_bill_id) { await ent.FinanceItem.update(p.tax_bill_id, { paid: true, paid_month: monthKeyOf() }); setBills((l) => l.map((b) => (b.id === p.tax_bill_id ? { ...b, paid: true } : b))); }
      await savePeriod(p.period, { tax_paid: true, tax_paid_date: today() });
      await logExpense(`Texas sales tax, ${labelOf(p.period)}`, p.tax_owed);
    } catch { setErr("Couldn't update. Try again."); }
    setBusy("");
  };

  const setPenalty = async (p, status, fromBill = false) => {
    setBusy(p.period);
    try {
      const label = labelOf(p.period);
      if (status === "pending") await billFor(p.penalty_bill_id, { name: `Sales tax penalty, ${label} (waiver pending)`, due_date: plus(30) });
      if (status === "denied") await billFor(p.penalty_bill_id, { name: `Sales tax penalty, ${label}`, due_date: today() });
      if (status === "approved") await dropBill(p.penalty_bill_id);
      if (status === "paid") {
        if (!fromBill && p.penalty_bill_id) { await ent.FinanceItem.update(p.penalty_bill_id, { paid: true, paid_month: monthKeyOf(), name: `Sales tax penalty, ${label}` }); setBills((l) => l.map((b) => (b.id === p.penalty_bill_id ? { ...b, paid: true } : b))); }
        await logExpense(`Sales tax penalty, ${label}`, p.penalty);
      }
      await savePeriod(p.period, { penalty_status: status, ...(status === "pending" ? { waiver_requested: today() } : {}), ...(status === "approved" ? { penalty_bill_id: null } : {}) });
    } catch { setErr("Couldn't update. Try again."); }
    setBusy("");
  };

  const fileNext = async () => {
    const tax = num(filing?.tax);
    setBusy(next.id); setErr("");
    try {
      let tax_bill_id = null;
      if (tax && !filing.paid) tax_bill_id = await billFor(null, { name: `Texas sales tax, ${next.label}`, amount: tax, due_date: next.due < today() ? today() : next.due });
      await savePeriod(next.id, { filed: true, late: next.due < today(), filed_date: today(), tax_owed: tax, tax_paid: !tax || !!filing.paid, tax_bill_id, penalty: 0, penalty_status: null });
      if (tax && filing.paid) await logExpense(`Texas sales tax, ${next.label}`, tax);
      await completeFilingTask(next.id);
      setFiling(null);
    } catch { setErr("Couldn't save. Try again."); }
    setBusy("");
  };

  const undo = async (p) => {
    if (!confirm(`Undo ${labelOf(p.period, true)}? Its status and any unpaid sales tax bills are removed.`)) return;
    setBusy(p.period);
    try {
      for (const id of [p.tax_bill_id, p.penalty_bill_id]) { const b = id && billOf(id); if (b && !b.paid) await dropBill(id); }
      await ent.SalesTaxPeriod.delete(p.id);
      setPeriods((list) => (list || []).filter((x) => x.id !== p.id));
    } catch { setErr("Couldn't undo. Try again."); }
    setBusy("");
  };

  if (!business) return null;

  if (!enabled) {
    if (readOnly) return null;
    return (
      <div className="bg-card border border-border rounded-2xl p-4 mb-5 flex items-center gap-3">
        <span className="w-9 h-9 rounded-xl bg-[#A7773F]/10 text-[#A7773F] flex items-center justify-center shrink-0"><ReceiptText className="w-[18px] h-[18px]" /></span>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] text-foreground">Sales tax reminders</p>
          <p className="text-[12px] text-muted-foreground">Texas quarterly returns, what you owe, and penalty waivers.</p>
        </div>
        <Btn solid onClick={async () => { const u = await ent.Business.update(bizId, { sales_tax: { enabled: true, state: "TX", frequency: "quarterly" } }); onBusinessChange?.({ ...business, ...u, sales_tax: { enabled: true, state: "TX", frequency: "quarterly" } }); }}>Set up</Btn>
      </div>
    );
  }

  if (!periods && loadFailed) return (
    <div className="rounded-2xl border border-border p-4 mb-5 text-sm text-muted-foreground flex items-center justify-between gap-3">
      <span>Sales tax couldn't load. Check your connection.</span>
      <button type="button" onClick={() => { setLoadFailed(false); load(); }} className="text-[#A7773F] font-medium shrink-0">Try again</button>
    </div>
  );
  if (!periods) return <div className="h-28 rounded-2xl bg-muted/40 animate-pulse mb-5" />;

  // Past quarters (last four) that still need something: not marked yet, money owed, or a penalty open.
  const cur = quarterOf(new Date());
  const past = [1, 2, 3, 4].map((n) => shift(cur, -n)).filter((q) => q.due < today() && q.id !== next.id);
  const needsWork = (q) => {
    const p = byId[q.id];
    if (!p) return true;
    if (!p.filed) return true;
    if (p.tax_owed > 0 && !p.tax_paid) return true;
    if (p.penalty > 0 && ["due", "pending", "denied"].includes(p.penalty_status)) return true;
    return false;
  };
  const catchUp = past.filter(needsWork);
  const owedTotal = catchUp.reduce((t, q) => { const p = byId[q.id] || {}; return t + (p.tax_owed && !p.tax_paid ? p.tax_owed : 0) + (p.penalty && ["due", "denied"].includes(p.penalty_status) ? p.penalty : 0); }, 0);
  const sales = quarterSales(entries, next);
  const dl = daysUntil(next.due);

  return (
    <section className="mb-5 space-y-2.5">
      <div className="flex items-center gap-2 px-0.5">
        <ReceiptText className="w-4 h-4 text-[#A7773F]" />
        <h2 className="font-heading text-[18px] text-foreground">Sales tax</h2>
        <span className="ml-auto text-[12px] text-muted-foreground">Texas · quarterly</span>
      </div>

      {catchUp.length > 0 && (
        <div className="bg-card border border-[#A77C81]/50 rounded-2xl p-4">
          <p className="text-[10.5px] font-semibold tracking-[0.12em] uppercase text-[#8F5F65]">Catch up · {catchUp.length} past quarter{catchUp.length === 1 ? "" : "s"}</p>
          {owedTotal > 0 && <p className="text-[13px] text-foreground mt-1">{money(owedTotal)} owed right now. It's in your Finance bills.</p>}
          {catchUp.filter((q) => byId[q.id]?.penalty > 0 && byId[q.id]?.penalty_status === "due").length > 2 && (
            <p className="text-[12px] text-muted-foreground mt-1">One waiver request can cover up to 2 quarters, so you may need two requests.</p>
          )}
          <div className="mt-1 divide-y divide-border/60">
            {catchUp.map((q) => {
              const p = byId[q.id];
              const d = draft[q.id] || {};
              const editing = !p || open[q.id];
              const expanded = !p || open[q.id] || exp[q.id];
              const summary = p ? [
                p.tax_owed > 0 && !p.tax_paid ? `Tax ${money(p.tax_owed)} owed` : null,
                p.penalty > 0 ? `Penalty ${money(p.penalty)}${p.penalty_status === "pending" ? ", waiver pending" : p.penalty_status === "denied" ? ", waiver denied" : ""}` : null,
              ].filter(Boolean).join(" · ") : "Needs an update";
              return (
                <div key={q.id} className="py-3">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => p && setExp((x) => ({ ...x, [q.id]: !x[q.id] }))} aria-expanded={!!expanded} className="flex items-center gap-1.5 text-left min-w-0 flex-1">
                      {p && (expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />)}
                      <span className="min-w-0">
                        <span className="text-[14px] text-foreground">{q.longLabel}</span>
                        <span className="text-[12px] text-muted-foreground"> · due {niceDate(q.due)}</span>
                        {!expanded && <span className="block text-[12px] text-[#8F5F65] truncate">{summary}</span>}
                      </span>
                    </button>
                    {p && expanded && !open[q.id] && !readOnly && <button type="button" onClick={() => { setOpen((o) => ({ ...o, [q.id]: true })); setDraft((x) => ({ ...x, [q.id]: { tax: p.tax_owed || "", penalty: p.penalty || "" } })); }} className="text-[12px] text-[#A7773F] shrink-0">Edit</button>}
                  </div>

                  {!p && !readOnly && !d.mode && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <Btn onClick={() => savePeriod(q.id, { filed: true, late: false, tax_owed: 0, tax_paid: true, penalty: 0 })}>Filed and paid on time</Btn>
                      <Btn onClick={() => setDraft((x) => ({ ...x, [q.id]: { mode: "late" } }))}>Filed late or still owe</Btn>
                      <Btn onClick={() => setDraft((x) => ({ ...x, [q.id]: { mode: "notfiled" } }))}>Not filed yet</Btn>
                    </div>
                  )}
                  {!p && d.mode === "notfiled" && (
                    <div className="mt-2 text-[12.5px] text-muted-foreground">
                      <p className="mb-2">File it in Webfile as soon as you can. Then come back and enter what it says you owe.</p>
                      <div className="flex gap-1.5"><Btn href={WEBFILE_URL}>Open Webfile</Btn><Btn onClick={() => setDraft((x) => ({ ...x, [q.id]: { mode: "late" } }))}>I've filed it</Btn></div>
                    </div>
                  )}
                  {editing && (d.mode === "late" || p) && !readOnly && (
                    <div className="mt-2">
                      <p className="text-[12px] text-muted-foreground mb-2">Copy the amounts from Webfile. Tax becomes a bill due now. The penalty is tracked on its own, in case it's waived.</p>
                      <div className="flex gap-2">
                        <MoneyInput label="Tax owed" value={d.tax ?? ""} onChange={(v) => setDraft((x) => ({ ...x, [q.id]: { ...d, tax: v } }))} />
                        <MoneyInput label="Penalty" value={d.penalty ?? ""} onChange={(v) => setDraft((x) => ({ ...x, [q.id]: { ...d, penalty: v } }))} />
                      </div>
                      <div className="flex gap-1.5 mt-2">
                        <Btn solid disabled={busy === q.id} onClick={() => saveOwed(q)}>{busy === q.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}Save</Btn>
                        {p && <Btn onClick={() => setOpen((o) => ({ ...o, [q.id]: false }))}>Cancel</Btn>}
                      </div>
                    </div>
                  )}

                  {p && !open[q.id] && expanded && (
                    <div className="mt-1.5 space-y-2 pl-[22px]">
                      {p.tax_owed > 0 && (
                        <div className="flex items-center gap-2 text-[13px]">
                          <span className={`w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 ${p.tax_paid ? "bg-[#7D8A53]" : "border-[1.5px] border-[#A7773F]"}`}>{p.tax_paid && <Check className="w-3 h-3 text-white" strokeWidth={3} />}</span>
                          <span className="flex-1 min-w-0">Tax {money(p.tax_owed)}{p.tax_paid ? " · paid" : ""}</span>
                          {!p.tax_paid && !readOnly && <><Btn href={WEBFILE_URL}>Pay</Btn><Btn disabled={busy === q.id} onClick={() => markTaxPaid(p)}>Paid</Btn></>}
                        </div>
                      )}
                      {p.penalty > 0 && (
                        <div className="text-[13px]">
                          <div className="flex items-center gap-2">
                            <span className={`w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 ${["approved", "paid"].includes(p.penalty_status) ? "bg-[#7D8A53]" : "border-[1.5px] border-[#A77C81]"}`}>{["approved", "paid"].includes(p.penalty_status) && <Check className="w-3 h-3 text-white" strokeWidth={3} />}</span>
                            <span className="flex-1 min-w-0">
                              Penalty {money(p.penalty)}
                              <span className="text-muted-foreground">{p.penalty_status === "pending" ? " · waiver pending, set aside in your budget" : p.penalty_status === "denied" ? " · waiver denied" : p.penalty_status === "approved" ? " · waived" : p.penalty_status === "paid" ? " · paid" : ""}</span>
                            </span>
                          </div>
                          {!readOnly && ["due", "denied"].includes(p.penalty_status) && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5 pl-[26px]">
                              {p.penalty_status === "due" && <Btn href={WAIVER_URL} onClick={() => setPenalty(p, "pending")}>Request waiver</Btn>}
                              <Btn disabled={busy === q.id} onClick={() => setPenalty(p, "paid")}>Paid</Btn>
                            </div>
                          )}
                          {!readOnly && p.penalty_status === "pending" && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5 pl-[26px]">
                              <span className="text-[12px] text-muted-foreground self-center mr-1">Heard back?</span>
                              <Btn disabled={busy === q.id} onClick={() => setPenalty(p, "approved")}>Approved</Btn>
                              <Btn disabled={busy === q.id} onClick={() => setPenalty(p, "denied")}>Denied</Btn>
                            </div>
                          )}
                          {p.penalty_status === "due" && p.tax_owed > 0 && !p.tax_paid && <p className="text-[11.5px] text-muted-foreground mt-1 pl-[26px]">Pay the tax first. The Comptroller only reviews a waiver once the tax is paid.</p>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {err && <p className="text-[12px] text-destructive mt-1">{err}</p>}
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="text-[10.5px] font-semibold tracking-[0.12em] uppercase text-[#A7773F]">Next return</p>
        <div className="flex items-baseline gap-2 mt-1">
          <p className="font-heading text-[24px] text-foreground leading-none">{niceDate(next.due)}</p>
          <span className="text-[12.5px] text-muted-foreground">{next.label} · {dl === 0 ? "due today" : dl > 0 ? `in ${dl} day${dl === 1 ? "" : "s"}` : `${-dl} days late`}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="rounded-xl bg-background/70 px-3 py-2"><p className="text-[11.5px] text-muted-foreground">Sales this quarter</p><p className="text-[17px] text-foreground">{money(sales.total)}</p></div>
          <div className="rounded-xl bg-background/70 px-3 py-2"><p className="text-[11.5px] text-muted-foreground">From your entries</p><p className="text-[13px] text-foreground mt-0.5">{sales.count} sale{sales.count === 1 ? "" : "s"}</p></div>
        </div>
        <p className="text-[12px] text-muted-foreground mt-2.5 flex items-center gap-1.5"><Bell className="w-3.5 h-3.5 text-[#A7773F]" />A to-do and calendar reminders a week before and the day before</p>
        {today() < next.start ? (
          <p className="text-[12.5px] text-muted-foreground mt-3">Nothing to file yet. You can file this one once the quarter ends on {niceDate(next.end)}.</p>
        ) : !readOnly && (filing ? (
          <div className="mt-3">
            <div className="flex gap-2 items-end">
              <MoneyInput label="Tax on this return" value={filing.tax} onChange={(v) => setFiling((f) => ({ ...f, tax: v }))} />
              <label className="flex items-center gap-2 text-[13px] text-foreground pb-2.5">
                <input type="checkbox" checked={filing.paid} onChange={(e) => setFiling((f) => ({ ...f, paid: e.target.checked }))} className="accent-[#A7773F] w-4 h-4" />Paid with it
              </label>
            </div>
            <div className="flex gap-1.5 mt-2">
              <Btn solid disabled={busy === next.id} onClick={fileNext}>Save as filed</Btn>
              <Btn onClick={() => setFiling(null)}>Cancel</Btn>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 mt-3">
            <button type="button" onClick={() => setFiling({ tax: "", paid: true })} className="flex-1 h-10 rounded-xl bg-[#2E2A27] text-[#F7F3EC] text-[13.5px]">Mark as filed</button>
            <a href={WEBFILE_URL} target="_blank" rel="noreferrer" className="h-10 px-3.5 rounded-xl border border-border text-[13px] text-foreground inline-flex items-center gap-1">File online<ExternalLink className="w-3.5 h-3.5" /></a>
          </div>
        ))}
        {err && catchUp.length === 0 && <p className="text-[12px] text-destructive mt-1.5">{err}</p>}
      </div>

      {(periods || []).length > 0 && (
        <div className="bg-card border border-border rounded-2xl px-4 py-2.5">
          <button type="button" onClick={() => setShowHistory((v) => !v)} className="w-full flex items-center gap-1.5 text-left">
            {showHistory ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            <span className="text-[13px] text-foreground">History</span>
            <span className="ml-auto text-[12px] text-muted-foreground">{periods.length} quarter{periods.length === 1 ? "" : "s"}</span>
          </button>
          {showHistory && (
            <div className="mt-1 divide-y divide-border/60">
              {[...periods].sort((a, b) => b.period.localeCompare(a.period)).map((p) => {
                const owed = (p.tax_owed > 0 && !p.tax_paid) || (p.penalty > 0 && ["due", "denied", "pending"].includes(p.penalty_status));
                const tag = !p.filed ? "Not filed" : owed ? (p.late ? "Filed late · owed" : "Filed · owed") : p.late ? "Filed late · settled" : "Filed on time";
                const good = p.filed && !owed && !p.late;
                return (
                  <div key={p.id} className="py-2 text-[13px]">
                    <button type="button" onClick={() => setHistOpen((h) => (h === p.id ? null : p.id))} className="w-full flex items-center gap-2 text-left">
                      <span className="flex-1 text-foreground">{labelOf(p.period, true)}{quarterStart(p.period) > today() ? <span className="text-muted-foreground"> · hasn't started</span> : null}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${good ? "bg-[#7D8A53]/15 text-[#566033]" : owed ? "bg-[#A77C81]/15 text-[#8F5F65]" : "bg-muted text-muted-foreground"}`}>{tag}</span>
                    </button>
                    {histOpen === p.id && !readOnly && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[12px] text-muted-foreground flex-1">{p.filed_date ? `Marked filed ${niceDate(p.filed_date)}` : ""}</span>
                        <Btn disabled={busy === p.period} onClick={() => undo(p)}>Undo</Btn>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground px-0.5">Due dates assume the 20th, moved to Monday on weekends. Check the Comptroller's site for holiday changes. Not tax advice.</p>
    </section>
  );
}

function quarterStart(id) {
  const [y, q] = String(id).split("-Q").map(Number);
  return `${y}-${String((q - 1) * 3 + 1).padStart(2, "0")}-01`;
}

function labelOf(id, long = false) {
  const [y, q] = String(id).split("-Q").map(Number);
  const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const s = `${M[(q - 1) * 3]}–${M[q * 3 - 1]}`;
  return long ? `${s} ${y}` : s;
}
