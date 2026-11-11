import { Target, FileText, Briefcase, CreditCard, Plane, FolderOpen } from "lucide-react";

// Menu sections. Career and Business now live together under "Work".
export const SECTION_META = {
  goals:    { label: "Goals",    Icon: Target,     path: "/goals" },
  notes:    { label: "Notes",    Icon: FileText,   path: "/notes" },
  work:     { label: "Work",     Icon: Briefcase,  path: "/work", also: ["/career", "/business"] },
  finance:  { label: "Finance",  Icon: CreditCard, path: "/finance" },
  travel:   { label: "Journeys", Icon: Plane,      path: "/travel" },
  projects: { label: "Projects", Icon: FolderOpen, path: "/projects" },
};
export const DEFAULT_SECTION_ORDER = ["goals", "notes", "work", "finance", "travel", "projects"];

// Older saved settings list "career" and "business" separately: fold them into "work" where the first one sat.
export function normalizeSections(list) {
  if (!Array.isArray(list)) return list;
  const out = [];
  list.forEach((id) => {
    const v = id === "career" || id === "business" ? "work" : id;
    if (!out.includes(v)) out.push(v);
  });
  return out;
}
export function normalizeOrder(list) {
  const out = normalizeSections(list && list.length ? list : DEFAULT_SECTION_ORDER);
  DEFAULT_SECTION_ORDER.forEach((id) => { if (!out.includes(id)) out.push(id); });
  return out;
}
export const isSectionActive = (meta, pathname) => pathname === meta.path || (meta.also || []).includes(pathname);
