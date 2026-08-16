import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { MessageCircle } from "lucide-react";

// Not linked from any nav — reachable only by typing /admin/feedback directly.
// Real access control happens server-side in entities.js (ADMIN_EMAILS check),
// not here — this page just renders whatever the backend actually returns.
export default function AdminFeedback() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    base44.entities.Feedback.filter({})
      .then(setItems)
      .catch((err) => setError(err.message || "Failed to load feedback"));
  }, []);

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto pb-32 md:pb-8">
      <h1 className="text-2xl font-heading font-bold text-foreground mb-1">Feedback inbox</h1>
      <p className="text-muted-foreground font-body text-sm mb-8">
        Every submission across all users, newest first.
      </p>

      {error && (
        <div className="bg-card border border-border rounded-2xl p-6 text-sm text-muted-foreground">
          {error.includes("403") || error.includes("Forbidden")
            ? "You don't have access to this page."
            : `Couldn't load feedback: ${error}`}
        </div>
      )}

      {!items && !error && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}

      {items && items.length === 0 && (
        <p className="text-sm text-muted-foreground">No feedback yet.</p>
      )}

      {items && items.length > 0 && (
        <div className="space-y-3">
          {items.map((f) => (
            <div key={f.id} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{f.message}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {f.created_date ? new Date(f.created_date).toLocaleString() : "Unknown date"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
