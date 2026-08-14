import { parseISO, differenceInCalendarDays } from "date-fns";
import { Edit2, Calendar, MapPin, ImageIcon } from "lucide-react";

export default function JourneyHero({ trip, onOpen, onCustomize, onEditTrip, generating }) {
  const daysRemaining = trip.start_date
    ? Math.ceil((parseISO(trip.start_date) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  const tripDuration =
    trip.start_date && trip.end_date
      ? differenceInCalendarDays(parseISO(trip.end_date), parseISO(trip.start_date)) + 1
      : (trip.itinerary || []).length || null;

  const cities = trip.cities || [];
  const citiesCount = cities.length;

  return (
    <div
      onClick={onOpen}
      className="relative w-full min-h-[280px] rounded-[24px] overflow-hidden cursor-pointer shadow-[0_20px_50px_-28px_rgba(0,0,0,0.4)]"
    >
      {trip.hero_image_url ? (
        <img src={trip.hero_image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-charcoal via-olive/40 to-forest/60" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-black/5" />

      {generating && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/40 backdrop-blur-sm">
          <div className="w-7 h-7 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <p className="font-body text-[12px] text-white/90 tracking-wide">Composing your cover…</p>
        </div>
      )}

      {/* Top row */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 pt-4">
        <span className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground bg-secondary px-3 py-1 rounded-full">
          Planning
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); onCustomize(); }}
            className="p-1.5 text-stone-700 bg-white rounded-full shadow-sm hover:bg-stone-100 transition-colors"
            aria-label="Customize cover photo"
            title="Customize cover photo"
          >
            <ImageIcon className="w-3.5 h-3.5" strokeWidth={1.6} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEditTrip(); }}
            className="p-1.5 text-stone-700 bg-white rounded-full shadow-sm hover:bg-stone-100 transition-colors"
            aria-label="Edit trip details"
            title="Edit trip details"
          >
            <Edit2 className="w-3.5 h-3.5" strokeWidth={1.6} />
          </button>
        </div>
      </div>

      {/* Bottom content */}
      <div className="absolute bottom-0 left-0 right-0 z-10 px-5 pb-4 [text-shadow:0_1px_4px_rgba(0,0,0,0.5)]">
        <h1 className="font-heading text-[26px] sm:text-[30px] leading-[1.05] text-white font-semibold tracking-tight">{trip.title}</h1>

        {/* Route: pin icon before each city, arrows between */}
        {citiesCount > 0 && (
          <div className="flex items-center flex-wrap gap-x-1.5 gap-y-1 mt-1.5">
            {cities.map((city, i) => (
              <span key={`${city}-${i}`} className="inline-flex items-center gap-1">
                {i > 0 && <span className="font-body text-[12px] text-white/60 mr-0.5">→</span>}
                <MapPin className="w-3 h-3 text-white/70 flex-shrink-0" strokeWidth={1.8} />
                <span className="font-body text-[12px] text-white/85">{city}</span>
              </span>
            ))}
          </div>
        )}

        {/* Days remaining line */}
        <div className="flex items-center gap-1.5 mt-3">
          <Calendar className="w-3.5 h-3.5 text-white/80 flex-shrink-0" strokeWidth={1.8} />
          <span className="font-heading text-[17px] text-white font-semibold leading-none">
            {daysRemaining !== null && daysRemaining > 0 ? daysRemaining : "—"}
          </span>
          <span className="font-body text-[12px] text-white/80">days remaining</span>
        </div>

        {/* Duration + cities summary */}
        <p className="font-body text-[11.5px] text-white/70 mt-1">
          {tripDuration ? `${tripDuration} day${tripDuration !== 1 ? "s" : ""}` : "—"}
          {citiesCount > 0 && ` • ${citiesCount} cit${citiesCount !== 1 ? "ies" : "y"}`}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-between mt-3.5">
          <span
            onClick={(e) => { e.stopPropagation(); onOpen(); }}
            className="bg-white text-foreground px-4 py-1.5 rounded-full text-[12px] font-medium hover:bg-white/90 transition-colors cursor-pointer shadow-sm"
          >
            Continue Planning
          </span>
          <span
            onClick={(e) => { e.stopPropagation(); onOpen(); }}
            className="font-body text-[12px] text-white/90 hover:text-white inline-flex items-center gap-1 cursor-pointer"
          >
            View Journey →
          </span>
        </div>
      </div>
    </div>
  );
}
