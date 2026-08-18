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
              <span className="font-heading text-sm text-foreground">{it.countdown}</span>
            ) : days === 0 ? (
              <span className="font-heading text-sm text-foreground">Today</span>
            ) : days === 1 ? (
              <span className="font-heading text-sm text-foreground">1 <span className="text-[10px] font-body text-muted-foreground">day</span></span>
            ) : (
              <span className="font-heading text-base text-foreground">{days} <span className="text-[10px] font-body text-muted-foreground">days</span></span>
            );
            return (
              <Link
                key={it.id}
                to={it.path}
                className="snap-start flex-shrink-0 w-[170px] flex flex-col rounded-xl border border-border/40 bg-background/40 overflow-hidden hover:border-olive/40 transition-colors"
              >
                {it.image ? (
                  <div className="w-full h-[90px] flex-shrink-0">
                    <img src={it.image} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div
                    className="w-full h-[90px] flex-shrink-0 flex items-center justify-center"
                    style={{ backgroundColor: it.accentColor ? `${it.accentColor}1F` : `${mod.color}14` }}
                  >
                    <Icon className="w-11 h-11" style={{ color: it.accentColor || mod.color }} strokeWidth={1.5} />
                  </div>
                )}
                <div className="flex flex-col gap-1.5 p-2.5">
                  <p className="font-body text-[12.5px] text-foreground leading-tight line-clamp-1">{it.title}</p>
                  <p className="font-body text-[10px] text-muted-foreground">{it.dateLabel}</p>
                  <div className="flex items-end justify-between pt-0.5">
                    {countdownEl}
                    {it.status && (
                      <span className="text-[9px] font-body font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground capitalize flex-shrink-0">{it.status}</span>
                    )}
                    {it.amount != null && (
                      <span className="text-[10px] font-body text-muted-foreground flex-shrink-0">${Number(it.amount).toLocaleString()}</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}