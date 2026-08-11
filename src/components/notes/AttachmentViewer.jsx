import { X, Download } from "lucide-react";

export default function AttachmentViewer({ attachment, onClose }) {
  if (!attachment) return null;

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = attachment.url;
    link.download = attachment.name || "attachment";
    link.target = "_blank";
    link.click();
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/90 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between p-4" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="text-white/90 hover:text-white p-2 transition-colors">
          <X className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-white/60 text-xs truncate max-w-[180px]">{attachment.name}</span>
          <button onClick={handleDownload} className="text-white/90 hover:text-white p-2 transition-colors">
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-4" onClick={onClose}>
        {attachment.type === "image" ? (
          <img
            src={attachment.url}
            alt={attachment.name}
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <div className="text-center" onClick={e => e.stopPropagation()}>
            <p className="text-white/80 text-sm mb-4">{attachment.name}</p>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              <Download className="w-4 h-4" /> Download file
            </button>
          </div>
        )}
      </div>
    </div>
  );
}