import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles, CircleDollarSign, Target, FolderOpen, Plane, Briefcase } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { base44 } from "@/api/base44Client";
import { monthKeyOf } from "@/lib/financeHelpers";
import { loadAll, computeMonth, computeYear, headline, monthLabel, shiftMonth, saveCurrentSnapshot, MONTHS } from "@/lib/recap";

const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString()}`;
const dash = "—";
const card = "bg-card border border-border rounded-2xl p-4 mb-3";

function Section({ Icon, title, children }) {
  return (
    <div className={card}>
      <div className="flex items-center gap-2 mb-3"><Icon className="w-4 h-4 text-[#A7773F]" strokeWidth={1.5} /><h3 className="font-heading text-base text-foreground">{title}</h3></div>
      {children}
    </div>
  );
}
const Line = ({ k, v, tone }) => (
  <div className="flex items-center justify-between py-1 text-[13px]">
    <span className="text-muted-foreground">{k}</span>
    <span className={`font-medium ${tone === "good" ? "text-[#566033]" : tone === "bad" ? "text-[#8F5F65]" : "text-foreground"}`}>{v}</span>
  </div>
);
const Tile = ({ k, v }) => (
  <div className="bg-background border border-border rounded-xl py-2.5 px-1 text-center">
    <p className="text-[11px] text-muted-foreground">{k}</p>
    <p className="text-sm font-medium text-foreground mt-0.5">{v}</p>
  </div>
);

export default function Recap() {
  const [all, setAll] = useState(null);
  const [view, setView] = useState("month");
  const [key, setKey] = useState(monthKeyOf());
  const [year, setYear] = useState(new Date().getFullYear());
  const [review, setReview] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    loadAll().then((a) => { if (alive) { setAll(a); saveCurrentSnapshot(a); } });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    try { setReview(localStorage.getItem(`guia:year-review:${year}`) || ""); } catch { setReview(""); }
  }, [year]);

  const m = useMemo(() => (all ? computeMonth(all, key) : null), [all, key]);
  const y = useMemo(() => (all ? computeYear(all, year) : null), [all, year]);

  const writeReview = async () => {
    if (!y) return;
    setReviewBusy(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Write a warm, plain-spoken "year in review" of 2-3 short sentences (max 55 words total) for a personal life-planning app user. Use only these facts, skip anything that is zero or missing, and don't invent anything.
Year ${year}: goals finished ${y.goals}; tasks completed ${y.tasks}; loan payments made $${Math.round(y.loanPaid)}; trips started ${y.trips} across ${y.countries} countries; notes written ${y.notes}; roles matched ${y.roles}; income recorded $${Math.round(y.income)}; credit score ${y.scoreFirst ?? "n/a"} to ${y.scoreLast ?? "n/a"}.
Return JSON: {"review": "..."}`,
        response_json_schema: { type: "object", properties: { review: { type: "string" } } },
      });
      const text = (res?.review || "").trim();
      if (text) { setReview(text); try { localStorage.setItem(`guia:year-review:${year}`, text); } catch { /* ignore */ } }
    } catch { /* leave as is */ }
    setReviewBusy(false);
  };

  const nowKey = monthKeyOf();
  const f = m?.finance;
  const maxBar = y ? Math.max(1, ...y.months.map((x) => Math.max(x.finance.income || 0, x.finance.planned || 0))) : 1;

  return (
    <div className="pb-28">
      <PageHeader title="Recap" subtitle="Your life, month by month." />
      <div className="px-4 md:px-8 pt-4 max-w-2xl">
        <div className="flex gap-2 mb-4">
          {[["month", "Month"], ["year", "Year"]].map(([id, l]) => (
            <button key={id} onClick={() => setView(id)}
              className={`px-4 py-1.5 rounded-full text-[13px] border transition-colors ${view === id ? "bg-[#A7773F] border-[#A7773F] text-[#F7F3EC]" : "border-border text-muted-foreground"}`}>{l}</button>
          ))}
        </div>

        <div className="flex items-center justify-center gap-4 mb-4">
          <button onClick={() => (view === "month" ? setKey(shiftMonth(key, -1)) : setYear(year - 1))} className="p-2 text-muted-foreground hover:text-foreground"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-[15px] text-foreground min-w-[140px] text-center">{view === "month" ? monthLabel(key) : year}</span>
          <button onClick={() => (view === "month" ? setKey(shiftMonth(key, 1)) : setYear(year + 1))}
            disabled={view === "month" ? key >= nowKey : year >= new Date().getFullYear()}
            className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
        </div>

        {!all && <p className="text-sm text-muted-foreground text-center py-10">Gathering your numbers…</p>}

        {all && view === "month" && m && (
          <>
            <div className="bg-secondary/60 border border-border rounded-2xl p-4 mb-3">
              <div className="flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4 text-[#A7773F]" strokeWidth={1.5} /><h3 className="font-heading text-base font-bold text-foreground">The short version</h3></div>
              <p className="text-[15px] text-foreground leading-snug">{headline(m)}</p>
            </div>

            <Section Icon={CircleDollarSign} title="Finance">
              <div className="grid grid-cols-3 gap-2 mb-2">
                <Tile k="Income" v={f.income != null ? money(f.income) : dash} />
                <Tile k="Bills paid" v={f.billsPaid != null ? money(f.billsPaid) : dash} />
                <Tile k="Subs" v={f.subs != null ? money(f.subs) : dash} />
              </div>
              {f.income > 0 && f.planned > 0 && (
                <>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-3 mb-1.5"><div className="h-full bg-[#A7773F] rounded-full" style={{ width: `${Math.min(100, (f.planned / f.income) * 100)}%` }} /></div>
                  <Line k={`${Math.round((f.planned / f.income) * 100)}% of income planned`} v={`${money(Math.max(0, f.income - f.planned))} left`} />
                </>
              )}
              <Line k="Loan payments made" v={f.loanPays ? `${money(f.loanPaid)} · ${f.loanPays}` : dash} tone={f.loanPaid ? "good" : undefined} />
              <Line k="Added to savings" v={f.savedDelta != null ? money(f.savedDelta) : dash} />
              <Line k="Credit score" v={f.score != null ? `${f.score}${f.scoreDelta ? ` (${f.scoreDelta > 0 ? "▲" : "▼"} ${Math.abs(f.scoreDelta)})` : ""}` : "no update"} />
              {!m.hasSnapshot && !m.isCurrent && <p className="text-[11.5px] text-muted-foreground mt-2">Bills and savings weren't tracked for this month. Guía started saving them from this month on.</p>}
            </Section>

            <Section Icon={Target} title="Goals">
              <Line k="Finished" v={m.goals.done} />
              {m.goals.active != null && <Line k="In progress" v={m.goals.active} />}
              {m.goals.next && <Line k="Closest to done" v={`${m.goals.next.t.length > 22 ? m.goals.next.t.slice(0, 21) + "…" : m.goals.next.t} · ${m.goals.next.p}%`} />}
            </Section>

            <Section Icon={FolderOpen} title="Projects">
              <Line k="Tasks completed" v={m.projects.tasksDone} />
              {m.projects.finished != null && <Line k="Projects finished" v={m.projects.finished} />}
              {m.projects.overdue != null && <Line k="Overdue now" v={m.projects.overdue} tone={m.projects.overdue ? "bad" : undefined} />}
              {m.projects.tasksApprox && <p className="text-[11.5px] text-muted-foreground mt-1">Project task counts become exact once two months have been saved.</p>}
            </Section>

            <Section Icon={Plane} title="Journeys">
              <Line k="Trips starting" v={m.trips.count} />
              {m.trips.places.length > 0 && <Line k="Where" v={m.trips.places.slice(0, 3).join(", ")} />}
            </Section>

            <Section Icon={Briefcase} title="Career & notes">
              <Line k="Roles matched" v={m.career.roles ? `${m.career.roles}${m.career.best ? ` · best ${m.career.best}/100` : ""}` : dash} />
              <Line k="Notes written" v={m.notes.count} />
            </Section>
          </>
        )}

        {all && view === "year" && y && (
          <>
            <div className="bg-secondary/60 border border-border rounded-2xl p-4 mb-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-[#A7773F]" strokeWidth={1.5} /><h3 className="font-heading text-base font-bold text-foreground">Year in review</h3></div>
                {review && <button onClick={writeReview} disabled={reviewBusy} className="text-xs text-[#A7773F]">{reviewBusy ? "Writing…" : "Rewrite"}</button>}
              </div>
              {review ? <p className="text-[15px] text-foreground leading-snug">{review}</p> : (
                <button onClick={writeReview} disabled={reviewBusy} className="border border-[#A7773F] text-[#A7773F] rounded-full text-[13px] px-4 py-1.5 disabled:opacity-60">{reviewBusy ? "Writing…" : "Write my year in review"}</button>
              )}
            </div>

            <Section Icon={CircleDollarSign} title="Finance">
              <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground">Income vs. planned spending</p>
              <div className="flex items-end gap-1.5 h-24 mt-3 mb-1">
                {y.months.map((x) => (
                  <div key={x.key} className="flex-1 flex flex-col justify-end items-center gap-0.5 h-full">
                    <div className="w-full rounded-t bg-[#A7773F]/90" style={{ height: `${((x.finance.income || 0) / maxBar) * 100}%` }} />
                    <div className="w-full rounded-t bg-[#D8C3A0]" style={{ height: `${((x.finance.planned || 0) / maxBar) * 100}%` }} />
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5 text-[10px] text-muted-foreground text-center mb-3">{MONTHS.map((l) => <span key={l} className="flex-1">{l[0]}</span>)}</div>
              <Line k="Income recorded" v={y.income ? money(y.income) : dash} />
              <Line k="Loan payments made" v={y.loanPaid ? money(y.loanPaid) : dash} tone={y.loanPaid ? "good" : undefined} />
              <Line k="Added to savings" v={y.saved ? money(y.saved) : dash} />
              <Line k="Credit score" v={y.scoreFirst != null ? (y.scoreFirst === y.scoreLast ? `${y.scoreLast}` : `${y.scoreFirst} → ${y.scoreLast}`) : "no data yet"} />
            </Section>

            <Section Icon={Target} title="Goals & projects">
              <div className="grid grid-cols-3 gap-2">
                <Tile k="Goals done" v={y.goals} /><Tile k="Tasks done" v={y.tasks} /><Tile k="Notes" v={y.notes} />
              </div>
            </Section>

            <Section Icon={Plane} title="Journeys & career">
              <Line k="Trips" v={y.trips} />
              <Line k="Countries" v={y.countries} />
              <Line k="Roles matched" v={y.roles} />
            </Section>

            {(y.bestGoals || y.busiest) && (
              <div className={card}>
                <h3 className="font-heading text-base text-foreground mb-2">Highlights</h3>
                {y.bestGoals && <Line k="Most goals finished" v={`${y.bestGoals.label} · ${y.bestGoals.n}`} />}
                {y.busiest && <Line k="Busiest month" v={`${y.busiest.label} · ${y.busiest.n} tasks`} />}
              </div>
            )}
            <p className="text-[11.5px] text-muted-foreground px-1">Finance details such as bills paid and savings fill in month by month from the day Guía started saving them.</p>
          </>
        )}
      </div>
    </div>
  );
}
