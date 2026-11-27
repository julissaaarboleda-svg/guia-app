import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Link2, Upload, Loader2, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { imagePayload } from "@/components/notes/LinkPlaceImport";

const LAST_LIST_KEY = "guia-import-list-last";

// File -> { mimeType, data, name } (photos shrunk; other files as they are).
async function filePayload(file) {
  const isImage = /^image\//i.test(file.type) || /\.(heic|heif)$/i.test(file.name || "");
  if (isImage) return { ...(await imagePayload(file)), name: file.name };
  const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(file); });
  return { mimeType: file.type || "application/octet-stream", data, name: file.name };
}

// "Import list": a recipe, build instructions, a pattern… -> items to check,
// then added to any of your lists (or a new one).
// source: optional { text, title } to skip the input step (from a note).
export default function ImportListSheet({ open, onClose, lists = [], currentListId, source, onAdd }) {
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null); // { title, groups }
  const [picked, setPicked] = useState(new Set());
  const [target, setTarget] = useState("");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [keepSteps, setKeepSteps] = useState(true);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setLink(""); setErr(""); setResult(null); setBusy(false); setSaving(false); setNewName(""); setKeepSteps(true);
    let last = "";
    try { last = localStorage.getItem(LAST_LIST_KEY) || ""; } catch { /* ignore */ }
    setTarget(currentListId || (lists.some((l) => l.id === last) ? last : lists[0]?.id || "__new__"));
    if (source?.text) run({ text: source.text }, source.title);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (payload, fallbackTitle = "") => {
    setBusy(true); setErr(""); setResult(null);
    try {
      const r = await base44.integrations.Core.ListFromSource(payload);
      if (!r.groups?.length) {
        setErr(r.reason === "unreadable" ? "Guía can't read that kind of file. Try a photo or screenshot of the list part." : "Couldn't find things to get in that. Try a screenshot of the ingredients or materials part.");
      } else {
        const title = r.title || fallbackTitle;
        setResult({ ...r, title });
        const on = new Set();
        r.groups.forEach((g, gi) => g.items.forEach((it, ii) => on.add(`${gi}-${ii}`)));
        setPicked(on);
        if (!newName) setNewName(title);
      }
    } catch (e) { setErr(e.message || "Couldn't read that. Try a screenshot instead."); }
    setBusy(false);
  };

  const fromLink = () => {
    const m = link.trim().match(/https?:\/\/\S+/);
    if (!m) { setErr("Paste a link that starts with https://"); return; }
    run({ url: m[0] });
  };
  // One or several files (a long recipe in a few screenshots), read together in order.
  const fromFiles = async (list) => {
    const fs = Array.from(list || []).slice(0, 8);
    if (!fs.length) return;
    try {
      const payloads = await Promise.all(fs.map(filePayload));
      run(payloads.length > 1 ? { files: payloads } : { file: payloads[0] }, (fs[0].name || "").replace(/\.[^.]+$/, ""));
    } catch { setErr("Couldn't open that file."); }
  };

  const toggle = (k) => setPicked((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const add = async () => {
    const items = [];
    result.groups.forEach((g, gi) => g.items.forEach((it, ii) => { if (picked.has(`${gi}-${ii}`)) items.push({ text: it.text, pantry: !!it.maybe_have }); }));
    if (!items.length) { setErr("Check at least one item."); return; }
    setSaving(true);
    try {
      await onAdd({ listId: target === "__new__" ? null : target, newName: newName.trim() || result.title || "New list", items, from: result.title || "",
        steps: keepSteps && result.steps?.length ? { key_info: result.key_info, steps: result.steps } : null });
      try { if (target !== "__new__") localStorage.setItem(LAST_LIST_KEY, target); } catch { /* ignore */ }
      onClose();
    } catch { setErr("Couldn't add them. Try again."); }
    setSaving(false);
  };

  if (!open) return null;
  const count = picked.size;
  return createPortal(
    <div className="fixed inset-0 z-[75] flex items-end md:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-[#F7F3EC] w-full max-w-md rounded-t-3xl md:rounded-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-2 sticky top-0 bg-[#F7F3EC] z-10">
          <h2 className="font-heading text-[20px] text-foreground">{result ? `${result.title || "Your list"} · ${result.groups.reduce((n, g) => n + g.items.length, 0)} items` : "Import list"}</h2>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-5 pb-2">
          {!result && !busy && !source?.text && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-[14px] text-foreground mb-2">What do you need a list for?</p>
              <div className="flex gap-2">
                <div className="flex-1 min-w-0 flex items-center gap-2 bg-secondary border border-border rounded-xl px-3 h-10">
                  <Link2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <input value={link} onChange={(e) => { setLink(e.target.value); setErr(""); }} onKeyDown={(e) => e.key === "Enter" && fromLink()} placeholder="Paste a link" inputMode="url" autoComplete="off"
                    className="flex-1 min-w-0 bg-transparent text-[16px] md:text-[14px] text-foreground outline-none" />
                </div>
                {link.trim() && <button type="button" onClick={fromLink} className="h-10 px-3.5 rounded-xl bg-[#A7773F] text-[#F7F3EC] text-[13px]">Read</button>}
              </div>
              <button type="button" onClick={() => fileRef.current?.click()} className="w-full h-10 mt-2 rounded-xl bg-[#2E2A27] text-[#F7F3EC] text-[13.5px] inline-flex items-center justify-center gap-1.5">
                <Upload className="w-4 h-4" />Choose files or photos
              </button>
              <input ref={fileRef} type="file" accept="image/*,image/heic,image/heif,.heic,.heif,application/pdf,.pdf,text/plain,.txt,.md,.csv,*/*" multiple className="hidden" onChange={(e) => { fromFiles(e.target.files); e.target.value = ""; }} />
              <p className="text-[11.5px] text-muted-foreground mt-2">A recipe, build instructions, a sewing pattern, a packing guide… Long one? Pick several screenshots at once. Files are read once and not kept.</p>
            </div>
          )}

          {busy && (
            <div className="py-12 flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-[#A7773F]" />
              <p className="text-[13px]">Reading it…</p>
            </div>
          )}

          {result && (
            <>
              <p className="text-[12.5px] text-muted-foreground mb-2">Everything's included. Things you may already have go in a Pantry section at the bottom of the list.</p>
              <div className="bg-card border border-border rounded-2xl px-4 pb-1">
                {result.groups.map((g, gi) => (
                  <div key={gi}>
                    <p className="text-[10.5px] tracking-[0.16em] uppercase text-muted-foreground pt-3 pb-1">{g.name}</p>
                    {g.items.map((it, ii) => {
                      const k = `${gi}-${ii}`; const on = picked.has(k);
                      return (
                        <button key={k} type="button" onClick={() => toggle(k)} className="w-full flex items-center gap-2.5 py-2 border-t border-border/60 text-left">
                          <span className="w-[18px] h-[18px] rounded-[5px] flex items-center justify-center flex-shrink-0" style={on ? { background: "#A7773F" } : { border: "1.5px solid #D9CFBF" }}>
                            {on && <Check className="w-3 h-3 text-white" strokeWidth={2.6} />}
                          </span>
                          <span className={`flex-1 min-w-0 text-[14px] ${on ? "text-foreground" : "text-muted-foreground"}`}>{it.text}</span>
                          {it.maybe_have && <span className="text-[10.5px] text-muted-foreground whitespace-nowrap">pantry</span>}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-[13px] text-muted-foreground">Add to</span>
                <select value={target} onChange={(e) => setTarget(e.target.value)} className="flex-1 min-w-0 bg-card border border-border rounded-xl px-3 h-10 text-[14px] text-foreground outline-none">
                  {lists.map((l) => <option key={l.id} value={l.id}>{l.title || "Untitled list"}</option>)}
                  <option value="__new__">New list…</option>
                </select>
              </div>
              {target === "__new__" && (
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="List name"
                  className="w-full mt-2 bg-card border border-border rounded-xl px-3 h-10 text-[14px] text-foreground outline-none" />
              )}
              <p className="text-[11px] text-muted-foreground mt-1.5">Items already on the list aren't added twice.</p>
              {result.steps?.length > 0 && (
                <button type="button" onClick={() => setKeepSteps((k) => !k)} className="w-full flex items-center gap-2.5 mt-3 text-left">
                  <span className="w-[18px] h-[18px] rounded-[5px] flex items-center justify-center flex-shrink-0" style={keepSteps ? { background: "#A7773F" } : { border: "1.5px solid #D9CFBF" }}>
                    {keepSteps && <Check className="w-3 h-3 text-white" strokeWidth={2.6} />}
                  </span>
                  <span className="text-[13px] text-foreground">Also save the {result.steps.length} steps in the list's instructions</span>
                </button>
              )}
              <button type="button" onClick={add} disabled={saving || !count} className="w-full h-12 mt-3 rounded-xl bg-[#2E2A27] text-[#F7F3EC] text-[14.5px] disabled:opacity-60 inline-flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}Add {count} {count === 1 ? "item" : "items"}
              </button>
            </>
          )}
          {err && <p className="text-[12.5px] text-[#8F5F65] mt-3">{err}</p>}
          {err && !result && !busy && source?.text && <button type="button" onClick={onClose} className="mt-2 text-[13px] text-[#A7773F]">Close</button>}
        </div>
      </div>
    </div>,
    document.body
  );
}
