import { useState, useEffect } from "react";
import { Map as MapIcon } from "lucide-react";

const mapCache = new Map();

export default function TripRouteMap({ trip }) {
  const cities = trip.cities || [];
  const [dataUrl, setDataUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (cities.length === 0) { setLoading(false); return; }
    let alive = true;
    const cacheKey = `${trip.id}|${cities.join(",")}`;
    const cached = mapCache.get(cacheKey);
    if (cached) { setDataUrl(cached); setLoading(false); return; }

    setLoading(true);
    setFailed(false);
    fetch("/.netlify/functions/static-map", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cities, country: trip.country }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!alive) return;
        if (!ok || !data.dataUrl) throw new Error(data?.error || "No map returned");
        mapCache.set(cacheKey, data.dataUrl);
        setDataUrl(data.dataUrl);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Trip route map failed:", err);
        if (alive) { setFailed(true); setLoading(false); }
      });
    return () => { alive = false; };
  }, [trip.id, cities.join(","), trip.country]);

  if (cities.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-3.5 pt-3.5 pb-2 flex items-center gap-1.5">
        <MapIcon className="w-4 h-4 text-accent" />
        <h3 className="font-heading text-[14px] font-medium text-foreground">Where you went</h3>
      </div>
      {loading ? (
        <div className="h-[190px] bg-muted animate-pulse" />
      ) : failed ? (
        <div className="h-[120px] flex items-center justify-center">
          <p className="font-body text-[11px] text-muted-foreground">Couldn't load the map right now.</p>
        </div>
      ) : (
        <img src={dataUrl} alt={`Map of ${cities.join(", ")}`} className="w-full h-[190px] object-cover" />
      )}
    </div>
  );
}
