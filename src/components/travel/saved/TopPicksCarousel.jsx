import { useState, useEffect } from "react";
import { Star, Heart, Plus, Sparkles, MapPin } from "lucide-react";
import { generatePickImage } from "@/lib/savedAi";
import { categoryMeta } from "./categoryMeta";

export default function TopPicksCarousel({ trip, city, picks, loading, refreshing, failed, onRefresh, onWishlist, isSaved }) {
  const [images, setImages] = useState({});

  useEffect(() => {
    if (!picks?.length) { setImages({}); return; }
    let alive = true;
    const init = {};
    picks.forEach((p) => { init[p.name] = null; });
    setImages(init);
    // Generate AI images for the first 8 picks only (keeps credit cost / latency bounded);
    // remaining picks fall back to the category gradient placeholder.
    picks.slice(0, 8).forEach((p) => {
      generatePickImage(trip.id, city, p.name, p.imagePrompt)
        .then((url) => { if (alive) setImages((s) => ({ ...s, [p.name]: url })); })
        .catch(() => {});
    });
    return () => { alive = false; };
  }, [picks, city, trip.id]);

  return (
    <section>
      <div className="flex items-baseline justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-accent" />
          <h2 className="font-heading text-[18px] text-foreground font-semibold">Top Picks</h2>
        </div>
        <span className="font-body text-[11px] text-muted-foreground">AI recommendations for you</span>
      </div>

      <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
        {loading ? (
          [0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)
        ) : (picks || []).length > 0 ? (
          picks.map((p, i) => {
            const meta = categoryMeta(p.category);
            const img = images[p.name];
            const saved = isSaved(p);
            return (
              <div key={i} className="flex-shrink-0 w-[148px] rounded-xl border border-border bg-card overflow-hidden">
                <div className="relative h-[92px] bg-muted">
                  {img ? (
                    <img src={img} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)` }}>
                      <meta.Icon className="w-6 h-6 text-white/80" strokeWidth={1.4} />
                    </div>
                  )}
                  <span className="absolute top-1.5 left-1.5 font-body text-[8px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full bg-white/85 text-foreground/80">{meta.label}</span>
                  {p.aiBadge && (
                    <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-0.5 font-body text-[8px] font-medium px-1.5 py-0.5 rounded-full bg-black/55 text-white">
                      <Sparkles className="w-2.5 h-2.5" /> {p.aiBadge}
                    </span>
                  )}
                </div>
                <div className="p-2.5 flex flex-col">
                  <div className="min-h-[48px]">
                    {p.website ? (
                      <a href={p.website} target="_blank" rel="noopener noreferrer" className="font-heading text-[13px] text-foreground font-semibold leading-tight line-clamp-2 hover:text-accent transition-colors">{p.name}</a>
                    ) : (
                      <p className="font-heading text-[13px] text-foreground font-semibold leading-tight line-clamp-2">{p.name}</p>
                    )}
                    <p className="font-body text-[10.5px] text-muted-foreground mt-0.5 leading-snug line-clamp-1">{p.description}</p>
                  </div>
                  <div className="flex items-center mt-2 pt-2 border-t border-border/60">
                    <button
                      onClick={() => onWishlist({ ...p, image: img })}
                      className="w-full inline-flex items-center justify-center gap-1 py-1 font-body text-[10.5px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Heart className={`w-3 h-3 ${saved ? "fill-accent text-accent" : ""}`} /> {saved ? "Saved" : "Wishlist"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : failed ? (
          <div className="w-full py-5 px-1 flex flex-col items-start gap-2">
            <p className="font-body text-[13px] text-muted-foreground flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Couldn't load picks for {city}.
            </p>
            <button
              onClick={onRefresh}
              className="inline-flex items-center gap-1 px-3 h-7 rounded-full border border-accent text-accent font-body text-[12px] font-medium hover:bg-accent/10 transition-colors"
            >
              <Sparkles className="w-3 h-3" /> Try again
            </button>
          </div>
        ) : (
          <div className="w-full py-5 px-1">
            <p className="font-body text-[13px] text-muted-foreground flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> No picks match these filters.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function SkeletonCard() {
  return (
    <div className="flex-shrink-0 w-[148px] rounded-xl border border-border bg-card overflow-hidden">
      <div className="h-[92px] bg-muted animate-pulse" />
      <div className="p-2.5 space-y-1.5">
        <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
        <div className="h-2 w-full bg-muted/60 rounded animate-pulse" />
        <div className="h-5 w-full bg-muted/40 rounded animate-pulse" />
      </div>
    </div>
  );
}