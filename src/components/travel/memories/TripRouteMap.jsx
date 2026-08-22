import { useState, useRef, useEffect } from "react";
import { Map as MapIcon, X } from "lucide-react";

let leafletPromise = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    const style = document.createElement("style");
    style.textContent = `
      .trip-map-label { background: #A7773F; color: #F7F3EC; border: none; border-radius: 20px; padding: 3px 9px; font-size: 11px; font-weight: 500; box-shadow: none; }
      .trip-map-label::before { display: none; }
    `;
    document.head.appendChild(style);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error("Failed to load map library"));
    document.body.appendChild(script);
  });
  return leafletPromise;
}

const geocodeCache = new Map();
async function geocodeCity(city, country) {
  const key = `${city}|${country || ""}`;
  if (geocodeCache.has(key)) return geocodeCache.get(key);
  const q = `${city}${country ? ", " + country : ""}`;
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`, {
      headers: { "Accept-Language": "en-US,en" },
    });
    const data = await res.json();
    const result = data?.[0] ? { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) } : null;
    geocodeCache.set(key, result);
    return result;
  } catch {
    return null;
  }
}

export default function TripRouteMap({ trip }) {
  const cities = trip.cities || [];
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!expanded) return;
    let alive = true;
    setLoading(true);
    setFailed(false);

    (async () => {
      try {
        const L = await loadLeaflet();
        const points = [];
        for (const city of cities) {
          const p = await geocodeCity(city, trip.country);
          if (p) points.push(p);
          await new Promise((r) => setTimeout(r, 250));
        }
        if (!alive) return;
        if (points.length === 0) throw new Error("Couldn't locate any cities");

        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        const map = L.map(mapContainerRef.current, { zoomControl: true, attributionControl: true });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
          maxZoom: 18,
        }).addTo(map);

        const latlngs = points.map((p) => [p.lat, p.lon]);
        if (latlngs.length > 1) {
          L.polyline(latlngs, { color: "#A7773F", weight: 3, opacity: 0.85 }).addTo(map);
        }
        points.forEach((p, i) => {
          const marker = L.circleMarker([p.lat, p.lon], {
            radius: 7,
            color: "#A7773F",
            fillColor: "#A7773F",
            fillOpacity: 1,
            weight: 2,
          }).addTo(map);
          marker.bindTooltip(cities[i], { permanent: true, direction: "top", offset: [0, -8], className: "trip-map-label" }).openTooltip();
        });

        if (latlngs.length > 1) {
          map.fitBounds(latlngs, { padding: [40, 40] });
        } else {
          map.setView(latlngs[0], 11);
        }

        mapInstanceRef.current = map;
        // The map is created inside a just-opened modal — its container
        // may not have its final size yet at this exact moment, which is
        // the classic cause of Leaflet rendering a blank grey map. Forcing
        // a recalculation on the next frame (and once more shortly after)
        // fixes that reliably.
        requestAnimationFrame(() => map.invalidateSize());
        setTimeout(() => map.invalidateSize(), 200);
        setLoading(false);
      } catch (err) {
        console.error("Trip map failed:", err);
        if (alive) { setFailed(true); setLoading(false); }
      }
    })();

    return () => { alive = false; };
  }, [expanded]);

  useEffect(() => {
    if (!expanded && mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
  }, [expanded]);

  if (cities.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setExpanded(true)}
        className="text-left bg-card border border-border rounded-2xl p-2.5 hover:border-accent/40 transition-colors"
      >
        <div className="h-[52px] rounded-xl bg-[#EFE9DF] flex items-center justify-center mb-1.5">
          <MapIcon className="w-6 h-6 text-accent" strokeWidth={1.5} />
        </div>
        <h3 className="font-heading text-[14px] text-foreground font-semibold leading-tight">Where you went</h3>
        <p className="font-body text-[10px] text-muted-foreground mt-0.5 leading-snug">{cities.length} cit{cities.length !== 1 ? "ies" : "y"} on this trip</p>
        <p className="font-body text-[9.5px] text-muted-foreground/80 mt-1.5 leading-snug line-clamp-1">
          {cities.join(" → ")}
        </p>
      </button>

      {expanded && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setExpanded(false)}
        >
          <div className="relative w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="bg-card rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="font-heading text-[15px] text-foreground">Where you went</h3>
              </div>
              <div className="relative" style={{ height: 360 }}>
                {loading && (
                  <div className="absolute inset-0 bg-muted flex items-center justify-center z-10">
                    <p className="font-body text-[12px] text-muted-foreground">Loading map…</p>
                  </div>
                )}
                {failed && (
                  <div className="absolute inset-0 bg-muted flex items-center justify-center z-10">
                    <p className="font-body text-[12px] text-muted-foreground">Couldn't load the map right now.</p>
                  </div>
                )}
                <div ref={mapContainerRef} className="w-full h-full" />
              </div>
            </div>
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
