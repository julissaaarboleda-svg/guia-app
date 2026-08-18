import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import TripDetail from "@/components/travel/TripDetail";
import JourneyHero from "@/components/journeys/JourneyHero";
import JourneyCard from "@/components/journeys/JourneyCard";
import JourneyProgress from "@/components/journeys/JourneyProgress";
import TravelAssistant from "@/components/journeys/TravelAssistant";
import UpcomingEvent from "@/components/journeys/UpcomingEvent";
import PastJourneyCard from "@/components/journeys/PastJourneyCard";
import NewJourneySheet from "@/components/journeys/NewJourneySheet";
import CoverCustomizer from "@/components/journeys/CoverCustomizer";
import KnowBeforeYouGo from "@/components/travel/KnowBeforeYouGo";
import { Plus, Search, Plane } from "lucide-react";
import { parseISO } from "date-fns";
import { computePlanningProgress, generateCover } from "@/lib/journeyAi";
import { generateHappeningAndKnow, getCachedExplore, setCachedExplore } from "@/lib/exploreAi";

export default function Travel() {
  const [trips, setTrips] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedTab, setSelectedTab] = useState("Overview");
  const [autoEditTrip, setAutoEditTrip] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showCover, setShowCover] = useState(null);
  const [generatingFor, setGeneratingFor] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [viewTab, setViewTab] = useState("current");
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [knowData, setKnowData] = useState(null);
  const [knowLoading, setKnowLoading] = useState(false);

  const load = async () => {
    const data = await base44.entities.Trip.list("-start_date");
    setTrips(data);
    setLoading(false);
    const now = new Date();
    const toComplete = data.filter((t) => t.status !== "completed" && t.end_date && new Date(t.end_date + "T23:59:59") < now);
    if (toComplete.length > 0) {
      Promise.all(toComplete.map((t) => base44.entities.Trip.update(t.id, { status: "completed" })))
        .then(() => load())
        .catch(() => {});
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Deep-link: open a specific trip + tab via query params (from Travel Assistant)
  useEffect(() => {
    if (!trips.length) return;
    const openTripId = searchParams.get("openTrip");
    const openTab = searchParams.get("tab");
    if (openTripId) {
      const t = trips.find((tr) => tr.id === openTripId);
      if (t) {
        setSelected(t);
        if (openTab) setSelectedTab(openTab);
        searchParams.delete("openTrip");
        searchParams.delete("tab");
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [trips, searchParams]);

  const createJourney = async (formData) => {
    const created = await base44.entities.Trip.create({
      ...formData,
      description: "",
      flag_emoji: "",
    });
    setShowAdd(false);
    await load();
    generateCoverForTrip(created, "editorial");
  };

  const generateCoverForTrip = async (trip, styleId) => {
    setGeneratingFor(trip.id);
    try {
      const url = await generateCover(trip, styleId);
      const updated = await base44.entities.Trip.update(trip.id, { hero_image_url: url });
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      if (selected?.id === updated.id) setSelected(updated);
      if (showCover?.id === updated.id) setShowCover(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setGeneratingFor(null);
    }
  };

  const openTrip = (trip, tab = "Itinerary") => {
    setSelected(trip);
    setSelectedTab(tab);
  };

  const editTrip = (trip) => {
    setSelected(trip);
    setSelectedTab("Itinerary");
    setAutoEditTrip(true);
  };

  // Fetch "Know Before You Go" for the current journey's first city.
  useEffect(() => {
    if (!trips.length) { setKnowData(null); return; }
    const now = new Date();
    const active = trips.filter((t) => t.status !== "completed");
    const inProgress = active.find((t) => {
      const s = t.start_date && parseISO(t.start_date);
      const e = t.end_date && parseISO(t.end_date);
      return s && e && now >= s && now <= e;
    });
    const upcomingSorted = active
      .filter((t) => t.start_date && parseISO(t.start_date) >= now)
      .sort((a, b) => parseISO(a.start_date) - parseISO(b.start_date));
    const cur = inProgress || upcomingSorted[0] || active[0] || null;
    if (!cur) { setKnowData(null); return; }
    let alive = true;
    const city = (cur.cities || [])[0] || cur.country || "";
    if (!city) { setKnowData(null); return; }
    const cached = getCachedExplore(cur.id, city);
    if (cached?.know) { setKnowData(cached.know); setKnowLoading(false); return; }
    setKnowLoading(true); setKnowData(null);
    generateHappeningAndKnow(cur, city)
      .then((r) => { if (!alive) return; setKnowData(r?.know || null); setKnowLoading(false); if (r?.know) setCachedExplore(cur.id, city, { know: r.know }); })
      .catch(() => { if (alive) setKnowLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trips]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-stone-200 border-t-stone-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (selected) {
    return (
      <TripDetail
        trip={selected}
        initialTab={selectedTab}
        initialEditOpen={autoEditTrip}
        onBack={() => {
          setSelected(null);
          setAutoEditTrip(false);
          load();
        }}
        onUpdate={(updated) => setSelected(updated)}
      />
    );
  }

  const now = new Date();
  const active = trips.filter((t) => t.status !== "completed");
  const inProgress = active.find((t) => {
    const s = t.start_date && parseISO(t.start_date);
    const e = t.end_date && parseISO(t.end_date);
    return s && e && now >= s && now <= e;
  });
  const upcomingSorted = active
    .filter((t) => t.start_date && parseISO(t.start_date) >= now)
    .sort((a, b) => parseISO(a.start_date) - parseISO(b.start_date));
  const current = inProgress || upcomingSorted[0] || active[0] || null;
  const upcoming = upcomingSorted.filter((t) => t.id !== current?.id).slice(0, 6);
  const past = trips.filter((t) => t.status === "completed").slice(0, 8);

  const q = query.trim().toLowerCase();
  const matches = (t) =>
    !q ||
    t.title?.toLowerCase().includes(q) ||
    t.country?.toLowerCase().includes(q) ||
    (t.cities || []).some((c) => c.toLowerCase().includes(q));
  const searchResults = q ? trips.filter(matches) : [];

  return (
    <div className="max-w-[900px] mx-auto w-full">
      {/* Page header — sticky, sized to match every other page's header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm px-6 md:px-10 lg:px-14 pb-3 border-b border-border" style={{ paddingTop: "1rem" }}>
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-xl md:text-2xl text-foreground font-bold truncate">Journeys</h1>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSearch((s) => !s)}
              className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${showSearch ? "bg-secondary text-foreground" : "text-foreground hover:bg-secondary"}`}
            >
              <Search className="w-[18px] h-[18px]" strokeWidth={1.6} />
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-foreground text-background hover:opacity-90 transition-opacity"
            >
              <Plus className="w-[18px] h-[18px]" strokeWidth={1.8} />
            </button>
          </div>
        </div>
        {showSearch && (
          <div className="mt-3">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search journeys…"
              className="w-full bg-card border border-border rounded-xl px-4 py-2 text-[14px] text-foreground outline-none focus:border-ring transition-colors"
            />
          </div>
        )}
      </div>

      <div className="px-6 md:px-10 lg:px-14 pb-10 space-y-4">
        {trips.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
              <Plane className="w-7 h-7 text-muted-foreground" strokeWidth={1.4} />
            </div>
            <h3 className="font-heading text-xl text-foreground mb-1">Your next adventure awaits</h3>
            <p className="font-body text-[14px] text-muted-foreground max-w-xs mx-auto">
              Create your first journey and we'll compose a cover worthy of it.
            </p>
            <button onClick={() => setShowAdd(true)} className="mt-5 inline-flex items-center gap-1.5 bg-foreground text-background px-5 py-2.5 rounded-full text-[14px] font-medium hover:opacity-90 transition-opacity">
              <Plus className="w-4 h-4" /> New Journey
            </button>
          </div>
        ) : q ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {searchResults.map((trip) => (
              <JourneyCard
                key={trip.id}
                trip={trip}
                progress={computePlanningProgress(trip)}
                onOpen={() => openTrip(trip, "Itinerary")}
              />
            ))}
          </div>
        ) : (
          <>
            {/* Tab switcher */}
            <div className="flex items-center gap-6 border-b border-border">
              {["current", "upcoming"].map((t) => (
                <button
                  key={t}
                  onClick={() => setViewTab(t)}
                  className={`font-body text-[14px] pb-2.5 transition-colors capitalize border-b-2 -mb-px ${viewTab === t ? "border-accent text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  {t === "current" ? "Current Trip" : "Upcoming"}
                </button>
              ))}
            </div>

            {viewTab === "current" ? (
              current ? (
                <>
                  <JourneyHero
                    trip={current}
                    generating={generatingFor === current.id}
                    onOpen={() => openTrip(current, "Itinerary")}
                    onCustomize={() => setShowCover(current)}
                    onEditTrip={() => editTrip(current)}
                  />
                  <JourneyProgress trip={current} onNavigate={(tab) => openTrip(current, tab)} />
                  <TravelAssistant trip={current} onNavigate={(tab) => openTrip(current, tab)} />
                  <UpcomingEvent trip={current} onNavigate={(tab) => openTrip(current, tab)} />
                  <KnowBeforeYouGo trip={current} know={knowData} loading={knowLoading} />
                </>
              ) : (
                <div className="text-center py-16">
                  <p className="font-body text-[14px] text-muted-foreground">No current journey. Create one to begin planning.</p>
                </div>
              )
            ) : (
              upcoming.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {upcoming.map((trip) => (
                    <JourneyCard
                      key={trip.id}
                      trip={trip}
                      progress={computePlanningProgress(trip)}
                      onOpen={() => openTrip(trip, "Itinerary")}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <p className="font-body text-[14px] text-muted-foreground">No upcoming journeys planned.</p>
                </div>
              )
            )}

            {/* Past Journeys — always visible */}
            {past.length > 0 && (
              <section>
                <div className="flex items-end justify-between mb-3">
                  <h2 className="font-heading text-[1.2rem] text-foreground font-semibold leading-tight">Past Journeys</h2>
                  <button className="font-body text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 transition-colors">
                    View All →
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {past.map((trip) => (
                    <PastJourneyCard
                      key={trip.id}
                      trip={trip}
                      onOpen={() => openTrip(trip, "Itinerary")}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <NewJourneySheet open={showAdd} onClose={() => setShowAdd(false)} onCreate={createJourney} />
      <CoverCustomizer
        trip={showCover}
        onClose={() => setShowCover(null)}
        onUpdate={(updated) => {
          setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
          setShowCover(updated);
        }}
        onRegenerating={(isOn) => setGeneratingFor(isOn && showCover ? showCover.id : null)}
      />
    </div>
  );
}