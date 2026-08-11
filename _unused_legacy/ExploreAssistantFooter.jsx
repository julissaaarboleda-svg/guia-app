import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";

export default function ExploreAssistantFooter({ trip }) {
  const navigate = useNavigate();
  return (
    <div className="bg-card border border-border rounded-[20px] p-4 text-center">
      <h3 className="font-heading text-base text-foreground font-semibold">Need ideas for your trip?</h3>
      <p className="font-body text-xs text-muted-foreground mt-1 mb-3 leading-snug">
        Ask Travel Assistant for personalized recommendations.
      </p>
      <button
        onClick={() => navigate(`/travel-assistant/${trip.id}`)}
        className="inline-flex items-center gap-1.5 bg-accent text-accent-foreground px-5 py-2.5 rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
      >
        <Sparkles className="w-4 h-4" strokeWidth={1.8} /> Ask Travel Assistant
      </button>
    </div>
  );
}