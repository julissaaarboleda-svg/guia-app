import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, Upload, X, Copy, Mail, Check, FileText, Trash2, ExternalLink, ShieldAlert, Loader2, Scale, Layers, PieChart, CalendarX, CreditCard, AlertCircle, ArrowRight, TrendingDown, Clock, RefreshCw } from "lucide-react";
import { base44, getAiUsage } from "@/api/base44Client";
import { ent } from "@/lib/freshEntities";
import { analyze, stepsFor, letterFor, LETTER_TITLE, progress, DOC_LABEL, niceDate, OUTCOMES, WIN, isOverdue, sentDue, noReplySteps, replySteps, followUpLetter, deadlineNudges, mergeParts, overview, money, BUREAU_LETTERS, BUREAUS, BUREAU_SHORT, bureauAddress, bureauKey, CHECKLIST, RIGHTS, uspsTrack, changes, staleReports } from "@/lib/credit";

const MAX_FILES = 10;
const PAGES_PER_PART = 1;
const PARALLEL = 4;

// Split a long PDF into small PDFs so each one reads well within the server's time limit.
// A locked (encrypted) PDF can't be split cleanly, so it's sent whole and flagged.
async function splitPdf(file) {
  if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) return [file];
  try {
    const { PDFDocument } = await import("pdf-lib");
    const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
    const n = src.getPageCount();
    if (src.isEncrypted) return Object.assign([file], { locked: true });
    if (n <= PAGES_PER_PART) return [file];
    const out = [];
    for (let i = 0; i < n; i += PAGES_PER_PART) {
      const doc = await PDFDocument.create();
      const pages = await doc.copyPages(src, Array.from({ length: Math.min(PAGES_PER_PART, n - i) }, (_, k) => i + k));
      pages.forEach((p) => doc.addPage(p));
      out.push(new File([await doc.save()], `${file.name.replace(/\.pdf$/i, "")}-p${i + 1}.pdf`, { type: "application/pdf" }));
    }
    return out;
  } catch { return [file]; }
}

// Fingerprint of a file's bytes, to skip uploading the exact same file twice.
async function fileHash(file) {
  try {
    const buf = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch { return ""; }
}

// Docs that look like copies of each other (same bureau, date and accounts), for older uploads without a fingerprint.
const docSig = (d) => [d.doc_type, (d.bureaus && d.bureaus.length ? [...d.bureaus].sort().join("+") : d.bureau), d.doc_date, (d.accounts || []).length, (d.accounts || []).map((a) => a.creditor).sort().join(",")].join("|");

// Run tasks a few at a time.
async function pool(tasks, size) {
  const results = new Array(tasks.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, tasks.length) }, async () => {
    while (next < tasks.length) { const i = next++; results[i] = await tasks[i](); }
  }));
  return results;
}
const todayStr = () => new Date().toISOString().slice(0, 10);
const plus30 = () => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); };
const FOLLOW_TYPES = new Set(["followup", "unverified", "mov"]);

