import { useEffect, useState } from "react";
import { Search, MapPin, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { ent } from "@/lib/freshEntities";
import { findPlaces, SEEN_KEY } from "@/lib/welcome";

// Settings: turn the daily welcome on or off, and pick the city for its weather.
export default function WelcomeSettings() {
  const [prefs, setPrefs] = useState(null);
  const [email, setEmail] = useState("");
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
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
    try {
      if (prefs?.id) await ent.UserPreferences.update(prefs.id, data);
      else if (email) { const c = await ent.UserPreferences.create({ user_email: email, ...data }); setPrefs((p) => ({ ...p, id: c.id })); }
      try { const raw = JSON.parse(localStorage.getItem("guia:nav-prefs") || "null"); if (raw) localStorage.setItem("guia:nav-prefs", JSON.stringify({ ...raw, ...data })); } catch { /* ignore */ }
    } catch { setErr("Couldn't save. Try again."); }
  };

  const search = async () => {
    if (!q.trim()) { setErr("Type a city first"); return; }
    setBusy(true); setErr(""); setResults(null);
    try {
      const r = await findPlaces(q.trim());
      setResults(r);
      if (!r.length) setErr("No places found. Try just the city name.");
    } catch { setErr("Couldn't search right now. Try again."); }
    setBusy(false);
  };

  if (!prefs) return null;
  const on = !prefs.welcome_off;
  const place = prefs.weather_place;

  return (
    <section className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="font-heading text-lg text-foreground">Daily welcome</h2>
          <p className="text-xs text-muted-foreground">A short welcome screen each time you open Guía after fully closing it.</p>
        </div>
        <button type="button" role="switch" aria-checked={on} aria-label="Daily welcome" onClick={() => patch({ welcome_off: on })}
          className="relative w-10 h-6 rounded-full flex-shrink-0 transition-colors" style={{ backgroundColor: on ? "#A7773F" : "#E7D9C6" }}>
          <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all" style={{ left: on ? "18px" : "2px" }} />
        </button>
      </div>

      {on && (
        <div className="border-t border-border/60 mt-4 pt-4">
          <p className="text-sm text-foreground mb-1">City for weather</p>
          {place && !results && (
            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-[#A7773F]" />{place.name}{place.region ? `, ${place.region}` : ""}</p>
          )}
          <div className="flex gap-2">
            <input value={q} onChange={(e) => { setQ(e.target.value); setErr(""); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(); } }}
              placeholder={place ? "Change city" : "Houston"}
              className="flex-1 min-w-0 bg-card border border-border rounded-xl px-3 py-2 text-[16px] md:text-sm text-foreground outline-none focus:border-[#A7773F]" />
            <button type="button" onClick={search} disabled={busy} aria-label="Search city"
              className="w-11 rounded-xl border border-border flex items-center justify-center text-foreground disabled:opacity-60">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </div>
          {err && <p className="text-xs text-destructive mt-1.5">{err}</p>}
          {results && results.length > 0 && (
            <div className="mt-2 rounded-xl border border-border overflow-hidden">
              {results.map((r, i) => (
                <button key={`${r.lat},${r.lon}`} type="button"
                  onClick={() => { patch({ weather_place: r }); setResults(null); setQ(""); }}
                  className={`w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-muted/50 ${i ? "border-t border-border/60" : ""}`}>
                  {r.name}<span className="text-muted-foreground">{r.region ? `, ${r.region}` : ""}</span>
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={() => { try { localStorage.removeItem(SEEN_KEY); } catch { /* ignore */ } window.dispatchEvent(new Event("guia:welcome-show")); }}
            className="mt-3 text-xs font-medium text-[#A7773F]">Show it now</button>
        </div>
      )}
    </section>
  );
}
