import { useState } from "react";
import { X, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Real source was never sent — reconstructed to match the Feedback entity schema
// reviewed earlier in the project (message/category/created_date fields).
export default function FeedbackModal({ onClose }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await base44.entities.Feedback.create({ message: message.trim() });
      setSent(true);
      setTimeout(onClose, 1200);
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-t-3xl md:rounded-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-lg text-foreground">Send feedback</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        {sent ? (
          <p className="text-sm text-foreground flex items-center gap-2 py-4"><Check className="w-4 h-4 text-green-600" /> Thanks — got it.</p>
        ) : (
          <>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="What's working, what's not..."
              className="w-full bg-muted border border-input rounded-lg px-3 py-2 text-sm outline-none focus:border-ring resize-none"
              autoFocus
            />
            <button
              onClick={submit}
              disabled={!message.trim() || sending}
              className="w-full mt-3 bg-foreground text-background py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-colors"
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
