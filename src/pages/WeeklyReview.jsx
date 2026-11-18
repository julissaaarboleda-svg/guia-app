import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Flame, Check, CalendarDays, Receipt, Plane, AlertCircle, CheckSquare, Plus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { ent } from "@/lib/freshEntities";
import { reviewWeek, buildReview } from "@/lib/weekly";
import { monthView } from "@/lib/spending";
import { monthKeyOf } from "@/lib/financeHelpers";
import { quarterId, shiftQ, qLabel, usesQuarters, goalDone, MAX_FOCUS } from "@/lib/quarters";

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const ICONS = { alert: AlertCircle, bill: Receipt, task: CalendarDays, trip: Plane };
const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString("en-US")}`;
const safe = async (p) => { try { return (await p) || []; } catch { return []; } };

const Card = ({ title, tone, children }) => (
  <section className="rounded-2xl bg-card border border-border/60 p-4">
    {title && <p className="text-[12px] mb-2" style={{ color: tone }}>{title}</p>}
    {children}
  </section>
);

export default function WeeklyReview() {
  const navigate = useNavigate();
  const week = useMemo(() => reviewWeek(), []);
  const [data, setData] = useState(null);
  const [prefs, setPrefs] = useState(null);
  const [user, setUser] = useState(null);
  const [picks, setPicks] = useState([]);
  const [custom, setCustom] = useState("");
  const [extra, setExtra] = useState([]);
  const [line, setLine] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [allGoals, setAllGoals] = useState([]);
  const [qPicks, setQPicks] = useState([]);
  const [qMsg, setQMsg] = useState("");

  useEffect(() => {
    (async () => {
      const u = await base44.auth.me();
      setUser(u);
      const [p, routines, tasks, goals, finItems, trips, stmts, buckets] = await Promise.all([
        safe(ent.UserPreferences.filter({ user_email: u.email })),
        safe(ent.Routine.list()), safe(ent.Task.list()), safe(ent.Goal.list()),
        safe(ent.FinanceItem.list()), safe(ent.Trip.list()),
        safe(ent.SpendingStatement.list()), safe(ent.BudgetBucket.list()),
      ]);
      setPrefs(p[0] || null);
      setAllGoals(goals);
      const mk = monthKeyOf();
      const spending = { spent: monthView(stmts, mk)?.total || 0, planned: buckets.filter((b) => b.month === mk).reduce((t, b) => t + (Number(b.allocated_amount) || 0), 0) };
      setData(buildReview({ routines, tasks, goals, finItems, trips, spending }, week));
      // Coming back to a review already done keeps the earlier picks.
      const f = p[0]?.week_focus;
      if (f?.week === week.nextKey && Array.isArray(f.items)) {
        setPicks(f.items.map((i) => i.text));
        setExtra(f.items.filter((i) => i.kind === "custom"));
      }
    })().catch(() => setData(buildReview({}, week)));
  }, [week]);

  const options = useMemo(() => {
    const base = data?.suggestions || [];
    return [...base, ...extra.filter((e) => !base.some((b) => b.text === e.text))];
  }, [data, extra]);

  // A new quarter starts with the coming week: ask once for its focus goals (only if quarters are in use).
  const newQ = quarterId(new Date(`${week.nextKey}T12:00:00`));
  const prevQ = shiftQ(newQ, -1);
  const askQuarter = usesQuarters(allGoals) && !allGoals.some((g) => g.focus_quarter === newQ);
  const qCandidates = askQuarter ? allGoals.filter((g) => !goalDone(g))
    .map((g) => ({ g, tag: g.focus_quarter === prevQ ? "carry over" : g.quarter === newQ ? `planned ${qLabel(newQ)}` : "" }))
    .sort((a, b) => (b.tag ? 1 : 0) - (a.tag ? 1 : 0)) : [];
  const toggleQ = (id) => {
    setQMsg("");
    if (qPicks.includes(id)) { setQPicks(qPicks.filter((x) => x !== id)); return; }
    if (qPicks.length >= MAX_FOCUS) { setQMsg("3 is the limit. Unpick one first."); return; }
    setQPicks([...qPicks, id]);
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
    if (!options.some((o) => o.text.toLowerCase() === t.toLowerCase())) setExtra((x) => [...x, { text: t, kind: "custom" }]);
    setCustom("");
    if (!picks.includes(t) && picks.length < 3) setPicks((p) => [...p, t]);
    else if (picks.length >= 3) setMsg("Added. Unpick one to choose it.");
  };

  const finish = async () => {
    if (!picks.length) { setMsg("Pick at least one first"); return; }
    setSaving(true);
    const items = picks.map((text, i) => {
      const o = options.find((x) => x.text === text) || { text, kind: "custom" };
      return { id: `${week.nextKey}-${i}`, text, kind: o.kind, refId: o.refId || null };
    });
    const patch = { week_focus: { week: week.nextKey, items, done: {} }, review_done_week: week.key };
    try {
      if (prefs?.id) await ent.UserPreferences.update(prefs.id, patch);
      else if (user?.email) await ent.UserPreferences.create({ user_email: user.email, ...patch });
      if (askQuarter && qPicks.length) {
        await Promise.all(qPicks.map((id) => ent.Goal.update(id, { focus_quarter: newQ, quarter: newQ }).catch(() => {})));
      }
      if (line.trim()) {
        const esc = line.trim().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        await ent.Note.create({ title: `Week of ${week.label}`, content: `<p>${esc}</p>`, note_type: "text", folder_id: null });
      }
      navigate("/");
    } catch {
      setMsg("Couldn't save. Try again.");
      setSaving(false);
    }
  };

  if (!data) {
    return (
      <div className="px-6 pt-5 max-w-xl mx-auto w-full space-y-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-2xl bg-muted/50 animate-pulse" />)}
      </div>
    );
  }

  const { headline, sub, rate, tasksDone, routineRows, best, wins, money: m, comingUp } = data;

  return (
    <div className="px-5 md:px-8 pt-4 pb-8 max-w-xl mx-auto w-full space-y-3">
      <div className="flex items-center">
        <Link to="/" aria-label="Back to Home" className="text-foreground p-1 -ml-1"><ArrowLeft className="w-5 h-5" /></Link>
        <span className="ml-auto text-[12px] text-muted-foreground">{week.label}</span>
      </div>
      <div>
        <h1 className="font-heading text-[26px] text-foreground leading-tight">{headline}</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">{sub}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-card border border-border/60 py-3 text-center">
          <p className="text-[22px] text-foreground">{rate == null ? "—" : `${rate}%`}</p>
          <p className="text-[12px] text-muted-foreground">Routines done</p>
        </div>
        <div className="rounded-2xl bg-card border border-border/60 py-3 text-center">
          <p className="text-[22px] text-foreground">{tasksDone}</p>
          <p className="text-[12px] text-muted-foreground">To-dos finished</p>
        </div>
      </div>

      {routineRows.length > 0 && (
        <Card title="Routines" tone="#A7773F">
          <div className="grid gap-y-2 items-center" style={{ gridTemplateColumns: "minmax(0,1fr) repeat(7, 22px)" }}>
            <span />
            {week.days.map((d, i) => <span key={i} className="text-[11px] text-muted-foreground text-center">{DAY_LETTERS[d.getDay()]}</span>)}
            {routineRows.map((r) => (
              <div key={r.id} className="contents">
                <span className="text-[13px] text-foreground truncate pr-2">{r.name}</span>
                {r.days.map((s, i) => (
                  <span key={i} className="w-2.5 h-2.5 rounded-full mx-auto" style={
                    s === "done" ? { background: r.color }
                      : s === "missed" ? { border: `1.5px solid ${r.color}88` }
                        : { background: "#F2EEE6" }
                  } />
                ))}
              </div>
            ))}
          </div>
          {best && (
            <p className="text-[12px] text-muted-foreground mt-3 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-[#A7773F]" strokeWidth={2} />{best.name} is on a {best.n}-day streak.
            </p>
          )}
        </Card>
      )}

      {wins.length > 0 && (
        <Card title="Wins" tone="#7D8A53">
          {wins.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-[13px] text-foreground py-1">
              <Check className="w-4 h-4 text-[#7D8A53] shrink-0 mt-0.5" />{w}
            </div>
          ))}
        </Card>
      )}

      {m && (
        <Card title="Money" tone="#A77C81">
          {(m.spent > 0 || m.planned > 0) && (
            <>
              <div className="flex justify-between text-[13px] text-foreground mb-1.5">
                <span>This month so far: {money(m.spent)}</span>
                {m.planned > 0 && <span className="text-muted-foreground">of {money(m.planned)} planned</span>}
              </div>
              {m.planned > 0 && (
                <div className="h-1.5 rounded-full bg-[#EFE8DC] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round((m.spent / m.planned) * 100))}%`, background: m.spent > m.planned ? "#A33" : "#A77C81" }} />
                </div>
              )}
            </>
          )}
          {m.billsLine && <p className="text-[12px] text-muted-foreground mt-2">{m.billsLine}{m.unpaid.length ? `. Still open: ${m.unpaid.join(", ")}.` : "."}</p>}
        </Card>
      )}

      {comingUp.length > 0 && (
        <Card title="Coming up" tone="#A7773F">
          {comingUp.map((c, i) => {
            const Icon = ICONS[c.icon] || CalendarDays;
            return (
              <div key={i} className="flex items-center gap-2 text-[13px] text-foreground py-1">
                <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="truncate">{c.text}</span>
                {c.side && <span className="ml-auto text-[12px] text-muted-foreground shrink-0">{c.side}</span>}
              </div>
            );
          })}
        </Card>
      )}

      <Card title="One line about your week" tone="var(--foreground)">
        <input
          value={line}
          onChange={(e) => setLine(e.target.value)}
          placeholder="What felt good, or what got in the way"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-[16px] md:text-[14px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-[#A7773F]"
        />
        <p className="text-[12px] text-muted-foreground mt-1.5">Optional. Saved to Notes.</p>
      </Card>

      {askQuarter && qCandidates.length > 0 && (
        <Card title={`New quarter · ${qLabel(newQ)}`} tone="#A7773F">
          <p className="font-heading text-[18px] text-foreground -mt-1">Pick this quarter's focus</p>
          <p className="text-[12px] text-muted-foreground mb-2">Up to 3 goals. Optional, you can also do this later in Goals.</p>
          <div className="space-y-1.5">
            {qCandidates.map(({ g, tag }) => {
              const on = qPicks.includes(g.id);
              return (
                <button key={g.id} type="button" onClick={() => toggleQ(g.id)}
                  className={`w-full flex items-center gap-2.5 text-left text-[13px] px-3 py-2.5 rounded-xl border transition-colors ${on ? "bg-[#2E2A27] border-[#2E2A27] text-[#F7F3EC]" : "bg-background border-border text-foreground"}`}>
                  <span className={`w-4 h-4 rounded-[5px] border flex items-center justify-center shrink-0 ${on ? "bg-[#A7773F] border-[#A7773F]" : "border-border"}`}>{on && <Check className="w-3 h-3 text-white" strokeWidth={3} />}</span>
                  <span className="truncate flex-1">{g.title}</span>
                  {tag && <span className={`text-[11px] shrink-0 ${on ? "opacity-70" : "text-muted-foreground"}`}>{tag}</span>}
                </button>
              );
            })}
          </div>
          <p className="text-[12px] text-destructive mt-1.5 min-h-[16px]">{qMsg}</p>
        </Card>
      )}

      <Card>
        <div className="flex items-baseline">
          <p className="text-[12px] text-foreground">Pick 3 for this week</p>
          <span className="ml-auto text-[12px] text-muted-foreground">{picks.length} of 3</span>
        </div>
        {options.length > 0 && <p className="text-[12px] text-muted-foreground mb-2">Suggested from your goals and deadlines</p>}
        <div className="space-y-1.5 mt-1">
          {options.map((o) => {
            const on = picks.includes(o.text);
            return (
              <button key={o.text} type="button" onClick={() => toggle(o.text)}
                className={`w-full flex items-center gap-2.5 text-left text-[13px] px-3 py-2.5 rounded-xl border transition-colors ${on ? "bg-[#2E2A27] border-[#2E2A27] text-[#F7F3EC]" : "bg-background border-border text-foreground"}`}>
                <span className={`w-4 h-4 rounded-[5px] border flex items-center justify-center shrink-0 ${on ? "bg-[#A7773F] border-[#A7773F]" : "border-border"}`}>
                  {on && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </span>
                <span className="truncate">{o.text}</span>
                {o.kind === "task" && !on && <CheckSquare className="w-3.5 h-3.5 ml-auto text-muted-foreground shrink-0" />}
              </button>
            );
          })}
        </div>
        <div className="flex gap-1.5 mt-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
            placeholder="Add your own"
            className="flex-1 min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-[16px] md:text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-[#A7773F]"
          />
          <button type="button" onClick={addCustom} aria-label="Add" className="w-10 rounded-xl border border-border flex items-center justify-center text-foreground"><Plus className="w-4 h-4" /></button>
        </div>
        <p className="text-[12px] text-destructive mt-1.5 min-h-[16px]">{msg}</p>
      </Card>

      <button type="button" onClick={finish} disabled={saving} className="w-full h-12 rounded-xl bg-[#2E2A27] text-[#F7F3EC] text-sm disabled:opacity-60">
        {saving ? "Saving…" : "Start my week"}
      </button>
    </div>
  );
}
