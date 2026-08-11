import { parseISO, format } from "date-fns";
import { ArrowRight } from "lucide-react";

export default function UpcomingEvent({ trip, onNavigate }) {
  const now = new Date();
  const itinerary = (trip.itinerary || [])
    .filter((d) => d.date)
    .map((d) => ({ ...d, _d: parseISO(d.date) }))
    .filter((d) => d._d >= now)
    .sort((a, b) => a._d - b._d);

  let event = null;
  let location = null;
  let eventDate = null;

  for (const day of itinerary) {
    if (day.title && day.title.trim()) {
      event = day.title;
      eventDate = day._d;
      const act = (day.activities || [])[0];
      location = act?.location || (trip.cities || [])[0] || trip.country;
      break;
    }
  }

  if (!event) {
    event = trip.title;
    if (trip.start_date) {
      eventDate = parseISO(trip.start_date);
      if (eventDate < now) eventDate = null;
    }
    location = (trip.cities || [])[0] || trip.country;
  }

  if (!eventDate) return null;

  const daysUntil = Math.ceil((eventDate - now) / (1000 * 60 * 60 * 24));

  return (
    <section>
      <h2 className="font-heading text-[1.2rem] text-foreground font-semibold leading-tight mb-3">Upcoming Event</h2>
      <div className="bg-[#F4EFE7] border border-border/50 rounded-[18px] p-4 flex items-center gap-4">
        <div className="flex flex-col items-center justify-center w-14 h-14 rounded-[12px] bg-card border border-border/50 flex-shrink-0">
          <span className="font-body text-[9px] uppercase tracking-wider text-muted-foreground leading-none">{format(eventDate, "MMM")}</span>
          <span className="font-heading text-[20px] text-foreground font-semibold leading-none mt-1">{format(eventDate, "d")}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-body text-[14px] text-foreground font-medium leading-tight truncate">{event}</p>
          {location && <p className="font-body text-[12px] text-muted-foreground mt-0.5 truncate">{location}</p>}
          <span className="inline-block mt-1.5 font-body text-[10px] text-olive bg-[#EFE9DF] px-2 py-0.5 rounded-full">
            {daysUntil > 0 ? `In ${daysUntil} Day${daysUntil > 1 ? "s" : ""}` : "Today"}
          </span>
        </div>
        <button
          onClick={() => onNavigate("Itinerary")}
          className="font-body text-[12px] text-foreground hover:text-olive inline-flex items-center gap-0.5 transition-colors flex-shrink-0"
        >
          View Itinerary <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </section>
  );
}