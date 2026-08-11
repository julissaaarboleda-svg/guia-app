import { ChevronDown } from "lucide-react";
import { useState } from "react";

export default function PillDropdown({ label, value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value) || options[0];
  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 bg-card border border-border rounded-full pl-2.5 pr-1.5 h-6 font-body text-[10px] leading-none whitespace-nowrap text-foreground hover:border-foreground/25 transition-colors"
      >
        {label && <span className="text-muted-foreground">{label}</span>}
        <span className="font-medium">{current?.label}</span>
        <ChevronDown className="w-2.5 h-2.5 text-muted-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-50 mt-1 min-w-[150px] bg-card border border-border rounded-xl shadow-lg py-1 max-h-64 overflow-y-auto">
            {options.map((o) => (
              <button
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`w-full text-left px-3 py-2 font-body text-[12px] hover:bg-secondary transition-colors ${o.value === value ? "text-accent font-medium" : "text-foreground"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}