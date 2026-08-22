import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Send, Sparkles, ChevronLeft } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import ReactMarkdown from "react-markdown";

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildFinanceSection(items, buckets, income) {
  const mk = monthKey(new Date());
  const monthBuckets = buckets.filter(b => b.month === mk);
  const monthIncome = income.find(i => i.month === mk);
  const incomeAmt = monthIncome?.amount || 0;
  const allocated = monthBuckets.reduce((s, b) => s + (b.allocated_amount || 0), 0);
  const spent = monthBuckets.reduce((s, b) => s + (b.spent_amount || 0), 0);

  let ctx = `\n## Finance\nMonthly Income: $${incomeAmt.toLocaleString()}\nBudget Allocated: $${allocated.toLocaleString()}\nBudget Spent: $${spent.toLocaleString()}\nBudget Remaining: $${(incomeAmt - allocated).toLocaleString()}\n`;

  if (monthBuckets.length > 0) {
    ctx += `Budget Buckets:\n`;
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
    ctx += `Bills:\n`;
    bills.forEach(b => ctx += `- ${b.name}: $${(b.amount || 0).toLocaleString()} ${b.paid ? "(paid)" : "(unpaid)"}${b.due_date ? ` due ${b.due_date}` : ""}\n`);
  }
  if (savings.length) {
    ctx += `Savings Goals:\n`;
    savings.forEach(s => ctx += `- ${s.name}: $${(s.current_amount || 0).toLocaleString()} of $${(s.target_amount || 0).toLocaleString()}\n`);
  }
  if (loans.length) {
    ctx += `Loans:\n`;
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
    ctx += `Subscriptions (monthly equivalent: $${monthlyEquiv.toFixed(2)}):\n`;
    subs.forEach(s => ctx += `- ${s.name}: $${(s.amount || 0).toLocaleString()}/${s.billing_cycle || "monthly"}${s.renewal_date ? ` renews ${s.renewal_date}` : ""}\n`);
  }
  if (credit.length) {
    ctx += `Credit Scores:\n`;
    credit.forEach(c => ctx += `- ${c.bureau || c.name}: ${c.score || "N/A"}${c.target_score ? ` (target: ${c.target_score})` : ""}\n`);
  }
  return ctx;
}

function buildGoalsSection(goals, tasks) {
  if (goals.length === 0 && tasks.length === 0) return "";
  let ctx = `\n## Goals & Tasks\n`;
  goals.slice(0, 15).forEach(g => {
    const sub = g.sub_tasks || [];
    const done = sub.filter(t => t.completed).length;
    ctx += `- Goal: ${g.title} (${g.category || "personal"}, ${g.status || "in progress"}${sub.length ? `, ${done}/${sub.length} sub-tasks done` : ""})\n`;
  });
  tasks.filter(t => !t.completed).slice(0, 15).forEach(t => {
    ctx += `- Task: ${t.title}${t.due_date ? ` (due ${t.due_date})` : ""}${t.priority ? ` [${t.priority}]` : ""}\n`;
  });
  return ctx;
}

function buildNotesSection(notes) {
  if (notes.length === 0) return "";
  let ctx = `\n## Notes\n`;
  notes.slice(0, 15).forEach(n => {
    const preview = n.note_type === "list"
      ? (n.list_items || []).map(i => i.text).slice(0, 5).join(", ")
      : (n.content || "").replace(/<[^>]+>/g, "").slice(0, 100);
    ctx += `- ${n.title}${preview ? `: ${preview}` : ""}\n`;
  });
  return ctx;
}

function buildTripsSection(trips) {
  if (trips.length === 0) return "";
  let ctx = `\n## Journeys (trips)\n`;
  trips.slice(0, 5).forEach(t => {
    const daysUntil = t.start_date
      ? Math.ceil((new Date(t.start_date + "T00:00:00") - new Date()) / (1000 * 60 * 60 * 24))
      : null;
    ctx += `- ${t.title}: ${(t.cities || []).join(" → ") || t.country || ""}, ${t.start_date || "?"} to ${t.end_date || "?"}${daysUntil !== null ? ` (${daysUntil} days from today)` : ""}, status: ${t.status || "planning"}\n`;
    const days = (t.itinerary || []).filter(d => d.activities && d.activities.length > 0);
    if (days.length > 0) {
      ctx += `  Planned activities:\n`;
      days.slice(0, 20).forEach(d => {
        (d.activities || []).forEach(a => {
          ctx += `  - ${d.date || ""}: ${a.name || a.activity || ""}${a.location ? ` (${a.location})` : ""}\n`;
        });
      });
    }
    const packing = t.packing_items || [];
    if (packing.length > 0) {
      const unpacked = packing.filter(p => !p.packed);
      ctx += `  Packing list (${packing.filter(p => p.packed).length}/${packing.length} packed). Not yet packed: ${unpacked.map(p => p.name).join(", ") || "everything is packed"}\n`;
    }
  });
  return ctx;
}

