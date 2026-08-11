import { Link } from "react-router-dom";
import { Sparkles, ArrowRight } from "lucide-react";

export default function TodaysInsight({ insight }) {
  return (
    <section className="h-full flex flex-col rounded-2xl bg-charcoal p-4">
      <div className="flex items-center gap-2 mb-2.5">
        <Sparkles className="w-3.5 h-3.5 text-[#F5F1EB]/80" />
        <span className="font-body text-[9px] tracking-[0.22em] uppercase text-[#F5F1EB]/60">Daily Insight</span>
      </div>
      <p className="font-body text-[13px] leading-relaxed text-[#F5F1EB]/90 flex-1 line-clamp-3">
        {insight || "Guía is quietly connecting the dots across your day."}
      </p>
      <Link to="/ai" className="inline-flex items-center gap-1 mt-2.5 text-[11px] font-body text-[#F5F1EB]/70 hover:text-[#F5F1EB] transition-colors w-fit">
        Learn More <ArrowRight className="w-3 h-3" />
      </Link>
    </section>
  );
}