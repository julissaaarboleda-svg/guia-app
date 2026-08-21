import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Sparkles, ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { computeSignature } from "@/lib/packingAi";
import { generateTravelTip } from "@/lib/travelTip";

// Static fallback shown only if generation genuinely fails (e.g. Gemini is
// temporarily overloaded) — never shown by default anymore, unlike the old
// always-static version of this card.
const FALLBACK_TIP = "Want ideas for a free afternoon? I can help you plan it.";

export default function TravelAssistant({ trip }) {
  const [tip, setTip] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!trip) return;
    let alive = true;

    const signature = computeSignature(trip);
    const saved = trip.travel_tip;

    // Cached on the trip itself — instant load, works across devices, and
    // only regenerates when something meaningful about the trip changes.
    if (saved && saved.signature === signature && saved.tip) {
      setTip(saved.tip);
      setLoading(false);
      return;
    }

    setLoading(true);
    generateTravelTip(trip)
      .then((result) => {
        if (!alive) return;
        if (result.tip) {
          setTip(result.tip);
          setLoading(false);
          base44.entities.Trip.update(trip.id, { travel_tip: result }).catch((err) =>
            console.error("Failed to save travel_tip to trip:", err)
          );
        } else {
          setTip(FALLBACK_TIP);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("generateTravelTip failed:", err);
        if (alive) {
          setTip(FALLBACK_TIP);
          setLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [trip?.id]);

  return (
    <Link
      to="/ai"
      className="w-full bg-foreground text-background rounded-2xl px-4 py-3.5 flex items-center gap-2.5 hover:opacity-90 transition-opacity"
    >
      <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: "#A7773F" }} />
      <span className="font-body text-[13px] flex-1 min-w-0 leading-snug">
        {loading ? "Thinking about your trip…" : tip}
      </span>
      <ArrowRight className="w-4 h-4 flex-shrink-0 opacity-70" />
    </Link>
  );
}
