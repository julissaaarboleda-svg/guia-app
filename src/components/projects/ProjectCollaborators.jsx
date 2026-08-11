import { useState } from "react";
import { UserPlus, X } from "lucide-react";

// Props confirmed from ProjectDetail.jsx. Matches the avatar-row pattern seen
// in the original screenshots (initials circles + dashed "+" add button).
export default function ProjectCollaborators({ collaborators, onAdd, onRemove, canManage }) {
  const [adding, setAdding] = useState(false);
  const [email, setEmail] = useState("");

  const submit = () => {
    if (!email.trim()) return;
    onAdd(email.trim());
    setEmail("");
    setAdding(false);
  };

  return (
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
        adding ? (
          <input
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            onBlur={submit}
            placeholder="email@..."
            className="w-28 bg-stone-800 border border-stone-700 rounded-full px-2 py-1 text-[11px] text-white outline-none"
          />
        ) : (
          <button onClick={() => setAdding(true)} className="w-7 h-7 rounded-full border border-dashed border-stone-600 flex items-center justify-center text-stone-500 hover:text-stone-300">
            <UserPlus className="w-3.5 h-3.5" />
          </button>
        )
      )}
    </div>
  );
}
