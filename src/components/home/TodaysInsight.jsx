import { Link } from "react-router-dom";
import { Sparkles, ArrowRight } from "lucide-react";

export default function TodaysInsight({ insight }) {
  return (
    <section className="rounded-2xl bg-charcoal p-4 flex items-center gap-4">
      <span className="w-9 h-9 rounded-full bg-[#5A5F45] flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-4 h-4 text-white" />
      </span>
      <div className="flex-1 min-w-0">
        <span className="font-body text-[10px] tracking-[0.18em] uppercase text-[#F5F1EB]/60">AI Assistant</span>
        <p className="font-body text-[15px] font-semibold leading-snug text-[#F5F1EB] mt-0.5">
          {insight || "You have a few things worth a look today."}
        </p>
        <p className="font-body text-[13px] leading-relaxed text-[#F5F1EB]/70 mt-0.5">
          Would you like more help with your plan?
        </p>
      </div>
      <Link
        to="/ai"
        className="inline-flex items-center gap-1.5 flex-shrink-0 bg-[#F5F1EB]/10 hover:bg-[#F5F1EB]/15 text-[#F5F1EB] text-[12px] font-body font-medium px-3.5 py-1.5 rounded-full transition-colors"
      >
        Ask me more <ArrowRight className="w-3 h-3" />
      </Link>
    </section>
  );
}