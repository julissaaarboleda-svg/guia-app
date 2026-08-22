import { useState, useMemo } from "react";
import { ArrowLeft, ImageIcon, MapPin } from "lucide-react";
import { format, parseISO } from "date-fns";
import { pickCoverImage, visiblePlaces, visibleMedia, tripDuration } from "@/lib/memoryUtils";
import { base44 } from "@/api/base44Client";

function dateRangeLabel(trip) {
  if (!trip.start_date) return "";
  const start = format(parseISO(trip.start_date), "MMM d");
  const end = trip.end_date ? format(parseISO(trip.end_date), "d") : null;
  return end ? `${start} – ${end}` : start;
}

function CoverSlide({ trip, coverUrl, days, placesCount, photosCount, onChangeCover, uploading }) {
  const cities = trip.cities || [];
  return (
    <div className="absolute inset-0">
      {coverUrl ? (
        <img src={coverUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-[#2E2A27] to-[#7D8A53]" />
      )}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(180deg, rgba(46,42,39,0.15) 0%, rgba(46,42,39,0.05) 35%, rgba(46,42,39,0.92) 100%)" }}
      />

      <label className={`absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center transition-opacity ${uploading ? "opacity-60" : "cursor-pointer hover:bg-black/55"}`}>
        <ImageIcon className="w-3.5 h-3.5 text-white" />
        <input type="file" accept="image/*,image/heic,image/heif,.heic,.heif" className="hidden" onChange={onChangeCover} disabled={uploading} />
      </label>

      <div className="absolute left-4 right-4 bottom-6 text-white">
        {dateRangeLabel(trip) && (
          <span className="inline-block font-body text-[9px] px-2.5 py-1 rounded-full mb-2" style={{ background: "#A7773F" }}>
            {dateRangeLabel(trip)}
          </span>
        )}
        <p className="font-heading text-2xl leading-tight mb-2.5">{trip.title}</p>
        {cities.length > 0 && (
          <div className="flex items-center flex-wrap gap-1 mb-3">
            {cities.map((c, i) => (
              <span key={c} className="inline-flex items-center gap-1">
                {i > 0 && <span className="w-3.5 h-px bg-white/40" />}
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
              </span>
            ))}
            <span className="font-body text-[10px] text-white/75 ml-1">{cities.length} cit{cities.length !== 1 ? "ies" : "y"}</span>
          </div>
        )}
        <div className="flex gap-4">
          {days != null && (
            <div><p className="font-heading text-base leading-none">{days}</p><p className="font-body text-[9.5px] text-white/70 mt-1">days</p></div>
          )}
          <div><p className="font-heading text-base leading-none">{placesCount}</p><p className="font-body text-[9.5px] text-white/70 mt-1">place{placesCount !== 1 ? "s" : ""} saved</p></div>
          <div><p className="font-heading text-base leading-none">{photosCount}</p><p className="font-body text-[9.5px] text-white/70 mt-1">photo{photosCount !== 1 ? "s" : ""}</p></div>
        </div>
      </div>
    </div>
  );
}

function PlacesSlide({ places }) {
  const shown = places.slice(0, 6);
  return (
    <div className="absolute inset-0 bg-[#2E2A27] flex flex-col">
      <p className="font-heading text-lg text-white px-4 pt-6 pb-3">Favorite places</p>
      <div className="flex-1 grid grid-cols-2 gap-1.5 px-4 pb-6 overflow-y-auto">
        {shown.map((p) => (
          <div key={p.id} className="relative rounded-lg overflow-hidden bg-muted aspect-square">
            {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-[#7D8A53]" />}
            <div className="absolute inset-x-0 bottom-0 bg-black/50 px-2 py-1">
              <p className="font-body text-[10px] text-white truncate">{p.name}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhotosSlide({ media }) {
  const shown = media.slice(0, 6);
  return (
    <div className="absolute inset-0 bg-[#2E2A27] flex flex-col">
      <p className="font-heading text-lg text-white px-4 pt-6 pb-3">Moments captured</p>
      <div className="flex-1 grid grid-cols-2 gap-1.5 px-4 pb-6 overflow-y-auto">
        {shown.map((m, i) => (
          <div key={i} className="rounded-lg overflow-hidden bg-muted aspect-square">
            {m.type === "photo" ? <img src={m.url} alt="" className="w-full h-full object-cover" /> : <video src={m.url} className="w-full h-full object-cover" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function ClosingSlide({ trip, reflection, placesCount, photosCount }) {
  return (
    <div className="absolute inset-0 bg-[#2E2A27] flex flex-col items-center justify-center text-center px-6">
      <p className="font-body text-[9px] tracking-[0.15em] uppercase text-white/50 mb-3">Guía</p>
      <p className="font-heading text-xl text-white leading-snug mb-4">{reflection}</p>
      <p className="font-body text-[11px] text-white/60">{trip.title} · {placesCount} places · {photosCount} photos</p>
    </div>
  );
}

export default function StoryPreviewPage({ trip, onUpdate, onBack }) {
  const savedCover = pickCoverImage(trip);
  const coverUrl = trip.story_cover_url || savedCover;
  const places = visiblePlaces(trip);
  const media = visibleMedia(trip);
  const photosCount = media.filter((m) => m.type === "photo").length;
  const days = tripDuration(trip);
  const journalEntries = (trip.journal_entries || []).filter((e) => e.note).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const reflection = journalEntries[0]?.note || "A journey to remember.";

  const [uploading, setUploading] = useState(false);
  const [slide, setSlide] = useState(0);

  const slides = useMemo(() => {
    const s = ["cover"];
    if (places.length > 0) s.push("places");
    if (photosCount > 0) s.push("photos");
    s.push("closing");
    return s;
  }, [places.length, photosCount]);

  const goNext = () => setSlide((s) => Math.min(s + 1, slides.length - 1));
  const goPrev = () => setSlide((s) => Math.max(s - 1, 0));

  const changeCover = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const updated = await base44.entities.Trip.update(trip.id, { story_cover_url: file_url });
      onUpdate(updated);
    } catch (err) {
      console.error("Cover change failed:", err);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const current = slides[slide];

  return (
    <div className="p-4 space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <h2 className="font-heading text-lg text-foreground">Story Preview</h2>

      <div className="relative aspect-[9/16] max-w-[280px] mx-auto rounded-2xl overflow-hidden">
        {current === "cover" && (
          <CoverSlide
            trip={trip} coverUrl={coverUrl} days={days}
            placesCount={places.length} photosCount={photosCount}
            onChangeCover={changeCover} uploading={uploading}
          />
        )}
        {current === "places" && <PlacesSlide places={places} />}
        {current === "photos" && <PhotosSlide media={media} />}
        {current === "closing" && <ClosingSlide trip={trip} reflection={reflection} placesCount={places.length} photosCount={photosCount} />}

        {/* Progress bar */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex gap-1 z-10">
          {slides.map((s, i) => (
            <div key={s} className="flex-1 h-[2px] rounded-full bg-white/30 overflow-hidden">
              <div className="h-full bg-white" style={{ width: i < slide ? "100%" : i === slide ? "100%" : "0%" }} />
            </div>
          ))}
        </div>

        {/* Tap zones for navigation */}
        <button onClick={goPrev} className="absolute left-0 top-0 bottom-0 w-1/3 z-[5]" aria-label="Previous slide" />
        <button onClick={goNext} className="absolute right-0 top-0 bottom-0 w-2/3 z-[5]" aria-label="Next slide" />
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Tap the sides to browse slides. A shareable export (Instagram/TikTok) isn't wired up yet — this is a live preview.
      </p>
    </div>
  );
}
