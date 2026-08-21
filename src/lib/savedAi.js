import { base44 } from "@/api/base44Client";

export const DEFAULT_CATEGORIES = ["restaurant", "cafe", "museum", "attractions", "nature", "experience", "nightlife", "shopping", "relax"];

const picksCache = new Map();
const imgCache = new Map();
const LS_KEY = "guia:saved-cache:v1";
export const STALE_MS = 5 * 60 * 1000; // refresh silently after 5 min

function readLs() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
}
function writeLs(obj) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(obj)); } catch { /* quota */ }
}

export function getCachedTopPicks(tripId, city, category = "all") {
  const key = `${tripId}|${city}|${category}`;
  if (picksCache.has(key)) return picksCache.get(key);
  const ls = readLs();
  const entry = ls[key];
  if (entry?.picks?.length) { picksCache.set(key, entry.picks); return entry.picks; }
  return undefined;
}
export function getCacheAge(tripId, city, category = "all") {
  const entry = readLs()[`${tripId}|${city}|${category}`];
  return entry?.ts ? Date.now() - entry.ts : Infinity;
}
export function setCachedTopPicks(tripId, city, data, category = "all") {
  const key = `${tripId}|${city}|${category}`;
  picksCache.set(key, data);
  const ls = readLs();
  ls[key] = { picks: data, ts: Date.now() };
  writeLs(ls);
}
export function getCachedPickImage(tripId, city, name) {
  const key = `${tripId}|${city}|${name}`;
  const mem = imgCache.get(key);
  if (mem?.url !== undefined) return { url: mem.url, attribution: mem.attribution };
  const ls = readLs();
  const entry = ls[key];
  if (entry?.url !== undefined) {
    imgCache.set(key, { url: entry.url, attribution: entry.attribution });
    return { url: entry.url, attribution: entry.attribution };
  }
  return null;
}
export function setCachedPickImage(tripId, city, name, url, attribution) {
  const key = `${tripId}|${city}|${name}`;
  imgCache.set(key, { url, attribution });
  const ls = readLs();
  ls[key] = { url, attribution, ts: Date.now() };
  writeLs(ls);
}

// Fetches real places via the places-search Netlify function (Google Places
// Text Search under the hood — see netlify/functions/places-search.js).
// - No category filter (or "all"): 1 pick per category, 9 total — same shape
//   as the old default view.
// - A specific category: 6 real picks for just that category, instead of
//   filtering down to the single pick that category had in the mixed set.
// excludeNames should be the traveler's already-saved place names for this
// trip/city, so a saved place never resurfaces in the picks.
export async function generateTopPicks(trip, city, { category = "all", excludeNames = [] } = {}) {
  const categories = category === "all" ? DEFAULT_CATEGORIES : [category];
  const perCategory = category === "all" ? 1 : 6;

  const res = await fetch("/.netlify/functions/places-search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      city,
      country: trip.country,
      categories,
      perCategory,
      excludeNames,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Places search failed");

  const picks = categories.flatMap((cat) => data.results?.[cat] || []);
  return { picks };
}

export async function generatePickImage(tripId, city, name, imagePrompt) {
  const key = `${tripId}|${city}|${name}`;
  const lsCached = getCachedPickImage(tripId, city, name);
  if (lsCached) return lsCached; // { url, attribution } — url may legitimately be null (no photo on file)
  const cached = imgCache.get(key);
  if (cached?.promise) return cached.promise; // reuse in-flight request

  const promise = base44.integrations.Core.GetPlacePhoto({ name, city })
    .then(({ url, attribution }) => {
      setCachedPickImage(tripId, city, name, url, attribution);
      return { url, attribution };
    })
    .catch((err) => {
      imgCache.delete(key);
      throw err;
    });
  imgCache.set(key, { promise });
  return promise;
}
