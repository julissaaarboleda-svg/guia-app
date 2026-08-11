import { Plus } from "lucide-react";

// Usage seen throughout: <ActionCircle onClick={...} label="Add project" />
// Fixed bottom-right floating "+" button.
export default function ActionCircle({ onClick, label = "Add" }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="fixed z-40 flex items-center justify-center w-14 h-14 rounded-full bg-accent text-accent-foreground shadow-lg hover:opacity-90 transition-opacity"
      style={{ right: "20px", bottom: "calc(env(safe-area-inset-bottom, 20px) + 76px)" }}
    >
      <Plus className="w-6 h-6" strokeWidth={2} />
    </button>
  );
}
