import { X, Upload } from "lucide-react";
import { useState } from "react";
import { base44 } from "@/api/base44Client";

export default function CoverCustomizer({ trip, onClose, onUpdate }) {
  const [uploading, setUploading] = useState(false);

  if (!trip) return null;

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
          </div>

          <label className="w-full flex items-center justify-center gap-2 border border-border py-3 rounded-xl text-[14px] text-foreground hover:bg-secondary transition-colors cursor-pointer">
            <Upload className="w-4 h-4" /> {uploading ? "Uploading…" : "Upload Personal Photo"}
            <input type="file" accept="image/*,image/heic,image/heif,.heic,.heif" onChange={uploadPhoto} disabled={uploading} className="hidden" />
          </label>
        </div>
      </div>
    </div>
  );
}
