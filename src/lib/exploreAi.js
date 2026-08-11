import { base44 } from "@/api/base44Client";
import { getSeason } from "@/lib/journeyAi";

const pickSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    description: { type: "string" },
    neighborhood: { type: "string" },
    hours: { type: "string" },
    priceRange: { type: "string" },
    website: { type: "string" },
  },
};

// In-memory cache so revisiting a city is instant and images aren't re-generated.
const exploreCache = new Map();
const imageCache = new Map();
export function getCachedExplore(tripId, city) { return exploreCache.get(`${tripId}|${city}`); }
export function setCachedExplore(tripId, city, data) { exploreCache.set(`${tripId}|${city}`, data); }
export function getCachedImage(tripId, city) { return imageCache.get(`${tripId}|${city}`); }
export function setCachedImage(tripId, city, url) { imageCache.set(`${tripId}|${city}`, url); }

function timeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "night";
}

// Fast: the 6 category collections come from the model's own knowledge of
// well-known places — no web search, so this resolves in a few seconds.
export async function generateCollections(trip, city) {
  const season = getSeason(trip.start_date) || "unknown";
  const prompt = `You are a luxury travel curator for the Guía app. The traveler is visiting ${city}${trip.country ? ", " + trip.country : ""} during ${season} season.

Return a JSON object: "collections" — an array of exactly 6 objects in this EXACT order with ids: "eat", "coffee", "see", "shop", "do", "relax". Each object: { id, picks: [exactly 3 REAL, well-known places in ${city} for that category] }. Each pick: { name (real place name), description (under 90 chars), neighborhood, hours (like "11am–11pm"), priceRange (like "$$" or "$$$"), website (real https URL or empty string) }. Use real, specific place names — never generic descriptions. Only include a website URL if you are confident it is real; otherwise use empty string. Do not mention the JSON structure in the output.`;

  const res = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: "object",
      properties: {
        collections: {
          type: "array",
          items: { type: "object", properties: { id: { type: "string" }, picks: { type: "array", items: pickSchema } } },
        },
      },
    },
  });
  return res;
}

// Slower (web-enabled): current happenings + practical know-before-you-go.
// Kept small so the web search has less to resolve.
export async function generateHappeningAndKnow(trip, city) {
  const season = getSeason(trip.start_date) || "unknown";
  const dateRange = trip.start_date && trip.end_date
    ? `${trip.start_date} to ${trip.end_date}`
    : trip.start_date || "upcoming";

  const prompt = `You are a luxury travel curator for the Guía app. The traveler is visiting ${city}${trip.country ? ", " + trip.country : ""} during ${season} season, trip dates ${dateRange}. Current time of day: ${timeOfDay()}.

Return a JSON object with two parts:

1. "happening": one notable event, festival, market, or seasonal happening in ${city} around those dates. { title (under 40 chars), description (one sentence under 120 chars), learnMoreUrl (real https URL or empty string) }

2. "know": { currency: {summary (under 40 chars), detail (one sentence)}, transportation: {summary (under 40 chars), detail (one sentence)}, visa: {summary (under 40 chars), detail (one sentence)}, safety: {summary (under 40 chars), detail (one sentence)} }

Use current web knowledge. Be specific and real. All URLs must start with https:// or be empty. Do not mention the JSON structure in the output.`;

  const res = await base44.integrations.Core.InvokeLLM({
    prompt,
    add_context_from_internet: true,
    model: "gemini_3_flash",
    response_json_schema: {
      type: "object",
      properties: {
        happening: {
          type: "object",
          properties: { title: { type: "string" }, description: { type: "string" }, learnMoreUrl: { type: "string" } },
        },
        know: {
          type: "object",
          properties: {
            currency: { type: "object", properties: { summary: { type: "string" }, detail: { type: "string" } } },
            transportation: { type: "object", properties: { summary: { type: "string" }, detail: { type: "string" } } },
            visa: { type: "object", properties: { summary: { type: "string" }, detail: { type: "string" } } },
            safety: { type: "object", properties: { summary: { type: "string" }, detail: { type: "string" } } },
          },
        },
      },
    },
  });
  return res;
}

const TITLES = {
  eat: "restaurants",
  coffee: "cafés",
  see: "landmarks and sights",
  shop: "shops, boutiques and markets",
  do: "experiences and activities",
  relax: "relaxing scenic spots",
};

// Refresh a single category — model knowledge (no web) so it's fast.
export async function generateCollectionPicks(trip, city, collectionId, excludeNames = []) {
  const prompt = `You are a luxury travel curator. Recommend 3 REAL, well-known ${TITLES[collectionId] || "places"} in ${city}${trip.country ? ", " + trip.country : ""}. Exclude these already suggested: ${excludeNames.join(", ") || "none"}. Each: { name (real place name), description (under 90 chars), neighborhood, hours (like "11am–11pm"), priceRange (like "$$"), website (real https URL or empty) }. Use real, specific place names. Return { picks: [exactly 3 objects] }.`;
  const res = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: { type: "object", properties: { picks: { type: "array", items: pickSchema } } },
  });
  return res;
}