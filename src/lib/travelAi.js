import { base44 } from "@/api/base44Client";
import { getTripWeather } from "@/lib/packingAi";

// Lightweight cache so this doesn't re-run the AI call every time someone
// revisits the Journeys page — same spirit as savedAi.js's image cache.
const CACHE_KEY_PREFIX = "guia:travel-insights:v2:";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function readCache(tripId) {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + tripId);
    if (!raw) return null;
    const { insights, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return insights;
  } catch {
    return null;
  }
}

function writeCache(tripId, insights) {
  try {
    localStorage.setItem(CACHE_KEY_PREFIX + tripId, JSON.stringify({ insights, ts: Date.now() }));
  } catch {}
}

export async function generateTravelInsights(trip, { force = false } = {}) {
  if (!force) {
    const cached = readCache(trip.id);
    if (cached) return cached;
  }

  let weather = null;
  try {
    weather = await getTripWeather(trip);
  } catch {
    weather = null;
  }

  const packing = trip.packing_items || [];
  const itinerary = trip.itinerary || [];
  const expenses = trip.expense_items || [];
  const totalSpent = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const emptyDays = itinerary.filter((d) => !d.activities || d.activities.length === 0);
  const packedCount = packing.filter((p) => p.packed).length;
  const packingPct = packing.length ? Math.round((packedCount / packing.length) * 100) : null;
  const itineraryPct = itinerary.length ? Math.round(((itinerary.length - emptyDays.length) / itinerary.length) * 100) : null;
  const budgetPct = trip.budget_target ? Math.round((totalSpent / trip.budget_target) * 100) : null;

  const daysUntil = trip.start_date
    ? Math.ceil((new Date(trip.start_date + "T00:00:00") - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  // Critical travel documents (visa, passport, etc.) deserve a special call-out
  // regardless of the "only mention if genuinely urgent" rule below — an
  // unpacked t-shirt is a minor gap, an unfiled visa can block the trip
  // entirely. Compute this directly instead of leaving it to chance.
  const criticalDocItems = packing.filter((p) =>
    !p.packed && /visa|passport/i.test(p.name || "")
  );

  // Compact plain-text summaries instead of raw JSON dumps — this was
  // previously sending up to 30 full packing item objects, full weather
  // JSON, and up to 20 days of itinerary verbatim, which made the prompt
  // large enough that Gemini's response sometimes didn't finish before
  // Netlify's function timeout (504 Gateway Timeout). Same information,
  // far fewer tokens.
  const unpackedNames = packing.filter((p) => !p.packed).map((p) => p.name).slice(0, 20);
  const packingSummary = packing.length
    ? `${packedCount}/${packing.length} packed (${packingPct}%). Not yet packed: ${unpackedNames.join(", ") || "nothing — all packed"}`
    : "No packing list yet.";

  const weatherSummary = weather && weather.length
    ? weather.map((w) => `${w.city}: ${w.low ?? "?"}-${w.high ?? "?"}°, ${w.condition || "unknown"}`).join("; ")
    : "not available";

  const itinerarySummary = itinerary.length
    ? `${itinerary.length} days planned, ${itineraryPct}% have at least one activity. Empty days: ${emptyDays.map((d) => d.date).filter(Boolean).slice(0, 10).join(", ") || "none"}`
    : "No itinerary days yet.";

  const prompt = `You're a concise travel assistant reviewing one trip. Find 2-4 short insights that connect categories together (weather vs. packed items, empty itinerary days, budget vs. how close the trip is) — not just single-stat restatements.

Trip: "${trip.title}", ${trip.start_date || "?"} to ${trip.end_date || "?"} (${daysUntil !== null ? `${daysUntil} days away` : "date unknown"}), cities: ${(trip.cities || []).join(", ") || "none"}.
${criticalDocItems.length > 0 ? `\n⚠️ CRITICAL: Not packed yet: ${criticalDocItems.map((d) => d.name).join(", ")}. ${daysUntil !== null && daysUntil <= 30 ? "Trip is close — this MUST be one of your insights." : "Flag as worth handling early (visas can take weeks)."}\n` : ""}
Weather: ${weatherSummary}
Packing: ${packingSummary}
Itinerary: ${itinerarySummary}
Budget: $${totalSpent} of $${trip.budget_target || 0} target${budgetPct !== null ? ` (${budgetPct}%)` : " (no target set)"}.

Each insight under 20 words, plain tone. Skip budget/weather mentions if no target/data exists. Return fewer insights rather than inventing filler — except the critical document warning above, which must always be included if present.

For each: pick an icon ("rain","calendar","budget","target","sparkle"), an optional action_label (3-5 words) and action_tab ("packing","itinerary","budget", or null).

Return JSON: { "insights": [ { "icon": string, "message": string, "action_label": string|null, "action_tab": string|null } ] }`;

  const res = await base44.integrations.Core.InvokeLLM({ prompt, wantJson: true, model: "gemini_3_flash" });
  const insights = Array.isArray(res?.insights) ? res.insights : [];
  if (insights.length > 0) writeCache(trip.id, insights);
  return insights;
}
