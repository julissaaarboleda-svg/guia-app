import { useState, useEffect } from "react";
import { Map as MapIcon, X } from "lucide-react";

const mapCache = new Map();

export default function TripRouteMap({ trip }) {
  const cities = trip.cities || [];
  const [dataUrl, setDataUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);

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
    <>
      <button
        onClick={() => dataUrl && setExpanded(true)}
        className="text-left bg-card border border-border rounded-2xl p-3.5 hover:border-accent/40 transition-colors"
      >
        {loading ? (
          <div className="h-[72px] rounded-xl bg-muted animate-pulse mb-2.5" />
        ) : failed ? (
          <div className="h-[72px] rounded-xl bg-muted flex items-center justify-center mb-2.5">
            <p className="font-body text-[10px] text-muted-foreground">Couldn't load the map right now.</p>
          </div>
        ) : (
          <div className="h-[72px] rounded-xl overflow-hidden mb-2.5">
            <img src={dataUrl} alt={`Map of ${cities.join(", ")}`} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex items-center gap-1.5 mb-1 text-accent">
          <MapIcon className="w-4 h-4" />
        </div>
        <h3 className="font-heading text-[14px] text-foreground font-semibold leading-tight">Where you went</h3>
        <p className="font-body text-[10px] text-muted-foreground mt-0.5 leading-snug">{cities.length} cit{cities.length !== 1 ? "ies" : "y"} on this trip</p>
      </button>

      {expanded && dataUrl && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setExpanded(false)}
        >
          <div className="relative w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <img src={dataUrl} alt={`Map of ${cities.join(", ")}`} className="w-full rounded-2xl" />
            <button
              onClick={() => setExpanded(false)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/45 flex items-center justify-center"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
