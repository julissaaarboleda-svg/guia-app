import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";

// Matches the reference design: a circular olive button with a sparkle icon,
// bottom-right, navigating into the full AI Assistant page. `stacked` shifts
// it up so it can sit above another floating button (like Projects' "+")
// on pages where the bottom-right corner is already taken.
export default function AskAssistantFab({ stacked = false }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate("/ai")}
      aria-label="Ask Guía"
      title="Ask Guía"
      className="fixed z-40 flex items-center justify-center w-14 h-14 rounded-full shadow-lg hover:opacity-90 transition-opacity"
      style={{
        right: "20px",
        bottom: stacked ? "calc(env(safe-area-inset-bottom, 20px) + 146px)" : "calc(env(safe-area-inset-bottom, 20px) + 76px)",
        backgroundColor: "#5A5F45",
      }}
    >
      <Sparkles className="w-5 h-5 text-white" strokeWidth={1.8} />
    </button>
  );
}
