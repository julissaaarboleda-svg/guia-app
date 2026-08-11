import { parseISO, format } from "date-fns";

export default function JourneyCard({ trip, progress, onOpen }) {
  const dateLabel = trip.start_date
    ? `${format(parseISO(trip.start_date), "MMM d")}${trip.end_date ? ` – ${format(parseISO(trip.end_date), "MMM d, yyyy")}` : ""}`
    : "Dates pending";

  return (
    <button
      onClick={onOpen}
      className="relative flex-shrink-0 w-[180px] h-[240px] rounded-2xl overflow-hidden text-left group shadow-[0_12px_32px_-20px_rgba(0,0,0,0.35)]"
    >
      {trip.hero_image_url ? (
        <img src={trip.hero_image_url} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-charcoal via-olive/40 to-forest/60" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

      <div className="absolute bottom-0 left-0 right-0 p-3.5">
        <h3 className="font-heading text-[1.2rem] text-white font-semibold leading-tight">{trip.country || trip.title}</h3>
        {trip.country && trip.title !== trip.country && (
          <p className="font-heading text-[12px] text-white/70 italic leading-tight mt-0.5">{trip.title}</p>
        )}
        <p className="font-body text-[11px] text-white/75 mt-1">{dateLabel}</p>
        <div className="mt-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className="font-body text-[9px] uppercase tracking-wider text-white/50">Planning</span>
            <span className="font-body text-[10px] text-white/80 font-medium">{progress}%</span>
          </div>
          <div className="h-[2px] rounded-full bg-white/20 overflow-hidden">
            <div className="h-full rounded-full bg-white/90" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    </button>
  );
}