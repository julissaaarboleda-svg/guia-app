import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { getModule } from "@/lib/homeModules";
const PRIORITY_CHIP = {
  high: "bg-forest/10 text-forest",
  urgent: "bg-forest/15 text-forest",
  normal: "bg-olive/10 text-olive",
  low: "bg-muted text-muted-foreground",
};
export default function TodaysFocus({ items, total = 0, onComplete }) {
  const [completingIds, setCompletingIds] = useState(new Set());
  const handleComplete = (it) => {
    if (completingIds.has(it.id)) return;
    setCompletingIds((prev) => new Set(prev).add(it.id));
    setTimeout(() => {
      onComplete(it);
      // Clean up afterward — this used to never happen, so a stale id
      // could sit in the set indefinitely. Combined with homeData.js's old
      // index-based IDs (now fixed to be content-based), a stale entry
      // here could end up matching a completely different item that later
      // reused the same id, making it look auto-checked.
      setCompletingIds((prev) => {
        const next = new Set(prev);
        next.delete(it.id);
        return next;
      });
    }, 320);
  };
  return (
    <section>
      <div className="flex items-end justify-between mb-2.5">
        <h2 className="font-heading text-lg text-foreground font-semibold">Today’s Focus</h2>
        <Link to="/goals" className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          {total > items.length ? `View All (${total})` : "View all"} <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-[13px] text-muted-foreground font-body py-5 text-center">Nothing pressing today. A calm, open day.</p>
      ) : (
        <div className="rounded-2xl bg-card overflow-hidden">
          {items.map((it, i) => {
            const mod = getModule(it.module);
            const Icon = mod.Icon;
            const isCompleting = completingIds.has(it.id);
            return (
              <div
                key={it.id}
                className={`flex items-center gap-3 px-3.5 py-2 transition-opacity duration-300 ${i !== 0 ? "border-t border-border/40" : ""} ${isCompleting ? "opacity-40" : ""}`}
              >
                <button
                  onClick={() => handleComplete(it)}
                  aria-label="Mark complete"
                  disabled={isCompleting}
                  className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors group ${
                    isCompleting ? "border-forest bg-forest/10" : "border-muted-foreground/30 hover:border-forest hover:bg-forest/10"
                  }`}
                >
                  <Check className={`w-2.5 h-2.5 text-forest transition-opacity ${isCompleting ? "opacity-100" : "opacity-0 group-hover:opacity-60"}`} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-[13.5px] text-foreground truncate leading-snug">{it.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${mod.color}18`, color: mod.color }}
                    >
                      <Icon className="w-2 h-2" />
                    </span>
                    <span className="font-body text-[10px] text-muted-foreground">{mod.label}</span>
                  </div>
                </div>
                <span className={`text-[9px] font-body font-medium px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${PRIORITY_CHIP[it.priority] || PRIORITY_CHIP.normal}`}>
                  {it.priority}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
