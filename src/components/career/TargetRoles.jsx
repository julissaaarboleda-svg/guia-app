import { useState, useEffect, useMemo } from "react";
import { ent } from "@/lib/freshEntities";
import { base44 } from "@/api/base44Client";
import { Plus, ChevronLeft, ChevronRight, Trash2, Check, Pencil, FileText, Download, Copy, Sparkles, Briefcase, MapPin } from "lucide-react";
import CostOfLivingView, { RoleCostCard } from "@/components/career/CostOfLiving";
import { analyzePosting, buildResume, writeCoverLetter, exportResumePdf, exportResumeDocx, exportLetterPdf, exportLetterDocx } from "@/lib/careerTailor";

const scoreColor = (n) => (n >= 75 ? "#566033" : n >= 50 ? "#A7773F" : "#8F5F65");
const scoreLabel = (n) => (n >= 75 ? "Strong match" : n >= 50 ? "Good match" : n >= 30 ? "Stretch" : "Low match");

function Ring({ score, size = 46 }) {
  const c = scoreColor(score);
  return (
    <div className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: size, height: size, background: `conic-gradient(${c} 0 ${score}%, #ECE7DD 0)` }}>
      <div className="rounded-full bg-card flex items-center justify-center font-semibold text-foreground" style={{ width: size - 10, height: size - 10, fontSize: size > 60 ? 22 : 14 }}>{score}</div>
    </div>
  );
}

const HEADER_KEY = "guia-resume-header";
function useHeader() {
  const [h, setH] = useState(() => { try { return JSON.parse(localStorage.getItem(HEADER_KEY)) || {}; } catch { return {}; } });
  useEffect(() => {
    if (h.name) return;
    base44.auth.me().then((u) => setH((p) => ({ ...p, name: p.name || (u.full_name && !u.full_name.includes("@") ? u.full_name : ""), email: p.email || u.email }))).catch(() => {});
  }, []);
  useEffect(() => { try { localStorage.setItem(HEADER_KEY, JSON.stringify(h)); } catch {} }, [h]);
  return [h, setH];
}

