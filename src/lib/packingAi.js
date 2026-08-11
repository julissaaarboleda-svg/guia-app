import { base44 } from "@/api/base44Client";
import { getSeason } from "@/lib/journeyAi";
import { parseISO, format } from "date-fns";

export const PACKING_CATEGORIES = [
  { id: "essentials", label: "Essentials" },
  { id: "clothing", label: "Clothing" },
  { id: "toiletries", label: "Toiletries" },
  { id: "tech", label: "Tech" },
  { id: "health", label: "Health & Medications" },
  { id: "misc", label: "Miscellaneous" },
];

export const CATEGORY_IDS = PACKING_CATEGORIES.map((c) => c.id);

export function categoryMeta(id) {
  return PACKING_CATEGORIES.find((c) => c.id === id) || PACKING_CATEGORIES[PACKING_CATEGORIES.length - 1];
}

// ---- Shared weather cache ----
// fetchWeather() is a real, grounded (web-search) Gemini call — it's also the
// single source of truth for weather across the app now (Packing tab AND Know
// Before You Go both use this cache instead of each generating their own
// separate weather guess). Same trip = same forecast everywhere it's shown.
const weatherCache = new Map();

export function buildWeatherCacheKey(trip) {
  const cities = trip.cities || [];
  const itSig = (trip.itinerary || []).map((d) => `${d.date || ""}:${(d.activities || []).length}`).join(";");
  return `v2|${trip.id}|${cities.join(",")}|${trip.start_date}|${trip.end_date}|${itSig}`;
}

export function getCachedWeather(trip) {
  return weatherCache.get(buildWeatherCacheKey(trip));
}

export function setCachedWeather(trip, data) {
  weatherCache.set(buildWeatherCacheKey(trip), data);
}

// Fetches (or reuses the cached) weather forecast for a trip. Every screen that
// needs weather should call this instead of calling fetchWeather() directly.
export async function getTripWeather(trip) {
  const cached = getCachedWeather(trip);
  if (cached) return cached;
  const result = await fetchWeather(trip);
  setCachedWeather(trip, result);
  return result;
}

// Signature of the trip fields that should invalidate a packing list.
export function computeSignature(trip) {
  const it = trip.itinerary || [];
  const actCount = it.reduce((n, d) => n + (d.activities?.length || 0), 0);
  return [
    trip.start_date || "",
    trip.end_date || "",
    (trip.cities || []).join(","),
    trip.country || "",
    it.length,
    actCount,
    (trip.stay_info || []).length,
    (trip.flights || []).length,
  ].join("|");
}

// Derive per-city date ranges from the itinerary (which city on which days).
export function computeCityDateRanges(trip) {
  const cities = trip.cities || [];
  if (cities.length === 0 || !trip.start_date || !trip.end_date) {
    return cities.map((c) => ({ city: c, start: trip.start_date, end: trip.end_date }));
  }
  const it = (trip.itinerary || []).slice().sort((a, b) => (a.day || 0) - (b.day || 0));
  if (it.length === 0) {
    return cities.map((c) => ({ city: c, start: trip.start_date, end: trip.end_date }));
  }
  const cityByDay = it.map((d) => {
    const hay = `${d.title || ""} ${d.description || ""} ${(d.activities || [])
      .map((a) => `${a.location || ""} ${a.name || ""} ${a.activity || ""}`)
      .join(" ")}`.toLowerCase();
    const matched = cities
      .map((c) => ({ c, idx: hay.indexOf(c.toLowerCase()) }))
      .filter((x) => x.idx >= 0)
      .sort((a, b) => a.idx - b.idx)[0];
    return { date: d.date, city: matched ? matched.c : null };
  });
  const ranges = [];
  let cur = null;
  cityByDay.forEach((d) => {
    if (cur && d.city === cur.city) {
      cur.end = d.date;
    } else {
      if (cur) ranges.push(cur);
      cur = { city: d.city, start: d.date, end: d.date };
    }
  });
  if (cur) ranges.push(cur);
  const covered = new Set(ranges.map((r) => r.city).filter(Boolean));
  cities.forEach((c) => {
    if (!covered.has(c)) ranges.push({ city: c, start: trip.start_date, end: trip.end_date });
  });
  return ranges.filter((r) => r.city);
}

function weatherIcon(condition) {
  const c = (condition || "").toLowerCase();
  if (/thunder/.test(c)) return "⛈";
  if (/rain|shower|drizzle/.test(c)) return "🌧";
  if (/snow/.test(c)) return "🌨";
  if (/fog|mist|haze/.test(c)) return "🌫";
  if (/partly|mostly cloudy|overcast/.test(c)) return "⛅";
  if (/cloud/.test(c)) return "☁";
  if (/wind/.test(c)) return "💨";
  return "☀";
}

