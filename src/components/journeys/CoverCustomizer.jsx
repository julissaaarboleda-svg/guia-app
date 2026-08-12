import { useState } from "react";
import { X, Sparkles, Upload, RefreshCw, Check } from "lucide-react";
import { COVER_STYLES, generateCover } from "@/lib/journeyAi";
import { base44 } from "@/api/base44Client";

export default function CoverCustomizer({ trip, onClose, onUpdate, onRegenerating }) {
  const [style, setStyle] = useState("editorial");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  if (!trip) return null;

  const regenerate = async () => {
    setBusy(true);
    onRegenerating?.(true);
    try {
      const url = await generateCover(trip, style);
      const updated = await base44.entities.Trip.update(trip.id, { hero_image_url: url });
      onUpdate(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
      onRegenerating?.(false);
    }
  };

  const uploadPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const updated = await base44.entities.Trip.update(trip.id, { hero_image_url: file_url });
      onUpdate(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full md:max-w-md bg-card rounded-t-3xl md:rounded-3xl shadow-2xl border border-border max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="font-heading text-lg text-foreground">Customize Cover</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="h-1 w-10 rounded-full bg-border mx-auto mb-2" />

        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-5">
          {/* Preview */}
          <div className="relative aspect-[16/10] rounded-2xl overflow-hidden bg-secondary">
            {trip.hero_image_url ? (
              <img src={trip.hero_image_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-charcoal via-olive/40 to-forest/60" />
            )}
            {busy && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 backdrop-blur-sm">
                <div className="w-7 h-7 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <p className="font-body text-[12px] text-white/90">Composing cover…</p>
              </div>
            )}
          </div>

          {/* Style */}
          <div>
            <p className="font-body text-[11px] uppercase tracking-wider text-muted-foreground mb-2.5">Style</p>
            <div className="grid grid-cols-4 gap-2">
              {COVER_STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl border transition-all ${style === s.id ? "border-foreground bg-secondary" : "border-border hover:bg-secondary/60"}`}
                >
                  <span className={`w-3 h-3 rounded-full ${style === s.id ? "bg-foreground" : "bg-muted-foreground/30"}`} />
                  <span className="font-body text-[10px] text-foreground text-center leading-tight">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button
              onClick={regenerate}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 bg-foreground text-background py-3 rounded-xl text-[14px] font-medium hover:opacity-90 transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" /> {busy ? "Composing…" : "Regenerate Cover"}
            </button>

            <label className="w-full flex items-center justify-center gap-2 border border-border py-3 rounded-xl text-[14px] text-foreground hover:bg-secondary transition-colors cursor-pointer">
              <Upload className="w-4 h-4" /> {uploading ? "Uploading…" : "Upload Personal Photo"}
              <input type="file" accept="image/*,image/heic,image/heif,.heic,.heif" onChange={uploadPhoto} disabled={uploading} className="hidden" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}