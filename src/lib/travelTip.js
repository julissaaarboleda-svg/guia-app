import { base44 } from "@/api/base44Client";
import { computeSignature } from "@/lib/packingAi";

// Generates ONE short, genuinely useful, trip-specific tip — grounded in the
// trip's real cities, dates, itinerary gaps, packing/budget status. No web
// search (add_context_from_internet is intentionally omitted) so this stays
// fast and avoids the Netlify function timeout that broke the old
// TravelAssistantPage / TravelBrief attempts.
export async function generateTravelTip(trip) {
  const cities = trip.cities || [];
  const itinerary = trip.itinerary || [];
  const daysNeedingActivities = itinerary.filter((d) => !d.activities || d.activities.length === 0).length;
  const packing = trip.packing_items || [];
  const packingRemaining = packing.filter((p) => !p.packed).length;
  const totalSpent = (trip.expense_items || []).reduce((s, e) => s + (e.amount || 0), 0);
  const budgetPct = trip.budget_target ? Math.round((totalSpent / trip.budget_target) * 100) : null;

  const context = {
    title: trip.title,
    cities,
    country: trip.country,
    start_date: trip.start_date,
    end_date: trip.end_date,
    days_needing_activities: daysNeedingActivities,
    packing_items_remaining: packingRemaining,
    budget_percent_used: budgetPct,
  };

  const prompt = `You are a concise, helpful travel planning assistant inside the Guía app. Based on this trip's current state, write ONE short, genuinely useful tip or nudge (under 100 characters) — the single most useful thing this traveler should think about right now. Prioritize whichever is most actionable: an itinerary gap, packing progress, or budget status. If nothing is urgent, offer a light, specific suggestion tied to their actual destination(s) instead of something generic.

Trip data:
${JSON.stringify(context, null, 2)}

Return JSON: { tip: string }`;

  const res = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: "object",
      properties: { tip: { type: "string" } },
    },
  });

  return {
    tip: res?.tip || null,
    signature: computeSignature(trip),
    generatedAt: Date.now(),
  };
}
