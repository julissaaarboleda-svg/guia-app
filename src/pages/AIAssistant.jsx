import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Send, Sparkles } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import ReactMarkdown from "react-markdown";

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildContext(items, buckets, income) {
  const mk = monthKey(new Date());
  const monthBuckets = buckets.filter(b => b.month === mk);
  const monthIncome = income.find(i => i.month === mk);
  const incomeAmt = monthIncome?.amount || 0;
  const allocated = monthBuckets.reduce((s, b) => s + (b.allocated_amount || 0), 0);
  const spent = monthBuckets.reduce((s, b) => s + (b.spent_amount || 0), 0);

  let ctx = `You are a helpful financial assistant for an app called Guía. Here is the user's current financial data:\n\n`;
  ctx += `Monthly Income: $${incomeAmt.toLocaleString()}\n`;
  ctx += `Budget Allocated: $${allocated.toLocaleString()}\n`;
  ctx += `Budget Spent: $${spent.toLocaleString()}\n`;
  ctx += `Budget Remaining (income - allocated): $${(incomeAmt - allocated).toLocaleString()}\n`;

  if (monthBuckets.length > 0) {
    ctx += `\nBudget Buckets:\n`;
    monthBuckets.forEach(b => {
      ctx += `- ${b.name}: $${(b.spent_amount || 0).toLocaleString()} spent of $${(b.allocated_amount || 0).toLocaleString()} allocated${b.is_fixed ? " (fixed)" : ""}\n`;
    });
  }

  const bills = items.filter(i => i.type === "bill");
  const savings = items.filter(i => i.type === "savings_goal");
  const loans = items.filter(i => i.type === "loan");
  const subs = items.filter(i => i.type === "subscription");
  const credit = items.filter(i => i.type === "credit_score");

  if (bills.length) {
    ctx += `\nBills:\n`;
    bills.forEach(b => ctx += `- ${b.name}: $${(b.amount || 0).toLocaleString()} ${b.paid ? "(paid)" : "(unpaid)"}${b.due_date ? ` due ${b.due_date}` : ""}\n`);
  }
  if (savings.length) {
    ctx += `\nSavings Goals:\n`;
    savings.forEach(s => ctx += `- ${s.name}: $${(s.current_amount || 0).toLocaleString()} of $${(s.target_amount || 0).toLocaleString()}\n`);
  }
  if (loans.length) {
    ctx += `\nLoans:\n`;
    loans.forEach(l => ctx += `- ${l.name}: $${(l.amount_paid || 0).toLocaleString()} of $${(l.total_amount || 0).toLocaleString()} paid off, monthly payment $${(l.monthly_payment || 0).toLocaleString()}\n`);
  }
  if (subs.length) {
    const monthlyEquiv = subs.reduce((s, sub) => {
      const amt = sub.amount || 0;
      if (sub.billing_cycle === "yearly") return s + amt / 12;
      if (sub.billing_cycle === "quarterly") return s + amt / 3;
      if (sub.billing_cycle === "weekly") return s + amt * 4.33;
      return s + amt;
    }, 0);
    ctx += `\nSubscriptions (monthly equivalent: $${monthlyEquiv.toFixed(2)}):\n`;
    subs.forEach(s => ctx += `- ${s.name}: $${(s.amount || 0).toLocaleString()}/${s.billing_cycle || "monthly"}${s.renewal_date ? ` renews ${s.renewal_date}` : ""}\n`);
  }
  if (credit.length) {
    ctx += `\nCredit Scores:\n`;
    credit.forEach(c => ctx += `- ${c.bureau || c.name}: ${c.score || "N/A"}${c.target_score ? ` (target: ${c.target_score})` : ""}\n`);
  }

  ctx += `\nAnswer the user's questions about their finances concisely and helpfully. Use the data above. If the user asks about something not in the data, let them know.`;
  return ctx;
}

export default function AIAssistant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    const loadData = async () => {
      const [items, buckets, income] = await Promise.all([
        base44.entities.FinanceItem.list("-created_date"),
        base44.entities.BudgetBucket.list("-created_date"),
        base44.entities.MonthlyIncome.list("-created_date"),
      ]);
      setContext(buildContext(items, buckets, income));
    };
    loadData();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    const newMessages = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const conversation = newMessages
        .map(m => m.role === "user" ? `User: ${m.content}` : `Assistant: ${m.content}`)
        .join("\n\n");

      const prompt = `${context}\n\n${conversation}\n\nAssistant:`;

      const res = await base44.integrations.Core.InvokeLLM({ prompt });
      setMessages([...newMessages, { role: "assistant", content: res }]);
    } catch (err) {
      setMessages([...newMessages, { role: "assistant", content: "Sorry, I couldn't process that right now. Please try again." }]);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full max-w-[800px] mx-auto w-full">
      <PageHeader title="AI Assistant" subtitle="Ask about your finances" />
      <div className="flex-1 overflow-y-auto px-6 md:px-8 pb-4 space-y-4" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-16 text-muted-foreground">
            <Sparkles className="w-10 h-10 mb-3 text-muted-foreground/40" />
            <p className="text-sm">Ask me about your budget, bills, savings, or subscriptions.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
              msg.role === "user"
                ? "bg-foreground text-background"
                : "bg-card border border-border text-foreground"
            }`}>
              {msg.role === "user" ? (
                <p className="text-sm">{msg.content}</p>
              ) : (
                <ReactMarkdown className="text-sm">{msg.content}</ReactMarkdown>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="px-6 md:px-8 pb-6 md:pb-8">
        <div className="flex items-center gap-2 bg-card border border-border rounded-full pl-4 pr-1.5 py-1.5">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
            placeholder="Ask about your finances..."
            className="flex-1 bg-transparent text-sm text-foreground outline-none"
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground text-background disabled:opacity-30 hover:opacity-90 transition-opacity flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}