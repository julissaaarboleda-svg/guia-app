import {
  Plane, CreditCard, BookOpen, Briefcase, FileText, Target, FolderOpen, Laptop, CheckCircle,
} from "lucide-react";

// Shared visual identity for each life module across the Home screen.
// `color` is used for icon tint + faint chip backgrounds (inline styles, purge-safe).
export const MODULE_META = {
  travel:   { label: "Travel",   emoji: "✈️", Icon: Plane,      color: "#3E5C76" },
  finance:  { label: "Finance",  emoji: "💰", Icon: CreditCard,  color: "#5B7A4F" },
  goals:    { label: "Goals",    emoji: "📚", Icon: BookOpen,    color: "#7C6A52" },
  business: { label: "Business", emoji: "💼", Icon: Briefcase,   color: "#6A6B8B" },
  notes:    { label: "Notes",    emoji: "📝", Icon: FileText,    color: "#8B6A72" },
  projects: { label: "Projects", emoji: "🎯", Icon: Target,      color: "#5B7FA6" },
  career:   { label: "Career",   emoji: "💻", Icon: Laptop,      color: "#4A4A4A" },
  tasks:    { label: "Tasks",    emoji: "✓",  Icon: CheckCircle, color: "#6B7A5E" },
};

export function getModule(key) {
  return MODULE_META[key] || MODULE_META.tasks;
}

// Normalize a free-text Task.category into one of our module keys.
export function categoryToModule(cat) {
  if (!cat) return "tasks";
  const c = String(cat).toLowerCase();
  if (c.includes("travel")) return "travel";
  if (c.includes("finan") || c.includes("bill") || c.includes("money")) return "finance";
  if (c.includes("business") || c.includes("client")) return "business";
  if (c.includes("career") || c.includes("work") || c.includes("job")) return "career";
  if (c.includes("project")) return "projects";
  if (c.includes("goal")) return "goals";
  if (c.includes("note") || c.includes("writing")) return "notes";
  return "tasks";
}