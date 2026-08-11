import { Calendar, Plus } from "lucide-react";
import { parseISO, format } from "date-fns";

export default function DateStrip({ days, activeIndex, onSelect, onAddDay }) {
  if (!days || days.length === 0) return null;
  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
      {days.map((d, i) => {
        const active = i === activeIndex;
        const date = d.date ? parseISO(d.date) : null;
        return (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className={`flex-shrink-0 w-[58px] py-2 rounded-xl text-center transition-colors border ${
              active
                ? "bg-accent border-accent text-accent-foreground"
                : "bg-card border-border text-foreground hover:border-ring/40"
            }`}
          >
            <span className={`block font-body text-[10px] uppercase tracking-[0.08em] leading-none ${active ? "opacity-80" : "text-muted-foreground"}`}>
              {date ? format(date, "EEE") : "Day"}
            </span>
            <span className="block font-body text-[13px] font-semibold leading-tight mt-1">
              {date ? format(date, "MMM d") : d.day}
            </span>
          </button>
        );
      })}
      {onAddDay && (
        <button
          onClick={onAddDay}
          className="flex-shrink-0 w-[58px] py-2 rounded-xl border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-ring/40 transition-colors flex flex-col items-center justify-center"
          aria-label="Add day"
        >
          <Plus className="w-4 h-4" />
        </button>
      )}
      <div className="flex-shrink-0 w-9 flex items-center justify-center text-muted-foreground/50">
        <Calendar className="w-4 h-4" />
      </div>
    </div>
  );
}