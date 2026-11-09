import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export default function LifeProgress({ circles, onCustomize }) {
  const navigate = useNavigate();
  if (!circles.length) return null;

  return (
    <section>
      <div className="flex items-baseline justify-between mb-2.5">
        <h2 className="font-heading text-[20px] text-foreground">Life Progress</h2>
        {onCustomize && <button onClick={onCustomize} className="text-[13px] font-medium text-[#A7773F]">Customize</button>}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {circles.map((c, i) => {
          const r = 20;
          const circ = 2 * Math.PI * r;
          const dash = (Math.min(100, Math.max(0, c.value)) / 100) * circ;
          return (
            <button
              key={i}
              onClick={() => navigate(c.path)}
              className={`flex items-center gap-3 p-3 rounded-2xl border border-border/60 bg-card text-left hover:border-[#A7773F]/50 transition-colors min-w-0 ${c.empty ? "opacity-60" : ""}`}
            >
              <div className="relative w-[48px] h-[48px] flex-shrink-0">
                <svg width="48" height="48" className="-rotate-90">
                  <circle cx="24" cy="24" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
                  <motion.circle
                    cx="24" cy="24" r={r}
                    fill="none"
                    stroke="#A7773F"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={circ}
                    initial={{ strokeDashoffset: circ }}
                    animate={{ strokeDashoffset: circ - dash }}
                    transition={{ duration: 0.9, delay: 0.15 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[11px] font-heading text-foreground leading-none">{c.display}</span>
              </div>
              <div className="min-w-0">
                <p className="font-body text-[12.5px] font-medium text-foreground leading-tight line-clamp-2">{c.label}</p>
                {c.sub && <p className="font-body text-[10.5px] text-muted-foreground mt-0.5 truncate">{c.sub}</p>}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
