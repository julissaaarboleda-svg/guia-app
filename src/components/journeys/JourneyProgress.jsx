import { CalendarRange, MapPin, Backpack, Wallet, ChevronRight } from "lucide-react";
import { parseISO } from "date-fns";

export default function JourneyProgress({ trip, onNavigate }) {
  const itinerary = trip.itinerary || [];
  const daysNeedingActivities = itinerary.filter(
    (d) => !d.activities || d.activities.length === 0
  ).length;

  const savedPlaces = (trip.about_info?.hot_spots || []).length;

  const packing = (trip.packing_items || []);
  const packingRemaining = packing.filter((p) => !p.packed).length;

  const totalSpent = (trip.expense_items || []).reduce((s, e) => s + (e.amount || 0), 0);
  const budgetPct = trip.budget_target ? Math.min(100, Math.round((totalSpent / trip.budget_target) * 100)) : 0;

  const cards = [
    {
      icon: CalendarRange,
      title: "Resume Itinerary",
      status: daysNeedingActivities > 0 ? `${daysNeedingActivities} day${daysNeedingActivities > 1 ? "s" : ""} still need activities` : "Itinerary is complete",
      tab: "Itinerary",
    },
    {
      icon: MapPin,
      title: "Saved Places",
      status: savedPlaces > 0 ? `${savedPlaces} place${savedPlaces > 1 ? "s" : ""} waiting to be scheduled` : "No saved places yet",
      tab: "About",
    },
    {
      icon: Backpack,
      title: "Continue Packing",
      status: packing.length > 0 ? `${packingRemaining} item${packingRemaining !== 1 ? "s" : ""} remaining` : "Start your packing list",
      tab: "Packing",
    },
    {
      icon: Wallet,
      title: "Review Budget",
      status: trip.budget_target ? `${budgetPct}% used on this trip` : "Set a budget target",
      tab: "Budget",
    },
  ];

  return (
    <section>
      <h2 className="font-heading text-lg text-foreground font-semibold leading-tight mb-2">Journey Progress</h2>
      <div className="grid grid-cols-4 gap-1.5">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.title}
              onClick={() => onNavigate(c.tab)}
              className="bg-card border border-border/70 rounded-xl p-2 text-left flex flex-col gap-1 hover:border-foreground/30 transition-colors"
            >
              <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <Icon className="w-3.5 h-3.5 text-foreground" strokeWidth={1.6} />
              </span>
              <p className="font-body text-[11px] text-foreground font-semibold leading-tight">{c.title}</p>
              <p className="font-body text-[9px] text-muted-foreground leading-snug">{c.status}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}