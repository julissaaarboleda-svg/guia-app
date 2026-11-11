import { useNavigate } from "react-router-dom";
import { colorOf, dayKey, isScheduled, doneOn, completeOn } from "@/lib/routines";

// Compact home strip: routines scheduled for today and how far along each one is.
export default function TodaysRoutines({ routines = [] }) {
  const navigate = useNavigate();
  const today = dayKey();
  const due = routines.filter((r) => isScheduled(r) && (r.steps || []).length);
  if (!due.length) return null;
  const total = due.reduce((t, r) => t + r.steps.length, 0);
  const done = due.reduce((t, r) => t + doneOn(r, today), 0);
  return (
    <section className="mb-5">
      <div className="flex items-baseline justify-between mb-2.5">
        <h2 className="font-heading text-[20px] text-foreground">Today's routines</h2>
        <button onClick={() => navigate("/goals?view=routines")} className="text-[13px] font-medium text-[#A7773F]">Open</button>
      </div>
      <button onClick={() => navigate("/goals?view=routines")} className="w-full text-left rounded-2xl border border-border/60 bg-card px-3.5 py-3 hover:border-[#A7773F]/50 transition-colors">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {due.map((r) => (
            <span key={r.id} className="inline-flex items-center gap-1.5 text-[12.5px] text-foreground">
              <span className="w-2 h-2 rounded-full" style={{ background: colorOf(r) }} />
              {r.name} <span className="text-muted-foreground">{completeOn(r, today) ? "· done" : `· ${doneOn(r, today)} of ${r.steps.length}`}</span>
            </span>
          ))}
        </div>
        <div className="h-[5px] rounded-full bg-[#EFE8DC] mt-2.5 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${Math.round((done / total) * 100)}%`, background: "linear-gradient(90deg,#A77C81,#A7773F,#7D8A53)" }} />
        </div>
      </button>
    </section>
  );
}
