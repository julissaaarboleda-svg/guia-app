import { Luggage, Loader2 } from "lucide-react";

export default function PackingProgress({ packed, total, hasList, generating, onBuild }) {
  const pct = total > 0 ? Math.round((packed / total) * 100) : 0;
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-heading text-[16px] text-foreground">Packing progress</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-heading text-[28px] leading-none font-semibold text-foreground">{pct}%</span>
            <span className="font-body text-[11px] text-muted-foreground">{packed} of {total} packed</span>
          </div>
          <div className="w-full h-1.5 bg-[#E7D9C6] rounded-full overflow-hidden mt-2.5">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: "#A7773F" }}
            />
          </div>
        </div>
        <button
          onClick={onBuild}
          disabled={generating}
          className="w-[116px] flex-shrink-0 rounded-xl p-2.5 flex flex-col items-center justify-center gap-1.5 text-center hover:opacity-90 transition-opacity disabled:opacity-60"
          style={{ background: "#F0E6D6", border: "1px solid #E7D9C6" }}
        >
          <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "#A7773F" }}>
            {generating ? (
              <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
            ) : (
              <Luggage className="w-3.5 h-3.5 text-white" strokeWidth={1.5} />
            )}
          </div>
          <span className="font-heading text-[11px] font-medium text-foreground leading-tight">
            {hasList ? "Update packing list" : "Build my packing list"}
          </span>
        </button>
      </div>
    </div>
  );
}