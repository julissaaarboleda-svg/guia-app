import { useState, useRef } from "react";
import { X, Check } from "lucide-react";

const ROTATIONS = [-9, 7, 5, -6, -4, 8, -3, 6];

export default function ScrapbookEditor({ trip, allPhotos, onSave, onClose }) {
  const existingLayout = trip.scrapbook_layout || [];
  const existingUrls = existingLayout.map((l) => l.url);
  const [selected, setSelected] = useState(
    existingUrls.length > 0 ? existingUrls : allPhotos.slice(0, 5).map((p) => p.url)
  );
  const [positions, setPositions] = useState(() => {
    const map = {};
    existingLayout.forEach((l) => { map[l.url] = { top: l.top, left: l.left, rotate: l.rotate }; });
    return map;
  });
  const [step, setStep] = useState("select");
  const canvasRef = useRef(null);
  const dragRef = useRef(null);

  const toggle = (url) => {
    setSelected((prev) => (prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]));
  };

  const ensurePosition = (url, index) => {
    if (positions[url]) return positions[url];
    const col = index % 3;
    const row = Math.floor(index / 3);
    return {
      top: `${10 + row * 28}%`,
      left: `${10 + col * 28}%`,
      rotate: ROTATIONS[index % ROTATIONS.length],
    };
  };

  const onDrag = (e) => {
    if (!dragRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const pointer = e.touches ? e.touches[0] : e;
    const leftPct = ((pointer.clientX - rect.left) / rect.width) * 100 - dragRef.current.offsetLeft;
    const topPct = ((pointer.clientY - rect.top) / rect.height) * 100 - dragRef.current.offsetTop;
    const clampedLeft = Math.max(0, Math.min(78, leftPct));
    const clampedTop = Math.max(0, Math.min(80, topPct));
    setPositions((prev) => ({
      ...prev,
      [dragRef.current.url]: { ...(prev[dragRef.current.url] || {}), top: `${clampedTop}%`, left: `${clampedLeft}%` },
    }));
  };

  const endDrag = () => {
    dragRef.current = null;
    window.removeEventListener("mousemove", onDrag);
    window.removeEventListener("mouseup", endDrag);
    window.removeEventListener("touchmove", onDrag);
    window.removeEventListener("touchend", endDrag);
  };

  const startDrag = (e, url) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const idx = selected.indexOf(url);
    const pos = positions[url] || ensurePosition(url, idx);
    const currentLeftPct = parseFloat(pos.left);
    const currentTopPct = parseFloat(pos.top);
    const pointer = e.touches ? e.touches[0] : e;
    const pointerLeftPct = ((pointer.clientX - rect.left) / rect.width) * 100;
    const pointerTopPct = ((pointer.clientY - rect.top) / rect.height) * 100;
    dragRef.current = {
      url,
      offsetLeft: pointerLeftPct - currentLeftPct,
      offsetTop: pointerTopPct - currentTopPct,
    };
    window.addEventListener("mousemove", onDrag);
    window.addEventListener("mouseup", endDrag);
    window.addEventListener("touchmove", onDrag, { passive: false });
    window.addEventListener("touchend", endDrag);
  };

  const handleSave = () => {
    const layout = selected.map((url, i) => {
      const pos = positions[url] || ensurePosition(url, i);
      return { url, top: pos.top, left: pos.left, rotate: pos.rotate ?? ROTATIONS[i % ROTATIONS.length] };
    });
    onSave(layout);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="bg-card w-full md:max-w-md md:rounded-2xl rounded-t-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <h3 className="font-heading text-base text-foreground">
            {step === "select" ? "Choose scrapbook photos" : "Arrange your scrapbook"}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {step === "select" ? (
            allPhotos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No photos yet — add some in Photos & Videos first.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {allPhotos.map((p) => {
                  const isSelected = selected.includes(p.url);
                  return (
                    <button
                      key={p.url}
                      onClick={() => toggle(p.url)}
                      className="relative aspect-square rounded-lg overflow-hidden bg-muted"
                    >
                      <img src={p.url} alt="" className="w-full h-full object-cover" style={{ opacity: isSelected ? 1 : 0.4 }} />
                      <div className={`absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center ${isSelected ? "bg-accent" : "border border-white bg-black/20"}`}>
                        {isSelected && <Check className="w-2.5 h-2.5 text-accent-foreground" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )
          ) : (
            <div>
              <p className="text-xs text-muted-foreground mb-3">Tap and drag any photo to move it.</p>
              <div ref={canvasRef} className="relative w-full aspect-[9/16] bg-[#F7F3EC] rounded-xl overflow-hidden select-none">
                {selected.map((url, i) => {
                  const pos = positions[url] || ensurePosition(url, i);
                  return (
                    <div
                      key={url}
                      onMouseDown={(e) => startDrag(e, url)}
                      onTouchStart={(e) => startDrag(e, url)}
                      className="absolute bg-[#F7F3EC] border border-[#E3DED0] p-1 rounded-sm shadow-lg cursor-grab active:cursor-grabbing"
                      style={{ top: pos.top, left: pos.left, width: "30%", transform: `rotate(${pos.rotate}deg)`, touchAction: "none" }}
                    >
                      <div className="w-full aspect-square overflow-hidden">
                        <img src={url} alt="" className="w-full h-full object-cover pointer-events-none" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-border flex-shrink-0">
          {step === "select" ? (
            <button
              onClick={() => setStep("arrange")}
              disabled={selected.length === 0}
              className="flex-1 bg-accent text-accent-foreground py-2.5 rounded-lg text-sm font-medium disabled:opacity-40"
            >
              Next: Arrange ({selected.length})
            </button>
          ) : (
            <>
              <button onClick={() => setStep("select")} className="px-4 py-2.5 text-muted-foreground text-sm">Back</button>
              <button onClick={handleSave} className="flex-1 bg-accent text-accent-foreground py-2.5 rounded-lg text-sm font-medium">
                Save scrapbook
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
