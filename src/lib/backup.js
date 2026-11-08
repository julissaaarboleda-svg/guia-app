// Client helpers for backing up, restoring and exporting the user's data.
import { base44, authHeaders, API_BASE } from "@/api/base44Client";

export const ENTITY_NAMES = [
  "Trip", "UserPreferences", "FinanceItem", "Note", "Folder", "Project", "Goal", "Task",
  "BusinessGoal", "BusinessEntry", "Business", "BusinessDocument", "CareerEntry", "TargetRole",
  "LivingProfile", "JobRating", "PerformanceCalibration", "BudgetBucket", "MonthlyIncome",
  "SavedPlace", "RecapSnapshot",
];

const LABELS = {
  Trip: "trips", FinanceItem: "finance items", Note: "notes", Folder: "folders", Project: "projects",
  Goal: "goals", Task: "tasks", BusinessGoal: "business goals", BusinessEntry: "business entries",
  Business: "businesses", BusinessDocument: "business documents", CareerEntry: "career entries",
  TargetRole: "target roles", LivingProfile: "living profile", JobRating: "job ratings",
  PerformanceCalibration: "performance notes", BudgetBucket: "budget buckets", MonthlyIncome: "income entries",
  SavedPlace: "saved places", UserPreferences: "settings", RecapSnapshot: "recap snapshots",
};

export const countOf = (data) => Object.values(data || {}).reduce((n, a) => n + (Array.isArray(a) ? a.length : 0), 0);

export function summarize(data) {
  return Object.entries(data || {})
    .filter(([, a]) => Array.isArray(a) && a.length)
    .map(([k, a]) => ({ key: k, label: LABELS[k] || k, n: a.length }))
    .sort((a, b) => b.n - a.n);
}

async function call(path, opts = {}) {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/backup${path}`, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

// Whole backup. If the backup service can't answer (for example the data is too
// large for one response) fall back to reading each section directly.
export async function fetchBackup() {
  try {
    const b = await call("");
    if (b && b.data) return b;
  } catch { /* fall through */ }
  const data = {};
  for (const name of ENTITY_NAMES) {
    try {
      const list = await base44.entities[name].list();
      if (list && list.length) data[name] = list;
    } catch { /* skip sections that fail */ }
  }
  let email = "";
  try { email = (await base44.auth.me())?.email || ""; } catch { /* ignore */ }
  return { app: "guia", version: 1, exported_at: new Date().toISOString(), email, count: countOf(data), data };
}

export function download(filename, text, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const stamp = () => new Date().toISOString().slice(0, 10);

export async function downloadBackup() {
  const b = await fetchBackup();
  if (!countOf(b.data)) throw new Error("There's nothing to back up yet.");
  download(`guia-backup-${stamp()}.json`, JSON.stringify(b));
  try { localStorage.setItem("guia:last-download", new Date().toISOString()); } catch { /* ignore */ }
  return b;
}

export async function readBackupFile(file) {
  const text = await file.text();
  let obj;
  try { obj = JSON.parse(text); } catch { throw new Error("That file isn't a Guía backup."); }
  if (!obj || obj.app !== "guia" || !obj.data || typeof obj.data !== "object") throw new Error("That file isn't a Guía backup.");
  if (!countOf(obj.data)) throw new Error("That backup is empty.");
  return obj;
}

export const restoreBackup = (data, mode) => call("/restore", { method: "POST", body: JSON.stringify({ data, mode }) });
export const listAutoBackups = () => call("/auto");
export const fetchAutoBackup = (key) => call(`/auto/${encodeURIComponent(key)}`);

// Quietly keep a weekly copy. Safe to call on every app open.
export async function maybeAutoBackup() {
  try {
    const last = Number(localStorage.getItem("guia:auto-backup-check") || 0);
    if (Date.now() - last < 6 * 3600 * 1000) return;
    localStorage.setItem("guia:auto-backup-check", String(Date.now()));
  } catch { /* ignore */ }
  try { await call("/auto", { method: "POST", body: "{}" }); } catch { /* best effort */ }
}

// ---- spreadsheet (CSV) export ----------------------------------------------
const csvCell = (v) => {
  if (v == null) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (rows, cols) =>
  [cols.map((c) => csvCell(c.label)).join(","), ...rows.map((r) => cols.map((c) => csvCell(c.get ? c.get(r) : r[c.key])).join(","))].join("\r\n");

const FINANCE_COLS = [
  { label: "Type", key: "type" }, { label: "Name", get: (r) => r.name || r.bureau }, { label: "Amount", get: (r) => r.amount ?? r.monthly_payment ?? r.current_amount },
  { label: "Billing cycle", key: "billing_cycle" }, { label: "Due day", key: "due_day" }, { label: "Due date", key: "due_date" },
  { label: "Paid", key: "paid" }, { label: "Category", key: "category" }, { label: "Total", get: (r) => r.total_amount ?? r.target_amount },
  { label: "Payoff today", key: "payoff_amount" }, { label: "Score", key: "score" }, { label: "Renewal date", key: "renewal_date" },
];
const GOAL_COLS = [
  { label: "Title", key: "title" }, { label: "Category", key: "category" }, { label: "Status", key: "status" },
  { label: "Target date", key: "target_date" }, { label: "Notes", key: "notes" },
  { label: "Sub-tasks done", get: (r) => (r.sub_tasks || []).filter((t) => t.completed).length },
  { label: "Sub-tasks total", get: (r) => (r.sub_tasks || []).length },
];
const NOTE_COLS = [{ label: "Title", key: "title" }, { label: "Created", key: "created_date" }, { label: "Content", get: (r) => (r.content || r.body || "").replace(/<[^>]+>/g, " ") }];
const BUDGET_COLS = [{ label: "Month", key: "month" }, { label: "Bucket", key: "name" }, { label: "Allocated", key: "allocated_amount" }, { label: "Spent", key: "spent_amount" }, { label: "Fixed", key: "is_fixed" }];

export const CSV_EXPORTS = [
  { id: "finance", label: "Finance", hint: "Bills, subscriptions, loans, savings and credit", file: "guia-finance", entity: "FinanceItem", cols: FINANCE_COLS },
  { id: "budget", label: "Budget", hint: "Monthly budget buckets", file: "guia-budget", entity: "BudgetBucket", cols: BUDGET_COLS },
  { id: "goals", label: "Goals", hint: "All goals with status and dates", file: "guia-goals", entity: "Goal", cols: GOAL_COLS },
  { id: "notes", label: "Notes", hint: "Note titles, dates and text", file: "guia-notes", entity: "Note", cols: NOTE_COLS },
];

export async function downloadCsv(def) {
  const rows = await base44.entities[def.entity].list();
  if (!rows.length) throw new Error(`No ${def.label.toLowerCase()} to export yet.`);
  download(`${def.file}-${stamp()}.csv`, "﻿" + toCsv(rows, def.cols), "text/csv");
  return rows.length;
}
