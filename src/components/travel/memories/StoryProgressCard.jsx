import { computeStoryProgress, continueArea } from "@/lib/memoryUtils";

export default function StoryProgressCard({ trip, onContinue }) {
  const pct = computeStoryProgress(trip);
  const area = continueArea(trip);
  return (
    <div className="bg-card border border-border rounded-2xl p-3 flex items-center gap-3">
      <div className="relative w-11 h-11 flex-shrink-0">
        <svg width="44" height="44" viewBox="0 0 44 44" className="-rotate-90">
          <circle cx="22" cy="22" r="18" fill="none" stroke="hsl(var(--muted))" strokeWidth="3.5" />
          <circle
            cx="22" cy="22" r="18" fill="none" stroke="hsl(var(--accent))" strokeWidth="3.5" strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 18}
            strokeDashoffset={2 * Math.PI * 18 * (1 - pct / 100)}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-heading text-[10px] font-semibold">{pct}%</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-heading text-[13px] text-foreground font-semibold leading-tight">Your travel story is coming together</p>
        <p className="font-body text-[10.5px] text-muted-foreground mt-0.5 leading-snug">Add a few more photos or notes for an even better recap.</p>
        <button onClick={() => onContinue(area)} className="mt-1.5 bg-accent text-accent-foreground text-[11px] font-medium px-3 py-1.5 rounded-full hover:opacity-90">
          Add a memory
        </button>
      </div>
    </div>
  );
}
