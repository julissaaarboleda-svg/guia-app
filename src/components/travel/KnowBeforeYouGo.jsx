import { useState, useEffect } from "react";
import { Sun, DollarSign, Train, IdCard as Passport, ShieldCheck, X } from "lucide-react";
import { getTripWeather } from "@/lib/packingAi";

const CARDS = [
  { id: "weather", title: "Weather", Icon: Sun },
  { id: "currency", title: "Currency", Icon: DollarSign },
  { id: "transportation", title: "Transport", Icon: Train },
  { id: "visa", title: "Visa", Icon: Passport },
  { id: "safety", title: "Safety", Icon: ShieldCheck },
];

// NOTE: Weather used to be its own AI-generated field here (know.weather),
// separate from Packing tab's fetchWeather() — two AI calls guessing at the
// same trip's weather, sometimes with different numbers. Now this card reuses
// Packing's shared, cached forecast (getTripWeather) instead of generating its
// own. generateHappeningAndKnow() no longer asks the model for weather at all.
export default function KnowBeforeYouGo({ trip, know, loading }) {
  const [open, setOpen] = useState(null);
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  useEffect(() => {
    if (!trip) return;
    let alive = true;
    setWeatherLoading(true);
    getTripWeather(trip)
      .then((w) => { if (alive) { setWeather(w); setWeatherLoading(false); } })
      .catch(() => { if (alive) setWeatherLoading(false); });
    return () => { alive = false; };
  }, [trip?.id]);

  const item = open ? CARDS.find((c) => c.id === open) : null;
  const isWeatherOpen = item?.id === "weather";
  const data = item && !isWeatherOpen && know ? know[item.id] : null;

  const weatherSummary = weather?.[0]
    ? `${weather[0].icon || "☀"} ${weather[0].low ?? "—"}–${weather[0].high ?? "—"}° in ${weather[0].city}`
    : null;

  return (
    <section>
      <h2 className="font-heading text-base text-foreground font-semibold mb-2">Know Before You Go</h2>
      <div className="flex gap-1.5">
        {CARDS.map((c) => {
          const isWeather = c.id === "weather";
          const d = isWeather ? null : (know ? know[c.id] : null);
          const isLoading = isWeather ? weatherLoading : loading;
          const summary = isWeather ? weatherSummary : d?.summary;
          return (
            <button
              key={c.id}
              onClick={() => setOpen(c.id)}
              className="flex-1 min-w-0 bg-card border border-border rounded-[10px] p-2 flex flex-col items-center text-center hover:border-foreground/20 transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center mb-1.5">
                <c.Icon className="w-3 h-3 text-accent" strokeWidth={1.8} />
              </div>
              <p className="font-body text-[11px] text-foreground font-semibold leading-tight">{c.title}</p>
              <p className="font-body text-[10px] text-muted-foreground mt-0.5 leading-tight line-clamp-2">
                {isLoading || !summary ? "—" : summary}
              </p>
            </button>
          );
        })}
      </div>

      {item && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/45 backdrop-blur-sm"
          onClick={() => setOpen(null)}
        >
          <div
            className="bg-card border border-border rounded-t-3xl md:rounded-2xl w-full max-w-md p-5 shadow-[0_20px_50px_-28px_rgba(0,0,0,0.4)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
                  <item.Icon className="w-4 h-4 text-accent" strokeWidth={1.8} />
                </div>
                <h3 className="font-heading text-base text-foreground font-semibold">{item.title === "Transport" ? "Transportation" : item.title === "Visa" ? "Visa & Entry" : item.title}</h3>
              </div>
              <button onClick={() => setOpen(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            {isWeatherOpen ? (
              (weather || []).length > 0 ? (
                <div className="space-y-2">
                  {weather.map((w, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-foreground font-medium">{w.city}</span>
                      <span className="text-muted-foreground">{w.icon} {w.low ?? "—"}–{w.high ?? "—"}° · {w.condition || "—"}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="font-body text-sm text-muted-foreground">No forecast yet — see the Packing tab.</p>
              )
            ) : (
              <>
                <p className="font-body text-sm text-foreground font-medium mb-1">{data?.summary || "—"}</p>
                <p className="font-body text-sm text-muted-foreground leading-relaxed">{data?.detail || ""}</p>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
