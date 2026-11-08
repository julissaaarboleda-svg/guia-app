import { useState, useEffect } from "react";
import { Star, Heart, Sparkles, MapPin, X, Phone, Globe, Clock, ChevronDown, CalendarPlus } from "lucide-react";
import { generatePickImage, getPlaceDetails } from "@/lib/savedAi";
import { categoryMeta } from "./categoryMeta";

// Full-screen detail page for one place (used by Top Picks and Tours).
// Loads its own photo and Google details (hours, phone, reviews), both cached.
export default function PlaceDetailSheet({ pick, city, trip, isSaved, onWishlist, onAddToItinerary, onClose }) {
  const [img, setImg] = useState(null); // { url, attribution }
  const [details, setDetails] = useState(null);
  const [hoursOpen, setHoursOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setImg(null); setDetails(null); setHoursOpen(false);
    generatePickImage(trip.id, city, pick.name, pick.imagePrompt, { photoName: pick.photoName, photoAuthor: pick.photoAuthor })
      .then((r) => { if (alive) setImg(r); }).catch(() => {});
    if (pick.place_id) getPlaceDetails(pick.place_id).then((d) => { if (alive) setDetails(d); }).catch(() => {});
    return () => { alive = false; };
  }, [pick.name, pick.place_id, city, trip.id]);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="relative aspect-[4/3] w-full flex-shrink-0 bg-muted">
        {img?.url ? (
          <img src={img.url} alt={pick.name} className="w-full h-full object-cover" />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${categoryMeta(pick.category).color}, ${categoryMeta(pick.category).color}cc)` }}
          >
            {(() => { const Icon = categoryMeta(pick.category).Icon; return <Icon className="w-12 h-12 text-white/80" strokeWidth={1.4} />; })()}
          </div>
        )}
        {img?.attribution && (
          <span className="absolute bottom-2 right-3 font-body text-[10px] px-1.5 py-0.5 rounded bg-black/45 text-white/85">
            Photo: {img.attribution}
          </span>
        )}
        <button
          onClick={() => onClose()}
          className="absolute right-4 w-9 h-9 flex items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/60 transition-colors"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 2.5rem)" }}
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <span className="inline-block font-body text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-foreground/80 mb-2">
          {categoryMeta(pick.category).label}
        </span>
        <h2 className="font-heading text-2xl text-foreground font-semibold leading-tight">{pick.name}</h2>
        {pick.neighborhood && (
          <p className="font-body text-sm text-muted-foreground mt-1">{pick.neighborhood}</p>
        )}
        {(pick.rating || pick.price) && (
          <div className="flex items-center gap-2 mt-2 font-body text-sm text-foreground">
            {pick.rating && (
              <span className="inline-flex items-center gap-1">
                <Star className="w-4 h-4 fill-[#A7773F] text-[#A7773F]" />
                {pick.rating.toFixed(1)}
                {pick.reviewCount ? ` (${pick.reviewCount} reviews)` : ""}
              </span>
            )}
            {pick.rating && pick.price && <span className="text-muted-foreground">·</span>}
            {pick.price && <span>{pick.price}</span>}
          </div>
        )}
        {(details?.summary || pick.description) && (
          <>
            <h3 className="font-heading text-[16px] text-foreground font-semibold mt-5 mb-1.5">About</h3>
            <p className="font-body text-[14px] text-foreground leading-relaxed">{details?.summary || pick.description}</p>
          </>
        )}

        <h3 className="font-heading text-[16px] text-foreground font-semibold mt-5 mb-1">Details</h3>
        <div className="font-body text-[13px] text-foreground">
          {(details?.address || pick.address) && (
            <a href={details?.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${pick.name} ${city}`)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 py-2.5 border-b border-border">
              <MapPin className="w-4 h-4 text-accent flex-shrink-0" />
              <span className="flex-1 min-w-0">{details?.address || pick.address}</span>
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
          {(details?.website || pick.website) && (
            <a href={details?.website || pick.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 py-2.5 border-b border-border">
              <Globe className="w-4 h-4 text-accent flex-shrink-0" />
              <span className="flex-1 min-w-0 truncate">Website</span>
              <span className="text-[11px] text-muted-foreground">Open ›</span>
            </a>
          )}
          {pick.instagramSearchUrl && (
            <a href={pick.instagramSearchUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 py-2.5">
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
          onClick={() => onAddToItinerary ? onAddToItinerary(pick) : window.open(`https://www.google.com/search?q=${encodeURIComponent(`${pick.name} ${city}`)}`, "_blank")}
          className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-full bg-[#A7773F] text-[#F7F3EC] font-heading text-[15px] hover:opacity-90 transition-opacity"
        >
          <CalendarPlus className="w-4 h-4" /> Add to itinerary
        </button>
        <button
          onClick={() => onWishlist({ ...pick, image: img?.url })}
          className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-xl border border-border text-foreground hover:bg-secondary transition-colors"
          aria-label="Save to wishlist"
        >
          <Heart className={`w-5 h-5 ${isSaved(pick) ? "fill-accent text-accent" : ""}`} />
        </button>
      </div>
    </div>
  );
}
