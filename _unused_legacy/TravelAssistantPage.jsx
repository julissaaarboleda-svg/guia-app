import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import InsightCard from "@/components/journeys/InsightCard";
import { generateTravelAssistantInsights } from "@/lib/journeyAi";
import {
  ChevronLeft, MoreVertical, Sparkles, Mic, Bookmark, RefreshCw,
  CloudRain, CalendarRange, Wallet, Backpack, UtensilsCrossed, AlertTriangle,
} from "lucide-react";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "Planning", label: "Planning" },
  { id: "Weather", label: "Weather" },
  { id: "Budget", label: "Budget" },
  { id: "Packing", label: "Packing" },
  { id: "Discover", label: "Discover" },
  { id: "Travel Alerts", label: "Travel Alerts" },
];

function greetingPrefix() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function buildComputedInsights(trip) {
  const totalSpent = (trip.expense_items || []).reduce((s, e) => s + (e.amount || 0), 0);
  const budgetPct = trip.budget_target ? Math.round((totalSpent / trip.budget_target) * 100) : null;

  const packing = trip.packing_items || [];
  const packingRemaining = packing.filter((p) => !p.packed).length;

  const itinerary = trip.itinerary || [];
  const daysNeedingActivities = itinerary.filter((d) => !d.activities || d.activities.length === 0).length;

  return [
    {
      id: "planning",
      category: "Planning",
      icon: CalendarRange,
      headline:
        daysNeedingActivities > 0
          ? `${daysNeedingActivities} day${daysNeedingActivities > 1 ? "s" : ""} need activities`
          : "Itinerary is filling up nicely",
      detail:
        daysNeedingActivities > 0
          ? "Add activities to round out your itinerary before you go."
          : "Your itinerary is well planned and ready.",
      actionLabel: "Open Itinerary",
      actionTab: "Itinerary",
      timestamp: "4h ago",
    },
    {
      id: "budget",
      category: "Budget",
      icon: Wallet,
      headline: budgetPct !== null ? (budgetPct < 80 ? "You're still under budget" : "Budget is tightening") : "Set a budget target",
      detail:
        budgetPct !== null
          ? `You're currently using ${budgetPct}% of your planned budget.`
          : "Add a budget target to start tracking your spending.",
      actionLabel: "Open Budget",
      actionTab: "Budget",
      timestamp: "6h ago",
    },
    {
      id: "packing",
      category: "Packing",
      icon: Backpack,
      headline: packingRemaining > 0 ? `Pack ${packingRemaining} more item${packingRemaining > 1 ? "s" : ""}` : "Packing list complete",
      detail:
        packingRemaining > 0
          ? "Evening temperatures may be cooler than expected — don't forget layers."
          : "Everything is packed and ready for your trip.",
      actionLabel: "Open Packing",
      actionTab: "Packing",
      timestamp: "Yesterday",
    },
  ];
}

function buildAIInsight(id, data, loading, icon, category, actionLabel, actionTab, timestamp) {
  if (loading && !data) {
    return { id, category, icon, headline: null, detail: null, actionLabel, actionTab, timestamp, loading: true, links: [] };
  }
  if (!data) return null;
  return {
    id,
    category,
    icon,
    headline: data.headline,
    detail: data.detail,
    actionLabel,
    actionTab,
    timestamp,
    links: data.links || [],
  };
}

