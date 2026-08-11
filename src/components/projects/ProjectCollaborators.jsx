import { useState } from "react";
import { UserPlus, X, Check, Link2, Mail } from "lucide-react";

// Props confirmed from ProjectDetail.jsx, extended with projectId/projectTitle
// so this can build a shareable link. Rebuilt as a real modal — the previous
// version was a tiny dashed circle easy to miss entirely.
export default function ProjectCollaborators({ collaborators, onAdd, onRemove, canManage, projectId, projectTitle }) {
  const [open, setOpen] = useState(false);
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

  return (
    <>
      <div className="flex items-center gap-1.5">
        {collaborators.map((c) => (
          <div key={c} className="group relative w-7 h-7 rounded-full bg-stone-700 text-white text-[10px] font-semibold flex items-center justify-center" title={c}>
            {c.slice(0, 2).toUpperCase()}
            {canManage && (
              <button onClick={() => onRemove(c)} className="absolute -top-1 -right-1 hidden group-hover:flex w-3.5 h-3.5 bg-rose-500 rounded-full items-center justify-center">
                <X className="w-2 h-2 text-white" />
              </button>
            )}
          </div>
        ))}
        {canManage && (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1 h-7 pl-1.5 pr-2.5 rounded-full border border-stone-600 text-stone-300 hover:text-white hover:border-stone-400 transition-colors text-[11px] font-medium"
          >
            <UserPlus className="w-3.5 h-3.5" /> Add
          </button>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="bg-card border border-border rounded-t-3xl md:rounded-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-base text-foreground">Add to "{projectTitle}"</h2>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>

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

            {collaborators.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border space-y-1.5">
                {collaborators.map((c) => (
                  <div key={c} className="flex items-center justify-between text-sm">
                    <span className="text-foreground truncate">{c}</span>
                    <button onClick={() => onRemove(c)} className="text-muted-foreground hover:text-destructive text-xs">Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
