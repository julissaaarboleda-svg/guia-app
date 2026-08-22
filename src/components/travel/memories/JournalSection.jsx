import { useState } from "react";
import { Plus, X, Check } from "lucide-react";
import { format, parseISO } from "date-fns";
import { base44 } from "@/api/base44Client";

export default function JournalSection({ trip, onUpdate }) {
  const entries = (trip.journal_entries || []).slice().sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState("");
  const [note, setNote] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const dayOptions = (trip.itinerary || []).map((d) => ({
    date: d.date || "",
    label: d.date ? format(parseISO(d.date), "EEE, MMM d") : `Day ${d.day}`,
  })).filter((o) => o.date);

  const openForm = () => {
    setDay(dayOptions[0]?.date || "");
    setNote("");
    setPhotoUrl("");
    setOpen(true);
  };

  const uploadPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPhotoUrl(file_url);
    } catch (err) {
      console.error("Journal photo upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!day || (!note.trim() && !photoUrl)) return;
    const newEntry = {
      id: (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()),
      date: day,
      note: note.trim(),
      photo_url: photoUrl,
    };
    const updated = [...(trip.journal_entries || []), newEntry];
    try {
      const result = await base44.entities.Trip.update(trip.id, { journal_entries: updated });
      onUpdate(result);
      setOpen(false);
    } catch (err) {
      console.error("Failed to save journal entry:", err);
    }
  };

  const removeEntry = async (id) => {
    const updated = (trip.journal_entries || []).filter((e) => e.id !== id);
    try {
      const result = await base44.entities.Trip.update(trip.id, { journal_entries: updated });
      onUpdate(result);
    } catch (err) {
      console.error("Failed to remove journal entry:", err);
    }
  };

  return (
    <section>
      <h3 className="font-heading text-[15px] text-foreground font-semibold mb-2">Your journey</h3>

      {entries.length > 0 && (
        <div className="space-y-2.5 mb-2">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center gap-2.5 group">
              <div className="w-11 h-11 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                {e.photo_url && <img src={e.photo_url} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body text-[11px] text-accent font-medium">
                  {e.date ? format(parseISO(e.date), "MMM d") : ""}
                </p>
                {e.note && <p className="font-body text-[11px] text-muted-foreground leading-snug line-clamp-2">{e.note}</p>}
              </div>
              <button
                onClick={() => removeEntry(e.id)}
                className="text-muted-foreground/50 hover:text-destructive transition-colors flex-shrink-0"
                aria-label="Remove entry"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {dayOptions.length === 0 ? (
        <p className="font-body text-[11px] text-muted-foreground/70 italic py-2">
          Add days to your itinerary first, then you can start journaling.
        </p>
      ) : (
        <button
          onClick={openForm}
          className={
            entries.length === 0
              ? "w-full flex flex-col items-center justify-center gap-1 py-4 rounded-xl border border-dashed border-accent text-accent"
              : "flex items-center gap-1 font-body text-[11px] text-accent"
          }
        >
          <Plus className={entries.length === 0 ? "w-4 h-4" : "w-3.5 h-3.5"} />
          <span className={entries.length === 0 ? "font-body text-[11px]" : ""}>
            {entries.length === 0 ? "Add entry" : "Add another entry"}
          </span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="bg-card border border-border rounded-t-3xl md:rounded-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading text-base text-foreground">New journal entry</h3>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground mb-1.5">Day</p>
            <select
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors mb-4"
            >
              {dayOptions.map((o) => (
                <option key={o.date} value={o.date}>{o.label}</option>
              ))}
            </select>

            <p className="text-xs text-muted-foreground mb-1.5">Note (optional)</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="What happened today?"
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent resize-none mb-4"
            />

            <p className="text-xs text-muted-foreground mb-1.5">Photo (optional)</p>
            {photoUrl ? (
              <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted mb-4">
                <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => setPhotoUrl("")}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center"
                  aria-label="Remove photo"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ) : (
              <label className={`flex items-center justify-center gap-1.5 py-3 rounded-lg border border-dashed border-border text-muted-foreground text-xs mb-4 transition-opacity ${uploading ? "opacity-60 cursor-wait" : "cursor-pointer"}`}>
                {uploading ? "Uploading…" : "Add a photo"}
                <input type="file" accept="image/*,image/heic,image/heif,.heic,.heif" className="hidden" onChange={uploadPhoto} disabled={uploading} />
              </label>
            )}

            <button
              onClick={save}
              disabled={!day || (!note.trim() && !photoUrl)}
              className="w-full flex items-center justify-center gap-1.5 bg-accent text-accent-foreground py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              <Check className="w-4 h-4" /> Save entry
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
