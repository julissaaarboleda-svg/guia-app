import { Star } from "lucide-react";

export default function ExploreCollection({ config, picks, loading, refreshing, onRefresh, onPick }) {
  const { title, tagline, color, Icon } = config;
  return (
    <div className="flex items-start gap-2.5 py-2">
      {/* Colored circular icon — kept at brand size */}
      <div
        className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center mt-0.5"
        style={{ backgroundColor: color }}
      >
        <Icon className="w-4 h-4 text-white" strokeWidth={1.8} />
      </div>

      {/* Title, tagline, today's picks */}
      <div className="flex-1 min-w-0">
        <h3 className="font-heading text-[18px] text-foreground font-semibold leading-tight">{title}</h3>
        <p className="font-body text-[12px] text-muted-foreground mt-0.5 leading-snug">{tagline}</p>

        <div className="mt-1">
          <span className="font-body text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">Today's Picks</span>
          <div className="mt-0.5">
            {loading || !picks ? (
              [0, 1, 2].map((i) => (
                <div key={i} className="flex items-baseline gap-1.5 py-0.5">
                  <div className="w-2 h-2 rounded-full bg-muted/50 animate-pulse flex-shrink-0" />
                  <div className="h-2.5 w-2/3 rounded bg-muted/40 animate-pulse" />
                </div>
              ))
            ) : (
              picks.map((p, i) => (
                <button
                  key={i}
                  onClick={() => onPick(p)}
                  className="flex items-baseline gap-1.5 w-full text-left py-0.5 hover:opacity-70 transition-opacity"
                >
                  <span className="font-body text-[11px] text-muted-foreground tabular-nums w-3 flex-shrink-0">
                    {i + 1}
                  </span>
                  <p className="font-body text-[14px] text-foreground font-medium leading-snug">{p.name}</p>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* New Picks — secondary action */}
      <button
        onClick={onRefresh}
        disabled={refreshing || loading}
        className="flex-shrink-0 self-start mt-1 inline-flex items-center gap-1 px-2 h-6 rounded-full border border-border/60 bg-transparent text-muted-foreground text-[10px] font-medium hover:text-foreground hover:border-border transition-colors disabled:opacity-50"
      >
        <Star className="w-2.5 h-2.5 text-accent" strokeWidth={1.8} />
        {refreshing ? "…" : "New Picks"}
      </button>
    </div>
  );
}