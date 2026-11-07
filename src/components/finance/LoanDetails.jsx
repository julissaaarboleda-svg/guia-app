import { useState, useRef } from "react";
import { Check, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { ent } from "@/lib/freshEntities";

const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2, maximumFractionDigits: 2 })}`;
const parseDay = (iso) => { const [y, m, d] = (iso || "").split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const dayLabel = (iso) => parseDay(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const dayLong = (iso) => parseDay(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const uid = () => Math.random().toString(36).slice(2, 9);
const sum = (arr) => arr.reduce((s, p) => s + (Number(p.amount) || 0), 0);

export function upcomingLoanPayments(items, days = 30) {
  const start = parseDay(todayIso());
  const end = new Date(start); end.setDate(end.getDate() + days);
  const out = [];
  items.filter((i) => i.type === "loan").forEach((l) => {
    if (Array.isArray(l.schedule) && l.schedule.length) {
      l.schedule.filter((p) => !p.paid).forEach((p) => {
        const d = parseDay(p.date);
        if (d >= start && d <= end) out.push({ key: `${l.id}-${p.id}`, name: l.name, date: p.date, amount: p.amount });
      });
    } else if (l.due_date && !l.paid) {
      const d = parseDay(l.due_date);
      if (d >= start && d <= end) out.push({ key: l.id, name: l.name, date: l.due_date, amount: l.monthly_payment });
    }
  });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function UpcomingLoans({ items }) {
  const list = upcomingLoanPayments(items);
  if (list.length === 0) return null;
  return (
    <div className="bg-card border border-border rounded-2xl p-4 mb-4">
      <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground mb-2">Due in the next 30 days</p>
      <div className="space-y-1.5">
        {list.map((p) => (
          <div key={p.key} className="flex items-center justify-between text-[13px]">
            <span className="text-foreground">{dayLabel(p.date)} · {p.name}</span>
            <span className="font-heading text-[15px] text-foreground">{money(p.amount)}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-border mt-2.5 pt-2">
        <span className="text-xs text-muted-foreground">Total</span>
        <span className="font-heading text-base text-foreground">{money(sum(list))}</span>
      </div>
    </div>
  );
}

export default function LoanDetails({ item, onChange }) {
  const schedule = Array.isArray(item.schedule) ? item.schedule : [];
  const [expanded, setExpanded] = useState(false);
  const [editPayoff, setEditPayoff] = useState(false);
  const [payoffInput, setPayoffInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [newPay, setNewPay] = useState({ date: "", amount: "" });
  const [importing, setImporting] = useState(false);
  const [found, setFound] = useState(null);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const save = async (patch) => { await ent.FinanceItem.update(item.id, patch); onChange && onChange(); };

  const sorted = [...schedule].sort((a, b) => a.date.localeCompare(b.date));
  const unpaid = sorted.filter((p) => !p.paid);
  const paidCount = sorted.length - unpaid.length;
  const remaining = sum(unpaid);
  const next = unpaid[0];
  const payoff = item.payoff_amount != null ? Number(item.payoff_amount) : null;
  const staleDays = item.payoff_date ? Math.floor((parseDay(todayIso()) - parseDay(item.payoff_date)) / 86400000) : 0;

  const togglePaid = (id) => save({ schedule: schedule.map((p) => (p.id === id ? { ...p, paid: !p.paid } : p)) });
  const removePay = (id) => save({ schedule: schedule.filter((p) => p.id !== id) });
  const addPay = async () => {
    const amt = Number(newPay.amount);
    if (!newPay.date || !(amt > 0)) return;
    await save({ schedule: [...schedule, { id: uid(), date: newPay.date, amount: amt, paid: false }] });
    setNewPay({ date: "", amount: "" }); setAdding(false);
  };
  const savePayoff = async () => {
    const v = Number(payoffInput);
    if (!(v > 0)) { setEditPayoff(false); return; }
    await save({ payoff_amount: v, payoff_date: todayIso() });
    setEditPayoff(false);
  };

  const readSchedule = async (file) => {
    if (!file) return;
    setImporting(true); setError(""); setFound(null);
    try {
      const res = await base44.integrations.Core.ImportFinanceFile({ file, mode: "schedule" });
      if (!res.payments?.length) setError("No payment schedule was found in that file.");
      else setFound(res);
    } catch (err) { setError(err.message || "Couldn't read that file."); }
    setImporting(false);
  };
  const applyFound = async () => {
    const old = new Map(schedule.map((p) => [`${p.date}|${p.amount}`, p.paid]));
    const next = found.payments.map((p) => ({ id: uid(), date: p.date, amount: p.amount, paid: !!old.get(`${p.date}|${p.amount}`) }));
    const patch = { schedule: next };
    if (found.payoff_amount) { patch.payoff_amount = found.payoff_amount; patch.payoff_date = todayIso(); }
    await save(patch);
    setFound(null);
  };

  const shown = expanded ? sorted : unpaid.slice(0, 3);
  const chipCls = (on) => `px-3 py-1 rounded-full text-[11px] ${on ? "bg-[#A7773F] text-[#F7F3EC]" : "border border-border text-muted-foreground"}`;

  let note = null;
  if (payoff != null && remaining > 0) {
    if (item.reduces_balance === false) {
      note = <>These payments don't reduce what you owe. After the {unpaid.length} left ({money(remaining)}) you'd still owe <b className="font-heading font-normal text-[14px]">{money(payoff)}</b>. Paying off today costs {money(payoff)}.</>;
    } else if (remaining > payoff) {
      note = <>Paying off today saves <b className="font-heading font-normal text-[14px]">{money(remaining - payoff)}</b> compared with the schedule ({money(payoff)} now versus {money(remaining)} on schedule).</>;
    } else {
      note = <>Payoff today is {money(payoff)}. The schedule has {money(remaining)} left.</>;
    }
  }

  return (
    <div className="mt-2" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground">{next ? "Next payment" : "Monthly"}</p>
          <p className="font-heading text-[26px] leading-tight text-foreground">{money(next ? next.amount : item.monthly_payment)}</p>
          {(next || item.due_date) && <p className="text-xs text-muted-foreground">{dayLong(next ? next.date : item.due_date)}</p>}
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground">Payoff today</p>
          {editPayoff ? (
            <div className="flex items-center gap-1.5 justify-end mt-0.5">
              <input type="number" inputMode="decimal" autoFocus value={payoffInput} onChange={(e) => setPayoffInput(e.target.value)} placeholder="0"
                className="w-24 bg-secondary border border-input rounded-lg px-2 py-1 text-sm text-foreground outline-none focus:border-ring" />
              <button onClick={savePayoff} className="text-xs bg-[#A7773F] text-[#F7F3EC] rounded-full px-3 py-1">Save</button>
            </div>
          ) : payoff != null ? (
            <button onClick={() => { setPayoffInput(String(payoff)); setEditPayoff(true); }} className="text-right">
              <span className="font-heading text-xl text-foreground block">{money(payoff)}</span>
              <span className="text-xs text-muted-foreground">{item.payoff_date ? `Entered ${dayLabel(item.payoff_date)}${staleDays > 14 ? " · may be out of date" : ""}` : ""}</span>
            </button>
          ) : (
            <button onClick={() => { setPayoffInput(""); setEditPayoff(true); }} className="text-xs text-[#A7773F] mt-1">Add payoff amount</button>
          )}
        </div>
      </div>

      {sorted.length > 0 && (
        <>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-3 mb-1.5">
            <div className="h-full bg-[#A7773F] rounded-full" style={{ width: `${(paidCount / sorted.length) * 100}%` }} />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{paidCount} of {sorted.length} payments made</span>
            <span>{money(remaining)} left on schedule</span>
          </div>
        </>
      )}

      {sorted.length === 0 && (
        <div className="mt-3">
          {item.total_amount > 0 && (
            <>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-1.5">
                <div className="h-full bg-[#A7773F] rounded-full" style={{ width: `${Math.min(((item.amount_paid || 0) / item.total_amount) * 100, 100)}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{money(item.amount_paid || 0)} of {money(item.total_amount)} paid</p>
            </>
          )}
          <button onClick={() => save({ paid: !item.paid })}
            className={`mt-2 text-xs px-2.5 py-1 rounded-full border transition-colors ${item.paid ? "bg-[#F0E6D6] text-[#8B6B3E] border-[#E3D2B6]" : "bg-transparent text-muted-foreground border-border hover:border-[#A7773F]"}`}>
            {item.paid ? "✓ Paid" : "Mark paid"}
          </button>
        </div>
      )}

      {note && <p className="mt-3 text-xs leading-relaxed bg-[#F0E6D6] text-[#6B5A4A] rounded-xl px-3 py-2.5">{note}</p>}

      <div className="mt-3 flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-muted-foreground mr-0.5">Payments reduce what I owe</span>
        <button onClick={() => save({ reduces_balance: true })} className={chipCls(item.reduces_balance === true)}>Yes</button>
        <button onClick={() => save({ reduces_balance: false })} className={chipCls(item.reduces_balance === false)}>No</button>
        <button onClick={() => save({ reduces_balance: null })} className={chipCls(item.reduces_balance == null)}>Not sure</button>
      </div>

      {sorted.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground mb-1">Payment schedule</p>
          {shown.map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-2 border-t border-border">
              <button onClick={() => togglePaid(p.id)} aria-label="Mark paid"
                className={`w-[18px] h-[18px] rounded-[5px] flex items-center justify-center flex-shrink-0 ${p.paid ? "bg-[#A7773F] text-[#F7F3EC]" : "border border-border"}`}>
                {p.paid && <Check className="w-3 h-3" strokeWidth={2.5} />}
              </button>
              <span className={`flex-1 text-[13px] ${p.paid ? "text-muted-foreground" : "text-foreground"}`}>{dayLong(p.date)}</span>
              <span className="font-heading text-[15px] text-foreground">{money(p.amount)}</span>
              {expanded && <button onClick={() => removePay(p.id)} aria-label="Remove payment" className="text-muted-foreground/50 hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>}
            </div>
          ))}
          {sorted.length > shown.length || expanded ? (
            <button onClick={() => setExpanded((v) => !v)} className="w-full flex items-center justify-between py-2 border-t border-border text-xs text-[#A7773F]">
              <span>{expanded ? "Show fewer" : `Show all ${sorted.length} payments`}</span>
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          ) : null}
        </div>
      )}

      {adding && (
        <div className="mt-2 flex items-center gap-2">
          <input type="date" value={newPay.date} onChange={(e) => setNewPay((p) => ({ ...p, date: e.target.value }))} className="flex-1 min-w-0 bg-secondary border border-input rounded-lg px-2 py-1.5 text-sm text-foreground outline-none" />
          <input type="number" inputMode="decimal" placeholder="$" value={newPay.amount} onChange={(e) => setNewPay((p) => ({ ...p, amount: e.target.value }))} className="w-20 bg-secondary border border-input rounded-lg px-2 py-1.5 text-sm text-foreground outline-none" />
          <button onClick={addPay} className="text-xs bg-[#A7773F] text-[#F7F3EC] rounded-full px-3 py-1.5">Add</button>
        </div>
      )}

      {found && (
        <div className="mt-3 bg-secondary border border-border rounded-xl p-3">
          <p className="text-[13px] text-foreground">Found {found.payments.length} payments totaling <span className="font-heading">{money(sum(found.payments))}</span>{found.payoff_amount ? ` and a payoff of ${money(found.payoff_amount)}` : ""}.</p>
          {schedule.length > 0 && <p className="text-xs text-muted-foreground mt-0.5">This replaces the current schedule. Payments with the same date and amount stay marked paid.</p>}
          <div className="flex gap-2 mt-2">
            <button onClick={applyFound} className="text-xs bg-[#A7773F] text-[#F7F3EC] rounded-full px-3.5 py-1.5">Use this schedule</button>
            <button onClick={() => setFound(null)} className="text-xs text-muted-foreground px-2">Cancel</button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-destructive mt-2">{error}</p>}

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <input ref={fileRef} type="file" accept=".pdf,.csv,.txt,image/*" className="hidden" onChange={(e) => { readSchedule(e.target.files?.[0]); e.target.value = ""; }} />
        <button onClick={() => fileRef.current?.click()} disabled={importing} className="text-xs border border-[#A7773F] text-[#A7773F] rounded-full px-3.5 py-1.5 disabled:opacity-60">
          {importing ? "Reading…" : "Import schedule"}
        </button>
        <button onClick={() => setAdding((v) => !v)} className="text-xs text-[#A7773F] px-2 py-1.5">+ Add payment</button>
      </div>
    </div>
  );
}
