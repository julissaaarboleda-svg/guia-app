import { useState, useMemo } from "react";
import { MapPin, Camera, Heart, Play, ChevronRight, Sparkles, Star } from "lucide-react";
import { parseISO, format } from "date-fns";
import { tripMonthYear, tripDuration, memoriesTotal, pickCoverImage, reflectionLine, computeStoryProgress, continueArea, visiblePlaces, visibleMedia, visibleNotes } from "@/lib/memoryUtils";
import MemoriesCover from "./memories/MemoriesCover";
import StoryProgressCard from "./memories/StoryProgressCard";
import FavoritePlacesPage from "./memories/FavoritePlacesPage";
import PhotosVideosPage from "./memories/PhotosVideosPage";
import NotesReflectionsPage from "./memories/NotesReflectionsPage";
import StoryPreviewPage from "./memories/StoryPreviewPage";

export default function MemoriesTab({ trip, onUpdate }) {
  const [view, setView] = useState(null);
  const my = tripMonthYear(trip);
  const dur = tripDuration(trip);
  const total = memoriesTotal(trip);
  const places = visiblePlaces(trip);
  const media = trip.memory_media || [];
  const notes = visibleNotes(trip);
  const photos = media.filter((m) => m.type === "photo").length;
  const videos = media.filter((m) => m.type === "video").length;
  const cover = useMemo(() => pickCoverImage(trip), [trip]);
  const reflection = useMemo(() => reflectionLine(trip), [trip]);
  const placePreviews = useMemo(() => {
    const fav = places.filter((p) => p.favorited && p.image);
    const rest = places.filter((p) => p.image && !p.favorited);
    return [...fav, ...rest].slice(0, 4);
  }, [places]);
  const mediaPreviews = useMemo(() => {
    const fav = media.filter((m) => m.favorited);
    const rest = media.filter((m) => !m.favorited);
    return [...fav, ...rest].slice(0, 4);
  }, [media]);
  const favNote = useMemo(() => notes.find((n) => n.favorited) || notes[0], [notes]);

  if (view === "places") return <FavoritePlacesPage trip={trip} onUpdate={onUpdate} onBack={() => setView(null)} />;
  if (view === "photos") return <PhotosVideosPage trip={trip} onUpdate={onUpdate} onBack={() => setView(null)} />;
  if (view === "notes") return <NotesReflectionsPage trip={trip} onUpdate={onUpdate} onBack={() => setView(null)} />;
  if (view === "story") return <StoryPreviewPage trip={trip} onUpdate={onUpdate} onBack={() => setView(null)} />;

  return (
    <div className="space-y-4">
      {/* Sub-header: month/year + metadata */}
      <div className="flex items-center gap-1.5 flex-wrap font-body text-[12px] text-muted-foreground">
        {my && <span className="font-heading text-[14px] text-foreground font-semibold">{my}</span>}
        {dur && <span>· {dur} days</span>}
        <span>· {(trip.cities || []).length} cities</span>
        <span>· {total} memories</span>
      </div>

      <MemoriesCover cover={cover} reflection={reflection} tripName={trip.title} />

      <StoryProgressCard trip={trip} onContinue={(area) => setView(area)} />

      {/* 2-column grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <MemoryCard
          icon={<MapPin className="w-4 h-4" />}
          title="Favorite Places"
          subtitle="The places that made this trip special."
          count={`${places.length} places saved`}
          previews={placePreviews.map((p) => p.image).filter(Boolean)}
          empty="No favorite places yet."
          onClick={() => setView("places")}
        />
        <MemoryCard
          icon={<Camera className="w-4 h-4" />}
          title="Photos & Videos"
          subtitle="Your moments, all in one place."
          count={`${photos} photos · ${videos} videos`}
          previews={mediaPreviews.map((m) => m.thumbnail || m.url).filter(Boolean)}
          empty="No moments added yet."
          onClick={() => setView("photos")}
        />
        <MemoryCard
          icon={<Heart className="w-4 h-4" />}
          title="Notes & Reflections"
          subtitle="What you felt and want to remember."
          count={`${notes.length} notes`}
          previewQuote={favNote?.text}
          previewImg={favNote?.photo_url}
          empty="Nothing written yet."
          onClick={() => setView("notes")}
        />
        <MemoryCard
          icon={<Play className="w-4 h-4" />}
          title="Story Preview"
          subtitle="See your journey come to life."
          count={total > 0 ? "Ready to share" : "Add memories to begin"}
          storyThumb={cover}
          empty="Your story will appear here."
          onClick={() => setView("story")}
        />
      </div>

      {/* Story callout */}
      <div className="flex items-center gap-3 bg-card border border-border rounded-2xl p-3.5">
        <div className="flex-1 min-w-0">
          <p className="font-heading text-[13px] text-foreground font-semibold leading-tight">Turn your memories into a beautiful story.</p>
          <p className="font-body text-[10.5px] text-muted-foreground mt-0.5 leading-snug">Share on Instagram, TikTok, or keep it as your personal travel journal.</p>
        </div>
        <button onClick={() => setView("story")} className="flex-shrink-0 inline-flex items-center gap-1 h-8 px-3.5 rounded-full bg-accent text-accent-foreground font-body text-[11px] font-medium hover:opacity-90">View Story</button>
      </div>
    </div>
  );
}

function MemoryCard({ icon, title, subtitle, count, previews, previewQuote, previewImg, storyThumb, empty, onClick }) {
  return (
    <button onClick={onClick} className="text-left bg-card border border-border rounded-2xl p-3.5 flex flex-col hover:border-accent/40 transition-colors">
      <div className="flex items-center gap-1.5 text-accent mb-1.5">{icon}</div>
      <h3 className="font-heading text-[14px] text-foreground font-semibold leading-tight">{title}</h3>
      <p className="font-body text-[10px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">{subtitle}</p>
      <p className="font-body text-[10px] text-muted-foreground/80 mt-1.5 mb-2">{count}</p>

      <div className="mt-auto">
        {previews && previews.length > 0 ? (
          <div className="flex -space-x-2">
            {previews.slice(0, 4).map((src, i) => (
              <div key={i} className="w-9 h-9 rounded-full border-2 border-card bg-muted overflow-hidden">
                <img src={src} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        ) : previewQuote ? (
          <div className="flex items-center gap-2">
            {previewImg && <div className="w-9 h-9 rounded-lg bg-muted overflow-hidden flex-shrink-0"><img src={previewImg} alt="" className="w-full h-full object-cover" /></div>}
            <p className="font-body text-[10.5px] text-muted-foreground italic line-clamp-2 flex-1">"{previewQuote.length > 60 ? previewQuote.slice(0, 60) + "…" : previewQuote}"</p>
          </div>
        ) : storyThumb ? (
          <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden bg-muted max-w-[60px]">
            <img src={storyThumb} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/25"><Play className="w-4 h-4 text-white fill-white" /></div>
          </div>
        ) : (
          <p className="font-body text-[10px] text-muted-foreground/70 italic">{empty}</p>
        )}
      </div>
      <div className="flex items-center justify-end mt-2">
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
      </div>
    </button>
  );
}