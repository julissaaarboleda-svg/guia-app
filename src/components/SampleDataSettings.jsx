import { useEffect, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { ent } from "@/lib/freshEntities";
import { loadSampleData, clearSampleData, isSampleMode, setSampleMode } from "@/lib/sampleData";

// Settings: fill the account with a made-up person's data (for demos and trying things out), reset it, or clear it.
export default function SampleDataSettings() {
  const [prefs, setPrefs] = useState(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState(null);
  const [msg, setMsg] = useState("");

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

  const on = !!prefs?.sample_data || isSampleMode();

  const savePref = async (sample_data) => {
    try {
      if (prefs?.id) await ent.UserPreferences.update(prefs.id, { sample_data });
      else if (email) { const c = await ent.UserPreferences.create({ user_email: email, sample_data }); setPrefs((p) => ({ ...p, id: c.id })); }
    } catch { /* the local flag still works on this device */ }
    setPrefs((p) => ({ ...(p || {}), sample_data }));
  };

  const run = async (kind) => {
    setMsg(""); setBusy(kind); setProgress(null);
    const tick = (d, t) => setProgress({ d, t });
    try {
      if (kind === "clear" || kind === "reset") await clearSampleData(tick);
      if (kind === "load" || kind === "reset") { await loadSampleData(tick); await savePref(true); setSampleMode(true); }
      if (kind === "clear") { await savePref(false); setSampleMode(false); }
      setMsg(kind === "clear" ? "Sample data cleared. Your own items weren't touched." : "Sample data is ready. Head to Home to see it.");
    } catch {
      setMsg("Something didn't finish. Try again.");
    }
    setBusy(""); setProgress(null);
  };

  if (!prefs) return null;

  return (
    <section className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl bg-[#A7773F]/10 text-[#A7773F] flex items-center justify-center shrink-0"><Sparkles className="w-[18px] h-[18px]" /></span>
        <div className="flex-1 min-w-0">
          <h2 className="font-heading text-lg text-foreground">Sample data</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {on
              ? "Sample data is on. AI features show pre-written examples, so they're free and always the same."
              : "Fill Guía with a made-up person's routines, tasks, trip, budget and more. Good for demos or trying things out."}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        {!on ? (
          <button type="button" disabled={!!busy} onClick={() => run("load")} className="h-10 px-4 rounded-xl bg-[#2E2A27] text-[#F7F3EC] text-sm disabled:opacity-60 inline-flex items-center gap-2">
            {busy === "load" && <Loader2 className="w-4 h-4 animate-spin" />}Load sample data
          </button>
        ) : (
          <>
            <button type="button" disabled={!!busy} onClick={() => run("reset")} className="h-10 px-4 rounded-xl bg-[#2E2A27] text-[#F7F3EC] text-sm disabled:opacity-60 inline-flex items-center gap-2">
              {busy === "reset" && <Loader2 className="w-4 h-4 animate-spin" />}Reset sample data
            </button>
            <button type="button" disabled={!!busy} onClick={() => { if (confirm("Remove all sample data? Anything you added yourself stays.")) run("clear"); }} className="h-10 px-4 rounded-xl border border-border text-sm text-foreground disabled:opacity-60 inline-flex items-center gap-2">
              {busy === "clear" && <Loader2 className="w-4 h-4 animate-spin" />}Clear sample data
            </button>
          </>
        )}
      </div>
      {progress && <p className="text-xs text-muted-foreground mt-2">{busy === "clear" ? "Removing" : "Adding"} {progress.d} of {progress.t}…</p>}
      {msg && !busy && <p className="text-xs text-muted-foreground mt-2">{msg}</p>}
      <p className="text-[11px] text-muted-foreground mt-3">Only sample items are ever removed. Anything you add yourself stays.</p>
    </section>
  );
}
