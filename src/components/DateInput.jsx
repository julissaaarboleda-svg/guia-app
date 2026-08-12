import { Calendar } from "lucide-react";

// Consistent date-picker treatment across the whole app — a visible calendar
// icon inside the field at all times, so it's never unclear that a box is a
// date picker even when empty. Accepts the same props as a native <input type="date">.
export default function DateInput({ className = "", ...props }) {
  return (
    <div className="relative">
      <Calendar className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        type="date"
        className={`w-full bg-muted border border-input rounded-lg pl-8 pr-2.5 py-1.5 text-sm outline-none focus:border-ring ${className}`}
        {...props}
      />
    </div>
  );
}
