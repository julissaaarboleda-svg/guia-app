import { useEffect, useMemo, useRef, useState } from "react";
import { Check, X, ArrowRight, CornerDownRight, Plus } from "lucide-react";
import { ent } from "@/lib/freshEntities";
import { reviewWeek, buildReview, activeFocus, weeklyDue, WEEKLY_SEEN_KEY } from "@/lib/weekly";

const safe = async (p) => { try { return (await p) || []; } catch { return []; } };
const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString("en-US")}`;
const KIND_TAG = { task: "task", goal: "goal step", bill: "bill", routine: "routine", trip: "trip", custom: "" };
// One pop-up per app start at most.
const BOOT = { shown: false };

// The weekly review as a pop-up over Home: last week's wins, then up to 3
// picks for the week ahead. Opens on its own at the chosen day/time (see
// weeklyDue), or from "Change" on Home's This week strip (straight to picks).
export default function WeeklyPopup({ user, prefs }) {
  const week = useMemo(() => reviewWeek(), []);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const [mode, setMode] = useState("review"); // "review" | "change"
  const [step, setStep] = useState(1);
  const [data, setData] = useState(null);
  const [options, setOptions] = useState([]);
  const [picks, setPicks] = useState([]);
  const [custom, setCustom] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  // Which week the picks are for: the coming week after a review, or the
  // current week's picks when changing them mid-week.
  const targetKey = mode === "change" ? (activeFocus(prefs)?.week || week.nextKey) : week.nextKey;

  const start = async (m) => {
    setMode(m); setStep(m === "change" ? 2 : 1); setMsg(""); setOpen(true);
    requestAnimationFrame(() => setShown(true));
    const p = prefsRef.current || {};
    const [routines, tasks, goals, finItems, trips] = await Promise.all([
      safe(ent.Routine.list()), safe(ent.Task.list()), safe(ent.Goal.list()), safe(ent.FinanceItem.list()), safe(ent.Trip.list()),
    ]);
    const rev = buildReview({ routines, tasks, goals, finItems, trips }, week);
    // Last week's picks: what got done, and what can carry over.
    const prev = p.week_focus?.week === week.key ? p.week_focus : null;
    const pickDone = (it) => !!prev?.done?.[it.id] || (it.kind === "task" && it.refId && !!tasks.find((t) => t.id === it.refId)?.completed);
    const prevItems = (prev?.items || []).map((it) => ({ ...it, done: pickDone(it) }));
    const carry = prevItems.filter((it) => !it.done).map((it) => ({ text: it.text, kind: it.kind, refId: it.refId, tag: "carried over" }));
    const sugg = (rev.suggestions || []).map((s) => ({ ...s, tag: KIND_TAG[s.kind] || "" }));
    const opts = [...carry, ...sugg.filter((s) => !carry.some((c) => c.text.toLowerCase() === s.text.toLowerCase()))].slice(0, 6);
    const editing = m === "change" ? activeFocus(p) : (p.week_focus?.week === week.nextKey ? p.week_focus : null);
    const current = editing ? editing.items.map((i) => ({ text: i.text, kind: i.kind, refId: i.refId, tag: KIND_TAG[i.kind] || "" })) : [];
    setOptions([...current, ...opts.filter((o) => !current.some((c) => c.text === o.text))]);
    setPicks(current.length ? current.map((c) => c.text) : carry.slice(0, 3).map((c) => c.text));
    setData({ ...rev, prevItems });
  };

  // Open by itself when it's due (once per app start); open from Home's "Change".
  useEffect(() => {
    if (!user || !prefs || BOOT.shown || open) return;
    if (weeklyDue(prefs)) { BOOT.shown = true; start("review"); }
  }, [user, prefs]);
  useEffect(() => {
    const on = (e) => start(e.detail?.mode === "review" ? "review" : "change");
    window.addEventListener("guia:weekly-open", on);
    return () => window.removeEventListener("guia:weekly-open", on);
  }, []);

  const close = () => { setShown(false); setTimeout(() => { setOpen(false); setData(null); }, 300); };
  const markSeen = () => { try { localStorage.setItem(WEEKLY_SEEN_KEY, week.key); } catch { /* ignore */ } };

  const savePrefs = async (patch) => {
    const p = prefsRef.current;
    if (p?.id) await ent.UserPreferences.update(p.id, patch);
    else if (user?.email) {
      const found = await ent.UserPreferences.filter({ user_email: user.email });
      if (found[0]) await ent.UserPreferences.update(found[0].id, patch);
      else await ent.UserPreferences.create({ user_email: user.email, ...patch });
    }
    window.dispatchEvent(new CustomEvent("guia:prefs-patch", { detail: patch }));
  };

  const toggle = (text) => {
    setMsg("");
    if (picks.includes(text)) { setPicks(picks.filter((p) => p !== text)); return; }
    if (picks.length >= 3) { setMsg("3 is the limit. Unpick one first."); return; }
    setPicks([...picks, text]);
  };
  const addCustom = () => {
    const t = custom.trim();
    if (!t) return;
    if (!options.some((o) => o.text.toLowerCase() === t.toLowerCase())) setOptions((o) => [...o, { text: t, kind: "custom", tag: "" }]);
    setCustom("");
    if (picks.length < 3 && !picks.includes(t)) setPicks((p) => [...p, t]);
    else if (picks.length >= 3) setMsg("Added. Unpick one to choose it.");
  };

  const finish = async () => {
    if (!picks.length) { setMsg("Pick at least one, or skip this week"); return; }
    setSaving(true);
    const p = prefsRef.current || {};
    const keepDone = p.week_focus?.week === targetKey ? (p.week_focus.done || {}) : {};
    const items = picks.map((text, i) => {
      const o = options.find((x) => x.text === text) || { text, kind: "custom" };
      return { id: `${targetKey}-${i}-${text.slice(0, 12)}`, text, kind: o.kind, refId: o.refId || null };
    });
    const patch = { week_focus: { week: targetKey, items, done: keepDone } };
    if (mode === "review") patch.review_done_week = week.key;
    try {
      await savePrefs(patch);
      if (mode === "review") markSeen();
      close();
    } catch { setMsg("Couldn't save. Try again."); }
    setSaving(false);
  };

  const skip = async () => {
    markSeen();
    close();
    try { await savePrefs({ review_done_week: week.key }); } catch { /* seen on this device anyway */ }
  };

  if (!open) return null;
  const d = data;
  const prevDone = (d?.prevItems || []).filter((i) => i.done).length;
  const stats = d ? [
    [d.tasksDone, "tasks finished"],
    [d.rate != null ? `${d.rate}%` : "–", "routines kept"],
    [d.stepsDone, "goal steps done"],
    [d.billsPaid ? (d.billsPaidAmt ? money(d.billsPaidAmt) : d.billsPaid) : 0, "bills paid"],
  ] : [];
  const wins = d ? [
    ...(d.prevItems || []).filter((i) => i.done).map((i) => ({ text: i.text, done: true })),
    ...(d.wins || []).filter((w) => !(d.prevItems || []).some((i) => i.text === w)).map((w) => ({ text: w, done: true })),
  ].slice(0, 4) : [];
  const carryList = (d?.prevItems || []).filter((i) => !i.done);

  return (
    <div className={`fixed inset-0 z-[80] bg-[#F7F3EC] overflow-y-auto transition-opacity duration-300 ${shown ? "opacity-100" : "opacity-0"}`} role="dialog" aria-modal="true" aria-label="Weekly review">
      <div className="max-w-md mx-auto min-h-full flex flex-col px-5 pb-8" style={{ paddingTop: "calc(env(safe-area-inset-top) + 18px)" }}>
        <div className="flex items-center justify-between">
          <div className="w-8" />
          {mode === "review" && (
            <div className="flex gap-1.5">{[1, 2].map((n) => <span key={n} className="w-1.5 h-1.5 rounded-full" style={{ background: step === n ? "#A7773F" : "#E4DCCF" }} />)}</div>
          )}
          <button type="button" onClick={() => { if (mode === "review") markSeen(); close(); }} aria-label="Close" className="w-8 h-8 flex items-center justify-center text-[#8A8078]"><X className="w-5 h-5" strokeWidth={1.5} /></button>
        </div>

        {!d ? (
          <div className="flex-1 flex items-center justify-center"><div className="w-6 h-6 rounded-full border-2 border-[#A7773F]/30 border-t-[#A7773F] animate-spin" /></div>
        ) : step === 1 ? (
          <div className="flex-1 flex flex-col">
            <p className="text-center text-[10.5px] tracking-[0.2em] uppercase text-[#A7773F] mt-6">{week.label}</p>
            <h1 className="font-heading text-[26px] leading-tight text-center text-[#2E2A27] mt-1">Look what you did this week</h1>
            <p className="text-center text-[13.5px] text-[#6B635C] mt-1.5 mb-5">
              {(d.prevItems || []).length ? `${prevDone} of your ${d.prevItems.length} pick${d.prevItems.length === 1 ? "" : "s"}, done.` : d.sub}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {stats.map(([n, l]) => (
                <div key={l} className="bg-white border border-[#E8E0D2] rounded-xl px-3 py-2.5">
                  <p className="font-heading text-[24px] leading-none text-[#2E2A27]">{n}</p>
                  <p className="text-[11.5px] text-[#8A8078] mt-1">{l}</p>
                </div>
              ))}
            </div>
            {(wins.length > 0 || carryList.length > 0) && (
              <div className="bg-white border border-[#E8E0D2] rounded-2xl px-4 mt-3">
                {wins.length > 0 && <p className="text-[10.5px] tracking-[0.16em] uppercase text-[#8A8078] pt-3 pb-1">Wins</p>}
                {wins.map((w, i) => (
                  <p key={`w${i}`} className={`flex items-start gap-2.5 py-2.5 text-[14px] text-[#2E2A27] ${i ? "border-t border-[#EFE8DC]" : ""}`}>
                    <Check className="w-4 h-4 text-[#7D8A53] mt-0.5 flex-shrink-0" strokeWidth={2} />{w.text}
                  </p>
                ))}
                {carryList.map((c, i) => (
                  <p key={`c${i}`} className={`flex items-start gap-2.5 py-2.5 text-[14px] text-[#8A8078] ${wins.length || i ? "border-t border-[#EFE8DC]" : ""}`}>
                    <CornerDownRight className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={1.6} />{c.text}<span className="ml-auto text-[11px] whitespace-nowrap pl-2">carry over?</span>
                  </p>
                ))}
              </div>
            )}
            <div className="mt-auto pt-6">
              <button type="button" onClick={() => setStep(2)} className="w-full h-12 rounded-xl bg-[#2E2A27] text-[#F7F3EC] text-[15px] flex items-center justify-center gap-2">
                Plan next week <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            <h1 className="font-heading text-[24px] leading-tight text-center text-[#2E2A27] mt-6">{mode === "change" ? "What matters this week?" : "What matters next week?"}</h1>
            <p className="text-center text-[13.5px] text-[#6B635C] mt-1.5 mb-4">Pick up to 3. Tasks you pick are starred in Today.</p>
            <div className="bg-white border border-[#E8E0D2] rounded-2xl px-4">
              {options.map((o, i) => {
                const on = picks.includes(o.text);
                return (
                  <button key={o.text} type="button" onClick={() => toggle(o.text)} className={`w-full flex items-center gap-3 py-3 text-left ${i ? "border-t border-[#EFE8DC]" : ""}`}>
                    <span className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0" style={on ? { background: "#A7773F" } : { border: "1.5px solid #D9CFBF" }}>
                      {on && <Check className="w-3.5 h-3.5 text-white" strokeWidth={2.6} />}
                    </span>
                    <span className="flex-1 min-w-0 text-[14px] text-[#2E2A27]">{o.text}</span>
                    {o.tag && <span className="text-[11px] text-[#8A8078] whitespace-nowrap">{o.tag}</span>}
                  </button>
                );
              })}
              <div className={`flex items-center gap-2 py-2.5 ${options.length ? "border-t border-[#EFE8DC]" : ""}`}>
                <Plus className="w-4 h-4 text-[#A7773F] flex-shrink-0" />
                <input value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCustom()} placeholder="Something else"
                  className="flex-1 min-w-0 bg-transparent text-[14px] outline-none placeholder:text-[#A7773F]" />
                {custom.trim() && <button type="button" onClick={addCustom} className="text-[13px] font-medium text-[#A7773F]">Add</button>}
              </div>
            </div>
            {msg && <p className="text-center text-[12.5px] text-[#8F5F65] mt-2">{msg}</p>}
            <div className="mt-auto pt-6 grid grid-cols-2 gap-2">
              {mode === "review"
                ? <button type="button" onClick={skip} className="h-12 rounded-xl border border-[#E4DCCF] text-[#6B635C] text-[14px]">Skip this week</button>
                : <button type="button" onClick={close} className="h-12 rounded-xl border border-[#E4DCCF] text-[#6B635C] text-[14px]">Cancel</button>}
              <button type="button" onClick={finish} disabled={saving} className="h-12 rounded-xl bg-[#2E2A27] text-[#F7F3EC] text-[14px] disabled:opacity-60">{saving ? "Saving…" : "Set my week"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
