import { useState, useRef } from "react";
import { X, FileText, Upload, Check, ChevronDown } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { ent } from "@/lib/freshEntities";

const KIND_LABEL = { bill: "Bill", subscription: "Subscription", loan: "Loan", credit_card: "Credit card", savings_goal: "Savings goal" };
const PICKABLE = ["bill", "subscription", "loan", "credit_card", "savings_goal"];
const fmt = (n) => (n == null ? "—" : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2, maximumFractionDigits: 2 })}`);
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const AMOUNT_FIELD = { bill: "amount", subscription: "amount", loan: "monthly_payment", savings_goal: "target_amount" };
const amtOf = (e) => (e ? e[AMOUNT_FIELD[e.type]] ?? null : null);

function toRecord(it) {
  const base = { type: it.kind, name: it.name, notes: "" };
  if (it.kind === "savings_goal") return { ...base, current_amount: 0, target_amount: it.amount || null };
  if (it.kind === "loan" || it.kind === "credit_card") {
    return { ...base, type: "loan", ...(it.kind === "credit_card" ? { subtype: "credit_card" } : {}), monthly_payment: it.amount || null, total_amount: null, amount_paid: 0, due_date: null, paid: false };
  }
  if (it.kind === "subscription") return { ...base, amount: it.amount || null, billing_cycle: it.billing_cycle === "one_time" ? "monthly" : it.billing_cycle, renewal_date: null };
  const recurring = it.billing_cycle && it.billing_cycle !== "one_time";
  return {
    ...base, amount: it.amount || null, paid: false, is_fixed: !!it.is_fixed && recurring,
    category: it.category || "", billing_cycle: it.billing_cycle || "monthly",
    due_day: recurring ? it.due_day : null, due_date: null,
  };
}

export default function ImportSheet({ open, onClose, existing = [], onDone }) {
  const [step, setStep] = useState("pick"); // pick | reading | review | saving
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const fileRef = useRef(null);

  if (!open) return null;

  const mergeable = existing.filter((e) => AMOUNT_FIELD[e.type]);
  const byId = (id) => existing.find((e) => e.id === id);

  const reset = () => { setStep("pick"); setError(""); setRows([]); setFileName(""); setEditing(null); };
  const close = () => { reset(); onClose(); };
  const setRow = (id, patch) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const readFile = async (file) => {
    if (!file) return;
    setFileName(file.name); setError(""); setStep("reading");
    try {
      const { items } = await base44.integrations.Core.ImportFinanceFile({
        file,
        existing: mergeable.map((e) => ({ name: e.name, amount: amtOf(e), type: e.type })),
      });
      const prepared = items.map((it, i) => {
        const exact = mergeable.find((e) => norm(e.name) === norm(it.name));
        const guess = !exact && it.matches_existing ? mergeable.find((e) => norm(e.name) === norm(it.matches_existing)) : null;
        const target = exact || guess;
        const differs = target && it.amount != null && Number(amtOf(target)) !== Number(it.amount);
        return {
          ...it, id: i,
          exact: !!exact,
          action: exact ? (differs ? "merge" : "skip") : guess ? "merge" : "new",
          mergeId: target ? target.id : null,
          updateAmount: !!differs,
          needsCall: !exact && (!!guess || it.confidence < 0.8),
        };
      }).filter((r) => r.kind !== "skip" || r.exact || r.mergeId);
      setRows(prepared);
      setStep("review");
    } catch (err) {
      setError(err.message || "Couldn't read that file.");
      setStep("pick");
    }
  };

  const chooseKind = (r, kind) => setRow(r.id, { action: "new", kind, mergeId: null, updateAmount: false, needsCall: false });
  const chooseMerge = (r, id) => {
    if (!id) return;
    const target = byId(id);
    const differs = r.amount != null && Number(amtOf(target)) !== Number(r.amount);
    setRow(r.id, { action: "merge", mergeId: id, updateAmount: !!differs, needsCall: false });
  };
  const chooseSkip = (r) => setRow(r.id, { action: "skip", needsCall: false });

  const dups = rows.filter((r) => r.exact && !r.needsCall);
  const asks = rows.filter((r) => r.needsCall);
  const ready = rows.filter((r) => !r.needsCall && !r.exact);

  const willCreate = rows.filter((r) => !r.needsCall && r.action === "new").length;
  const willUpdate = rows.filter((r) => !r.needsCall && r.action === "merge" && r.updateAmount && r.amount != null).length;
  const total = willCreate + willUpdate;

  const save = async () => {
    setStep("saving");
    try {
      for (const r of rows) {
        if (r.needsCall) continue;
        if (r.action === "new") await ent.FinanceItem.create(toRecord(r));
        else if (r.action === "merge" && r.updateAmount && r.amount != null) {
          const t = byId(r.mergeId);
          if (t) await ent.FinanceItem.update(t.id, { [AMOUNT_FIELD[t.type]]: r.amount });
        }
      }
      onDone && onDone();
      close();
    } catch (err) {
      setError(err.message || "Something went wrong while saving.");
      setStep("review");
    }
  };

  const chip = (active, label, onClick) => (
    <button key={label} onClick={onClick}
      className={`px-3 py-1 rounded-full text-[11px] whitespace-nowrap ${active ? "bg-[#A7773F] text-[#F7F3EC]" : "border border-dashed border-[#A7773F] text-[#A7773F]"}`}>
      {label}
    </button>
  );

  const rowLabel = (r) => (r.action === "merge" ? byId(r.mergeId)?.name || "Existing" : r.action === "skip" ? "Skip" : `${KIND_LABEL[r.kind]}${r.kind === "bill" && r.is_fixed ? " · fixed" : ""}`);

  const renderEditor = (r, confirmed) => {
    const t = r.mergeId ? byId(r.mergeId) : null;
    const differs = t && r.amount != null && Number(amtOf(t)) !== Number(r.amount);
    const guess = !confirmed && t ? t : null;
    return (
      <div className="px-3 pb-3 space-y-2.5">
        <div className="flex flex-wrap gap-1.5">
          {guess && chip(false, `Add to ${guess.name}`, () => chooseMerge(r, guess.id))}
          {PICKABLE.map((k) => chip(confirmed && r.action === "new" && r.kind === k, KIND_LABEL[k], () => chooseKind(r, k)))}
          {chip(confirmed && r.action === "skip", "Skip", () => chooseSkip(r))}
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="whitespace-nowrap">Or add to existing</span>
          <span className="relative flex-1">
            <select value={confirmed && r.action === "merge" ? r.mergeId || "" : ""} onChange={(e) => chooseMerge(r, e.target.value)}
              className="w-full appearance-none bg-secondary border border-input rounded-full pl-3 pr-7 py-1.5 text-xs text-foreground outline-none">
              <option value="">Choose…</option>
              {mergeable.map((e) => <option key={e.id} value={e.id}>{e.name} · {KIND_LABEL[e.type] || e.type}</option>)}
            </select>
            <ChevronDown className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </span>
        </label>
        {confirmed && r.action === "merge" && differs && (
          <button onClick={() => setRow(r.id, { updateAmount: !r.updateAmount })} className="flex items-center gap-2 text-xs text-foreground">
            <span className={`w-[18px] h-[18px] rounded-[5px] flex items-center justify-center ${r.updateAmount ? "bg-[#A7773F] text-[#F7F3EC]" : "border border-border"}`}>
              {r.updateAmount && <Check className="w-3 h-3" strokeWidth={2.5} />}
            </span>
            Update {t.name} from {fmt(amtOf(t))} to {fmt(r.amount)}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={step === "reading" || step === "saving" ? undefined : close} />
      <div className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-background rounded-t-3xl sm:rounded-3xl border border-border p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="font-heading text-[22px] text-foreground leading-tight">Import from a file</h2>
            <p className="font-heading italic text-[14px] text-muted-foreground mt-0.5">
              {step === "review" ? `We found ${rows.length} item${rows.length === 1 ? "" : "s"}. Tap a label to change where it goes.` : "Add bills, subscriptions and loans in one go."}
            </p>
          </div>
          <button onClick={close} aria-label="Close" className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        {(step === "pick" || step === "reading") && (
          <div>
            <input ref={fileRef} type="file" accept=".pdf,.csv,.txt,image/*" className="hidden" onChange={(e) => { readFile(e.target.files?.[0]); e.target.value = ""; }} />
            <button onClick={() => fileRef.current?.click()} disabled={step === "reading"}
              className="w-full border border-dashed border-border bg-card rounded-2xl py-8 flex flex-col items-center gap-2 text-center disabled:opacity-60">
              {step === "reading"
                ? <><span className="w-5 h-5 border-2 border-muted border-t-[#A7773F] rounded-full animate-spin" /><span className="font-heading text-base text-foreground">Reading {fileName}…</span><span className="text-xs text-muted-foreground">This can take up to a minute.</span></>
                : <><Upload className="w-5 h-5 text-[#A7773F]" strokeWidth={1.5} /><span className="font-heading text-base text-foreground">Choose a file</span><span className="text-xs text-muted-foreground px-6">A statement or bill as PDF, a photo or screenshot, or a CSV.</span></>}
            </button>
            {error && <p className="text-xs text-destructive mt-3">{error}</p>}
            <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
              The file is read once to find your items and isn't saved. It's sent to an AI service to do that, so hide account numbers first if you'd rather not share them.
            </p>
          </div>
        )}

        {(step === "review" || step === "saving") && (
          <div>
            <div className="bg-card border border-border rounded-2xl p-3 mb-3 flex items-center gap-3">
              <FileText className="w-5 h-5 text-[#A7773F]" strokeWidth={1.5} />
              <div className="flex-1 min-w-0"><p className="text-[13px] text-foreground truncate">{fileName}</p></div>
              <button onClick={reset} className="text-xs text-[#A7773F]">Change</button>
            </div>

            {rows.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Nothing to add was found in that file.</p>}

            {asks.length > 0 && (
              <>
                <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground mt-4 mb-2">Needs your call</p>
                <div className="space-y-2">
                  {asks.map((r) => (
                    <div key={r.id} className="bg-card border border-border rounded-2xl">
                      <div className="p-3 pb-2">
                        <p className="font-heading text-[15px] text-foreground">{r.name} <span className="text-muted-foreground text-sm">· {fmt(r.amount)}</span></p>
                        {r.reason && <p className="text-xs text-muted-foreground mt-0.5">{r.reason}</p>}
                      </div>
                      {renderEditor(r, false)}
                    </div>
                  ))}
                </div>
              </>
            )}

            {ready.length > 0 && (
              <>
                <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground mt-5 mb-2">Ready to add</p>
                <div className="bg-card border border-border rounded-2xl divide-y divide-border">
                  {ready.map((r) => (
                    <div key={r.id}>
                      <div className="flex items-center gap-3 p-3">
                        <button onClick={() => setRow(r.id, r.action === "skip" ? { action: "new" } : { action: "skip" })} aria-label="Include"
                          className={`w-[18px] h-[18px] rounded-[5px] flex items-center justify-center flex-shrink-0 ${r.action !== "skip" ? "bg-[#A7773F] text-[#F7F3EC]" : "border border-border"}`}>
                          {r.action !== "skip" && <Check className="w-3 h-3" strokeWidth={2.5} />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`font-heading text-[15px] truncate ${r.action === "skip" ? "text-muted-foreground" : "text-foreground"}`}>{r.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.action === "merge" ? (r.updateAmount ? `Updates ${rowLabel(r)} to ${fmt(r.amount)}` : `Joins ${rowLabel(r)}`) : `${fmt(r.amount)}${r.due_day ? ` · Day ${r.due_day}` : ""}${r.billing_cycle && r.billing_cycle !== "one_time" ? ` · ${r.billing_cycle}` : ""}`}
                          </p>
                        </div>
                        <button onClick={() => setEditing(editing === r.id ? null : r.id)}
                          className="text-[11px] pl-2.5 pr-2 py-0.5 rounded-full bg-[#F0E6D6] text-[#8B6B3E] whitespace-nowrap flex items-center gap-1">
                          {rowLabel(r)} <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                      {editing === r.id && renderEditor(r, true)}
                    </div>
                  ))}
                </div>
              </>
            )}

            {dups.length > 0 && (
              <>
                <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground mt-5 mb-2">Already in Finance</p>
                <div className="bg-card border border-border rounded-2xl divide-y divide-border">
                  {dups.map((r) => {
                    const t = byId(r.mergeId);
                    const differs = t && r.amount != null && Number(amtOf(t)) !== Number(r.amount);
                    return (
                      <div key={r.id} className="flex items-center justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <p className="font-heading text-[15px] text-muted-foreground truncate">{r.name}</p>
                          {differs && <p className="text-xs text-muted-foreground">{fmt(amtOf(t))} now · {fmt(r.amount)} in this file</p>}
                        </div>
                        {differs ? (
                          <button onClick={() => setRow(r.id, r.action === "merge" ? { action: "skip", updateAmount: false } : { action: "merge", updateAmount: true })}
                            className={`text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap ${r.action === "merge" ? "bg-[#A7773F] text-[#F7F3EC]" : "border border-dashed border-[#A7773F] text-[#A7773F]"}`}>
                            Update to {fmt(r.amount)}
                          </button>
                        ) : <span className="text-[11px] text-muted-foreground">Skipped</span>}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {error && <p className="text-xs text-destructive mt-3">{error}</p>}
            <button onClick={save} disabled={step === "saving" || total === 0}
              className="w-full mt-5 bg-[#A7773F] text-[#F7F3EC] rounded-full py-2.5 font-heading text-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
              {step === "saving" ? "Saving…" : `${willCreate ? `Add ${willCreate}` : ""}${willCreate && willUpdate ? " and " : ""}${willUpdate ? `${willCreate ? "update" : "Update"} ${willUpdate}` : ""}${total === 0 ? "Nothing to add yet" : ""}${asks.length ? ` · ${asks.length} to choose` : ""}`}
            </button>
            <p className="text-xs text-muted-foreground text-center mt-2">Nothing is saved until you tap the button.</p>
          </div>
        )}
      </div>
    </div>
  );
}
