import { useState, useRef } from "react";
import { X, FileText, Upload, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { ent } from "@/lib/freshEntities";

const KIND_LABEL = { bill: "Bill", subscription: "Subscription", loan: "Loan", savings_goal: "Savings goal", skip: "Skip" };
const fmt = (n) => (n == null ? "—" : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`);
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

function toRecord(it) {
  const base = { type: it.kind, name: it.name, notes: "" };
  if (it.kind === "savings_goal") return { ...base, current_amount: 0, target_amount: it.amount || null };
  if (it.kind === "loan") return { ...base, monthly_payment: it.amount || null, total_amount: null, amount_paid: 0, due_date: null, paid: false };
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
  const fileRef = useRef(null);

  if (!open) return null;

  const existingNames = new Set(existing.map((i) => norm(i.name)));

  const reset = () => { setStep("pick"); setError(""); setRows([]); setFileName(""); };
  const close = () => { reset(); onClose(); };

  const readFile = async (file) => {
    if (!file) return;
    setFileName(file.name); setError(""); setStep("reading");
    try {
      const { items } = await base44.integrations.Core.ImportFinanceFile({ file });
      const prepared = items.map((it, i) => {
        const dup = existingNames.has(norm(it.name));
        const sure = it.confidence >= 0.8 && it.kind !== "skip";
        return {
          ...it, id: i, dup,
          choice: dup ? "skip" : it.kind,
          needsCall: !dup && !sure,
        };
      }).filter((r) => r.kind !== "skip" || r.dup);
      setRows(prepared);
      setStep("review");
    } catch (err) {
      setError(err.message || "Couldn't read that file.");
      setStep("pick");
    }
  };

  const setChoice = (id, choice) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, choice, kind: choice === "skip" ? r.kind : choice, needsCall: false } : r)));

  const ready = rows.filter((r) => !r.needsCall && !r.dup);
  const asks = rows.filter((r) => r.needsCall);
  const dups = rows.filter((r) => r.dup);
  const toAdd = rows.filter((r) => r.choice !== "skip" && !r.needsCall && !r.dup).length;

  const save = async () => {
    setStep("saving");
    try {
      for (const r of rows) {
        if (r.choice === "skip" || r.needsCall || r.dup) continue;
        await ent.FinanceItem.create(toRecord({ ...r, kind: r.choice }));
      }
      onDone && onDone();
      close();
    } catch (err) {
      setError(err.message || "Something went wrong while saving.");
      setStep("review");
    }
  };

  const toggleReady = (id) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, choice: r.choice === "skip" ? r.kind : "skip" } : r)));

  const chip = (active, label, onClick) => (
    <button key={label} onClick={onClick}
      className={`px-3 py-1 rounded-full text-[11px] whitespace-nowrap ${active ? "bg-[#A7773F] text-[#F7F3EC]" : "border border-dashed border-[#A7773F] text-[#A7773F]"}`}>
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={step === "reading" || step === "saving" ? undefined : close} />
      <div className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-background rounded-t-3xl sm:rounded-3xl border border-border p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="font-heading text-[22px] text-foreground leading-tight">Import from a file</h2>
            <p className="font-heading italic text-[14px] text-muted-foreground mt-0.5">
              {step === "review" ? `We found ${rows.length} item${rows.length === 1 ? "" : "s"}.${asks.length ? " Check anything marked with a dashed outline." : ""}` : "Add bills, subscriptions and loans in one go."}
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

            {ready.length > 0 && (
              <>
                <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground mt-4 mb-2">Ready to add</p>
                <div className="bg-card border border-border rounded-2xl divide-y divide-border">
                  {ready.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 p-3">
                      <button onClick={() => toggleReady(r.id)} aria-label="Include" className={`w-[18px] h-[18px] rounded-[5px] flex items-center justify-center flex-shrink-0 ${r.choice !== "skip" ? "bg-[#A7773F] text-[#F7F3EC]" : "border border-border"}`}>
                        {r.choice !== "skip" && <Check className="w-3 h-3" strokeWidth={2.5} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="font-heading text-[15px] text-foreground truncate">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{fmt(r.amount)}{r.due_day ? ` · Day ${r.due_day}` : ""}{r.billing_cycle && r.billing_cycle !== "one_time" ? ` · ${r.billing_cycle}` : ""}</p>
                      </div>
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#F0E6D6] text-[#8B6B3E] whitespace-nowrap">{KIND_LABEL[r.kind]}{r.kind === "bill" && r.is_fixed ? " · fixed" : ""}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {asks.length > 0 && (
              <>
                <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground mt-5 mb-2">Needs your call</p>
                <div className="space-y-2">
                  {asks.map((r) => {
                    const options = [r.kind, ...r.alternatives].filter((k, i, a) => k !== "skip" && a.indexOf(k) === i);
                    return (
                      <div key={r.id} className="bg-card border border-border rounded-2xl p-3">
                        <p className="font-heading text-[15px] text-foreground">{r.name} <span className="text-muted-foreground text-sm">· {fmt(r.amount)}</span></p>
                        {r.reason && <p className="text-xs text-muted-foreground mt-0.5 mb-2">{r.reason}</p>}
                        <div className="flex flex-wrap gap-1.5">
                          {options.map((k) => chip(false, KIND_LABEL[k], () => setChoice(r.id, k)))}
                          {chip(false, "Skip", () => setChoice(r.id, "skip"))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {dups.length > 0 && (
              <>
                <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground mt-5 mb-2">Already in Finance</p>
                <div className="bg-card border border-border rounded-2xl divide-y divide-border">
                  {dups.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-3">
                      <p className="font-heading text-[15px] text-muted-foreground">{r.name}</p>
                      <span className="text-[11px] text-muted-foreground">Skipped</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {error && <p className="text-xs text-destructive mt-3">{error}</p>}
            <button onClick={save} disabled={step === "saving" || toAdd === 0}
              className="w-full mt-5 bg-[#A7773F] text-[#F7F3EC] rounded-full py-2.5 font-heading text-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
              {step === "saving" ? "Adding…" : asks.length ? `Add ${toAdd} item${toAdd === 1 ? "" : "s"} (${asks.length} still to choose)` : `Add ${toAdd} item${toAdd === 1 ? "" : "s"}`}
            </button>
            <p className="text-xs text-muted-foreground text-center mt-2">Nothing is saved until you tap Add.</p>
          </div>
        )}
      </div>
    </div>
  );
}
