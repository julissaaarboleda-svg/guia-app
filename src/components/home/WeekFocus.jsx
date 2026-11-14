import { Link } from "react-router-dom";
import { Sparkles, ChevronRight, Check } from "lucide-react";
import { reviewWeek, isReviewDay, activeFocus } from "@/lib/weekly";

// Sunday and Monday: a card that opens the weekly review. All week: the 3 picks from it.
export default function WeekFocus({ prefs, onToggle }) {
  const week = reviewWeek();
  const showCard = isReviewDay() && prefs && prefs.review_done_week !== week.key;
  const focus = activeFocus(prefs);
  if (!showCard && !focus) return null;

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
        <section>
          <div className="flex items-end justify-between mb-2">
            <h2 className="font-heading text-lg text-foreground font-semibold">This week's 3</h2>
            <Link to="/review" className="text-[12px] text-muted-foreground">Change</Link>
          </div>
          <div className="rounded-2xl bg-card overflow-hidden">
            {focus.items.map((it, i) => {
              const done = !!focus.done?.[it.id];
              return (
                <button key={it.id} type="button" onClick={() => onToggle(it, !done)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left ${i ? "border-t border-border/40" : ""}`}>
                  <span className={`w-[18px] h-[18px] rounded-full border flex items-center justify-center shrink-0 ${done ? "bg-[#A7773F] border-[#A7773F]" : "border-border"}`}>
                    {done && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  </span>
                  <span className={`text-[14px] truncate ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>{it.text}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
