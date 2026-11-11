import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, Upload, X, Copy, Mail, Check, FileText, Trash2, ExternalLink, ShieldAlert, Loader2 } from "lucide-react";
import { base44, getAiUsage } from "@/api/base44Client";
import { ent } from "@/lib/freshEntities";
import { analyze, stepsFor, letterFor, LETTER_TITLE, timeline, progress, DOC_LABEL, niceDate, OUTCOMES, WIN, isOverdue, sentDue, noReplySteps, replySteps, followUpLetter, deadlineNudges, mergeParts } from "@/lib/credit";

const MAX_FILES = 10;
const PAGES_PER_PART = 1;
const PARALLEL = 4;

// Split a long PDF into small PDFs so each one reads well within the server's time limit.
async function splitPdf(file) {
  if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) return [file];
  try {
    const { PDFDocument } = await import("pdf-lib");
    const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
    const n = src.getPageCount();
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

function StepRow({ s, i, done, onToggle, onLetter, onTodo }) {
  return (
    <div className="flex gap-2.5">
      <button onClick={onToggle} aria-label="Done"
        className={`w-5 h-5 rounded-full border shrink-0 mt-0.5 flex items-center justify-center ${done ? "bg-[#7D8A53] border-[#7D8A53]" : "border-border"}`}>
        {done ? <Check className="w-3 h-3 text-white" /> : <span className="text-[10px] text-muted-foreground">{i + 1}</span>}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm text-foreground ${done ? "line-through opacity-60" : ""}`}>{s.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{s.body}</p>
        <div className="flex flex-wrap gap-3 mt-1">
          {s.letter && <button onClick={() => onLetter(s.letter)} className="text-xs text-[#8B6B3E] font-medium">Draft letter</button>}
          {s.link && <a href={s.link} target="_blank" rel="noreferrer" className="text-xs text-[#8B6B3E] font-medium inline-flex items-center gap-1">Open <ExternalLink className="w-3 h-3" /></a>}
          {onTodo && <button onClick={onTodo} className="text-xs text-muted-foreground">Add to-do</button>}
        </div>
      </div>
    </div>
  );
}

const KIND_TONE = {
  breach: "bg-[#F3E6E8] text-[#8F5F65]",
  collection: "bg-[#F0E6D6] text-[#8B6B3E]",
  late: "bg-[#F0E6D6] text-[#8B6B3E]",
  utilization: "bg-[#E9EDDD] text-[#566033]",
};
const DOT = { bad: "#A77C81", warn: "#A7773F", good: "#7D8A53", info: "#B8AFA4" };

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

function ScoreChart({ scores }) {
  if (scores.length < 2) return scores.length ? <p className="text-sm text-foreground">Latest score <span className="font-heading text-lg">{scores[0].score}</span> · {niceDate(scores[0].date)}</p> : <p className="text-sm text-muted-foreground">Upload a report or add a score to start your chart.</p>;
  const w = 300, h = 90, pad = 8;
  const vals = scores.map((s) => s.score);
  const lo = Math.min(...vals) - 10, hi = Math.max(...vals) + 10;
  const t0 = new Date(scores[0].date).getTime(), t1 = new Date(scores[scores.length - 1].date).getTime() || t0 + 1;
  const x = (d) => pad + ((new Date(d).getTime() - t0) / Math.max(1, t1 - t0)) * (w - pad * 2);
  const y = (v) => h - pad - ((v - lo) / Math.max(1, hi - lo)) * (h - pad * 2);
  const pts = scores.map((s) => `${x(s.date)},${y(s.score)}`).join(" ");
  const first = scores[0], last = scores[scores.length - 1];
  const diff = last.score - first.score;
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="font-heading text-2xl text-foreground">{last.score}</span>
        {diff !== 0 && <span className={`text-xs font-medium ${diff > 0 ? "text-[#566033]" : "text-[#8F5F65]"}`}>{diff > 0 ? "▲" : "▼"} {Math.abs(diff)} since {niceDate(first.date)}</span>}
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-24">
        <polyline points={pts} fill="none" stroke="#A7773F" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {scores.map((s, i) => <circle key={i} cx={x(s.date)} cy={y(s.score)} r="3" fill="#fff" stroke="#A7773F" strokeWidth="1.5" />)}
      </svg>
    </div>
  );
}

function LetterSheet({ letter, onClose, onSent }) {
  const [text, setText] = useState(letter.text);
  const [to, setTo] = useState(letter.to || "");
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ } };
  const mail = `mailto:?subject=${encodeURIComponent(letter.title)}&body=${encodeURIComponent(text)}`;
  return createPortal(
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-background w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h3 className="font-heading text-lg text-foreground">{letter.title}</h3>
          <button onClick={onClose} aria-label="Close" className="p-1 text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-5 overflow-y-auto flex-1 space-y-3 pb-3">
          <p className="text-xs text-muted-foreground">Fill in anything in [brackets], read it over, then send it yourself. Certified mail with return receipt gives you proof it arrived.</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={16}
            className="w-full sm:min-h-[460px] bg-card border border-input rounded-xl p-3 text-[13px] leading-relaxed font-body text-foreground outline-none focus:border-ring" />
          <div className="flex gap-2">
            <button onClick={copy} className="flex-1 flex items-center justify-center gap-1.5 border border-border rounded-xl py-2.5 text-sm text-foreground">{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copied ? "Copied" : "Copy"}</button>
            <a href={mail} className="flex-1 flex items-center justify-center gap-1.5 border border-border rounded-xl py-2.5 text-sm text-foreground"><Mail className="w-4 h-4" />Email to myself</a>
          </div>
          <div className="border-t border-border pt-3">
            <label className="block text-xs font-medium text-foreground mb-1">Sent to</label>
            <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="e.g., Midland Credit, Experian"
              className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-ring" />
            <button onClick={() => onSent(to || letter.to || "")} className="mt-2 w-full bg-foreground text-background rounded-xl py-2.5 text-sm font-medium">Mark as sent · remind me in 30 days</button>
          </div>
          <Note />
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function CreditAssistant({ scoreItems = [] }) {
  const [docs, setDocs] = useState([]);
  const [caseRec, setCaseRec] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState([]); // [{name, status}]
  const [openItem, setOpenItem] = useState(null);
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

  const onFiles = async (e) => {
    const picked = [...(e.target.files || [])].slice(0, MAX_FILES);
    e.target.value = "";
    if (!picked.length) return;
    setBusy(picked.map((f) => ({ name: f.name, status: "reading", note: "Preparing…" })));
    const update = (i, patch) => setBusy((b) => b.map((x, j) => (j === i ? { ...x, ...patch } : x)));
    const saved = [];
    let failed = 0;
    for (let i = 0; i < picked.length; i++) {
      const file = picked[i];
      const pieces = await splitPdf(file);
      let done = 0, lastErr = "";
      update(i, { note: pieces.length > 1 ? `Reading ${pieces.length} parts…` : "Reading…" });
      const parts = await pool(pieces.map((piece, k) => async () => {
        const read = async () => {
          const res = await base44.integrations.Core.ImportFinanceFile({ file: piece, mode: "credit", part: k, parts: pieces.length });
          return (res && res.doc) || null;
        };
        try {
          return await read(); // a 5xx (e.g. a slow page) is already retried once by the client
        } catch (err) {
          lastErr = String((err && err.message) || "");
          if (/Plus/.test(lastErr)) setBlocked(true);
          return null;
        } finally {
          done += 1;
          if (pieces.length > 1) update(i, { note: `Read ${done} of ${pieces.length} parts` });
        }
      }), PARALLEL);
      const doc = mergeParts(parts);
      const missed = parts.filter((x) => !x).length;
      if (!doc) { failed += 1; update(i, { status: "failed", note: lastErr || "Couldn't read this file." }); continue; }
      try {
        const rec = await ent.CreditDoc.create({ ...doc, filename: file.name });
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

  const removeDoc = async (d) => {
    setDocs((x) => x.filter((y) => y.id !== d.id));
    await ent.CreditDoc.delete(d.id);
  };

  const extraScores = useMemo(() => scoreItems.flatMap((it) => (Array.isArray(it.score_history) && it.score_history.length ? it.score_history : it.score ? [{ score: it.score, date: (it.score_updated || it.created_date || todayStr()).slice(0, 10) }] : []).map((h) => ({ ...h, bureau: it.bureau || it.name }))), [scoreItems]);
  const caseForCalc = useMemo(() => ({ ...(caseRec || {}), scores: [...((caseRec && caseRec.scores) || []), ...extraScores] }), [caseRec, extraScores]);
  const { items, breach } = useMemo(() => analyze(docs, caseRec || {}), [docs, caseRec]);
  const events = useMemo(() => timeline(docs, caseRec || {}), [docs, caseRec]);
  const prog = useMemo(() => progress(docs, caseForCalc), [docs, caseForCalc]);
  const notMine = items.filter((i) => i.kind === "breach" && i.owner === "not_mine");

  const openLetter = (type, item, sent) => {
    const a = item.account || {};
    const toBureau = type === "dispute" || type === "block" || type === "unverified" || type === "mov";
    const to = type === "followup" && sent ? sent.to : toBureau ? ((a.bureaus && a.bureaus[0]) || "") : (a.creditor || item.inquiry?.creditor || "");
    const text = FOLLOW_TYPES.has(type) ? followUpLetter(type, item, sent) : letterFor(type, item, { items: type === "block" ? notMine : undefined });
    setLetter({ type, item, to, title: LETTER_TITLE[type], text });
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

  const markSent = async (to) => {
    const { type, item } = letter;
    const prev = (caseRec?.decisions?.[item.key]?.sent) || [];
    let taskId = null;
    try { const t = await ent.Task.create({ title: `Check for a reply: ${LETTER_TITLE[type]}${to ? ` (${to})` : ""}`, notes: "From the credit assistant. Open Finance → Credit Scores to log their reply, or see next steps if there's none.", priority: "medium", due_date: plus30(), completed: false, source: "credit" }); taskId = t?.id || null; } catch { /* ignore */ }
    await decide(item.key, { sent: [...prev, { type, to, date: todayStr(), taskId }] });
    setLetter(null);
    flash("Marked as sent. A to-do is set for 30 days.");
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
    <div className="mb-4 grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
      <div className="lg:col-span-7 space-y-3 min-w-0">
      {/* Intro + upload */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-[#F0E6D6] flex items-center justify-center shrink-0"><FileText className="w-4 h-4 text-[#8B6B3E]" /></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-heading text-base text-foreground">Credit assistant</p>
              {usage && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F0E6D6] text-[#8B6B3E]">{usage.plan === "trial" ? "Plus · in your trial" : "Plus"}</span>}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">Upload credit reports, collection letters, breach notices or dispute results. Guía reads them together and suggests next steps.</p>
          </div>
        </div>
        <input ref={fileRef} type="file" multiple accept="application/pdf,.pdf,image/*,image/heic,image/heif,.heic,.heif" className="hidden" onChange={onFiles} />
        {locked ? (
          <div className="mt-3 rounded-xl bg-[#F3E8D6] p-3">
            <p className="text-sm font-medium text-foreground">Part of Guía Plus</p>
            <p className="text-xs text-muted-foreground mt-0.5">Upgrade to upload new documents. Everything you've already added stays here, and you can still draft and track letters.</p>
          </div>
        ) : (
        <button onClick={() => fileRef.current?.click()} disabled={busy.some((b) => b.status === "reading")}
          className="mt-3 w-full flex items-center justify-center gap-2 border border-dashed border-[#A7773F]/60 rounded-xl py-3 text-sm text-[#8B6B3E] disabled:opacity-60">
          <Upload className="w-4 h-4" /> Upload documents <span className="text-muted-foreground">· up to {MAX_FILES}</span>
        </button>
        )}
        {busy.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {!busy.some((b) => b.status === "reading") && <button onClick={() => setBusy([])} className="float-right text-[11px] text-muted-foreground">Dismiss</button>}
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
        <p className="text-[11px] text-muted-foreground mt-2">Files aren't kept. Guía saves only what it reads (names, dates, balances, last 4 digits), never your SSN or full account numbers.</p>
      </div>

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
          {items.length === 0 && <p className="text-sm text-muted-foreground">Nothing needs action from what you've uploaded. Upload all three bureau reports to check for differences.</p>}
          <div className="space-y-2">
            {items.map((item) => {
              const open = openItem === item.key;
              const dec = caseRec?.decisions?.[item.key] || {};
              const steps = stepsFor(item);
              return (
                <div key={item.key} className="border border-border rounded-xl">
                  <button onClick={() => setOpenItem(open ? null : item.key)} className="w-full text-left p-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${KIND_TONE[item.kind]}`}>{item.label}</span>
                      {item.deadline && item.deadline >= todayStr() && <span className="text-[10px] text-[#8F5F65]">Reply by {niceDate(item.deadline)}</span>}
                      {(dec.sent || []).length > 0 && <span className="text-[10px] text-[#566033] ml-auto">Letter sent</span>}
                    </div>
                    <p className="text-sm font-medium text-foreground mt-1">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
                  </button>

                  {open && (
                    <div className="px-3 pb-3 space-y-2">
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
                          onLetter={(t) => openLetter(t, item)} onTodo={() => addTodo(st, item)} />
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
                                <p className="text-[11px] text-muted-foreground">Sent {niceDate(sn.date)}</p>
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
                                        onLetter={(t) => openLetter(t, item, sn)} />
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
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
          <div className="mt-3"><Note /></div>
        </Section>
      )}

      </div>

      <div className="lg:col-span-5 space-y-3 min-w-0">
      {docs.length > 0 && (
        <Section id="files" title="Your credit file" count={docs.length} defaultOpen={false}>
          <div className="space-y-1.5">
            {docs.map((d) => (
              <div key={d.id} className="flex items-center gap-2 text-sm">
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground shrink-0">{DOC_LABEL[d.doc_type] || "Doc"}</span>
                <span className="truncate text-foreground">{d.from || d.bureau || d.filename}</span>
                <span className="text-xs text-muted-foreground shrink-0">{niceDate(d.doc_date)}</span>
                <button onClick={() => removeDoc(d)} aria-label="Remove" className="ml-auto p-1 text-muted-foreground/70"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {docs.length > 0 && (
        <Section id="progress" title="Progress">
          <ScoreChart scores={prog.scores} />
          {prog.wins.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-foreground mb-1">Wins</p>
              {prog.wins.slice(0, 6).map((w, i) => <p key={i} className="text-sm text-foreground flex gap-2"><Check className="w-4 h-4 text-[#7D8A53] shrink-0 mt-0.5" />{w.text}<span className="ml-auto text-xs text-muted-foreground">{niceDate(w.date)}</span></p>)}
            </div>
          )}
          {prog.checkBacks.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-foreground mb-1">Waiting on replies</p>
              {prog.checkBacks.map((c, i) => <p key={i} className="text-sm text-foreground flex gap-2">{LETTER_TITLE[c.type]}{c.to ? ` · ${c.to}` : ""}<span className="ml-auto text-xs text-muted-foreground">by {niceDate(c.due)}</span></p>)}
            </div>
          )}
          {prog.coming.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-foreground mb-1">Coming up</p>
              {prog.coming.slice(0, 5).map((c, i) => <p key={i} className="text-sm text-foreground flex gap-2">{c.text}<span className="ml-auto text-xs text-muted-foreground">~{niceDate(c.date)}</span></p>)}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-3">Fall-off dates are estimates: about 7 years from when the account first went late. No one can promise a score change.</p>
        </Section>
      )}

      {events.length > 0 && (
        <Section id="timeline" title="Timeline" count={events.length} defaultOpen={false}>
          <div className="relative pl-4">
            <div className="absolute left-[5px] top-1 bottom-1 w-px bg-border" />
            {events.slice(0, 40).map((e, i) => (
              <div key={i} className="relative mb-2.5">
                <span className="absolute -left-4 top-1.5 w-2.5 h-2.5 rounded-full border-2 border-background" style={{ background: DOT[e.tone] }} />
                <p className="text-xs text-muted-foreground">{niceDate(e.date)}</p>
                <p className="text-sm text-foreground">{e.text}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      </div>

      {letter && <LetterSheet letter={letter} onClose={() => setLetter(null)} onSent={markSent} />}
      {toast && createPortal(<div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[85] bg-foreground text-background text-sm px-4 py-2 rounded-full shadow">{toast}</div>, document.body)}
    </div>
  );
}

