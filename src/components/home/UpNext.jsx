import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { getModule } from "@/lib/homeModules";
import AdjustableImage from "@/components/ui/AdjustableImage";

export default function UpNext({ items }) {
  return (
    <section className="h-full flex flex-col">
      <div className="flex items-end justify-between mb-2.5">
        <h2 className="font-heading text-[20px] text-foreground">Up Next</h2>
        <Link to="/travel" className="flex items-center gap-1 text-[11px] font-medium text-[#A7773F] transition-colors">
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {items.length === 0 ? (
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
    </section>
  );
}