import { useState, useEffect } from "react";
import { CloudRain, Calendar, DollarSign, Target, Sparkles, ChevronDown } from "lucide-react";
import { generateTravelInsights } from "@/lib/travelAi";

const ICONS = {
  rain: CloudRain,
  calendar: Calendar,
  budget: DollarSign,
  target: Target,
  sparkle: Sparkles,
};

export default function TravelAssistant({ trip, onNavigate }) {
  const [insights, setInsights] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    generateTravelInsights(trip)
      .then((res) => { if (alive) { setInsights(res); setLoading(false); } })
      .catch((err) => {
        console.error("TravelAssistant failed to generate insights:", err);
        if (alive) { setInsights([]); setLoading(false); }
      });
    return () => { alive = false; };
  }, [trip.id]);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-2.5 animate-pulse">
        <Sparkles className="w-4 h-4 text-muted-foreground" />
        <span className="font-body text-[13px] text-muted-foreground">Thinking about your trip…</span>
      </div>
    );
  }

  if (!insights || insights.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl px-4 py-3.5 flex items-center gap-2.5">
        <Sparkles className="w-4 h-4" style={{ color: "#A7773F" }} />
        <span className="font-body text-[13px] text-muted-foreground">Nothing urgent to flag right now.</span>
      </div>
    );
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full bg-card border border-border rounded-2xl px-4 py-3.5 flex items-center justify-between hover:border-ring/40 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-4 h-4" style={{ color: "#A7773F" }} />
          <span className="font-body text-[13px] text-foreground">
            {insights.length} thing{insights.length > 1 ? "s" : ""} worth a look
          </span>
        </div>
        <span className="font-body text-[12px] flex items-center gap-1" style={{ color: "#A7773F" }}>
          Show all <ChevronDown className="w-3.5 h-3.5" />
        </span>
      </button>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <button onClick={() => setExpanded(false)} className="w-full flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Sparkles className="w-[15px] h-[15px]" style={{ color: "#A7773F" }} />
          <h2 className="font-heading text-[17px] text-foreground">Travel Assistant</h2>
        </div>
        <ChevronDown className="w-4 h-4 text-muted-foreground rotate-180" />
      </button>
      <p className="font-body text-[12px] text-muted-foreground mb-3">A few things worth a look</p>

      <div className="space-y-0">
        {insights.map((ins, i) => {
          const Icon = ICONS[ins.icon] || Sparkles;
          const tint = ["#A7773F", "#7D8A53", "#A77C81"][i % 3];
          return (
            <div key={i} className={`flex gap-2.5 py-2.5 ${i > 0 ? "border-t border-border/60" : ""}`}>
              <span
                className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${tint}1F` }}
              >
                <Icon className="w-4 h-4" style={{ color: tint }} strokeWidth={1.8} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-body text-[13px] text-foreground leading-snug">{ins.message}</p>
                {ins.action_label && ins.action_tab && (
                  <button
                    onClick={() => onNavigate(ins.action_tab)}
                    className="font-body text-[11.5px] font-semibold mt-1"
                    style={{ color: "#A7773F" }}
                  >
                    {ins.action_label} →
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
