import { ArrowLeft, Trash2 } from "lucide-react";
import { visiblePlaces } from "@/lib/memoryUtils";
import { base44 } from "@/api/base44Client";

export default function FavoritePlacesPage({ trip, onUpdate, onBack }) {
  const places = visiblePlaces(trip);

  const removePlace = async (id) => {
    const updated = (trip.memory_places || []).filter((p) => p.id !== id);
    try {
      const result = await base44.entities.Trip.update(trip.id, { memory_places: updated });
      onUpdate(result);
    } catch (err) {
      console.error("Failed to remove place:", err);
    }
  };

  return (
    <div className="p-4 space-y-3">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <h2 className="font-heading text-lg text-foreground">Favorite Places</h2>
      {places.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No places saved yet.</p>
      ) : (
        <div className="space-y-2">
          {places.map((p) => (
            <div key={p.id} className="flex items-center gap-3 bg-card border border-border rounded-xl p-3">
              <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                {p.image && <img src={p.image} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground truncate">{p.city}</p>
              </div>
              <button
                onClick={() => removePlace(p.id)}
                className="text-muted-foreground/50 hover:text-destructive transition-colors flex-shrink-0 p-1"
                aria-label="Remove place"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
