import { ArrowLeft, Upload } from "lucide-react";
import { visibleMedia } from "@/lib/memoryUtils";
import { base44 } from "@/api/base44Client";

export default function PhotosVideosPage({ trip, onUpdate, onBack }) {
  const media = visibleMedia(trip);

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const isVideo = file.type.startsWith("video/");
    const updated = await base44.entities.Trip.update(trip.id, {
      memory_media: [...(trip.memory_media || []), { url: file_url, type: isVideo ? "video" : "photo", favorited: false }],
    });
    onUpdate(updated);
  };

  return (
    <div className="p-4 space-y-3">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg text-foreground">Photos & Videos</h2>
        <label className="flex items-center gap-1.5 text-xs font-medium bg-accent text-accent-foreground px-3 py-1.5 rounded-full cursor-pointer hover:opacity-90">
          <Upload className="w-3.5 h-3.5" /> Add
          <input type="file" accept="image/*,video/*" className="hidden" onChange={upload} />
        </label>
      </div>
      {media.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No photos or videos yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {media.map((m, i) => (
            <div key={i} className="aspect-square rounded-lg overflow-hidden bg-muted">
              {m.type === "photo" ? <img src={m.url} alt="" className="w-full h-full object-cover" /> : <video src={m.url} className="w-full h-full object-cover" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
