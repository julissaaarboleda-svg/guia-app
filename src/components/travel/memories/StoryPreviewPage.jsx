import { useState, useMemo } from "react";
import { ArrowLeft, ImageIcon, MapPin, Pencil, X, Check } from "lucide-react";
import { format, parseISO } from "date-fns";
import { pickCoverImage, visiblePlaces, visibleMedia, tripDuration } from "@/lib/memoryUtils";
import { base44 } from "@/api/base44Client";

function dateRangeLabel(trip) {
  if (!trip.start_date) return "";
  const start = format(parseISO(trip.start_date), "MMM d");
  const end = trip.end_date ? format(parseISO(trip.end_date), "d") : null;
  return end ? `${start} – ${end}` : start;
}

// Small edit affordance shown in the corner of any slide that supports a
// quote — the person chooses which note (if any) shows on which slide,
// nothing is auto-matched.
function QuoteEditButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/40 flex items-center justify-center z-10"
      aria-label="Edit quote"
    >
      <Pencil className="w-3 h-3 text-white" />
    </button>
  );
}

function QuoteOverlay({ text }) {
  if (!text) return null;
  return (
    <div className="absolute inset-x-0 bottom-0 px-3.5 pb-3 pt-8 bg-gradient-to-t from-black/85 to-transparent">
      <p className="font-heading text-[12px] text-white italic leading-snug line-clamp-2">"{text}"</p>
    </div>
  );
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

function RouteSlide({ cities, quote, onEditQuote }) {
  return (
    <div className="absolute inset-0 bg-[#2E2A27] flex flex-col px-5 py-8">
      <QuoteEditButton onClick={onEditQuote} />
      <p className="font-heading text-lg text-white mb-6">Your route</p>
      <div className="flex-1 flex flex-col justify-center gap-1">
        {cities.map((c, i) => (
          <div key={c}>
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "#A7773F" }} />
              <span className="font-body text-[13px] text-white">{c}</span>
            </div>
            {i < cities.length - 1 && <div className="w-px h-4 ml-[3px]" style={{ background: "rgba(167,119,63,0.5)" }} />}
          </div>
        ))}
      </div>
      <QuoteOverlay text={quote} />
    </div>
  );
}