// screen=false: a slim row on the Career page that opens the full "Match a new role" screen.
export default function TargetRoles({ entries, currentJob, onEditCurrent, screen = false, onOpen, onBack }) {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(null); // null | "add" | roleId
  const [form, setForm] = useState({ title: "", company: "", posting: "" });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [header, setHeader] = useHeader();
  const [editing, setEditing] = useState({}); // suggestion id -> draft text
  const [showResume, setShowResume] = useState(false);
  const [letterDraft, setLetterDraft] = useState("");

  const load = async () => { try { setRoles(await ent.TargetRole.list("-created_date")); } catch { /* ignore */ } setLoading(false); };
  useEffect(() => { load(); }, []);

  const role = roles.find((r) => r.id === view);
  useEffect(() => { setLetterDraft(role?.cover_letter || ""); setShowResume(false); setEditing({}); }, [view]);

  const hasProfile = entries.some((e) => e.entry_type === "job");
  const resume = useMemo(() => (role ? buildResume(entries, role) : null), [entries, role]);

  const patch = async (id, data) => {
    setRoles((rs) => rs.map((r) => (r.id === id ? { ...r, ...data } : r)));
    try { await ent.TargetRole.update(id, data); } catch (e) { console.error(e); }
  };

  const create = async () => {
    if (!form.title.trim() || form.posting.trim().length < 80) { setError("Add a title and paste the full job posting."); return; }
    setBusy("analyze"); setError("");
    try {
      const analysis = await analyzePosting(entries, form.posting);
      const created = await ent.TargetRole.create({ title: form.title.trim(), company: form.company.trim(), posting: form.posting, analysis, applied: {}, cover_letter: "" });
      setRoles((rs) => [created, ...rs]);
      setForm({ title: "", company: "", posting: "" });
      setView(created.id);
    } catch (e) { console.error(e); setError("Couldn't analyze that posting. Please try again."); }
    setBusy("");
  };

  const reanalyze = async () => {
    setBusy("analyze");
    try { const analysis = await analyzePosting(entries, role.posting); await patch(role.id, { analysis, applied: {} }); } catch { setError("Couldn't re-run the analysis."); }
    setBusy("");
  };

  const apply = (s) => patch(role.id, { applied: { ...(role.applied || {}), [s.id]: editing[s.id] ?? s.after } });
  const unapply = (s) => { const a = { ...(role.applied || {}) }; delete a[s.id]; patch(role.id, { applied: a }); };

  const letter = async () => {
    setBusy("letter"); setError("");
    try { const text = await writeCoverLetter(entries, role, role.applied); setLetterDraft(text); await patch(role.id, { cover_letter: text }); } catch { setError("Couldn't write the cover letter. Please try again."); }
    setBusy("");
  };

  const baseName = (role?.company || role?.title || "role").replace(/[^\w]+/g, "-").toLowerCase();

  // ---------- slim row on Career ----------
  if (!screen) {
    return (
      <button onClick={onOpen} className="w-full bg-card border border-border rounded-2xl px-4 py-3 mb-4 flex items-center gap-3 text-left">
        <span className="w-8 h-8 rounded-full bg-[#F0E6D6] flex items-center justify-center flex-shrink-0"><Briefcase className="w-4 h-4 text-[#8B6B3E]" strokeWidth={1.8} /></span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-foreground">Match a new role</span>
          <span className="block text-xs text-muted-foreground truncate">Compare a job posting · cost of living</span>
        </span>
        {!loading && roles.length > 0 && <span className="text-[11px] text-[#8B6B3E] bg-[#F0E6D6] rounded-full px-2 py-0.5 flex-shrink-0">{roles.length} saved</span>}
        <ChevronRight className="w-4 h-4 text-[#A7773F] flex-shrink-0" />
      </button>
    );
  }

  // ---------- its own screen ----------
  if (!view) {
    return (
      <div className="max-w-2xl">
        <button onClick={onBack} className="text-[13px] text-[#A7773F] flex items-center gap-0.5 mb-2"><ChevronLeft className="w-4 h-4" /> Career</button>
        <h1 className="font-heading text-[28px] leading-tight text-foreground">Match a new role</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-4">See how your career fits a job posting, what to change, and get a tailored resume and cover letter.</p>
        <button onClick={() => { setView("add"); setError(""); }} disabled={!hasProfile}
          className="w-full flex items-center justify-center gap-1.5 bg-foreground text-background rounded-xl py-3 text-sm font-medium disabled:opacity-50"><Plus className="w-4 h-4" /> Add a job posting</button>
        {!hasProfile && <p className="text-xs rounded-lg px-3 py-2 bg-[#F3E8D6] text-[#8A5F27] mt-2.5">Add your current role (with its job description) first. It's what each posting is compared against.</p>}
        {hasProfile && currentJob && !currentJob.description && (
          <button onClick={() => onEditCurrent(currentJob)} className="text-xs rounded-lg px-3 py-2.5 bg-[#F3E8D6] text-[#8A5F27] text-left w-full mt-2.5">Tip: add the job description to {currentJob.title} for better matches ›</button>
        )}

        <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground mt-6 mb-2">Your matches</p>
        {loading ? <div className="h-14 bg-muted rounded-xl animate-pulse" /> : roles.length === 0 ? (
          <p className="text-sm text-muted-foreground">Postings you compare are saved here, so you can come back to the resume and cover letter.</p>
        ) : (
          <div className="space-y-2">
            {roles.map((r) => (
              <button key={r.id} onClick={() => setView(r.id)} className="w-full flex items-center gap-3 bg-card border border-border rounded-2xl px-3.5 py-2.5 text-left">
                <Ring score={r.analysis?.score || 0} />
                <div className="min-w-0 flex-1"><p className="text-[14.5px] text-foreground truncate">{r.title}</p><p className="text-[11.5px] text-muted-foreground truncate">{r.company || "—"} · {scoreLabel(r.analysis?.score || 0)}</p></div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/60 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}

        <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground mt-6 mb-2">Tools</p>
        <button onClick={() => setView("col")} className="w-full flex items-center gap-3 bg-card border border-border rounded-2xl px-3.5 py-3 text-left">
          <MapPin className="w-4 h-4 text-[#7D8A53] flex-shrink-0" strokeWidth={1.8} />
          <span className="flex-1 text-sm text-foreground">Cost of living: compare cities</span>
          <ChevronRight className="w-4 h-4 text-[#A7773F]" />
        </button>
      </div>
    );
  }

  if (view === "col") return <CostOfLivingView currentJob={currentJob} onBack={() => setView(null)} />;

  // ---------- add ----------
  if (view === "add") {
    return (
      <div className="bg-card border border-border rounded-2xl p-4 md:p-5 mb-4">
        <button onClick={() => setView(null)} className="text-xs text-muted-foreground flex items-center gap-1 mb-2"><ChevronLeft className="w-3.5 h-3.5" /> Back</button>
        <h3 className="font-heading text-lg text-foreground mb-3">Add a job posting</h3>
        <div className="space-y-2.5">
          <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Job title" className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-sm outline-none focus:border-ring" />
          <input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} placeholder="Company" className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-sm outline-none focus:border-ring" />
          <textarea value={form.posting} onChange={(e) => setForm((f) => ({ ...f, posting: e.target.value }))} rows={9} placeholder="Paste the full job description here…" className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-sm outline-none focus:border-ring resize-none" />
          {error && <p className="text-xs text-[#8F5F65]">{error}</p>}
          <button onClick={create} disabled={!!busy} className="w-full text-white rounded-full py-2.5 text-sm font-medium disabled:opacity-60" style={{ background: "#A7773F" }}>{busy ? "Comparing with your career…" : "Compare with my resume"}</button>
        </div>
      </div>
    );
  }

  if (!role) return null;

  // ---------- detail ----------
  const a = role.analysis || {};
  const applied = role.applied || {};
  const appliedCount = Object.keys(applied).length;
  const inputCls = "bg-secondary border border-input rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-ring";
  const btnOut = "flex-1 flex items-center justify-center gap-1.5 border rounded-full py-2.5 text-sm font-medium";

  return (
    <div className="space-y-3 mb-4">
      <div className="flex items-center justify-between">
        <button onClick={() => setView(null)} className="text-xs text-muted-foreground flex items-center gap-1"><ChevronLeft className="w-3.5 h-3.5" /> Match a new role</button>
        <button onClick={async () => { if (confirm("Delete this role?")) { await ent.TargetRole.delete(role.id); setRoles((rs) => rs.filter((r) => r.id !== role.id)); setView(null); } }} className="text-muted-foreground/50 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button>
      </div>
      <div><h2 className="font-heading text-xl text-foreground">{role.title}</h2>{role.company && <p className="font-heading italic text-sm text-muted-foreground">{role.company}</p>}</div>

      <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
        <Ring score={a.score || 0} size={72} />
        <div className="min-w-0"><p className="text-[15px] font-semibold text-foreground">{scoreLabel(a.score || 0)}</p><p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{a.summary}</p>
          <button onClick={reanalyze} disabled={!!busy} className="text-xs font-medium mt-1.5" style={{ color: "#A7773F" }}>{busy === "analyze" ? "Re-checking…" : "Re-check after updating my career"}</button></div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4">
        {a.have?.length > 0 && (<><p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-2">You have</p><div className="flex flex-wrap gap-1.5 mb-3">{a.have.map((h, i) => <span key={i} className="text-[11px] px-2.5 py-1 rounded-full bg-[#E4E9D5] text-[#566033]">{h}</span>)}</div></>)}
        {a.missing?.length > 0 && (<><p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-2">Missing from your resume</p><div className="flex flex-wrap gap-1.5">{a.missing.map((m, i) => <span key={i} className={`text-[11px] px-2.5 py-1 rounded-full ${m.can_claim ? "bg-[#F3E8D6] text-[#8A5F27]" : "bg-[#F4E6E7] text-[#8F5F65]"}`}>{m.skill}</span>)}</div><p className="text-[11px] text-muted-foreground mt-2">Gold = you may already have this. Add it to your career if so. Mauve = a real gap.</p></>)}
      </div>

      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-1">Suggested edits · {a.suggestions?.length || 0}</p>
        {(a.suggestions || []).map((s) => {
          const done = applied[s.id] != null;
          const draft = editing[s.id];
          const open = draft !== undefined;
          return (
            <div key={s.id} className="border-t border-border first:border-0 py-3">
              <div className="flex items-center justify-between"><p className="text-xs font-semibold text-foreground">{s.section || s.target}</p>{done && <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-[#E4E9D5] text-[#566033]">Applied</span>}</div>
              {s.reason && <p className="text-[11.5px] text-muted-foreground mt-0.5">{s.reason}</p>}
              {s.before && <p className="text-[12.5px] leading-relaxed rounded-lg px-2.5 py-2 mt-1.5 bg-background text-muted-foreground line-through">{s.before}</p>}
              {open ? (
                <textarea value={draft} onChange={(e) => setEditing((d) => ({ ...d, [s.id]: e.target.value }))} rows={3} className={`${inputCls} w-full mt-1.5 text-[12.5px]`} autoFocus />
              ) : (
                <p className="text-[12.5px] leading-relaxed rounded-lg px-2.5 py-2 mt-1.5 bg-[#EEF1E3] text-[#3F4A27]">{done ? applied[s.id] : s.after}</p>
              )}
              {s.needs_number && !done && <p className="text-[11px] text-[#8A5F27] mt-1">Replace “[add your number]” with your real figure before applying.</p>}
              <div className="flex gap-2 mt-2">
                {done ? <button onClick={() => unapply(s)} className="text-xs border border-border text-muted-foreground rounded-full px-3.5 py-1.5">Undo</button> : (
                  <>
                    <button onClick={() => { apply(s); setEditing((d) => { const n = { ...d }; delete n[s.id]; return n; }); }} className="text-xs text-white rounded-full px-3.5 py-1.5 flex items-center gap-1" style={{ background: "#A7773F" }}><Check className="w-3 h-3" /> Apply</button>
                    <button onClick={() => setEditing((d) => (open ? (() => { const n = { ...d }; delete n[s.id]; return n; })() : { ...d, [s.id]: s.after }))} className="text-xs border border-border text-muted-foreground rounded-full px-3.5 py-1.5 flex items-center gap-1"><Pencil className="w-3 h-3" /> {open ? "Stop editing" : "Edit"}</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <RoleCostCard role={role} currentJob={currentJob} onPatch={(d) => patch(role.id, d)} onOpenSetup={() => setView("col")} />

      {/* Tailored resume */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-1">Tailored resume</p>
        <p className="text-xs text-muted-foreground mb-3">{appliedCount} edit{appliedCount === 1 ? "" : "s"} applied · your base resume is unchanged.</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[["name", "Name"], ["location", "City, State"], ["email", "Email"], ["phone", "Phone"]].map(([k, label]) => (
            <input key={k} value={header[k] || ""} onChange={(e) => setHeader((h) => ({ ...h, [k]: e.target.value }))} placeholder={label} className={inputCls} />
          ))}
        </div>
        <button onClick={() => setShowResume((v) => !v)} className="text-xs font-medium mb-3 flex items-center gap-1" style={{ color: "#A7773F" }}><FileText className="w-3.5 h-3.5" /> {showResume ? "Hide preview" : "Preview resume"}</button>
        {showResume && resume && (
          <div className="border border-border rounded-lg p-3 mb-3 bg-background text-[11.5px] leading-relaxed max-h-80 overflow-y-auto">
            <p className="font-heading text-base text-foreground">{header.name || "Your Name"}</p>
            {resume.summary && <p className="mt-2 rounded px-1 bg-[#EEF1E3] text-[#3F4A27]">{resume.summary}</p>}
            {resume.jobs.map((j) => (
              <div key={j.id} className="mt-3"><p className="font-semibold text-foreground">{j.title}{j.company ? ` — ${j.company}` : ""}</p><p className="text-muted-foreground">{j.dates}</p>
                {j.bullets.map((b, i) => <p key={i} className={j.changed.includes(b) ? "rounded px-1 bg-[#EEF1E3] text-[#3F4A27]" : "text-foreground"}>• {b}</p>)}</div>
            ))}
            {resume.skills.length > 0 && <p className="mt-3"><b>Skills:</b> {resume.skills.join(" · ")}</p>}
            <p className="mt-2 text-muted-foreground">Highlighted lines are the changes.</p>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={() => exportResumePdf(resume, header, `resume-${baseName}`)} className={btnOut} style={{ background: "#A7773F", color: "#fff", borderColor: "#A7773F" }}><Download className="w-4 h-4" /> PDF</button>
          <button onClick={() => exportResumeDocx(resume, header, `resume-${baseName}`)} className={btnOut} style={{ color: "#A7773F", borderColor: "#A7773F" }}><Download className="w-4 h-4" /> Word</button>
        </div>
      </div>

      {/* Cover letter */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2"><p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Cover letter</p>
          {letterDraft && <button onClick={letter} disabled={!!busy} className="text-xs font-medium" style={{ color: "#A7773F" }}>{busy === "letter" ? "Writing…" : "Rewrite"}</button>}</div>
        {!letterDraft ? (
          <button onClick={letter} disabled={!!busy} className="w-full flex items-center justify-center gap-1.5 border border-dashed rounded-lg py-3 text-sm font-medium disabled:opacity-60" style={{ borderColor: "#A7773F", color: "#A7773F" }}><Sparkles className="w-4 h-4" /> {busy === "letter" ? "Writing your letter…" : "Write a cover letter"}</button>
        ) : (
          <>
            <textarea value={letterDraft} onChange={(e) => setLetterDraft(e.target.value)} onBlur={() => patch(role.id, { cover_letter: letterDraft })} rows={14} className={`${inputCls} w-full text-[13px] leading-relaxed`} />
            <p className="text-[11px] text-muted-foreground mt-1.5">Based only on what's in your career. Read it over and add your own touch before sending.</p>
            <div className="flex gap-2 mt-3">
              <button onClick={() => exportLetterPdf(letterDraft, header, `cover-letter-${baseName}`)} className={btnOut} style={{ background: "#A7773F", color: "#fff", borderColor: "#A7773F" }}><Download className="w-4 h-4" /> PDF</button>
              <button onClick={() => exportLetterDocx(letterDraft, header, `cover-letter-${baseName}`)} className={btnOut} style={{ color: "#A7773F", borderColor: "#A7773F" }}><Download className="w-4 h-4" /> Word</button>
              <button onClick={() => navigator.clipboard?.writeText(letterDraft)} className="px-3.5 border border-border rounded-full text-muted-foreground" aria-label="Copy"><Copy className="w-4 h-4" /></button>
            </div>
          </>
        )}
      </div>
      {error && <p className="text-xs text-[#8F5F65]">{error}</p>}
    </div>
  );
}
