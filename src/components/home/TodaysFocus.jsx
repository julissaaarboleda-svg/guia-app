import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { getModule } from "@/lib/homeModules";
import { colorOf, dayKey, isScheduled, doneOn, completeOn, stepsFor } from "@/lib/routines";
const PRIORITY_CHIP = {
  high: "bg-[#F3E8D6] text-[#8A5F27]",
  urgent: "bg-[#F4E6E7] text-[#8F5F65]",
  normal: "bg-[#E4E9D5] text-[#566033]",
  low: "bg-muted text-muted-foreground",
};
export default function TodaysFocus({ items, total = 0, onComplete, routines = [], onRoutineToggle, overdue = 0 }) {
  // The bug: sub-item ids (goal sub-tasks, project tasks, packing items)
  // are built from their array index. Completing one shifts every later
  // item's index down by one, so a completely different item can inherit
  // the id that was just marked "completing" a moment ago — making it look
  // auto-checked. Rather than change the id scheme (which the parent's
  // completion logic likely depends on via `subIndex`), this keeps its own
  // frozen copy of the list and only re-syncs from the parent once nothing
  // is mid-animation — so a shifted list from the parent can never arrive
  // while a completion is still playing out.
  const [localItems, setLocalItems] = useState(items);
  const [completingIds, setCompletingIds] = useState(new Set());

  useEffect(() => {
    if (completingIds.size === 0) setLocalItems(items);
  }, [items, completingIds.size]);

  const handleComplete = (it) => {
    if (completingIds.has(it.id)) return;
    setCompletingIds((prev) => new Set(prev).add(it.id));
    setTimeout(() => {
      onComplete(it);
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
        <h2 className="font-heading text-[20px] text-foreground">Today</h2>
        <Link to="/goals" className="flex items-center gap-1 text-[11px] font-medium text-[#A7773F] transition-colors">
          {total > localItems.length ? `View All (${total})` : "View all"} <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      {(() => {
        const today = dayKey();
        const due = routines.filter((r) => isScheduled(r) && stepsFor(r).length);
        const doneCount = due.filter((r) => completeOn(r, today)).length;
        const head = "flex items-center justify-between px-3.5 pt-2.5 pb-1 text-[10px] tracking-[0.14em] uppercase text-muted-foreground";
        return (
          <div className="rounded-2xl bg-card border border-border/60 overflow-hidden">
            {(localItems.length > 0 || due.length > 0) && (
              <div className={head}>
                <span>Tasks</span>
                {overdue > 0 && <Link to="/goals?view=tasks" className="normal-case tracking-normal text-[11px] font-medium text-[#8F5F65]">{overdue} overdue</Link>}
              </div>
            )}
      {localItems.length === 0 ? (
        <p className="text-[13px] text-muted-foreground font-body py-4 text-center">Nothing pressing today. A calm, open day.</p>
      ) : (
        <div>
          {localItems.map((it, i) => {
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
                  <Check className={`w-2.5 h-2.5 text-forest transition-opacity ${isCompleting ? "opacity-100" : "opacity-0 [@media(hover:hover)]:group-hover:opacity-60"}`} />
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
            {due.length > 0 && (
              <>
                <div className={`${head} border-t border-border/60 mt-1`}>
                  <span>Routines</span>
                  <span className="normal-case tracking-normal text-[11px]">{doneCount} of {due.length} done</span>
                </div>
                <div className="grid grid-cols-2 gap-2 px-3 pt-1 pb-3">
                  {due.map((r) => {
                    const c = colorOf(r); const n = stepsFor(r).length; const d = doneOn(r, today); const fin = d >= n;
                    const slot = { morning: "Morning", evening: "Evening" }[r.slot] || "Anytime";
                    return (
                      <div key={r.id} className="rounded-xl border border-border/60 bg-background/40 p-2.5 flex flex-col">
                        <div className="flex items-start gap-2">
                          <Link to="/goals?view=routines" className="flex-1 min-w-0">
                            <span className="block text-[9.5px] tracking-[0.14em] uppercase font-medium" style={{ color: c }}>{slot}</span>
                            <span className="block font-heading text-[14px] leading-[1.2] text-foreground line-clamp-2 min-h-[2.4em] mt-0.5">{r.name.replace(/^(morning|evening)\s*[·:-]\s*/i, "")}</span>
                          </Link>
                          <button onClick={() => onRoutineToggle?.(r, !fin)} aria-label={fin ? `Undo ${r.name}` : `Complete ${r.name}`}
                            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                            style={fin ? { background: c } : { border: `1.5px solid ${c}` }}>
                            <Check className="w-4 h-4" strokeWidth={2.4} style={{ color: fin ? "#fff" : c }} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="flex-1 h-1 rounded-full bg-[#EFE9DF] overflow-hidden"><span className="block h-full rounded-full transition-all" style={{ width: `${Math.round((d / n) * 100)}%`, background: c }} /></span>
                          <span className="text-[10.5px] text-muted-foreground whitespace-nowrap">{fin ? "Done" : `${d} of ${n}`}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        );
      })()}
    </section>
  );
}
