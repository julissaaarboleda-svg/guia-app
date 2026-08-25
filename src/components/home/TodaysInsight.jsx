import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
export default function TodaysInsight({ insight }) {
  return (
    <Link
      to="/ai"
      className="rounded-2xl bg-[#F1EEE5] border border-[#E3DED0] p-3.5 flex items-center gap-3 hover:border-[#A7773F]/40 transition-colors"
    >
      <span className="w-6 h-6 rounded-full bg-[#7D8A53]/15 flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-3 h-3 text-[#5F6A3F]" />
      </span>
      <div className="flex-1 min-w-0">
        <span className="font-body text-[8.5px] tracking-[0.14em] uppercase text-[#8A857A]">AI Assistant</span>
        <p className="font-body text-[11px] leading-snug text-[#2E2A27] mt-0.5 line-clamp-2">
          {insight || "You have a few things worth a look today."}
        </p>
      </div>
      <span className="flex-shrink-0 text-[#A7773F] text-[11px] font-body">→</span>
    </Link>
  );
}
