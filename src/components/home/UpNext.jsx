import { Link } from "react-router-dom";
import { ArrowRight, CircleCheck, Target, Receipt, CalendarOff, ChevronRight } from "lucide-react";
import { getModule } from "@/lib/homeModules";
import AdjustableImage from "@/components/ui/AdjustableImage";

const KIND = {
  task: { Icon: CircleCheck, color: "#A7773F" },
  step: { Icon: Target, color: "#A7773F" },
  bill: { Icon: Receipt, color: "#A77C81" },
};

export default function UpNext({ items, comingUp = [], undated = [] }) {
  const showList = comingUp.length > 0 || undated.length > 0;
  const one = undated.length === 1 ? undated[0] : null;
  return (
    <section className="h-full flex flex-col">
      <div className="flex items-end justify-between mb-2.5">
        <h2 className="font-heading text-[20px] text-foreground">Up Next</h2>
      </div>

      {items.length === 0 && showList ? null : items.length === 0 ? (
        <p className="text-[12px] text-muted-foreground font-body py-4 text-center flex-1 flex items-center justify-center">No upcoming commitments.</p>
      ) : (
        <div className="flex gap-2.5 overflow-x-auto no-scrollbar snap-x snap-mandatory flex-1 lg:grid lg:grid-cols-1 lg:overflow-visible lg:content-start">
          {items.map((it) => {
            const mod = getModule(it.module);
            const Icon = mod.Icon;
            const days = it._days;
            const countdownEl = days == null ? (
              <span className="font-heading text-xl text-[#A7773F]">{it.countdown}</span>
            ) : days === 0 ? (
              <span className="font-heading text-xl text-[#A7773F]">Today</span>
            ) : days === 1 ? (
              <span className="font-heading text-2xl text-[#A7773F] leading-none">1 <span className="text-[11px] font-body text-muted-foreground">day to go</span></span>
            ) : (
              <span className="font-heading text-2xl text-[#A7773F] leading-none">{days} <span className="text-[11px] font-body text-muted-foreground">days to go</span></span>
            );
            return (
              <Link
                key={it.id}
                to={it.path}
                className="snap-start flex flex-shrink-0 w-full sm:w-[320px] lg:w-auto rounded-2xl border border-border/60 bg-card overflow-hidden hover:border-[#A7773F]/50 transition-colors"
              >
                {it.image ? (
                  <div className="w-[96px] flex-shrink-0 relative overflow-hidden">
                    <AdjustableImage src={it.image} pos={it.imagePos} className="absolute inset-0" />
                  </div>
                ) : (
                  <div
                    className="w-[96px] flex-shrink-0 flex items-center justify-center"
                    style={{ backgroundColor: it.accentColor ? `${it.accentColor}1F` : `${mod.color}14` }}
                  >
                    <Icon className="w-8 h-8" style={{ color: it.accentColor || mod.color }} strokeWidth={1.5} />
                  </div>
                )}
                <div className="flex-1 min-w-0 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-heading text-[17px] text-foreground leading-tight truncate">{it.title}</p>
                    {it.status && (
                      <span className="text-[10px] font-body font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize flex-shrink-0">{it.status}</span>
                    )}
                  </div>
                  <p className="font-body text-[11px] text-muted-foreground mt-0.5">{it.dateLabel}</p>
                  <div className="flex items-end justify-between mt-2">
                    {countdownEl}
                    {it.readiness && (
                      <span className="flex gap-3 text-[10.5px] text-muted-foreground font-body">
                        {[["Packing", it.readiness.packed, it.readiness.pack], ["Itinerary", it.readiness.planned, it.readiness.days]].map(([l, a, b]) => (
                          <span key={l} className="flex flex-col">
                            <span>{l} {a} of {b}{l === "Itinerary" ? " days" : ""}</span>
                            <span className="h-1 w-16 rounded-full bg-[#EFE9DF] mt-0.5 overflow-hidden"><span className="block h-full bg-[#7D8A53]" style={{ width: b ? `${Math.round((a / b) * 100)}%` : 0 }} /></span>
                          </span>
                        ))}
                      </span>
                    )}
                    {it.amount != null && (
                      <span className="text-[11px] font-body text-muted-foreground">${Number(it.amount).toLocaleString()}</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {showList && (
        <div className={`rounded-2xl border border-border/60 bg-card px-3.5 pb-1 ${items.length ? "mt-2.5" : ""}`}>
          <div className="flex items-center justify-between pt-2.5 pb-1.5">
            <span className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">Coming up</span>
            <Link to="/goals?view=tasks" className="flex items-center gap-1 text-[11px] font-medium text-[#A7773F]">All tasks <ArrowRight className="w-3 h-3" /></Link>
          </div>
          {comingUp.map((c) => {
            const k = KIND[c.kind] || KIND.task; const Icon = k.Icon;
            return (
              <Link key={c.id} to={c.path} className="flex items-center gap-2.5 py-2.5 border-t border-border/40">
                <span className="w-[26px] h-[26px] rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${k.color}1A`, color: k.color }}>
                  <Icon className="w-[15px] h-[15px]" strokeWidth={1.7} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13.5px] text-foreground truncate">{c.title}</span>
                  <span className="block text-[10.5px] text-muted-foreground truncate">{c.sub}</span>
                </span>
                <span className="text-[11px] text-muted-foreground flex-shrink-0">{c.when}</span>
              </Link>
            );
          })}
          {one && (() => { const k = KIND[one.kind] || KIND.task; const Icon = k.Icon; return (
            <Link to={one.path} className="flex items-center gap-2.5 py-2.5 border-t border-border/40">
              <span className="w-[26px] h-[26px] rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${k.color}1A`, color: k.color }}><Icon className="w-[15px] h-[15px]" strokeWidth={1.7} /></span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13.5px] text-foreground truncate">{one.title}</span>
                <span className="block text-[10.5px] text-muted-foreground truncate">{one.sub}</span>
              </span>
              <span className="text-[11px] text-muted-foreground flex-shrink-0">No date</span>
            </Link>
          ); })()}
          {undated.length > 1 && (
            <Link to="/goals?view=tasks" className="flex items-center gap-2.5 py-2.5 border-t border-border/40">
              <span className="w-[26px] h-[26px] rounded-lg flex items-center justify-center flex-shrink-0 bg-[#EFE8DC] text-[#8A8078]"><CalendarOff className="w-[15px] h-[15px]" strokeWidth={1.7} /></span>
              <span className="flex-1 min-w-0 text-[13px] text-muted-foreground truncate">{undated.length} with no date: {undated.slice(0, 2).map((u) => u.title).join(", ")}{undated.length > 2 ? "…" : ""}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground/60 flex-shrink-0" />
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