function StepRow({ s, i, done, onToggle, onLetter, onTodo, bureaus = [], missing = [], sentTo = [] }) {
  return (
    <div className="flex gap-2.5">
      <button onClick={onToggle} aria-label="Done"
        className={`w-5 h-5 rounded-full border shrink-0 mt-0.5 flex items-center justify-center ${done ? "bg-[#7D8A53] border-[#7D8A53]" : "border-border"}`}>
        {done ? <Check className="w-3 h-3 text-white" /> : <span className="text-[10px] text-muted-foreground">{i + 1}</span>}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm text-foreground ${done ? "line-through opacity-60" : ""}`}>{s.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{s.body}</p>
        {s.tips && s.tips.length > 0 && !done && (
          <div className="mt-1.5 rounded-lg bg-secondary/70 px-2.5 py-1.5 space-y-0.5">
            {s.tips.map((t, k) => <p key={k} className="text-[11px] text-foreground"><span className={`font-medium ${t.ok ? "text-[#566033]" : "text-[#8F5F65]"}`}>{t.ok ? "Do" : "Don't"}</span> {t.text}</p>)}
          </div>
        )}
        <div className="flex flex-wrap gap-3 mt-1">
          {s.letter && BUREAU_LETTERS.has(s.letter) && bureaus.length > 0 ? (
            <>
              {bureaus.map((b) => (
                <button key={b} onClick={() => onLetter(s.letter, b)} className="text-xs font-medium text-[#8B6B3E] border border-border rounded-full px-2.5 py-0.5 inline-flex items-center gap-1">
                  {sentTo.includes(b) && <Check className="w-3 h-3 text-[#566033]" />}{b} letter
                </button>
              ))}
              {missing.map((b) => <span key={b} className="text-[11px] text-muted-foreground border border-dashed border-border rounded-full px-2.5 py-0.5">{b} · upload its report to check</span>)}
            </>
          ) : s.letter ? <button onClick={() => onLetter(s.letter)} className="text-xs text-[#8B6B3E] font-medium">Draft letter</button> : null}
          {s.link && <a href={s.link} target="_blank" rel="noreferrer" className="text-xs text-[#8B6B3E] font-medium inline-flex items-center gap-1">Open <ExternalLink className="w-3 h-3" /></a>}
          {onTodo && <button onClick={onTodo} className="text-xs text-muted-foreground">Add to-do</button>}
        </div>
      </div>
    </div>
  );
}

// Guía's own inferences (not facts printed on a report) are labeled "Check this".
const isFlag = (i) => i.kind === "mismatch" || i.kind === "breach" || i.kind === "sold" || (i.kind === "collection" && !!i.twin);
const STATUS_WORD = { open: "open", closed: "closed", paid: "paid", charged_off: "charged off", collection: "collection", sold: "sold or transferred" };
function reportFacts(i) {
  const a = i.account;
  if (!a) return i.inquiry ? `Hard inquiry by ${i.inquiry.creditor} on ${niceDate(i.inquiry.date)}` : "";
  const bal = a.amount_requested || a.balance;
  return [STATUS_WORD[a.status] || a.kind?.replace("_", " ") || "", bal != null ? money(bal) : "", a.opened ? `opened ${niceDate(a.opened)}` : "", a.bureaus.length ? `on ${a.bureaus.join(" and ")}` : ""].filter(Boolean).join(" · ");
}
const KIND_TONE = {
  pastdue: "bg-[#F3E6E8] text-[#8F5F65]",
  overlimit: "bg-[#F3E6E8] text-[#8F5F65]",
  sold: "bg-[#F3E6E8] text-[#8F5F65]",
  info: "bg-secondary text-muted-foreground",
  mismatch: "bg-[#F3E6E8] text-[#8F5F65]",
  breach: "bg-[#F3E6E8] text-[#8F5F65]",
  collection: "bg-[#F0E6D6] text-[#8B6B3E]",
  late: "bg-[#F0E6D6] text-[#8B6B3E]",
  utilization: "bg-[#E9EDDD] text-[#566033]",
};

function Section({ id, title, count, children, defaultOpen = true }) {
  const key = `guia-credit-shut-${id}`;
  const [open, setOpen] = useState(() => { try { const v = localStorage.getItem(key); return v == null ? defaultOpen : v !== "1"; } catch { return defaultOpen; } });
  const toggle = () => { setOpen((o) => { try { localStorage.setItem(key, o ? "1" : "0"); } catch { /* ignore */ } return !o; }); };
  return (
    <div className="bg-card border border-border rounded-2xl">
      <button onClick={toggle} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <span className="font-heading text-base text-foreground">{title}{count != null && <span className="ml-2 text-xs font-body text-muted-foreground">{count}</span>}</span>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function Note() {
  return <p className="text-[11px] text-muted-foreground leading-snug">Information, not legal or financial advice. Guía drafts letters; you review and send them. Only dispute what you believe is wrong.</p>;
}


// Your name and return address for letters. Kept on this device only, never sent to Guía's server.
const SENDER_KEY = "guia-letter-sender";
function useSender() {
  const [sender, setSender] = useState(() => { try { return JSON.parse(localStorage.getItem(SENDER_KEY)) || {}; } catch { return {}; } });
  const save = (v) => { setSender(v); try { localStorage.setItem(SENDER_KEY, JSON.stringify(v)); } catch { /* ignore */ } };
  return [sender, save];
}

function LetterSheet({ letter, onClose, onSent }) {
  const [sender, setSender] = useSender();
  const [editingFrom, setEditingFrom] = useState(!sender.name);
  const [draft, setDraft] = useState({ name: sender.name || "", address: sender.address || "" });
  const [edited, setEdited] = useState(false);
  const [text, setText] = useState(() => letter.build(sender));
  const [to, setTo] = useState(letter.to || "");
  const [tracking, setTracking] = useState("");
  const [checked, setChecked] = useState({});
  const list = CHECKLIST[letter.type] || [];
  const [copied, setCopied] = useState(false);
  const saveFrom = () => {
    const v = { name: draft.name.trim(), address: draft.address.trim() };
    setSender(v); setEditingFrom(false);
    if (!edited) setText(letter.build(v));
  };
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ } };
  const mail = `mailto:?subject=${encodeURIComponent(letter.title)}&body=${encodeURIComponent(text)}`;
  const missingTo = /\[Mailing address|\[Bureau dispute address/.test(text);
  const inputCls = "w-full bg-secondary border border-input rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-ring";
  return createPortal(
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-background w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h3 className="font-heading text-lg text-foreground">{letter.title}{letter.bureau ? ` · ${letter.bureau}` : ""}</h3>
          <button onClick={onClose} aria-label="Close" className="p-1 text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-5 overflow-y-auto flex-1 space-y-3 pb-3">
          <div className="rounded-xl bg-card border border-border p-3">
            {editingFrom ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">Your name and return address</p>
                <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Full name" className={inputCls} />
                <input value={draft.address} onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))} placeholder="Street, city, state, ZIP" className={inputCls} />
                <div className="flex items-center gap-3">
                  <button onClick={saveFrom} className="bg-foreground text-background rounded-lg px-3 py-1.5 text-xs font-medium">Use in my letters</button>
                  <span className="text-[11px] text-muted-foreground">Saved on this device only.</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground flex-1 min-w-0 truncate">From: <span className="text-foreground">{sender.name}</span>{sender.address ? ` · ${sender.address}` : ""}</p>
                <button onClick={() => setEditingFrom(true)} className="text-xs text-[#8B6B3E] shrink-0">Edit</button>
              </div>
            )}
          </div>
          {letter.addrSource === "standard" && <p className="text-[11px] rounded-lg bg-[#F0E6D6] text-[#6E5430] px-3 py-2">Uses {letter.bureau}'s standard dispute address. These change now and then, so confirm it on {letter.bureau}'s website before mailing.</p>}
          {missingTo && <p className="text-[11px] rounded-lg bg-[#F3E6E8] text-[#6E4A4F] px-3 py-2">Their mailing address wasn't in your documents. Copy it from their letter or your report, or use Re-read in Your credit file.</p>}
          <p className="text-xs text-muted-foreground">Fill in anything in [brackets], read it over, then send it yourself. Certified mail with return receipt gives you proof it arrived.</p>
          <textarea value={text} onChange={(e) => { setText(e.target.value); setEdited(true); }} rows={16}
            className="w-full sm:min-h-[460px] bg-card border border-input rounded-xl p-3 text-[13px] leading-relaxed font-body text-foreground outline-none focus:border-ring" />
          <div className="flex gap-2">
            <button onClick={copy} className="flex-1 flex items-center justify-center gap-1.5 border border-border rounded-xl py-2.5 text-sm text-foreground">{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copied ? "Copied" : "Copy"}</button>
            <a href={mail} className="flex-1 flex items-center justify-center gap-1.5 border border-border rounded-xl py-2.5 text-sm text-foreground"><Mail className="w-4 h-4" />Email to myself</a>
          </div>
          {list.length > 0 && (
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#8B6B3E] mb-1.5">Before you mail · {list.filter((_, k) => checked[k]).length} of {list.length}</p>
              <div className="space-y-1">
                {list.map((t, k) => (
                  <button key={k} onClick={() => setChecked((c) => ({ ...c, [k]: !c[k] }))} className="w-full flex items-start gap-2 text-left">
                    <span className={`w-4 h-4 rounded mt-0.5 shrink-0 flex items-center justify-center border ${checked[k] ? "bg-[#7D8A53] border-[#7D8A53]" : "border-border"}`}>{checked[k] && <Check className="w-3 h-3 text-white" />}</span>
                    <span className={`text-[13px] ${checked[k] ? "text-muted-foreground line-through" : "text-foreground"}`}>{t}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="border-t border-border pt-3 space-y-2">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Sent to</label>
              <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="e.g., Midland Credit, Experian" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Certified mail tracking number <span className="font-normal text-muted-foreground">(optional)</span></label>
              <input value={tracking} onChange={(e) => setTracking(e.target.value)} inputMode="numeric" placeholder="9407 1118 …" className={inputCls} />
            </div>
            <button onClick={() => onSent(to || letter.to || "", tracking.trim())} className="w-full bg-foreground text-background rounded-xl py-2.5 text-sm font-medium">Mark as mailed</button>
            <p className="text-[11px] text-muted-foreground">You'll get a reminder 30 days out. Add the delivery date later to count from when they received it.</p>
          </div>
          <Note />
        </div>
      </div>
    </div>,
    document.body
  );
}

function CallLog({ calls, onAdd, onRemove }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ date: todayStr(), dir: "out", who: "", note: "" });
  const inputCls = "w-full bg-secondary border border-input rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-ring";
  const save = async () => {
    if (!f.note.trim() && !f.who.trim()) return;
    await onAdd({ date: f.date || todayStr(), dir: f.dir, who: f.who.trim(), note: f.note.trim() });
    setF({ date: todayStr(), dir: "out", who: "", note: "" }); setOpen(false);
  };
  return (
    <div className="border-t border-border pt-2.5 mt-1">
      <div className="flex items-center">
        <p className="text-xs font-medium text-foreground flex-1">Calls and notes{calls.length ? <span className="text-muted-foreground font-normal"> · {calls.length}</span> : ""}</p>
        {!open && <button onClick={() => setOpen(true)} className="text-xs text-[#A7773F]">+ Log a call</button>}
      </div>
      {open && (
        <div className="mt-2 space-y-2 rounded-xl bg-secondary/50 p-2.5">
          <div className="flex gap-1.5">
            {[["out", "I called"], ["in", "They called"], ["note", "Note"]].map(([v, l]) => (
              <button key={v} onClick={() => setF((x) => ({ ...x, dir: v }))} className={`flex-1 rounded-lg py-1.5 text-xs border ${f.dir === v ? "bg-foreground text-background border-foreground" : "border-border text-foreground bg-card"}`}>{l}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="date" value={f.date} max={todayStr()} onChange={(e) => setF((x) => ({ ...x, date: e.target.value }))} className={`${inputCls} w-[150px]`} />
            {f.dir !== "note" && <input value={f.who} onChange={(e) => setF((x) => ({ ...x, who: e.target.value }))} placeholder="Who you spoke with" className={inputCls} />}
          </div>
          <textarea value={f.note} onChange={(e) => setF((x) => ({ ...x, note: e.target.value }))} rows={2} placeholder="What was said or agreed" className={`${inputCls} resize-none`} />
          <div className="flex gap-2">
            <button onClick={save} className="flex-1 bg-foreground text-background rounded-lg py-2 text-xs font-medium">Save</button>
            <button onClick={() => setOpen(false)} className="px-3 text-xs text-muted-foreground">Cancel</button>
          </div>
          <p className="text-[11px] text-muted-foreground">Tip: ask for anything they promise in writing.</p>
        </div>
      )}
      {calls.map((c, i) => (
        <div key={i} className="flex items-start gap-2 py-1.5 border-b border-border/60 last:border-0">
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-foreground">{c.note || "(no notes)"}</p>
            <p className="text-[11px] text-muted-foreground">{niceDate(c.date)} · {c.dir === "in" ? "they called" : c.dir === "note" ? "note" : "I called"}{c.who ? ` · ${c.who}` : ""}</p>
          </div>
          <button onClick={() => onRemove(i)} aria-label="Remove" className="p-1 text-muted-foreground/60"><Trash2 className="w-3 h-3" /></button>
        </div>
      ))}
    </div>
  );
}

function RightsSheet({ onClose }) {
  const [open, setOpen] = useState(0);
  return createPortal(
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-background w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl max-h-[88vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h3 className="font-heading text-xl text-foreground">Know your rights</h3>
          <button onClick={onClose} aria-label="Close" className="p-1 text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-5 pb-5 overflow-y-auto">
          {RIGHTS.map((r, i) => (
            <div key={i} className="border-b border-border last:border-0">
              <button onClick={() => setOpen(open === i ? -1 : i)} className="w-full flex items-center gap-2 py-3 text-left">
                <span className="flex-1 text-sm text-foreground">{r.title}</span>
                {open === i ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              </button>
              {open === i && (
                <ul className="pb-3 space-y-1.5">
                  {r.points.map((p, k) => <li key={k} className="text-[13px] text-foreground leading-relaxed flex gap-2"><span className="text-[#A7773F]">•</span><span>{p}</span></li>)}
                </ul>
              )}
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground mt-3">General information about US consumer rules, not legal advice. Rules vary by state; for a specific situation, talk to a consumer attorney or legal aid.</p>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Add or update one bureau's score, with that bureau already picked.
function ScoreSheet({ bureau, history, onSave, onDelete, onClose }) {
  const [score, setScore] = useState("");
  const [source, setSource] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const inputCls = "w-full bg-secondary border border-input rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:border-ring";
  const save = async () => {
    const v = Number(score);
    if (!(v >= 300 && v <= 900)) { setErr("Enter a score between 300 and 900."); return; }
    setBusy(true);
    try { await onSave({ bureau, score: v, source: source.trim() }); onClose(); } catch { setErr("Couldn't save. Try again."); setBusy(false); }
  };
  return createPortal(
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-background w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-lg text-foreground">{history.length ? "Update" : "Add"} {bureau} score</h3>
          <button onClick={onClose} aria-label="Close" className="p-1 text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Score</label>
          <input value={score} onChange={(e) => { setScore(e.target.value.replace(/\D/g, "").slice(0, 3)); setErr(""); }} inputMode="numeric" placeholder="e.g., 574" className={inputCls} autoFocus />
          {err && <p className="text-xs text-[#A3423A] mt-1">{err}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Where you saw it <span className="font-normal text-muted-foreground">(optional)</span></label>
          <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g., SoFi, Capital One CreditWise, Experian app" className={inputCls} />
          <p className="text-[11px] text-muted-foreground mt-1">Scores differ by app and scoring model. Use the same source each time so the changes mean something.</p>
        </div>
        <button onClick={save} disabled={busy} className="w-full bg-foreground text-background rounded-xl py-2.5 text-sm font-medium disabled:opacity-60">Save score</button>
        {history.length > 0 && (
          <div className="border-t border-border pt-3">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-1.5">History</p>
            <div className="flex flex-wrap gap-1.5">
              {[...history].reverse().slice(0, 8).map((h, i) => <span key={i} className="text-xs rounded-full bg-secondary px-2.5 py-1 text-foreground">{h.score} <span className="text-muted-foreground">· {niceDate(h.date).replace(/, \d{4}$/, "")}</span></span>)}
            </div>
            <button onClick={async () => { if (window.confirm(`Remove all ${bureau} scores you've added?`)) { await onDelete(bureau); onClose(); } }} className="mt-3 text-xs text-muted-foreground underline underline-offset-2">Remove {bureau} scores</button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default function CreditAssistant({ scoreItems = [], onSaveScore, onDeleteScore }) {
  const [docs, setDocs] = useState([]);
  const [caseRec, setCaseRec] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState([]); // [{name, status}]
  const [openItem, setOpenItem] = useState(null);
  const [filter, setFilter] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const [showUploads, setShowUploads] = useState(false);
  const [comingAll, setComingAll] = useState(false);
  const [rightsOpen, setRightsOpen] = useState(false);
  const [scoreFor, setScoreFor] = useState(null);
  const [chartB, setChartB] = useState(null);
  const [rereadId, setRereadId] = useState(null);
  const [rereading, setRereading] = useState(null);
  const rereadRef = useRef(null);
  const [letter, setLetter] = useState(null);
  const [toast, setToast] = useState("");
  const [usage, setUsage] = useState(null);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => { getAiUsage().then(setUsage).catch(() => {}); }, []);
  // Plus feature: free accounts can see what they already uploaded but can't add more (only once limits are on).
  const locked = blocked || !!(usage && usage.enforced && usage.plan === "free");
  const fileRef = useRef(null);

  const load = async () => {
    try {
      const [d, c] = await Promise.all([ent.CreditDoc.list("-created_date"), ent.CreditCase.list()]);
      setDocs(d || []);
      setCaseRec((c && c[0]) || null);
    } catch { /* ignore */ }
    setLoaded(true);
  };
  useEffect(() => { load(); }, []);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 2500); };

  const saveCase = async (patch) => {
    const next = { decisions: {}, scores: [], ...(caseRec || {}), ...patch };
    setCaseRec(next);
    if (caseRec?.id) await ent.CreditCase.update(caseRec.id, patch);
    else { const rec = await ent.CreditCase.create(next); setCaseRec(rec); }
  };
  const decide = (key, patch) => {
    const decisions = { ...((caseRec && caseRec.decisions) || {}) };
    decisions[key] = { ...(decisions[key] || {}), ...patch };
    return saveCase({ decisions });
  };

  // Reads one file, page by page for long PDFs, and returns the merged document.
  const readFile = async (file, onNote) => {
    const pieces = await splitPdf(file);
    let done = 0, lastErr = "";
    onNote(pieces.length > 1 ? `Reading ${pieces.length} parts…` : "Reading…");
    const parts = await pool(pieces.map((piece, k) => async () => {
      try {
        const res = await base44.integrations.Core.ImportFinanceFile({ file: piece, mode: "credit", part: k, parts: pieces.length });
        return (res && res.doc) || null; // a 5xx (e.g. a slow page) is already retried once by the client
      } catch (err) {
        lastErr = String((err && err.message) || "");
        if (/Plus/.test(lastErr)) setBlocked(true);
        return null;
      } finally {
        done += 1;
        if (pieces.length > 1) onNote(`Read ${done} of ${pieces.length} parts`);
      }
    }), PARALLEL);
    return { doc: mergeParts(parts), missed: parts.filter((x) => !x).length, pieces, lastErr };
  };

  // Re-read one document (the person picks the file again) and replace what was saved.
  const onReread = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    const id = rereadId;
    if (!file || !id) return;
    setRereading(id);
    try {
      const hash = await fileHash(file);
      const { doc, missed, pieces, lastErr } = await readFile(file, () => {});
      if (!doc) { flash(lastErr || "Couldn't read that file."); return; }
      const patch = { ...doc, filename: file.name, file_hash: hash || null, pages: pieces.length };
      await ent.CreditDoc.update(id, patch);
      setDocs((d) => d.map((x) => (x.id === id ? { ...x, ...patch } : x)));
      flash(missed ? `Re-read, but ${missed} of ${pieces.length} parts were skipped.` : "Re-read. Letters now use the new details.");
    } catch { flash("Couldn't re-read that file."); }
    finally { setRereading(null); setRereadId(null); }
  };

  const onFiles = async (e) => {
    const picked = [...(e.target.files || [])].slice(0, MAX_FILES);
    e.target.value = "";
    if (!picked.length) return;
    setShowUploads(false);
    setBusy(picked.map((f) => ({ name: f.name, status: "reading", note: "Preparing…" })));
    const update = (i, patch) => setBusy((b) => b.map((x, j) => (j === i ? { ...x, ...patch } : x)));
    const saved = [];
    let failed = 0;
    const known = new Set(docs.map((d) => d.file_hash).filter(Boolean));
    for (let i = 0; i < picked.length; i++) {
      const file = picked[i];
      const hash = await fileHash(file);
      if (hash && known.has(hash)) { update(i, { status: "done", note: "Already in your credit file · skipped, no AI used" }); continue; }
      if (hash) known.add(hash);
      const { doc, missed, pieces, lastErr } = await readFile(file, (note) => update(i, { note }));
      const lockedTip = "This PDF is locked. Open it, choose Print → Save as PDF, and upload the new copy.";
      if (!doc) { failed += 1; update(i, { status: "failed", note: pieces.locked ? lockedTip : lastErr || "Couldn't read this file." }); continue; }
      try {
        const rec = await ent.CreditDoc.create({ ...doc, filename: file.name, file_hash: hash || null, pages: pieces.length });
        saved.push(rec);
        update(i, { status: "done", type: doc.doc_type, note: missed ? `Read, but ${missed} of ${pieces.length} parts were skipped. Re-upload to fill gaps.` : "" });
      } catch {
        failed += 1; update(i, { status: "failed", note: "Read, but couldn't save. Try again." });
      }
    }
    setDocs((d) => [...saved, ...d]);
    flash(failed ? `Read ${saved.length} of ${picked.length}. See the note on each file.` : `Read ${saved.length} ${saved.length === 1 ? "document" : "documents"}.`);
    if (!failed) setTimeout(() => setBusy((b) => (b.some((x) => x.status !== "done" || x.note) ? b : [])), 2500);
  };

  // Copies: same file fingerprint, same file name apart from " (2)", or same contents. Keep the most complete one.
  const copies = useMemo(() => {
    const base = (d) => `${d.doc_type}|${String(d.filename || "").toLowerCase().replace(/\s*\(\d+\)(?=\.\w+$)/, "")}`;
    const groups = {};
    docs.forEach((d) => {
      // A real copy: the same file, or the same name AND the same bureau and report date. Reports from
      // different bureaus (or months) with similar names are kept, even if they list the same accounts.
      const key = [d.file_hash && `h:${d.file_hash}`, d.filename && `f:${base(d)}|${(d.bureaus && d.bureaus.length ? [...d.bureaus].sort().join("+") : d.bureau) || ""}|${d.doc_date || ""}`, `s:${docSig(d)}`].filter(Boolean);
      const hit = Object.keys(groups).find((g) => groups[g].keys.some((k) => key.includes(k)));
      if (hit) { groups[hit].docs.push(d); key.forEach((k) => { if (!groups[hit].keys.includes(k)) groups[hit].keys.push(k); }); }
      else groups[d.id] = { keys: key, docs: [d] };
    });
    return Object.values(groups).flatMap((g) => {
      if (g.docs.length < 2) return [];
      const keep = [...g.docs].sort((x, y) => (y.accounts || []).length - (x.accounts || []).length)[0];
      return g.docs.filter((d) => d !== keep);
    });
  }, [docs]);
  const copyIds = new Set(copies.map((c) => c.id));
  const removeCopies = async () => {
    const ids = new Set(copies.map((c) => c.id));
    setDocs((x) => x.filter((y) => !ids.has(y.id)));
    await Promise.all(copies.map((c) => ent.CreditDoc.delete(c.id).catch(() => {})));
    flash(`Removed ${ids.size} ${ids.size === 1 ? "copy" : "copies"}.`);
  };

  const removeDoc = async (d) => {
    setDocs((x) => x.filter((y) => y.id !== d.id));
    await ent.CreditDoc.delete(d.id);
  };

  const extraScores = useMemo(() => scoreItems.flatMap((it) => (Array.isArray(it.score_history) && it.score_history.length ? it.score_history : it.score ? [{ score: it.score, date: (it.score_updated || it.created_date || todayStr()).slice(0, 10) }] : []).map((h) => ({ ...h, bureau: it.bureau || it.name }))), [scoreItems]);
  const caseForCalc = useMemo(() => ({ ...(caseRec || {}), scores: [...((caseRec && caseRec.scores) || []), ...extraScores] }), [caseRec, extraScores]);
  const { items, breach, reportBureaus } = useMemo(() => analyze(docs, caseRec || {}), [docs, caseRec]);
  // Which bureaus a letter should go to for an item, and which bureaus we can't check yet.
  const bureausFor = (item, type) => {
    if (type === "block") return reportBureaus.length ? reportBureaus : BUREAUS;
    if (item.kind === "mismatch" && item.account) return item.account.bureaus.length ? item.account.bureaus : [item.badReport?.bureau].filter(Boolean);
    return (item.account && item.account.bureaus) || [];
  };
  const missingBureaus = BUREAUS.filter((b) => !reportBureaus.includes(b));
  const prog = useMemo(() => progress(docs, caseForCalc), [docs, caseForCalc]);
  const notMine = items.filter((i) => i.kind === "breach" && i.owner === "not_mine");
  const ov = useMemo(() => (docs.length ? overview(docs, caseForCalc) : null), [docs, caseForCalc]);
  const FILTERS = [
    ["all", "All", () => true],
    ["pastdue", "Past due", (i) => i.kind === "pastdue"],
    ["overlimit", "Over limit", (i) => i.kind === "overlimit"],
    ["check", "Check this", (i) => isFlag(i)],
    ["collection", "Collections", (i) => i.kind === "collection"],
    ["late", "Late", (i) => i.kind === "late"],
    ["utilization", "Balances", (i) => i.kind === "utilization"],
    ["info", "Your info", (i) => i.kind === "info"],

  ];
  const fItems = items.filter((FILTERS.find(([k]) => k === filter) || FILTERS[0])[2]);
  const shown = showAll ? fItems : fItems.slice(0, 6);
  const diffs = useMemo(() => changes(docs, caseRec || {}), [docs, caseRec]);
  const freshDiffs = diffs.filter((d) => !((caseRec && caseRec.changesSeen) || {})[d.key]);
  const stale = useMemo(() => staleReports(docs), [docs]);
  // Plan steps that existed before but have no items left now are done (e.g. after a new report).
  const planSeen = (caseRec && caseRec.planSeen) || {};
  const livePlan = ov && !ov.upkeep ? ov.plan : [];
  const goneSteps = Object.entries(planSeen).filter(([f, v]) => v && !livePlan.some((p) => p.filter === f)).map(([f, v]) => ({ filter: f, title: v.title, doneOn: v.doneOn }));
  // Journey chart follows one bureau at a time: scores from different bureaus and apps don't compare.
  const scoreBureaus = [...new Set(prog.scores.map((x) => bureauKey(x.bureau || "") || "Other"))];
  const defaultChartB = [...scoreBureaus].sort((a, b) => {
    const pa = prog.scores.filter((x) => (bureauKey(x.bureau || "") || "Other") === a), pb = prog.scores.filter((x) => (bureauKey(x.bureau || "") || "Other") === b);
    return pb.length - pa.length || String(pb[pb.length - 1]?.date).localeCompare(String(pa[pa.length - 1]?.date));
  })[0];
  const curChartB = scoreBureaus.includes(chartB) ? chartB : defaultChartB;
  const chartScores = prog.scores.filter((x) => (bureauKey(x.bureau || "") || "Other") === curChartB)
    .filter((x, i, arr) => arr.findIndex((y) => y.date === x.date) === i);
  const planDone = (caseRec && caseRec.planDone) || {};
  const isPlanDone = (p) => !!planDone[p.filter];
  const planDoneCount = (ov ? ov.plan.filter(isPlanDone).length : 0) + goneSteps.length;
  const planTotal = (ov ? ov.plan.length : 0) + goneSteps.length;
  const togglePlan = (p) => saveCase({ planDone: { ...planDone, [p.filter]: !planDone[p.filter] } });
  const planSig = livePlan.map((p) => p.filter).join(",") + "|" + goneSteps.filter((g) => !g.doneOn).map((g) => g.filter).join(",");
  useEffect(() => {
    if (!loaded || !ov || ov.upkeep || !docs.length) return;
    const next = { ...planSeen };
    let changed = false;
    livePlan.forEach((p) => { if (!next[p.filter] || next[p.filter].doneOn) { next[p.filter] = { title: p.title }; changed = true; } });
    goneSteps.forEach((g) => { if (!g.doneOn) { next[g.filter] = { title: g.title, doneOn: todayStr() }; changed = true; } });
    if (changed) saveCase({ planSeen: next });
  }, [planSig, loaded]);
  const openStep = (p) => {
    if (p.upkeep) return;
    setFilter(["mismatch", "breach", "sold", "twice"].includes(p.filter) ? "check" : (p.filter || "all")); setShowAll(true); setOpenItem(p.keys && p.keys[0]);
    setTimeout(() => { const el = document.getElementById(`ci-${p.keys && p.keys[0]}`); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); }, 50);
  };

  const openLetter = (type, item, sent, bureau) => {
    const a = item.account || {};
    const bureauBound = BUREAU_LETTERS.has(type);
    const bk = bureauBound ? (bureau || bureausFor(item, type)[0] || "") : "";
    const to = type === "followup" && sent ? sent.to : bureauBound ? bk : (a.creditor || item.inquiry?.creditor || "");
    const ctx = { docs, bureau: bk || undefined, items: type === "block" ? notMine : undefined };
    const build = (sender) => (FOLLOW_TYPES.has(type) ? followUpLetter(type, item, sent, { ...ctx, sender }) : letterFor(type, item, { ...ctx, sender }));
    const ad = bk ? bureauAddress(bk, docs) : null;
    setLetter({ type, item, to, bureau: bk || "", addrSource: ad ? ad.source : "", title: LETTER_TITLE[type], build });
  };

  const logReply = async (item, idx, outcome) => {
    const sent = [...((caseRec?.decisions?.[item.key]?.sent) || [])];
    const s = sent[idx];
    sent[idx] = { ...s, reply: { outcome, date: todayStr() } };
    const patch = { sent };
    const label = (OUTCOMES[s.type] || []).find(([v]) => v === outcome)?.[1] || outcome;
    if (WIN.has(outcome)) patch.resolved = { date: todayStr(), text: `${item.account?.creditor || item.inquiry?.creditor || "Item"}: ${label.toLowerCase()}` };
    await decide(item.key, patch);
    if (s.taskId) { try { await ent.Task.update(s.taskId, { completed: true }); } catch { /* ignore */ } }
    flash(WIN.has(outcome) ? "Nice. Added to your wins." : "Saved. Next steps updated.");
  };

  // A heads-up a week before deadlines like the 30-day window to ask for proof.
  const nudgeRun = useRef(false);
  useEffect(() => {
    if (!loaded || nudgeRun.current || !docs.length) return;
    const todo = deadlineNudges(items, caseRec || {});
    if (!todo.length) return;
    nudgeRun.current = true;
    (async () => {
      for (const n of todo) {
        try { await ent.Task.create({ title: `Reply by ${niceDate(n.item.deadline)}: ask ${n.item.account?.creditor || "them"} to prove the debt`, notes: "From the credit assistant. Sending it within 30 days of their letter pauses collection until they send proof.", priority: "high", due_date: n.due, completed: false, source: "credit" }); } catch { /* ignore */ }
      }
      await saveCase({ nudged: [...((caseRec && caseRec.nudged) || []), ...todo.map((n) => n.id)] });
    })();
  }, [loaded, items]);

  const overdue = items.flatMap((it) => ((caseRec?.decisions?.[it.key]?.sent) || []).filter(isOverdue).map(() => it));

  const markSent = async (to, tracking) => {
    const { type, item } = letter;
    const prev = (caseRec?.decisions?.[item.key]?.sent) || [];
    let taskId = null;
    try { const t = await ent.Task.create({ title: `Check for a reply: ${LETTER_TITLE[type]}${to ? ` (${to})` : ""}`, notes: "From the credit assistant. Open Finance → Credit Scores to log their reply, or see next steps if there's none.", priority: "medium", due_date: plus30(), completed: false, source: "credit" }); taskId = t?.id || null; } catch { /* ignore */ }
    await decide(item.key, { sent: [...prev, { type, to, date: todayStr(), taskId, tracking: tracking || "" }] });
    setLetter(null);
    flash("Marked as mailed. A reminder is set for 30 days.");
  };

  const setDelivered = async (item, idx, date) => {
    const sent = [...((caseRec?.decisions?.[item.key]?.sent) || [])];
    const sn = { ...sent[idx], delivered: date || null };
    sent[idx] = sn;
    await decide(item.key, { sent });
    if (sn.taskId) { try { await ent.Task.update(sn.taskId, { due_date: sentDue(sn) }); } catch { /* ignore */ } }
    if (date) flash(`Delivered ${niceDate(date)}. Reply due ${niceDate(sentDue(sn))}.`);
  };
  const addCall = (item, call) => {
    const calls = [call, ...((caseRec?.decisions?.[item.key]?.calls) || [])];
    return decide(item.key, { calls });
  };
  const removeCall = (item, idx) => {
    const calls = [...((caseRec?.decisions?.[item.key]?.calls) || [])];
    calls.splice(idx, 1);
    return decide(item.key, { calls });
  };

  const addTodo = async (step, item) => {
    try { await ent.Task.create({ title: `${step.title}: ${item.account?.creditor || item.inquiry?.creditor || "credit"}`, notes: step.body, priority: "medium", due_date: item.deadline || null, completed: false, source: "credit" }); flash("Added to your to-dos."); } catch { flash("Couldn't add that to-do."); }
  };

  const toggleStep = (item, id) => {
    const done = { ...((caseRec?.decisions?.[item.key]?.done) || {}) };
    done[id] = !done[id];
    decide(item.key, { done });
  };

  if (!loaded) return null;

  return (
    <div className="mb-4 space-y-3">
      {/* Credit assistant: slim bar with upload */}
      <div className="bg-card border border-border rounded-2xl px-3.5 py-2.5">
        <input ref={fileRef} type="file" multiple accept="application/pdf,.pdf,image/*,image/heic,image/heif,.heic,.heif" className="hidden" onChange={onFiles} />
        <input ref={rereadRef} type="file" accept="application/pdf,.pdf,image/*,image/heic,image/heif,.heic,.heif" className="hidden" onChange={onReread} />
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#F0E6D6] flex items-center justify-center shrink-0"><FileText className="w-4 h-4 text-[#8B6B3E]" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground whitespace-nowrap">Credit assistant {usage && <span className="ml-1 text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-[#F0E6D6] text-[#8B6B3E]">Plus</span>}</p>
            <p className="text-[11px] text-muted-foreground truncate">{docs.length ? `${docs.length - copies.length} ${docs.length - copies.length === 1 ? "document" : "documents"}${usage && usage.plan === "trial" ? " · in your trial" : ""}` : "Reports, collection letters, breach notices"}</p>
          </div>
          <button onClick={() => setRightsOpen(true)} className="shrink-0 text-xs text-[#8B6B3E] inline-flex items-center gap-1"><Scale className="w-3.5 h-3.5" /><span className="hidden sm:inline">Your rights</span><span className="sm:hidden">Rights</span></button>
          {!locked && (
            <button onClick={() => fileRef.current?.click()} disabled={busy.some((b) => b.status === "reading")}
              className="shrink-0 flex items-center gap-1.5 bg-foreground text-background rounded-full px-3.5 py-1.5 text-xs font-medium disabled:opacity-60">
              {busy.some((b) => b.status === "reading") ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Upload
            </button>
          )}
        </div>
        {locked && <p className="mt-2 text-xs rounded-lg bg-[#F3E8D6] text-[#6E5430] px-3 py-2">Part of Guía Plus. Upgrade to upload new documents; everything you've added stays, and you can still draft and track letters.</p>}
        {busy.length > 0 && !busy.some((b) => b.status === "reading") && !showUploads && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Check className="w-3.5 h-3.5 text-[#566033]" />
            <span className="flex-1">{busy.filter((b) => b.status === "done").length} of {busy.length} files read{busy.some((b) => b.status === "failed" || b.note) ? " · some notes" : ""}</span>
            <button onClick={() => setShowUploads(true)} className="text-[#8B6B3E]">Details</button>
            <button onClick={() => setBusy([])}>Dismiss</button>
          </div>
        )}
        {busy.length > 0 && (busy.some((b) => b.status === "reading") || showUploads) && (
          <div className="mt-2 space-y-1.5">
            {!busy.some((b) => b.status === "reading") && <button onClick={() => setShowUploads(false)} className="float-right text-[11px] text-muted-foreground">Hide</button>}
            {busy.map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                {b.status === "reading" ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : b.status === "done" ? <Check className="w-3.5 h-3.5 text-[#566033]" /> : <X className="w-3.5 h-3.5 text-[#8F5F65]" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-foreground">{b.name}{b.type ? ` · ${DOC_LABEL[b.type] || ""}` : ""}</span>
                  {b.note && <span className={`block ${b.status === "failed" ? "text-[#8F5F65]" : ""}`}>{b.note}</span>}
                </span>
              </div>
            ))}
          </div>
        )}
        {(!docs.length || busy.some((b) => b.status === "reading")) && <p className="text-[11px] text-muted-foreground mt-2">Up to {MAX_FILES} at a time. Files aren't kept: Guía saves only what it reads (names, dates, balances, last 4 digits, company addresses), never your SSN or full account numbers.</p>}
      </div>

      {stale.length > 0 && !locked && (
        <div className="bg-card border border-border rounded-2xl px-3.5 py-2.5 flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-[#F0E6D6] flex items-center justify-center shrink-0"><RefreshCw className="w-4 h-4 text-[#8B6B3E]" /></span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Time for a new {stale.map((x) => x.bureau).join(" and ")} report</p>
            <p className="text-[11px] text-muted-foreground">Your last one is from {niceDate(stale[0].date)}. Disputes are usually done by now. Free every week at AnnualCreditReport.com.</p>
          </div>
          <button onClick={() => fileRef.current?.click()} className="shrink-0 bg-foreground text-background rounded-full px-3 py-1.5 text-xs font-medium">Upload</button>
        </div>
      )}

      {freshDiffs.map((d) => (
        <div key={d.key} className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-baseline gap-2">
            <p className="font-heading text-lg text-foreground flex-1">What changed</p>
            <span className="text-[11px] text-muted-foreground">{d.bureau} · {niceDate(d.from).replace(/, \d{4}$/, "")} → {niceDate(d.to)}</span>
          </div>
          {d.score && (
            <div className="flex items-center gap-2.5 mt-2 rounded-xl bg-secondary/60 px-3 py-2">
              <span className="font-heading text-xl text-foreground">{d.score.from}</span><ArrowRight className="w-4 h-4 text-muted-foreground" /><span className="font-heading text-xl text-foreground">{d.score.to}</span>
              {d.score.delta !== 0 && <span className={`text-[11px] rounded-full px-2 py-0.5 ${d.score.delta > 0 ? "bg-[#E9EDDD] text-[#566033]" : "bg-[#F3E6E8] text-[#8F5F65]"}`}>{d.score.delta > 0 ? "+" : ""}{d.score.delta}</span>}
              <span className="ml-auto text-[11px] text-muted-foreground">Score</span>
            </div>
          )}
          {d.scoreList && d.scoreList.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5 mt-2">
              {d.scoreList.map((x) => (
                <div key={x.bureau} className="rounded-xl bg-secondary/60 px-2 py-1.5 text-center">
                  <p className="text-[10.5px] text-muted-foreground">{x.bureau}</p>
                  <p className="text-sm text-foreground">{x.from} → {x.to} {x.delta !== 0 && <span className={x.delta > 0 ? "text-[#566033]" : "text-[#8F5F65]"}>{x.delta > 0 ? "+" : ""}{x.delta}</span>}</p>
                </div>
              ))}
            </div>
          )}
          {[
            ["Removed", d.removed, "text-[#566033]", <Check key="i" className="w-3 h-3" />, "bg-[#7D8A53] text-white"],
            ["Improved", d.improved, "text-[#566033]", <TrendingDown key="i" className="w-3 h-3" />, "bg-[#E9EDDD] text-[#566033]"],
            ["Still there", d.still, "text-[#8B6B3E]", <Clock key="i" className="w-3 h-3" />, "bg-[#F0E6D6] text-[#8B6B3E]"],
            ["New", d.added, "text-[#8F5F65]", <AlertCircle key="i" className="w-3 h-3" />, "bg-[#F3E6E8] text-[#8F5F65]"],
          ].filter(([, list]) => list.length).map(([label, list, tone, icon, dot]) => (
            <div key={label}>
              <p className={`text-[10.5px] font-bold uppercase tracking-[0.14em] mt-3 mb-1 ${tone}`}>{label} · {list.length}</p>
              {list.map((x, i) => (
                <div key={i} className="flex items-start gap-2 py-1.5 border-b border-border/60 last:border-0">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${dot}`}>{icon}</span>
                  <span className="flex-1 min-w-0 text-[13px] text-foreground">{x.text}
                    {label === "Still there" && <span className="block text-[11px] text-muted-foreground">You disputed this. Open it for the next step, like asking how they verified it.</span>}
                    {label === "New" && <span className="block text-[11px] text-muted-foreground">{x.check ? "Did you apply? If not, it may not be yours." : "Not on your last report. Check that it's yours and accurate."}</span>}
                  </span>
                  {x.letter && <span className="text-[10px] text-[#566033] shrink-0 mt-0.5">your letter worked</span>}
                </div>
              ))}
            </div>
          ))}
          {!d.removed.length && !d.improved.length && !d.still.length && !d.added.length && <p className="text-sm text-muted-foreground mt-2">No changes to your accounts since the last {d.bureau} report.</p>}
          <div className="flex items-center gap-3 mt-3">
            <p className="text-[11px] text-muted-foreground flex-1">Compared with your {niceDate(d.from)} {d.bureau} report.{BUREAUS.filter((b) => b !== d.bureau).length ? ` Other bureaus aren't part of this comparison.` : ""}</p>
            <button onClick={() => saveCase({ changesSeen: { ...((caseRec && caseRec.changesSeen) || {}), [d.key]: todayStr() } })} className="text-xs text-[#8B6B3E] shrink-0">Got it</button>
          </div>
        </div>
      ))}

      {ov && (
        <div className="bg-card border border-border rounded-2xl p-4 lg:flex lg:gap-5">
          <div className="lg:flex-1 min-w-0">
            <div className="flex items-baseline">
              <p className="font-heading text-lg text-foreground flex-1">Credit overview</p>
              <span className="text-[11px] text-muted-foreground">{ov.latestReport?.doc_date ? niceDate(ov.latestReport.doc_date) : ""}</span>
            </div>
            {copies.length > 0 && <button onClick={removeCopies} className="text-xs text-[#8F5F65] font-medium">Remove {copies.length} duplicate {copies.length === 1 ? "upload" : "uploads"}</button>}
            <div className="grid grid-cols-3 mt-3 text-center">
              {BUREAUS.map((b, i) => {
                const sc = [...prog.scores].reverse().find((x) => bureauKey(x.bureau || "") === b);
                const has = reportBureaus.includes(b);
                const rate = sc && (sc.score >= 740 ? ["Very good", "bg-[#E9EDDD] text-[#566033]"] : sc.score >= 670 ? ["Good", "bg-[#E9EDDD] text-[#566033]"] : sc.score >= 580 ? ["Fair", "bg-[#F0E6D6] text-[#8B6B3E]"] : ["Poor", "bg-[#F3E6E8] text-[#8F5F65]"]);
                return (
                  <button key={b} onClick={() => onSaveScore && setScoreFor(b)} className={`text-center ${i ? "border-l border-border/70" : ""}`}>
                    <p className={`font-heading leading-none ${sc ? "text-[26px] text-foreground" : "text-xl text-muted-foreground"}`}>{sc ? sc.score : "—"}</p>
                    <p className="text-xs text-foreground mt-1.5">{b}</p>
                    {sc ? <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full ${rate[1]}`}>{rate[0]}</span>
                      : <span className="block text-[10.5px] text-[#A7773F] mt-1">+ Add score</span>}
                    <span className="block text-[10px] text-muted-foreground mt-1">{has ? "Report added" : "No report yet"}{sc ? " · update" : ""}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4 lg:mt-0 lg:w-[46%] shrink-0">
            {(() => {
              const u = ov.usage;
              const uTag = u == null ? null : u > 30 ? ["High", "bg-[#F3E6E8] text-[#8F5F65]"] : u > 10 ? ["OK", "bg-[#F0E6D6] text-[#8B6B3E]"] : ["Good", "bg-[#E9EDDD] text-[#566033]"];
              const tiles = [
                { icon: Layers, tone: "text-[#8F5F65]", big: `${ov.collections.count}${ov.collections.total ? ` · ${money(ov.collections.total)}` : ""}`, label: "Collections" },
                { icon: PieChart, tone: "text-[#8F5F65]", big: u == null ? "—" : `${u}%`, tag: uTag, label: "Card usage" },
                ov.pastDueCount > 0
                  ? { icon: AlertCircle, tone: "text-[#8F5F65]", big: `${ov.pastDueCount}${ov.pastDueTotal ? ` · ${money(ov.pastDueTotal)}` : ""}`, label: "Past due now" }
                  : { icon: CalendarX, tone: "text-[#8B6B3E]", big: `${ov.lateAccounts}`, label: "Accounts with late payments" },
                { icon: CreditCard, tone: ov.overLimitCount ? "text-[#8F5F65]" : "text-[#566033]", big: `${ov.overLimitCount}`, label: "Cards over limit" },
              ];
              return tiles.map((t, i) => (
                <div key={i} className="rounded-xl bg-secondary/60 p-2.5 flex gap-2">
                  <t.icon className={`w-4 h-4 shrink-0 mt-0.5 ${t.tone}`} strokeWidth={1.8} />
                  <div className="min-w-0">
                    <p className="font-heading text-[17px] text-foreground leading-tight">{t.big}{t.tag && <span className={`ml-1.5 align-middle text-[10px] font-body px-1.5 py-0.5 rounded-full ${t.tag[1]}`}>{t.tag[0]}</span>}</p>
                    <p className="text-[11px] text-muted-foreground leading-snug">{t.label}</p>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
      <div className="lg:col-span-7 space-y-3 min-w-0">
      {ov && ov.plan.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4">
          {ov.plan.length > 0 && (
            <div>
              <div className="flex items-baseline">
                <p className="font-heading text-lg text-foreground flex-1">{ov.upkeep ? "Keep it steady" : "Your plan"}</p>
                {!ov.upkeep && <span className="text-[11px] text-muted-foreground">{planDoneCount} of {planTotal} done</span>}
              </div>
              {!ov.upkeep && <div className="h-1.5 rounded-full bg-secondary mt-2 mb-1 overflow-hidden"><div className="h-full rounded-full bg-[#A7773F] transition-all" style={{ width: `${Math.max(4, Math.round((planDoneCount / Math.max(1, planTotal)) * 100))}%` }} /></div>}
              {ov.upkeep && <p className="text-xs text-muted-foreground mb-1">Nothing on your reports needs fixing right now. Keep doing this:</p>}
              {!ov.upkeep && goneSteps.map((g) => (
                <div key={`gone-${g.filter}`} className="w-full flex gap-2.5 py-2 border-t border-border/70 first:border-0 items-center">
                  <span className="w-[22px] h-[22px] rounded-full bg-[#7D8A53] text-white flex items-center justify-center shrink-0"><Check className="w-3 h-3" /></span>
                  <span className="flex-1 text-sm text-muted-foreground line-through">{g.title.replace(/ · \$[\d,]+\+?$/, "")}</span>
                  {g.doneOn && <span className="text-[10.5px] text-muted-foreground">done {niceDate(g.doneOn).replace(/, \d{4}$/, "")}</span>}
                </div>
              ))}
              {ov.plan.map((p) => (
                <div key={p.n} role="button" tabIndex={0} onClick={() => openStep(p)} onKeyDown={(e) => { if (e.key === "Enter") openStep(p); }} className={`w-full flex gap-2.5 text-left py-2.5 border-t border-border/70 first:border-0 ${p.upkeep ? "cursor-default" : "cursor-pointer"}`}>
                  <span className={`w-[22px] h-[22px] rounded-full text-[11px] flex items-center justify-center shrink-0 mt-0.5 ${isPlanDone(p) ? "bg-[#7D8A53] text-white" : p.n === 1 && !p.upkeep ? "bg-[#8B6B3E] text-white" : "bg-[#F0E6D6] text-[#8B6B3E]"}`}>{isPlanDone(p) ? <Check className="w-3 h-3" /> : p.n}</span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-sm font-medium ${isPlanDone(p) ? "text-muted-foreground line-through" : "text-foreground"}`}>{p.title}</span>
                    {p.text && <span className="block text-xs text-muted-foreground mt-0.5">{p.text}</span>}
                    {p.rows && (
                      <span className="mt-1.5 grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-0.5 text-xs">
                        <span className="text-muted-foreground">Card</span><span className="text-muted-foreground text-right">Under limit</span><span className="text-muted-foreground text-right">Under 30%</span>
                        {p.rows.map((r, k) => (
                          <span key={k} className="contents">
                            <span className="text-foreground truncate">{r.name}</span>
                            <span className="text-foreground text-right">{r.toLimit ? money(r.toLimit) : "—"}</span>
                            <span className="text-foreground text-right">{money(r.to30)}</span>
                          </span>
                        ))}
                      </span>
                    )}
                    {p.note && <span className="block text-[11px] text-muted-foreground mt-1">{p.note}</span>}
                  </span>
                  {!p.upkeep && (
                    <button onClick={(e) => { e.stopPropagation(); togglePlan(p); }} aria-label={isPlanDone(p) ? "Mark not done" : "Mark done"}
                      className={`w-5 h-5 rounded-full border shrink-0 mt-0.5 flex items-center justify-center ${isPlanDone(p) ? "bg-[#7D8A53] border-[#7D8A53]" : "border-border"}`}>{isPlanDone(p) && <Check className="w-3 h-3 text-white" />}</button>
                  )}
                  {!p.upkeep && <ChevronRight className="w-4 h-4 text-[#A7773F] shrink-0 mt-0.5" />}
                </div>
              ))}
              {ov.planNote && <p className="text-[11px] text-muted-foreground mt-1">{ov.planNote}</p>}
              <p className="text-[11px] text-muted-foreground mt-1">Amounts to pay are estimates from your reports' balances and limits.</p>
            </div>
          )}
        </div>
      )}
      {docs.length > 0 && (
        <Section id="items" title="What's affecting your credit" count={items.length}>
          {breach && (
            <div className="mb-3 rounded-xl bg-[#F3E6E8] p-3 flex gap-2">
              <ShieldAlert className="w-4 h-4 text-[#8F5F65] shrink-0 mt-0.5" />
              <p className="text-xs text-[#6E4A4F]">{breach.from || "A company"} reported your data was exposed on {niceDate(breach.breach_date)}. Anything opened after that is flagged so you can say whether it's yours.</p>
            </div>
          )}
          {overdue.length > 0 && (
            <button onClick={() => setOpenItem(overdue[0].key)} className="mb-3 w-full text-left rounded-xl bg-[#F0E6D6] p-3">
              <p className="text-xs font-medium text-[#6E5430]">{overdue.length === 1 ? "1 letter has" : `${overdue.length} letters have`} had no reply in 30 days</p>
              <p className="text-xs text-[#6E5430]/80 mt-0.5">Tap to see what to do next.</p>
            </button>
          )}
          {items.length > 0 && (
            <div className="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
              {FILTERS.map(([k, l, fn]) => {
                const n = items.filter(fn).length;
                if (k !== "all" && !n) return null;
                return <button key={k} onClick={() => { setFilter(k); setShowAll(false); }} className={`shrink-0 whitespace-nowrap text-xs rounded-full px-2.5 py-1 border ${filter === k ? "bg-foreground text-background border-foreground" : "border-border text-foreground"}`}>{l} {n}</button>;
              })}
            </div>
          )}
          {items.length === 0 && <p className="text-sm text-muted-foreground">Nothing needs action from what you've uploaded. Upload all three bureau reports to check for differences.</p>}
          <div className="space-y-2">
            {shown.map((item) => {
              const open = openItem === item.key;
              const dec = caseRec?.decisions?.[item.key] || {};
              const steps = stepsFor(item);
              return (
                <div key={item.key} id={`ci-${item.key}`} className={`border rounded-xl ${open ? "border-[#A7773F]/50" : "border-border"}`}>
                  <button onClick={() => setOpenItem(open ? null : item.key)} className="w-full text-left px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {isFlag(item)
                        ? <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0 border border-dashed border-[#C9A876] text-[#8B6B3E] bg-card">Check this</span>
                        : <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${KIND_TONE[item.kind]}`}>{item.label}</span>}
                      <span className="text-sm text-foreground truncate flex-1 min-w-0">{item.title}</span>
                      {item.account && item.account.bureaus.length > 0 && <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">{item.account.bureaus.map((b) => BUREAU_SHORT[b] || b).join(" · ")}</span>}
                      {(dec.sent || []).length > 0 && <span className="text-[10px] text-[#566033] shrink-0">Sent</span>}
                      {item.deadline && item.deadline >= todayStr() && <span className="text-[10px] text-[#8F5F65] shrink-0">by {niceDate(item.deadline)}</span>}
                      {open ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                    </div>
                    {open && (isFlag(item) ? (
                      <span className="block mt-2 rounded-lg bg-secondary/60 px-2.5 py-2 text-[11.5px] leading-relaxed">
                        {reportFacts(item) && <span className="block"><span className="text-muted-foreground">From your report: </span><span className="text-foreground">{reportFacts(item)}</span></span>}
                        <span className="block mt-0.5"><span className="text-[#8B6B3E] font-medium">Why Guía flagged it ({item.label.toLowerCase()}): </span><span className="text-foreground">{item.detail}</span></span>
                        <span className="block mt-0.5 text-muted-foreground">This is a possibility to check, not a confirmed error.</span>
                      </span>
                    ) : <span className="block text-xs text-muted-foreground mt-1.5">{item.detail}</span>)}
                    {open && item.account && (() => {
                      const a = item.account;
                      const facts = [
                        a.bureaus.length ? `On ${a.bureaus.join(", ")}` : "",
                        a.opened ? `opened ${niceDate(a.opened)}` : "",
                        a.first_delinquency ? `first late ${niceDate(a.first_delinquency)}` : "",
                        a.last_payment ? `last paid ${niceDate(a.last_payment)}` : "",
                      ].filter(Boolean);
                      return (
                        <div className="mt-2">
                          {facts.length > 0 && <p className="text-[11px] text-muted-foreground">{facts.join(" · ")}</p>}
                          {a.late && a.late.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {a.late.slice(-12).map((l) => <span key={l.date} className="text-[10px] rounded-full bg-[#F0E6D6] text-[#8B6B3E] px-1.5 py-0.5">{niceDate(l.date)}{l.days ? ` · ${l.days}d` : ""}</span>)}
                              {a.late.length > 12 && <span className="text-[10px] text-muted-foreground px-1 py-0.5">+{a.late.length - 12} earlier</span>}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </button>

                  {open && (
                    <div className="px-3 pb-3 space-y-2">
                      {item.kind === "mismatch" && (
                        <div>
                          <p className="text-[11px] text-muted-foreground mb-1">Which happened first?</p>
                          <div className="flex gap-1.5">
                            {[["before", "Paid before charge-off"], ["after", "Charged off, then paid"], ["unsure", "Not sure"]].map(([v, l]) => (
                              <button key={v} onClick={() => decide(item.key, { paidWhen: v })}
                                className={`flex-1 rounded-lg py-2 px-1 text-xs border ${(item.when || "") === v ? "bg-foreground text-background border-foreground" : "border-border text-foreground"}`}>{l}</button>
                            ))}
                          </div>
                          {item.when === "unsure" && <p className="text-xs text-muted-foreground mt-1.5">Check the "date of charge-off" on your report against the payoff date on your letter. Either way, the report should show a $0 balance.</p>}
                        </div>
                      )}
                      {item.kind === "breach" && (
                        <div className="flex gap-1.5">
                          {[["mine", "Mine"], ["not_mine", "Not mine"], ["unsure", "Not sure"]].map(([v, l]) => (
                            <button key={v} onClick={() => decide(item.key, { owner: v })}
                              className={`flex-1 rounded-lg py-2 text-xs border ${item.owner === v ? "bg-foreground text-background border-foreground" : "border-border text-foreground"}`}>{l}</button>
                          ))}
                        </div>
                      )}
                      {item.kind === "breach" && item.owner === "unsure" && <p className="text-xs text-muted-foreground">Check your email and old statements for this company. If you still don't recognize it, choose Not mine.</p>}
                      {item.kind === "collection" && item.old && <p className="text-xs rounded-lg bg-[#F0E6D6] text-[#6E5430] p-2">This may be an older debt. In many states, a payment or written promise to pay can restart the time limit to sue. Check your state's rules before paying.</p>}
                      {steps.map((st, i) => (
                        <StepRow key={st.id} s={st} i={i} done={!!dec.done?.[st.id]} onToggle={() => toggleStep(item, st.id)}
                          onLetter={(t, b) => openLetter(t, item, undefined, b)} onTodo={() => addTodo(st, item)}
                          bureaus={st.letter ? bureausFor(item, st.letter) : []} missing={st.letter === "block" ? [] : missingBureaus}
                          sentTo={(dec.sent || []).filter((x) => x.type === st.letter).map((x) => bureauKey(x.to || "")).filter(Boolean)} />
                      ))}
                      {(dec.sent || []).length > 0 && (
                        <div className="border-t border-border pt-2 mt-1 space-y-3">
                          <p className="text-xs font-medium text-foreground">Letters you sent</p>
                          {dec.sent.map((sn, idx) => {
                            const late = isOverdue(sn);
                            const follow = sn.reply ? replySteps(sn) : late ? noReplySteps(sn) : [];
                            const outcome = sn.reply && (OUTCOMES[sn.type] || []).find(([v]) => v === sn.reply.outcome);
                            return (
                              <div key={idx} className="rounded-xl bg-secondary/60 p-2.5 space-y-2">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm text-foreground flex-1 min-w-0 truncate">{LETTER_TITLE[sn.type]}{sn.to ? ` · ${sn.to}` : ""}</p>
                                  <span className={`text-[10px] shrink-0 ${sn.reply ? "text-[#566033]" : late ? "text-[#8F5F65]" : "text-muted-foreground"}`}>
                                    {sn.reply ? `Reply: ${outcome ? outcome[1].toLowerCase() : sn.reply.outcome}` : late ? "No reply yet" : `Reply due ${niceDate(sentDue(sn))}`}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                                  <span>Mailed {niceDate(sn.date)}</span>
                                  {sn.delivered ? <span>· delivered {niceDate(sn.delivered)}</span> : !sn.reply && (
                                    <label className="inline-flex items-center gap-1 border border-border rounded-full px-2 py-0.5 text-foreground bg-card cursor-pointer">
                                      Delivered on
                                      <input type="date" max={todayStr()} min={sn.date} onChange={(e) => e.target.value && setDelivered(item, idx, e.target.value)} className="bg-transparent text-[11px] w-[110px] outline-none" />
                                    </label>
                                  )}
                                  {sn.tracking && <a href={uspsTrack(sn.tracking)} target="_blank" rel="noreferrer" className="text-[#8B6B3E] inline-flex items-center gap-0.5">Track <ExternalLink className="w-3 h-3" /></a>}
                                </div>
                                {!sn.reply && (
                                  <div>
                                    <p className="text-[11px] text-muted-foreground mb-1">Got a reply? What did they say?</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {(OUTCOMES[sn.type] || []).map(([v, l]) => (
                                        <button key={v} onClick={() => logReply(item, idx, v)} className="text-xs border border-border rounded-full px-2.5 py-1 text-foreground bg-card">{l}</button>
                                      ))}
                                      {!locked && <button onClick={() => fileRef.current?.click()} className="text-xs text-[#8B6B3E] px-1 py-1">Upload their letter</button>}
                                    </div>
                                  </div>
                                )}
                                {follow.length > 0 && (
                                  <div className="space-y-2 pt-1">
                                    <p className="text-[11px] font-medium text-foreground">{sn.reply ? "Next steps" : "No reply after 30 days. Next steps:"}</p>
                                    {follow.map((st, i) => (
                                      <StepRow key={st.id} s={st} i={i} done={!!dec.done?.[`${idx}-${st.id}`]} onToggle={() => toggleStep(item, `${idx}-${st.id}`)}
                                        onLetter={(t, b) => openLetter(t, item, sn, b || (bureauKey(sn.to || "") || undefined))}
                                        bureaus={st.letter && BUREAU_LETTERS.has(st.letter) ? (bureauKey(sn.to || "") ? [bureauKey(sn.to)] : bureausFor(item, st.letter)) : []} />
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <CallLog calls={dec.calls || []} onAdd={(c) => addCall(item, c)} onRemove={(i) => removeCall(item, i)} />
                      {item.kind !== "breach" || item.owner ? (
                        <button onClick={() => decide(item.key, { resolved: { date: todayStr(), text: `${item.account?.creditor || item.inquiry?.creditor || "Item"} resolved` } })}
                          className="text-xs text-muted-foreground underline underline-offset-2">Mark resolved</button>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {fItems.length > 6 && (
            <button onClick={() => setShowAll((v) => !v)} className="mt-2 w-full text-xs text-[#A7773F] py-2">{showAll ? "Show fewer" : `Show all ${fItems.length}`}</button>
          )}
          <div className="mt-3"><Note /></div>
        </Section>
      )}

      </div>

      <div className="lg:col-span-5 space-y-3 min-w-0">
      {docs.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2">
            <p className="font-heading text-lg text-foreground flex-1">Your journey</p>
            {scoreBureaus.length > 1 && (
              <div className="flex gap-1">
                {scoreBureaus.map((b) => <button key={b} onClick={() => setChartB(b)} className={`text-[10.5px] rounded-full px-2 py-0.5 border ${curChartB === b ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"}`}>{BUREAU_SHORT[b] || b}</button>)}
              </div>
            )}
          </div>
          {(() => {
            const sc = chartScores;
            const last = sc[sc.length - 1];
            const w = 140, h = 40;
            const pts = sc.length > 1 ? (() => {
              const vals = sc.map((x) => x.score); const lo = Math.min(...vals) - 5, hi = Math.max(...vals) + 5;
              return sc.map((x, i) => `${4 + (i / (sc.length - 1)) * (w - 8)},${h - 4 - ((x.score - lo) / Math.max(1, hi - lo)) * (h - 8)}`).join(" ");
            })() : "";
            return (
              <div className="flex items-end justify-between mt-1.5">
                <div>
                  <p className="font-heading text-2xl text-foreground leading-none">{last ? last.score : "—"}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{last ? `${last.bureau || "Score"} · ${niceDate(last.date)}` : "No score yet"}</p>
                </div>
                {pts ? (
                  <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true"><polyline points={pts} fill="none" stroke="#A7773F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                ) : last ? (
                  // One score so far: show it as the starting point, with the next two months as empty slots. No guessed trend.
                  <svg width={w} height={h + 10} viewBox={`0 0 ${w} ${h + 10}`} aria-hidden="true">
                    <line x1="6" y1={h - 6} x2={w - 6} y2={h - 6} stroke="#EEE7DC" />
                    {[0, 1, 2].map((k) => {
                      const x = 10 + k * ((w - 20) / 2);
                      const d = new Date(); d.setMonth(d.getMonth() + k);
                      return (
                        <g key={k}>
                          {k === 0 ? <circle cx={x} cy={h - 14} r="4" fill="#A7773F" /> : <circle cx={x} cy={h - 6} r="3" fill="#fff" stroke="#D3C7B5" strokeDasharray="2 2" />}
                          <text x={x} y={h + 8} fontSize="8" fill="#7a716a" textAnchor="middle">{d.toLocaleDateString("en-US", { month: "short" })}</text>
                        </g>
                      );
                    })}
                  </svg>
                ) : null}
              </div>
            );
          })()}

          {(() => {
            const sentList = Object.entries((caseRec && caseRec.decisions) || {}).flatMap(([, v]) => (v.sent || []).map((x) => ({ date: x.date, text: `Sent: ${LETTER_TITLE[x.type] || "letter"}${x.to ? ` · ${x.to}` : ""}` })));
            const done = [...prog.wins.map((x) => ({ ...x, win: true })), ...sentList].sort((x, y) => String(y.date).localeCompare(String(x.date)));
            const Row = ({ icon, tone, text, right }) => (
              <div className="flex items-center gap-2.5 py-1.5 border-b border-border/60 last:border-0">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${tone}`}>{icon}</span>
                <span className="text-sm text-foreground flex-1 min-w-0">{text}</span>
                {right}
              </div>
            );
            const head = (t, c) => <p className={`text-[10.5px] font-bold uppercase tracking-[0.14em] mt-4 mb-1 ${c}`}>{t}</p>;
            return (
              <>
                {!done.length && !prog.checkBacks.length ? (
                  <div className="mt-3 ml-1 border-l border-border pl-3.5 space-y-2 text-[12.5px]">
                    {(() => {
                      const first = chartScores[0];
                      const nm = new Date(); nm.setMonth(nm.getMonth() + 1);
                      const dot = (on) => <span className={`absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full ${on ? "bg-[#7D8A53]" : "bg-card border border-border"}`} />;
                      return (
                        <>
                          <p className="relative">{dot(!!first)}<span className="text-foreground font-medium">Baseline set</span><span className="text-muted-foreground">{first ? ` · ${first.score} on ${niceDate(first.date)}` : " · add a score or report"}</span></p>
                          <p className="relative">{dot(false)}<span className="text-foreground">Letters and replies</span><span className="text-muted-foreground"> · none mailed yet</span></p>
                          <p className="relative">{dot(false)}<span className="text-foreground">Next score</span><span className="text-muted-foreground"> · add one in {nm.toLocaleDateString("en-US", { month: "long" })}</span></p>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <>
                    {head("Done", "text-[#566033]")}
                    {done.length ? done.slice(0, 5).map((x, i) => <Row key={i} tone={x.win ? "bg-[#7D8A53] text-white" : "bg-[#E9EDDD] text-[#566033]"} icon={<Check className="w-3 h-3" />} text={x.text} right={<span className="text-[11px] text-muted-foreground shrink-0">{niceDate(x.date).replace(/, \d{4}$/, "")}</span>} />)
                      : <p className="text-xs text-muted-foreground py-1">Nothing yet.</p>}
                    {head("Waiting on", "text-[#8B6B3E]")}
                    {prog.checkBacks.length ? prog.checkBacks.map((c, i) => <Row key={i} tone="bg-[#F0E6D6] text-[#8B6B3E]" icon={<Loader2 className="w-3 h-3" />} text={`${c.to || "Reply"} · ${LETTER_TITLE[c.type] || "letter"}`} right={<span className="text-[10px] rounded-full bg-[#F0E6D6] text-[#8B6B3E] px-2 py-0.5 shrink-0">by {niceDate(c.due).replace(/, \d{4}$/, "")}</span>} />)
                      : <p className="text-xs text-muted-foreground py-1">No replies due.</p>}
                  </>
                )}
                {(() => {
                  // Only what drops off within a year is worth a list; anything later is one quiet line.
                  const yr = new Date(); yr.setFullYear(yr.getFullYear() + 1);
                  const soon = prog.coming.filter((c) => new Date(c.date) <= yr);
                  const next = prog.coming[0];
                  if (!prog.coming.length) return null;
                  return (
                    <>
                      {head("Coming up", "text-muted-foreground")}
                      {soon.length ? (
                        <>
                          {(comingAll ? soon : soon.slice(0, 3)).map((c, i) => <Row key={i} tone="bg-secondary text-muted-foreground" icon={<span className="text-[9px]">↓</span>} text={c.text.replace(/ falls off$/, " drops off")} right={<span className="text-[11px] text-muted-foreground shrink-0">~{niceDate(c.date).replace(/^(\w+) \d+, /, "$1 ")}</span>} />)}
                          {soon.length > 3 && <button onClick={() => setComingAll((v) => !v)} className="w-full text-xs text-[#A7773F] pt-1.5">{comingAll ? "Show fewer" : `See all ${soon.length}`}</button>}
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground py-1">Nothing drops off in the next year. The first is {next.text.replace(/ falls off$/, "")}, around {String(next.date).slice(0, 4)}.</p>
                      )}
                    </>
                  );
                })()}
                {prog.coming.some((c) => new Date(c.date) <= new Date(Date.now() + 365 * 86400000)) && <p className="text-[11px] text-muted-foreground mt-3">Drop-off dates are estimates (about 7 years from the first late payment). No one can promise a score change.</p>}
              </>
            );
          })()}
        </div>
      )}

      {docs.length > 0 && (
        <Section id="files" title="Your credit file" count={docs.length} defaultOpen={false}>
          {copies.length > 0 && (
            <div className="mb-2.5 rounded-xl bg-[#F3E6E8] p-2.5 flex items-center gap-2">
              <p className="text-xs text-[#6E4A4F] flex-1">{copies.length === 1 ? "1 document looks like a copy" : `${copies.length} documents look like copies`} of another one.</p>
              <button onClick={removeCopies} className="text-xs font-medium text-[#8F5F65] shrink-0">Remove copies</button>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mb-2">Re-read a document to pick up details added since you uploaded it, like mailing addresses. You'll choose the file again.</p>
          <div className="space-y-1.5">
            {docs.map((d) => {
              const copy = copyIds.has(d.id);
              return (
              <div key={d.id} className="flex items-center gap-2 text-sm">
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground shrink-0">{DOC_LABEL[d.doc_type] || "Doc"}</span>
                <span className="truncate text-foreground">{(d.bureaus && d.bureaus.length > 1 ? d.bureaus.join(", ") : d.bureau || d.from) || d.filename}</span>
                <span className="text-xs text-muted-foreground shrink-0">{niceDate(d.doc_date)}</span>
                {copy && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F3E6E8] text-[#8F5F65] shrink-0">Copy</span>}
                {!locked && <button onClick={() => { setRereadId(d.id); rereadRef.current?.click(); }} disabled={!!rereading} className="ml-auto text-[11px] text-[#8B6B3E] shrink-0 disabled:opacity-50">{rereading === d.id ? "Reading…" : "Re-read"}</button>}
                <button onClick={() => removeDoc(d)} aria-label="Remove" className={`${locked ? "ml-auto " : ""}p-1 text-muted-foreground/70`}><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              );
            })}
          </div>
        </Section>
      )}

      </div>

      </div>
      {rightsOpen && <RightsSheet onClose={() => setRightsOpen(false)} />}
      {scoreFor && onSaveScore && (
        <ScoreSheet bureau={scoreFor} onClose={() => setScoreFor(null)} onSave={onSaveScore} onDelete={onDeleteScore || (async () => {})}
          history={(() => { const it = scoreItems.find((x) => x.bureau === scoreFor || x.name === scoreFor); return it ? (Array.isArray(it.score_history) && it.score_history.length ? it.score_history : it.score ? [{ score: it.score, date: String(it.score_updated || it.created_date || "").slice(0, 10) }] : []) : []; })()} />
      )}
      {letter && <LetterSheet letter={letter} onClose={() => setLetter(null)} onSent={markSent} />}
      {toast && createPortal(<div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[85] bg-foreground text-background text-sm px-4 py-2 rounded-full shadow">{toast}</div>, document.body)}
    </div>
  );
}

