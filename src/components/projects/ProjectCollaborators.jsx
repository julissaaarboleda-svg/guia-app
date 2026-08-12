import { useState } from "react";
import { X, Check, Link2, Mail } from "lucide-react";

// Controlled component now — ProjectDetail.jsx owns the "open" state and
// triggers this via its own top-right icon (matching the reference design,
// which shows one dedicated person+ icon rather than avatars nested in the
// hero). This modal is just the picker itself.
export default function ProjectCollaborators({ open, onClose, collaborators, onAdd, onRemove, canManage, projectId, projectTitle }) {
  const [email, setEmail] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);

  const submit = () => {
    if (!email.trim()) return;
    onAdd(email.trim());
    setEmail("");
  };

  const copyLink = async () => {
    // NOTE: this link doesn't auto-add anyone yet — there's no "accept invite"
    // flow wired up on the backend. It's a convenience for sharing which project
    // you mean; the person you share it with still needs to be added by email
    // below (or you'll need to build a real invite-token accept flow for this
    // to be a true one-click join).
    const url = `${window.location.origin}/projects?open=${projectId}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // clipboard API can fail without HTTPS/permissions — fail quietly
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-t-3xl md:rounded-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-base text-foreground">Collaborators on "{projectTitle}"</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        {canManage && (
          <>
            <button
              onClick={copyLink}
              className="w-full flex items-center justify-center gap-2 border border-border rounded-lg py-2.5 text-sm font-medium text-foreground hover:bg-secondary transition-colors mb-2"
            >
              {linkCopied ? <><Check className="w-4 h-4 text-green-600" /> Link copied</> : <><Link2 className="w-4 h-4" /> Copy project link</>}
            </button>
            <p className="text-[11px] text-muted-foreground mb-4 leading-relaxed">
              Share this so they know which project you mean — they'll still need to be added by email below to actually see it.
            </p>

            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <Mail className="w-3.5 h-3.5" /> Add by email
            </div>
            <div className="flex gap-2">
              <input
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="their@email.com"
                className="flex-1 bg-muted border border-input rounded-lg px-3 py-2 text-sm outline-none focus:border-ring"
              />
              <button onClick={submit} className="px-4 bg-foreground text-background rounded-lg text-sm font-medium">Add</button>
            </div>
          </>
        )}

        {collaborators.length > 0 ? (
          <div className={canManage ? "mt-4 pt-4 border-t border-border space-y-1.5" : "space-y-1.5"}>
            {collaborators.map((c) => (
              <div key={c} className="flex items-center justify-between text-sm">
                <span className="text-foreground truncate">{c}</span>
                {canManage && (
                  <button onClick={() => onRemove(c)} className="text-muted-foreground hover:text-destructive text-xs">Remove</button>
                )}
              </div>
            ))}
          </div>
        ) : (
          !canManage && <p className="text-sm text-muted-foreground text-center py-4">No collaborators yet.</p>
        )}
      </div>
    </div>
  );
}
