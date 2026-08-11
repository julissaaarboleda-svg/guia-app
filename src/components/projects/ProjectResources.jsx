import { useState } from "react";
import { Upload, Link2, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function ProjectResources({ attachments, links, onAttachmentsChange, onLinksChange }) {
  const [newLink, setNewLink] = useState("");

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    onAttachmentsChange([...attachments, { name: file.name, url: file_url }]);
  };

  const addLink = () => {
    if (!newLink.trim()) return;
    onLinksChange([...links, { url: newLink.trim() }]);
    setNewLink("");
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-foreground">Attachments</h3>
          <label className="flex items-center gap-1 text-xs text-accent cursor-pointer hover:underline">
            <Upload className="w-3.5 h-3.5" /> Upload
            <input type="file" className="hidden" onChange={upload} />
          </label>
        </div>
        {attachments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No files yet.</p>
        ) : (
          <div className="space-y-1">
            {attachments.map((a, i) => (
              <a key={i} href={a.url} target="_blank" rel="noreferrer" className="block text-xs text-foreground hover:text-accent truncate">{a.name}</a>
            ))}
          </div>
        )}
      </div>
      <div>
        <h3 className="text-sm font-medium text-foreground mb-2">Links</h3>
        <div className="flex gap-2 mb-2">
          <input
            value={newLink}
            onChange={(e) => setNewLink(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addLink()}
            placeholder="https://..."
            className="flex-1 bg-muted border border-input rounded-lg px-3 py-2 text-sm outline-none focus:border-ring"
          />
          <button onClick={addLink} className="px-3 bg-foreground text-background rounded-lg text-sm"><Link2 className="w-4 h-4" /></button>
        </div>
        {links.map((l, i) => (
          <div key={i} className="flex items-center justify-between py-1">
            <a href={l.url} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline truncate">{l.url}</a>
            <button onClick={() => onLinksChange(links.filter((_, idx) => idx !== i))} className="text-muted-foreground/50 hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