export default function TravelAssistantPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [user, setUser] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [bookmarked, setBookmarked] = useState({});
  const [loading, setLoading] = useState(true);
  const [aiData, setAiData] = useState(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
      } catch {}
      if (tripId) {
        try {
          const t = await base44.entities.Trip.get(tripId);
          setTrip(t);
        } catch {
          setTrip(null);
        }
      }
      setLoading(false);
    };
    load();
  }, [tripId]);

  useEffect(() => {
    if (!trip) return;
    let alive = true;
    setAiLoading(true);
    generateTravelAssistantInsights(trip, effectiveCity)
      .then((res) => { if (alive) { setAiData(res); setAiLoading(false); } })
      .catch(() => { if (alive) { setAiData(null); setAiLoading(false); } });
    return () => { alive = false; };
  }, [trip, selectedCity]);

  const cities = trip?.cities || [];
  const showCitySelector = cities.length > 1;
  const effectiveCity = selectedCity || cities[0] || null;

  const computed = trip ? buildComputedInsights(trip) : [];
  const insights = trip ? [
    buildAIInsight("weather", aiData?.weather, aiLoading, CloudRain, "Weather", "Open Packing", "Packing", "2h ago"),
    computed.find((c) => c.id === "planning"),
    computed.find((c) => c.id === "budget"),
    computed.find((c) => c.id === "packing"),
    buildAIInsight("discover", aiData?.discover, aiLoading, UtensilsCrossed, "Discover", "Save to Saved Places", "About", "Yesterday"),
    buildAIInsight("alerts", aiData?.alerts, aiLoading, AlertTriangle, "Travel Alerts", "View Details", "About", "2 days ago"),
  ].filter(Boolean) : [];
  const filtered = activeFilter === "all" ? insights : insights.filter((i) => i.category === activeFilter);

  const goBack = () => navigate("/travel");

  const handleAction = (tab) => {
    if (trip) navigate(`/travel?openTrip=${trip.id}&tab=${encodeURIComponent(tab)}`);
    else navigate("/travel");
  };

  const toggleBookmark = (id) => {
    setBookmarked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const rawName = user?.full_name || user?.email || "";
  const firstName = rawName
    ? rawName.split("@")[0].split(/[._-]/)[0].replace(/\b\w/g, (c) => c.toUpperCase())
    : "there";

  return (
    <div className="max-w-[900px] mx-auto w-full min-h-screen flex flex-col">
      {/* Top navigation */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm px-6 md:px-10 lg:px-14 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <button
            onClick={goBack}
            className="w-9 h-9 flex items-center justify-center rounded-full text-foreground hover:bg-secondary transition-colors"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5" strokeWidth={1.8} />
          </button>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-accent" strokeWidth={1.6} />
            <h1 className="font-heading text-[18px] text-foreground font-semibold leading-tight">Travel Assistant</h1>
          </div>
          <button
            onClick={goBack}
            className="w-9 h-9 flex items-center justify-center rounded-full text-foreground hover:bg-secondary transition-colors"
            aria-label="More"
          >
            <MoreVertical className="w-5 h-5" strokeWidth={1.6} />
          </button>
        </div>
      </div>

      <div className="px-6 md:px-10 lg:px-14 pb-10 flex-1 flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-7 h-7 border-2 border-secondary border-t-accent rounded-full animate-spin" />
          </div>
        ) : !trip ? (
          <div className="text-center py-20">
            <p className="font-body text-[14px] text-muted-foreground">No journey found for this assistant view.</p>
            <button onClick={goBack} className="mt-4 font-body text-[13px] text-accent font-medium">Back to Journeys →</button>
          </div>
        ) : (
          <>
            {/* Greeting */}
            <div className="pt-2 pb-5">
              <p className="font-heading text-[22px] text-foreground font-semibold leading-tight">{greetingPrefix()}, {firstName}.</p>
              <p className="font-body text-[13px] text-muted-foreground mt-1 leading-snug">
                Here's what needs your attention before your trip.
              </p>
            </div>

            {/* City selector for multi-city trips */}
            {showCitySelector && (
              <div className="mb-4">
                <p className="font-body text-[11px] text-muted-foreground uppercase tracking-[0.12em] mb-2">Focus city</p>
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
                  {cities.map((city) => (
                    <button
                      key={city}
                      onClick={() => setSelectedCity(city)}
                      className={`px-3.5 py-1.5 rounded-full font-body text-[12px] font-medium whitespace-nowrap transition-colors border ${
                        (selectedCity || cities[0]) === city
                          ? "bg-foreground text-background border-foreground"
                          : "bg-transparent text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
                      }`}
                    >
                      {city}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Ask Travel Assistant — visual only */}
            <div className="relative mb-5">
              <div className="flex items-center gap-2.5 w-full bg-card border border-border rounded-full px-4 py-3">
                <Sparkles className="w-4 h-4 text-muted-foreground flex-shrink-0" strokeWidth={1.6} />
                <input
                  type="text"
                  placeholder="Ask Travel Assistant..."
                  className="flex-1 bg-transparent outline-none font-body text-[14px] text-foreground placeholder:text-muted-foreground"
                  onFocus={(e) => e.target.blur()}
                  readOnly
                />
                <Mic className="w-4 h-4 text-muted-foreground flex-shrink-0" strokeWidth={1.6} />
              </div>
            </div>

            {/* Filter chips */}
            <div className="-mx-6 md:-mx-10 lg:-mx-14 px-6 md:px-10 lg:px-14 mb-5 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-2 w-max">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setActiveFilter(f.id)}
                    className={`px-3.5 py-1.5 rounded-full font-body text-[12px] font-medium whitespace-nowrap transition-colors border ${
                      activeFilter === f.id
                        ? "bg-foreground text-background border-foreground"
                        : "bg-transparent text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Insight cards */}
            <div className="flex flex-col gap-3 flex-1">
              {filtered.length > 0 ? (
                filtered.map((ins) => (
                  <InsightCard
                    key={ins.id}
                    insight={ins}
                    onAction={() => handleAction(ins.actionTab)}
                    bookmarked={bookmarked[ins.id]}
                    onBookmark={toggleBookmark}
                  />
                ))
              ) : (
                <div className="text-center py-12">
                  <p className="font-body text-[13px] text-muted-foreground">No insights in this category yet.</p>
                </div>
              )}
            </div>

            {/* Footer status */}
            <div className="mt-8 pt-5 border-t border-border/60">
              <div className="flex items-start gap-2.5">
                <Sparkles className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" strokeWidth={1.6} />
                <p className="font-body text-[11px] text-muted-foreground leading-relaxed flex-1">
                  Insights automatically update as your itinerary, budget, bookings, weather and travel plans change.
                </p>
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="font-body text-[10px] text-muted-foreground">Last updated just now</span>
                <button className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Refresh">
                  <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.6} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}