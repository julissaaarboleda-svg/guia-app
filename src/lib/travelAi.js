import { base44 } from "@/api/base44Client";
import { getTripWeather } from "@/lib/packingAi";

// Lightweight cache so this doesn't re-run the AI call every time someone
// revisits the Journeys page — same spirit as savedAi.js's image cache.
const CACHE_KEY_PREFIX = "guia:travel-insights:";
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

  const prompt = `You're a sharp, concise travel planning assistant reviewing someone's trip. Look ACROSS the data below — don't just restate a single number, find genuine connections between categories (e.g. weather vs. what's packed, how many days are unplanned, whether budget tracking matches how close the trip is).

Trip: "${trip.title}", ${trip.start_date || "no start date"} to ${trip.end_date || "no end date"}, cities: ${(trip.cities || []).join(", ") || "none listed"}.

Weather forecast data: ${weather ? JSON.stringify(weather) : "not available"}

Packing list (${packing.length} items, ${packedCount} packed, ${packingPct ?? "?"}% done): ${JSON.stringify(packing.slice(0, 30))}

Itinerary (${itinerary.length} days planned, ${emptyDays.length} of them have no activities yet — empty day dates: ${emptyDays.map((d) => d.date).filter(Boolean).join(", ") || "none"}): ${itineraryPct !== null ? itineraryPct + "% of days have at least one activity" : "no days yet"}

Budget: $${totalSpent} logged of a $${trip.budget_target || 0} target (${budgetPct ?? "no target set"}%).

Write 2-4 short, genuinely useful insights (each under 20 words, plain conversational tone, no fluff). Prioritize things that connect two different categories over single-stat observations. Only mention budget if a target is actually set. Only mention weather if forecast data is available. If everything looks genuinely fine with nothing to flag, return fewer insights rather than inventing filler ones.

For each insight, also decide: does it have an icon (choose one of: "rain", "calendar", "budget", "target", "sparkle"), a short action_label (3-5 words, only if there's a clear next step, e.g. "Add rain gear"), and which tab it relates to (one of: "packing", "itinerary", "budget", or null if none).

Return as JSON: { "insights": [ { "icon": string, "message": string, "action_label": string|null, "action_tab": string|null } ] }`;

  const res = await base44.integrations.Core.InvokeLLM({ prompt, wantJson: true });
  const insights = Array.isArray(res?.insights) ? res.insights : [];
  if (insights.length > 0) writeCache(trip.id, insights);
  return insights;
}
