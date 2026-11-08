import { useState, useEffect, useMemo, useRef } from "react";
import { ent } from "@/lib/freshEntities";
import { toast } from "sonner";
import { RefreshCw, AlertCircle } from "lucide-react";
import PackingProgress from "./packing/PackingProgress";
import WeatherSummary from "./packing/WeatherSummary";
import PackingCategories from "./packing/PackingCategories";
import CategorySheet from "./packing/CategorySheet";
import BuildPackingSheet from "./packing/BuildPackingSheet";
import { fetchWeather, generatePackingList, computeSignature, getCachedWeather, setCachedWeather } from "@/lib/packingAi";

export default function PackingTab({ trip, onUpdate }) {
  const [items, setItems] = useState(trip.packing_items || []);
  const [meta, setMeta] = useState(trip.packing_meta || null);
  const [weather, setWeather] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [buildOpen, setBuildOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  const [openWithAdd, setOpenWithAdd] = useState(false);
  // Latest list + a save queue, so quick taps (checking off several items in a row)
  // never overwrite each other and the checkbox responds instantly.
  const itemsRef = useRef(trip.packing_items || []);
  const queueRef = useRef(Promise.resolve());

  useEffect(() => {
    itemsRef.current = trip.packing_items || [];
    setItems(trip.packing_items || []);
    setMeta(trip.packing_meta || null);
  }, [trip.packing_items, trip.packing_meta]);

  const currentSig = useMemo(() => computeSignature(trip), [trip]);
  const hasList = items.length > 0;
  const needsUpdate = hasList && meta?.signature && meta.signature !== currentSig;

  // Fetch weather — shared cache in packingAi.js, so Know Before You Go (which
  // shows the same forecast) reuses this instead of making its own AI call.
  useEffect(() => {
    const cities = trip.cities || [];
    if (cities.length === 0) { setWeather([]); setLoadingWeather(false); return; }
    const cached = getCachedWeather(trip);
    if (cached) {
      setWeather(cached);
      setLoadingWeather(false);
      return;
    }
    let alive = true;
    setLoadingWeather(true);
    fetchWeather(trip)
      .then((w) => {
        if (!alive) return;
        setCachedWeather(trip, w);
        setWeather(w);
        setLoadingWeather(false);
      })
      .catch(() => { if (alive) { setWeather([]); setLoadingWeather(false); } });
    return () => { alive = false; };
  }, [trip.id, (trip.cities || []).join(","), trip.start_date, trip.end_date, (trip.itinerary || []).map((d) => `${d.date || ""}:${(d.activities || []).length}`).join(";")]);


  const persist = (packingItems, packingMeta) => {
    itemsRef.current = packingItems;
    setItems(packingItems);
    if (packingMeta !== undefined) setMeta(packingMeta);
    const updateData = { packing_items: packingItems };
    if (packingMeta !== undefined) updateData.packing_meta = packingMeta;
    queueRef.current = queueRef.current
      .then(() => ent.Trip.update(trip.id, updateData))
      .then((updated) => { if (updated) onUpdate(updated); })
      .catch((err) => {
        console.error("Packing save failed:", err);
        toast.error("Couldn't save that change. Check your connection and try again.");
      });
    return queueRef.current;
  };

  const runGenerate = async (prefs) => {
    setGenerating(true);
    try {
      const generated = await generatePackingList(trip, prefs);
      // Preserve packed state for items that still exist (match by name); keep user-added items.
      const existingByName = new Map((trip.packing_items || []).map((i) => [i.name.toLowerCase(), i]));
      const merged = generated.map((it) => {
        const ex = existingByName.get(it.name.toLowerCase());
        return ex ? { ...it, packed: ex.packed } : it;
      });
      const newNames = new Set(merged.map((i) => i.name.toLowerCase()));
      const userKept = (trip.packing_items || []).filter(
        (i) => (i.source === "user") && !newNames.has((i.name || "").toLowerCase())
      );
      const all = [...merged, ...userKept];
      const newMeta = {
        signature: computeSignature(trip),
        generated_at: new Date().toISOString(),
        style: prefs.style,
        laundry: prefs.laundry,
        luggage: prefs.luggage,
      };
      await persist(all, newMeta);
      setBuildOpen(false);
      toast.success("Packing list ready");
    } catch (err) {
      console.error(err);
      toast.error(`Couldn't build your packing list${err?.message ? ": " + String(err.message).slice(0, 140) : ""}`);
    }
    setGenerating(false);
  };

  const handleBuild = () => {
    if (hasList) {
      // Existing list → update using stored prefs (or defaults)
      const prefs = {
        style: meta?.style || "standard",
        laundry: meta?.laundry || "no",
        luggage: meta?.luggage || "checked",
      };
      runGenerate(prefs);
    } else {
      setBuildOpen(true);
    }
  };

  const toggleItem = (index) => {
    const updated = itemsRef.current.map((it, i) => (i === index ? { ...it, packed: !it.packed } : it));
    return persist(updated);
  };

  const removeItem = (index) => {
    const updated = itemsRef.current.filter((_, i) => i !== index);
    return persist(updated);
  };

  const addCustomItem = (item) =>
    persist([...itemsRef.current, { ...item, packed: false, source: "user", quantity: item.quantity || 1 }]);

  const packed = items.filter((i) => i.packed).length;

  return (
    <div className="space-y-4">
      <PackingProgress
        packed={packed}
        total={items.length}
        hasList={hasList}
        generating={generating}
        onBuild={handleBuild}
      />

      {needsUpdate && (
        <div className="flex items-center gap-2 bg-[#F0E6D6] border border-[#A7773F]/30 rounded-xl px-3 py-2.5">
          <AlertCircle className="w-4 h-4 text-[#8B6B3E] flex-shrink-0" />
          <p className="flex-1 font-body text-[12px] text-foreground">
            Your trip has changed. Update your packing list?
          </p>
          <button
            onClick={handleBuild}
            disabled={generating}
            className="inline-flex items-center gap-1 px-2.5 h-7 rounded-full bg-[#A7773F] text-white font-body text-[11px] font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            <RefreshCw className={`w-3 h-3 ${generating ? "animate-spin" : ""}`} /> Update
          </button>
        </div>
      )}

      <WeatherSummary
        cities={weather || (trip.cities || []).map((c) => ({ city: c }))}
        loading={loadingWeather}
        forecastUrl={
          trip.cities?.[0]
            ? `https://www.google.com/search?q=${encodeURIComponent(trip.cities[0] + " weather")}`
            : trip.country
              ? `https://www.google.com/search?q=${encodeURIComponent(trip.country + " weather")}`
              : null
        }
      />

      <PackingCategories
        items={items}
        onOpenCategory={(id) => { setOpenWithAdd(false); setActiveCategory(id); }}
        onAddCustom={() => { setOpenWithAdd(true); setActiveCategory("misc"); }}
      />

      {activeCategory && (
        <CategorySheet
          categoryId={activeCategory}
          startAdding={openWithAdd}
          items={items}
          onClose={() => setActiveCategory(null)}
          onToggle={toggleItem}
          onRemove={removeItem}
          onAddItem={addCustomItem}
        />
      )}

      <BuildPackingSheet
        open={buildOpen}
        onClose={() => setBuildOpen(false)}
        onBuild={runGenerate}
        generating={generating}
      />
    </div>
  );
}