import { ChevronUp, ChevronDown } from "lucide-react";

// Props confirmed from Settings.jsx. Simpler up/down-arrow reordering rather than
// full drag-and-drop — functionally equivalent, less new UI surface to get wrong.
export default function SectionOrderEditor({ enabledSections, sectionOrder, onReorder }) {
  const visible = sectionOrder.filter((id) => enabledSections.includes(id));

  const move = (id, dir) => {
    const idx = sectionOrder.indexOf(id);
    const swapWith = dir === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= sectionOrder.length) return;
    const next = [...sectionOrder];
    [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
    onReorder(next);
  };

  return (
    <div className="space-y-1">
      {visible.map((id) => (
        <div key={id} className="flex items-center justify-between bg-muted rounded-lg px-3 py-2">
          <span className="text-sm text-foreground capitalize">{id}</span>
          <div className="flex gap-1">
            <button onClick={() => move(id, "up")} className="p-1 text-muted-foreground hover:text-foreground"><ChevronUp className="w-4 h-4" /></button>
            <button onClick={() => move(id, "down")} className="p-1 text-muted-foreground hover:text-foreground"><ChevronDown className="w-4 h-4" /></button>
          </div>
        </div>
      ))}
    </div>
  );
}
