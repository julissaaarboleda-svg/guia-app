import { useState, useMemo, useEffect } from "react";
import { MapPin, Camera, Heart, ChevronRight, Sparkles, Star } from "lucide-react";
import { parseISO, format } from "date-fns";
import { tripDuration, pickCoverImage, computeStoryProgress, continueArea, visiblePlaces, visibleMedia } from "@/lib/memoryUtils";
import MemoriesCover from "./memories/MemoriesCover";
import StoryProgressCard from "./memories/StoryProgressCard";
import FavoritePlacesPage from "./memories/FavoritePlacesPage";
import PhotosVideosPage from "./memories/PhotosVideosPage";
import NotesReflectionsPage from "./memories/NotesReflectionsPage";
import StoryPreviewPage from "./memories/StoryPreviewPage";
import TripRouteMap from "./memories/TripRouteMap";

export default function MemoriesTab({ trip, onUpdate }) {
  const [view, setView] = useState(null);
  const dur = tripDuration(trip);
  const places = visiblePlaces(trip);
  const media = trip.memory_media || [];
  const journalEntries = (trip.journal_entries || []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const photos = media.filter((m) => m.type === "photo").length;
  const videos = media.filter((m) => m.type === "video").length;
  const cover = useMemo(() => pickCoverImage(trip), [trip]);
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
  const favNote = useMemo(() => journalEntries.find((e) => e.note), [journalEntries]);
  const favNoteText = favNote?.note ? favNote.note.replace(/<[^>]*>/g, "").trim() : null;

  // Switching to a sub-view (Places, Photos, Notes, Story) doesn't trigger a
  // real page navigation — it's a client-side swap within the same
  // component — so nothing scrolls back to the top on its own. The app's
  // actual scrollable area is an inner <main>, not necessarily the window,
  // so reset both to be safe.
  useEffect(() => {
    document.querySelector("main")?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [view]);

  if (view === "places") return <FavoritePlacesPage trip={trip} onUpdate={onUpdate} onBack={() => setView(null)} />;
  if (view === "photos") return <PhotosVideosPage trip={trip} onUpdate={onUpdate} onBack={() => setView(null)} />;
  if (view === "notes") return <NotesReflectionsPage trip={trip} onUpdate={onUpdate} onBack={() => setView(null)} />;
  if (view === "story") return <StoryPreviewPage trip={trip} onUpdate={onUpdate} onBack={() => setView(null)} />;

  return (
    <div className="space-y-4">
      <MemoriesCover trip={trip} cover={cover} days={dur} placesCount={places.length} photosCount={photos} />

      <StoryProgressCard trip={trip} onContinue={(area) => setView(area)} />

      <div className="grid grid-cols-2 gap-2.5">
        <MemoryCard
          icon={<Camera className="w-4 h-4" />}
          title="Photos & Videos"
          subtitle="Your moments, all in one place."
          count={`${photos} photos · ${videos} videos`}
          images={mediaPreviews.map((m) => m.thumbnail || m.url).filter(Boolean)}
          extraCount={Math.max(0, media.length - mediaPreviews.length)}
          empty="No moments added yet."
          onClick={() => setView("photos")}
        />
        <MemoryCard
          icon={<MapPin className="w-4 h-4" />}
          title="Favorite Places"
          subtitle="The places that made this trip special."
          count={`${places.length} places saved`}
          images={placePreviews.map((p) => p.image).filter(Boolean)}
          extraCount={Math.max(0, places.length - placePreviews.length)}
          empty="No favorite places yet."
          onClick={() => setView("places")}
        />
        <MemoryCard
          icon={<Heart className="w-4 h-4" />}
          title="Notes & Reflections"
          subtitle="What you felt and want to remember."
          count={`${journalEntries.length} note${journalEntries.length !== 1 ? "s" : ""}`}
          quote={favNoteText}
          quoteImage={favNote?.photo_url}
          empty="Nothing written yet."
          onClick={() => setView("notes")}
        />
        <TripRouteMap trip={trip} />
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

function CoverBand({ images, extraCount, quote, quoteImage, dark }) {
  if (quote && quoteImage) {
    return (
      <div className="relative h-[52px] rounded-xl overflow-hidden bg-muted mb-1.5">
        <img src={quoteImage} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-2.5 pb-1.5">
          <p className="font-heading text-[11.5px] text-white italic leading-snug line-clamp-1">
            "{quote.length > 50 ? quote.slice(0, 50) + "…" : quote}"
          </p>
        </div>
      </div>
    );
  }
  if (quote) {
    return (
      <div className={`h-[52px] rounded-xl flex items-center px-3 mb-1.5 ${dark ? "bg-[#2E2A27]" : "bg-secondary"}`}>
        <p className={`font-heading text-[13px] italic leading-snug line-clamp-2 ${dark ? "text-background" : "text-foreground"}`}>
          "{quote.length > 70 ? quote.slice(0, 70) + "…" : quote}"
        </p>
      </div>
    );
  }
  if (!images || images.length === 0) return null;
  const shown = images.slice(0, 3);
  if (shown.length === 1) {
    return (
      <div className="h-[52px] rounded-xl overflow-hidden bg-muted mb-1.5">
        <img src={shown[0]} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }
  if (shown.length === 2) {
    return (
      <div className="h-[52px] rounded-xl overflow-hidden mb-1.5 grid grid-cols-2 gap-[3px]">
        {shown.map((src, i) => (
          <div key={i} className="bg-muted overflow-hidden"><img src={src} alt="" className="w-full h-full object-cover" /></div>
        ))}
      </div>
    );
  }
  // 3+: big photo + two stacked smaller ones, with a "+N" overlay if there's more beyond what's shown
  return (
    <div className="h-[52px] rounded-xl overflow-hidden mb-1.5 grid grid-cols-[2fr_1fr] gap-[3px]">
      <div className="bg-muted overflow-hidden"><img src={shown[0]} alt="" className="w-full h-full object-cover" /></div>
      <div className="grid grid-rows-2 gap-[3px]">
        <div className="bg-muted overflow-hidden"><img src={shown[1]} alt="" className="w-full h-full object-cover" /></div>
        <div className="relative bg-muted overflow-hidden">
          <img src={shown[2]} alt="" className="w-full h-full object-cover" />
          {extraCount > 0 && (
            <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
              <span className="font-body text-[10px] text-white font-medium">+{extraCount}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MemoryCard({ icon, title, subtitle, count, images, extraCount, quote, quoteImage, empty, onClick, wide }) {
  const dark = !!quote && !quoteImage; // Only go dark/text-only when there's truly no photo to show
  const hasCover = (images && images.length > 0) || quote;
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-2xl p-2.5 flex flex-col transition-colors ${wide ? "w-full" : ""} ${
        dark ? "bg-[#2E2A27] hover:bg-[#3a3531]" : "bg-card border border-border hover:border-accent/40"
      }`}
    >
      {hasCover && <CoverBand images={images} extraCount={extraCount} quote={quote} quoteImage={quoteImage} dark={dark} />}
      <div className={`flex items-center gap-1.5 mb-0.5 ${dark ? "text-[#A7773F]" : "text-accent"}`}>{icon}</div>
      <h3 className={`font-heading text-[14px] font-semibold leading-tight ${dark ? "text-background" : "text-foreground"}`}>{title}</h3>
      <p className={`font-body text-[10px] mt-0.5 leading-snug line-clamp-1 ${dark ? "text-background/60" : "text-muted-foreground"}`}>{subtitle}</p>
      <p className={`font-body text-[10px] mt-1 ${dark ? "text-background/50" : "text-muted-foreground/80"}`}>{count}</p>

      {!hasCover && (
        <p className={`font-body text-[10px] italic mt-1 ${dark ? "text-background/40" : "text-muted-foreground/70"}`}>{empty}</p>
      )}

      <div className="flex items-center justify-end mt-1">
        <ChevronRight className={`w-3.5 h-3.5 ${dark ? "text-background/40" : "text-muted-foreground/60"}`} />
      </div>
    </button>
  );
}
