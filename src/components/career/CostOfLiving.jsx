import { useState, useEffect, useMemo } from "react";
import { ent } from "@/lib/freshEntities";
import { ChevronLeft, Plus, X } from "lucide-react";
import { fetchCityCosts, financeBaseline, scaleBudget, money, moneyK } from "@/lib/costOfLiving";

const inputCls = "w-full bg-secondary border border-input rounded-lg px-3 py-2 text-sm outline-none focus:border-ring";
const Label = ({ children }) => <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-1.5">{children}</p>;
const norm = (c) => String(c || "").trim().toLowerCase();

// Shared data: the saved profile + Finance baseline.
export function useLiving(currentJob) {
  const [profile, setProfile] = useState(null);
  const [fin, setFin] = useState({ bills: 0, subs: 0 });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const [list, items] = await Promise.all([ent.LivingProfile.list(), ent.FinanceItem.list()]);
        setFin(financeBaseline(items));
        const p = list[0];
        setProfile(p || { home_city: "", salary: currentJob?.salary || "", groceries: "", transport: "", fun: "", compare_cities: [] });
      } catch { setProfile({ home_city: "", salary: currentJob?.salary || "", groceries: "", transport: "", fun: "", compare_cities: [] }); }
      setReady(true);
    })();
  }, []);
  const save = async (next) => {
    setProfile(next);
    try { next.id ? await ent.LivingProfile.update(next.id, next) : setProfile(await ent.LivingProfile.create(next)); } catch (e) { console.error(e); }
  };
  return { profile, fin, save, ready };
}

const configured = (p) => p && p.home_city && Number(p.salary) > 0;

function Baseline({ profile, fin, save }) {
  const [d, setD] = useState(profile);
  useEffect(() => setD(profile), [profile?.id]);
  const set = (k) => (e) => setD((x) => ({ ...x, [k]: e.target.value }));
  const total = fin.bills + fin.subs + (Number(d.groceries) || 0) + (Number(d.transport) || 0) + (Number(d.fun) || 0);
  return (
    <div className="bg-card border border-border rounded-2xl p-4 mb-3">
      <Label>Where you live now</Label>
      <input value={d.home_city || ""} onChange={set("home_city")} placeholder="City, State (e.g. Houston, TX)" className={`${inputCls} mb-3`} />
      <Label>Your current pay (per year, before taxes)</Label>
      <input type="number" inputMode="numeric" value={d.salary || ""} onChange={set("salary")} placeholder="85000" className={`${inputCls} mb-1`} />
      <p className="text-[11px] text-muted-foreground mb-3">Filled in from your current role when it's saved there.</p>
      <Label>Your comfortable month</Label>
      <div className="text-sm">
        <div className="flex justify-between py-2"><span>Rent &amp; bills <span className="text-[11px] text-muted-foreground">from Finance</span></span><b className="font-semibold">{money(fin.bills)}</b></div>
        <div className="flex justify-between py-2 border-t border-border"><span>Subscriptions <span className="text-[11px] text-muted-foreground">from Finance</span></span><b className="font-semibold">{money(fin.subs)}</b></div>
        {[["groceries", "Groceries & dining"], ["transport", "Transport"], ["fun", "Fun & savings"]].map(([k, label]) => (
          <div key={k} className="flex items-center justify-between py-1.5 border-t border-border gap-3"><span>{label}</span>
            <input type="number" inputMode="numeric" value={d[k] || ""} onChange={set(k)} placeholder="0" className="w-24 bg-secondary border border-input rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:border-ring" /></div>
        ))}
        <div className="flex justify-between py-2 border-t-2 border-border"><b className="font-semibold">Comfortable total</b><b className="font-semibold">{money(total)} / mo</b></div>
      </div>
      <button onClick={() => save({ ...d, salary: Number(d.salary) || 0, groceries: Number(d.groceries) || 0, transport: Number(d.transport) || 0, fun: Number(d.fun) || 0 })}
        className="w-full text-white rounded-full py-2.5 text-sm font-medium mt-2" style={{ background: "#A7773F" }}>Save baseline</button>
    </div>
  );
}

function useCosts(cities) {
  const [tick, setTick] = useState(0);
  const key = cities.map(norm).filter(Boolean).join("|");
  const [costs, setCosts] = useState({});
  const [state, setState] = useState("idle");
  useEffect(() => {
    if (!key) return;
    let alive = true; setState("loading");
    fetchCityCosts(cities).then((c) => { if (alive) { setCosts(c); setState("ok"); } }).catch(() => alive && setState("error"));
    return () => { alive = false; };
  }, [key, tick]);
  return { costs, state, retry: () => setTick((t) => t + 1) };
}