function PlacesSlide({ places, quote, onEditQuote }) {
  const shown = places.slice(0, 6);
  return (
    <div className="absolute inset-0 bg-[#2E2A27] flex flex-col">
      <QuoteEditButton onClick={onEditQuote} />
      <p className="font-heading text-lg text-white px-4 pt-6 pb-3">Favorite places</p>
      <div className="flex-1 grid grid-cols-2 gap-1.5 px-4 overflow-y-auto">
        {shown.map((p) => (
          <div key={p.id} className="relative rounded-lg overflow-hidden bg-muted aspect-square">
            {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-[#7D8A53]" />}
            <div className="absolute inset-x-0 bottom-0 bg-black/50 px-2 py-1">
              <p className="font-body text-[10px] text-white truncate">{p.name}</p>
            </div>
          </div>
        ))}
      </div>
      <QuoteOverlay text={quote} />
    </div>
  );
}

// Adaptive album layout — 1 photo = full-bleed hero, 2 = side by side,
// 3+ = big photo + two smaller ones with a "+N" badge for the rest.
function AlbumSlide({ albumName, photos, quote, onEditQuote }) {
  const shown = photos.slice(0, 3);
  const extra = Math.max(0, photos.length - shown.length);
  return (
    <div className="absolute inset-0 bg-[#2E2A27]">
      <QuoteEditButton onClick={onEditQuote} />
      {shown.length === 1 && (
        <img src={shown[0].url} alt="" className="w-full h-full object-cover" />
      )}
      {shown.length === 2 && (
        <div className="w-full h-full grid grid-cols-2 gap-[2px]">
          {shown.map((p, i) => <img key={i} src={p.url} alt="" className="w-full h-full object-cover" />)}
        </div>
      )}
      {shown.length >= 3 && (
        <div className="w-full h-full grid grid-cols-[2fr_1fr] gap-[2px]">
          <img src={shown[0].url} alt="" className="w-full h-full object-cover" />
          <div className="grid grid-rows-2 gap-[2px]">
            <img src={shown[1].url} alt="" className="w-full h-full object-cover" />
            <div className="relative">
              <img src={shown[2].url} alt="" className="w-full h-full object-cover" />
              {extra > 0 && (
                <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                  <span className="font-body text-[13px] text-white font-medium">+{extra}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="absolute top-3 left-3">
        <span className="inline-block font-body text-[9px] px-2.5 py-1 rounded-full text-white" style={{ background: "#A7773F" }}>
          {albumName}
        </span>
      </div>
      <QuoteOverlay text={quote} />
    </div>
  );
}

function MomentsSlide({ photos, quote, onEditQuote }) {
  const shown = photos.slice(0, 6);
  return (
    <div className="absolute inset-0 bg-[#2E2A27] flex flex-col">
      <QuoteEditButton onClick={onEditQuote} />
      <p className="font-heading text-lg text-white px-4 pt-6 pb-3">Moments</p>
      <div className="flex-1 grid grid-cols-2 gap-1.5 px-4 overflow-y-auto">
        {shown.map((m, i) => (
          <div key={i} className="rounded-lg overflow-hidden bg-muted aspect-square">
            {m.type === "photo" ? <img src={m.url} alt="" className="w-full h-full object-cover" /> : <video src={m.url} className="w-full h-full object-cover" />}
          </div>
        ))}
      </div>
      <QuoteOverlay text={quote} />
    </div>
  );
}

// Fixed scattered layout for the scrapbook finale — position/count picking
// comes in a later pass; for now it shows up to 5 real trip photos plus a
// centered polaroid carrying the trip title.
const SCRAPBOOK_SPOTS = [
  { top: "8%", left: "6%", rotate: "-9deg", size: "34%" },
  { top: "12%", right: "7%", rotate: "7deg", size: "32%" },
  { bottom: "30%", left: "10%", rotate: "5deg", size: "30%" },
  { bottom: "16%", right: "8%", rotate: "-6deg", size: "34%" },
  { top: "46%", left: "4%", rotate: "-4deg", size: "26%" },
];

function ScrapbookSlide({ trip, photos }) {
  const shown = photos.slice(0, 5);
  return (
    <div className="absolute inset-0 bg-[#2E2A27] overflow-hidden">
      {shown.map((p, i) => {
        const spot = SCRAPBOOK_SPOTS[i];
        return (
          <div
            key={i}
            className="absolute bg-[#F7F3EC] p-1 rounded-sm shadow-lg"
            style={{ top: spot.top, left: spot.left, right: spot.right, bottom: spot.bottom, width: spot.size, transform: `rotate(${spot.rotate})` }}
          >
            <div className="w-full aspect-square overflow-hidden">
              <img src={p.url} alt="" className="w-full h-full object-cover" />
            </div>
          </div>
        );
      })}
      <div
        className="absolute top-1/2 left-1/2 bg-[#F7F3EC] p-1.5 rounded-sm shadow-xl"
        style={{ width: "40%", transform: "translate(-50%, -50%) rotate(-2deg)" }}
      >
        <div className="w-full aspect-square overflow-hidden bg-[#7D8A53]" />
        <p className="font-heading text-[11px] text-[#2E2A27] text-center mt-1.5 mb-1">{trip.title}</p>
      </div>
    </div>
  );
}

export default function StoryPreviewPage({ trip, onUpdate, onBack }) {
  const savedCover = pickCoverImage(trip);
  const coverUrl = trip.story_cover_url || savedCover;
  const places = visiblePlaces(trip);
  const media = visibleMedia(trip);
  const photosOnly = media.filter((m) => m.type === "photo");
  const days = tripDuration(trip);
  const cities = trip.cities || [];

  const albumNames = [...new Set(media.map((m) => m.album).filter(Boolean))];
  const mediaByAlbum = {};
  albumNames.forEach((a) => { mediaByAlbum[a] = media.filter((m) => m.album === a); });
  const unassignedMedia = media.filter((m) => !m.album);

  const [uploading, setUploading] = useState(false);
  const [slide, setSlide] = useState(0);
  const [quoteEditorKey, setQuoteEditorKey] = useState(null);

  const quotes = trip.story_quotes || {};
  const journalEntries = (trip.journal_entries || []).filter((e) => e.note);

  const slides = useMemo(() => {
    const s = [{ key: "cover", type: "cover" }];
    if (cities.length > 0) s.push({ key: "route", type: "route" });
    if (places.length > 0) s.push({ key: "places", type: "places" });
    albumNames.forEach((a) => s.push({ key: `album:${a}`, type: "album", album: a }));
    if (unassignedMedia.length > 0) s.push({ key: "moments", type: "moments" });
    if (photosOnly.length > 0) s.push({ key: "scrapbook", type: "scrapbook" });
    return s;
  }, [cities.length, places.length, albumNames.join(","), unassignedMedia.length, photosOnly.length]);

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

  const setQuoteFor = async (slideKey, entryId) => {
    const nextQuotes = { ...quotes };
    if (entryId) nextQuotes[slideKey] = entryId; else delete nextQuotes[slideKey];
    try {
      const updated = await base44.entities.Trip.update(trip.id, { story_quotes: nextQuotes });
      onUpdate(updated);
    } catch (err) {
      console.error("Failed to set quote:", err);
    }
    setQuoteEditorKey(null);
  };

  const quoteTextFor = (slideKey) => {
    const entryId = quotes[slideKey];
    if (!entryId) return null;
    const entry = journalEntries.find((e) => e.id === entryId);
    return entry?.note || null;
  };

  const current = slides[slide];

  return (
    <div className="p-4 space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <h2 className="font-heading text-lg text-foreground">Story Preview</h2>

      <div className="relative aspect-[9/16] max-w-[280px] mx-auto rounded-2xl overflow-hidden">
        {current.type === "cover" && (
          <CoverSlide
            trip={trip} coverUrl={coverUrl} days={days}
            placesCount={places.length} photosCount={photosOnly.length}
            onChangeCover={changeCover} uploading={uploading}
          />
        )}
        {current.type === "route" && (
          <RouteSlide cities={cities} quote={quoteTextFor("route")} onEditQuote={() => setQuoteEditorKey("route")} />
        )}
        {current.type === "places" && (
          <PlacesSlide places={places} quote={quoteTextFor("places")} onEditQuote={() => setQuoteEditorKey("places")} />
        )}
        {current.type === "album" && (
          <AlbumSlide
            albumName={current.album}
            photos={mediaByAlbum[current.album] || []}
            quote={quoteTextFor(current.key)}
            onEditQuote={() => setQuoteEditorKey(current.key)}
          />
        )}
        {current.type === "moments" && (
          <MomentsSlide photos={unassignedMedia} quote={quoteTextFor("moments")} onEditQuote={() => setQuoteEditorKey("moments")} />
        )}
        {current.type === "scrapbook" && (
          <ScrapbookSlide trip={trip} photos={photosOnly} />
        )}

        <div className="absolute top-2.5 left-2.5 right-2.5 flex gap-1 z-10">
          {slides.map((s, i) => (
            <div key={s.key} className="flex-1 h-[2px] rounded-full bg-white/30 overflow-hidden">
              <div className="h-full bg-white" style={{ width: i <= slide ? "100%" : "0%" }} />
            </div>
          ))}
        </div>

        <button onClick={goPrev} className="absolute left-0 top-0 bottom-0 w-1/3 z-[5]" aria-label="Previous slide" />
        <button onClick={goNext} className="absolute right-0 top-0 bottom-0 w-2/3 z-[5]" aria-label="Next slide" />
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Tap the sides to browse slides. A shareable export (Instagram/TikTok) isn't wired up yet — this is a live preview.
      </p>

      {quoteEditorKey && (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setQuoteEditorKey(null)}>
          <div className="bg-card border border-border rounded-t-3xl md:rounded-2xl w-full max-w-sm p-5 max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading text-base text-foreground">Choose a note for this slide</h3>
              <button onClick={() => setQuoteEditorKey(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            {quotes[quoteEditorKey] && (
              <button
                onClick={() => setQuoteFor(quoteEditorKey, null)}
                className="w-full text-left text-xs text-destructive px-3 py-2 rounded-lg bg-destructive/10 mb-3"
              >
                Remove current note from this slide
              </button>
            )}
            {journalEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No journal notes yet — add some in Notes & Reflections first.</p>
            ) : (
              <div className="space-y-2">
                {journalEntries.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => setQuoteFor(quoteEditorKey, entry.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-colors ${quotes[quoteEditorKey] === entry.id ? "border-accent bg-accent/10" : "border-border hover:border-accent/40"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-foreground italic leading-snug flex-1">"{entry.note}"</p>
                      {quotes[quoteEditorKey] === entry.id && <Check className="w-4 h-4 text-accent flex-shrink-0" />}
                    </div>
                    {entry.date && <p className="text-[10px] text-muted-foreground mt-1">{format(parseISO(entry.date), "MMM d")}</p>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
