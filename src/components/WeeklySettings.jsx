import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { ent } from "@/lib/freshEntities";
import { WEEKLY_DAYS, weeklySettings } from "@/lib/weekly";

const TIMES = ["12:00", "15:00", "17:00", "18:00", "19:00", "20:00", "21:00"];
const fmt = (t) => { const [h, m] = t.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

// Settings: the weekly review pop-up, on or off, and when it comes.
export default function WeeklySettings() {
  const [prefs, setPrefs] = useState(null);
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const u = await base44.auth.me();
        setEmail(u.email);
        const p = await ent.UserPreferences.filter({ user_email: u.email });
        setPrefs(p[0] || {});
      } catch { setPrefs({}); }
    })();
  }, []);

  const patch = async (data) => {
    setPrefs((p) => ({ ...(p || {}), ...data }));
    setErr("");
    try {
      if (prefs?.id) await ent.UserPreferences.update(prefs.id, data);
      else if (email) { const c = await ent.UserPreferences.create({ user_email: email, ...data }); setPrefs((p) => ({ ...p, id: c.id })); }
      window.dispatchEvent(new CustomEvent("guia:prefs-patch", { detail: data }));
    } catch { setErr("Couldn't save. Try again."); }
  };

  if (!prefs) return null;
  const { day, time, off } = weeklySettings(prefs);
  const pill = (on) => `px-3 py-1.5 rounded-full text-[12.5px] border ${on ? "bg-[#A7773F] border-[#A7773F] text-[#F7F3EC]" : "border-border text-muted-foreground"}`;

  return (
    <section className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="font-heading text-lg text-foreground">Weekly review</h2>
          <p className="text-xs text-muted-foreground">A look back at your week and 3 picks for the next one, as a pop-up when you open Guía.</p>
        </div>
        <button type="button" role="switch" aria-checked={!off} aria-label="Weekly review pop-up" onClick={() => patch({ weekly_popup_off: !off })}
          className="relative w-10 h-6 rounded-full flex-shrink-0 transition-colors" style={{ backgroundColor: !off ? "#A7773F" : "#E7D9C6" }}>
          <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all" style={{ left: !off ? "18px" : "2px" }} />
        </button>
      </div>
      {!off && (
        <div className="border-t border-border/60 mt-4 pt-4 space-y-3">
          <div>
            <p className="text-sm text-foreground mb-1.5">Day</p>
            <div className="flex flex-wrap gap-1.5">
              {WEEKLY_DAYS.map(([d, l]) => <button key={d} type="button" onClick={() => patch({ weekly_day: d })} className={pill(day === d)}>{l}</button>)}
            </div>
          </div>
          <div>
            <p className="text-sm text-foreground mb-1.5">From</p>
            <div className="flex flex-wrap gap-1.5">
              {TIMES.map((t) => <button key={t} type="button" onClick={() => patch({ weekly_time: t })} className={pill(time === t)}>{fmt(t)}</button>)}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">It shows once, the first time you open Guía after this time. Miss it, and it waits until the end of the next day.</p>
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("guia:weekly-open", { detail: { mode: "review" } }))}
            className="text-[13px] font-medium text-[#A7773F]">Show it now</button>
        </div>
      )}
      {err && <p className="text-xs text-[#8F5F65] mt-2">{err}</p>}
    </section>
  );
}
