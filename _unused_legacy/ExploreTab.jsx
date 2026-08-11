import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { COLLECTIONS } from "./exploreCollections";
import { generateCollections, generateHappeningAndKnow, generateCollectionPicks, getCachedExplore, setCachedExplore, getCachedImage, setCachedImage } from "@/lib/exploreAi";
import CitySelector from "./CitySelector";
import FeaturedHappening from "./FeaturedHappening";
import ExploreCollection from "./ExploreCollection";
import PlaceSheet from "./PlaceSheet";
import KnowBeforeYouGo from "./KnowBeforeYouGo";
import ExploreAssistantFooter from "./ExploreAssistantFooter";

export default function ExploreTab({ trip, onUpdate, cityOrder }) {
  const cities = cityOrder && cityOrder.length ? cityOrder : (trip.cities || []);
  const [city, setCity] = useState(cities[0] || "");
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imgUrl, setImgUrl] = useState(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(null);
  const [activePick, setActivePick] = useState(null);

  useEffect(() => {
    if (!city) return;
    let alive = true;
    const cached = getCachedExplore(trip.id, city);
    if (cached) { setContent(cached); setLoading(false); return; }
    setLoading(true);
    setContent(null);
    setImgUrl(null);
    let parts = {};
    const arrive = (patch) => {
      if (!alive) return;
      parts = { ...parts, ...patch };
      setContent((prev) => ({ ...prev, ...patch }));
      if ("collections" in patch) setLoading(false);
    };
    const cP = generateCollections(trip, city).then((r) => arrive({ collections: r.collections })).catch(() => {});
    const hkP = generateHappeningAndKnow(trip, city).then((r) => arrive({ happening: r.happening, know: r.know })).catch(() => {});
    Promise.all([cP, hkP]).then(() => {
      if (alive && parts.collections && parts.happening !== undefined && parts.know !== undefined) {
        setCachedExplore(trip.id, city, parts);
      }
    });
    return () => { alive = false; };
  }, [trip.id, city]);

  useEffect(() => {
    if (!content?.happening) return;
    let alive = true;
    const cachedImg = getCachedImage(trip.id, city);
    if (cachedImg) { setImgUrl(cachedImg); setImgLoading(false); return; }
    setImgLoading(true);
    setImgUrl(null);
    const prompt = `Luxury editorial travel magazine photograph of ${city}: ${content.happening.title}. Warm golden-hour light, premium editorial composition, no text, no people, no watermark, landscape orientation, high quality.`;
    base44.integrations.Core.GenerateImage({ prompt })
      .then(({ url }) => { if (alive) { setImgUrl(url); setImgLoading(false); setCachedImage(trip.id, city, url); } })
      .catch(() => { if (alive) { setImgLoading(false); } });
    return () => { alive = false; };
  }, [city, content?.happening?.title]);

  const refreshCollection = async (collectionId) => {
    const col = (content?.collections || []).find((c) => c.id === collectionId);
    if (!col) return;
    setRefreshing(collectionId);
    try {
      const res = await generateCollectionPicks(trip, city, collectionId, (col.picks || []).map((p) => p.name));
      setContent((prev) => ({
        ...prev,
        collections: (prev.collections || []).map((c) => (c.id === collectionId ? { ...c, picks: res.picks } : c)),
      }));
    } catch {} finally {
      setRefreshing(null);
    }
  };

  const addActivity = async (pick) => {
    const it = trip.itinerary || [];
    const activity = { time: "", activity: pick.name, location: pick.neighborhood || "", notes: pick.description || "" };
    let updated;
    if (it.length === 0) {
      updated = await base44.entities.Trip.update(trip.id, {
        itinerary: [{ day: 1, date: trip.start_date || "", title: "", description: "", activities: [activity] }],
      });
    } else {
      const first = it[0];
      const activities = [...(first.activities || []), activity];
      const newIt = it.map((d, i) => (i === 0 ? { ...d, activities } : d));
      updated = await base44.entities.Trip.update(trip.id, { itinerary: newIt });
    }
    onUpdate(updated);
    setActivePick(null);
  };

  return (
    <div className="space-y-3">
      <CitySelector cities={cities} value={city} onChange={setCity} />

      <FeaturedHappening
        city={city}
        happening={content?.happening}
        imgUrl={imgUrl}
        imgLoading={imgLoading}
        loading={loading}
      />

      <h2 className="font-heading text-[22px] text-foreground font-semibold leading-tight">Explore {city}</h2>

      <div className="divide-y divide-border/50">
        {loading ? (
          COLLECTIONS.map((c) => <ExploreCollection key={c.id} config={c} loading />)
        ) : (
          (content?.collections || []).map((c) => {
            const config = COLLECTIONS.find((x) => x.id === c.id) || COLLECTIONS[0];
            return (
              <ExploreCollection
                key={c.id}
                config={config}
                picks={c.picks}
                refreshing={refreshing === c.id}
                onRefresh={() => refreshCollection(c.id)}
                onPick={(p) => setActivePick({ pick: p, config })}
              />
            );
          })
        )}
      </div>

      <KnowBeforeYouGo know={content?.know} loading={loading} />

      <ExploreAssistantFooter trip={trip} />

      {activePick && (
        <PlaceSheet
          pick={activePick.pick}
          config={activePick.config}
          city={city}
          onClose={() => setActivePick(null)}
          onAddToItinerary={() => addActivity(activePick.pick)}
        />
      )}
    </div>
  );
}