import { useState } from "react";
import { ArrowLeft, Upload, Trash2, Plus, X } from "lucide-react";
import { visibleMedia } from "@/lib/memoryUtils";
import { base44 } from "@/api/base44Client";

export default function PhotosVideosPage({ trip, onUpdate, onBack }) {
  const media = visibleMedia(trip);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [filterAlbum, setFilterAlbum] = useState("all");
  const [editingIdx, setEditingIdx] = useState(null);
  // Replaces window.prompt() — a native OS dialog that can't be styled at
  // all — with a real in-app modal matching Guía's brand.
  const [textPrompt, setTextPrompt] = useState(null); // { title, placeholder, onSubmit }
  const [textPromptValue, setTextPromptValue] = useState("");

  // Albums are now a real, persisted list on the trip (trip.memory_albums)
  // instead of only existing implicitly through photos that reference them.
  // That's what let a newly-created empty album disappear before — nothing
  // was actually saved until a photo happened to use that name.
  const albums = [...new Set([...(trip.memory_albums || []), ...media.map((m) => m.album).filter(Boolean)])];

  const persist = async (updated) => {
    const result = await base44.entities.Trip.update(trip.id, { memory_media: updated });
    onUpdate(result);
  };

  const removeMedia = async (idx) => {
    const updated = media.filter((_, i) => i !== idx);
    try {
      await persist(updated);
      if (editingIdx === idx) setEditingIdx(null);
    } catch (err) {
      console.error("Failed to remove media:", err);
    }
  };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const isVideo = file.type.startsWith("video/");
      const updated = [
        ...media,
        {
          url: file_url,
          type: isVideo ? "video" : "photo",
          favorited: false,
          album: filterAlbum !== "all" ? filterAlbum : null,
          tags: [],
        },
      ];
      await persist(updated);
    } catch (err) {
      console.error("Photo/video upload failed:", err);
      setError("Couldn't upload that file. Try again, or try a different photo.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const setAlbumFor = async (idx, albumName) => {
    const updated = media.map((m, i) => (i === idx ? { ...m, album: albumName } : m));
    try { await persist(updated); } catch (err) { console.error("Failed to set album:", err); }
  };

  const createAlbumForFilter = () => {
    setTextPromptValue("");
    setTextPrompt({
      title: "New album",
      placeholder: "e.g. São Paulo",
      onSubmit: async (name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const existingAlbums = trip.memory_albums || [];
        if (!existingAlbums.includes(trimmed)) {
          try {
            const result = await base44.entities.Trip.update(trip.id, { memory_albums: [...existingAlbums, trimmed] });
            onUpdate(result);
          } catch (err) {
            console.error("Failed to create album:", err);
          }
        }
        setFilterAlbum(trimmed);
      },
    });
  };

  const createAlbumAndAssign = (idx) => {
    setTextPromptValue("");
    setTextPrompt({
      title: "New album",
      placeholder: "e.g. São Paulo",
      onSubmit: async (name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const existingAlbums = trip.memory_albums || [];
        const nextAlbums = existingAlbums.includes(trimmed) ? existingAlbums : [...existingAlbums, trimmed];
        const updatedMedia = media.map((m, i) => (i === idx ? { ...m, album: trimmed } : m));
        try {
          const result = await base44.entities.Trip.update(trip.id, { memory_media: updatedMedia, memory_albums: nextAlbums });
          onUpdate(result);
        } catch (err) {
          console.error("Failed to create album:", err);
        }
      },
    });
  };

  const addTagFor = (idx) => {
    setTextPromptValue("");
    setTextPrompt({
      title: "Add a tag",
      placeholder: "e.g. scenery",
      onSubmit: async (tag) => {
        const trimmed = tag.trim();
        if (!trimmed) return;
        const updated = media.map((m, i) => (i === idx ? { ...m, tags: [...(m.tags || []), trimmed] } : m));
        try {
          await persist(updated);
        } catch (err) {
          console.error("Failed to add tag:", err);
        }
      },
    });
  };

  const removeTagFor = async (idx, tag) => {
    const updated = media.map((m, i) => (i === idx ? { ...m, tags: (m.tags || []).filter((t) => t !== tag) } : m));
    try { await persist(updated); } catch (err) { console.error("Failed to remove tag:", err); }
  };

  const filteredMedia = media
    .map((m, idx) => ({ ...m, idx }))
    .filter((m) => filterAlbum === "all" || m.album === filterAlbum);

  const editing = editingIdx !== null ? media[editingIdx] : null;

  return (
    <div className="p-4 space-y-3">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg text-foreground">Photos & Videos</h2>
        <label className={`flex items-center gap-1.5 text-xs font-medium bg-accent text-accent-foreground px-3 py-1.5 rounded-full transition-opacity ${uploading ? "opacity-60 cursor-wait" : "cursor-pointer hover:opacity-90"}`}>
          <Upload className="w-3.5 h-3.5" /> {uploading ? "Uploading…" : "Add"}
          <input type="file" accept="image/*,image/heic,image/heif,.heic,.heif,video/*" className="hidden" onChange={upload} disabled={uploading} />
        </label>
      </div>
      {error && (
        <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Album filter chips */}
      {media.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => setFilterAlbum("all")}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full transition-colors ${filterAlbum === "all" ? "bg-foreground text-background" : "bg-card border border-border text-muted-foreground"}`}
          >
            All
          </button>
          {albums.map((a) => (
            <button
              key={a}
              onClick={() => setFilterAlbum(a)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full transition-colors ${filterAlbum === a ? "bg-foreground text-background" : "bg-card border border-border text-muted-foreground"}`}
            >
              {a}
            </button>
          ))}
          <button
            onClick={createAlbumForFilter}
            className="flex-shrink-0 flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-dashed border-accent text-accent"
          >
            <Plus className="w-3 h-3" /> Album
          </button>
        </div>
      )}

      {media.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No photos or videos yet.</p>
      ) : filteredMedia.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No photos in this album yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {filteredMedia.map((m) => (
            <div
              key={m.idx}
              onClick={() => setEditingIdx(m.idx)}
              className="relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer"
            >
              {m.type === "photo" ? <img src={m.url} alt="" className="w-full h-full object-cover" /> : <video src={m.url} className="w-full h-full object-cover" />}
              {m.tags?.length > 0 && (
                <span className="absolute bottom-1 left-1 text-[8px] px-1.5 py-0.5 rounded-full bg-black/55 text-white">
                  {m.tags[0]}{m.tags.length > 1 ? ` +${m.tags.length - 1}` : ""}
                </span>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); removeMedia(m.idx); }}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center"
                aria-label="Remove"
              >
                <Trash2 className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Organize panel — assign album + tags */}
      {editing && (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setEditingIdx(null)}>
          <div className="bg-card border border-border rounded-t-3xl md:rounded-2xl w-full max-w-sm p-5 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading text-base text-foreground">Organize</h3>
              <button onClick={() => setEditingIdx(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="aspect-video rounded-lg overflow-hidden bg-muted mb-4">
              {editing.type === "photo" ? (
                <img src={editing.url} alt="" className="w-full h-full object-cover" />
              ) : (
                <video src={editing.url} className="w-full h-full object-cover" controls />
              )}
            </div>

            <p className="text-xs text-muted-foreground mb-1.5">Album</p>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {albums.map((a) => (
                <button
                  key={a}
                  onClick={() => setAlbumFor(editingIdx, a)}
                  className={`text-xs px-3 py-1.5 rounded-full transition-colors ${editing.album === a ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}
                >
                  {a}
                </button>
              ))}
              <button
                onClick={() => createAlbumAndAssign(editingIdx)}
                className="text-xs px-3 py-1.5 rounded-full border border-dashed border-accent text-accent flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> New
              </button>
              {editing.album && (
                <button
                  onClick={() => setAlbumFor(editingIdx, null)}
                  className="text-xs px-3 py-1.5 rounded-full text-muted-foreground/60 hover:text-destructive transition-colors"
                >
                  Remove from album
                </button>
              )}
            </div>

            <p className="text-xs text-muted-foreground mb-1.5">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {(editing.tags || []).map((t) => (
                <span key={t} className="text-xs px-3 py-1.5 rounded-full bg-accent text-accent-foreground flex items-center gap-1">
                  {t}
                  <button onClick={() => removeTagFor(editingIdx, t)} className="hover:opacity-70">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <button
                onClick={() => addTagFor(editingIdx)}
                className="text-xs px-3 py-1.5 rounded-full border border-dashed border-border text-muted-foreground flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add tag
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branded text-entry modal — replaces window.prompt() everywhere */}
      {textPrompt && (
        <div
          className="fixed inset-0 z-[80] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setTextPrompt(null)}
        >
          <div
            className="bg-card border border-border rounded-t-3xl md:rounded-2xl w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-heading text-base text-foreground mb-3">{textPrompt.title}</h3>
            <input
              autoFocus
              value={textPromptValue}
              onChange={(e) => setTextPromptValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && textPromptValue.trim()) {
                  textPrompt.onSubmit(textPromptValue);
                  setTextPrompt(null);
                }
              }}
              placeholder={textPrompt.placeholder}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent transition-colors mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (!textPromptValue.trim()) return;
                  textPrompt.onSubmit(textPromptValue);
                  setTextPrompt(null);
                }}
                disabled={!textPromptValue.trim()}
                className="flex-1 bg-accent text-accent-foreground py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                Add
              </button>
              <button
                onClick={() => setTextPrompt(null)}
                className="px-4 py-2.5 text-muted-foreground text-sm hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
