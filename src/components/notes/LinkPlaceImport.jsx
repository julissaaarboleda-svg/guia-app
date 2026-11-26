import { useRef, useState } from "react";
import { Link2, Camera, Loader2, Check, ClipboardPaste } from "lucide-react";
import { base44 } from "@/api/base44Client";

const KIND_LABEL = { tiktok: "TikTok", instagram: "Instagram", maps: "Google Maps", web: "the page", screenshot: "the screenshot" };

// Shrink a photo or screenshot to a JPEG and return { mimeType, data } (base64).
export async function imagePayload(file) {
  const toB64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(blob); });
  // iPhone Safari can draw HEIC photos, so they're converted to JPEG like any other.
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.85));
    return { mimeType: "image/jpeg", data: await toB64(blob || file) };
  } catch { return { mimeType: file.type || "image/jpeg", data: await toB64(file) }; }
  finally { URL.revokeObjectURL(url); }
}

// Top of "Save a place": paste a TikTok / Instagram / Maps link (or add a
// screenshot) and Guía finds the places in it.
export default function LinkPlaceImport({ onPickOne, onSaveMany }) {
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null); // { source, places }
  const [picked, setPicked] = useState([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const run = async (payload) => {
    setBusy(true); setErr(""); setResult(null);
    try {
      const r = await base44.integrations.Core.PlacesFromLink(payload);
      if (!r.places?.length) {
        setErr(r.reason === "not_found" ? "Couldn't match those places on the map. Try searching by name below."
          : `Couldn't find a place named in ${KIND_LABEL[r.source?.kind] || "it"}. Try a screenshot of the post, or search by name below.`);
      } else if (r.places.length === 1) {
        onPickOne(r.places[0], r.source);
      } else {
        setResult(r); setPicked(r.places.map((p) => p.placeId));
      }
    } catch (e) { setErr(e.message || "Couldn't read that link. Try a screenshot instead."); }
    setBusy(false);
  };

  const fromLink = (raw) => {
    const t = String(raw || link).trim();
    const m = t.match(/https?:\/\/\S+/);
    if (!m) { setErr("Paste a link that starts with https://"); return; }
    setLink(m[0]); run({ url: m[0] });
  };
  const paste = async () => {
    setErr("");
    try {
      const t = await navigator.clipboard.readText();
      if (/https?:\/\//.test(t || "")) fromLink(t); else { setErr("No link copied. In TikTok or Instagram tap Share, then Copy link."); }
    } catch { setErr("Couldn't read the clipboard. Paste the link into the box instead."); }
  };
  const fromShot = async (file) => {
    if (!file) return;
    try { run({ image: await imagePayload(file) }); } catch { setErr("Couldn't read that picture."); }
  };

  const saveMany = async () => {
    const list = result.places.filter((p) => picked.includes(p.placeId));
    if (!list.length) return;
    setSaving(true);
    try { await onSaveMany(list, result.source); } catch { setErr("Couldn't save. Try again."); }
    setSaving(false);
  };

  if (result) {
    return (
      <div className="rounded-2xl border border-[#A7773F]/50 bg-[#FBF8F3] p-3">
        <p className="text-[13px] text-foreground mb-2">Found {result.places.length} places in {KIND_LABEL[result.source?.kind] || "the link"}. Pick the ones to save.</p>
        <div className="bg-card border border-border rounded-xl px-3">
          {result.places.map((p, i) => {
            const on = picked.includes(p.placeId);
            return (
              <button key={p.placeId} type="button" onClick={() => setPicked(on ? picked.filter((x) => x !== p.placeId) : [...picked, p.placeId])}
                className={`w-full flex items-start gap-2.5 py-2.5 text-left ${i ? "border-t border-border/60" : ""}`}>
                <span className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5" style={on ? { background: "#A7773F" } : { border: "1.5px solid #D9CFBF" }}>
                  {on && <Check className="w-3.5 h-3.5 text-white" strokeWidth={2.6} />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] text-foreground">{p.name}</span>
                  <span className="block text-[11.5px] text-muted-foreground truncate">{p.address}</span>
                  {p.why && <span className="block text-[11.5px] text-muted-foreground italic truncate">"{p.why}"</span>}
                </span>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2.5">
          <button type="button" onClick={() => setResult(null)} className="h-10 rounded-xl border border-border text-[13px] text-muted-foreground">Back</button>
          <button type="button" onClick={saveMany} disabled={saving || !picked.length} className="h-10 rounded-xl bg-[#2E2A27] text-[#F7F3EC] text-[13px] disabled:opacity-60 inline-flex items-center justify-center gap-1.5">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}Save {picked.length} {picked.length === 1 ? "place" : "places"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#A7773F]/50 bg-[#FBF8F3] p-3">
      <p className="text-[13px] text-foreground">Add from a TikTok, Instagram or Maps link</p>
      <p className="text-[11.5px] text-muted-foreground mb-2">In the app, tap Share, then Copy link.</p>
      <div className="flex gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-2 bg-card border border-border rounded-xl px-3 h-10">
          <Link2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input value={link} onChange={(e) => { setLink(e.target.value); setErr(""); }} onKeyDown={(e) => e.key === "Enter" && fromLink()}
            onPaste={(e) => { const t = e.clipboardData?.getData("text"); if (t && /https?:\/\//.test(t)) { e.preventDefault(); fromLink(t); } }}
            placeholder="Paste a link" inputMode="url" autoComplete="off"
            className="flex-1 min-w-0 bg-transparent text-[16px] md:text-[14px] text-foreground outline-none placeholder:text-muted-foreground" />
        </div>
        {link.trim() ? (
          <button type="button" onClick={() => fromLink()} disabled={busy} className="h-10 px-3.5 rounded-xl bg-[#A7773F] text-[#F7F3EC] text-[13px] disabled:opacity-60">Find</button>
        ) : (
          <button type="button" onClick={paste} disabled={busy} className="h-10 px-3 rounded-xl border border-[#A7773F] text-[#8A5F2F] text-[13px] inline-flex items-center gap-1.5 disabled:opacity-60">
            <ClipboardPaste className="w-4 h-4" />Paste
          </button>
        )}
      </div>
      <div className="flex items-center justify-between mt-2">
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="text-[12px] text-[#8A5F2F] inline-flex items-center gap-1.5 disabled:opacity-60">
          <Camera className="w-3.5 h-3.5" />Use a screenshot instead
        </button>
        <input ref={fileRef} type="file" accept="image/*,image/heic,image/heif,.heic,.heif" className="hidden" onChange={(e) => { fromShot(e.target.files?.[0]); e.target.value = ""; }} />
        {busy && <span className="text-[12px] text-muted-foreground inline-flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />Reading it…</span>}
      </div>
      {err && <p className="text-[12px] text-[#8F5F65] mt-2">{err}</p>}
      <p className="text-[10.5px] text-muted-foreground mt-2">Only public posts. Screenshots are read once and not kept.</p>
    </div>
  );
}
