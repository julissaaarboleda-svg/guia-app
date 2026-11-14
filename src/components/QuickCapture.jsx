import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Plus, CheckSquare, FileText, Target, Receipt, Check, X } from "lucide-react";
import { ent } from "@/lib/freshEntities";
import { guessType, draftFor, TYPE_INFO } from "@/lib/capture";

// Pages that show the + button. Finance and Journeys have their own add flows, so it stays off there.
const SHOW_ON = ["/", "/goals", "/notes", "/work", "/career", "/business", "/projects", "/recap", "/review"];

const TYPES = [
  ["task", "To-do", CheckSquare],
  ["note", "Note", FileText],
  ["goal", "Goal", Target],
  ["bill", "Bill", Receipt],
];

export default function QuickCapture() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [picked, setPicked] = useState(null);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const taRef = useRef(null);
  const toastTimer = useRef(null);

  const visible = SHOW_ON.includes(location.pathname);
  const type = picked || guessType(text);
  const draft = useMemo(() => (text.trim() ? draftFor(text, type) : null), [text, type]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("guia:capture-open", onOpen);
    return () => window.removeEventListener("guia:capture-open", onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    setText(""); setPicked(null); setErr("");
    const t = setTimeout(() => taRef.current?.focus(), 60);
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, [open]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = (t) => {
    clearTimeout(toastTimer.current);
    setToast(t);
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  };

  const save = async () => {
    if (!text.trim() || !draft) { setErr("Type something first"); return; }
    if (draft.entity === "Task" && !draft.data.title) { setErr("Add a few words for the to-do"); return; }
    if (draft.entity === "FinanceItem" && !draft.data.name) { setErr("Add what the bill is for"); return; }
    setSaving(true); setErr("");
    try {
      const data = { ...draft.data };
      if (data.target_date === undefined) delete data.target_date;
      const record = await ent[draft.entity].create(data);
      window.dispatchEvent(new CustomEvent("guia:captured", { detail: { type, record } }));
      setOpen(false);
      showToast({ type, record, entity: draft.entity });
    } catch {
      setErr("Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const undo = async () => {
    const t = toast;
    setToast(null);
    if (!t?.record?.id) return;
    window.dispatchEvent(new CustomEvent("guia:capture-undone", { detail: { type: t.type, id: t.record.id } }));
    try { await ent[t.entity].delete(t.record.id); } catch { /* already gone */ }
  };

  return (
    <>
      {visible && !open && (
        <button
          type="button"
          aria-label="Quick capture"
          onClick={() => setOpen(true)}
          className="fixed right-4 z-[45] w-[52px] h-[52px] rounded-full bg-[#A7773F] text-[#F7F3EC] flex items-center justify-center shadow-lg active:scale-95 transition-transform bottom-[calc(env(safe-area-inset-bottom,44px)+72px)] lg:bottom-6 lg:right-6"
        >
          <Plus className="w-6 h-6" strokeWidth={2} />
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end lg:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-label="Quick capture"
            className="relative w-full lg:max-w-md bg-background rounded-t-3xl lg:rounded-3xl px-5 pt-3 border border-border/60"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 16px) + 16px)" }}
          >
            <div className="w-9 h-1 rounded-full bg-border mx-auto mb-3 lg:hidden" />
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-heading text-lg text-foreground">Capture</h2>
              <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              ref={taRef}
              value={text}
              onChange={(e) => { setText(e.target.value); setErr(""); }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); save(); } }}
              placeholder="Call Equifax about the car loan Tuesday"
              rows={3}
              className="w-full resize-none rounded-xl border border-border bg-card px-3 py-2.5 text-[16px] font-body text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-[#A7773F]"
            />
            <p className="text-[12px] text-muted-foreground mt-2.5 mb-1.5">Save as</p>
            <div className="flex flex-wrap gap-1.5">
              {TYPES.map(([key, label, Icon]) => {
                const on = type === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPicked(key)}
                    className={`inline-flex items-center gap-1.5 text-[13px] rounded-full px-3 py-1.5 border transition-colors ${on ? "bg-[#A7773F] border-[#A7773F] text-[#F7F3EC]" : "bg-card border-border text-foreground"}`}
                  >
                    <Icon className="w-3.5 h-3.5" />{label}
                  </button>
                );
              })}
            </div>
            <p className={`text-[12px] mt-2 min-h-[18px] ${err ? "text-destructive" : "text-muted-foreground"}`}>
              {err || (draft ? `Goes to ${draft.hint}` : "Guía picks the type as you type. Dates like “Tuesday” or “Nov 20” become the due date.")}
            </p>
            <div className="flex gap-2 mt-3">
              <button type="button" onClick={() => setOpen(false)} className="flex-1 h-11 rounded-xl border border-border text-sm text-foreground">Cancel</button>
              <button type="button" onClick={save} disabled={saving} className="flex-1 h-11 rounded-xl bg-[#2E2A27] text-[#F7F3EC] text-sm disabled:opacity-60">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className="fixed left-4 right-4 lg:left-auto lg:right-6 lg:w-[360px] z-[85] rounded-xl bg-[#2E2A27] text-[#F7F3EC] px-3.5 py-2.5 flex items-center gap-2 text-[13px] shadow-lg bottom-[calc(env(safe-area-inset-bottom,44px)+72px)] lg:bottom-6"
        >
          <Check className="w-4 h-4 shrink-0" />
          <span className="flex-1 truncate">Saved to {TYPE_INFO[toast.type].where}</span>
          {location.pathname !== TYPE_INFO[toast.type].path && (
            <button type="button" onClick={() => { setToast(null); navigate(TYPE_INFO[toast.type].path); }} className="text-[#D8B98F] px-1">Open</button>
          )}
          <button type="button" onClick={undo} className="text-[#D8B98F] px-1">Undo</button>
        </div>
      )}
    </>
  );
}
