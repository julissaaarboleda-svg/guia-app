import { useState, useMemo, useEffect, useRef } from "react";
import { Plus, Camera, PencilLine, MapPin, Sparkles } from "lucide-react";
import { parseISO, format } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { base44 } from "@/api/base44Client";
import { ent } from "@/lib/freshEntities";
import { visiblePlaces, visibleMedia } from "@/lib/memoryUtils";
import FavoritePlacesPage from "./memories/FavoritePlacesPage";
import PhotosVideosPage from "./memories/PhotosVideosPage";
import NotesReflectionsPage from "./memories/NotesReflectionsPage";
import TripCardsPage from "./memories/TripCardsPage";

const stripHtml = (html) => (html || "").replace(/<[^>]*>/g, "").trim();
const dayLabel = (date) => {
  try { return format(parseISO(date), "EEE, MMM d"); } catch { return date; }
};

export default function MemoriesTab({ trip, onUpdate }) {
  const [filter, setFilter] = useState("all"); // all | photos | notes | places
  const [story, setStory] = useState(false);
  const [activeDay, setActiveDay] = useState("");
  const [noteOpen, setNoteOpen] = useState(0); // bump to open the note form
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const media = visibleMedia(trip);
  const photos = media.filter((m) => m.type === "photo");
  const places = visiblePlaces(trip);
  const notes = useMemo(
    () => (trip.journal_entries || []).slice().sort((a, b) => (a.date || "").localeCompare(b.date || "")),
    [trip.journal_entries]
  );

  const days = useMemo(
    () => (trip.itinerary || []).filter((d) => d.date).map((d) => ({ date: d.date, num: d.day, city: d.city || "" })),
    [trip.itinerary]
  );
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const defaultDate = activeDay || (days.some((d) => d.date === todayStr) ? todayStr : "");

  // Day groups for the "All" feed: every date that has a photo or note.
  const groups = useMemo(() => {
    const dates = new Set([...photos.filter((p) => p.date).map((p) => p.date), ...notes.filter((n) => n.date).map((n) => n.date)]);
    return [...dates].sort().map((date) => {
      const d = days.find((x) => x.date === date);
      return {
        date,
        num: d?.num,
        city: d?.city || (trip.cities || [])[0] || "",
        photos: photos.filter((p) => p.date === date),
        notes: notes.filter((n) => n.date === date),
      };
    });
  }, [photos, notes, days, trip.cities]);
  const undatedPhotos = photos.filter((p) => !p.date);
  const nothing = photos.length === 0 && notes.length === 0 && places.length === 0;

  useEffect(() => {
    document.querySelector("main")?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [story]);

  const uploadPhoto = async (file) => {
    if (!file) return;
    if (file.type.startsWith("video/")) {
      setError("Video uploads are coming soon. For now, photos work great.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const updated = [
        ...(trip.memory_media || []),
        { url: file_url, type: "photo", favorited: false, album: null, tags: [], date: defaultDate },
      ];
      const result = await ent.Trip.update(trip.id, { memory_media: updated });
      onUpdate(result);
      setFilter("all");
    } catch (err) {
      console.error("Photo upload failed:", err);
      setError("Couldn't upload that photo. Try again, or try a different one.");
    } finally {
      setUploading(false);
    }
  };

  const startNote = () => {
    setFilter("notes");
    setNoteOpen((n) => n + 1);
  };

  const pickDay = (date) => {
    setActiveDay(date);
    const hasContent = groups.some((g) => g.date === date);
    if (hasContent) {
      setFilter("all");
      setTimeout(() => document.getElementById(`mem-day-${date}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    } else {
      startNote();
    }
  };

  if (story) return <TripCardsPage trip={trip} onBack={() => setStory(false)} />;

  const FILTERS = [
    { id: "all", label: "All" },
    { id: "photos", label: `Photos ${photos.length}` },
    { id: "notes", label: `Notes ${notes.length}` },
    { id: "places", label: `Places ${places.length}` },
  ];

  return (
    <div className="space-y-4">
      <input
        ref={fileRef}
        type="file"
        accept="image/*,image/heic,image/heif,.heic,.heif"
        className="hidden"
        onChange={(e) => { uploadPhoto(e.target.files?.[0]); e.target.value = ""; }}
      />

      <div className="flex items-center justify-between">
        <h3 className="font-heading text-[22px] text-foreground leading-tight">Memories</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button disabled={uploading} className="inline-flex items-center gap-1.5 bg-[#A7773F] text-[#F7F3EC] px-4 py-2 rounded-full text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-60">
              <Plus className="w-4 h-4" /> {uploading ? "Adding…" : "Memory"}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 rounded-lg">
            <DropdownMenuItem onSelect={() => fileRef.current?.click()} className="gap-2 cursor-pointer">
              <Camera className="w-4 h-4" /> Add a photo
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={startNote} className="gap-2 cursor-pointer">
              <PencilLine className="w-4 h-4" /> Write a note
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {error && <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}

      {days.length > 0 && (
        <div>
          <p className="font-body text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground mb-2">Your days</p>
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
            {days.map((d) => {
              const cover = photos.find((p) => p.date === d.date);
              const active = activeDay === d.date;
              return (
                <button key={d.date} onClick={() => pickDay(d.date)} className="flex-shrink-0 w-[60px] text-center">
                  <div className={`w-[60px] h-[60px] rounded-xl overflow-hidden flex items-center justify-center bg-[#F0E6D6] border ${active ? "border-[#A7773F] ring-1 ring-[#A7773F]" : "border-border"}`}>
                    {cover ? (
                      <img src={cover.thumbnail || cover.url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-heading text-[18px] text-[#8B6B3E]">{format(parseISO(d.date), "d")}</span>
                    )}
                  </div>
                  <span className="block font-body text-[10px] text-muted-foreground mt-1">{format(parseISO(d.date), "MMM d")}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`flex-shrink-0 text-[12px] px-3.5 py-1.5 rounded-full border transition-colors ${filter === f.id ? "bg-foreground text-background border-foreground" : "bg-card text-muted-foreground border-border"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filter === "photos" && <PhotosVideosPage embedded trip={trip} onUpdate={onUpdate} defaultDate={defaultDate} />}
      {filter === "notes" && <NotesReflectionsPage key={noteOpen} embedded autoOpen={noteOpen > 0} initialDay={activeDay} trip={trip} onUpdate={onUpdate} />}
      {filter === "places" && <FavoritePlacesPage embedded trip={trip} onUpdate={onUpdate} />}

      {filter === "all" && (
        <div className="space-y-5">
          {nothing && (
            <div className="bg-card border border-dashed border-border rounded-2xl p-6 text-center">
              <p className="font-heading text-base text-foreground mb-1">Start your trip journal</p>
              <p className="font-body text-[12px] text-muted-foreground mb-4">Photos and notes land here, day by day.</p>
              <div className="flex gap-2 justify-center">
                <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 bg-[#F0E6D6] text-[#8B6B3E] rounded-full px-4 py-2 text-[13px] font-medium"><Camera className="w-3.5 h-3.5" /> Add a photo</button>
                <button onClick={startNote} className="inline-flex items-center gap-1.5 bg-[#F0E6D6] text-[#8B6B3E] rounded-full px-4 py-2 text-[13px] font-medium"><PencilLine className="w-3.5 h-3.5" /> Write a note</button>
              </div>
            </div>
          )}

          {undatedPhotos.length > 0 && (
            <section>
              <h4 className="font-heading text-[16px] text-foreground font-semibold mb-0.5">Trip photos</h4>
              <p className="font-body text-[11px] text-muted-foreground mb-2">Not on a day yet. Open a photo in Photos to choose its day.</p>
              <PhotoGrid items={undatedPhotos} onOpen={() => setFilter("photos")} />
            </section>
          )}

          {groups.map((g) => (
            <section key={g.date} id={`mem-day-${g.date}`} className="scroll-mt-16">
              <h4 className="font-heading text-[16px] text-foreground font-semibold leading-tight">
                {g.num ? `Day ${g.num} · ` : ""}{dayLabel(g.date)}
              </h4>
              {g.city && <p className="font-body text-[11px] text-muted-foreground mb-2 flex items-center gap-1"><MapPin className="w-3 h-3" strokeWidth={1.8} /> {g.city}</p>}
              {g.photos.length > 0 && <PhotoGrid items={g.photos} onOpen={() => setFilter("photos")} />}
              {g.notes.map((n) => (
                <div key={n.id} className="bg-card border border-border rounded-xl p-3 mt-2 flex gap-3">
                  {n.photo_url && <img src={n.photo_url} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <span className="inline-block font-body text-[9px] tracking-[0.1em] uppercase px-2 py-0.5 rounded-full bg-[#F0E6D6] text-[#8B6B3E] mb-1">Note</span>
                    {stripHtml(n.note) && <div className="text-sm text-foreground leading-relaxed quill-render" dangerouslySetInnerHTML={{ __html: n.note }} />}
                  </div>
                </div>
              ))}
            </section>
          ))}

          {places.length > 0 && (
            <section>
              <div className="flex items-baseline justify-between mb-2">
                <h4 className="font-heading text-[16px] text-foreground font-semibold">Saved places</h4>
                <button onClick={() => setFilter("places")} className="font-body text-[11px] text-muted-foreground">See all →</button>
              </div>
              <div className="space-y-2">
                {places.slice(0, 3).map((p) => (
                  <div key={p.id} className="flex items-center gap-3 bg-card border border-border rounded-xl p-2.5">
                    <div className="w-11 h-11 rounded-lg bg-muted overflow-hidden flex-shrink-0">{p.image && <img src={p.image} alt="" className="w-full h-full object-cover" />}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.city}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <button
        onClick={() => setStory(true)}
        className="w-full inline-flex items-center justify-center gap-1.5 rounded-full border border-[#A7773F] text-[#8B6B3E] py-2.5 font-body text-[13px] font-semibold hover:bg-[#F0E6D6]/50 transition-colors"
      >
        <Sparkles className="w-4 h-4" /> Make my trip cards
      </button>
    </div>
  );
}

function PhotoGrid({ items, onOpen }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {items.slice(0, 6).map((m, i) => (
        <button key={i} onClick={onOpen} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
          <img src={m.thumbnail || m.url} alt="" className="w-full h-full object-cover" />
          {i === 5 && items.length > 6 && (
            <span className="absolute inset-0 bg-black/55 flex items-center justify-center text-white text-[12px] font-medium">+{items.length - 5}</span>
          )}
        </button>
      ))}
    </div>
  );
}
