import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { Upload, Link2, Loader2, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { imagePayload } from "@/components/notes/LinkPlaceImport";
import { stepsToHtml, hasText } from "@/lib/listInstructions";

const TOOLBAR = [[{ header: [3, false] }], ["bold", "italic"], [{ list: "ordered" }, { list: "bullet" }], ["clean"]];

async function filePayload(file) {
  if (/^image\//i.test(file.type) || /\.(heic|heif)$/i.test(file.name || "")) return { ...(await imagePayload(file)), name: file.name };
  const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(file); });
  return { mimeType: file.type || "application/octet-stream", data, name: file.name };
}

// The paper icon on a list: notes or full instructions, in a pop-up over the list.
// Rich text (bold, numbered…), saved on the list as you type; Upload fills it
// from a link, file or photo.
export default function ListInstructionsSheet({ open, value, onChange, onClose, title }) {
  const [shown, setShown] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef(null);
  const valRef = useRef(value);
  valRef.current = value;

  useEffect(() => {
    if (!open) return;
    setUploadOpen(false); setErr(""); setLink("");
    const id = requestAnimationFrame(() => setShown(true));
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { cancelAnimationFrame(id); document.body.style.overflow = prev; setShown(false); };
  }, [open]);

  const close = () => { setShown(false); setTimeout(onClose, 250); };

  const fill = async (payload) => {
    setBusy(true); setErr("");
    try {
      const r = await base44.integrations.Core.ListFromSource({ ...payload, mode: "instructions" });
      if (!r.steps?.length) { setErr(r.reason === "unreadable" ? "Guía can't read that kind of file. Try a photo or screenshot." : "Couldn't find instructions in that. Try a clearer photo of the steps."); }
      else {
        const html = stepsToHtml(r);
        onChange(hasText(valRef.current) ? `${valRef.current}<p><br></p>${html}` : html);
        setUploadOpen(false);
      }
    } catch (e) { setErr(e.message || "Couldn't read that. Try a screenshot instead."); }
    setBusy(false);
  };

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[85]" role="dialog" aria-modal="true" aria-label="Instructions">
      <button type="button" aria-label="Close" onClick={close} className={`absolute inset-0 bg-[#2E2A27]/30 transition-opacity duration-300 ${shown ? "opacity-100" : "opacity-0"}`} />
      <div className="absolute left-0 right-0 bottom-0 max-w-lg mx-auto bg-[#F7F3EC] rounded-t-[22px] border-t border-[#E4DCCF] flex flex-col"
        style={{ height: "82vh", transform: shown ? "translateY(0)" : "translateY(100%)", transition: "transform 300ms cubic-bezier(.16,1,.3,1)", paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}>
        <div className="px-5 pt-2.5">
          <div className="w-9 h-1 rounded-full bg-[#D9CFBF] mx-auto mb-3" />
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10.5px] tracking-[0.16em] uppercase text-[#A7773F] truncate">{title || "List"}</p>
              <h2 className="font-heading text-[20px] text-foreground leading-tight">Instructions</h2>
            </div>
            <button type="button" onClick={() => setUploadOpen((o) => !o)} className="text-[13px] text-[#A7773F] inline-flex items-center gap-1"><Upload className="w-4 h-4" />Upload</button>
            <button type="button" onClick={close} aria-label="Close" className="p-1 text-muted-foreground"><X className="w-5 h-5" strokeWidth={1.5} /></button>
          </div>
        </div>

        {uploadOpen && (
          <div className="mx-5 mt-3 bg-card border border-border rounded-2xl p-3">
            <p className="text-[13px] text-foreground mb-2">Add instructions from…</p>
            <div className="flex gap-2">
              <div className="flex-1 min-w-0 flex items-center gap-2 bg-secondary border border-border rounded-xl px-3 h-10">
                <Link2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <input value={link} onChange={(e) => { setLink(e.target.value); setErr(""); }} placeholder="Paste a link" inputMode="url" autoComplete="off"
                  onKeyDown={(e) => { if (e.key === "Enter") { const m = link.match(/https?:\/\/\S+/); if (m) fill({ url: m[0] }); } }}
                  className="flex-1 min-w-0 bg-transparent text-[16px] md:text-[14px] text-foreground outline-none" />
              </div>
              {link.trim() && <button type="button" disabled={busy} onClick={() => { const m = link.match(/https?:\/\/\S+/); if (m) fill({ url: m[0] }); else setErr("Paste a link that starts with https://"); }} className="h-10 px-3.5 rounded-xl bg-[#A7773F] text-[#F7F3EC] text-[13px] disabled:opacity-60">Read</button>}
            </div>
            <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="w-full h-10 mt-2 rounded-xl bg-[#2E2A27] text-[#F7F3EC] text-[13px] inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}{busy ? "Reading it…" : "Choose files or photos"}
            </button>
            <input ref={fileRef} type="file" accept="image/*,image/heic,image/heif,.heic,.heif,application/pdf,.pdf,text/plain,.txt,.md,*/*" className="hidden"
              multiple onChange={async (e) => { const fs = Array.from(e.target.files || []).slice(0, 8); e.target.value = ""; if (!fs.length) return; try { const p = await Promise.all(fs.map(filePayload)); fill(p.length > 1 ? { files: p } : { file: p[0] }); } catch { setErr("Couldn't open that file."); } }} />
            <p className="text-[11px] text-muted-foreground mt-2">Long one? Pick several screenshots at once. Guía writes the steps in, numbered and ready to edit. Files aren't kept.</p>
            {err && <p className="text-[12px] text-[#8F5F65] mt-2">{err}</p>}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-3 quill-notes">
          <div className="bg-card rounded-xl overflow-hidden border border-border">
            <ReactQuill theme="snow" value={value || ""} onChange={onChange} modules={{ toolbar: TOOLBAR }}
              placeholder="Notes or steps for this list. Number them, bold what matters…" style={{ minHeight: "240px" }} />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">Saves on its own. Tap outside or X to go back to the list.</p>
        </div>
      </div>
    </div>,
    document.body
  );
}
