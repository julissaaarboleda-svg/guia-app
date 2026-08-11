import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
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

  useEffect(() => {
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


  const persist = async (packingItems, packingMeta) => {
    const updateData = { packing_items: packingItems };
    if (packingMeta !== undefined) updateData.packing_meta = packingMeta;
    const updated = await base44.entities.Trip.update(trip.id, updateData);
    setItems(packingItems);
    if (packingMeta !== undefined) setMeta(packingMeta);
    onUpdate(updated);
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
      toast.error("Couldn't build your packing list");
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

  const toggleItem = async (index) => {
    const updated = items.map((it, i) => (i === index ? { ...it, packed: !it.packed } : it));
    await persist(updated);
  };

  const removeItem = async (index) => {
    const updated = items.filter((_, i) => i !== index);
    await persist(updated);
  };

  const addCustomItem = async (item) => {
    await persist([...items, { ...item, packed: false, source: "user", quantity: item.quantity || 1 }]);
  };

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
        <div className="flex items-center gap-2 bg-[#555B40]/10 border border-[#555B40]/30 rounded-xl px-3 py-2.5">
          <AlertCircle className="w-4 h-4 text-[#555B40] flex-shrink-0" />
          <p className="flex-1 font-body text-[12px] text-foreground">
            Your trip has changed. Update your packing list?
          </p>
          <button
            onClick={handleBuild}
            disabled={generating}
            className="inline-flex items-center gap-1 px-2.5 h-7 rounded-full bg-[#555B40] text-white font-body text-[11px] font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
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
            ? `https://weather.com/search?q=${encodeURIComponent(trip.cities[0])}`
            : trip.country
              ? `https://weather.com/search?q=${encodeURIComponent(trip.country)}`
              : null
        }
      />

      <PackingCategories
        items={items}
        onOpenCategory={setActiveCategory}
        onAddCustom={() => setActiveCategory("misc")}
      />

      {activeCategory && (
        <CategorySheet
          categoryId={activeCategory}
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