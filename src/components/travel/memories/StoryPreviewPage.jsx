import { ArrowLeft } from "lucide-react";
import { pickCoverImage, visiblePlaces, visibleMedia } from "@/lib/memoryUtils";

export default function StoryPreviewPage({ trip, onBack }) {
  const cover = pickCoverImage(trip);
  const places = visiblePlaces(trip);
  const media = visibleMedia(trip);

  return (
    <div className="p-4 space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <h2 className="font-heading text-lg text-foreground">Story Preview</h2>
      <div className="relative aspect-[9/16] max-w-[280px] mx-auto rounded-2xl overflow-hidden bg-muted">
        {cover && <img src={cover} alt="" className="w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4 text-white">
          <p className="font-heading text-lg font-semibold">{trip.title}</p>
          <p className="text-xs opacity-80 mt-1">{places.length} places · {media.length} moments</p>
        </div>
      </div>
      <p className="text-xs text-center text-muted-foreground">
        A shareable story format (Instagram/TikTok export) isn't wired up yet — this is a static preview.
      </p>
    </div>
  );
}
