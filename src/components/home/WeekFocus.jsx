import { Link } from "react-router-dom";
import { Sparkles, ChevronRight, Check, Star } from "lucide-react";
import { reviewWeek, isReviewDay, activeFocus } from "@/lib/weekly";

// Sunday and Monday: a card that opens the weekly review.
// All week: a slim strip with the 3 picks as chips (tasks among them are starred in Today).
export default function WeekFocus({ prefs, isDone, onToggle }) {
  const week = reviewWeek();
  const showCard = isReviewDay() && prefs && prefs.review_done_week !== week.key;
  const focus = activeFocus(prefs);
  if (!showCard && !focus) return null;

  const items = focus ? focus.items : [];
  const doneCount = items.filter((it) => isDone(it)).length;

  return (
    <div className="space-y-3">
      {showCard && (
        <Link to="/review" className="flex items-center gap-3 rounded-2xl bg-card border border-[#A7773F]/60 px-3.5 py-3">
          <span className="w-9 h-9 rounded-xl bg-[#A7773F]/10 text-[#A7773F] flex items-center justify-center shrink-0">
            <Sparkles className="w-[18px] h-[18px]" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[14px] text-foreground">Your week is ready</span>
            <span className="block text-[12px] text-muted-foreground">3 minutes · {week.label}</span>
          </span>
          <ChevronRight className="w-4 h-4 text-[#A7773F]" />
        </Link>
      )}
      {focus && (
        <section className="rounded-2xl bg-card border border-border/60 px-3.5 pt-2.5 pb-3">
          <div className="flex items-center gap-2">
            <Star className="w-3.5 h-3.5 text-[#A7773F]" strokeWidth={2} />
            <span className="text-[13px] text-foreground">This week</span>
            <span className="ml-auto text-[12px] text-muted-foreground">{doneCount} of {items.length} done</span>
            <Link to="/review" className="text-[12px] text-[#A7773F] pl-2">Change</Link>
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
