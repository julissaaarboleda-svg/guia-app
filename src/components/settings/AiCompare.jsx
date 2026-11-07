import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ent } from "@/lib/freshEntities";

const TASKS = {
  finance: { label: "Finance insights", note: "Uses your real Finance data" },
  packing: { label: "Packing list", prompt: "Make a packing list for a 5-day trip to Lisbon in November. Rain is likely, the days are walking-heavy, and it's carry-on only. Group by category and keep each line short." },
  travel: { label: "Travel tips", prompt: "Give 5 specific, practical tips for a first-time visitor to Kyoto in autumn. One or two sentences each. Avoid generic advice." },
  custom: { label: "My own prompt", note: "Type anything" },
};
const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const NAME = { claude: "Claude", gemini: "Gemini" };

async function financePrompt() {
  const [items, buckets, income] = await Promise.all([ent.FinanceItem.list(), ent.BudgetBucket.list(), ent.MonthlyIncome.list()]);
  const mk = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const inc = income.find((i) => i.month === mk)?.amount || 0;
  const lines = items.map((i) => `- ${i.type}${i.subtype ? ` (${i.subtype})` : ""}: ${i.name} ${money(i.amount ?? i.monthly_payment ?? i.target_amount)}${i.billing_cycle ? ` ${i.billing_cycle}` : ""}${i.payoff_amount ? `, payoff ${money(i.payoff_amount)}` : ""}`);
  return `You are a personal finance advisor. Based on this snapshot, give a 1-2 sentence summary of their financial health, then 2-3 specific, actionable recommendations. Be concise and practical.\n\nMonthly income: ${money(inc)}\nItems:\n${lines.join("\n") || "(none)"}\nBudget buckets: ${buckets.filter((b) => b.month === mk).map((b) => `${b.name} ${money(b.allocated_amount)}`).join(", ") || "none"}`;
}

export default function AiCompare() {
  const [task, setTask] = useState("finance");
  const [custom, setCustom] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null); // { a: {provider,text,ms,error}, b: {...} }
  const [voted, setVoted] = useState(null);
  const [votes, setVotes] = useState([]);

  const loadVotes = () => ent.AiComparison.list().then(setVotes).catch(() => {});
  useEffect(() => { loadVotes(); }, []);

  const run = async () => {
    setRunning(true); setResult(null); setVoted(null);
    try {
      const prompt = task === "finance" ? await financePrompt() : task === "custom" ? custom.trim() : TASKS[task].prompt;
      if (!prompt) { setRunning(false); return; }
      const order = Math.random() < 0.5 ? ["claude", "gemini"] : ["gemini", "claude"];
      const settle = (provider) => base44.integrations.Core.CompareAI({ prompt, provider })
        .then((r) => ({ provider, text: r.text, ms: r.ms }))
        .catch((e) => ({ provider, error: e.message || "Failed" }));
      const [a, b] = await Promise.all(order.map(settle));
      setResult({ a, b, task });
    } catch (e) {
      setResult({ a: { provider: "claude", error: e.message }, b: { provider: "gemini", error: e.message }, task });
    }
    setRunning(false);
  };

  const vote = async (pick) => {
    const claude = [result.a, result.b].find((x) => x.provider === "claude");
    const gemini = [result.a, result.b].find((x) => x.provider === "gemini");
    const winner = pick === "tie" ? "tie" : result[pick].provider;
    setVoted(winner);
    try { await ent.AiComparison.create({ task: result.task, winner, claude_ms: claude.ms, gemini_ms: gemini.ms }); loadVotes(); } catch { /* ignore */ }
  };

  const tally = (list) => ({ claude: list.filter((v) => v.winner === "claude").length, gemini: list.filter((v) => v.winner === "gemini").length, tie: list.filter((v) => v.winner === "tie").length });
  const all = tally(votes);
  const avg = (key) => { const xs = votes.map((v) => v[key]).filter(Boolean); return xs.length ? (xs.reduce((s, x) => s + x, 0) / xs.length / 1000).toFixed(1) : "—"; };
  const bothOk = result && !result.a.error && !result.b.error;

  const card = (slot, label) => {
    const r = result[slot];
    return (
      <div className="bg-card border border-border rounded-2xl p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="font-heading text-base text-foreground">Answer {label}</p>
          {voted && <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#F0E6D6] text-[#8B6B3E]">{NAME[r.provider]}{r.ms ? ` · ${(r.ms / 1000).toFixed(1)}s` : ""}</span>}
        </div>
        {r.error ? <p className="text-xs text-destructive">{r.error}</p> : <p className="text-[13px] text-foreground whitespace-pre-wrap leading-relaxed">{r.text}</p>}
        {bothOk && !voted && <button onClick={() => vote(slot)} className="mt-3 text-xs bg-[#A7773F] text-[#F7F3EC] rounded-full px-4 py-1.5">{label} is better</button>}
      </div>
    );
  };

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">Runs the same request on Claude and Gemini and shows the answers in a random order. Pick the better one and the app tells you which model wrote it.</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {Object.entries(TASKS).map(([k, t]) => (
          <button key={k} onClick={() => setTask(k)} className={`px-3 py-1 rounded-full text-xs ${task === k ? "bg-[#A7773F] text-[#F7F3EC]" : "border border-border text-muted-foreground"}`}>{t.label}</button>
        ))}
      </div>
      {task === "custom" && (
        <textarea value={custom} onChange={(e) => setCustom(e.target.value)} rows={3} placeholder="Ask anything"
          className="w-full bg-secondary border border-input rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-ring mb-3" />
      )}
      <button onClick={run} disabled={running || (task === "custom" && !custom.trim())} className="bg-[#A7773F] text-[#F7F3EC] rounded-full font-heading text-sm px-5 py-2 disabled:opacity-50">
        {running ? "Asking both…" : "Run comparison"}
      </button>

      {result && (
        <div className="space-y-3 mt-4">
          {card("a", "A")}
          {card("b", "B")}
          {bothOk && !voted && <button onClick={() => vote("tie")} className="text-xs text-muted-foreground underline">They're about the same</button>}
          {voted && <p className="text-sm text-foreground font-heading">{voted === "tie" ? "Recorded as a tie." : `${NAME[voted]} wins this one.`}</p>}
        </div>
      )}

      {votes.length > 0 && (
        <div className="mt-5 bg-secondary rounded-2xl p-3">
          <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground mb-1.5">Score so far · {votes.length} {votes.length === 1 ? "vote" : "votes"}</p>
          <p className="font-heading text-lg text-foreground">Claude {all.claude} · Gemini {all.gemini}{all.tie ? ` · ${all.tie} tie${all.tie === 1 ? "" : "s"}` : ""}</p>
          <p className="text-xs text-muted-foreground mt-1">Average time: Claude {avg("claude_ms")}s · Gemini {avg("gemini_ms")}s</p>
        </div>
      )}
    </div>
  );
}
