import { Plane, Building2, UtensilsCrossed, MapPin, FileText } from "lucide-react";

// Reconstructed from usage across ItineraryTab.jsx / AddItemSheet.jsx / TimelineCard.jsx —
// the real source was never sent, but the shape (key, label, desc, Icon, color) and the
// 5 types (flight/hotel/restaurant/activity/note) were consistent across every call site.
export const ADD_TYPES = [
  { key: "flight", label: "Flight", desc: "Airline, route, times", Icon: Plane, color: "#3E5C76" },
  { key: "hotel", label: "Hotel", desc: "Check-in / check-out", Icon: Building2, color: "#5B7A4F" },
  { key: "restaurant", label: "Restaurant", desc: "Reservation or dinner plan", Icon: UtensilsCrossed, color: "#A65A4A" },
  { key: "activity", label: "Activity", desc: "Sightseeing, tour, event", Icon: MapPin, color: "#7C6A52" },
  { key: "note", label: "Note", desc: "A reminder for this day", Icon: FileText, color: "#8B6A3F" },
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
