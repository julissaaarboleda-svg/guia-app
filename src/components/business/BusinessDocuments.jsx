import { useState, useRef, useEffect } from "react";
import { FileText, Image as ImageIcon, Plus, Trash2, X, Upload } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { ent } from "@/lib/freshEntities";

export const DOC_CATEGORIES = ["Receipts & invoices", "Contracts", "Licenses & permits", "Tax documents"];
const MAX_BYTES = 4 * 1024 * 1024;

const sizeLabel = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const stem = (n) => (n || "").replace(/\.[^.]+$/, "");

// Files here are stored privately: only the signed-in owner can open them.
export default function BusinessDocuments({ docs, onChange, businessId, addSignal = 0, readOnly = false }) {
  const [filter, setFilter] = useState("All");
  const [sheet, setSheet] = useState(false);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(DOC_CATEGORIES[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [openingId, setOpeningId] = useState(null);
  const fileRef = useRef(null);
  useEffect(() => { if (addSignal > 0) setSheet(true); }, [addSignal]);

  const shown = filter === "All" ? docs : docs.filter((d) => d.category === filter);
  const counts = (c) => docs.filter((d) => d.category === c).length;

  const closeSheet = () => { setSheet(false); setFile(null); setTitle(""); setError(""); setCategory(filter !== "All" ? filter : DOC_CATEGORIES[0]); };

  const pick = (f) => {
    if (!f) return;
    if (f.size > MAX_BYTES) { setError("That file is over 4 MB. Try a smaller scan or a photo."); return; }
    setError(""); setFile(f); setTitle((t) => t || stem(f.name));
  };

  const save = async () => {
    if (!file || busy) return;
    setBusy(true); setError("");
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file, private: true });
      await ent.BusinessDocument.create({
        title: title.trim() || stem(file.name), category, file_url,
        filename: file.name, content_type: file.type || "", size: file.size,
        added: new Date().toISOString().split("T")[0],
        business_id: businessId || undefined,
      });
      onChange && onChange();
      closeSheet();
    } catch (err) {
      setError(err.message || "Couldn't upload that file.");
    } finally {
      setBusy(false);
    }
  };

  const open = async (d) => {
    setOpeningId(d.id);
    // Open the tab first so the browser doesn't block it as a popup.
    const tab = window.open("", "_blank");
    try {
      const url = await base44.integrations.Core.GetPrivateFile({ file_url: d.file_url });
      if (tab) tab.location.href = url; else window.location.href = url;
    } catch {
      if (tab) tab.close();
      setError("Couldn't open that file. Try again in a moment.");
    } finally {
      setOpeningId(null);
    }
  };

  const remove = async (d) => {
    if (!window.confirm(`Delete “${d.title}”? The file will be removed too.`)) return;
    try { await base44.integrations.Core.DeletePrivateFile({ file_url: d.file_url }); } catch { /* the record still goes */ }
    await ent.BusinessDocument.delete(d.id);
    onChange && onChange();
  };

  const chip = (label, active, onClick, n) => (
    <button key={label} onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-medium whitespace-nowrap transition-colors ${active ? "bg-[#E7D9C6] text-foreground" : "border border-border text-muted-foreground hover:text-foreground"}`}>
      {label}{n ? ` · ${n}` : ""}
    </button>
  );

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading text-[18px] text-foreground">Documents</h2>
        {!readOnly && (
          <button onClick={() => { setCategory(filter !== "All" ? filter : DOC_CATEGORIES[0]); setSheet(true); }}
            className="inline-flex items-center gap-1 text-[13px] font-medium text-[#A7773F]">
            <Plus className="w-4 h-4" strokeWidth={1.5} /> Add document
          </button>
        )}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 -mx-1 px-1">
        {chip("All", filter === "All", () => setFilter("All"), docs.length)}
        {DOC_CATEGORIES.map((c) => chip(c, filter === c, () => setFilter(c), counts(c)))}
      </div>

      {shown.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl text-center py-8 px-4">
          <p className="font-heading text-base text-foreground">{docs.length === 0 ? "Keep the paperwork here" : `No ${filter.toLowerCase()} yet`}</p>
          <p className="text-xs text-muted-foreground mt-1">Receipts, contracts, permits and tax papers, stored privately.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl divide-y divide-border/60 overflow-hidden">
          {shown.map((d) => {
            const img = (d.content_type || "").startsWith("image/");
            return (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3 group">
                <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0 text-[#A7773F]">
                  {img ? <ImageIcon className="w-[18px] h-[18px]" strokeWidth={1.5} /> : <FileText className="w-[18px] h-[18px]" strokeWidth={1.5} />}
                </div>
                <button onClick={() => open(d)} className="min-w-0 flex-1 text-left">
                  <p className="font-heading text-[15px] text-foreground truncate">{d.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {d.category}{d.added ? ` · ${new Date(`${d.added}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}{d.size ? ` · ${sizeLabel(d.size)}` : ""}
                  </p>
                </button>
                {openingId === d.id && <span className="text-[11px] text-muted-foreground">Opening…</span>}
                <button onClick={() => remove(d)} aria-label="Delete document" className="text-muted-foreground hover:text-rose-400 lg:opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      {error && !sheet && <p className="text-xs text-destructive mt-2">{error}</p>}

      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={busy ? undefined : closeSheet} />
          <div className="relative w-full sm:max-w-md bg-background rounded-t-3xl sm:rounded-3xl border border-border p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-heading text-[20px] text-foreground leading-tight">Add a document</h2>
                <p className="font-heading italic text-[13px] text-muted-foreground">Stored privately. Only you can open it.</p>
              </div>
              {!busy && <button onClick={closeSheet} className="text-muted-foreground hover:text-foreground" aria-label="Close"><X className="w-5 h-5" strokeWidth={1.5} /></button>}
            </div>

            <button onClick={() => fileRef.current?.click()}
              className="w-full border border-dashed border-[#A7773F]/60 rounded-2xl py-6 flex flex-col items-center gap-1.5 text-[#A7773F] hover:bg-secondary/50 transition-colors">
              <Upload className="w-5 h-5" strokeWidth={1.5} />
              <span className="text-sm font-medium truncate max-w-full px-4">{file ? file.name : "Choose a file"}</span>
              <span className="text-xs text-muted-foreground">{file ? sizeLabel(file.size) : "PDF or photo · under 4 MB"}</span>
            </button>
            <input ref={fileRef} type="file" accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx,.csv,.txt" className="hidden"
              onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />

            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name (e.g. Fabric invoice, March)"
              className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring mt-3" />
            <div className="flex flex-wrap gap-1.5 mt-3">
              {DOC_CATEGORIES.map((c) => chip(c, category === c, () => setCategory(c)))}
            </div>

            {error && <p className="text-xs text-destructive mt-3">{error}</p>}
            <div className="flex items-center gap-3 mt-4">
              <button onClick={save} disabled={!file || busy}
                className="bg-[#A7773F] text-[#F7F3EC] px-5 py-2.5 rounded-full text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {busy ? "Uploading…" : "Save document"}
              </button>
              <button onClick={closeSheet} disabled={busy} className="text-sm text-muted-foreground hover:text-foreground">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
