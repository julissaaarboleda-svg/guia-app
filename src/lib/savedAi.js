import { base44 } from "@/api/base44Client";
import { getSeason } from "@/lib/journeyAi";

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

export function getCachedTopPicks(tripId, city) {
  const key = `${tripId}|${city}`;
  if (picksCache.has(key)) return picksCache.get(key);
  const ls = readLs();
  const entry = ls[key];
  if (entry?.picks?.length) { picksCache.set(key, entry.picks); return entry.picks; }
  return undefined;
}
export function getCacheAge(tripId, city) {
  const entry = readLs()[`${tripId}|${city}`];
  return entry?.ts ? Date.now() - entry.ts : Infinity;
}
export function setCachedTopPicks(tripId, city, data) {
  const key = `${tripId}|${city}`;
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

export async function generateTopPicks(trip, city) {
  const season = getSeason(trip.start_date) || "unknown";
  const seed = Math.floor(Math.random() * 100000);
  const categories = ["restaurant", "cafe", "museum", "attractions", "nature", "experience", "nightlife", "shopping", "relax"];
  const prompt = `You are a luxury travel curator for the Guía app. The traveler is visiting ${city}${trip.country ? ", " + trip.country : ""} during ${season} season.

Use live web knowledge to return REAL, well-known places in ${city}. You MUST include the city's most iconic landmarks and must-see sights under the "attractions" category — never omit the famous sights (e.g. Rio de Janeiro: Christ the Redeemer, Sugar Loaf Mountain, Copacabana Beach, Ipanema Beach; Paris: Eiffel Tower, Louvre, Notre-Dame; Tokyo: Senso-ji, Shibuya Crossing, Tsukiji).

Return exactly 1 pick for EACH of these categories (9 total): ${categories.join(", ")}.
Each pick: { name (REAL place in ${city}), category (exactly one of: ${categories.map((c) => `"${c}"`).join(", ")}), aiBadge (one of "Highly Recommended", "Hidden Gem", "Popular with Locals"), description (one sentence under 80 chars), neighborhood, rating (number like 4.7), reviewCount (integer like 1240), price (like "$" or "$$" or "$$$" or "$$$$" or "" for museums/landmarks), website (real https URL or empty string), imagePrompt (short editorial travel photo prompt: subject, warm golden light, no text, no people, no watermark) }.

Variety seed: ${seed}. Favor variety across the 9 — mix iconic staples with genuine local favorites, and do not repeat the same selection as a prior call.

Return JSON: { picks: [ exactly 9 objects, 1 per category ] }.`;
  const schema = {
    type: "object",
    properties: {
      picks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            category: { type: "string" },
            aiBadge: { type: "string" },
            description: { type: "string" },
            neighborhood: { type: "string" },
            rating: { type: "number" },
            reviewCount: { type: "number" },
            price: { type: "string" },
            website: { type: "string" },
            imagePrompt: { type: "string" },
          },
        },
      },
    },
  };
  // Retry transient LLM failures (timeouts / rate limits) before surfacing an error.
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        model: "gemini_3_flash",
        response_json_schema: schema,
      });
      if (res?.picks?.length) return res;
      lastErr = new Error("empty picks");
    } catch (err) {
      lastErr = err;
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
  }
  throw lastErr;
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