const verdictFor = (offer, needed) => {
  if (!(offer > 0)) return null;
  const gap = offer - needed;
  if (gap >= 0) return { cls: "bg-[#E4E9D5] text-[#3F4A27]", title: "Comfortable", text: `That keeps you at least as comfortable as now, with about ${moneyK(gap)} to spare.` };
  if (offer >= needed * 0.95) return { cls: "bg-[#F3E8D6] text-[#8A5F27]", title: "Tight but workable", text: `About ${money(-gap)} a year short of keeping your lifestyle the same. Worth negotiating.` };
  return { cls: "bg-[#F4E6E7] text-[#8F5F65]", title: "You'd likely feel it", text: `About ${moneyK(-gap)} a year short of keeping your lifestyle the same.` };
};

// ---- Role card: city + offer -> verdict ----
export function RoleCostCard({ role, onPatch, currentJob, onOpenSetup }) {
  const { profile, fin, ready } = useLiving(currentJob);
  const [city, setCity] = useState(role.col_city || "");
  const [offer, setOffer] = useState(role.col_offer || "");
  const [go, setGo] = useState(!!role.col_city);
  const { costs, state } = useCosts(configured(profile) && go ? [profile.home_city, city] : []);
  if (!ready) return null;
  if (!configured(profile)) {
    return (
      <div className="bg-card border border-border rounded-2xl p-4">
        <Label>Cost of living</Label>
        <p className="text-xs text-muted-foreground mb-2">Set your city and pay once to see if a new city keeps you as comfortable.</p>
        <button onClick={onOpenSetup} className="text-xs font-medium" style={{ color: "#A7773F" }}>Set up my baseline ›</button>
      </div>
    );
  }
  const home = costs[norm(profile.home_city)], to = costs[norm(city)];
  const calc = home && to ? scaleBudget(profile, fin, home, to) : null;
  const needed = calc ? Number(profile.salary) * calc.ratio : 0;
  const v = calc ? verdictFor(Number(offer), needed) : null;
  return (
    <div className="space-y-3">
      <div className="bg-card border border-border rounded-2xl p-4">
        <Label>Cost of living vs {profile.home_city}</Label>
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City for this role (e.g. Austin, TX)" className={`${inputCls} mb-2`} />
        <input type="number" inputMode="numeric" value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="Offered salary per year (optional)" className={inputCls} />
        <button onClick={() => { setGo(true); onPatch({ col_city: city, col_offer: Number(offer) || 0 }); }} disabled={!city.trim()} className="w-full text-white rounded-full py-2.5 text-sm font-medium mt-3 disabled:opacity-50" style={{ background: "#A7773F" }}>{state === "loading" ? "Checking prices…" : "Compare"}</button>
        {state === "error" && <p className="text-xs text-[#8F5F65] mt-2">Couldn't get prices for that city. Please try again.</p>}
      </div>
      {calc && (
        <>
          <div className={`rounded-2xl px-4 py-3 ${v ? v.cls : "bg-secondary text-foreground"}`}>
            <p className="text-lg font-semibold">{v ? v.title : calc.pct === 0 ? "About the same cost" : `${Math.abs(calc.pct)}% ${calc.pct > 0 ? "more" : "less"} than ${profile.home_city}`}</p>
            <p className="text-xs mt-0.5">{v ? v.text : `Add an offered salary to see if it keeps you comfortable.`}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <Label>To live the same way in {to.name || city}</Label>
            <div className="flex justify-between text-sm"><span>You'd need <b className="font-semibold">{money(needed)}</b> a year</span>{Number(offer) > 0 && <span className={Number(offer) >= needed ? "text-[#566033]" : "text-[#8F5F65]"}>{Number(offer) >= needed ? "Offer covers it" : `${money(needed - Number(offer))} short`}</span>}</div>
            <p className="text-[11.5px] text-muted-foreground mt-1">That's {Math.abs(calc.pct)}% {calc.pct >= 0 ? "more" : "less"} than your {money(profile.salary)} today.</p>
            <div className="mt-3">{calc.lines.filter((l) => l.base > 0).map((l) => (
              <div key={l.key} className="flex justify-between text-[13px] py-1.5 border-t border-border first:border-0"><span>{l.label}</span><b className={`font-semibold ${l.diff > 0 ? "text-[#8F5F65]" : l.diff < 0 ? "text-[#566033]" : ""}`}>{l.diff === 0 ? "same" : `${l.diff > 0 ? "+" : "−"}${money(Math.abs(l.diff))} / mo`}</b></div>
            ))}</div>
            <p className="text-[11px] text-muted-foreground mt-2">Estimates from public price data, before taxes. Not exact quotes.</p>
          </div>
        </>
      )}
    </div>
  );
}

// ---- Standalone: baseline + compare cities ----
export default function CostOfLivingView({ currentJob, onBack }) {
  const { profile, fin, save, ready } = useLiving(currentJob);
  const [newCity, setNewCity] = useState("");
  const cities = profile?.compare_cities || [];
  const { costs, state, retry } = useCosts(configured(profile) ? [profile.home_city, ...cities] : []);
  const calcs = useMemo(() => {
    if (!configured(profile)) return [];
    const home = costs[norm(profile.home_city)];
    if (!home) return [];
    return cities.map((c) => ({ city: c, data: costs[norm(c)], calc: costs[norm(c)] ? scaleBudget(profile, fin, home, costs[norm(c)]) : null }));
  }, [costs, profile, fin]);
  if (!ready) return <div className="h-24 bg-muted rounded-2xl animate-pulse" />;
  const home = costs[norm(profile.home_city)];
  const best = calcs.filter((c) => c.calc).sort((a, b) => a.calc.ratio - b.calc.ratio)[0];
  return (
    <div className="mb-4">
      <button onClick={onBack} className="text-xs text-muted-foreground flex items-center gap-1 mb-2"><ChevronLeft className="w-3.5 h-3.5" /> Back</button>
      <h2 className="font-heading text-xl text-foreground">Cost of living</h2>
      <p className="font-heading italic text-sm text-muted-foreground mb-3">What “comfortable” looks like for you.</p>
      <Baseline profile={profile} fin={fin} save={save} />
      {configured(profile) && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <Label>Compare cities</Label>
          <div className="flex gap-2 mb-3">
            <input value={newCity} onChange={(e) => setNewCity(e.target.value)} placeholder="Add a city (e.g. Austin, TX)" className={inputCls} />
            <button onClick={() => { if (newCity.trim()) { save({ ...profile, compare_cities: [...cities, newCity.trim()] }); setNewCity(""); } }} className="px-3 rounded-lg text-white" style={{ background: "#A7773F" }} aria-label="Add city"><Plus className="w-4 h-4" /></button>
          </div>
          {state === "loading" && <div className="h-16 bg-muted rounded-xl animate-pulse" />}
          {state === "error" && <p className="text-xs text-[#8F5F65]">Couldn't get prices right now. <button onClick={retry} className="underline font-medium">Try again</button></p>}
          {home && calcs.length > 0 && (
            <>
              <p className="text-[13px] text-foreground mb-2">What costs <b className="font-semibold">$100</b> in {profile.home_city} costs about:</p>
              {calcs.map(({ city, data, calc }) => (
                <div key={city} className="py-2.5 border-t border-border">
                  <div className="flex items-center justify-between"><p className="text-[14.5px] text-foreground">{city}</p>
                    <button onClick={() => save({ ...profile, compare_cities: cities.filter((c) => c !== city) })} className="text-muted-foreground/50"><X className="w-3.5 h-3.5" /></button></div>
                  {calc ? (
                    <>
                      <p className="text-[13px]"><b className="font-semibold">${100 + calc.pct}</b> <span className={calc.pct > 0 ? "text-[#8F5F65]" : "text-[#566033]"}>({calc.pct === 0 ? "same" : `${calc.pct > 0 ? "+" : ""}${calc.pct}%`})</span> · you'd need <b className="font-semibold">{moneyK(Number(profile.salary) * calc.ratio)}</b> a year</p>
                      <p className="text-[11.5px] text-muted-foreground">Rent ≈ {money(data.rent)} · Groceries ≈ {money(data.groceries)} · Transport ≈ {money(data.transport)}</p>
                    </>
                  ) : <p className="text-xs text-muted-foreground">No data for this city.</p>}
                </div>
              ))}
              {best && best.calc.ratio > 1 && <p className="text-xs rounded-lg px-3 py-2 bg-[#E4E9D5] text-[#3F4A27] mt-2">{profile.home_city} is your best value of these. Your pay goes furthest there.</p>}
              {best && best.calc.ratio <= 1 && <p className="text-xs rounded-lg px-3 py-2 bg-[#E4E9D5] text-[#3F4A27] mt-2">{best.city} would stretch your pay the furthest of these.</p>}
              <p className="text-[11px] text-muted-foreground mt-2">Estimates from public price data, before taxes. Not exact quotes.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
