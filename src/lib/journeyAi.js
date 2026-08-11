import { parseISO } from "date-fns";
import { base44 } from "@/api/base44Client";

export const COVER_STYLES = [
  { id: "editorial", label: "Editorial", modifier: "editorial magazine photography, refined composition, natural light, aspirational" },
  { id: "luxury", label: "Luxury", modifier: "ultra-luxury hotel magazine aesthetic, opulent interiors, warm golden-hour lighting" },
  { id: "minimal", label: "Minimal", modifier: "minimalist fine-art photography, quiet negative space, muted palette, serene" },
  { id: "vintage", label: "Vintage Film", modifier: "analog film grain, faded warm tones, 1970s travel-poster mood" },
  { id: "cinematic", label: "Cinematic", modifier: "cinematic wide-frame, dramatic depth, soft cinematic color grading" },
  { id: "mediterranean", label: "Mediterranean", modifier: "Mediterranean summer light, terracotta and cream, breezy coastal calm" },
  { id: "tropical", label: "Tropical", modifier: "tropical paradise, lush foliage, sun-drenched warm tropical palette" },
  { id: "scandinavian", label: "Scandinavian", modifier: "Scandinavian simplicity, wooden architecture, soft Nordic daylight" },
];

export const getStyle = (id) => COVER_STYLES.find((s) => s.id === id) || COVER_STYLES[0];

export function getSeason(dateStr) {
  if (!dateStr) return null;
  const m = parseISO(dateStr).getMonth();
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "autumn";
  return "winter";
}

export function buildCoverPrompt(trip, styleId) {
  const dest = [trip.country, ...(trip.cities || [])].filter(Boolean).join(", ") || trip.title;
  const season = getSeason(trip.start_date);
  const style = getStyle(styleId);
  return `Luxury editorial magazine cover photograph of ${dest}. ${season ? season + " season" : ""}. ${style.modifier}. Golden-hour lighting, warm cinematic color grading, rich shadows, premium editorial composition, luxury travel photography, minimal visual clutter, subtle atmospheric haze, magazine-quality framing. Favor open foreground or open sky with natural breathing room. Avoid bright midday lighting, stock photography, tourist snapshots, busy skylines, landmarks competing with text, overexposed beaches, overly saturated colors. No text, no watermark, no people. Landscape orientation, high-resolution editorial quality.`;
}

export async function generateCover(trip, styleId) {
  const prompt = buildCoverPrompt(trip, styleId);
  const { url } = await base44.integrations.Core.GenerateImage({ prompt });
  return url;
}

export function computePlanningProgress(trip) {
  const checks = [
    !!(trip.description && trip.description.trim()),
    !!(trip.start_date && trip.end_date),
    !!(trip.flights && trip.flights.length > 0) || !!(trip.flight_info && trip.flight_info.outbound && trip.flight_info.outbound.airline),
    !!(trip.stay_info && trip.stay_info.length > 0),
    !!(trip.itinerary && trip.itinerary.some((d) => (d.activities && d.activities.length > 0) || d.title)),
    !!(trip.packing_items && trip.packing_items.length > 0),
    !!trip.budget_target,
    !!(trip.expense_items && trip.expense_items.length > 0),
    !!(trip.about_info && (trip.about_info.short_info || (trip.about_info.hot_spots && trip.about_info.hot_spots.length))),
    !!(trip.wish_list && (trip.wish_list.content || (trip.wish_list.list_items && trip.wish_list.list_items.length))),
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

export function getJourneyCaption(trip) {
  const now = new Date();
  if (!trip.start_date) return "A journey worth dreaming.";
  const start = parseISO(trip.start_date);
  const end = trip.end_date ? parseISO(trip.end_date) : null;
  if (end && now > end) {
    return trip.recap && trip.recap.summary ? "A journey worth remembering." : "Welcome home.";
  }
  if (end && now >= start && now <= end) {
    const dayNum = Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1;
    const total = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
    return `Day ${dayNum} of ${total}. Enjoy every moment.`;
  }
  const days = Math.ceil((start - now) / (1000 * 60 * 60 * 24));
  if (days > 0) {
    if (computePlanningProgress(trip) >= 85) return "Everything is almost ready.";
    return `Adventure begins in ${days} days.`;
  }
  return "Everything is almost ready.";
}

export async function generateTravelBrief(trip) {
  const dest = [trip.country, ...(trip.cities || [])].filter(Boolean).join(", ") || trip.title;
  const season = getSeason(trip.start_date);
  const totalSpent = (trip.expense_items || []).reduce((s, e) => s + (e.amount || 0), 0);
  const context = {
    title: trip.title,
    country: trip.country,
    cities: trip.cities,
    destination: dest,
    season,
    start_date: trip.start_date,
    end_date: trip.end_date,
    budget_target: trip.budget_target,
    budget_used_pct: trip.budget_target ? Math.round((totalSpent / trip.budget_target) * 100) : null,
    total_spent: totalSpent,
    itinerary_days: (trip.itinerary || []).length,
    itinerary_with_activities: (trip.itinerary || []).filter((d) => d.activities && d.activities.length > 0).length,
    stay_count: (trip.stay_info || []).length,
    packing_count: (trip.packing_items || []).length,
    packing_packed: (trip.packing_items || []).filter((p) => p.packed).length,
  };
  // NOTE: this used to hardcode weather as the mandatory first insight (an
  // ungrounded guess, separate from Packing tab's real grounded forecast) —
  // dropped now that weather has one authoritative source. This is 2 insights
  // (budget + itinerary), not 3.
  const prompt = `You are a serene travel curator. Given this journey data, return exactly 2 short editorial insights: one about budget, one about itinerary/planning progress, drawn from the data. Each insight MUST have a headline (concise, under 45 characters) and a detail (one sentence under 70 characters). Be specific, warm, and non-technical. Do not mention the data structure or JSON. Return JSON {insights: [{headline: string, detail: string}]}. Provide exactly 2 insights.\n\nData: ${JSON.stringify(context)}`;
  const res = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: "object",
      properties: { insights: { type: "array", items: { type: "object", properties: { headline: { type: "string" }, detail: { type: "string" } } } } },
    },
  });
  return (res.insights || []).slice(0, 2);
}

// NOTE: generateTravelAssistantInsights() was removed here — it powered the
// standalone Travel Assistant page, which was retired for duplicating the
// weather/budget/itinerary insights already shown by generateTravelBrief()
// above and by Know Before You Go. One AI-generated trip summary instead of three.
