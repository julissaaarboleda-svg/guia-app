import { Bookmark, MoreVertical, ArrowRight, ExternalLink } from "lucide-react";

export default function InsightCard({ insight, onAction, bookmarked, onBookmark }) {
  const Icon = insight.icon;
  const loading = insight.loading;

  return (
    <div
      onClick={loading ? undefined : onAction}
      className={`bg-card border border-border rounded-[20px] p-4 ${loading ? "" : "cursor-pointer"} hover:border-foreground/20 transition-colors shadow-[0_2px_12px_-8px_rgba(0,0,0,0.12)]`}
    >
      <div className="flex gap-3">
        {/* Left icon */}
        <span className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
          {loading ? (
            <div className="w-5 h-5 rounded-full bg-secondary animate-pulse" />
          ) : (
            <Icon className="w-5 h-5 text-foreground" strokeWidth={1.5} />
          )}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Top row: badge + metadata */}
          <div className="flex items-center justify-between gap-2">
            <span className="font-body text-[9px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">
              {insight.category}
            </span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="font-body text-[9px] text-muted-foreground">{insight.timestamp}</span>
              <button
                onClick={(e) => { e.stopPropagation(); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="More options"
              >
                <MoreVertical className="w-3.5 h-3.5" strokeWidth={1.6} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onBookmark?.(insight.id); }}
                className="transition-colors"
                aria-label="Bookmark"
              >
                <Bookmark
                  className={`w-3.5 h-3.5 ${bookmarked ? "fill-foreground text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  strokeWidth={1.6}
                />
              </button>
            </div>
          </div>

          {loading ? (
            <>
              <div className="h-4 w-3/4 rounded bg-secondary animate-pulse mt-2" />
              <div className="h-3 w-full rounded bg-secondary/60 animate-pulse mt-2" />
            </>
          ) : (
            <>
              {/* Title */}
              <h3 className="font-body text-[14px] text-foreground font-semibold leading-tight mt-1.5">
                {insight.headline}
              </h3>
              {/* Description */}
              <p className="font-body text-[12px] text-muted-foreground leading-snug mt-1">
                {insight.detail}
              </p>

              {/* Hyperlinks */}
              {insight.links && insight.links.length > 0 && (
                <div className="flex flex-col gap-1 mt-2.5">
                  {insight.links.map((link, i) => (
                    <a
                      key={i}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 font-body text-[12px] text-accent hover:underline transition-colors min-w-0"
                    >
                      <ExternalLink className="w-3 h-3 flex-shrink-0" strokeWidth={1.6} />
                      <span className="truncate">{link.text}</span>
                    </a>
                  ))}
                </div>
              )}

              {/* Action */}
              <button
                onClick={(e) => { e.stopPropagation(); onAction(); }}
                className="mt-3 inline-flex items-center gap-1 font-body text-[12px] text-accent font-medium hover:gap-1.5 transition-all"
              >
                {insight.actionLabel}
                <ArrowRight className="w-3 h-3" strokeWidth={1.8} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}