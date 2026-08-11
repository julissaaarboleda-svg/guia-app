import { useState, useRef } from "react";
import { Camera, Image as ImageIcon, FileText, X } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function AttachmentSheet({ open, onClose, onUpload }) {
  const [uploading, setUploading] = useState(false);
  const cameraRef = useRef(null);
  const photoRef = useRef(null);
  const fileRef = useRef(null);

  if (!open) return null;

  const handleFile = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const attachments = [];
      for (const file of Array.from(files)) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        const isImage = file.type.startsWith("image/");
        attachments.push({ url: file_url, name: file.name, type: isImage ? "image" : "file" });
      }
      onUpload(attachments);
      onClose();
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-t-3xl md:rounded-2xl w-full max-w-sm shadow-editorial"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="font-heading text-base text-foreground">Add attachment</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        {uploading ? (
          <div className="p-8 flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
            <p className="text-xs text-muted-foreground">Uploading...</p>
          </div>
        ) : (
          <div className="p-5 pt-2 space-y-1">
            <button
              onClick={() => cameraRef.current?.click()}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors"
            >
              <Camera className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-foreground">Take Photo</span>
            </button>
            <button
              onClick={() => photoRef.current?.click()}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors"
            >
              <ImageIcon className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-foreground">Photo Library</span>
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors"
            >
              <FileText className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-foreground">Browse Files</span>
            </button>
          </div>
        )}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={e => handleFile(e.target.files)}
        />
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => handleFile(e.target.files)}
        />
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => handleFile(e.target.files)}
        />
      </div>
    </div>
  );
}