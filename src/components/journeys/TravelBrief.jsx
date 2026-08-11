import { useState, useEffect } from "react";
import { Sparkles, DollarSign, Sun, ClipboardList } from "lucide-react";
import { generateTravelBrief } from "@/lib/journeyAi";

function iconForText(text) {
  const t = (text || "").toLowerCase();
  if (/(budget|under|\$|spend|over|cost|money)/.test(t)) return DollarSign;
  if (/(weather|warm|sun|rain|forecast|sky|day \d)/.test(t)) return Sun;
  if (/(itinerary|activity|activities|confirm|schedule|plan|packing|item)/.test(t)) return ClipboardList;
  return Sparkles;
}

// NOTE: this widget used to link out to a separate full-page "Travel Assistant"
// screen (TravelAssistantPage.jsx). That page was retired — it duplicated this
// widget's weather/budget/itinerary insights almost entirely (three separate AI
// calls generating overlapping "trip intelligence" across different screens).
// This widget is now the whole feature, not a preview of a bigger one.
export default function TravelBrief({ trip }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    generateTravelBrief(trip)
      .then((res) => { if (alive) { setInsights(res); setLoading(false); } })
      .catch(() => { if (alive) { setInsights(null); setLoading(false); } });
    return () => { alive = false; };
  }, [trip.id]);

  const items = loading ? [0, 1] : (insights || []);

  return (
    <section>
      <div className="flex items-center gap-1.5 mb-3">
        <Sparkles className="w-4 h-4 text-olive" strokeWidth={1.6} />
        <h2 className="font-heading text-lg text-foreground font-semibold leading-tight">Travel Assistant</h2>
      </div>

      <div className="flex flex-col">
        {items.map((it, i) => {
          const Icon = loading ? Sparkles : iconForText(it.headline || it.detail || "");
          return (
            <div key={i} className={`flex items-start gap-3 ${i > 0 ? "pt-3 mt-3 border-t border-border/50" : ""}`}>
              <span className={`flex-shrink-0 ${loading ? "w-7 h-7 rounded-full bg-secondary animate-pulse" : "w-7 h-7 rounded-full bg-muted flex items-center justify-center"}`}>
                {!loading && <Icon className="w-3.5 h-3.5 text-foreground" strokeWidth={1.6} />}
              </span>
              <div className="min-w-0 flex-1">
                {loading ? (
                  <>
                    <div className="h-3 w-3/4 rounded bg-secondary animate-pulse mb-2" />
                    <div className="h-2 w-full rounded bg-secondary/70 animate-pulse" />
                  </>
                ) : (
                  <>
                    <p className="font-body text-[13px] text-foreground font-semibold leading-tight">{it.headline}</p>
                    <p className="font-body text-[11px] text-muted-foreground leading-snug mt-0.5">{it.detail}</p>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}