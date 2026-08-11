import { UtensilsCrossed, Coffee, Landmark, Ticket, ShoppingBag, Trees, Moon, Sparkles, Camera } from "lucide-react";

export const CATEGORY_META = {
  restaurant: { label: "Restaurant", Icon: UtensilsCrossed, color: "#A65A4A" },
  cafe: { label: "Café", Icon: Coffee, color: "#A68D6F" },
  museum: { label: "Museum", Icon: Landmark, color: "#8F7D66" },
  attractions: { label: "Attractions", Icon: Camera, color: "#A87B5C" },
  shopping: { label: "Shopping", Icon: ShoppingBag, color: "#9B7A5E" },
  nature: { label: "Nature", Icon: Trees, color: "#6E8B5A" },
  nightlife: { label: "Nightlife", Icon: Moon, color: "#6B5B7B" },
  relax: { label: "Relax", Icon: Sparkles, color: "#B89A6C" },
  experience: { label: "Experience", Icon: Ticket, color: "#735359" },
};

export const CATEGORY_CHIPS = [
  { value: "all", label: "All" },
  { value: "restaurant", label: "Restaurants" },
  { value: "cafe", label: "Coffee" },
  { value: "museum", label: "Museums" },
  { value: "attractions", label: "Attractions" },
  { value: "shopping", label: "Shopping" },
  { value: "nature", label: "Nature" },
  { value: "nightlife", label: "Nightlife" },
  { value: "relax", label: "Relax" },
];

export const PRICE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "$", label: "$" },
  { value: "$$", label: "$$" },
  { value: "$$$", label: "$$$" },
  { value: "$$$$", label: "$$$$" },
];

export const WISHLIST_FILTERS = [
  { value: "all", label: "All" },
  { value: "restaurant", label: "Restaurant" },
  { value: "cafe", label: "Coffee" },
  { value: "museum", label: "Museum" },
  { value: "attractions", label: "Attractions" },
  { value: "shopping", label: "Shopping" },
  { value: "nature", label: "Nature" },
  { value: "experience", label: "Experiences" },
];

export function categoryMeta(category) {
  return CATEGORY_META[(category || "").toLowerCase()] || { label: (category || "Pick"), Icon: Landmark, color: "#8B6A3F" };
}