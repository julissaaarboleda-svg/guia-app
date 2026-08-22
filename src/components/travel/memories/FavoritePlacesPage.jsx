import { ArrowLeft } from "lucide-react";
import { visiblePlaces } from "@/lib/memoryUtils";

export default function FavoritePlacesPage({ trip, onBack }) {
  const places = visiblePlaces(trip);
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
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground truncate">{p.city}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
