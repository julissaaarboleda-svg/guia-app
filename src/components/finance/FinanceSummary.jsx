import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ent } from "@/lib/freshEntities";
import { isPaid, dueInfo, TONE_CLASS, monthlyEquivalent, billInMonth } from "@/lib/financeHelpers";
import { monthView, monthsWithData } from "@/lib/spending";
import { overview as creditOverview } from "@/lib/credit";
import { Receipt, ShoppingBag, PiggyBank, Landmark, TrendingUp, Sparkles, Lightbulb, Banknote, ChevronRight, ChevronDown, ArrowRight, Wallet } from "lucide-react";

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

const TABS_OK = ["credit_score", "bill", "budget", "savings_goal", "loan", "spending"];
const fmt = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function FinanceSummary({ items, buckets, onNavigate, onAddFirst }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [income, setIncome] = useState(0);
  const [incomeReady, setIncomeReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [statements, setStatements] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [creditOv, setCreditOv] = useState(null);
  const [creditReady, setCreditReady] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [payoffOpen, setPayoffOpen] = useState(false);
  useEffect(() => {
    Promise.all([ent.CreditDoc.list().catch(() => []), ent.CreditCase.list().catch(() => [])]).then(([docs, cases]) => {
      try { setCreditOv(docs && docs.length ? creditOverview(docs, (cases && cases[0]) || {}) : null); } catch { setCreditOv(null); }
    }).finally(() => setCreditReady(true));
    ent.SpendingStatement.list().then(r => setStatements(r || [])).catch(() => {});
    ent.MonthlyIncome.list().then(r => setIncomes(r || [])).catch(() => {});
  }, []);

  // "Money this month": income, fixed costs, loans and everyday spending in one view.
  const nowKey = monthKey(new Date());
  const spendMonths = monthsWithData(statements).filter(k => k <= nowKey);
  const moneyKey = spendMonths[spendMonths.length - 1] || null;
  const moneyView = moneyKey ? monthView(statements, moneyKey) : null;
  const money = (() => {
    if (!moneyView) return null;
    const inc = Number(incomes.find(i => i.month === moneyKey)?.amount) || 0;
    if (!(inc > 0)) return null;
    const bills = items.filter(i => i.type === "bill" && billInMonth(i, moneyKey)).reduce((t, b) => t + (Number(b.amount) || 0), 0);
    const subsM = items.filter(i => i.type === "subscription").reduce((t, x) => t + monthlyEquivalent(x), 0);
    const loansM = items.filter(i => i.type === "loan").reduce((t, l) => t + (Array.isArray(l.schedule) ? l.schedule.filter(p => String(p.date || "").slice(0, 7) === moneyKey).reduce((a, p) => a + (Number(p.amount) || 0), 0) : 0), 0);
    const covered = ["Housing", "Utilities", "Insurance", "Subscriptions"];
    const everyday = moneyView.categories.filter(c => !covered.includes(c.name)).reduce((t, c) => t + c.total, 0);
    const fixed = bills + subsM;
    return { inc, fixed, loansM, everyday, left: inc - fixed - loansM - everyday, label: new Date(Number(moneyKey.slice(0, 4)), Number(moneyKey.slice(5)) - 1, 1).toLocaleDateString("en-US", { month: "long" }) };
  })();

  useEffect(() => {
    ent.MonthlyIncome.filter({ month: monthKey(new Date()) }).then(res => {
      setIncome(res[0]?.amount || 0);
    }).catch(() => setIncome(0)).finally(() => setIncomeReady(true));
  }, []);

  const unpaidBills = items.filter(i => i.type === "bill" && !isPaid(i));
  const billsTotal = unpaidBills.reduce((s, b) => s + (b.amount || 0), 0);



  const savings = items.filter(i => i.type === "savings_goal");
  const savingsCurrent = savings.reduce((s, g) => s + (g.current_amount || 0), 0);
  const savingsTarget = savings.reduce((s, g) => s + (g.target_amount || 0), 0);

  const loans = items.filter(i => i.type === "loan");
  const loanLines = loans.map(l => {
    const unpaid = (l.schedule || []).filter(p => !p.paid).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const left = unpaid.reduce((t, p) => t + Number(p.amount || 0), 0);
    const payoff = l.payoff_amount != null ? Number(l.payoff_amount) : null;
    const bits = [`payoff today ${payoff != null ? fmt(payoff) : "unknown"}`, `${unpaid.length} payments left totaling ${fmt(left)}`];
    if (unpaid[0]) bits.push(`next ${fmt(unpaid[0].amount)} on ${unpaid[0].date}`);
    if (l.reduces_balance === false) bits.push("scheduled payments do not reduce the balance");
    return `  - ${l.name}: ${bits.join("; ")}`;
  }).join("\n");
  // Early payoff: worked out here, never by the AI. Only loans with a payoff amount and a schedule count.
  const payoffList = loans.map((l) => {
    const unpaid = (l.schedule || []).filter((p) => !p.paid).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const left = unpaid.reduce((t, p) => t + Number(p.amount || 0), 0);
    const payoff = l.payoff_amount != null && l.payoff_amount !== "" ? Number(l.payoff_amount) : null;
    if (payoff == null || !unpaid.length) return null;
    // If payments don't lower what's owed, every remaining payment is avoided by paying off now.
    if (l.reduces_balance === false) return { id: l.id, name: l.name, payoff, left: left + payoff, save: left, count: unpaid.length, monthly: Number(unpaid[0].amount) || 0, feesOnly: true };
    if (!(left > payoff)) return null;
    return { id: l.id, name: l.name, payoff, left, save: left - payoff, count: unpaid.length, monthly: Number(unpaid[0].amount) || 0 };
  }).filter(Boolean).sort((a, b) => b.save - a.save);
  const payoffMissing = loans.filter((l) => l.payoff_amount == null || l.payoff_amount === "" || !(l.schedule || []).some((p) => !p.paid)).map((l) => l.name);
  const loansOutstanding = loans.reduce((s, l) => s + (l.payoff_amount != null ? Number(l.payoff_amount) : (l.total_amount || 0) - (l.amount_paid || 0)), 0);

  const credit = items.filter(i => i.type === "credit_score");
  const topScore = credit.reduce((max, c) => Math.max(max, c.score || 0), 0);

  const totalSpent = buckets.reduce((s, b) => s + (b.spent_amount || 0), 0);
  const totalAllocated = buckets.reduce((s, b) => s + (b.allocated_amount || 0), 0);
  const budgetUtil = totalAllocated > 0 ? Math.min((totalSpent / totalAllocated) * 100, 100) : 0;

  const stats = [
    { tab: "bill", label: "Bills due", value: unpaidBills.length > 0 ? fmt(billsTotal) : "$0", Icon: Receipt },
    { tab: "budget", label: "Income", value: income > 0 ? fmt(income) : "—", Icon: Banknote },
    { tab: "spending", label: "Spending", value: moneyView ? fmt(moneyView.total) : "—", Icon: ShoppingBag },
    { tab: "savings_goal", label: "Savings", value: savings.length > 0 ? fmt(savingsCurrent) : "—", Icon: PiggyBank },
    { tab: "loan", label: "Debt", value: loans.length > 0 ? fmt(loansOutstanding) : "—", Icon: Landmark },
    { tab: "credit_score", label: "Credit", value: topScore > 0 ? topScore : "—", Icon: TrendingUp },
  ];

  // One focus for the month and two specific actions, from Finance and the credit assistant together.
  // Saved per month and refreshed only when the numbers change a lot (or the person taps Update).
  const creditLines = creditOv ? [
    creditOv.pastDueCount ? `- Past due right now: ${creditOv.pastDueCount} accounts${creditOv.pastDueTotal ? `, ${fmt(creditOv.pastDueTotal)} past due` : ""}` : "",
    creditOv.overLimitCount ? `- Cards over their limit: ${creditOv.overLimitCount}` : "",
    creditOv.usage != null ? `- Credit card usage: ${creditOv.usage}% of limits` : "",
    creditOv.collections.count ? `- Collections: ${creditOv.collections.count} totaling ${fmt(creditOv.collections.total)}` : "",
    ...creditOv.plan.filter((p) => !p.upkeep).map((p) => `- Credit plan step ${p.n}: ${p.title}${p.text ? ` (${p.text})` : ""}${p.rows ? ` [${p.rows.map((r) => `${r.name}: ${r.toLimit ? `${fmt(r.toLimit)} to get under limit, ` : ""}${fmt(r.to30)} to get under 30%`).join("; ")}]` : ""}`),
  ].filter(Boolean).join("\n") : "";
  // Ranked priorities worked out here, so the AI only phrases them and can't pick the wrong one.
  // Bills that are simply coming up are already shown in Due next; only overdue bills count.
  const overdueBills = items.filter((i) => i.type === "bill" && !isPaid(i) && dueInfo(i).tone === "overdue");
  const leftOver = money ? money.left : 0;
  const priorities = [];
  overdueBills.forEach((b) => priorities.push(`Overdue bill: ${b.name} $${b.amount}`));
  if (creditOv && creditOv.pastDueCount) priorities.push(`Accounts past due right now: ${creditOv.pastDueCount}${creditOv.pastDueTotal ? ` (${fmt(creditOv.pastDueTotal)} past due)` : ""}. Bringing them current stops new late marks.`);
  const cardStep = creditOv && creditOv.plan.find((p) => p.rows);
  if (cardStep) {
    const over = cardStep.rows.filter((r) => r.toLimit);
    if (over.length) {
      const total = over.reduce((t, r) => t + r.toLimit, 0);
      priorities.push(`Cards over their limit: ${over.map((r) => `${r.name} needs ${fmt(r.toLimit)}`).join(", ")} (${fmt(total)} in total${leftOver > 0 ? `, ${total <= leftOver ? `which fits in the ${fmt(leftOver)} left over and leaves ${fmt(leftOver - total)}` : `more than the ${fmt(leftOver)} left over`}` : ""}). Over-limit balances can bring fees and look worse than high usage.`);
    }
    const hi = cardStep.rows.filter((r) => !r.toLimit && r.to30);
    // When cards are over the limit, the "under 30%" step comes later; listing it now would repeat the same cards.
    if (!over.length && (hi.length || creditOv.usage > 30)) priorities.push(`High card usage (${creditOv.usage}% of limits). Under 30%: ${cardStep.rows.slice(0, 3).map((r) => `${r.name} ${fmt(r.to30)}`).join(", ")}.`);
  }
  if (!(savingsCurrent > 0)) priorities.push(`No emergency cushion saved yet${leftOver > 0 ? `; even a small amount of the ${fmt(leftOver)} left over helps` : ""}.`);
  if (creditOv && creditOv.collections.count) priorities.push(`Collections: ${creditOv.collections.count} totaling ${fmt(creditOv.collections.total)}. Ask each collector for proof before paying anything.`);
  if (loans.length && !payoffList.length) priorities.push(`Loans: ${fmt(loansOutstanding)} outstanding.`);
  const urgent = overdueBills.length > 0 || !!(creditOv && creditOv.pastDueCount) || !!(creditOv && creditOv.overLimitCount);
  const payoffOpp = (() => {
    if (!payoffList.length) return null;
    const pay = payoffList.reduce((t, x) => t + x.payoff, 0);
    const left = payoffList.reduce((t, x) => t + x.left, 0);
    const now = [];
    let budget = money ? money.left : 0;
    payoffList.forEach((x) => { if (x.payoff <= budget) { now.push(x); budget -= x.payoff; } });
    const later = payoffList.filter((x) => !now.includes(x));
    const freed = (now.length ? now : payoffList).reduce((t, x) => t + x.monthly, 0);
    return { pay, left, save: left - pay, list: payoffList, now, later, freed };
  })();
  const sig = ["v4", payoffList.map((x) => `${x.id}:${Math.round(x.save)}`).join("+"), monthKey(new Date()), overdueBills.map((b) => b.id).join("+"), Math.round((money ? money.left : 0) / 100), savings.length, Math.round(savingsCurrent / 100), loans.length, Math.round(loansOutstanding / 100), creditOv ? creditOv.plan.map((p) => p.filter).join("+") : "", creditOv ? creditOv.overLimitCount : 0, creditOv ? creditOv.pastDueCount : 0].join("|");
  const CACHE = "guia-fin-insights-v4";
  useEffect(() => {
    if (!incomeReady || !creditReady) return; // wait for income and credit so the read is complete
    if (!items.length && !buckets.length && !creditOv) { setLoading(false); return; }
    if (!retry) {
      try { const c = JSON.parse(localStorage.getItem(CACHE)); if (c && c.sig === sig && c.data) { setInsights(c.data); setLoading(false); return; } } catch { /* ignore */ }
    }
    setLoading(true);
    setFailed(false);
    base44.integrations.Core.InvokeLLM({
      prompt: `You help someone decide what to focus on with their money this month. Use ONLY the data below. Be plain, warm and specific.

PRIORITIES (already ranked, most important first):
${priorities.length ? priorities.map((p, i) => `${i + 1}. ${p}`).join("\n") : "1. Nothing urgent. Keep paying on time and add to savings."}

Write:
- "focus": ONE sentence (20 words or fewer) saying what matters most this month and WHY, in plain words. No list of accounts and at most one dollar amount.
- "actions": exactly THREE steps (each 18 words or fewer, starting with a verb). They must NOT repeat the focus sentence or each other.
  - Action 1 is HOW to do priority 1: the exact payments (every account and amount from priority 1).
  - Action 2 is the NEXT, different priority (priority 2), using what's left over after action 1 if that's relevant.
  - Action 3 is priority 3. If there are fewer than 3 priorities, make it a small habit that protects progress (for example setting up autopay or a weekly check-in), still specific to this data.
Read all four together before answering: no idea, account or amount should appear twice.

NEVER: mention upcoming bills that aren't overdue (they're already on the page), mention paying loans off early or payoff savings (that's shown separately), promise a credit score change, give legal advice, or recommend paying a collection before asking for proof.

Money this month: ${money ? `${fmt(money.inc)} income, ${fmt(money.fixed)} fixed bills and subscriptions, ${fmt(money.loansM)} loan payments, ${fmt(money.everyday)} everyday spending, ${fmt(money.left)} left over` : `income ${fmt(income)}`}
Savings goals: ${savings.length ? `${savings.length}, ${fmt(savingsCurrent)} saved of ${fmt(savingsTarget)}` : "none"}
Loans: ${loans.length ? `${fmt(loansOutstanding)} outstanding\n${loanLines}` : "none"}
Credit:
${creditLines || "- no credit reports uploaded"}

For each action, "tab" is where it's handled: one of "credit_score", "bill", "budget", "savings_goal", "loan", "spending".
Respond as JSON: {"focus": "...", "actions": [{"text": "...", "tab": "..."}, {"text": "...", "tab": "..."}, {"text": "...", "tab": "..."}]}`,
      response_json_schema: {
        type: "object",
        properties: {
          focus: { type: "string" },
          actions: { type: "array", items: { type: "object", properties: { text: { type: "string" }, tab: { type: "string" } } } },
        },
      },
    }).then((res) => {
      const data = { focus: res && (res.focus || res.summary) || "", actions: (res && Array.isArray(res.actions) ? res.actions : []).filter((a) => a && a.text).slice(0, 3) };
      setInsights(data);
      try { localStorage.setItem(CACHE, JSON.stringify({ sig, data })); } catch { /* ignore */ }
      setLoading(false);
    }).catch(() => { setFailed(true); setLoading(false); });
  }, [sig, retry, incomeReady, creditReady]);

  const utilColor = budgetUtil > 100 ? "text-destructive" : budgetUtil > 80 ? "text-foreground" : "text-muted-foreground";
  const utilBarColor = budgetUtil > 100 ? "bg-destructive" : budgetUtil > 80 ? "bg-[#8B6B3E]" : "bg-[#A7773F]";

  return (
    <div>
      {/* Stat tiles */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2.5 mb-5">
        {stats.map(({ tab, label, value, Icon }) => (
          <button
            key={tab}
            onClick={() => onNavigate(tab)}
            className="flex flex-col items-center gap-1 bg-card border border-border rounded-2xl py-3 px-1 hover:border-[#A7773F]/40 transition-colors"
          >
            <Icon className="w-4 h-4 text-[#A7773F]" strokeWidth={1.5} />
            <span className="font-heading text-xs text-muted-foreground leading-none mt-0.5">{label}</span>
            <span className="font-heading text-sm text-foreground leading-none">{value}</span>
          </button>
        ))}
      </div>

      {money && (
        <div className="bg-card border border-border rounded-2xl p-4 mb-3">
          <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground">Money in {money.label}</p>
          <p className="font-heading text-xl text-foreground mt-0.5">{fmt(money.inc)}</p>
          <div className="flex h-2.5 rounded-full overflow-hidden bg-muted mt-2.5 mb-2">
            {[["#A7773F", money.fixed], ["#D8C3A0", money.loansM], ["#CFC8B8", money.everyday]].map(([c, v], i) => (
              <div key={i} style={{ width: `${Math.max(0, Math.min(100, (v / money.inc) * 100))}%`, background: c }} />
            ))}
          </div>
          {[["Fixed bills & subs", money.fixed], ["Loan payments", money.loansM], ["Everyday spending", money.everyday]].map(([k, v]) => (
            <div key={k} className="flex justify-between py-1 text-[13.5px]"><span className="text-muted-foreground">{k}</span><span className="text-foreground">{fmt(v)}</span></div>
          ))}
          <div className="flex justify-between pt-2 mt-1 border-t border-border text-[13.5px]">
            <span className="text-foreground">Left over</span>
            <span className="font-medium" style={{ color: money.left < 0 ? "#8F5F65" : "#566033" }}>{money.left < 0 ? "−" : ""}{fmt(Math.abs(money.left))}</span>
          </div>
          <p className="text-[11.5px] text-muted-foreground mt-2 leading-snug">Everyday spending leaves out housing, utilities, insurance and subscriptions, which are already in fixed bills.</p>
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-4 lg:items-start">
      <div className="min-w-0">
      {/* Budget utilization bar */}
      {totalAllocated > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Budget used</span>
            <span className={`text-sm font-bold ${utilColor}`}>{Math.round(budgetUtil)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden mb-1.5">
            <div className={`h-full ${utilBarColor} rounded-full transition-all duration-300`} style={{ width: `${Math.min(budgetUtil, 100)}%` }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{fmt(totalSpent)} spent</span>
            <span className="text-[10px] text-muted-foreground">{fmt(totalAllocated)} allocated</span>
          </div>
        </div>
      )}

      {/* AI insights */}
      <div className="bg-secondary/60 border border-border rounded-2xl p-4 mb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#A7773F]" strokeWidth={1.5} />
            <h3 className="font-heading text-base font-bold text-foreground">AI Insights</h3>
            {loading && <span className="w-3 h-3 border-2 border-muted border-t-foreground rounded-full animate-spin ml-1" />}
          </div>
          {!loading && insights && <button onClick={() => setRetry(r => r + 1)} className="text-xs text-[#A7773F]">Update</button>}
        </div>
        {loading ? (
          <div className="space-y-2">
            <div className="h-3 bg-muted rounded w-3/4 animate-pulse" />
            <div className="h-3 bg-muted rounded w-1/2 animate-pulse" />
          </div>
        ) : failed ? (
          <div>
            <p className="font-heading text-[15px] text-foreground leading-snug">Insights aren't available right now.</p>
            <button onClick={() => setRetry(r => r + 1)} className="mt-3 border border-[#A7773F] text-[#A7773F] rounded-full text-xs px-4 py-1.5">Try again</button>
          </div>
        ) : insights ? (
          <>
            <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground mb-1">Focus this month</p>
            <p className="text-[15px] text-foreground leading-snug mb-3">{insights.focus}</p>
            {insights.actions?.length > 0 && (
              <div className="border-t border-border">
                <button onClick={() => setStepsOpen((v) => !v)} aria-expanded={stepsOpen} className="w-full flex items-center gap-1.5 pt-2.5 pb-1 text-left text-[12.5px] text-[#A7773F]">
                  {stepsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  {stepsOpen ? "Hide steps" : `See ${insights.actions.length} step${insights.actions.length === 1 ? "" : "s"}`}
                </button>
                {stepsOpen && (
                  <div className="space-y-1 pt-1">
                    {insights.actions.map((a, idx) => (
                      <button key={idx} onClick={() => onNavigate && TABS_OK.includes(a.tab) && onNavigate(a.tab)} className="w-full flex items-start gap-2 text-left py-1.5">
                        <span className="w-[18px] h-[18px] rounded-full border border-[#A7773F] text-[#A7773F] text-[10.5px] flex items-center justify-center flex-shrink-0 mt-px">{idx + 1}</span>
                        <span className="flex-1 text-[13px] text-foreground leading-snug">{a.text}</span>
                        {TABS_OK.includes(a.tab) && <ChevronRight className="w-4 h-4 text-[#A7773F] flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="font-heading text-[15px] text-foreground leading-snug mb-3">Take control of your finances. Add your bills, budget, and goals to get personalized insights and stay on track.</p>
            <div className="space-y-2 border-t border-border pt-3">
              {["Track your monthly bills and set reminders.", "Create a budget to manage your spending.", "Set savings goals for what matters most."].map((tip) => (
                <div key={tip} className="flex items-start gap-2">
                  <Lightbulb className="w-3.5 h-3.5 text-[#A7773F] mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                  <p className="text-xs text-muted-foreground leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          </>
        )}
        {!loading && !payoffOpp && loans.length > 0 && payoffMissing.length > 0 && (
          <button onClick={() => onNavigate && onNavigate("loan")} className="mt-2.5 w-full flex items-center gap-2 text-left text-[12px] text-muted-foreground">
            <ArrowRight className="w-3.5 h-3.5 text-[#A7773F] flex-shrink-0" />
            <span className="flex-1">Add a payoff amount and payment schedule to your loans to see if paying early saves money.</span>
          </button>
        )}
        {!loading && payoffOpp && <PayoffBlock opp={payoffOpp} urgent={urgent} open={payoffOpen} setOpen={setPayoffOpen} leftOver={money ? money.left : null} missing={payoffMissing} cardsOver={!!(creditOv && creditOv.overLimitCount)} onNavigate={onNavigate} />}
      </div>

      </div>

      {(() => {
        const rows = [
          ...items.filter(i => i.type === "bill" && !(i.billing_cycle === "yearly" && (!i.due_date || (dueInfo(i).date - new Date()) / 86400000 > 45))).map(b => ({ id: b.id, name: b.name, amount: b.amount, info: dueInfo(b) })),
          ...items.filter(i => i.type === "subscription" && i.renewal_date).map(sub => {
            const d = new Date(`${sub.renewal_date}T00:00:00`); d.setHours(0, 0, 0, 0);
            const days = Math.round((d - new Date(new Date().setHours(0, 0, 0, 0))) / 86400000);
            return { id: sub.id, name: `${sub.name} (renews)`, amount: sub.amount, info: { date: d, days, tone: days <= 3 ? "soon" : "normal", label: `Renews ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · in ${days} day${days === 1 ? "" : "s"}` }, onlyUpcoming: days >= 0 && days <= 14 };
          }).filter(r => r.onlyUpcoming),
        ];
        const list = rows.sort((a, b) => (a.info.tone === "paid") - (b.info.tone === "paid") || (a.info.date || 0) - (b.info.date || 0)).slice(0, 6);
        if (!list.length) return null;
        return (
        <div className="bg-card border border-border rounded-2xl p-4 mb-3">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="font-heading text-base font-bold text-foreground">Due next</h3>
            <button onClick={() => onNavigate("bill")} className="text-xs text-[#A7773F]">View all</button>
          </div>
          <div className="divide-y divide-border/50">
            {list.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">{r.name}</p>
                  <p className={`text-[11px] ${TONE_CLASS[r.info.tone]}`}>{r.info.label}</p>
                </div>
                <span className="font-heading text-sm text-foreground flex-shrink-0">{fmt(r.amount)}</span>
              </div>
            ))}
          </div>
        </div>
        );
      })()}
      </div>

      {items.length === 0 && buckets.length === 0 && (
        <div className="bg-card border border-border rounded-2xl p-5 text-center">
          <p className="font-heading text-base text-foreground">No summary yet.</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">Start by adding your financial details.</p>
          <button onClick={onAddFirst} className="bg-[#A7773F] text-[#F7F3EC] rounded-full font-heading text-sm px-5 py-2">+ Add Expense or Goal</button>
        </div>
      )}
    </div>
  );
}

// Early payoff opportunity. Small "Next up" line when something is urgent, a summary otherwise; details fold away.
function PayoffBlock({ opp, urgent, open, setOpen, leftOver, missing, cardsOver, onNavigate }) {
  const n = opp.list.length;
  const names = (xs) => xs.map((x) => x.name).join(xs.length === 2 ? " and " : ", ");
  let cover = "";
  if (leftOver == null) cover = "Check what's left after bills before paying anything off.";
  else if (leftOver <= 0) cover = `Nothing is left after bills this month, so this can wait until there's room.`;
  else if (!opp.later.length) cover = `You have about ${fmt(leftOver)} left after bills, enough to pay ${n === 1 ? "it" : `all ${n}`} off.`;
  else if (opp.now.length) cover = `You have about ${fmt(leftOver)} left after bills. That covers ${names(opp.now)} now, and ${names(opp.later)} later.`;
  else cover = `That's more than the ${fmt(leftOver)} left after bills. Start with ${opp.list[0].name} when you can.`;
  const first = opp.now.length ? opp.now : [opp.list[0]];
  const target = cardsOver ? "your credit cards" : "your emergency cushion";

  const details = (
    <div className="pt-2">
      <p className="text-[12.5px] text-muted-foreground mb-1.5">Pay {fmt(opp.pay)} now instead of {fmt(opp.left)} by sticking to the schedule.</p>
      {opp.list.some((x) => x.feesOnly) && <p className="text-[11.5px] text-muted-foreground mb-1.5">Some of these payments don't lower what you owe, so you'd still owe the payoff after making them all.</p>}
      <div className="divide-y divide-border/60">
        {opp.list.map((x) => (
          <div key={x.id} className="flex items-center gap-2 py-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={opp.now.includes(x) || leftOver == null ? { background: "#7D8A53" } : { border: "1.5px solid #7D8A53" }} />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-foreground truncate">{x.name}</p>
              <p className="text-[11.5px] text-muted-foreground">Payoff {fmt(x.payoff)} · {x.count} payment{x.count === 1 ? "" : "s"} left</p>
            </div>
            <span className="text-[13px] text-[#3B6D11] flex-shrink-0">save {fmt(x.save)}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2 rounded-xl bg-background/70 px-3 py-2.5 my-2 text-[12.5px] text-foreground leading-snug">
        <Wallet className="w-4 h-4 text-[#A7773F] flex-shrink-0 mt-px" strokeWidth={1.5} />{cover}
      </div>
      <button onClick={() => onNavigate && onNavigate("loan")} className="w-full flex items-start gap-2 text-left py-1.5">
        <span className="w-[18px] h-[18px] rounded-full border border-[#A7773F] text-[#A7773F] text-[10.5px] flex items-center justify-center flex-shrink-0 mt-px">1</span>
        <span className="flex-1 text-[13px] text-foreground leading-snug">Ask {names(first)} for a written payoff quote, then pay {first.length === 1 ? "it" : "them"} off in full</span>
        <ChevronRight className="w-4 h-4 text-[#A7773F] flex-shrink-0" />
      </button>
      {opp.freed > 0 && (
        <div className="flex items-start gap-2 py-1.5">
          <span className="w-[18px] h-[18px] rounded-full border border-[#A7773F] text-[#A7773F] text-[10.5px] flex items-center justify-center flex-shrink-0 mt-px">2</span>
          <span className="flex-1 text-[13px] text-foreground leading-snug">Move the {fmt(opp.freed)} a month you free up to {target}</span>
        </div>
      )}
      {missing.length > 0 && <p className="text-[11.5px] text-muted-foreground mt-1.5">Add a payoff amount and payment schedule to {missing.join(", ")} to include {missing.length === 1 ? "it" : "them"}.</p>}
      <p className="text-[11px] text-muted-foreground mt-2 leading-snug">From the payoff amounts and payment schedules in your Loans. Ask for "payoff in full," not a settlement. Information, not financial advice.</p>
    </div>
  );

  if (urgent) {
    return (
      <div className="mt-2.5 rounded-xl bg-[#7D8A53]/10 px-3 py-2.5">
        <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="w-full flex items-center gap-2.5 text-left">
          <ArrowRight className="w-4 h-4 text-[#566033] flex-shrink-0" />
          <span className="flex-1 min-w-0">
            <span className="block text-[11.5px] text-[#566033]">Next up · early payoff</span>
            <span className="block text-[13px] text-foreground">Save up to <span className="text-[#3B6D11] font-medium">{fmt(opp.save)}</span> on {n} loan{n === 1 ? "" : "s"}</span>
          </span>
          {open ? <ChevronDown className="w-4 h-4 text-[#566033]" /> : <ChevronRight className="w-4 h-4 text-[#566033]" />}
        </button>
        {open && details}
      </div>
    );
  }
  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground mb-1">Opportunity</p>
      <div className="flex items-end gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[14px] text-foreground leading-snug">Pay off {n === 1 ? "your loan" : `your ${n} loans`} early and skip the interest</p>
          <p className="text-[12px] text-muted-foreground mt-0.5">Potential savings</p>
          <p className="text-[26px] leading-none text-[#3B6D11] font-medium mt-0.5">{fmt(opp.save)}</p>
        </div>
      </div>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex items-center gap-1.5 pt-2.5 text-[12.5px] text-[#A7773F]">
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}{open ? "Hide details" : "See the breakdown"}
      </button>
      {open && details}
    </div>
  );
}
