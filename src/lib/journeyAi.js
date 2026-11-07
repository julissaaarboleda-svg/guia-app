import { parseISO } from "date-fns";

export function getSeason(dateStr) {
  if (!dateStr) return null;
  const m = parseISO(dateStr).getMonth();
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "autumn";
  return "winter";
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
