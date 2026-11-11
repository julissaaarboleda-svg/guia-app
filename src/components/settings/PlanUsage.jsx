import { useEffect, useState } from "react";
import { getAiUsage } from "@/api/base44Client";

// "Plan & AI uses" card in Settings: shows the plan and how many AI uses are left this month.
export default function PlanUsage() {
  const [u, setU] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => { getAiUsage().then(setU).catch(() => setErr(true)); }, []);
  if (err) return null;
  const pct = u ? Math.min(100, Math.round((u.used / u.limit) * 100)) : 0;
  const left = u ? Math.max(0, u.limit - u.used) : 0;
  const plus = u?.plan === "plus";
  return (
    <section className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-baseline justify-between mb-1">
        <h2 className="font-heading text-lg text-foreground">Plan & AI uses</h2>
        <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${plus ? "bg-[#A7773F] text-[#F7F3EC]" : "bg-secondary text-muted-foreground"}`}>{u ? (plus ? "Guía Plus" : "Free") : "…"}</span>
      </div>
      <p className="text-[13px] text-muted-foreground mb-3">AI uses are imports, summaries, suggestions and generated images. Everything else is unlimited.</p>
      {u && (
        <>
          <div className="flex items-baseline justify-between text-[13px] mb-1.5">
            <span className="text-foreground">{u.used} of {u.limit} used this month</span>
            <span className="text-muted-foreground">Resets {u.resetsLabel}</span>
          </div>
          <div className="h-1.5 rounded-full bg-[#EFE9DF] overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 90 ? "#8F5F65" : "#A7773F" }} />
          </div>
          <p className="text-[12px] text-muted-foreground mt-2">
            {left === 0 && u.enforced ? (plus ? "You've reached this month's fair-use limit." : "You're out of AI uses this month. Plus raises the limit to 500.")
              : !u.enforced ? "Limits aren't switched on yet, so nothing is blocked." : `${left} left.`}
          </p>
        </>
      )}
    </section>
  );
}
