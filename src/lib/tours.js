
// Tours come from the same Google Places search as Top Picks (real operators,
// ratings and websites) — nothing is invented. Cached 24h per city/type.
export const TOUR_FILTERS = [
  { value: "tours", label: "All" },
  { value: "tours_walking", label: "Walking" },
  { value: "tours_boat", label: "Boat" },
  { value: "tours_food", label: "Food" },
  { value: "tours_daytrips", label: "Day trips" },
];

const KEY = "guia:tours:v1";
const TTL = 24 * 60 * 60 * 1000;
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };

export async function getTours(country, city, kind) {
  const ck = `${country}|${city}|${kind}`;
  const hit = read()[ck];
  if (hit && Date.now() - hit.at < TTL) return hit.tours;

  const res = await fetch("/.netlify/functions/places-search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ city, country, categories: [kind], perCategory: 6, excludeNames: [] }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Tour search failed (${res.status})`);
  // Show as "Experience" in the shared detail sheet / wishlist.
  const tours = (data.results?.[kind] || []).map((t) => ({ ...t, category: "experience" }));
  if (tours.length) {
    const c = read();
    c[ck] = { at: Date.now(), tours };
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* quota */ }
  }
  return tours;
}

