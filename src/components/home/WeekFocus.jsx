import { Check, Star } from "lucide-react";
import { activeFocus } from "@/lib/weekly";

// All week: a slim strip with the 3 picks as chips (tasks among them are starred in Today).
// The weekly review itself comes as a pop-up (WeeklyPopup); "Change" reopens its picks.
export default function WeekFocus({ prefs, isDone, onToggle }) {
  const focus = activeFocus(prefs);
  if (!focus) return null;

  const items = focus ? focus.items : [];
  const doneCount = items.filter((it) => isDone(it)).length;

  return (
    <div className="space-y-3">
      {focus && (
        <section className="rounded-2xl bg-card border border-border/60 px-3.5 pt-2.5 pb-3">
          <div className="flex items-center gap-2">
            <Star className="w-3.5 h-3.5 text-[#A7773F]" strokeWidth={2} />
            <span className="text-[13px] text-foreground">This week</span>
            <span className="ml-auto text-[12px] text-muted-foreground">{doneCount} of {items.length} done</span>
            <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("guia:weekly-open", { detail: { mode: "change" } }))} className="text-[12px] text-[#A7773F] pl-2">Change</button>
          </div>
          <div className="h-1 rounded-full bg-[#EFE8DC] overflow-hidden mt-2 mb-2.5">
            <div className="h-full rounded-full bg-[#A7773F] transition-all duration-300" style={{ width: `${items.length ? Math.round((doneCount / items.length) * 100) : 0}%` }} />
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-0.5 px-0.5">
            {items.map((it) => {
              const done = isDone(it);
              return (
                <button key={it.id} type="button" onClick={() => onToggle(it, !done)} title={it.text}
                  className={`inline-flex items-center gap-1 shrink-0 max-w-[70%] text-[12px] rounded-full px-2.5 py-1 border transition-colors ${done ? "bg-[#F3EEE5] border-border/60 text-muted-foreground line-through" : "bg-card border-border text-foreground"}`}>
                  {done && <Check className="w-3 h-3 shrink-0 no-underline" strokeWidth={2.5} />}
                  <span className="truncate">{it.text}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
