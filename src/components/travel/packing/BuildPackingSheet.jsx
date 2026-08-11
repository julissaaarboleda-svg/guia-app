import { X, Loader2, Check } from "lucide-react";
import { useState } from "react";

const STYLES = [
  { id: "light", label: "Light", desc: "Minimal essentials only" },
  { id: "standard", label: "Standard", desc: "Balanced for most trips" },
  { id: "extra", label: "Extra Prepared", desc: "Comforts and backups" },
];

const LAUNDRY = [
  { id: "yes", label: "Yes", desc: "I'll do laundry mid-trip" },
  { id: "no", label: "No", desc: "Pack enough for the whole trip" },
];

const LUGGAGE = [
  { id: "carry-on", label: "Carry-on Only", desc: "Space is limited" },
  { id: "checked", label: "Checked Bag", desc: "More room available" },
];

function OptionGroup({ label, options, value, onChange }) {
  return (
    <div>
      <p className="font-body text-[11px] text-muted-foreground mb-2 uppercase tracking-wide">{label}</p>
      <div className="grid grid-cols-3 gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`rounded-xl border p-2.5 text-left transition-colors ${
              value === o.id
                ? "border-[#555B40] bg-[#555B40]/10"
                : "border-border bg-secondary/40 hover:border-foreground/20"
            }`}
          >
            <p className="font-heading text-[12px] font-medium text-foreground leading-tight">{o.label}</p>
            <p className="font-body text-[10px] text-muted-foreground mt-0.5 leading-tight">{o.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function BuildPackingSheet({ open, onClose, onBuild, generating }) {
  const [style, setStyle] = useState("standard");
  const [laundry, setLaundry] = useState("no");
  const [luggage, setLuggage] = useState("checked");

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-t-3xl md:rounded-2xl w-full max-w-md shadow-editorial flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 pb-3">
          <div>
            <h2 className="font-heading text-[18px] text-foreground">Build your packing list</h2>
            <p className="font-body text-[12px] text-muted-foreground mt-0.5">Help us personalize your packing list for this journey.</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
          <OptionGroup label="Packing style" options={STYLES} value={style} onChange={setStyle} />
          <OptionGroup label="Laundry during trip" options={LAUNDRY} value={laundry} onChange={setLaundry} />
          <OptionGroup label="Luggage" options={LUGGAGE} value={luggage} onChange={setLuggage} />
        </div>
        <div className="p-5 pt-3 border-t border-border">
          <button
            onClick={() => onBuild({ style, laundry, luggage })}
            disabled={generating}
            className="w-full flex items-center justify-center gap-2 bg-accent text-accent-foreground py-3 rounded-xl text-[14px] font-medium hover:opacity-90 transition-colors disabled:opacity-60"
          >
            {generating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Building your list…</>
            ) : (
              <><Check className="w-4 h-4" /> Build my packing list</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}