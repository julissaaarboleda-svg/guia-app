import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { getModule } from "@/lib/homeModules";

export default function UpNext({ items }) {
  return (
    <section className="h-full flex flex-col rounded-2xl border border-border/50 bg-card p-3">
      <div className="flex items-end justify-between mb-2.5">
        <h2 className="font-heading text-lg text-foreground font-semibold">Up Next</h2>
        <Link to="/travel" className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-[12px] text-muted-foreground font-body py-4 text-center flex-1 flex items-center justify-center">No upcoming commitments.</p>
      ) : (
        <div className="flex gap-2.5 overflow-x-auto no-scrollbar snap-x snap-mandatory flex-1">
          {items.map((it) => {
            const mod = getModule(it.module);
            const Icon = mod.Icon;
            const days = it._days;
            const countdownEl = days == null ? (
              <span className="font-heading text-base text-foreground">{it.countdown}</span>
            ) : days === 0 ? (
              <span className="font-heading text-base text-foreground">Today</span>
            ) : days === 1 ? (
              <span className="font-heading text-base text-foreground">1 <span className="text-[10px] font-body text-muted-foreground">day</span></span>
            ) : (
              <span className="font-heading text-xl text-foreground">{days} <span className="text-[10px] font-body text-muted-foreground">days</span></span>
            );
            return (
              <Link
                key={it.id}
                to={it.path}
                className="snap-start flex-shrink-0 w-[82%] flex flex-col gap-1.5 rounded-xl border border-border/40 bg-background/40 p-3 hover:border-olive/40 transition-colors min-w-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${mod.color}14`, color: mod.color }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <p className="font-body text-[12px] text-foreground leading-tight line-clamp-1 flex-1 min-w-0">{it.title}</p>
                </div>
                <p className="font-body text-[10px] text-muted-foreground">{it.dateLabel}</p>
                <div className="flex items-end justify-between mt-auto pt-0.5">
                  {countdownEl}
                  {it.status && (
                    <span className="text-[9px] font-body font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground capitalize flex-shrink-0">{it.status}</span>
                  )}
                  {it.amount != null && (
                    <span className="text-[10px] font-body text-muted-foreground flex-shrink-0">${Number(it.amount).toLocaleString()}</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}