import { parseISO, format } from "date-fns";
import { Check } from "lucide-react";

export default function PastJourneyCard({ trip, onOpen }) {
  const dateLabel = trip.start_date
    ? format(parseISO(trip.start_date), "MMM yyyy")
    : "";

  return (
    <button
      onClick={onOpen}
      className="relative w-full aspect-[4/5] rounded-[18px] overflow-hidden text-left group shadow-[0_10px_28px_-18px_rgba(0,0,0,0.3)]"
    >
      {trip.hero_image_url ? (
        <img src={trip.hero_image_url} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-charcoal via-olive/40 to-forest/60" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
      <div className="absolute top-3 right-3">
        <span className="inline-flex items-center gap-1 bg-white/90 text-foreground text-[9px] font-medium px-2 py-0.5 rounded-full">
          <Check className="w-2.5 h-2.5" strokeWidth={2} /> Completed
        </span>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-3.5">
        <h3 className="font-heading text-[15px] text-white font-semibold leading-tight">{trip.country || trip.title}</h3>
        {dateLabel && <p className="font-body text-[11px] text-white/70 mt-0.5">{dateLabel}</p>}
      </div>
    </button>
  );
}