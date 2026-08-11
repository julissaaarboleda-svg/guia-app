import { X, FileText, Sparkles, Loader2 } from "lucide-react";
import { ADD_TYPES } from "./activityTypes";

export default function AddItemSheet({ open, onClose, onPick, onImport, importing }) {
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
          <h2 className="font-heading text-lg text-foreground">Add itinerary item</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2">
          {ADD_TYPES.map(({ key, label, desc, Icon, color }) => (
            <button
              key={key}
              onClick={() => onPick(key)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:border-ring/40 hover:bg-secondary/60 transition-colors text-left"
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${color}1A` }}
              >
                <Icon className="w-4 h-4" strokeWidth={1.8} style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-body text-[14px] font-semibold text-foreground leading-tight">{label}</p>
                <p className="font-body text-[12px] text-muted-foreground mt-0.5">{desc}</p>
              </div>
            </button>
          ))}

          <div className="pt-3 mt-2 border-t border-border">
            <label
              className={`flex items-center gap-3 p-3 rounded-xl bg-secondary/50 ${importing ? "opacity-70 pointer-events-none" : "cursor-pointer hover:bg-secondary transition-colors"}`}
            >
              <input
                type="file"
                className="hidden"
                accept=".pdf,.txt,.doc,.docx,.html,.htm,.csv,.json,image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImport(f);
                  e.target.value = "";
                }}
                disabled={importing}
              />
              <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                {importing ? (
                  <Loader2 className="w-4 h-4 text-accent animate-spin" strokeWidth={1.8} />
                ) : (
                  <FileText className="w-4 h-4 text-muted-foreground" strokeWidth={1.8} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-body text-[14px] font-medium text-foreground leading-tight">Import from Email or Document</p>
                <p className="font-body text-[12px] text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-accent" />{" "}
                  {importing ? "Reading your file…" : "AI-assisted · upload a booking email or PDF"}
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}