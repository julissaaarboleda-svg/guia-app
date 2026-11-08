import { useState } from "react";
import { ChevronDown, Check, Plus, X, Pencil, Trash2 } from "lucide-react";

// Business colors come from the brand palette: Clay, Olive, Charcoal, Mauve, Warm Beige (dark).
export const BUSINESS_COLORS = ["#A7773F", "#5A6F45", "#1F1F1F", "#A77C81", "#8B6B3E", "#6B655D"];
export const colorFor = (b, businesses) => BUSINESS_COLORS[Math.max(0, businesses.findIndex((x) => x.id === b.id)) % BUSINESS_COLORS.length];
export const initialOf = (name) => (String(name || "?").trim()[0] || "?").toUpperCase();

function Dot({ color, children, size = 20 }) {
  return (
    <span className="rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
      style={{ width: size, height: size, background: color, fontSize: size * 0.5 }}>{children}</span>
  );
}

// Pill under the page title that shows the active business and opens the picker sheet.
export default function BusinessSwitcher({ businesses, activeId, onSelect, onCreate, onRename, onDelete, hasData }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState(null); // business id
  const [renameVal, setRenameVal] = useState("");
  const [busy, setBusy] = useState(false);

  const active = businesses.find((b) => b.id === activeId);
  const label = activeId === "all" ? "All businesses" : active?.name || "Business";

  const close = () => { setOpen(false); setAdding(false); setName(""); setRenaming(null); };

  const create = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try { await onCreate(name.trim()); close(); } finally { setBusy(false); }
  };
  const saveRename = async () => {
    if (renameVal.trim()) await onRename(renaming, renameVal.trim());
    setRenaming(null);
  };

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Switch business"
        className="inline-flex items-center gap-2 bg-card border border-border rounded-full pl-2 pr-3 py-1.5 text-[13.5px] font-medium text-foreground">
        {activeId === "all"
          ? <Dot color="#1F1F1F">∑</Dot>
          : <Dot color={active ? colorFor(active, businesses) : "#A7773F"}>{initialOf(active?.name)}</Dot>}
        <span className="truncate max-w-[200px]">{label}</span>
        <ChevronDown className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={close} />
          <div className="relative w-full sm:max-w-md max-h-[88vh] overflow-y-auto bg-background rounded-t-3xl sm:rounded-3xl border border-border p-5">
            <div className="flex items-start justify-between mb-3">
              <h2 className="font-heading text-[20px] text-foreground leading-tight">Your businesses</h2>
              <button onClick={close} className="text-muted-foreground hover:text-foreground" aria-label="Close"><X className="w-5 h-5" strokeWidth={1.5} /></button>
            </div>

            <div className="space-y-2">
              {businesses.map((b) => {
                const on = b.id === activeId;
                return (
                  <div key={b.id} className={`flex items-center gap-3 bg-card border rounded-2xl p-3 ${on ? "border-[#A7773F]" : "border-border"}`}>
                    <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={() => { onSelect(b.id); close(); }}>
                      <Dot color={colorFor(b, businesses)} size={34}>{initialOf(b.name)}</Dot>
                      {renaming === b.id ? null : <span className="font-heading text-[16px] text-foreground truncate">{b.name}</span>}
                    </button>
                    {renaming === b.id && (
                      <input autoFocus value={renameVal} onChange={(e) => setRenameVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveRename()}
                        className="flex-1 min-w-0 bg-secondary border border-input rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-ring" />
                    )}
                    {renaming === b.id ? (
                      <button onClick={saveRename} className="text-xs font-medium text-[#A7773F]">Save</button>
                    ) : (
                      <>
                        {on && <Check className="w-4 h-4 text-[#A7773F]" strokeWidth={1.8} />}
                        <button onClick={() => { setRenaming(b.id); setRenameVal(b.name); }} aria-label="Rename" className="text-muted-foreground hover:text-foreground"><Pencil className="w-4 h-4" strokeWidth={1.5} /></button>
                        {businesses.length > 1 && (
                          <button onClick={() => onDelete(b)} aria-label="Delete" className="text-muted-foreground hover:text-rose-400"><Trash2 className="w-4 h-4" strokeWidth={1.5} /></button>
                        )}
                      </>
                    )}
                  </div>
                );
              })}

              {businesses.length > 1 && (
                <button onClick={() => { onSelect("all"); close(); }}
                  className={`w-full flex items-center gap-3 bg-card border rounded-2xl p-3 text-left ${activeId === "all" ? "border-[#A7773F]" : "border-border"}`}>
                  <Dot color="#1F1F1F" size={34}>∑</Dot>
                  <span>
                    <span className="block font-heading text-[16px] text-foreground">All businesses</span>
                    <span className="block text-[11.5px] text-muted-foreground">Combined totals, view only</span>
                  </span>
                  {activeId === "all" && <Check className="w-4 h-4 text-[#A7773F] ml-auto" strokeWidth={1.8} />}
                </button>
              )}
            </div>

            {adding ? (
              <div className="flex items-center gap-2 mt-3">
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} placeholder="Business name"
                  className="flex-1 bg-secondary border border-input rounded-lg px-3 py-2 text-sm outline-none focus:border-ring" />
                <button onClick={create} disabled={!name.trim() || busy} className="bg-[#A7773F] text-[#F7F3EC] rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50">Add</button>
              </div>
            ) : (
              <button onClick={() => setAdding(true)}
                className="w-full mt-3 flex items-center justify-center gap-1.5 border border-dashed border-[#A7773F] text-[#A7773F] rounded-2xl py-3 text-[13.5px] font-medium">
                <Plus className="w-4 h-4" strokeWidth={1.5} /> Add a business
              </button>
            )}
            {hasData === false && businesses.length === 1 && (
              <p className="text-[11.5px] text-muted-foreground mt-3">Tip: rename “{businesses[0].name}” to your business's name with the pencil.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
