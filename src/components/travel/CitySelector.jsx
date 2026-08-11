import { useState } from "react";
import { MapPin, ChevronDown, Check } from "lucide-react";

export default function CitySelector({ cities, value, onChange }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <p className="font-body text-[11px] text-muted-foreground uppercase tracking-[0.12em] mb-2">Currently exploring</p>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-card border border-border rounded-full pl-3.5 pr-2.5 py-2 hover:border-foreground/25 transition-colors"
      >
        <MapPin className="w-3.5 h-3.5 text-accent" strokeWidth={1.8} />
        <span className="font-heading text-sm text-foreground font-medium">{value || "Select city"}</span>
        <ChevronDown className="w-4 h-4 text-muted-foreground" strokeWidth={1.8} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-t-3xl md:rounded-2xl w-full max-w-sm p-5 shadow-[0_20px_50px_-28px_rgba(0,0,0,0.4)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-base text-foreground font-semibold">Switch city</h3>
              <button onClick={() => setOpen(false)} className="font-body text-sm text-muted-foreground hover:text-foreground transition-colors">
                Close
              </button>
            </div>
            <div className="space-y-1">
              {cities.map((c) => (
                <button
                  key={c}
                  onClick={() => { onChange(c); setOpen(false); }}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-left transition-colors ${
                    value === c ? "bg-secondary" : "hover:bg-secondary/60"
                  }`}
                >
                  <span className="font-body text-sm text-foreground font-medium">{c}</span>
                  {value === c && <Check className="w-4 h-4 text-accent" strokeWidth={2} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}