import { useState } from "react";
import { Upload, Trash2, FileText, X } from "lucide-react";
import { base44 } from "@/api/base44Client";

function isImage(att) {
  const name = (att.name || att.url || "").toLowerCase();
  return /\.(jpe?g|png|gif|webp|heic|svg)$/.test(name) || (att.type || "").startsWith("image/");
}

export default function ProjectResources({ attachments, onAttachmentsChange }) {
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onAttachmentsChange([...attachments, { name: file.name, url: file_url, type: file.type }]);
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (i) => onAttachmentsChange(attachments.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-foreground">Attachments</h3>
          <label className="flex items-center gap-1 text-xs text-accent cursor-pointer hover:underline">
            <Upload className="w-3.5 h-3.5" /> {uploading ? "Uploading..." : "Upload"}
            <input type="file" className="hidden" onChange={upload} disabled={uploading} />
          </label>
        </div>
        {attachments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No files yet.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {attachments.map((a, i) =>
              isImage(a) ? (
                <div key={i} className="relative group aspect-square rounded-lg overflow-hidden bg-muted">
                  <button onClick={() => setLightbox(a)} className="w-full h-full">
                    <img src={a.url} alt={a.name} className="w-full h-full object-cover" />
                  </button>
                  <button
                    onClick={() => removeAttachment(i)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <a
                  key={i}
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="aspect-square rounded-lg border border-border bg-muted flex flex-col items-center justify-center gap-1 p-2 text-center hover:border-accent transition-colors"
                >
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <span className="text-[10px] text-foreground truncate w-full">{a.name}</span>
                </a>
              )
            )}
          </div>
        )}
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-[80] bg-black/85 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 text-white/70 hover:text-white">
            <X className="w-6 h-6" />
          </button>
          <img src={lightbox.url} alt={lightbox.name} className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
