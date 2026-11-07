import { computePlanningProgress } from "@/lib/journeyAi";

export default function JourneyProgress({ trip, onNavigate }) {
  const itinerary = trip.itinerary || [];
  const totalDays = itinerary.length;
  const daysWithActivities = itinerary.filter((d) => d.activities && d.activities.length > 0).length;
  const saved = (trip.about_info?.hot_spots || []).length + (trip.wish_list?.items || []).length;
  const packing = trip.packing_items || [];
  const packed = packing.filter((p) => p.packed).length;
  const spent = (trip.expense_items || []).reduce((s, e) => s + (e.amount || 0), 0);
  const pct = computePlanningProgress(trip);

  const chips = [
    { tab: "Itinerary", label: "Itinerary", value: totalDays ? `${daysWithActivities}/${totalDays}` : "Start" },
    { tab: "About", label: "Saved", value: saved },
    { tab: "Packing", label: "Packing", value: packing.length ? `${packed}/${packing.length}` : "Start" },
    { tab: "Budget", label: "Budget", value: trip.budget_target ? `$${spent.toLocaleString()} / $${trip.budget_target.toLocaleString()}` : "Set" },
  ];

  return (
    <section className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="font-heading text-lg text-foreground font-semibold leading-tight">Planning progress</h2>
        <span className="font-body text-[12px] text-muted-foreground">{pct}% ready</span>
      </div>
      <div className="h-1.5 rounded-full bg-[#F0E6D6] overflow-hidden mb-3">
        <div className="h-full bg-[#A7773F] rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <button
            key={c.tab}
            onClick={() => onNavigate(c.tab)}
            className="font-body text-[12px] px-3 py-1.5 rounded-full bg-[#F0E6D6] text-[#8B6B3E] hover:opacity-80 transition-opacity"
          >
            {c.label} · {c.value}
          </button>
        ))}
      </div>
    </section>
  );
}
