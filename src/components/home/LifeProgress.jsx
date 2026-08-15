import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export default function LifeProgress({ circles }) {
  const navigate = useNavigate();
  if (!circles.length) return null;

  return (
    <section>
      <h2 className="font-heading text-lg text-foreground font-semibold mb-2.5">Life Progress</h2>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
        {circles.map((c, i) => {
          const r = 22;
          const circ = 2 * Math.PI * r;
          const dash = (c.value / 100) * circ;
          return (
            <button
              key={i}
              onClick={() => navigate(c.path)}
              className="flex-shrink-0 w-[104px] flex flex-col items-center gap-2 py-3.5 px-2 rounded-xl border border-border/50 bg-card hover:border-olive/40 transition-colors"
            >
              <div className="relative w-14 h-14">
                <svg width="56" height="56" className="-rotate-90">
                  <circle cx="28" cy="28" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
                  <motion.circle
                    cx="28" cy="28" r={r}
                    fill="none"
                    stroke="hsl(var(--olive))"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={circ}
                    initial={{ strokeDashoffset: circ }}
                    animate={{ strokeDashoffset: circ - dash }}
                    transition={{ duration: 0.9, delay: 0.15 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[12px] font-heading font-medium text-foreground leading-none">{c.display}</span>
              </div>
              <p className="font-body text-[11px] text-foreground text-center leading-tight line-clamp-2 min-h-[1.75rem] px-0.5">{c.label}</p>
              <span className="flex items-center gap-0.5 text-[9.5px] font-body text-olive leading-none">
                {c.action} <ArrowRight className="w-2.5 h-2.5" />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}