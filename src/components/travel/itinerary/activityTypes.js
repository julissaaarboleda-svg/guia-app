import { Plane, Building2, UtensilsCrossed, MapPin, FileText } from "lucide-react";
// Reconstructed from usage across ItineraryTab.jsx / AddItemSheet.jsx / TimelineCard.jsx —
// the real source was never sent, but the shape (key, label, desc, Icon, color) and the
// 5 types (flight/hotel/restaurant/activity/note) were consistent across every call site.
//
// Colors updated to the real brand palette (Cognac/Olive/Dusty Mauve, plus two
// closely-related on-brand tones already used for person-avatar colors
// elsewhere in the app) — the previous blue/green/terracotta values weren't
// actually part of the brand at all.
export const ADD_TYPES = [
  { key: "flight", label: "Flight", desc: "Airline, route, times", Icon: Plane, color: "#A7773F" },
  { key: "hotel", label: "Stay", desc: "Check-in / check-out", Icon: Building2, color: "#7D8A53" },
  { key: "restaurant", label: "Restaurant", desc: "Reservation or dinner plan", Icon: UtensilsCrossed, color: "#A77C81" },
  { key: "activity", label: "Activity", desc: "Sightseeing, tour, event", Icon: MapPin, color: "#6B655D" },
  { key: "note", label: "Note", desc: "A reminder for this day", Icon: FileText, color: "#8A6530" },
];
export const ADD_TYPE_BY_KEY = Object.fromEntries(ADD_TYPES.map((t) => [t.key, t]));
export function getActivityType(activity) {
  const text = `${activity?.activity || ""} ${activity?.name || ""}`.toLowerCase();
  if (/flight|airline|airport/.test(text)) return { ...ADD_TYPE_BY_KEY.flight, key: "flight" };
  if (/hotel|check-in|check-out|stay/.test(text)) return { ...ADD_TYPE_BY_KEY.hotel, key: "hotel" };
  if (/dinner|lunch|breakfast|restaurant|reservation/.test(text)) return { ...ADD_TYPE_BY_KEY.restaurant, key: "restaurant" };
  if (/note|reminder/.test(text)) return { ...ADD_TYPE_BY_KEY.note, key: "note" };
  return { ...ADD_TYPE_BY_KEY.activity, key: "activity" };
}
export function formatTime(time24) {
  if (!time24) return "";
  const [h, m] = time24.split(":").map(Number);
  const ap = h < 12 ? "AM" : "PM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}
