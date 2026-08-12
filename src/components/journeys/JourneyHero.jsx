import { parseISO } from "date-fns";
import { Edit2, Calendar, MapPin, ImageIcon } from "lucide-react";

function CircleProgress({ pct }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" className="flex-shrink-0">
      <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
      <circle
        cx="20" cy="20" r={r} fill="none" stroke="white" strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 20 20)"
      />
      <text x="20" y="20" textAnchor="middle" dominantBaseline="central" fill="white" fontSize="9" fontWeight="600" fontFamily="Inter, sans-serif">{pct}%</text>
    </svg>
  );
}

export default function JourneyHero({ trip, onOpen, onCustomize, onEditTrip, generating }) {
  const days = trip.start_date
    ? Math.ceil((parseISO(trip.start_date) - new Date()) / (1000 * 60 * 60 * 24))
    : null;
  const totalSpent = (trip.expense_items || []).reduce((s, e) => s + (e.amount || 0), 0);
  const budgetPct = trip.budget_target ? Math.min(100, Math.round((totalSpent / trip.budget_target) * 100)) : 0;
  const citiesCount = (trip.cities || []).length;
  const cityPath = (trip.cities || []).length > 0 ? trip.cities.join(" → ") : (trip.country || "");

  return (
    <div
      onClick={onOpen}
      className="relative w-full h-[230px] rounded-[24px] overflow-hidden cursor-pointer shadow-[0_20px_50px_-28px_rgba(0,0,0,0.4)]"
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
        {cityPath && <p className="font-body text-[12px] text-white/85 mt-0.5">{cityPath}</p>}

        {/* Metrics */}
        <div className="flex items-center justify-between mt-3 mb-3">
          <div className="flex flex-col items-center text-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-white/80" strokeWidth={1.6} />
            <span className="font-heading text-[18px] text-white font-semibold leading-none">{days !== null && days > 0 ? days : "—"}</span>
            <span className="font-body text-[8px] uppercase tracking-[0.08em] text-white/70">Days Remaining</span>
          </div>
          <div className="w-px h-10 bg-white/20" />
          <div className="flex flex-col items-center text-center gap-1">
            <CircleProgress pct={budgetPct} />
            <span className="font-body text-[8px] uppercase tracking-[0.08em] text-white/70">Budget Used</span>
          </div>
          <div className="w-px h-10 bg-white/20" />
          <div className="flex flex-col items-center text-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-white/80" strokeWidth={1.6} />
            <span className="font-heading text-[18px] text-white font-semibold leading-none">{citiesCount}</span>
            <span className="font-body text-[8px] uppercase tracking-[0.08em] text-white/70">Cities</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
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