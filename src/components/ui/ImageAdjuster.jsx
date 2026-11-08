import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Move, RotateCcw } from "lucide-react";
import AdjustableImage from "@/components/ui/AdjustableImage";
import { normPos, DEFAULT_POS } from "@/lib/imagePos";

// Drag the photo to reposition it, use the slider to zoom. Saves a position, not a new file.
// `aspect` is the shape of the place the photo is shown (width / height); `round` previews a circle.
export default function ImageAdjuster({ open, src, pos, aspect = 16 / 10, round = false, title = "Adjust photo", onSave, onClose }) {
  const [p, setP] = useState(DEFAULT_POS);
  const frameRef = useRef(null);
  const drag = useRef(null);

  useEffect(() => { if (open) setP(normPos(pos)); }, [open, pos]);
  if (!open || !src) return null;

  const clamp = (v) => Math.min(100, Math.max(0, v));
  const down = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { sx: e.clientX, sy: e.clientY, x: p.x, y: p.y };
  };
  const move = (e) => {
    const d = drag.current;
    const el = frameRef.current;
    if (!d || !el) return;
    const r = el.getBoundingClientRect();
    // Dragging right shows more of the left side, so the focal point moves the opposite way.
    const k = 1.6 / p.z;
    setP((cur) => ({ ...cur, x: clamp(d.x - ((e.clientX - d.sx) / r.width) * 100 * k), y: clamp(d.y - ((e.clientY - d.sy) / r.height) * 100 * k) }));
  };
  const up = () => { drag.current = null; };

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl p-5 pb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-lg text-foreground">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground"><X className="w-4 h-4" strokeWidth={1.5} /></button>
        </div>
        <div
          ref={frameRef}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          className={`relative overflow-hidden bg-muted mx-auto touch-none cursor-grab active:cursor-grabbing select-none ${round ? "rounded-full" : "rounded-2xl"}`}
          style={{ aspectRatio: String(aspect), width: round ? "70%" : "100%" }}
        >
          <AdjustableImage src={src} pos={p} draggable={false} className="pointer-events-none" />
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 text-[10.5px] text-white bg-black/45 rounded-full px-2.5 py-1 pointer-events-none">
            <Move className="w-3 h-3" strokeWidth={1.5} /> Drag to reposition
          </span>
        </div>
        <label className="flex items-center gap-3 mt-4 text-xs text-muted-foreground">
          <span className="w-10">Zoom</span>
          <input type="range" min="1" max="3" step="0.05" value={p.z} onChange={(e) => setP((c) => ({ ...c, z: Number(e.target.value) }))} className="flex-1 accent-[#A7773F]" />
        </label>
        <div className="flex items-center gap-2 mt-5">
          <button onClick={() => { onSave(p); onClose(); }} className="flex-1 bg-[#A7773F] text-[#F7F3EC] py-2.5 rounded-full text-sm font-medium hover:opacity-90">Save</button>
          <button onClick={() => setP(DEFAULT_POS)} className="inline-flex items-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground"><RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} /> Reset</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
