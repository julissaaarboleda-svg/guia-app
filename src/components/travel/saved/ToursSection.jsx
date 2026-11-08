import { useState, useEffect } from "react";
import { Star, Heart, MapPin, ChevronDown, CalendarPlus } from "lucide-react";
import { getTours, TOUR_FILTERS } from "@/lib/tours";
import PlaceDetailSheet from "./PlaceDetailSheet";

// Tours & experiences for the selected city, plus collapsed "Plan your
// visit" links. Tours are real Google Places listings; the tourism links
// open searches (no guessed URLs).
export default function ToursSection({ trip, city, isSaved, onWishlist, onAddToItinerary }) {
  const [kind, setKind] = useState("tours");
  const [tours, setTours] = useState(null); // null = loading
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(null);
  const [planOpen, setPlanOpen] = useState(false);

  useEffect(() => {
    if (!city) return;
    let alive = true;
    setTours(null); setFailed(false);
    getTours(trip.country, city, kind)
      .then((t) => { if (alive) setTours(t); })
      .catch(() => { if (alive) { setTours([]); setFailed(true); } });
    return () => { alive = false; };
  }, [city, kind, trip.country]);

  if (!city) return null;
  const q = (s) => encodeURIComponent(s);
  const country = (trip.country || "").split(",")[0].trim();
  const links = [
    { label: `${city} tourism board`, href: `https://www.google.com/search?q=${q(`${city} ${country} official tourism board`)}` },
    { label: `${country || "Country"} official tourism`, href: `https://www.google.com/search?q=${q(`${country} official tourism website`)}` },
    { label: "Visitor information centers", href: `https://www.google.com/maps/search/?api=1&query=${q(`tourist information center ${city}`)}` },
    { label: "Events this month", href: `https://www.google.com/search?q=${q(`events in ${city} this month`)}` },
    { label: "Travel advisories", href: "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html" },
  ];

  return (
    <section>
      <div className="flex items-end justify-between mb-2">
        <h2 className="font-heading text-[18px] text-foreground font-semibold">Tours &amp; experiences</h2>
        <span className="font-body text-[11px] text-muted-foreground">Group tours</span>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
        {TOUR_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setKind(f.value)}
            className={`flex-shrink-0 font-body text-[11px] rounded-full px-3 h-7 border transition-colors ${kind === f.value ? "bg-[#A7773F] text-[#F7F3EC] border-[#A7773F]" : "bg-card text-foreground border-border"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {tours === null ? (
        <div className="space-y-2">
          {[0, 1].map((i) => <div key={i} className="h-[112px] rounded-xl border border-border bg-muted/50 animate-pulse" />)}
        </div>
      ) : tours.length === 0 ? (
        <p className="font-body text-[13px] text-muted-foreground flex items-center gap-1.5 py-3">
          <MapPin className="w-3.5 h-3.5" /> {failed ? "Couldn't load tours right now. Try another filter or come back later." : "No tours found for this filter."}
        </p>
      ) : (
        <div className="space-y-2.5">
          {tours.map((t) => (
            <div key={t.place_id || t.name} className="rounded-xl border border-border bg-card p-3">
              <button onClick={() => setOpen(t)} className="text-left w-full">
                <p className="font-heading text-[15px] text-foreground font-semibold leading-tight">{t.name}</p>
                <p className="font-body text-[11.5px] text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
                  {t.rating ? (<><Star className="w-3 h-3 text-accent fill-accent" /><span className="text-foreground">{t.rating}</span>{t.reviewCount ? <span>({t.reviewCount.toLocaleString()})</span> : null}</>) : null}
                  {[t.price, t.neighborhood].filter(Boolean).map((x) => <span key={x}>· {x}</span>)}
                </p>
                {t.description && <p className="font-body text-[12px] text-foreground leading-snug mt-1.5 line-clamp-2">{t.description}</p>}
              </button>
              <div className="flex items-center gap-1.5 mt-2.5">
                {t.website && (
                  <a href={t.website} target="_blank" rel="noopener noreferrer" className="font-body text-[11px] rounded-full px-3 h-7 inline-flex items-center bg-[#A7773F] text-[#F7F3EC]">Website</a>
                )}
                <button onClick={() => onAddToItinerary(t)} className="font-body text-[11px] rounded-full px-3 h-7 inline-flex items-center gap-1 border border-[#A7773F] text-[#A7773F]">
                  <CalendarPlus className="w-3 h-3" /> Add to itinerary
                </button>
                <button onClick={() => onWishlist(t)} aria-label="Save to wishlist" className="ml-auto w-7 h-7 rounded-full border border-border flex items-center justify-center">
                  <Heart className={`w-3.5 h-3.5 ${isSaved(t) ? "fill-accent text-accent" : "text-muted-foreground"}`} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 rounded-xl border border-border bg-card">
        <button onClick={() => setPlanOpen((o) => !o)} className="w-full flex items-center justify-between px-3.5 py-3">
          <span className="font-heading text-[14px] text-foreground font-semibold">Plan your visit</span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${planOpen ? "rotate-180" : ""}`} />
        </button>
        {planOpen && (
          <div className="px-3.5 pb-2 font-body text-[13px]">
            {links.map((l) => (
              <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between py-2.5 border-t border-border text-foreground">
                <span>{l.label}</span><span className="text-[11px] text-muted-foreground">Open ›</span>
              </a>
            ))}
          </div>
        )}
      </div>

      {open && (
        <PlaceDetailSheet
          pick={open}
          city={city}
          trip={trip}
          isSaved={isSaved}
          onWishlist={onWishlist}
          onAddToItinerary={onAddToItinerary}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}
