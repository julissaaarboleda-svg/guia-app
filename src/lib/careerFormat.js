// Small helpers for the Career page and the PDF importer.

// "2026-07-01" / "2026-07" -> a local Date (noon, so time zones can't flip the month)
export function parseLocal(s) {
  if (!s) return null;
  const str = String(s);
  const d = new Date(str.length === 7 ? `${str}-01T12:00:00` : str.length === 10 ? `${str}T12:00:00` : str);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtMonth(s) {
  const d = parseLocal(s);
  return d ? d.toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "";
}

export function monthsBetween(a, b = new Date()) {
  const da = parseLocal(a);
  const db = b instanceof Date ? b : parseLocal(b);
  if (!da || !db) return null;
  return Math.max(0, (db.getFullYear() - da.getFullYear()) * 12 + (db.getMonth() - da.getMonth()));
}

export function spanLabel(months) {
  if (months === null || months === undefined) return "";
  if (months < 1) return "<1 mo";
  if (months < 12) return `${months} mo`;
  return `${(months / 12).toFixed(1).replace(/\.0$/, "")} yrs`;
}

// Descriptions come from a rich-text editor, so they can hold HTML tags.
export function stripHtml(html) {
  return String(html || "")
    .replace(/<\/(p|li|div)>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// "Wellhub (formerly Gympass)", "Wellhub / Gympass" and "Gympass" are one employer.
// Known renames: both names count as the same employer even when only one is written.
const ALIASES = { gympass: "wellhub" };
const companyTokens = (c) =>
  new Set(String(c || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !["formerly", "inc", "company", "corp", "group"].includes(w)).map((w) => ALIASES[w] || w));
export function sameCompany(a, b) {
  const ta = companyTokens(a);
  for (const t of companyTokens(b)) if (ta.has(t)) return true;
  return norm(a) !== "" && norm(a) === norm(b);
}

export const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const bulletsToHtml = (items) => (items && items.length ? `<ul>${items.map((h) => `<li>${escapeHtml(h)}</li>`).join("")}</ul>` : "");

// Tag colors per entry type. Cognac stays the "tap me" color; these are labels.
export const TAGS = {
  current: { bg: "#E4E9D5", fg: "#566033", label: "Current" },
  job: { bg: "#EFE9DF", fg: "#5E5750", label: "Role" },
  review: { bg: "#F1E6E7", fg: "#7F575C", label: "Review" },
  milestone: { bg: "#F0E6D6", fg: "#8B6B3E", label: "Milestone" },
  certification: { bg: "#E9ECDF", fg: "#596238", label: "Certification" },
  skill: { bg: "#E7E2D8", fg: "#3D3934", label: "Skills" },
  education: { bg: "#E9ECDF", fg: "#596238", label: "Education" },
  custom: { bg: "#EFE9DF", fg: "#5E5750", label: "Custom" },
};
