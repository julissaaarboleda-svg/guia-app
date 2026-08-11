import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Sparkles, MapPin } from "lucide-react";
import { parseISO, format } from "date-fns";
import CitySelector from "../CitySelector";
import TopPicksCarousel from "./TopPicksCarousel";
import WishlistSection from "./WishlistSection";
import AddOwnItem from "./AddOwnItem";

import ManualItemModal from "./ManualItemModal";
import ActivityModal from "../ActivityModal";
import PillDropdown from "./PillDropdown";
import { generateTopPicks, generatePickImage, getCachedTopPicks, setCachedTopPicks, getCacheAge, STALE_MS } from "@/lib/savedAi";
import { categoryMeta, CATEGORY_CHIPS, PRICE_OPTIONS } from "./categoryMeta";
import { savePlaceToMemories } from "@/lib/memoryUtils";

export default function SavedTab({ trip, onUpdate, cityOrder }) {
  const cities = cityOrder && cityOrder.length ? cityOrder : (trip.cities || []);
  const [city, setCity] = useState(cities[0] || "");
  const [picks, setPicks] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const [category, setCategory] = useState("all");
  const [price, setPrice] = useState("all");
  const [nearItin, setNearItin] = useState(false);
  const [itinModal, setItinModal] = useState({ open: false, item: null });

  useEffect(() => {
    if (!city) return;
    let alive = true;
    setCategory("all"); setPrice("all"); setFailed(false);
    const cached = getCachedTopPicks(trip.id, city);
    // Stale-while-revalidate: show cached picks instantly, refresh silently if stale.
    if (cached && cached.length) {
      setPicks(cached);
      setLoading(false);
      if (getCacheAge(trip.id, city) > STALE_MS) {
        generateTopPicks(trip, city)
          .then((res) => { if (!alive) return; const list = res?.picks || []; if (list.length) { setPicks(list); setCachedTopPicks(trip.id, city, list); } })
          .catch(() => {});
      }
      return () => { alive = false; };
    }
    setLoading(true); setPicks(null);
    generateTopPicks(trip, city)
      .then((res) => { if (!alive) return; const list = res?.picks || []; setPicks(list); setLoading(false); setFailed(!list.length); if (list.length) setCachedTopPicks(trip.id, city, list); })
      .catch(() => { if (alive) { setPicks(null); setLoading(false); setFailed(true); } });
    return () => { alive = false; };
  }, [trip.id, city]);

  const refreshPicks = async () => {
    setRefreshing(true); setFailed(false);
    try { const res = await generateTopPicks(trip, city); const list = res?.picks || []; setPicks(list); setFailed(!list.length); if (list.length) setCachedTopPicks(trip.id, city, list); }
    catch { setFailed(true); } finally { setRefreshing(false); }
  };

  const wishItems = trip.wish_list?.items || [];
  const cityItems = wishItems.filter((i) => !i.city || i.city === city);
  const savedNames = new Set(cityItems.map((i) => (i.name || "").toLowerCase()));
  const isSaved = (pick) => savedNames.has((pick.name || "").toLowerCase());

  const persistWish = async (items) => {
    const updated = await base44.entities.Trip.update(trip.id, { wish_list: { ...(trip.wish_list || {}), items } });
    onUpdate(updated);
  };
  const addToWishlist = (pick) => {
    if (isSaved(pick)) return;
    const meta = categoryMeta(pick.category);
    persistWish([...wishItems, {
      id: (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()),
      name: pick.name, category: pick.category, categoryLabel: meta.label,
      description: pick.description || "", image: pick.image || "", rating: pick.rating,
      reviewCount: pick.reviewCount, city, neighborhood: pick.neighborhood || "",
      price: pick.price || "", website: pick.website || "", aiBadge: pick.aiBadge || "",
    }]);
    toast.success("Saved to wishlist");
  };
  const removeFromWishlist = (id) => persistWish(wishItems.filter((i) => i.id !== id));
  const addToMemories = async (it) => {
    const res = await savePlaceToMemories(trip, {
      name: it.name, category: it.category, source: "wishlist", source_ref: it.id,
      city: it.city, image: it.image, rating: it.rating, notes: it.description || "",
    });
    if (res.added) { onUpdate(res.trip); toast.success("Saved to memories"); }
    else toast("Already in memories");
  };
  const addOwnItem = async (item) => {
    const id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now());
    let image = "";
    try {
      image = await generatePickImage(trip.id, item.city || city, item.name, `Editorial travel photograph of ${item.name} in ${item.city || city}, warm golden light, premium editorial composition, no text, no people, no watermark.`);
    } catch {}
    persistWish([...wishItems, { ...item, id, image: item.image || image, city: item.city || city }]);
    setManualOpen(false); toast.success("Added to wishlist");
  };
  const dayOptions = useMemo(
    () => (trip.itinerary || []).map((d) => ({ date: d.date || "", label: d.date ? format(parseISO(d.date), "EEE, MMM d") : `Day ${d.day}` })),
    [trip.itinerary]
  );

  const openItinModal = (item) => setItinModal({ open: true, item });

  const saveItinActivity = async (activity) => {
    const item = itinModal.item;
    const it = trip.itinerary || [];
    const { dayDate, ...rest } = activity;
    let updated;
    if (it.length === 0) {
      updated = await base44.entities.Trip.update(trip.id, { itinerary: [{ day: 1, date: dayDate || trip.start_date || "", title: "", description: "", activities: [rest] }] });
    } else {
      let idx = it.findIndex((d) => d.date && d.date === dayDate);
      if (idx < 0) idx = 0;
      updated = await base44.entities.Trip.update(trip.id, {
        itinerary: it.map((d, i) => (i === idx ? { ...d, activities: [...(d.activities || []), rest].sort((a, b) => (a.time || "99").localeCompare(b.time || "99")) } : d)),
      });
    }
    onUpdate(updated);
    setItinModal({ open: false, item: null });
    toast.success("Added to itinerary");
  };

  const itineraryLocations = useMemo(() => {
    const set = new Set();
    (trip.itinerary || []).forEach((d) => (d.activities || []).forEach((a) => {
      if (a.location) set.add(a.location.toLowerCase());
      if (a.name) set.add(a.name.toLowerCase());
    }));
    return set;
  }, [trip.itinerary]);

  const filteredPicks = useMemo(() => {
    if (!picks) return picks;
    let list = picks;
    if (category !== "all") list = list.filter((p) => (p.category || "").toLowerCase() === category);
    if (price !== "all") list = list.filter((p) => (p.price || "").length === price.length);
    if (nearItin) {
      list = [...list].sort((a, b) => {
        const am = itineraryLocations.has((a.name || "").toLowerCase()) || itineraryLocations.has((a.neighborhood || "").toLowerCase()) ? 0 : 1;
        const bm = itineraryLocations.has((b.name || "").toLowerCase()) || itineraryLocations.has((b.neighborhood || "").toLowerCase()) ? 0 : 1;
        return am - bm;
      });
    }
    return list;
  }, [picks, category, price, nearItin, itineraryLocations]);

  const filteredWish = useMemo(() => {
    if (category === "all") return cityItems;
    return cityItems.filter((i) => (i.category || "").toLowerCase() === category);
  }, [cityItems, category]);

  return (
    <div className="space-y-5 pt-1">
      <div>
        <CitySelector cities={cities} value={city} onChange={setCity} />
        <p className="font-body text-[12px] text-muted-foreground mt-2">Personalized picks for your trip.</p>
      </div>

      {/* AI Controls */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={refreshPicks}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-1 bg-card border border-border rounded-full px-2.5 h-6 font-body text-[10px] leading-none whitespace-nowrap text-foreground hover:border-foreground/25 transition-colors disabled:opacity-50"
        >
          <Sparkles className={`w-3 h-3 text-accent ${refreshing ? "animate-pulse" : ""}`} />
          {refreshing ? "Refreshing…" : "Refresh Picks"}
        </button>
        <PillDropdown label="Category " value={category} onChange={setCategory} options={CATEGORY_CHIPS} />
        <PillDropdown label="Price " value={price} onChange={setPrice} options={PRICE_OPTIONS} />
        <button
          onClick={() => setNearItin((v) => !v)}
          className={`ml-auto inline-flex items-center gap-1 rounded-full px-2.5 h-6 font-body text-[10px] leading-none whitespace-nowrap border transition-colors ${nearItin ? "bg-accent text-accent-foreground border-accent" : "bg-card text-foreground border-border hover:border-foreground/25"}`}
        >
          <MapPin className="w-3 h-3" strokeWidth={1.8} />
          Near itinerary
          <span className={`inline-flex w-6 h-3.5 rounded-full p-0.5 transition-colors ${nearItin ? "bg-accent-foreground/30" : "bg-muted"}`}>
            <span className={`w-2.5 h-2.5 rounded-full bg-card transition-transform ${nearItin ? "translate-x-2.5" : ""}`} />
          </span>
        </button>
      </div>

      <TopPicksCarousel
        trip={trip}
        city={city}
        picks={filteredPicks}
        loading={loading}
        refreshing={refreshing}
        failed={failed}
        onRefresh={refreshPicks}
        onWishlist={addToWishlist}
        isSaved={isSaved}
      />

      <WishlistSection
        items={filteredWish}
        city={city}
        empty={cityItems.length === 0}
        onRemove={removeFromWishlist}
        onAddToItinerary={openItinModal}
        onAddOwn={() => setManualOpen(true)}
        onAddToMemories={addToMemories}
      />

      {manualOpen && (
        <ManualItemModal city={city} onClose={() => setManualOpen(false)} onAdd={addOwnItem} />
      )}

      {itinModal.open && (
        <ActivityModal
          open={itinModal.open}
          initialActivity={{
            name: itinModal.item?.name || "",
            activity: itinModal.item ? (itinModal.item.categoryLabel || categoryMeta(itinModal.item.category).label || "Activity") : "",
            location: itinModal.item ? (itinModal.item.city || city) : "",
            notes: itinModal.item?.description || "",
            link: itinModal.item?.website || "",
          }}
          tripLocations={[...(trip.cities || []), trip.country].filter(Boolean)}
          dayOptions={dayOptions}
          itinerary={trip.itinerary}
          onSave={saveItinActivity}
          onClose={() => setItinModal({ open: false, item: null })}
        />
      )}
    </div>
  );
}