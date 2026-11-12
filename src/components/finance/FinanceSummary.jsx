import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ent } from "@/lib/freshEntities";
import { isPaid, dueInfo, TONE_CLASS, monthlyEquivalent, billInMonth } from "@/lib/financeHelpers";
import { monthView, monthsWithData } from "@/lib/spending";
import { overview as creditOverview } from "@/lib/credit";
import { Receipt, ShoppingBag, PiggyBank, Landmark, TrendingUp, Sparkles, Lightbulb, Banknote, ChevronRight } from "lucide-react";

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

  const oneTimeBills = unpaidBills.filter(b => !b.is_fixed || !b.billing_cycle || b.billing_cycle === "one_time");


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
    if (payoff != null && left > payoff && l.reduces_balance !== false) bits.push(`paying off today saves ${fmt(left - payoff)}`);
    if (l.reduces_balance === false) bits.push("scheduled payments do not reduce the balance");
    return `  - ${l.name}: ${bits.join("; ")}`;
  }).join("\n");
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
  const sig = [monthKey(new Date()), Math.round((money ? money.left : 0) / 100), savings.length, Math.round(savingsCurrent / 100), loans.length, Math.round(loansOutstanding / 100), creditOv ? creditOv.plan.map((p) => p.filter).join("+") : "", creditOv ? creditOv.overLimitCount : 0, creditOv ? creditOv.pastDueCount : 0].join("|");
  const CACHE = "guia-fin-insights";
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

Return ONE focus sentence (22 words or fewer) naming the single most important thing this month, and exactly TWO actions (each 16 words or fewer, starting with a verb, about one thing, naming the account or amount).

PRIORITIES, in order, when present: 1) accounts past due right now (they add a new late mark every month), 2) credit cards over their limit, 3) high card usage, 4) a small cash cushion for emergencies, 5) loans and savings goals. Collections come after these unless the person has a plan step for them. If there is money left over this month, say how to use part of it for the top priority.

NEVER: repeat due dates or totals already shown on the page, promise a credit score change, give legal advice, or recommend paying a collection before asking for proof.

Money this month: ${money ? `${fmt(money.inc)} income, ${fmt(money.fixed)} fixed bills and subscriptions, ${fmt(money.loansM)} loan payments, ${fmt(money.everyday)} everyday spending, ${fmt(money.left)} left over` : `income ${fmt(income)}`}
Savings goals: ${savings.length ? `${savings.length}, ${fmt(savingsCurrent)} saved of ${fmt(savingsTarget)}` : "none"}
Loans: ${loans.length ? `${fmt(loansOutstanding)} outstanding\n${loanLines}` : "none"}
Unpaid one-time bills: ${oneTimeBills.length ? oneTimeBills.map((b) => `${b.name} $${b.amount}`).join(", ") : "none"}
Credit:
${creditLines || "- no credit reports uploaded"}

For each action, "tab" is where it's handled: one of "credit_score", "bill", "budget", "savings_goal", "loan", "spending".
Respond as JSON: {"focus": "...", "actions": [{"text": "...", "tab": "..."}, {"text": "...", "tab": "..."}]}`,
      response_json_schema: {
        type: "object",
        properties: {
          focus: { type: "string" },
          actions: { type: "array", items: { type: "object", properties: { text: { type: "string" }, tab: { type: "string" } } } },
        },
      },
    }).then((res) => {
      const data = { focus: res && (res.focus || res.summary) || "", actions: (res && Array.isArray(res.actions) ? res.actions : []).filter((a) => a && a.text).slice(0, 2) };
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
              <div className="space-y-1 border-t border-border pt-2.5">
                {insights.actions.map((a, idx) => (
                  <button key={idx} onClick={() => onNavigate && TABS_OK.includes(a.tab) && onNavigate(a.tab)} className="w-full flex items-start gap-2 text-left py-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-[#A7773F] mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                    <span className="flex-1 text-[13px] text-foreground leading-snug">{a.text}</span>
                    {TABS_OK.includes(a.tab) && <ChevronRight className="w-4 h-4 text-[#A7773F] flex-shrink-0" />}
                  </button>
                ))}
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