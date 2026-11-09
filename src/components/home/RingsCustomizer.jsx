import { useState } from "react";
import { X, Check } from "lucide-react";
import { RING_CATALOG, DEFAULT_RINGS, MAX_RINGS } from "@/lib/homeData";

// Bottom sheet for choosing what Life Progress shows (up to four rings).
export default function RingsCustomizer({ open, onClose, selection, goals = [], projects = [], onSave }) {
  const [sel, setSel] = useState(() => (selection && selection.length ? selection : DEFAULT_RINGS));
  if (!open) return null;

  const find = (id) => sel.find((r) => r.id === id);
  const toggle = (id) => {
    if (find(id)) setSel(sel.filter((r) => r.id !== id));
    else if (sel.length < MAX_RINGS) setSel([...sel, { id }]);
  };
  const setRef = (id, ref) => setSel(sel.map((r) => (r.id === id ? { ...r, ref: ref || undefined } : r)));
  const full = sel.length >= MAX_RINGS;

  const row = (o) => {
    const chosen = find(o.id);
    const disabled = !chosen && full;
    const list = o.pick === "goal" ? goals : o.pick === "project" ? projects : null;
    return (
      <div key={o.id} className={`bg-card border border-border rounded-xl px-3 py-2.5 mb-2 ${disabled ? "opacity-50" : ""}`}>
        <button type="button" disabled={disabled} onClick={() => toggle(o.id)} className="w-full flex items-center gap-3 text-left">
          <span className={`w-[18px] h-[18px] rounded-[5px] flex items-center justify-center flex-shrink-0 ${chosen ? "bg-[#A7773F] text-[#F7F3EC]" : "border border-border"}`}>
            {chosen && <Check className="w-3 h-3" strokeWidth={2.5} />}
          </span>
          <span className="min-w-0">
            <span className="block text-[14px] text-foreground">{o.label}</span>
            <span className="block text-[11.5px] text-muted-foreground">{o.desc}</span>
          </span>
        </button>
        {chosen && list && (
          <select value={chosen.ref || ""} onChange={(e) => setRef(o.id, e.target.value)}
            className="mt-2 ml-[30px] w-[calc(100%-30px)] bg-background border border-border rounded-lg px-2 py-1.5 text-[13px] text-foreground outline-none">
            <option value="">{o.pick === "goal" ? "Closest to its target date" : "Most recent active project"}</option>
            {list.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
          </select>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-background w-full md:max-w-md rounded-t-3xl md:rounded-3xl max-h-[88vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <h3 className="font-heading text-[20px] text-foreground">Life Progress</h3>
          <button onClick={onClose} aria-label="Close" className="p-1 text-muted-foreground"><X className="w-5 h-5" strokeWidth={1.5} /></button>
        </div>
        <p className="text-[12.5px] text-muted-foreground mb-3">Choose up to {MAX_RINGS} rings. {sel.length} of {MAX_RINGS} selected.</p>
        <p className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-muted-foreground mb-2">Areas</p>
        {RING_CATALOG.filter((o) => o.group === "area").map(row)}
        <p className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-muted-foreground mt-4 mb-2">More options</p>
        {RING_CATALOG.filter((o) => o.group === "more").map(row)}
        <div className="flex items-center gap-4 mt-3">
          <button onClick={() => { onSave(sel.length ? sel : DEFAULT_RINGS); onClose(); }}
            className="bg-[#A7773F] text-[#F7F3EC] px-6 py-2.5 rounded-full text-sm font-medium">Done</button>
          <button onClick={() => setSel(DEFAULT_RINGS)} className="text-sm text-muted-foreground">Reset to default</button>
        </div>
      </div>
    </div>
  );
}
