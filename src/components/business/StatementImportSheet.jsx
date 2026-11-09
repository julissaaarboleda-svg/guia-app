import { useState, useRef } from "react";
import { X, FileText, Upload, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { ent } from "@/lib/freshEntities";

const money = (n) => `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2, maximumFractionDigits: 2 })}`;
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const dayLabel = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "No date");

// Reads a business bank statement and proposes Business log entries.
// Nothing saves until the person approves it, and the statement itself is not kept.
export default function StatementImportSheet({ open, onClose, existing = [], businessId, onDone }) {
  const [step, setStep] = useState("pick"); // pick | reading | review | saving
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState([]);
  const fileRef = useRef(null);

  if (!open) return null;

  const reset = () => { setStep("pick"); setError(""); setRows([]); setFileName(""); setNote(""); };
  const close = () => { reset(); onClose(); };
  const setRow = (id, patch) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const readFiles = async (list) => {
    const files = Array.from(list || []).slice(0, 10);
    if (!files.length) return;
    const tooBig = files.filter((f) => f.size > 4 * 1024 * 1024);
    const ok = files.filter((f) => f.size <= 4 * 1024 * 1024);
    if (!ok.length) { setError("Those files are over 4 MB. Try one statement month at a time."); return; }
    setFileName(ok.length === 1 ? ok[0].name : `${ok.length} files`); setError(""); setStep("reading");
    try {
      const results = new Array(ok.length);
      let next = 0;
      const worker = async () => {
        while (next < ok.length) {
          const i = next++;
          try { results[i] = { entries: (await base44.integrations.Core.ImportFinanceFile({ file: ok[i], mode: "business" })).entries || [] }; }
          catch (err) { results[i] = { error: err.message || "Couldn't read it" }; }
        }
      };
      await Promise.all([worker(), worker(), worker()]);

      const seen = new Set();
      const prepared = [];
      let dupAcross = 0;
      const full = [];
      results.forEach((r, f) => {
        if (r.error) return;
        if (r.entries.length >= 150) full.push(ok[f].name);
        r.entries.forEach((it) => {
          const key = `${it.date}|${it.amount}|${norm(it.name)}`;
          const dupFile = seen.has(key);
          seen.add(key);
          if (dupFile) { dupAcross += 1; return; }
          const dup = existing.some((e) => (e.date || "") === it.date
            && Number(it.kind === "sale" ? e.revenue : e.expense) === it.amount
            && (norm(e.name).includes(norm(it.name).slice(0, 6)) || norm(it.name).includes(norm(e.name).slice(0, 6))));
          prepared.push({ ...it, id: prepared.length, dup, include: it.kind !== "skip" && !dup });
        });
      });
      prepared.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      prepared.forEach((r, i) => { r.id = i; });
      const failed = results.filter((r) => r.error).length;
      if (prepared.length === 0) { setError(failed ? "Couldn't read those files. Try again, or try clearer copies." : "No business transactions were found in those files."); setStep("pick"); return; }
      const notes = [];
      if (tooBig.length) notes.push(`${tooBig.length} file${tooBig.length === 1 ? " was" : "s were"} over 4 MB and skipped`);
      if (failed) notes.push(`${failed} couldn't be read`);
      if (dupAcross) notes.push(`${dupAcross} repeated transaction${dupAcross === 1 ? "" : "s"} across files counted once`);
      if (full.length) notes.push(`${full.join(", ")} may have more transactions than could be read. Try one month at a time to be sure`);
      setNote(notes.join(". "));
      setRows(prepared);
      setStep("review");
    } catch (err) {
      setError(err.message || "Couldn't read that file.");
      setStep("pick");
    }
  };

  const chosen = rows.filter((r) => r.include && r.kind !== "skip");
  const income = chosen.filter((r) => r.kind === "sale").reduce((s, r) => s + r.amount, 0);
  const spend = chosen.filter((r) => r.kind === "expense").reduce((s, r) => s + r.amount, 0);

  const save = async () => {
    setStep("saving");
    try {
      for (const r of chosen) {
        await ent.BusinessEntry.create({
          category: r.kind === "sale" ? "Sale" : "Expense",
          name: r.name,
          date: r.date || new Date().toISOString().split("T")[0],
          revenue: r.kind === "sale" ? r.amount : null,
          expense: r.kind === "expense" ? r.amount : null,
          location: "", description: r.note || "", notes: "",
          business_id: businessId || undefined,
        });
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={step === "reading" || step === "saving" ? undefined : close} />
      <div className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-background rounded-t-3xl sm:rounded-3xl border border-border p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="font-heading text-[20px] text-foreground leading-tight">Import a statement</h2>
            <p className="font-heading italic text-[13px] text-muted-foreground">Sales and expenses, straight into your log.</p>
          </div>
          {step !== "reading" && step !== "saving" && (
            <button onClick={close} className="text-muted-foreground hover:text-foreground" aria-label="Close"><X className="w-5 h-5" strokeWidth={1.5} /></button>
          )}
        </div>

        {step === "pick" && (
          <>
            <button onClick={() => fileRef.current?.click()}
              className="w-full border border-dashed border-[#A7773F]/60 rounded-2xl py-9 flex flex-col items-center gap-2 text-[#A7773F] hover:bg-secondary/50 transition-colors">
              <Upload className="w-6 h-6" strokeWidth={1.5} />
              <span className="text-sm font-medium">Choose statements</span>
              <span className="text-xs text-muted-foreground">Up to 10 files · PDF, screenshot or CSV · under 4 MB each</span>
            </button>
            <input ref={fileRef} type="file" multiple accept="application/pdf,image/*,.csv,.txt,.tsv" className="hidden"
              onChange={(e) => { const picked = Array.from(e.target.files || []); e.target.value = ""; readFiles(picked); }} />
            <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
              Guía reads it once, suggests what to log, and lets you check everything before it saves. The statement itself isn't stored, and account numbers are left out.
            </p>
            {error && <p className="text-xs text-destructive mt-3">{error}</p>}
          </>
        )}

        {step === "reading" && (
          <div className="py-12 flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
            <p className="text-sm text-foreground flex items-center gap-1.5"><FileText className="w-4 h-4" strokeWidth={1.5} /> Reading {fileName}…</p>
            <p className="text-xs text-muted-foreground">This can take up to a minute.</p>
          </div>
        )}

        {(step === "review" || step === "saving") && (
          <>
            {note && <p className="text-[12.5px] text-[#8A5F27] bg-[#F3E8D6] rounded-lg px-3 py-2 mb-3">{note}.</p>}
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground mb-3">
              <span>{chosen.length} of {rows.length} selected</span>
              <span>Sales <b className="text-foreground font-medium">{money(income)}</b></span>
              <span>Expenses <b className="text-destructive font-medium">{money(spend)}</b></span>
            </div>
            <div className="bg-card border border-border rounded-2xl divide-y divide-border/60 overflow-hidden">
              {rows.map((r) => (
                <div key={r.id} className={`px-3 py-2.5 ${r.include ? "" : "opacity-55"}`}>
                  <div className="flex items-center gap-2.5">
                    <button onClick={() => setRow(r.id, { include: !r.include, kind: r.kind === "skip" ? "expense" : r.kind })}
                      aria-label={r.include ? "Leave out" : "Include"}
                      className={`w-[18px] h-[18px] rounded-[5px] flex-shrink-0 flex items-center justify-center ${r.include ? "bg-[#A7773F] text-[#F7F3EC]" : "border border-border"}`}>
                      {r.include && <Check className="w-3 h-3" strokeWidth={2.5} />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground truncate">{r.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {dayLabel(r.date)}{r.dup ? " · Already in your log" : r.confidence < 0.7 ? " · Worth a second look" : ""}
                      </p>
                    </div>
                    <span className={`text-sm font-medium flex-shrink-0 ${r.kind === "sale" ? "text-foreground" : r.kind === "expense" ? "text-destructive" : "text-muted-foreground"}`}>
                      {r.kind === "sale" ? "+" : r.kind === "expense" ? "-" : ""}{money(r.amount)}
                    </span>
                  </div>
                  {r.include && (
                    <div className="flex gap-1.5 mt-2 pl-[28px]">
                      {chip(r.kind === "sale", "Sale", () => setRow(r.id, { kind: "sale" }))}
                      {chip(r.kind === "expense", "Expense", () => setRow(r.id, { kind: "expense" }))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {error && <p className="text-xs text-destructive mt-3">{error}</p>}
            <div className="flex items-center gap-3 mt-4">
              <button onClick={save} disabled={step === "saving" || chosen.length === 0}
                className="bg-[#A7773F] text-[#F7F3EC] px-5 py-2.5 rounded-full text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {step === "saving" ? "Adding…" : `Add ${chosen.length} to my log`}
              </button>
              <button onClick={close} disabled={step === "saving"} className="text-sm text-muted-foreground hover:text-foreground">Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
