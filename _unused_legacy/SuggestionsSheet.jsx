import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X, Star, Plus, Sparkles, ExternalLink } from "lucide-react";
import { formatTime } from "./activityTypes";
import { parseISO, format } from "date-fns";

const cache = new Map();

function to24h(t) {
  if (!t) return "";
  const m = String(t).match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return "";
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ap = (m[3] || "").toUpperCase();
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${min}`;
}

export default function SuggestionsSheet({ open, onClose, trip, city, day, onAdd }) {
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const key = `${trip.id}|${day?.date || day?.day}|${city}`;
    if (cache.has(key)) { setItems(cache.get(key)); return; }
    let cancelled = false;
    setLoading(true);
    setItems(null);
    const planned = (day?.activities || [])
      .map((a) => `${a.time ? formatTime(a.time) : "—"} ${a.activity || "Activity"}${a.name ? " — " + a.name : ""}${a.location ? " · " + a.location : ""}`)
      .join("\n");
    const prompt = `You are a luxury travel concierge for the Guía app. On ${day?.date || "day " + (day?.day || 1)}${trip.country ? " in " + trip.country : ""} the traveler's real schedule is:

${planned || "- nothing yet"}

Read that schedule carefully — note where the traveler actually is at each point of the day, including any layover or connection cities. Suggest 3 specific, REAL, currently-open places that fit the ACTUAL free windows of this day: for example a morning activity in the departure city before an evening flight, or things to do during an airport layover in the layover city. Do not suggest places the traveler will miss because of travel — if there is a long layover in another city, include ideas for that layover city. For each, give the city/neighborhood it is in, an accurate link (the venue's official website URL if it has one, otherwise a Google Maps URL for that place), and a time that fits the real gaps. Do not repeat what's already planned. Return JSON: { suggestions: [ { name, description (under 80 chars), time (like "1:00 PM"), neighborhood, link } ] }.`;
    (async () => {
      try {
        const res = await base44.integrations.Core.InvokeLLM({
          prompt,
          model: "gemini_3_flash",
          add_context_from_internet: true,
          response_json_schema: {
            type: "object",
            properties: { suggestions: { type: "array", items: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, time: { type: "string" }, neighborhood: { type: "string" }, link: { type: "string" } } } } },
          },
        });
        if (cancelled) return;
        const list = res.suggestions || [];
        cache.set(key, list);
        setItems(list);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, day?.date, day?.day, city, trip.id]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-t-3xl md:rounded-2xl w-full max-w-md shadow-editorial flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 pb-3">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-accent" />
            <h2 className="font-heading text-lg text-foreground">Suggestions</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="font-body text-[13px] text-muted-foreground px-5 pb-4 leading-snug">
          A few ideas to round out {day?.date ? format(parseISO(day.date), "EEEE, MMMM d") : "the day"}.
        </p>
        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2.5">
          {loading ? (
            [0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-border p-3.5 animate-pulse">
                <div className="h-4 w-1/2 bg-muted rounded mb-2" />
                <div className="h-3 w-full bg-muted/60 rounded" />
              </div>
            ))
          ) : items && items.length > 0 ? (
            items.map((s, i) => (
              <div key={i} className="rounded-xl border border-border p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Sparkles className="w-3 h-3 text-accent" />
                      {s.time && <span className="font-body text-[11px] text-muted-foreground">{s.time}</span>}
                    </div>
                    {s.link ? (
                      <a href={s.link} target="_blank" rel="noopener noreferrer" className="font-body text-[14px] font-semibold text-foreground leading-tight hover:underline inline-flex items-center gap-1">
                        {s.name}
                        <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      </a>
                    ) : (
                      <p className="font-body text-[14px] font-semibold text-foreground leading-tight">{s.name}</p>
                    )}
                    {s.neighborhood && <p className="font-body text-[12px] text-muted-foreground mt-0.5">{s.neighborhood}</p>}
                    {s.description && <p className="font-body text-[12px] text-muted-foreground mt-1 leading-snug">{s.description}</p>}
                  </div>
                  <button
                    onClick={() => onAdd({ time: to24h(s.time), activity: s.name, location: s.neighborhood || "", notes: s.description || "", link: s.link || "" })}
                    className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 h-7 rounded-full bg-foreground text-background text-[11px] font-medium hover:opacity-90 transition-opacity"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground text-sm py-8">No suggestions right now</p>
          )}
        </div>
      </div>
    </div>
  );
}