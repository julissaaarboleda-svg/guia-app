import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Receipt, Wallet, RefreshCw, PiggyBank, Landmark, TrendingUp, Sparkles, Lightbulb, Banknote } from "lucide-react";

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

const fmt = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function FinanceSummary({ items, buckets, onNavigate }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [income, setIncome] = useState(0);

  useEffect(() => {
    base44.entities.MonthlyIncome.filter({ month: monthKey(new Date()) }).then(res => {
      setIncome(res[0]?.amount || 0);
    }).catch(() => setIncome(0));
  }, []);

  const unpaidBills = items.filter(i => i.type === "bill" && !i.paid);
  const billsTotal = unpaidBills.reduce((s, b) => s + (b.amount || 0), 0);

  const recurringBills = unpaidBills.filter(b => b.is_fixed && b.billing_cycle && b.billing_cycle !== "one_time");
  const recurringTotal = recurringBills.reduce((s, b) => s + (b.amount || 0), 0);
  const oneTimeBills = unpaidBills.filter(b => !b.is_fixed || !b.billing_cycle || b.billing_cycle === "one_time");
  const oneTimeTotal = oneTimeBills.reduce((s, b) => s + (b.amount || 0), 0);

  const subs = items.filter(i => i.type === "subscription");
  const subMonthly = subs.reduce((sum, sub) => {
    const amt = sub.amount || 0;
    if (sub.billing_cycle === "yearly") return sum + amt / 12;
    if (sub.billing_cycle === "quarterly") return sum + amt / 3;
    if (sub.billing_cycle === "weekly") return sum + amt * 4.33;
    return sum + amt;
  }, 0);

  const savings = items.filter(i => i.type === "savings_goal");
  const savingsCurrent = savings.reduce((s, g) => s + (g.current_amount || 0), 0);
  const savingsTarget = savings.reduce((s, g) => s + (g.target_amount || 0), 0);

  const loans = items.filter(i => i.type === "loan");
  const loansOutstanding = loans.reduce((s, l) => s + ((l.total_amount || 0) - (l.amount_paid || 0)), 0);

  const credit = items.filter(i => i.type === "credit_score");
  const topScore = credit.reduce((max, c) => Math.max(max, c.score || 0), 0);

  const totalSpent = buckets.reduce((s, b) => s + (b.spent_amount || 0), 0);
  const totalAllocated = buckets.reduce((s, b) => s + (b.allocated_amount || 0), 0);
  const budgetUtil = totalAllocated > 0 ? Math.min((totalSpent / totalAllocated) * 100, 100) : 0;

  const stats = [
    { tab: "bill", label: "Bills", value: unpaidBills.length > 0 ? fmt(billsTotal) : "$0", Icon: Receipt },
    { tab: "budget", label: "Income", value: income > 0 ? fmt(income) : "—", Icon: Banknote },
    { tab: "bill", label: "Subs", value: subs.length > 0 ? fmt(subMonthly) : "—", Icon: RefreshCw },
    { tab: "savings_goal", label: "Savings", value: savings.length > 0 ? fmt(savingsCurrent) : "—", Icon: PiggyBank },
    { tab: "loan", label: "Debt", value: loans.length > 0 ? fmt(loansOutstanding) : "—", Icon: Landmark },
    { tab: "credit_score", label: "Credit", value: topScore > 0 ? topScore : "—", Icon: TrendingUp },
  ];

  useEffect(() => {
    if (!items.length && !buckets.length) { setLoading(false); return; }
    setLoading(true);
    base44.integrations.Core.InvokeLLM({
      prompt: `You are a personal finance advisor. Based on the following financial snapshot, provide a brief 1-2 sentence summary of their financial health, then 2-3 actionable recommendations. Be concise, practical, and specific to the data.

IMPORTANT CONTEXT ABOUT BILLS:
- Recurring bills (labeled "recurring") are ongoing monthly obligations (e.g., rent, utilities). These are NOT one-time debts to "pay off." They are regular expenses that recur each cycle. Frame advice about these as managing the recurring obligation, not clearing the balance.
- One-time bills (labeled "one-time") are single payments due by a specific date that should be paid promptly.

Budget utilization: ${budgetUtil.toFixed(0)}% of allocated budget has been spent (${fmt(totalSpent)} of ${fmt(totalAllocated)}). If utilization is above 80%, flag that they're approaching their budget limit. If above 100%, they're over budget.

Financial Snapshot:
- Recurring bills: ${recurringBills.length} bills totaling ${fmt(recurringTotal)}/cycle
${recurringBills.length > 0 ? recurringBills.map(b => `  - ${b.name}: $${b.amount}/cycle (${b.billing_cycle}, due day ${b.due_day || "N/A"})`).join("\n") : ""}
- One-time bills due: ${oneTimeBills.length} bills totaling ${fmt(oneTimeTotal)}
${oneTimeBills.length > 0 ? oneTimeBills.map(b => `  - ${b.name}: $${b.amount}${b.due_date ? ` (due ${b.due_date})` : ""}`).join("\n") : ""}
- Subscriptions: ${subs.length} active, ${fmt(subMonthly)}/month equivalent
- Savings goals: ${savings.length} goals, ${fmt(savingsCurrent)} saved of ${fmt(savingsTarget)} target
- Outstanding loan debt: ${fmt(loansOutstanding)} across ${loans.length} loans
- Top credit score: ${topScore || "N/A"}
- Monthly income: ${fmt(income)}
- Budget utilization: ${budgetUtil.toFixed(0)}% (${fmt(totalSpent)} spent of ${fmt(totalAllocated)} allocated)
- Category breakdown: ${buckets.map(b => `${b.name || b.category || "Other"}: ${fmt(b.spent_amount || 0)}`).join(", ") || "none"}

ADDITIONAL ANALYSIS — 50/30/20 RULE:
If monthly income is greater than 0, evaluate spending against the 50/30/20 guideline (50% needs, 30% wants, 20% savings/debt repayment). Estimate which spending categories fall into needs vs wants based on their names, compute rough percentages of income, and call out whether the user is on track. Keep this to one sentence in the summary or one recommendation.

Format your response as JSON with this structure:
{
  "summary": "1-2 sentence summary of financial health",
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"]
}`,
      response_json_schema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          recommendations: { type: "array", items: { type: "string" } }
        }
      },
    }).then(res => {
      setInsights(res);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [items.length, buckets.length, budgetUtil]);

  const utilColor = budgetUtil > 100 ? "text-destructive" : budgetUtil > 80 ? "text-foreground" : "text-muted-foreground";
  const utilBarColor = budgetUtil > 100 ? "bg-destructive" : budgetUtil > 80 ? "bg-foreground" : "bg-accent";

  return (
    <div>
      {/* Stat tiles */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
        {stats.map(({ tab, label, value, Icon }) => (
          <button
            key={tab}
            onClick={() => onNavigate(tab)}
            className="flex flex-col items-center gap-1 bg-card border border-border rounded-xl py-3 px-1 hover:border-foreground/30 transition-colors"
          >
            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm font-bold text-foreground leading-none">{value}</span>
            <span className="text-[10px] text-muted-foreground leading-none">{label}</span>
          </button>
        ))}
      </div>

      {/* Budget utilization bar */}
      {totalAllocated > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Budget Utilization</span>
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
      <div className="bg-background border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-3.5 h-3.5 text-foreground" />
          <h3 className="text-xs font-medium text-foreground">AI Insights</h3>
          {loading && <span className="w-3 h-3 border-2 border-muted border-t-foreground rounded-full animate-spin ml-1" />}
        </div>
        {loading ? (
          <div className="space-y-2">
            <div className="h-3 bg-muted rounded w-3/4 animate-pulse" />
            <div className="h-3 bg-muted rounded w-1/2 animate-pulse" />
          </div>
        ) : insights ? (
          <>
            <p className="text-sm text-foreground leading-relaxed mb-3">{insights.summary}</p>
            {insights.recommendations?.length > 0 && (
              <div className="space-y-2">
                {insights.recommendations.map((rec, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <Lightbulb className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground leading-relaxed">{rec}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Add more financial data to get personalized AI insights.</p>
        )}
      </div>
    </div>
  );
}