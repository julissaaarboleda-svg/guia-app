import { useState, useEffect, useRef, useCallback } from "react";
import { Star, Heart, Sparkles, MapPin, X, RefreshCw, Phone, Globe, Clock, ChevronDown, CalendarPlus } from "lucide-react";
import { generatePickImage, getLastPicksError, getPlaceDetails } from "@/lib/savedAi";
import { categoryMeta } from "./categoryMeta";

export default function TopPicksCarousel({ trip, city, picks, loading, refreshing, failed, onRefresh, onWishlist, isSaved, onAddToItinerary }) {
  const [images, setImages] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [details, setDetails] = useState(null); // null = loading/none, object = loaded
  const [hoursOpen, setHoursOpen] = useState(false);

  // Load hours / phone / reviews when a place is opened (one cached request).
  useEffect(() => {
    setDetails(null);
    setHoursOpen(false);
    if (!expanded?.place_id) return;
    let alive = true;
    getPlaceDetails(expanded.place_id).then((d) => { if (alive) setDetails(d); }).catch(() => {});
    return () => { alive = false; };
  }, [expanded?.place_id]);
  const requestedRef = useRef(new Set()); // which picks we've already kicked off a generation for

  // We no longer eagerly fire off 8 concurrent image generations here — that
  // was the main source of the slow initial load, since every card competed
  // for the same API at once. Only the first few cards likely visible on load
  // get requested immediately; the rest are requested lazily as the person
  // actually scrolls to them (see requestOnVisible / IntersectionObserver
  // below). This keeps time-to-first-image low without losing any images.
  useEffect(() => {
    setImages({});
    requestedRef.current = new Set();
  }, [picks, city, trip.id]);

  const requestImage = useCallback((p) => {
    if (!p || requestedRef.current.has(p.name)) return;
    requestedRef.current.add(p.name);
    generatePickImage(trip.id, city, p.name, p.imagePrompt, { photoName: p.photoName, photoAuthor: p.photoAuthor })
      .then(({ url, attribution }) => setImages((s) => ({ ...s, [p.name]: { url, attribution } })))
      .catch(() => {});
  }, [trip.id, city]);

  // Kick off the first 3 immediately (roughly what's visible without scrolling)
  useEffect(() => {
    if (!picks?.length) return;
    picks.slice(0, 3).forEach(requestImage);
  }, [picks, requestImage]);

  // Lazily request the rest as their card scrolls into view
  const requestOnVisible = useCallback((pick) => (el) => {
    if (!el || !pick || requestedRef.current.has(pick.name)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            requestImage(pick);
            observer.disconnect();
          }
        });
      },
      { root: null, rootMargin: "200px", threshold: 0.1 }
    );
    observer.observe(el);
  }, [requestImage]);

  return (
    <section>
      <div className="flex items-baseline justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-accent" />
          <h2 className="font-heading text-[18px] text-foreground font-semibold">Top Picks</h2>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-1 font-body text-[12px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} strokeWidth={1.8} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
        {loading ? (
          [0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)
        ) : (picks || []).length > 0 ? (
          picks.map((p, i) => {
            const meta = categoryMeta(p.category);
            const imgData = images[p.name];
            const img = imgData?.url;
            const saved = isSaved(p);
            return (
              <div key={i} ref={requestOnVisible(p)} className="flex-shrink-0 w-[148px] rounded-xl border border-border bg-card overflow-hidden">
                <div
                  onClick={() => setExpanded(p)}
                  className="relative h-[92px] bg-muted cursor-pointer"
                >
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
                  <div className="min-h-[62px]">
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(`${p.name} ${city}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="font-heading text-[13px] text-foreground font-semibold leading-tight line-clamp-2 hover:text-accent transition-colors"
                    >
                      {p.name}
                    </a>
                    <p
                      onClick={() => setExpanded(p)}
                      className="font-body text-[10.5px] text-muted-foreground mt-0.5 leading-snug line-clamp-2 cursor-pointer"
                    >
                      {p.description}
                    </p>
                    {(p.rating || p.price) && (
                      <div className="flex items-center gap-1 mt-1 font-body text-[10px] text-muted-foreground">
                        {p.rating && (
                          <span className="inline-flex items-center gap-0.5">
                            <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                            {p.rating.toFixed(1)}
                            {p.reviewCount ? ` (${p.reviewCount})` : ""}
                          </span>
                        )}
                        {p.rating && p.price && <span>·</span>}
                        {p.price && <span>{p.price}</span>}
                      </div>
                    )}
                  </div>
                  <div className="mt-2 pt-2 border-t border-border/60">
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
            {getLastPicksError() && <p className="font-body text-[11px] text-muted-foreground/80 break-words">{getLastPicksError().slice(0, 220)}</p>}
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

      {expanded && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="relative aspect-[4/3] w-full flex-shrink-0 bg-muted">
            {images[expanded.name]?.url ? (
              <img src={images[expanded.name].url} alt={expanded.name} className="w-full h-full object-cover" />
            ) : (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${categoryMeta(expanded.category).color}, ${categoryMeta(expanded.category).color}cc)` }}
              >
                {(() => { const Icon = categoryMeta(expanded.category).Icon; return <Icon className="w-12 h-12 text-white/80" strokeWidth={1.4} />; })()}
              </div>
            )}
            {images[expanded.name]?.attribution && (
              <span className="absolute bottom-2 right-3 font-body text-[10px] px-1.5 py-0.5 rounded bg-black/45 text-white/85">
                Photo: {images[expanded.name].attribution}
              </span>
            )}
            <button
              onClick={() => setExpanded(null)}
              className="absolute right-4 w-9 h-9 flex items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/60 transition-colors"
              style={{ top: "calc(env(safe-area-inset-top, 0px) + 2.5rem)" }}
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <span className="inline-block font-body text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-foreground/80 mb-2">
              {categoryMeta(expanded.category).label}
            </span>
            <h2 className="font-heading text-2xl text-foreground font-semibold leading-tight">{expanded.name}</h2>
            {expanded.neighborhood && (
              <p className="font-body text-sm text-muted-foreground mt-1">{expanded.neighborhood}</p>
            )}
            {(expanded.rating || expanded.price) && (
              <div className="flex items-center gap-2 mt-2 font-body text-sm text-foreground">
                {expanded.rating && (
                  <span className="inline-flex items-center gap-1">
                    <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                    {expanded.rating.toFixed(1)}
                    {expanded.reviewCount ? ` (${expanded.reviewCount} reviews)` : ""}
                  </span>
                )}
                {expanded.rating && expanded.price && <span className="text-muted-foreground">·</span>}
                {expanded.price && <span>{expanded.price}</span>}
              </div>
            )}
            {(details?.summary || expanded.description) && (
              <>
                <h3 className="font-heading text-[16px] text-foreground font-semibold mt-5 mb-1.5">About</h3>
                <p className="font-body text-[14px] text-foreground leading-relaxed">{details?.summary || expanded.description}</p>
              </>
            )}

            <h3 className="font-heading text-[16px] text-foreground font-semibold mt-5 mb-1">Details</h3>
            <div className="font-body text-[13px] text-foreground">
              {(details?.address || expanded.address) && (
                <a href={details?.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${expanded.name} ${city}`)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 py-2.5 border-b border-border">
                  <MapPin className="w-4 h-4 text-accent flex-shrink-0" />
                  <span className="flex-1 min-w-0">{details?.address || expanded.address}</span>
                  <span className="text-[11px] text-muted-foreground">Directions ›</span>
                </a>
              )}
              {details?.weekdayHours?.length > 0 && (
                <div className="border-b border-border">
                  <button onClick={() => setHoursOpen((o) => !o)} className="w-full flex items-center gap-3 py-2.5 text-left">
                    <Clock className="w-4 h-4 text-accent flex-shrink-0" />
                    <span className="flex-1">
                      Hours
                      {details.openNow != null && (
                        <span className="ml-2 text-[11px]" style={{ color: details.openNow ? "#5F6A3F" : "#8A5F64" }}>
                          {details.openNow ? "Open now" : "Closed now"}
                        </span>
                      )}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${hoursOpen ? "rotate-180" : ""}`} />
                  </button>
                  {hoursOpen && (
                    <ul className="pb-2.5 pl-7 space-y-1 text-[12px] text-muted-foreground">
                      {details.weekdayHours.map((h) => <li key={h}>{h}</li>)}
                    </ul>
                  )}
                </div>
              )}
              {details?.phone && (
                <a href={`tel:${details.phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-3 py-2.5 border-b border-border">
                  <Phone className="w-4 h-4 text-accent flex-shrink-0" />
                  <span className="flex-1">{details.phone}</span>
                  <span className="text-[11px] text-muted-foreground">Call ›</span>
                </a>
              )}
              {(details?.website || expanded.website) && (
                <a href={details?.website || expanded.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 py-2.5 border-b border-border">
                  <Globe className="w-4 h-4 text-accent flex-shrink-0" />
                  <span className="flex-1 min-w-0 truncate">Website</span>
                  <span className="text-[11px] text-muted-foreground">Open ›</span>
                </a>
              )}
              {expanded.instagramSearchUrl && (
                <a href={expanded.instagramSearchUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 py-2.5">
                  <Sparkles className="w-4 h-4 text-accent flex-shrink-0" />
                  <span className="flex-1">See it on Instagram</span>
                  <span className="text-[11px] text-muted-foreground">Search ›</span>
                </a>
              )}
            </div>

            {details?.reviews?.length > 0 && (
              <>
                <h3 className="font-heading text-[16px] text-foreground font-semibold mt-5 mb-2">What people say</h3>
                <div className="space-y-2">
                  {details.reviews.map((rv, k) => (
                    <div key={k} className="rounded-xl border border-border bg-card px-3.5 py-3">
                      <p className="font-body text-[13px] text-foreground leading-snug">“{rv.text}”</p>
                      <p className="font-body text-[11px] text-muted-foreground mt-1.5">
                        {rv.rating ? "★".repeat(Math.round(rv.rating)) + " · " : ""}Google review{rv.when ? ` · ${rv.when}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="px-6 py-4 border-t border-border flex items-center gap-3">
            <button
              onClick={() => onAddToItinerary ? onAddToItinerary(expanded) : window.open(`https://www.google.com/search?q=${encodeURIComponent(`${expanded.name} ${city}`)}`, "_blank")}
              className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-full bg-[#A7773F] text-[#F7F3EC] font-heading text-[15px] hover:opacity-90 transition-opacity"
            >
              <CalendarPlus className="w-4 h-4" /> Add to itinerary
            </button>
            <button
              onClick={() => onWishlist({ ...expanded, image: images[expanded.name]?.url })}
              className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-xl border border-border text-foreground hover:bg-secondary transition-colors"
              aria-label="Save to wishlist"
            >
              <Heart className={`w-5 h-5 ${isSaved(expanded) ? "fill-accent text-accent" : ""}`} />
            </button>
          </div>
        </div>
      )}
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
