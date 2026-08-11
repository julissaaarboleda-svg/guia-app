import { Sparkles, ArrowRight } from "lucide-react";

export default function FeaturedHappening({ city, happening, imgUrl, imgLoading, loading }) {
  return (
    <div className="rounded-[16px] overflow-hidden border border-border bg-card flex shadow-[0_8px_24px_-20px_rgba(0,0,0,0.18)]" style={{ height: "128px" }}>
      {/* Left — text */}
      <div className="flex-1 px-4 py-3.5 flex flex-col justify-center min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Sparkles className="w-3 h-3 text-accent" strokeWidth={1.8} />
          <span className="font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Happening in {city}</span>
        </div>
        <h3 className="font-body text-[15px] text-foreground font-semibold leading-tight">
          {loading || !happening ? "—" : happening.title}
        </h3>
        <p className="font-body text-[12px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
          {loading || !happening ? "" : happening.description}
        </p>
        {happening?.learnMoreUrl && (
          <a
            href={happening.learnMoreUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 mt-1.5 font-body text-[12px] text-accent font-medium hover:gap-1.5 transition-all"
          >
            Learn more <ArrowRight className="w-3 h-3" />
          </a>
        )}
      </div>
      {/* Right — image */}
      <div className="w-32 sm:w-40 flex-shrink-0 relative">
        {imgLoading || loading ? (
          <div className="absolute inset-0 bg-gradient-to-br from-secondary to-muted animate-pulse" />
        ) : imgUrl ? (
          <img src={imgUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-accent/30 to-muted" />
        )}
      </div>
    </div>
  );
}