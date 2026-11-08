import { useState } from "react";
import { Edit2, Trash2, MapPin, Plus, ChevronDown, ChevronUp, Search } from "lucide-react";

export const money = (n) => `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2, maximumFractionDigits: 2 })}`;
const monthKey = (d) => (d ? d.slice(0, 7) : "undated");
const monthLabel = (k) => (k === "undated" ? "No date" : new Date(`${k}-15T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" }));
const dayLabel = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");

// The log, grouped by month. The current month starts open; every month can be toggled.
export default function BusinessLog({ entries, categories, editingEntry, renderEditor, onEdit, onDelete, onNew, readOnly = false }) {
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [toggled, setToggled] = useState({}); // monthKey -> true/false, overrides the default
  const [openRow, setOpenRow] = useState(null);

  const nowKey = new Date().toLocaleDateString("en-CA").slice(0, 7);
  const searching = q.trim().length > 0;
  const isOpen = (k) => searching || (k in toggled ? toggled[k] : k === nowKey);

  const needle = q.trim().toLowerCase();
  const list = entries.filter((e) =>
    (cat === "All" || e.category === cat) &&
    (!needle || [e.name, e.description, e.location, e.category].some((v) => (v || "").toLowerCase().includes(needle))));
  const keys = [...new Set(list.map((e) => monthKey(e.date)))].sort((a, b) => (a === "undated" ? 1 : b === "undated" ? -1 : b.localeCompare(a)));
  const allOpen = keys.length > 0 && keys.every((k) => isOpen(k));
  const toggleAll = () => setToggled(Object.fromEntries(keys.map((k) => [k, !allOpen])));

  const chip = (label, on, click, n) => (
    <button key={label} onClick={click}
      className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-medium whitespace-nowrap transition-colors ${on ? "bg-[#E7D9C6] text-foreground" : "border border-border text-muted-foreground hover:text-foreground"}`}>
      {label}{n != null ? ` · ${n}` : ""}
    </button>
  );

  const header = (
    <div className="flex items-center justify-between mb-3">
      <h2 className="font-heading text-[18px] text-foreground">Business log</h2>
      {!readOnly && (
        <button onClick={onNew} className="inline-flex items-center gap-1 text-[13px] font-medium text-[#A7773F]">
          <Plus className="w-4 h-4" strokeWidth={1.5} /> Add entry
        </button>
      )}
    </div>
  );

  if (entries.length === 0) {
    return (
      <div className="mb-6">
        {header}
        <div className="bg-card border border-border rounded-2xl text-center py-10 px-4">
          <p className="font-heading text-base text-foreground">Start your business log</p>
          <p className="text-xs text-muted-foreground mt-1">Events, sales and notes live here. You can also import a statement from the + menu.</p>
        </div>
      </div>
    );
  }

  const present = categories.filter((c) => entries.some((e) => e.category === c));

  return (
    <div className="mb-6">
      {header}
      <div className="flex flex-wrap items-center gap-2 mb-2.5">
        <label className="relative flex-1 min-w-[160px]">
          <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" strokeWidth={1.8} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search entries" aria-label="Search entries"
            className="w-full h-9 bg-secondary border border-input rounded-full pl-9 pr-3.5 text-[13px] text-foreground outline-none focus:border-ring" />
        </label>
        <div className="flex gap-1.5 overflow-x-auto max-w-full">
          {chip("All", cat === "All", () => setCat("All"))}
          {present.map((c) => chip(c, cat === c, () => setCat(c), entries.filter((e) => e.category === c).length))}
        </div>
      </div>
      {keys.length > 0 && !searching && (
        <div className="flex justify-end mb-1.5">
          <button onClick={toggleAll} className="text-xs font-medium text-[#A7773F] py-1">{allOpen ? "Collapse all" : "Expand all"}</button>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {keys.length === 0 && (
          <div className="text-center py-8 px-4">
            <p className="font-heading text-base text-foreground">No matches</p>
            <p className="text-xs text-muted-foreground mt-1">Try a different search or filter.</p>
          </div>
        )}
        {keys.map((k, ki) => {
          const rows = list.filter((e) => monthKey(e.date) === k).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
          const rev = rows.reduce((s, e) => s + (e.revenue || 0), 0);
          const exp = rows.reduce((s, e) => s + (e.expense || 0), 0);
          const open = isOpen(k);
          return (
            <div key={k} className={ki ? "border-t border-border" : ""}>
              <button onClick={() => setToggled((t) => ({ ...t, [k]: !open }))} aria-expanded={open}
                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left bg-secondary/40 hover:bg-secondary/70 transition-colors">
                <span className="min-w-0">
                  <span className="block font-heading text-[16px] text-foreground leading-tight">{monthLabel(k)}</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">{rows.length} {rows.length === 1 ? "entry" : "entries"}</span>
                </span>
                <span className="flex items-center gap-2.5 text-[13px] font-medium flex-shrink-0">
                  {rev > 0 && <span style={{ color: "#5A6F45" }}>+{money(rev)}</span>}
                  {exp > 0 && <span className="text-[#8F6368]">-{money(exp)}</span>}
                  {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} /> : <ChevronDown className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />}
                </span>
              </button>

              {open && rows.map((e) => {
                if (editingEntry === e.id) return <div key={e.id} className="px-4 py-4 border-t border-border/60">{renderEditor(e)}</div>;
                const expanded = openRow === e.id;
                const hasMore = e.location || e.description || e.notes;
                return (
                  <div key={e.id} className="border-t border-border/60">
                    <div className="flex items-center gap-3 pl-6 pr-4 py-2.5">
                      <button onClick={() => setOpenRow(expanded ? null : e.id)} aria-expanded={expanded} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                        <span className="text-xs text-muted-foreground w-11 flex-shrink-0">{dayLabel(e.date)}</span>
                        <span className="font-heading text-[15px] text-foreground flex-1 min-w-0 truncate">{e.name}</span>
                        <span className="hidden sm:inline text-[11px] text-muted-foreground border border-border rounded-full px-2 py-px whitespace-nowrap">{e.category}</span>
                        <span className="text-[13px] font-medium text-right w-[78px] flex-shrink-0">
                          {e.revenue ? <span className="block" style={{ color: "#5A6F45" }}>+{money(e.revenue)}</span> : null}
                          {e.expense ? <span className="block text-[#8F6368]">-{money(e.expense)}</span> : null}
                        </span>
                      </button>
                    </div>
                    {expanded && (
                      <div className="pl-[68px] pr-4 pb-3 -mt-1">
                        <p className="sm:hidden text-[11px] text-muted-foreground mb-1">{e.category}</p>
                        {e.location && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" strokeWidth={1.5} /> {e.location}</p>}
                        {e.description && <p className="text-xs text-muted-foreground mt-1">{e.description}</p>}
                        {e.notes && <p className="text-xs text-muted-foreground mt-1" dangerouslySetInnerHTML={{ __html: e.notes }} />}
                        {!hasMore && <p className="text-xs text-muted-foreground">No extra details.</p>}
                        <div className="flex items-center gap-4 mt-2.5">
                          <button onClick={() => onEdit(e)} className="inline-flex items-center gap-1 text-xs font-medium text-[#A7773F]"><Edit2 className="w-3.5 h-3.5" strokeWidth={1.5} /> Edit</button>
                          <button onClick={() => onDelete(e.id)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} /> Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
