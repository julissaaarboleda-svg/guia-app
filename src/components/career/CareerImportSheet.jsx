import { useState, useRef } from "react";
import { X, FileText, Upload, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { ent } from "@/lib/freshEntities";
import { fmtMonth, norm, sameCompany, bulletsToHtml, TAGS } from "@/lib/careerFormat";

const SAVE_TYPE = { job: "job", review: "review", education: "education", certification: "certification", milestone: "milestone", skills: "skill" };
const TAG_KEY = { job: "job", review: "review", education: "education", certification: "certification", milestone: "milestone", skills: "skill" };

const when = (r) => {
  if (r.kind === "skills") return `${r.skills.length} skills`;
  const a = fmtMonth(r.start_date);
  const b = r.current ? "Present" : fmtMonth(r.end_date);
  return a || b ? `${a || "?"} – ${b || "?"}` : "";
};

// Reads a resume, review, offer letter or certificate and proposes Career entries.
// Nothing is saved until the person approves it, and the file itself is not kept.
export default function CareerImportSheet({ open, onClose, existing = [], onDone }) {
  const [step, setStep] = useState("pick"); // pick | reading | review | saving
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);
  const fileRef = useRef(null);

  if (!open) return null;

  const reset = () => { setStep("pick"); setError(""); setRows([]); setFileName(""); };
  const close = () => { reset(); onClose(); };
  const toggle = (id) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, include: !r.include } : r)));

  const isDuplicate = (it) => {
    const type = SAVE_TYPE[it.kind];
    return existing.some((e) => {
      if (type === "skill") return e.entry_type === "skill" && norm(e.title) === norm(it.title);
      if (e.entry_type !== type) return false;
      const t1 = norm(e.title), t2 = norm(it.title);
      const sameTitle = t1 === t2 || (t1 && t2 && (t1.includes(t2) || t2.includes(t1)));
      const orgOk = !e.company || !it.organization || sameCompany(e.company, it.organization);
      const yearOk = !e.start_date || !it.start_date || String(e.start_date).slice(0, 4) === String(it.start_date).slice(0, 4);
      return sameTitle && orgOk && yearOk;
    });
  };

  const readFile = async (file) => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { setError("That file is over 4 MB. Try a smaller PDF."); return; }
    setFileName(file.name); setError(""); setStep("reading");
    try {
      const { entries } = await base44.integrations.Core.ImportFinanceFile({ file, mode: "career" });
      const prepared = entries.map((it, i) => {
        const dup = isDuplicate(it);
        return { ...it, id: i, dup, include: !dup };
      });
      if (prepared.length === 0) { setError("No career details were found in that file."); setStep("pick"); return; }
      setRows(prepared);
      setStep("review");
    } catch (err) {
      setError(err.message || "Couldn't read that file.");
      setStep("pick");
    }
  };

  const chosen = rows.filter((r) => r.include);
  const hasCurrent = existing.some((e) => e.entry_type === "job" && e.current);

  const save = async () => {
    setStep("saving");
    try {
      for (const r of chosen) {
        const isSkills = r.kind === "skills";
        await ent.CareerEntry.create({
          entry_type: SAVE_TYPE[r.kind],
          title: r.title,
          company: r.organization || undefined,
          start_date: r.start_date || undefined,
          end_date: r.current ? undefined : r.end_date || undefined,
          salary: r.salary || undefined,
          rating: r.rating || undefined,
          rating_scale: r.rating && r.rating_scale ? r.rating_scale : undefined,
          description: isSkills ? undefined : bulletsToHtml(r.highlights) || undefined,
          skills_gained: isSkills ? r.skills : r.skills.length ? r.skills : [],
          current: r.kind === "job" && r.current && !hasCurrent,
        });
      }
      onDone && onDone();
      close();
    } catch (err) {
      setError(err.message || "Something went wrong while saving.");
      setStep("review");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={step === "reading" || step === "saving" ? undefined : close} />
      <div className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-background rounded-t-3xl sm:rounded-3xl border border-border p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="font-heading text-[20px] text-foreground leading-tight">Import from a document</h2>
            <p className="font-heading italic text-[13px] text-muted-foreground">Resume, review, offer letter or certificate.</p>
          </div>
          {step !== "reading" && step !== "saving" && (
            <button onClick={close} className="text-muted-foreground hover:text-foreground" aria-label="Close"><X className="w-5 h-5" /></button>
          )}
        </div>

        {step === "pick" && (
          <>
            <button onClick={() => fileRef.current?.click()}
              className="w-full border border-dashed border-[#A7773F]/60 rounded-2xl py-9 flex flex-col items-center gap-2 text-[#A7773F] hover:bg-secondary/50 transition-colors">
              <Upload className="w-6 h-6" strokeWidth={1.5} />
              <span className="text-sm font-medium">Choose a file</span>
              <span className="text-xs text-muted-foreground">PDF, screenshot or text · under 4 MB</span>
            </button>
            <input ref={fileRef} type="file" accept="application/pdf,.pdf,image/*,image/heic,image/heif,.heic,.heif,.txt" className="hidden"
              onChange={(e) => { readFile(e.target.files?.[0]); e.target.value = ""; }} />
            <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
              Guía reads it once, suggests entries, and lets you check everything before anything saves. The file itself isn't stored, and phone numbers, emails and addresses are left out. Pay is only imported if it's written in the document, and stays hidden until you tap Show pay.
            </p>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Have a Pages or Word file? Export it as a PDF first (Pages: File → Export To → PDF).
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
            <p className="text-xs text-muted-foreground mb-3">
              Found <b className="text-foreground font-medium">{rows.length}</b> · {chosen.length} selected. Uncheck anything you don't want.
            </p>
            <div className="bg-card border border-border rounded-2xl divide-y divide-border/60 overflow-hidden">
              {rows.map((r) => {
                const tag = TAGS[TAG_KEY[r.kind]];
                return (
                  <div key={r.id} className={`px-3 py-2.5 ${r.include ? "" : "opacity-55"}`}>
                    <div className="flex items-start gap-2.5">
                      <button onClick={() => toggle(r.id)} aria-label={r.include ? "Leave out" : "Include"}
                        className={`mt-0.5 w-[18px] h-[18px] rounded-[5px] flex-shrink-0 flex items-center justify-center ${r.include ? "bg-[#A7773F] text-[#F7F3EC]" : "border border-border"}`}>
                        {r.include && <Check className="w-3 h-3" strokeWidth={2.5} />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm text-foreground">{r.title}</p>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: tag.bg, color: tag.fg }}>{tag.label}</span>
                          {r.current && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: TAGS.current.bg, color: TAGS.current.fg }}>Current</span>}
                          {r.dup && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Already added</span>}
                          {!r.dup && r.current && hasCurrent && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">You already have a current role</span>
                          )}
                          {!r.dup && (r.date_uncertain || r.confidence < 0.7) && r.kind !== "skills" && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">Check dates</span>
                          )}
                        </div>
                        <p className="text-[11.5px] text-muted-foreground mt-0.5">
                          {[r.organization, when(r), r.highlights.length ? `${r.highlights.length} highlight${r.highlights.length > 1 ? "s" : ""}` : "", r.salary ? "pay included (hidden)" : ""].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {error && <p className="text-xs text-destructive mt-3">{error}</p>}
            <button onClick={save} disabled={step === "saving" || chosen.length === 0}
              className="w-full mt-4 bg-[#A7773F] text-[#F7F3EC] rounded-xl py-3 text-sm font-medium disabled:opacity-50">
              {step === "saving" ? "Saving…" : `Add ${chosen.length} ${chosen.length === 1 ? "entry" : "entries"}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
