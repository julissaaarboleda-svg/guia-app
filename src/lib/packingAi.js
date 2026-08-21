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

// Maps Open-Meteo's WMO weather codes to a short condition label + icon.
// https://open-meteo.com/en/docs (WMO Weather interpretation codes)
function weatherCodeInfo(code) {
  const map = {
    0: { condition: "Clear sky", icon: "☀" },
    1: { condition: "Mostly clear", icon: "☀" },
    2: { condition: "Partly cloudy", icon: "⛅" },
    3: { condition: "Overcast", icon: "☁" },
    45: { condition: "Fog", icon: "🌫" },
    48: { condition: "Fog", icon: "🌫" },
    51: { condition: "Light drizzle", icon: "🌧" },
    53: { condition: "Drizzle", icon: "🌧" },
    55: { condition: "Heavy drizzle", icon: "🌧" },
    56: { condition: "Freezing drizzle", icon: "🌧" },
    57: { condition: "Freezing drizzle", icon: "🌧" },
    61: { condition: "Light rain", icon: "🌧" },
    63: { condition: "Rain", icon: "🌧" },
    65: { condition: "Heavy rain", icon: "🌧" },
    66: { condition: "Freezing rain", icon: "🌧" },
    67: { condition: "Freezing rain", icon: "🌧" },
    71: { condition: "Light snow", icon: "🌨" },
    73: { condition: "Snow", icon: "🌨" },
    75: { condition: "Heavy snow", icon: "🌨" },
    77: { condition: "Snow grains", icon: "🌨" },
    80: { condition: "Rain showers", icon: "🌧" },
    81: { condition: "Rain showers", icon: "🌧" },
    82: { condition: "Heavy showers", icon: "🌧" },
    85: { condition: "Snow showers", icon: "🌨" },
    86: { condition: "Snow showers", icon: "🌨" },
    95: { condition: "Thunderstorm", icon: "⛈" },
    96: { condition: "Thunderstorm", icon: "⛈" },
    99: { condition: "Thunderstorm", icon: "⛈" },
  };
  return map[code] || { condition: "", icon: "☀" };
}

// Looks up a city's coordinates via Open-Meteo's free geocoding API.
async function geocodeCity(city) {
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
    );
    const data = await res.json();
    const r = data?.results?.[0];
    return r ? { lat: r.latitude, lon: r.longitude } : null;
  } catch {
    return null;
  }
}

function avg(nums) {
  const valid = nums.filter((n) => typeof n === "number" && !isNaN(n));
  if (!valid.length) return null;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}

function mode(nums) {
  const valid = nums.filter((n) => typeof n === "number");
  if (!valid.length) return null;
  const counts = {};
  valid.forEach((n) => { counts[n] = (counts[n] || 0) + 1; });
  return Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]);
}

// Real forecast (Open-Meteo issues reliable daily forecasts ~15 days out).
async function fetchLiveForecast(lat, lon, start, end) {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weathercode&temperature_unit=fahrenheit&timezone=auto&start_date=${start}&end_date=${end}`
  );
  const data = await res.json();
  const highs = data?.daily?.temperature_2m_max || [];
  const lows = data?.daily?.temperature_2m_min || [];
  const codes = data?.daily?.weathercode || [];
  if (!highs.length) return null;
  const codeInfo = weatherCodeInfo(mode(codes));
  return { high: avg(highs), low: avg(lows), condition: codeInfo.condition, icon: codeInfo.icon };
}

// For trips further out than the forecast window: average the same
// calendar dates from the past 2 years of real recorded weather, so it's
// still genuine data — a "typically what this time of year looks like"
// estimate — rather than an AI guess.
async function fetchHistoricalAverage(lat, lon, start, end) {
  const thisYear = new Date().getFullYear();
  const years = [thisYear - 1, thisYear - 2];
  const mmdd = (d) => d.slice(5); // "MM-DD" from "YYYY-MM-DD"
  const startMD = mmdd(start);
  const endMD = mmdd(end);

  const results = await Promise.all(
    years.map(async (y) => {
      try {
        const s = `${y}-${startMD}`;
        const e = `${y}-${endMD}`;
        const res = await fetch(
          `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weathercode&temperature_unit=fahrenheit&timezone=auto&start_date=${s}&end_date=${e}`
        );
        const data = await res.json();
        return {
          highs: data?.daily?.temperature_2m_max || [],
          lows: data?.daily?.temperature_2m_min || [],
          codes: data?.daily?.weathercode || [],
        };
      } catch {
        return { highs: [], lows: [], codes: [] };
      }
    })
  );

  const allHighs = results.flatMap((r) => r.highs);
  const allLows = results.flatMap((r) => r.lows);
  const allCodes = results.flatMap((r) => r.codes);
  if (!allHighs.length) return null;
  const codeInfo = weatherCodeInfo(mode(allCodes));
  return { high: avg(allHighs), low: avg(allLows), condition: codeInfo.condition, icon: codeInfo.icon };
}

export async function fetchWeather(trip) {
  const cities = trip.cities || [];
  if (cities.length === 0) return [];
  const ranges = computeCityDateRanges(trip);
  // Order cities by the sequence they're first visited in the itinerary
  const orderedCities = [];
  ranges.forEach((r) => { if (r.city && !orderedCities.includes(r.city)) orderedCities.push(r.city); });
  cities.forEach((c) => { if (!orderedCities.includes(c)) orderedCities.push(c); });

  const today = new Date();
  const FORECAST_WINDOW_DAYS = 15;

  const results = await Promise.all(
    orderedCities.map(async (city) => {
      const r = ranges.find((x) => x.city === city) || {};
      const fmt = (d) => (d ? format(parseISO(d), "MMM d") : "");
      const base = { city, dateRange: r.start && r.end ? `${fmt(r.start)} – ${fmt(r.end)}` : "" };

      if (!r.start || !r.end) return { ...base, high: null, low: null, condition: "", icon: "☀" };

      const coords = await geocodeCity(city);
      if (!coords) return { ...base, high: null, low: null, condition: "", icon: "☀" };

      const daysUntilStart = Math.ceil((parseISO(r.start) - today) / 86400000);
      let weather = null;
      try {
        weather = daysUntilStart <= FORECAST_WINDOW_DAYS
          ? await fetchLiveForecast(coords.lat, coords.lon, r.start, r.end)
          : await fetchHistoricalAverage(coords.lat, coords.lon, r.start, r.end);
      } catch (err) {
        console.error(`Weather fetch failed for ${city}:`, err);
      }

      return weather
        ? { ...base, ...weather }
        : { ...base, high: null, low: null, condition: "", icon: "☀" };
    })
  );

  return results;
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
