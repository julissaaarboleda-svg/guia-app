import { useState } from "react";
import { parseISO, format } from "date-fns";
import { ArrowRight, Plane, BedDouble, CalendarClock } from "lucide-react";

function iconForEvent(text) {
  const t = (text || "").toLowerCase();
  if (/(flight|arrival|depart|airport|land)/.test(t)) return Plane;
  if (/(hotel|check-in|checkin|check in|checkout|stay)/.test(t)) return BedDouble;
  return CalendarClock;
}

export default function UpcomingEvent({ trip, onNavigate }) {
  const [expanded, setExpanded] = useState(false);
  const now = new Date();

  const upcomingDays = (trip.itinerary || [])
    .filter((d) => d.date)
    .map((d) => ({ ...d, _d: parseISO(d.date) }))
    .filter((d) => d._d >= now)
    .sort((a, b) => a._d - b._d);

  const events = [];
  for (const day of upcomingDays) {
    const acts = [...(day.activities || [])].sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
    if (acts.length > 0) {
      acts.forEach((act) => {
        events.push({
          date: day._d,
          title: act.name || act.activity || day.title || trip.title,
          subtitle: act.location || (trip.cities || [])[0] || trip.country,
        });
      });
    } else if (day.title) {
      events.push({ date: day._d, title: day.title, subtitle: (trip.cities || [])[0] || trip.country });
    }
    if (events.length >= 3) break;
  }
  if (events.length === 0 && trip.start_date) {
    const d = parseISO(trip.start_date);
    if (d >= now) events.push({ date: d, title: trip.title, subtitle: (trip.cities || [])[0] || trip.country });
  }

  if (events.length === 0) return null;

  const shown = expanded ? events.slice(0, 3) : events.slice(0, 1);

  return (
    <section>
      <div className="flex items-end justify-between mb-3">
        <h2 className="font-heading text-lg text-foreground font-semibold leading-tight">Up Next</h2>
        {events.length > 1 && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="font-body text-[11px] text-accent hover:text-accent/80 transition-colors"
          >
            {expanded ? "Show less" : "View all events →"}
          </button>
        )}
      </div>

      <div className="bg-card border border-border/50 rounded-[18px] overflow-hidden">
        {shown.map((ev, i) => {
          const daysUntil = Math.ceil((ev.date - now) / (1000 * 60 * 60 * 24));
          const Icon = iconForEvent(ev.title);
          return (
            <div
              key={i}
              className={`flex items-center gap-4 p-4 ${i > 0 ? "border-t border-border/40" : ""}`}
            >
              <div className="flex flex-col items-center justify-center w-14 h-14 rounded-[12px] bg-[#F4EFE7] flex-shrink-0">
                <span className="font-body text-[9px] uppercase tracking-wider text-muted-foreground leading-none">{format(ev.date, "MMM")}</span>
                <span className="font-heading text-[20px] text-foreground font-semibold leading-none mt-1">{format(ev.date, "d")}</span>
              </div>
              <span className="w-9 h-9 rounded-full bg-[#F4EFE7] flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-foreground" strokeWidth={1.6} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-body text-[14px] text-foreground font-medium leading-tight truncate">{ev.title}</p>
                {ev.subtitle && <p className="font-body text-[12px] text-muted-foreground mt-0.5 truncate">{ev.subtitle}</p>}
                <span className="inline-block mt-1.5 font-body text-[10px] text-olive bg-[#EFE9DF] px-2 py-0.5 rounded-full">
                  {daysUntil > 0 ? `In ${daysUntil} Day${daysUntil > 1 ? "s" : ""}` : "Today"}
                </span>
              </div>
              <button
                onClick={() => onNavigate("Itinerary")}
                className="font-body text-[12px] text-foreground hover:text-olive inline-flex items-center gap-0.5 transition-colors flex-shrink-0"
              >
                View Details <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
