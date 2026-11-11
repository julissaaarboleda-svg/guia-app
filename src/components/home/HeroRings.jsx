import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

// Compact 2 x 2 Life Progress rings for the right half of the home banner.
const shortSub = (s = "") => s.replace(/\$([\d,]+)/g, (m, n) => {
  const v = Number(n.replace(/,/g, ""));
  return v >= 10000 ? `$${Math.round(v / 1000)}k` : m;
}).replace(" this week", " this wk").replace(" saved", "");

export default function HeroRings({ circles, onCustomize }) {
  const navigate = useNavigate();
  return (
    <div className="h-full flex flex-col px-2.5 pt-2.5 pb-2 lg:px-5 lg:pt-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9.5px] tracking-[0.16em] uppercase text-muted-foreground">Life progress</span>
        <button onClick={onCustomize} className="text-[10.5px] font-medium text-[#A7773F]">Customize</button>
      </div>
      <div className="grid grid-cols-2 gap-x-1.5 gap-y-1 flex-1 content-center">
        {circles.slice(0, 4).map((c, i) => {
          const r = 17; const circ = 2 * Math.PI * r;
          const dash = (Math.min(100, Math.max(0, c.value)) / 100) * circ;
          return (
            <button key={i} onClick={() => navigate(c.path)} className={`flex flex-col items-center text-center min-w-0 ${c.empty ? "opacity-50" : ""}`}>
              <span className="relative w-[42px] h-[42px] lg:w-[50px] lg:h-[50px]">
                <svg viewBox="0 0 42 42" className="w-full h-full -rotate-90">
                  <circle cx="21" cy="21" r={r} fill="none" stroke="#EFE9DF" strokeWidth="3.5" />
                  <motion.circle cx="21" cy="21" r={r} fill="none" stroke={c.color} strokeWidth="3.5" strokeLinecap="round"
                    strokeDasharray={circ} initial={{ strokeDashoffset: circ }} animate={{ strokeDashoffset: circ - dash }}
                    transition={{ duration: 0.9, delay: 0.2 + i * 0.08, ease: [0.16, 1, 0.3, 1] }} />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center font-heading text-[11px] text-foreground">{c.display}</span>
              </span>
              <span className="text-[10.5px] font-medium text-foreground leading-tight mt-0.5 truncate max-w-full">{c.label}</span>
              <span className="text-[9px] text-muted-foreground leading-tight truncate max-w-full">
                <span className="lg:hidden">{shortSub(c.sub)}</span><span className="hidden lg:inline">{c.sub}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