export async function fetchWeather(trip) {
  const cities = trip.cities || [];
  if (cities.length === 0) return [];
  const ranges = computeCityDateRanges(trip);
  // Order cities by the sequence they're first visited in the itinerary
  const orderedCities = [];
  ranges.forEach((r) => { if (r.city && !orderedCities.includes(r.city)) orderedCities.push(r.city); });
  cities.forEach((c) => { if (!orderedCities.includes(c)) orderedCities.push(c); });
  const cityInfo = orderedCities.map((c) => {
    const r = ranges.find((x) => x.city === c) || {};
    const fmt = (d) => (d ? format(parseISO(d), "MMM d") : "");
    return {
      city: c,
      dateRange: r.start && r.end ? `${fmt(r.start)} – ${fmt(r.end)}` : "",
    };
  });
  const season = getSeason(trip.start_date) || "unknown";
  const prompt = `You are a meteorologist for a travel app. Provide realistic weather forecasts for these cities during the trip dates (${trip.start_date} to ${trip.end_date}, ${season} season). Use current web knowledge.

Cities: ${cityInfo.map((c) => c.city).join(", ")}

Return JSON: { forecasts: [ { city, highF (integer °F), lowF (integer °F), condition (short, e.g. "Mostly sunny", "Rain showers", "Partly cloudy") } ] } — one entry per city in the same order. Keep condition text under 25 characters.`;
  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      model: "gemini_3_flash",
      response_json_schema: {
        type: "object",
        properties: {
          forecasts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                city: { type: "string" },
                highF: { type: "number" },
                lowF: { type: "number" },
                condition: { type: "string" },
              },
            },
          },
        },
      },
    });
    const fcasts = res?.forecasts || [];
    return cityInfo.map((c) => {
      const f = fcasts.find((x) => (x.city || "").toLowerCase() === c.city.toLowerCase()) || {};
      return {
        ...c,
        high: f.highF ?? null,
        low: f.lowF ?? null,
        condition: f.condition || "",
        icon: weatherIcon(f.condition),
      };
    });
  } catch {
    return cityInfo.map((c) => ({ ...c, high: null, low: null, condition: "", icon: "☀" }));
  }
}

export async function generatePackingList(trip, prefs) {
  const cities = trip.cities || [];
  const season = getSeason(trip.start_date) || "unknown";
  const days = trip.start_date && trip.end_date
    ? Math.max(1, Math.ceil((parseISO(trip.end_date) - parseISO(trip.start_date)) / 86400000) + 1)
    : 0;
  const stays = trip.stay_info || [];
  const flights = trip.flights || [];
  const activities = (trip.itinerary || [])
    .flatMap((d) => (d.activities || []).map((a) => a.activity || a.name))
    .filter(Boolean)
    .slice(0, 24);
  const context = {
    title: trip.title,
    country: trip.country,
    cities,
    season,
    days,
    start_date: trip.start_date,
    end_date: trip.end_date,
    stay_types: stays.map((s) => s.property_type).filter(Boolean),
    flight_count: flights.length,
    activities,
    city_count: cities.length,
    packing_style: prefs.style,
    laundry: prefs.laundry,
    luggage: prefs.luggage,
  };
  const prompt = `You are a premium travel concierge building a personalized packing list for the Guía app. Use the trip data below to generate a tailored packing list.

Trip context:
${JSON.stringify(context, null, 2)}

Rules:
- Return items grouped into EXACTLY these 6 categories: "essentials", "clothing", "toiletries", "tech", "health", "misc".
- Adjust clothing quantities based on trip length (${days} days), luggage type (${prefs.luggage}), and laundry availability (${prefs.laundry}). If laundry is "yes" and luggage is "carry-on", reduce clothing quantities. If luggage is "checked", allow more.
- Include destination/weather-appropriate items (season: ${season}, cities: ${cities.join(", ")}).
- Include activity-specific items based on the planned activities.
- Include reservation/flight-relevant items (e.g. boarding pass, confirmation printout) under essentials.
- Each item: { name (string, concise), category (one of the 6 ids), quantity (integer, default 1) }.
- Aim for a comprehensive but not excessive list: roughly 4-8 items per category.

Return JSON: { items: [ ... ] }`;
  const res = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              category: { type: "string" },
              quantity: { type: "number" },
            },
          },
        },
      },
    },
  });
  return (res?.items || []).map((it) => ({
    name: it.name,
    category: CATEGORY_IDS.includes(it.category) ? it.category : "misc",
    quantity: it.quantity || 1,
    packed: false,
    source: "ai",
  }));
}