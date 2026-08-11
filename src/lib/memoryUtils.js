import { base44 } from "@/api/base44Client";
import { parseISO, format, differenceInCalendarDays } from "date-fns";

// Real source was never sent — every function here is reconstructed from how it's
// actually called in ItineraryTab.jsx, SavedTab.jsx, and MemoriesTab.jsx. Shapes
// should be right; exact copy/thresholds are reasonable guesses.

// ---- Saving a place to memories (called from Itinerary + Saved tabs) ----
export async function savePlaceToMemories(trip, place) {
  const existing = trip.memory_places || [];
  const dup = existing.some(
    (p) => p.name?.toLowerCase() === place.name?.toLowerCase() && p.city === place.city
  );
  if (dup) return { added: false, trip };

  const record = {
    id: (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()),
    favorited: false,
    ...place,
  };
  const updated = await base44.entities.Trip.update(trip.id, {
    memory_places: [...existing, record],
  });
  return { added: true, trip: updated };
}

export function categoryFromActivity(activity) {
  const text = `${activity?.activity || ""} ${activity?.name || ""}`.toLowerCase();
  if (/dinner|lunch|breakfast|restaurant/.test(text)) return "restaurant";
  if (/coffee|café|cafe/.test(text)) return "cafe";
  if (/museum|gallery/.test(text)) return "museum";
  if (/hotel|stay/.test(text)) return "attractions";
  return "experience";
}

// ---- Memories tab summary helpers ----
export function tripMonthYear(trip) {
  if (!trip?.start_date) return "";
  return format(parseISO(trip.start_date), "MMMM yyyy");
}

export function tripDuration(trip) {
  if (!trip?.start_date || !trip?.end_date) return null;
  return differenceInCalendarDays(parseISO(trip.end_date), parseISO(trip.start_date)) + 1;
}

export function memoriesTotal(trip) {
  const places = (trip?.memory_places || []).length;
  const media = (trip?.memory_media || []).length;
  const notes = visibleNotes(trip).length;
  return places + media + notes;
}

export function pickCoverImage(trip) {
  const favPlace = (trip?.memory_places || []).find((p) => p.favorited && p.image);
  if (favPlace) return favPlace.image;
  const favMedia = (trip?.memory_media || []).find((m) => m.favorited && (m.thumbnail || m.url));
  if (favMedia) return favMedia.thumbnail || favMedia.url;
  return trip?.hero_image_url || null;
}

export function reflectionLine(trip) {
  const plain = (trip?.recap?.summary || "").replace(/<[^>]*>/g, "").trim();
  if (plain) return plain.slice(0, 80) + (plain.length > 80 ? "…" : "");
  return "A journey to remember.";
}

export function computeStoryProgress(trip) {
  const checks = [
    (trip?.memory_places || []).length > 0,
    (trip?.memory_media || []).length > 0,
    !!(trip?.recap?.summary || "").replace(/<[^>]*>/g, "").trim(),
    !!trip?.hero_image_url,
    memoriesTotal(trip) >= 5,
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

export function continueArea(trip) {
  if (!(trip?.memory_places || []).length) return "places";
  if (!(trip?.memory_media || []).length) return "photos";
  if (!(trip?.recap?.summary || "").trim()) return "notes";
  return "story";
}

export function visiblePlaces(trip) {
  return trip?.memory_places || [];
}

export function visibleMedia(trip) {
  return trip?.memory_media || [];
}

export function visibleNotes(trip) {
  const highlights = (trip?.recap?.highlights || []).map((h) => ({ text: h.text, favorited: false }));
  return highlights;
}
