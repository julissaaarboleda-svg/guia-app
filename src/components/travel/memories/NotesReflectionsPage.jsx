import { ArrowLeft } from "lucide-react";
import BrainDump from "@/components/travel/BrainDump";

export default function NotesReflectionsPage({ trip, onUpdate, onBack }) {
  const summary = (trip?.recap?.summary || "").replace(/<[^>]*>/g, "").trim();

  return (
    <div className="p-4 space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <h2 className="font-heading text-lg text-foreground">Notes & Reflections</h2>
      <BrainDump trip={trip} onOrganized={onUpdate} />
      {summary && (
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{summary}</p>
        </div>
      )}
    </div>
  );
}