function buildProjectsSection(projects) {
  if (projects.length === 0) return "";
  let ctx = `\n## Projects\n`;
  projects.slice(0, 10).forEach(p => {
    const tasks = p.tasks || [];
    const done = tasks.filter(t => t.completed).length;
    ctx += `- ${p.title} (${p.status || "planning"}${tasks.length ? `, ${done}/${tasks.length} tasks done` : ""}${p.target_date ? `, due ${p.target_date}` : ""})\n`;
  });
  return ctx;
}

function buildCareerSection(entries) {
  if (entries.length === 0) return "";
  let ctx = `\n## Career\n`;
  entries.slice(0, 20).forEach(e => {
    if (e.entry_type === "job") {
      ctx += `- Job: ${e.title}${e.company ? ` at ${e.company}` : ""}${e.current ? " (current)" : ""}${e.start_date ? `, since ${e.start_date}` : ""}${e.salary ? `, $${e.salary.toLocaleString()}` : ""}\n`;
    } else if (e.entry_type === "review") {
      ctx += `- Performance review: ${e.title}${e.rating ? ` — rated ${e.rating}/${e.rating_scale || 10}` : ""}${e.start_date ? ` (${e.start_date})` : ""}\n`;
    } else if (["milestone", "skill", "certification"].includes(e.entry_type)) {
      ctx += `- ${e.entry_type === "milestone" ? "Achievement" : e.entry_type === "skill" ? "Skill" : "Certification"}: ${e.title}${e.start_date ? ` (${e.start_date})` : ""}\n`;
    } else if (e.entry_type === "education") {
      ctx += `- Education: ${e.title}${e.company ? ` at ${e.company}` : ""}\n`;
    } else {
      ctx += `- ${e.title}\n`;
    }
    if (e.skills_gained?.length) ctx += `  Skills: ${e.skills_gained.join(", ")}\n`;
  });
  return ctx;
}

function buildBusinessSection(entries, goals) {
  if (entries.length === 0 && goals.length === 0) return "";
  let ctx = `\n## Business\n`;
  if (goals.length > 0) {
    ctx += `Business goals:\n`;
    goals.slice(0, 10).forEach(g => {
      ctx += `- ${g.title}${g.target_value ? `: ${g.current_value || 0}${g.unit === "$" ? "" : " " + g.unit} of ${g.target_value}${g.unit === "$" ? " $" : ""} target` : ""}${g.target_date ? ` (by ${g.target_date})` : ""}\n`;
    });
  }
  if (entries.length > 0) {
    const totalRevenue = entries.reduce((s, e) => s + (e.revenue || 0), 0);
    const totalExpense = entries.reduce((s, e) => s + (e.expense || 0), 0);
    ctx += `Business log (${entries.length} entries, $${totalRevenue.toLocaleString()} revenue / $${totalExpense.toLocaleString()} expenses logged total):\n`;
    entries.slice(0, 15).forEach(e => {
      ctx += `- ${e.category ? `[${e.category}] ` : ""}${e.name}${e.date ? ` (${e.date})` : ""}${e.location ? `, ${e.location}` : ""}${e.revenue ? `, +$${e.revenue.toLocaleString()}` : ""}${e.expense ? `, -$${e.expense.toLocaleString()}` : ""}\n`;
    });
  }
  return ctx;
}

