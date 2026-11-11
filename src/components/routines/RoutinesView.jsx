import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { ent } from "@/lib/freshEntities";
import { Plus, Check, ArrowLeft, X, Trash2, Flame, Upload, Loader2 } from "lucide-react";
import {
  ROUTINE_COLORS, SLOTS, DAY_LETTERS, colorOf, dayKey, isScheduled, doneOn, completeOn,
  scheduleLabel, streaks, completionRate, weekDays, toggleStep, stepsFor, stepOn, daysLabel, setAllToday, combineRoutines,
} from "@/lib/routines";

const newId = () => Math.random().toString(36).slice(2, 10);
const fmtTime = (t) => { const [h, m] = String(t).split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
const blank = () => ({ name: "", color: "cognac", slot: "morning", days: null, steps: [{ id: newId(), text: "", note: "" }] });
const label = "text-[10.5px] font-semibold tracking-[0.14em] uppercase text-muted-foreground";
const FIELD = "w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-[#A7773F]";

function Tick({ on, color }) {
  return (
    <span className="w-[22px] h-[22px] rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
      style={on ? { background: color, border: `1.5px solid ${color}` } : { border: "1.5px solid #CDBFA8" }}>
      {on && <Check className="w-3 h-3 text-white" strokeWidth={2.6} />}
    </span>
  );
}

export default function RoutinesView({ addSignal = 0 }) {
  const [routines, setRoutines] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [form, setForm] = useState(null); // { ...routine } while adding/editing
  const today = dayKey();
  const fileRef = useRef(null);
  const [reading, setReading] = useState(false);
  const [importErr, setImportErr] = useState("");
  const [found, setFound] = useState(null); // routines read from a file, waiting for review

  const readFile = async (file) => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { setImportErr("That file is over 4 MB. Try a smaller PDF or a screenshot."); return; }
    setImportErr(""); setReading(true);
    try {
      const res = await base44.integrations.Core.ImportFinanceFile({ file, mode: "routine" });
      const list = (res.routines || []).map((r, i) => ({
        ...r, include: true,
        color: ROUTINE_COLORS[i % ROUTINE_COLORS.length].key,
        days: r.days && r.days.length && r.days.length < 7 ? r.days : null,
        steps: r.steps.map((st) => ({ id: newId(), text: st.text, note: st.note || "", days: st.days || null })),
      }));
      if (!list.length) setImportErr("No routine steps were found in that file.");
      else if (list.length === 1) setForm(list[0]);
      else setFound(list);
    } catch (err) {
      setImportErr(err.message || "Couldn't read that file. Try again.");
    }
    setReading(false);
  };
  const saveFound = async () => {
    for (const r of found.filter((x) => x.include)) {
      await ent.Routine.create({ name: r.name, color: r.color, slot: r.slot, days: r.days, steps: r.steps, log: {}, best_streak: 0 });
    }
    setFound(null); load();
  };
  const importBtn = (
    <>
      <input ref={fileRef} type="file" accept="application/pdf,image/*,image/heic,image/heif,.heic,.heif,.txt" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; readFile(f); }} />
      <button type="button" disabled={reading} onClick={() => fileRef.current?.click()}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#A7773F] disabled:opacity-60">
        {reading ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} /> : <Upload className="w-4 h-4" strokeWidth={1.5} />}
        {reading ? "Reading your file…" : "Import from a file"}
      </button>
    </>
  );

  const load = async () => {
    try { setRoutines(await ent.Routine.list("created_date")); } catch { setRoutines([]); }
    setLoaded(true);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (addSignal) setForm(blank()); }, [addSignal]);

  const save = async (r, patch) => {
    setRoutines((list) => list.map((x) => (x.id === r.id ? { ...x, ...patch } : x)));
    try { await ent.Routine.update(r.id, patch); } catch { load(); }
  };
  const tick = (r, stepId) => {
    const next = { ...r, log: toggleStep(r, stepId, today) };
    const s = streaks(next);
    save(r, { log: next.log, best_streak: Math.max(Number(r.best_streak) || 0, s.longest) });
  };

  // Tick every step at once (or clear them all if the routine is already done today).
  const setAll = (r, done) => {
    const log = setAllToday(r, done, today);
    const s = streaks({ ...r, log });
    save(r, { log, best_streak: Math.max(Number(r.best_streak) || 0, s.longest) });
  };

  const submit = async () => {
    const steps = (form.steps || []).filter((s) => s.text.trim()).map((s) => ({ id: s.id, text: s.text.trim(), note: (s.note || "").trim(), days: s.days && s.days.length && s.days.length < 7 ? s.days : null }));
    if (!form.name.trim() || !steps.length) return;
    const data = { name: form.name.trim(), color: form.color, slot: form.slot, days: form.days && form.days.length && form.days.length < 7 ? form.days : null, steps, remind_at: form.remind_at || null };
    if (form.id) {
      await ent.Routine.update(form.id, data);
      if (form._mergeFrom) { try { await ent.Routine.delete(form._mergeFrom); } catch { /* still saved */ } }
    }
    else { const c = await ent.Routine.create({ ...data, log: {}, best_streak: 0 }); setOpenId(c.id); }
    setForm(null); load();
  };
  const remove = async (id) => {
    if (!confirm("Delete this routine and its history?")) return;
    await ent.Routine.delete(id); setForm(null); setOpenId(null); load();
  };

  // ---------- form ----------
  if (form) {
    const set = (p) => setForm((f) => ({ ...f, ...p }));
    const setStep = (i, p) => set({ steps: form.steps.map((s, j) => (j === i ? { ...s, ...p } : s)) });
    const picking = Array.isArray(form.days);
    return (
      <div className="px-4 py-4 max-w-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-[24px] text-foreground">{form.id ? "Edit routine" : "New routine"}</h2>
          <button onClick={() => setForm(null)} aria-label="Close" className="p-1 text-muted-foreground"><X className="w-5 h-5" strokeWidth={1.5} /></button>
        </div>
        <input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Name, e.g. Facial routine" className={FIELD} />

        <p className={`${label} mt-4 mb-2`}>Color</p>
        <div className="flex gap-2 flex-wrap">
          {ROUTINE_COLORS.map((c) => (
            <button key={c.key} type="button" onClick={() => set({ color: c.key })}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[12.5px] ${form.color === c.key ? "border-foreground/50 text-foreground" : "border-border text-muted-foreground"}`}>
              <span className="w-3.5 h-3.5 rounded-full" style={{ background: c.hex }} />{c.label}
            </button>
          ))}
        </div>

        <p className={`${label} mt-4 mb-2`}>When</p>
        <div className="flex gap-2">
          {SLOTS.map(([k, l]) => (
            <button key={k} type="button" onClick={() => set({ slot: k })}
              className={`px-3.5 py-1.5 rounded-full text-[12.5px] border ${form.slot === k ? "bg-[#A7773F] border-[#A7773F] text-[#F7F3EC]" : "border-border text-muted-foreground"}`}>{l}</button>
          ))}
        </div>

        <p className={`${label} mt-4 mb-2`}>Days</p>
        <div className="flex gap-2 mb-2">
          <button type="button" onClick={() => set({ days: null })} className={`px-3.5 py-1.5 rounded-full text-[12.5px] border ${!picking ? "bg-[#A7773F] border-[#A7773F] text-[#F7F3EC]" : "border-border text-muted-foreground"}`}>Every day</button>
          <button type="button" onClick={() => set({ days: picking ? form.days : [1, 3, 5] })} className={`px-3.5 py-1.5 rounded-full text-[12.5px] border ${picking ? "bg-[#A7773F] border-[#A7773F] text-[#F7F3EC]" : "border-border text-muted-foreground"}`}>Pick days</button>
        </div>
        {picking && (
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const on = form.days.includes(d);
              return (
                <button key={d} type="button" onClick={() => set({ days: on ? form.days.filter((x) => x !== d) : [...form.days, d] })}
                  className={`w-9 h-9 rounded-full text-[12.5px] border ${on ? "bg-[#2E2A27] border-[#2E2A27] text-[#F7F3EC]" : "border-border text-muted-foreground"}`}>{DAY_LETTERS[d]}</button>
              );
            })}
          </div>
        )}

        <p className={`${label} mt-4 mb-2`}>Reminder</p>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={() => set({ remind_at: null })} className={`px-3.5 py-1.5 rounded-full text-[12.5px] border ${!form.remind_at ? "bg-[#A7773F] border-[#A7773F] text-[#F7F3EC]" : "border-border text-muted-foreground"}`}>Off</button>
          <button type="button" onClick={() => set({ remind_at: form.remind_at || (form.slot === "evening" ? "21:00" : form.slot === "anytime" ? "12:00" : "07:00") })}
            className={`px-3.5 py-1.5 rounded-full text-[12.5px] border ${form.remind_at ? "bg-[#A7773F] border-[#A7773F] text-[#F7F3EC]" : "border-border text-muted-foreground"}`}>Remind me</button>
          {form.remind_at && (
            <input type="time" value={form.remind_at} onChange={(e) => set({ remind_at: e.target.value || null })}
              className="bg-secondary border border-input rounded-full px-3 py-1 text-[13px] text-foreground outline-none focus:border-ring" />
          )}
        </div>
        {form.remind_at && <p className="text-[11.5px] text-muted-foreground mt-1.5">Shows up with an alert in your calendar on the days above, once Calendar sync is on (Settings).</p>}

        <p className={`${label} mt-4 mb-2`}>Steps</p>
        <div className="space-y-2">
          {form.steps.map((s, i) => (
            <div key={s.id} className="flex gap-2 items-start">
              <span className="text-xs text-muted-foreground w-4 pt-3 text-right">{i + 1}</span>
              <div className="flex-1 space-y-1.5">
                <input value={s.text} onChange={(e) => setStep(i, { text: e.target.value })} placeholder="Step, e.g. Cleanser or Shoulder press" className={FIELD} />
                <input value={s.note || ""} onChange={(e) => setStep(i, { note: e.target.value })} placeholder="Note (optional), e.g. 3 × 10 · 15 lb" className={`${FIELD} text-[13px] py-2`} />
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[11px] text-muted-foreground mr-1">{s.days && s.days.length ? "Only on" : "Every time · or only on"}</span>
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                    const on = (s.days || []).includes(d);
                    return (
                      <button key={d} type="button" onClick={() => setStep(i, { days: on ? (s.days || []).filter((x) => x !== d) : [...(s.days || []), d] })}
                        className={`w-6 h-6 rounded-full text-[10.5px] border ${on ? "bg-[#2E2A27] border-[#2E2A27] text-[#F7F3EC]" : "border-border text-muted-foreground"}`}>{DAY_LETTERS[d]}</button>
                    );
                  })}
                </div>
              </div>
              <button type="button" onClick={() => set({ steps: form.steps.filter((_, j) => j !== i) })} aria-label="Remove step" className="p-2 mt-1 text-muted-foreground"><X className="w-4 h-4" strokeWidth={1.5} /></button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => set({ steps: [...form.steps, { id: newId(), text: "", note: "" }] })}
          className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-[#A7773F]"><Plus className="w-4 h-4" strokeWidth={1.5} /> Add step</button>

        {form.id && routines.some((r) => r.id !== form.id) && !form._mergeFrom && (
          <div className="mt-5 bg-card border border-border rounded-2xl p-3.5">
            {!form._combining ? (
              <button type="button" onClick={() => set({ _combining: { otherId: "", days: [] } })} className="text-[13px] font-medium text-[#A7773F]">Combine with another routine</button>
            ) : (
              <>
                <p className="text-[13px] text-foreground mb-2">Fold another routine into this one. Shared steps appear once; its extra steps only show on the days you pick.</p>
                <select value={form._combining.otherId} onChange={(e) => set({ _combining: { ...form._combining, otherId: e.target.value } })}
                  className="w-full bg-background border border-border rounded-lg px-2 py-2 text-[13px] mb-2">
                  <option value="">Choose a routine</option>
                  {routines.filter((r) => r.id !== form.id).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <p className="text-[11.5px] text-muted-foreground mb-1.5">Its extra steps happen on</p>
                <div className="flex gap-1.5 mb-3">
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                    const on = form._combining.days.includes(d);
                    return <button key={d} type="button" onClick={() => set({ _combining: { ...form._combining, days: on ? form._combining.days.filter((x) => x !== d) : [...form._combining.days, d] } })}
                      className={`w-8 h-8 rounded-full text-[12px] border ${on ? "bg-[#2E2A27] border-[#2E2A27] text-[#F7F3EC]" : "border-border text-muted-foreground"}`}>{DAY_LETTERS[d]}</button>;
                  })}
                </div>
                <div className="flex gap-4">
                  <button type="button" disabled={!form._combining.otherId || !form._combining.days.length}
                    onClick={() => { const other = routines.find((r) => r.id === form._combining.otherId); set({ steps: combineRoutines(form, other, form._combining.days), _mergeFrom: other.id, _combining: null }); }}
                    className="text-[13px] font-medium text-[#F7F3EC] bg-[#2E2A27] px-4 py-1.5 rounded-full disabled:opacity-40">Combine</button>
                  <button type="button" onClick={() => set({ _combining: null })} className="text-[13px] text-muted-foreground">Cancel</button>
                </div>
              </>
            )}
          </div>
        )}
        {form._mergeFrom && <p className="mt-4 text-[12.5px] text-[#8A5F27] bg-[#F3E8D6] rounded-lg px-3 py-2">Combined. Check the steps above, then Save. "{routines.find((r) => r.id === form._mergeFrom)?.name}" will be removed when you save.</p>}

        <div className="flex items-center gap-4 mt-6">
          <button onClick={submit} disabled={!form.name.trim() || !form.steps.some((s) => s.text.trim())}
            className="bg-[#A7773F] text-[#F7F3EC] px-6 py-2.5 rounded-full text-sm font-medium disabled:opacity-40">Save routine</button>
          {form.id && <button onClick={() => remove(form.id)} className="inline-flex items-center gap-1 text-sm text-[#8F5F65]"><Trash2 className="w-4 h-4" strokeWidth={1.5} /> Delete</button>}
        </div>
      </div>
    );
  }

  // ---------- review routines found in a file ----------
  if (found) {
    const n = found.filter((r) => r.include).length;
    return (
      <div className="px-4 py-4 max-w-xl">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-heading text-[24px] text-foreground">Found {found.length} routines</h2>
          <button onClick={() => setFound(null)} aria-label="Close" className="p-1 text-muted-foreground"><X className="w-5 h-5" strokeWidth={1.5} /></button>
        </div>
        <p className="text-[12.5px] text-muted-foreground mb-3">Untick any you don't want. You can edit each one after saving.</p>
        {found.map((r, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl px-4 py-3 mb-2" style={{ borderLeft: `4px solid ${colorOf(r)}`, opacity: r.include ? 1 : 0.5 }}>
            <button type="button" onClick={() => setFound(found.map((x, j) => (j === i ? { ...x, include: !x.include } : x)))} className="w-full flex items-center gap-3 text-left">
              <Tick on={r.include} color={colorOf(r)} />
              <span className="min-w-0">
                <span className="block font-heading text-[16px] text-foreground truncate">{r.name}</span>
                <span className="block text-[11.5px] text-muted-foreground">{SLOTS.find(([k]) => k === r.slot)?.[1]} · {scheduleLabel(r)} · {r.steps.length} steps</span>
              </span>
            </button>
            <p className="text-[12px] text-muted-foreground mt-1.5 ml-[34px] line-clamp-2">{r.steps.map((st) => st.text).join(" · ")}</p>
          </div>
        ))}
        <button onClick={saveFound} disabled={!n} className="mt-3 bg-[#A7773F] text-[#F7F3EC] px-6 py-2.5 rounded-full text-sm font-medium disabled:opacity-40">Save {n} routine{n === 1 ? "" : "s"}</button>
      </div>
    );
  }

  // ---------- one routine ----------
  const open = routines.find((r) => r.id === openId);
  if (open) {
    const c = colorOf(open);
    const s = streaks(open);
    const month = completionRate(open, new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const todayOn = isScheduled(open);
    const ids = new Set(open.log?.[today] || []);
    return (
      <div className="px-4 py-4 max-w-xl">
        <button onClick={() => setOpenId(null)} className="inline-flex items-center gap-1 text-[13px] text-muted-foreground mb-3"><ArrowLeft className="w-4 h-4" strokeWidth={1.5} /> Routines</button>
        <div className="flex items-baseline justify-between">
          <h2 className="font-heading text-[26px] text-foreground leading-tight">{open.name}</h2>
          <button onClick={() => setForm({ ...open, steps: open.steps?.length ? open.steps : [{ id: newId(), text: "", note: "" }] })} className="text-[13px] font-medium text-[#A7773F]">Edit</button>
        </div>
        <p className="font-heading italic text-[14px] text-muted-foreground mb-4">{SLOTS.find(([k]) => k === open.slot)?.[1] || "Anytime"} · {scheduleLabel(open).toLowerCase()}{open.remind_at ? ` · reminder ${fmtTime(open.remind_at)}` : ""}</p>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-2xl p-3 text-white" style={{ background: c }}>
            <p className="font-heading text-[22px] leading-none flex items-center gap-1"><Flame className="w-4 h-4" strokeWidth={1.8} />{s.current}</p>
            <p className="text-[11px] opacity-85 mt-1">{open.days ? "in a row" : "day streak"}</p>
          </div>
          <div className="rounded-2xl p-3 bg-card border border-border"><p className="font-heading text-[22px] leading-none">{s.longest}</p><p className="text-[11px] text-muted-foreground mt-1">longest</p></div>
          <div className="rounded-2xl p-3 bg-card border border-border"><p className="font-heading text-[22px] leading-none">{month.sched ? `${month.pct}%` : "–"}</p><p className="text-[11px] text-muted-foreground mt-1">this month</p></div>
        </div>

        <div className="flex gap-2 mb-5">
          {weekDays().map((d) => {
            const k = dayKey(d); const sched = isScheduled(open, d); const fin = completeOn(open, k); const isToday = k === today;
            return (
              <div key={k} className="flex-1 text-center">
                <p className="text-[10.5px] text-muted-foreground">{DAY_LETTERS[d.getDay()]}</p>
                <span className="block mx-auto mt-1 rounded-full w-8 h-8 max-w-full"
                  style={fin ? { background: c } : { border: `1.5px ${sched ? "solid" : "dashed"} ${isToday ? "#2E2A27" : "#E4DACB"}` }} />
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between mb-1.5">
          <p className={label}>{todayOn ? "Today's steps" : "Steps · not scheduled today"}</p>
          {stepsFor(open).length > 1 && (completeOn(open, today)
            ? <button onClick={() => setAll(open, false)} className="text-[12.5px] text-muted-foreground">Clear all</button>
            : <button onClick={() => setAll(open, true)} className="inline-flex items-center gap-1 text-[12.5px] font-medium px-3 py-1 rounded-full text-white" style={{ background: c }}><Check className="w-3.5 h-3.5" strokeWidth={2.4} /> Complete all</button>)}
        </div>
        <div className="bg-card border border-border rounded-2xl px-4">
          {stepsFor(open).map((st) => {
            const on = ids.has(st.id);
            return (
              <button key={st.id} onClick={() => tick(open, st.id)} className="w-full flex items-center gap-3 py-3 border-b border-border/60 last:border-0 text-left">
                <Tick on={on} color={c} />
                <span className="min-w-0">
                  <span className={`block text-[14.5px] ${on ? "line-through text-muted-foreground" : "text-foreground"}`}>{st.text}</span>
                  {(st.note || st.days) && <span className="block text-[11.5px] text-muted-foreground">{[st.days && st.days.length ? daysLabel(st.days) : "", st.note].filter(Boolean).join(" · ")}</span>}
                </span>
              </button>
            );
          })}
        </div>
        {(open.steps || []).some((st) => !stepOn(st, new Date())) && (
          <div className="mt-3">
            <p className={`${label} mb-1`}>Not today</p>
            {(open.steps || []).filter((st) => !stepOn(st, new Date())).map((st) => (
              <p key={st.id} className="text-[13px] text-muted-foreground py-1">{st.text} <span className="text-[11px]">· {daysLabel(st.days)}</span></p>
            ))}
          </div>
        )}
        {completeOn(open, today) && <p className="text-[13px] text-[#566033] mt-3">All done for today.</p>}
      </div>
    );
  }

  // ---------- list ----------
  const dueToday = routines.filter((r) => isScheduled(r));
  const totalSteps = dueToday.reduce((t, r) => t + stepsFor(r).length, 0);
  const doneSteps = dueToday.reduce((t, r) => t + doneOn(r, today), 0);
  const left = dueToday.filter((r) => !completeOn(r, today)).length;

  return (
    <div className="px-4 py-4 max-w-2xl">
      {loaded && routines.length === 0 && (
        <div className="text-center py-10">
          <p className="font-heading text-[20px] text-foreground mb-1">Small steps, every day</p>
          <p className="text-sm text-muted-foreground mb-4">Build a facial routine, a workout, or anything you repeat.</p>
          <button onClick={() => setForm(blank())} className="bg-[#A7773F] text-[#F7F3EC] px-5 py-2.5 rounded-full text-sm font-medium">+ New routine</button>
          <div className="mt-4">{importBtn}</div>
          <p className="text-[11.5px] text-muted-foreground mt-1">A PDF or photo of a workout plan or skincare routine.</p>
          {importErr && <p className="text-[12.5px] text-[#8F5F65] mt-2">{importErr}</p>}
        </div>
      )}
      {routines.length > 0 && (
        <>
          {totalSteps > 0 && (
            <div className="rounded-2xl bg-[#2E2A27] text-[#F7F3EC] px-4 py-3.5 mb-4">
              <p className="text-[12px] opacity-75">Today</p>
              <p className="font-heading text-[24px] leading-tight">{doneSteps} of {totalSteps} steps <span className="font-body text-[12px] opacity-75">· {left ? `${left} routine${left === 1 ? "" : "s"} left` : "all done"}</span></p>
              <div className="h-1.5 rounded-full bg-white/15 mt-2.5 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.round((doneSteps / totalSteps) * 100)}%`, background: "linear-gradient(90deg,#A77C81,#A7773F,#7D8A53)" }} />
              </div>
            </div>
          )}
          {SLOTS.map(([slot, slotLabel]) => {
            const list = routines.filter((r) => (r.slot || "anytime") === slot);
            if (!list.length) return null;
            return (
              <div key={slot} className="mb-3">
                <p className={`${label} mb-2`}>{slotLabel}</p>
                {list.map((r) => {
                  const c = colorOf(r); const s = streaks(r); const sched = isScheduled(r);
                  const n = stepsFor(r).length; const d = doneOn(r, today);
                  return (
                    <div key={r.id} className="flex items-stretch bg-card border border-border rounded-2xl mb-2 hover:border-[#A7773F]/40 transition-colors overflow-hidden"
                      style={{ borderLeft: `4px solid ${c}` }}>
                      <button onClick={() => setOpenId(r.id)} className="flex-1 min-w-0 text-left pl-4 pr-2 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-heading text-[17px] text-foreground truncate">{r.name}</span>
                          {s.current > 0 && <span className="text-[11.5px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap inline-flex items-center gap-1" style={{ color: c, background: `${c}1F` }}><Flame className="w-3 h-3" strokeWidth={2} />{s.current}</span>}
                        </div>
                        <p className="text-[11.5px] text-muted-foreground mt-0.5">{scheduleLabel(r)} · {sched ? (d >= n && n ? "done today" : `${d} of ${n} steps today`) : "rest day"}</p>
                        <div className="h-[5px] rounded-full bg-[#EFE8DC] mt-2 overflow-hidden"><div className="h-full rounded-full" style={{ width: sched && n ? `${Math.round((d / n) * 100)}%` : 0, background: c }} /></div>
                      </button>
                      {n > 0 && (
                        <button onClick={() => setAll(r, !(d >= n))} aria-label={d >= n ? `Undo ${r.name}` : `Complete ${r.name}`} title={d >= n ? "Undo" : "Complete all steps"}
                          className="px-4 flex items-center justify-center">
                          <span className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
                            style={d >= n ? { background: c } : { border: `1.5px solid ${c}` }}>
                            <Check className="w-[18px] h-[18px]" strokeWidth={2.2} style={{ color: d >= n ? "#fff" : c }} />
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
          <div className="mt-2 flex items-center gap-5 flex-wrap">
            <button onClick={() => setForm(blank())} className="inline-flex items-center gap-1 text-[13px] font-medium text-[#A7773F]"><Plus className="w-4 h-4" strokeWidth={1.5} /> New routine</button>
            {importBtn}
          </div>
          {importErr && <p className="text-[12.5px] text-[#8F5F65] mt-2">{importErr}</p>}
        </>
      )}
    </div>
  );
}
