import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";

export default function TodaysInsight({ insight }) {
  return (
    <Link
      to="/ai"
      className="rounded-2xl bg-charcoal p-3.5 flex items-center gap-3 hover:opacity-90 transition-opacity"
    >
      <span className="w-6 h-6 rounded-full bg-[#5A5F45] flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-3 h-3 text-white" />
      </span>
      <div className="flex-1 min-w-0">
        <span className="font-body text-[8.5px] tracking-[0.14em] uppercase text-[#F5F1EB]/60">AI Assistant</span>
        <p className="font-body text-[11px] leading-snug text-[#F5F1EB] mt-0.5 line-clamp-2">
          {insight || "You have a few things worth a look today."}
        </p>
      </div>
      <span className="flex-shrink-0 text-[#F5F1EB]/50 text-[11px] font-body">→</span>
    </Link>
  );
}