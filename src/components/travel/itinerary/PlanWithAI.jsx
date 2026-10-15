import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Sparkles, ChevronRight, X, ArrowUp, Plus, Check, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { format, parseISO } from "date-fns";

// Itinerary-only AI planner. It is given ONLY the trip's itinerary (days,
// times, places) plus basic trip identity — never Notes, Packing, Budget or
// Saved. Live Google Search is used only when the question looks like it
// needs current info (events, hours, weather...) to keep cost down.

const SEARCH_TRIGGER = /\b(events?|happening|going on|this week(end)?|today|tonight|tomorrow|concerts?|exhibit(ion)?s?|festivals?|shows?|current|latest|news|weather|right now|open now|closed|hours|playing|showing|recent)\b/i;

const CHIPS = [
  { label: "Fill my empty days", q: "Which days or time blocks look empty or light? Suggest 1-2 things for each." },
  { label: "What am I missing?", q: "Looking at my itinerary, what am I missing (meals, transit gaps, rest, timing problems)? Be specific." },
  { label: "Evening ideas", q: "Suggest evening plans that fit around what I already have on the selected day." },
];

function dayLabel(d) {
  try { return d.date ? format(parseISO(d.date), "EEE, MMM d") : `Day ${d.day}`; } catch { return `Day ${d.day}`; }
}

function buildItineraryText(trip, itinerary) {
  const lines = (itinerary || []).map((d) => {
    const acts = (d.activities || [])
      .map((a) => `  - ${a.time || "no time"} ${a.name || a.activity || "Item"}${a.location ? ` (${a.location})` : ""}`)
      .join("\n");
    return `${d.date || `Day ${d.day}`} — ${dayLabel(d)}${d.city ? `, ${d.city}` : ""}${d.title ? ` — ${d.title}` : ""}\n${acts || "  (nothing planned)"}`;
  });
  return `Trip: ${trip.title || ""}\nCities: ${(trip.cities || []).join(", ")}\nDates: ${trip.start_date || ""} to ${trip.end_date || ""}\n\nItinerary:\n${lines.join("\n")}`;
}

