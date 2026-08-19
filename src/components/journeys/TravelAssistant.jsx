import { Link } from "react-router-dom";
import { Sparkles, ArrowRight } from "lucide-react";

// Rotating, always-instant invitation instead of an AI call — cycles
// through in order by day. The "check your Saved places" prompt is skipped
// entirely if the trip already has saved places, so it's not suggesting
// something that's already been done.
const BASE_INVITATIONS = [
  "Need recommendations for new places? Check the Saved tab, or just ask me.",
  "Not sure what to pack? Ask me for a hand.",
  "Want ideas for a free afternoon? I can help you plan it.",
  "Curious what's nearby? Ask me, or explore your Saved spots.",
  "Need help budgeting for this trip? I'm here for that too.",
];

function getTravelInvitation(trip) {
  const hasSavedPlaces = (trip?.about_info?.hot_spots || []).length > 0;
  const pool = hasSavedPlaces
    ? BASE_INVITATIONS.filter((m) => !m.toLowerCase().includes("saved"))
    : BASE_INVITATIONS;
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return pool[dayOfYear % pool.length];
}

export default function TravelAssistant({ trip, onNavigate }) {
  const message = getTravelInvitation(trip);

  return (
    <Link
      to="/ai"
      className="bg-card border border-border rounded-2xl p-3.5 flex items-center gap-3 hover:border-ring/40 transition-colors"
    >
      <span className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#A7773F1F" }}>
        <Sparkles className="w-4 h-4" style={{ color: "#A7773F" }} />
      </span>
      <p className="font-body text-[13px] text-foreground leading-snug flex-1 min-w-0">{message}</p>
      <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
    </Link>
  );
}
