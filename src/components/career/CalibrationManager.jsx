import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Props confirmed from Career.jsx. Manages PerformanceCalibration entities
// (name + scale_max, based on cal.name / cal.scale_max usage in Career.jsx).
export default function CalibrationManager({ isOpen, onClose, calibrations, onRefresh }) {
  const [name, setName] = useState("");
  const [scaleMax, setScaleMax] = useState("10");

  if (!isOpen) return null;

  const add = async () => {
    if (!name.trim()) return;
    await base44.entities.PerformanceCalibration.create({ name: name.trim(), scale_max: Number(scaleMax) || 10 });
    setName("");
    onRefresh();
  };

  const remove = async (id) => {
    await base44.entities.PerformanceCalibration.delete(id);
    onRefresh();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-card border border-border rounded-t-3xl md:rounded-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-base text-foreground">Manage calibrations</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex gap-2 mb-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Communication" className="flex-1 bg-muted border border-input rounded-lg px-3 py-2 text-sm outline-none focus:border-ring" />
          <input type="number" value={scaleMax} onChange={(e) => setScaleMax(e.target.value)} className="w-16 bg-muted border border-input rounded-lg px-2 text-sm" />
          <button onClick={add} className="px-3 bg-foreground text-background rounded-lg"><Plus className="w-4 h-4" /></button>
        </div>
        <div className="space-y-1">
          {calibrations.map((cal, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-t border-border text-sm">
              <span className="text-foreground">{cal.name} <span className="text-muted-foreground">/ {cal.scale_max}</span></span>
              <button onClick={() => remove(cal.id)} className="text-muted-foreground/50 hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
