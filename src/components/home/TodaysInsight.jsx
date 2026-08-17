import { Link } from "react-router-dom";
import { Sparkles, ArrowRight } from "lucide-react";

export default function TodaysInsight({ insight }) {
  return (
    <section className="h-full flex flex-col rounded-2xl bg-charcoal p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-7 h-7 rounded-full bg-[#5A5F45] flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </span>
        <span className="font-body text-[10px] tracking-[0.18em] uppercase text-[#F5F1EB]/60">AI Assistant</span>
      </div>
      <p className="font-body text-[15px] font-semibold leading-snug text-[#F5F1EB]">
        {insight || "You have a few things worth a look today."}
      </p>
      <p className="font-body text-[13px] leading-relaxed text-[#F5F1EB]/70 mt-1.5 flex-1">
        Would you like more help with your plan?
      </p>
      <Link
        to="/ai"
        className="inline-flex items-center gap-1.5 mt-3 self-start bg-[#F5F1EB]/10 hover:bg-[#F5F1EB]/15 text-[#F5F1EB] text-[12px] font-body font-medium px-3.5 py-1.5 rounded-full transition-colors"
      >
        Ask me more <ArrowRight className="w-3 h-3" />
      </Link>
    </section>
  );
}