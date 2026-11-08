import { useState } from "react";
import { Edit2, Trash2, Plus, Check, X } from "lucide-react";

const LIM = 4;
const VIEW_KEY = "guia_business_goals_view";

export const isCount = (g) => g.unit !== "milestone" && Number(g.target_value) > 0;
export const goalIsDone = (g) => g.status === "done" || (isCount(g) && Number(g.current_value || 0) >= Number(g.target_value));
export const goalPct = (g) => (goalIsDone(g) ? 100 : isCount(g) ? Math.min(100, Math.round((Number(g.current_value || 0) / Number(g.target_value)) * 100)) : 0);
export const daysLeft = (g) => (g.target_date ? Math.ceil((new Date(`${g.target_date}T23:59:59`) - new Date()) / 86400000) : null);
const isMoney = (g) => g.unit === "$";
const fmtVal = (g, v) => (isMoney(g) ? `$${Number(v || 0).toLocaleString()}` : Number(v || 0).toLocaleString());
export const metaOf = (g) => {
  if (goalIsDone(g)) return "Done";
  if (!isCount(g)) return "Milestone";
  return isMoney(g) ? `${fmtVal(g, g.current_value)} of ${fmtVal(g, g.target_value)}` : `${fmtVal(g, g.current_value)} of ${fmtVal(g, g.target_value)} ${g.unit || ""}`.trim();
};

export function Bar({ pct, done = false }) {
  return (
    <div className="w-full h-1.5 bg-[#E7D9C6] rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(pct > 0 ? 2 : 0, pct)}%`, background: done ? "#5A6F45" : "#A7773F" }} />
    </div>
  );
}

