function RingStat({ value, pct, label, sublabel, onClick }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <button onClick={onClick} className="flex flex-col items-center text-center gap-1.5 flex-1 min-w-0">
      <svg width="68" height="68" viewBox="0 0 68 68" className="flex-shrink-0">
        <circle cx="34" cy="34" r={r} fill="none" stroke="#A7773F26" strokeWidth="4" />
        <circle
          cx="34" cy="34" r={r} fill="none" stroke="#A7773F" strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 34 34)"
        />
        <text x="34" y="34" textAnchor="middle" dominantBaseline="central" className="fill-foreground font-heading" fontSize="15" fontWeight="600">
          {value}
        </text>
      </svg>
      <div className="min-w-0">
        <p className="font-body text-[12px] text-foreground font-medium leading-tight truncate">{label}</p>
        <p className="font-body text-[10px] text-muted-foreground leading-snug mt-0.5 truncate">{sublabel}</p>
      </div>
    </button>
  );
}

export default function JourneyProgress({ trip, onNavigate }) {
  const itinerary = trip.itinerary || [];
  const totalDays = itinerary.length;
  const daysWithActivities = itinerary.filter((d) => d.activities && d.activities.length > 0).length;
  const itineraryPct = totalDays ? Math.round((daysWithActivities / totalDays) * 100) : 0;

  const savedPlaces = (trip.about_info?.hot_spots || []).length;

  const packing = trip.packing_items || [];
  const packedCount = packing.filter((p) => p.packed).length;
  const packingPct = packing.length ? Math.round((packedCount / packing.length) * 100) : 0;

  const totalSpent = (trip.expense_items || []).reduce((s, e) => s + (e.amount || 0), 0);
  const budgetPct = trip.budget_target ? Math.min(100, Math.round((totalSpent / trip.budget_target) * 100)) : 0;

  return (
    <section>
      <div className="flex items-end justify-between mb-3">
        <h2 className="font-heading text-lg text-foreground font-semibold leading-tight">Journey Progress</h2>
        <button
          onClick={() => onNavigate("Itinerary")}
          className="font-body text-[11px] text-accent hover:text-accent/80 transition-colors"
        >
          See all progress →
        </button>
      </div>
      <div className="flex items-start justify-between gap-1">
        <RingStat
          value={`${itineraryPct}%`}
          pct={itineraryPct}
          label="Itinerary"
          sublabel={totalDays ? `${daysWithActivities} of ${totalDays} days` : "Not started"}
          onClick={() => onNavigate("Itinerary")}
        />
        <RingStat
          value={savedPlaces}
          pct={0}
          label="Saved"
          sublabel="places"
          onClick={() => onNavigate("About")}
        />
        <RingStat
          value={`${packingPct}%`}
          pct={packingPct}
          label="Packing"
          sublabel={packing.length ? `${packedCount} of ${packing.length} items` : "Not started"}
          onClick={() => onNavigate("Packing")}
        />
        <RingStat
          value={`${budgetPct}%`}
          pct={budgetPct}
          label="Budget"
          sublabel={trip.budget_target ? `$${totalSpent.toLocaleString()} / $${trip.budget_target.toLocaleString()}` : "Not set"}
          onClick={() => onNavigate("Budget")}
        />
      </div>
    </section>
  );
}