function buildSystemPrompt(sections) {
  return `You are Guía's personal AI assistant — a genuinely capable, general-purpose assistant, not a narrow bot limited to one topic.

You have access to the user's personal data below (goals, tasks, notes, trips, projects, and finances). Use it naturally to give specific, personalized answers whenever a question relates to it — e.g. if they ask what to do somewhere they're traveling, check their trip's itinerary and cities first.

But you are NOT limited to this data. Answer any question the user asks — general knowledge, definitions, explanations, advice, brainstorming, anything — exactly as a knowledgeable, helpful assistant would, the same way you'd answer if there were no app data at all. Only mention their personal data when it's actually relevant to what they asked; don't force a connection to their finances or any other single category if the question doesn't call for it.

When the user asks a "how's it going" / status-check style question about something they already have stored (e.g. "how's my trip looking", "how am I doing on my budget", "where do things stand with X project") — do NOT restate everything they already have saved; they can already see that in the app. Instead give a brief status take: what's solid, what's missing or needs attention, and any real risks or gaps worth flagging. A few sentences is usually enough. Only go into full detail (listing out every flight, every line item, every task) if they explicitly ask for a rundown, a full list, or "everything."

${sections.filter(Boolean).join("\n") || "(No personal data found yet — the user hasn't added much to the app.)"}

Answer naturally and concisely.`;
}

const CHAT_STORAGE_KEY = "guia:ai-chat-history";

// How many prior messages (user + assistant combined) get sent to Gemini as
// context on each new question. The full conversation still lives in state
// and localStorage for display — this only limits what's re-sent as input,
// so token cost (and $) stays flat instead of growing with every message.
const MAX_CONTEXT_MESSAGES = 8;

function loadStoredMessages() {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function AIAssistant() {
  const [messages, setMessages] = useState(loadStoredMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState("");
  const scrollRef = useRef(null);
  const inputBarRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    inputBarRef.current?.scrollIntoView({ block: "end" });
  }, []);

  useEffect(() => {
    const loadData = async () => {
      const results = await Promise.allSettled([
        base44.entities.FinanceItem.list("-created_date"),
        base44.entities.BudgetBucket.list("-created_date"),
        base44.entities.MonthlyIncome.list("-created_date"),
        base44.entities.Goal.list("-created_date"),
        base44.entities.Task.list("-created_date"),
        base44.entities.Note.list("-created_date"),
        base44.entities.Trip.list("-created_date"),
        base44.entities.Project.list("-created_date"),
        base44.entities.CareerEntry.list("-start_date"),
        base44.entities.BusinessEntry.list("-date"),
        base44.entities.BusinessGoal.list("-created_date"),
      ]);
      const [items, buckets, income, goals, tasks, notes, trips, projects, careerEntries, businessEntries, businessGoals] = results.map(
        (r) => (r.status === "fulfilled" ? r.value : [])
      );
      const sections = [
        buildFinanceSection(items, buckets, income),
        buildGoalsSection(goals, tasks),
        buildNotesSection(notes),
        buildTripsSection(trips),
        buildProjectsSection(projects),
        buildCareerSection(careerEntries),
        buildBusinessSection(businessEntries, businessGoals),
      ];
      setContext(buildSystemPrompt(sections));
    };
    loadData();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    inputBarRef.current?.scrollIntoView({ block: "end" });
  }, [messages, loading]);

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  const clearHistory = () => {
    if (!confirm("Clear this conversation? This can't be undone.")) return;
    setMessages([]);
    try { localStorage.removeItem(CHAT_STORAGE_KEY); } catch {}
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    const newMessages = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const recentMessages = newMessages.slice(-MAX_CONTEXT_MESSAGES);
      const conversation = recentMessages
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
    <div className="flex flex-col max-w-[800px] mx-auto w-full">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 px-6 md:px-8 pt-4 font-body text-[13px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Back
      </button>
      <PageHeader
        title="AI Assistant"
        subtitle="Ask me anything"
        actions={
          <div className="flex items-center gap-3">
            {messages.length > 0 && (
              <button
                onClick={clearHistory}
                className="text-[12px] font-body text-muted-foreground hover:text-destructive transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        }
      />
      <div className="px-6 md:px-8 pb-4 space-y-4" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-16 text-muted-foreground">
            <Sparkles className="w-10 h-10 mb-3 text-muted-foreground/40" />
            <p className="text-sm">Ask about anything in Guía — your goals, trips, projects, career, business, finances — or just ask anything else.</p>
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
      <div className="px-6 md:px-8 pb-6 md:pb-8" ref={inputBarRef}>
        <div className="flex items-center gap-2 bg-card border border-border rounded-full pl-4 pr-1.5 py-1.5">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
            placeholder="Ask anything..."
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
