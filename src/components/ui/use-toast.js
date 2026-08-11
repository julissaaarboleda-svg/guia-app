import { toast as sonnerToast } from "sonner";

// Bridges the shadcn-style useToast()/toast({title, description, variant}) API
// (used in Notes.jsx, Settings.jsx) onto sonner (already used directly in
// SavedTab.jsx, ItineraryTab.jsx) — one underlying toast system instead of two.
function toast({ title, description, variant }) {
  const message = title || description || "";
  const opts = description && title ? { description } : undefined;
  if (variant === "destructive") {
    sonnerToast.error(message, opts);
  } else {
    sonnerToast.success(message, opts);
  }
}

export function useToast() {
  return { toast };
}

export { toast };