export default function GoalsOverview({
  goals, readOnly = false, totalRevenue, revenueGoal, editingRevenue, revenueInput, setRevenueInput,
  onEditRevenue, onSaveRevenue, onCancelRevenue, onNew, onEdit, onDelete, onPatch, editingGoalId, renderEditor,
}) {
  const [filter, setFilter] = useState("active");
  const [showAll, setShowAll] = useState(false);
  const [view, setView] = useState(() => {
    try { return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid"; } catch { return "grid"; }
  });
  const pickView = (v) => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* optional */ } };

  const hasRevenue = !!Number(revenueGoal);
  const revPct = hasRevenue ? Math.min(100, Math.round((totalRevenue / Number(revenueGoal)) * 100)) : 0;
  const active = goals.filter((g) => !goalIsDone(g));
  const done = goals.filter(goalIsDone);
  const revDone = hasRevenue && revPct >= 100;
  const total = goals.length + (hasRevenue ? 1 : 0);
  const doneCount = done.length + (revDone ? 1 : 0);
    const inProgress = total - doneCount;

  const list = (filter === "done" ? done : [...active].sort((a, b) => (daysLeft(a) ?? 1e9) - (daysLeft(b) ?? 1e9)));
  const shown = showAll ? list : list.slice(0, LIM);
  const rest = list.length - LIM;

  const chip = (on, label, click) => (
    <button key={label} onClick={click}
      className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-medium whitespace-nowrap transition-colors ${on ? "bg-[#E7D9C6] text-foreground" : "border border-border text-muted-foreground hover:text-foreground"}`}>
      {label}
    </button>
  );

  const when = (g) => {
    const d = daysLeft(g);
    if (d == null || goalIsDone(g)) return null;
    return d < 0 ? <span className="text-[#8B5A44]">Overdue</span> : `${d} day${d === 1 ? "" : "s"} left`;
  };

  const actions = (g) => (
    <div className="flex items-center gap-2.5 flex-shrink-0 lg:opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
      <button onClick={() => onEdit(g)} aria-label="Edit goal" className="text-muted-foreground hover:text-foreground"><Edit2 className="w-4 h-4" strokeWidth={1.5} /></button>
      <button onClick={() => onDelete(g.id)} aria-label="Delete goal" className="text-muted-foreground hover:text-rose-400"><Trash2 className="w-4 h-4" strokeWidth={1.5} /></button>
    </div>
  );

  const quick = (g) => {
    const pill = "border border-[#A7773F] text-[#A7773F] rounded-full text-[11px] font-medium px-2.5 py-0.5 hover:bg-[#A7773F]/10 transition-colors flex-shrink-0";
    if (goalIsDone(g) && g.status === "done" && !isCount(g)) return <button onClick={() => onPatch(g.id, { status: "active" })} className={pill}>Reopen</button>;
    if (goalIsDone(g)) return null;
    if (!isCount(g)) return <button onClick={() => onPatch(g.id, { status: "done" })} className={pill}>Mark done</button>;
    if (!isMoney(g)) return <button onClick={() => onPatch(g.id, { current_value: Number(g.current_value || 0) + 1 })} className={pill} aria-label={`Add one to ${g.title}`}>+ 1</button>;
    return null;
  };

  const card = (g) => (
    <div key={g.id} className="group bg-card border border-border rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-heading text-[16px] text-foreground leading-tight min-w-0">{g.title}</p>
        {actions(g)}
      </div>
      {g.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{g.description}</p>}
      <div className="flex items-center justify-between gap-2 mt-1.5">
        <p className="text-xs text-muted-foreground min-w-0">{metaOf(g)}{when(g) ? <> · {when(g)}</> : null}</p>
        {quick(g)}
      </div>
      {isCount(g) && <div className="mt-2.5"><Bar pct={goalPct(g)} done={goalIsDone(g)} /></div>}
    </div>
  );

  const row = (g, i) => (
    <div key={g.id} className={`group flex items-center gap-3 px-4 py-2.5 ${i ? "border-t border-border/60" : ""}`}>
      <span className="font-heading text-[15px] text-foreground flex-1 min-w-0 truncate">{g.title}</span>
      <div className="w-20 md:w-24 flex-shrink-0">{isCount(g) && <Bar pct={goalPct(g)} done={goalIsDone(g)} />}</div>
      <span className="text-xs text-muted-foreground w-24 text-right flex-shrink-0 hidden sm:block truncate">{metaOf(g)}</span>
      <span className="text-xs text-muted-foreground w-[74px] text-right flex-shrink-0 hidden md:block">{when(g)}</span>
      {quick(g)}
      {actions(g)}
    </div>
  );

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading text-[18px] text-foreground">Business goals</h2>
        {!readOnly && (
          <button onClick={onNew} className="inline-flex items-center gap-1 text-[13px] font-medium text-[#A7773F]">
            <Plus className="w-4 h-4" strokeWidth={1.5} /> New goal
          </button>
        )}
      </div>

      {/* Overall progress + revenue */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-4">
        <p className="text-xs text-muted-foreground mb-3">
          {total === 0 ? "Add a goal to start tracking." : `${doneCount} of ${total} goal${total === 1 ? "" : "s"} done · ${inProgress} in progress`}
        </p>

        <div className="border-t border-border/60 pt-3.5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-heading text-[15px] text-foreground">Revenue goal</h3>
            {editingRevenue ? (
              <div className="flex items-center gap-2">
                <input type="number" value={revenueInput} onChange={(e) => setRevenueInput(e.target.value)} placeholder="Target ($)" autoFocus
                  className="w-28 bg-secondary border border-input rounded-lg px-2 py-1 text-foreground text-xs outline-none focus:border-ring" />
                <button onClick={onSaveRevenue} aria-label="Save"><Check className="w-4 h-4 text-foreground" strokeWidth={1.5} /></button>
                <button onClick={onCancelRevenue} aria-label="Cancel"><X className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} /></button>
              </div>
            ) : hasRevenue ? (
              <button onClick={onEditRevenue} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"><Edit2 className="w-3 h-3" strokeWidth={1.5} /> Edit</button>
            ) : null}
          </div>
          {!hasRevenue && !editingRevenue ? (
            <div className="flex items-center gap-3">
              <p className="text-xs text-muted-foreground flex-1">Pick a number to aim for and watch it fill in.</p>
              <button onClick={onEditRevenue} className="border border-[#A7773F] text-[#A7773F] rounded-full text-xs px-4 py-1.5 hover:bg-[#A7773F]/10">Set goal</button>
            </div>
          ) : hasRevenue ? (
            <>
              <p className="font-heading text-[22px] text-foreground leading-none mb-2.5">${totalRevenue.toLocaleString()} <span className="font-body text-[13px] text-muted-foreground">of ${Number(revenueGoal).toLocaleString()}</span></p>
              <Bar pct={revPct} done={revDone} />
            </>
          ) : null}
        </div>
      </div>

      {goals.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
            <div className="flex gap-1.5">
              {chip(filter === "active", `In progress · ${active.length}`, () => { setFilter("active"); setShowAll(false); })}
              {chip(filter === "done", `Done · ${done.length}`, () => { setFilter("done"); setShowAll(false); })}
            </div>
            <div className="flex gap-1.5">
              {chip(view === "grid", "Cards", () => pickView("grid"))}
              {chip(view === "list", "List", () => pickView("list"))}
            </div>
          </div>

          {list.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl text-center py-8 px-4">
              <p className="font-heading text-base text-foreground">{filter === "done" ? "Nothing finished yet" : "Everything's done"}</p>
              <p className="text-xs text-muted-foreground mt-1">{filter === "done" ? "Goals you complete will land here." : "Add a new goal to keep going."}</p>
            </div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 [&>*:only-child]:md:col-span-full">
              {shown.map((g) => (editingGoalId === g.id
                ? <div key={g.id} className="md:col-span-full bg-card border border-border rounded-2xl p-5">{renderEditor(g)}</div>
                : card(g)))}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              {shown.map((g, i) => (editingGoalId === g.id
                ? <div key={g.id} className="p-5 border-t border-border/60 first:border-t-0">{renderEditor(g)}</div>
                : row(g, i)))}
            </div>
          )}

          {rest > 0 && (
            <div className="text-center mt-1">
              <button onClick={() => setShowAll((s) => !s)} className="text-xs font-medium text-[#A7773F] py-2">{showAll ? "Show fewer" : `Show ${rest} more`}</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