export default function PlanWithAI({ trip, itinerary, activeIdx, onAddSuggestion }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // {role, text, suggestions?, added?:Set}
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, loading]);

  const ask = async (question) => {
    const q = (question || "").trim();
    if (!q || loading) return;
    const activeDay = itinerary[activeIdx];
    const history = messages.slice(-6).map((m) => `${m.role === "user" ? "Traveler" : "Assistant"}: ${m.text}`).join("\n");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setLoading(true);
    const grounded = SEARCH_TRIGGER.test(q);
    const prompt = `You are a concise trip-planning helper inside the Guía app. Use ONLY the itinerary below as your picture of the trip. Do not assume anything about packing, budget, notes or saved places. ${grounded ? "Use search for current/real-world facts and only suggest things that really exist." : "Only suggest well-known, real places; do not invent venues."}

${buildItineraryText(trip, itinerary)}

The traveler is currently viewing: ${activeDay ? `${activeDay.date || `Day ${activeDay.day}`}` : "no day"}.
${history ? `\nRecent conversation:\n${history}\n` : ""}
Traveler asks: ${q}

Reply in 1-3 short sentences ("reply"). If concrete additions make sense, include up to 4 "suggestions", each with the date (yyyy-MM-dd, must be one of the itinerary dates), a time (HH:MM 24h), a short type label ("Dinner", "Sightseeing"...), the place name, its city, and a one-line reason. Avoid overlapping times with existing items. Return JSON: { reply, suggestions: [{ date, time, activity, name, location, why }] }`;
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: grounded,
        response_json_schema: {
          type: "object",
          properties: {
            reply: { type: "string" },
            suggestions: { type: "array", items: { type: "object", properties: { date: { type: "string" }, time: { type: "string" }, activity: { type: "string" }, name: { type: "string" }, location: { type: "string" }, why: { type: "string" } } } },
          },
        },
      });
      setMessages((m) => [...m, { role: "ai", text: res?.reply || "Here's what I'd suggest.", suggestions: res?.suggestions || [], added: [] }]);
    } catch (e) {
      const msg = /429|limit/i.test(String(e?.message)) ? "You've hit the hourly limit for AI help. Try again a bit later." : "Couldn't get ideas right now. Please try again.";
      setMessages((m) => [...m, { role: "ai", text: msg, suggestions: [], added: [] }]);
    } finally {
      setLoading(false);
    }
  };

  const add = (msgIdx, sIdx) => {
    const s = messages[msgIdx].suggestions[sIdx];
    onAddSuggestion(s);
    setMessages((all) => all.map((m, i) => (i === msgIdx ? { ...m, added: [...(m.added || []), sIdx] } : m)));
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2.5 bg-[#F1EEE5] border border-[#E3DED0] rounded-2xl px-3.5 py-3 text-left hover:border-foreground/25 transition-colors"
      >
        <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: "#A7773F" }} />
        <span className="flex-1 min-w-0">
          <span className="block font-body text-[13px] font-medium text-foreground">Plan with AI</span>
          <span className="block font-body text-[11px] text-muted-foreground">Fill gaps · what am I missing?</span>
        </span>
        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[80] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative bg-background rounded-t-3xl border-t border-border shadow-editorial flex flex-col" style={{ height: "min(78vh, 640px)", paddingBottom: "env(safe-area-inset-bottom)" }}>
            <div className="px-5 pt-3 pb-2">
              <div className="w-9 h-1 rounded-full bg-border mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-lg text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" style={{ color: "#A7773F" }} /> Plan with AI
                </h3>
                <button onClick={() => setOpen(false)} className="p-3 -m-3 text-muted-foreground" aria-label="Close"><X className="w-5 h-5" /></button>
              </div>
              <p className="font-body text-[11px] text-muted-foreground mt-0.5">Uses only your itinerary — not Notes, Packing or Budget.</p>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 space-y-2.5 pb-3">
              {messages.length === 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {CHIPS.map((c) => (
                    <button key={c.label} onClick={() => ask(c.q)} className="font-body text-[12px] bg-card border border-border rounded-full px-3 py-1.5 hover:border-foreground/25">
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
              {messages.map((m, i) => m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="bg-foreground text-background rounded-2xl px-3.5 py-2 font-body text-[13px] max-w-[85%]">{m.text}</div>
                </div>
              ) : (
                <div key={i} className="bg-card border border-border rounded-2xl px-3.5 py-3 font-body text-[13px] text-foreground leading-relaxed">
                  <p>{m.text}</p>
                  {m.suggestions?.length > 0 && (
                    <div className="mt-2">
                      {m.suggestions.map((s, j) => {
                        const done = (m.added || []).includes(j);
                        return (
                          <div key={j} className="flex items-center justify-between gap-2 py-2 border-t border-border first:border-t-0">
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium truncate">{s.name || s.activity}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {[s.date && (() => { try { return format(parseISO(s.date), "EEE MMM d"); } catch { return s.date; } })(), s.time, s.why].filter(Boolean).join(" · ")}
                              </p>
                            </div>
                            <button
                              disabled={done}
                              onClick={() => add(i, j)}
                              className={`flex-shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] border ${done ? "border-[#7D8A53] text-[#5F6A3F]" : "border-[#A7773F] text-[#A7773F]"}`}
                            >
                              {done ? <><Check className="w-3 h-3" /> Added</> : <><Plus className="w-3 h-3" /> Add</>}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex items-center gap-2 text-muted-foreground font-body text-[12px] px-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking…
                </div>
              )}
              {messages.length > 0 && !loading && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {CHIPS.map((c) => (
                    <button key={c.label} onClick={() => ask(c.q)} className="font-body text-[11px] bg-card border border-border rounded-full px-2.5 py-1 text-muted-foreground">{c.label}</button>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="px-5 pt-2 pb-3 flex gap-2 border-t border-border">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your itinerary…"
                className="flex-1 bg-card border border-border rounded-full px-4 py-2.5 font-body text-[13px] outline-none focus:border-ring"
              />
              <button type="submit" disabled={loading || !input.trim()} className="w-10 h-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center disabled:opacity-40" aria-label="Send">
                <ArrowUp className="w-4 h-4" />
              </button>
            </form>
            <p className="font-body text-[10px] text-muted-foreground text-center pb-2 -mt-1">Event questions use live search · limited per hour</p>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
