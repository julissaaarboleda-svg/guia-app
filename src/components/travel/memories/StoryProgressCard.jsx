import { computeStoryProgress, continueArea } from "@/lib/memoryUtils";

// Props confirmed from MemoriesTab.jsx: <StoryProgressCard trip={trip} onContinue={(area) => setView(area)} />
export default function StoryProgressCard({ trip, onContinue }) {
  const pct = computeStoryProgress(trip);
  const area = continueArea(trip);

  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
      <div className="relative w-14 h-14 flex-shrink-0">
        <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
          <circle cx="28" cy="28" r="24" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
          <circle
            cx="28" cy="28" r="24" fill="none" stroke="hsl(var(--accent))" strokeWidth="4" strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 24}
            strokeDashoffset={2 * Math.PI * 24 * (1 - pct / 100)}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-heading text-xs font-semibold">{pct}%</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-heading text-sm text-foreground font-semibold">Your travel story is coming together</p>
        <p className="font-body text-xs text-muted-foreground mt-0.5">Add a few more photos or notes to create an even more beautiful recap.</p>
        <button onClick={() => onContinue(area)} className="mt-2 bg-accent text-accent-foreground text-xs font-medium px-3 py-1.5 rounded-full hover:opacity-90">
          Add a memory
        </button>
      </div>
    </div>
  );
}
