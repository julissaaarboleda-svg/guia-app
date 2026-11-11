import { useState, useEffect, useRef } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

const Size = ReactQuill.Quill.import("attributors/style/size");
Size.whitelist = ["small", "12px", "14px", "16px", "18px", "large", "huge"];
ReactQuill.Quill.register(Size, true);
import { base44 } from "@/api/base44Client";
import { ent } from "@/lib/freshEntities";
import {
  Plus, Trash2, List, FileText, Check, ArrowLeft, Paperclip, Pencil,
  Folder as FolderIcon, Share2, Download, MoreHorizontal, Navigation, X, Pin,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import AttachmentSheet from "@/components/notes/AttachmentSheet";
import NoteAttachments from "@/components/notes/NoteAttachments";
import AttachmentViewer from "@/components/notes/AttachmentViewer";
import NotesLanding from "@/components/notes/NotesLanding";
import CollectionSheet from "@/components/notes/CollectionSheet";
import NewCollectionSheet from "@/components/notes/NewCollectionSheet";
import { accentHex } from "@/components/notes/collectionAccents";

const PLACE_TYPES = ["Restaurant", "Café", "Bar", "Shop", "Hotel", "Attraction", "Park", "Other"];

function mapsUrl(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [folders, setFolders] = useState([]);
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [activeFolder, setActiveFolder] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState("text");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selected, setSelected] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [newItemText, setNewItemText] = useState("");
  const [showCheckedItems, setShowCheckedItems] = useState(false);
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [openCollection, setOpenCollection] = useState(null);
  const [longPressFolder, setLongPressFolder] = useState(null);
  const [noteMenu, setNoteMenu] = useState(null);
  const [moveNote, setMoveNote] = useState(null);
  const [viewerAttachment, setViewerAttachment] = useState(null);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [placeForm, setPlaceForm] = useState(null); // { id?, name, type, address } | null
  const [placeMenu, setPlaceMenu] = useState(null);
  const newItemRef = useRef(null);
  const autoSaveTimer = useRef(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const [n, f, p] = await Promise.all([
      ent.Note.list("-updated_date"),
      ent.Folder.list("-created_date"),
      ent.SavedPlace.list("-updated_date"),
    ]);
    setNotes(n);
    setFolders(f);
    setSavedPlaces(p);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createCollection = async (data) => {
    const created = await ent.Folder.create({
      name: data.name,
      icon_type: data.icon_type || "folder",
      emoji: data.emoji,
      accent_color: data.accent_color || "sage",
    });
    setFolders((prev) => [created, ...prev]);
    setShowNewCollection(false);
  };

  const updateCollection = async (id, patch) => {
    await ent.Folder.update(id, patch);
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    if (openCollection?.id === id) setOpenCollection((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const deleteCollection = async (id) => {
    try {
      const folderNotes = notes.filter((n) => n.folder_id === id);
      await Promise.all(
        folderNotes.map((n) => ent.Note.update(n.id, { folder_id: null }))
      );
      await ent.Folder.delete(id);

      setNotes((prev) => prev.map((n) => (n.folder_id === id ? { ...n, folder_id: null } : n)));
      setFolders((prev) => prev.filter((f) => f.id !== id));
      if (openCollection?.id === id) setOpenCollection(null);
    } catch (err) {
      console.error("Failed to delete collection:", err);
      toast({ title: "Couldn't delete collection", description: "Please try again.", variant: "destructive" });
    }
  };

  // type: "list" jumps straight into checklist mode instead of the default
  // text note — used by the "New checklist" button on the Checklists tab.
  const startNewNote = async (folderId, type) => {
    const note_type = type === "list" ? "list" : "text";
    const extra = note_type === "list" ? { list_items: [] } : {};
    const n = await ent.Note.create({ title: "", content: "", note_type, folder_id: folderId || null, ...extra });
    setNotes(prev => [n, ...prev]);
    setSelected(n);
    setEditingId(n.id);
  };

  const switchNoteType = async (type) => {
    if (!selected || type === selected.note_type) return;
    const patch = type === "list" ? { note_type: "list", list_items: [], content: "" } : { note_type: "text", content: "", list_items: [] };
    setSelected({ ...selected, ...patch });
    setNotes(prev => prev.map(n => n.id === selected.id ? { ...n, ...patch } : n));
    await ent.Note.update(selected.id, patch);
  };

  const persistNote = async (note, showToast = false) => {
    const patch = { title: note.title, content: note.content, list_items: note.list_items, attachments: note.attachments || [] };
    setNotes(prev => prev.map(n => n.id === note.id ? { ...n, ...patch } : n));
    await ent.Note.update(note.id, patch);
    if (showToast) toast({ title: "Note saved" });
  };

  const save = async () => {
    if (!selected) return;
    await persistNote(selected, true);
    backToList();
  };

  useEffect(() => {
    if (!selected || adding) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => { persistNote(selected, false); }, 900);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [selected?.title, selected?.content]);

  const remove = async (id) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    if (selected?.id === id) setSelected(null);
    if (noteMenu?.id === id) setNoteMenu(null);
    await ent.Note.delete(id);
  };

  const addListItem = async () => {
    if (!newItemText.trim() || !selected) return;
    const items = [...(selected.list_items || []), { text: newItemText.trim(), checked: false }];
    const updated = { ...selected, list_items: items };
    setSelected(updated);
    setNotes(prev => prev.map(n => n.id === selected.id ? { ...n, list_items: items } : n));
    setNewItemText("");
    await ent.Note.update(selected.id, { list_items: items });
    newItemRef.current?.focus();
  };

  const toggleItem = async (idx) => {
    const items = (selected.list_items || []).map((it, i) =>
      i === idx ? { ...it, checked: !it.checked } : it
    );
    setSelected({ ...selected, list_items: items });
    setNotes(prev => prev.map(n => n.id === selected.id ? { ...n, list_items: items } : n));
    await ent.Note.update(selected.id, { list_items: items });
  };

  const removeItem = async (idx) => {
    const items = (selected.list_items || []).filter((_, i) => i !== idx);
    setSelected({ ...selected, list_items: items });
    setNotes(prev => prev.map(n => n.id === selected.id ? { ...n, list_items: items } : n));
    await ent.Note.update(selected.id, { list_items: items });
  };

  const handleUpload = async (newAttachments) => {
    if (!selected) return;
    const updated = [...(selected.attachments || []), ...newAttachments];
    setSelected({ ...selected, attachments: updated });
    setNotes(prev => prev.map(n => n.id === selected.id ? { ...n, attachments: updated } : n));
    await ent.Note.update(selected.id, { attachments: updated });
    toast({ title: "Attachment saved", description: `${newAttachments.length} file${newAttachments.length > 1 ? "s" : ""} uploaded.` });
  };

  const removeAttachment = async (idx) => {
    const updated = (selected.attachments || []).filter((_, i) => i !== idx);
    setSelected({ ...selected, attachments: updated });
    setNotes(prev => prev.map(n => n.id === selected.id ? { ...n, attachments: updated } : n));
    await ent.Note.update(selected.id, { attachments: updated });
  };

  const changeFolder = async (folderId) => {
    if (!selected) return;
    setSelected({ ...selected, folder_id: folderId || null });
    setNotes(prev => prev.map(n => n.id === selected.id ? { ...n, folder_id: folderId || null } : n));
    await ent.Note.update(selected.id, { folder_id: folderId || null });
    setMoveNote(null);
    toast({ title: folderId ? "Moved to collection" : "Removed from collection" });
  };

  const moveNoteToFolder = async (noteId, folderId) => {
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, folder_id: folderId || null } : n));
    await ent.Note.update(noteId, { folder_id: folderId || null });
    setNoteMenu(null);
    toast({ title: folderId ? "Moved to collection" : "Removed from collection" });
  };

  const togglePin = async (note) => {
    const pinned = !note.pinned;
    setNotes(prev => prev.map(n => n.id === note.id ? { ...n, pinned } : n));
    setNoteMenu(null);
    try { await ent.Note.update(note.id, { pinned }); } catch (e) { console.error(e); }
    toast({ title: pinned ? "Pinned" : "Unpinned" });
  };

  const getNoteText = (note) => {
    if (!note) return "";
    let body = "";
    if (note.note_type === "list") {
      body = (note.list_items || []).map((i) => `${i.checked ? "[x]" : "[ ]"} ${i.text}`).join("\n");
    } else {
      const tmp = document.createElement("div");
      tmp.innerHTML = note.content || "";
      body = tmp.textContent || "";
    }
    return `${note.title}\n\n${body}`;
  };

  const downloadNote = (note) => {
    if (!note) return;
    const text = getNoteText(note);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${note.title.replace(/[^a-z0-9]/gi, "_")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "Note downloaded" });
  };

  const shareNote = async (note) => {
    if (!note) return;
    const email = prompt("Enter email to share this note with:");
    if (!email?.trim()) return;
    setSharing(true);
    try {
      await base44.integrations.Core.SendEmail({
        to: email.trim(),
        subject: `Shared Note: ${note.title}`,
        body: getNoteText(note),
      });
      toast({ title: "Note shared", description: `Sent to ${email.trim()}` });
    } catch (err) {
      toast({ title: "Share failed", description: "Could not send email.", variant: "destructive" });
    } finally {
      setSharing(false);
    }
  };

  // ---- Saved Places ----
  const openAddPlace = () => setPlaceForm({ name: "", type: "", address: "", place_id: "", maps_url: "", photo_url: "", photo_credit: "", notes: "", visited: false, rating: 0, visited_on: "" });
  const openEditPlace = (p) => { setPlaceMenu(null); setPlaceForm({ id: p.id, name: p.name || "", type: p.type || "", address: p.address || "", place_id: p.place_id || "", maps_url: p.maps_url || "", photo_url: p.photo_url || "", photo_credit: p.photo_credit || "", notes: p.notes || "", visited: !!p.visited, rating: Number(p.rating) || 0, visited_on: p.visited_on || "" }); };

  const savePlace = async () => {
    if (!placeForm?.name?.trim()) return;
    const patch = { name: placeForm.name.trim(), type: placeForm.type.trim(), address: placeForm.address.trim(), place_id: placeForm.place_id || null, maps_url: placeForm.maps_url || null, photo_url: placeForm.photo_url || null, photo_credit: placeForm.photo_credit || null, notes: (placeForm.notes || "").trim(), visited: !!placeForm.visited, rating: placeForm.visited ? Number(placeForm.rating) || 0 : 0, visited_on: placeForm.visited ? placeForm.visited_on || null : null };
    if (placeForm.id) {
      await ent.SavedPlace.update(placeForm.id, patch);
      setSavedPlaces(prev => prev.map(p => p.id === placeForm.id ? { ...p, ...patch } : p));
    } else {
      const created = await ent.SavedPlace.create(patch);
      setSavedPlaces(prev => [created, ...prev]);
    }
    setPlaceForm(null);
  };

  const deletePlace = async (id) => {
    setSavedPlaces(prev => prev.filter(p => p.id !== id));
    setPlaceMenu(null);
    await ent.SavedPlace.delete(id);
  };

  const isList = selected?.note_type === "list";
  const isBlank = !!selected && !selected.title?.trim() && !selected.content?.trim() &&
    (!selected.list_items || selected.list_items.length === 0) &&
    (!selected.attachments || selected.attachments.length === 0);
  const checkedCount = (selected?.list_items || []).filter((i) => i.checked).length;
  const totalCount = (selected?.list_items || []).length;
  const showingDetail = !!selected;
  const isEditing = !!selected && editingId === selected.id;
  const stripHtml = (h) => (h || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

  const renderChecklist = () => (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <input ref={newItemRef} value={newItemText} onChange={(e) => setNewItemText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addListItem()} placeholder="Add item…" enterKeyHint="done" className="flex-1 bg-card border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-[#A7773F] transition-colors" />
                  <button onClick={addListItem} aria-label="Add item" className="bg-[#A7773F] text-[#F7F3EC] w-10 h-10 flex items-center justify-center rounded-xl hover:opacity-90 transition-colors flex-shrink-0"><Plus className="w-4 h-4" /></button>
                </div>
                {totalCount > 0 && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{totalCount - checkedCount} to do · {checkedCount} done</p>
                  </div>
                )}
                {(() => {
                  const unchecked = (selected.list_items || []).map((item, idx) => ({ item, idx })).filter(({ item }) => !item.checked);
                  const checked = (selected.list_items || []).map((item, idx) => ({ item, idx })).filter(({ item }) => item.checked);
                  return (
                    <ul className="space-y-1.5">
                      {unchecked.map(({ item, idx }) => (
                        <li key={idx} className="flex items-center gap-3 group">
                          <button onClick={() => toggleItem(idx)} className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 hover:border-muted-foreground flex items-center justify-center flex-shrink-0 transition-all" />
                          <span className="text-sm flex-1 text-foreground">{item.text}</span>
                          <button onClick={() => removeItem(idx)} className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-destructive transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                        </li>
                      ))}
                      {unchecked.length === 0 && checked.length > 0 && <li className="text-sm text-muted-foreground py-1">All done. Nice work.</li>}
                      {checked.length > 0 && (
                        <li className="flex items-center justify-between border-t border-border pt-2.5 mt-1">
                          <button onClick={() => setShowCheckedItems((v) => !v)} className="text-[10.5px] tracking-[0.16em] uppercase font-semibold text-muted-foreground flex items-center gap-1.5">
                            Completed · {checked.length} <span className="text-[9px]">{showCheckedItems ? "▲" : "▼"}</span>
                          </button>
                          <button onClick={async () => { if (!confirm(`Clear ${checked.length} completed ${checked.length === 1 ? "item" : "items"}?`)) return; const items = (selected.list_items || []).filter((i) => !i.checked); setSelected({ ...selected, list_items: items }); setNotes(prev => prev.map(n => n.id === selected.id ? { ...n, list_items: items } : n)); await ent.Note.update(selected.id, { list_items: items }); }} className="text-xs font-medium text-[#A7773F]">Clear {checked.length}</button>
                        </li>
                      )}
                      {showCheckedItems && checked.map(({ item, idx }) => (
                        <li key={idx} className="flex items-center gap-3 group opacity-70">
                          <button onClick={() => toggleItem(idx)} className="w-5 h-5 rounded-full bg-[#5A6F45] border border-[#5A6F45] flex items-center justify-center flex-shrink-0 transition-all"><Check className="w-3 h-3 text-white" strokeWidth={2.4} /></button>
                          <span className="text-sm flex-1 line-through text-muted-foreground">{item.text}</span>
                          <button onClick={() => removeItem(idx)} className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-destructive transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
                <NoteAttachments attachments={selected.attachments} onRemove={removeAttachment} onPreview={setViewerAttachment} />
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11px] text-[#A7773F] px-1">Saved automatically</span>
                  <button onClick={() => setShowAttachmentSheet(true)} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg text-sm transition-colors"><Paperclip className="w-4 h-4" /> Attach</button>
                </div>
              </div>
  );

  const backToList = async () => {
    if (selected) {
      const isBlank = !selected.title?.trim() && !selected.content?.trim() &&
        (!selected.list_items || selected.list_items.length === 0) &&
        (!selected.attachments || selected.attachments.length === 0);
      if (isBlank) {
        setNotes(prev => prev.filter(n => n.id !== selected.id));
        ent.Note.delete(selected.id).catch(() => {});
      } else if (!adding) {
        persistNote(selected, false);
      }
    }
    setEditingId(null);
    setSelected(null);
    setAdding(false);
    setTitle(""); setContent(""); setNewType("text");
  };

  const collectionNotes = openCollection
    ? notes.filter((n) => n.folder_id === openCollection.id)
    : [];

  const noteFolder = adding
    ? openCollection
    : selected?.folder_id
      ? folders.find((f) => f.id === selected.folder_id)
      : null;

  if (showingDetail) {
    return (
      <div className="max-w-[900px] mx-auto w-full pb-12">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-6 md:px-10 lg:px-14 pb-4 border-b border-border flex items-center gap-2.5" style={{ paddingTop: "1.25rem" }}>
          <button onClick={backToList} className="w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex-shrink-0" title="Back">
            <ArrowLeft className="w-4 h-4" />
          </button>
          {noteFolder ? (
            <>
              <span
                className="w-5 h-5 rounded-[6px] flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${accentHex(noteFolder.accent_color)}1F` }}
              >
                <FolderIcon className="w-3 h-3" style={{ color: accentHex(noteFolder.accent_color) }} strokeWidth={1.8} />
              </span>
              <span className="font-body text-[13px] text-muted-foreground truncate flex-1 min-w-0">{noteFolder.name}</span>
            </>
          ) : (
            <span className="font-body text-[13px] text-muted-foreground flex-1 min-w-0">Notes</span>
          )}
          {selected && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {(isEditing
                ? <button onClick={() => { persistNote(selected, false); setEditingId(null); }} className="mr-1 bg-[#A7773F] text-[#F7F3EC] rounded-full text-xs px-3.5 py-1.5">Done</button>
                : <button onClick={() => setEditingId(selected.id)} className="mr-1 border border-[#A7773F] text-[#A7773F] rounded-full text-xs px-3.5 py-1.5">Edit</button>)}
              <button onClick={() => shareNote(selected)} disabled={sharing} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition-colors disabled:opacity-50" title="Share">
                <Share2 className="w-4 h-4" />
              </button>
              <button onClick={() => downloadNote(selected)} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition-colors" title="Download">
                <Download className="w-4 h-4" />
              </button>
              <button onClick={() => remove(selected.id)} className="w-8 h-8 flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-secondary rounded-full transition-colors" title="Delete">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="px-6 md:px-10 lg:px-14 pt-5">

        {selected && !isEditing && (
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="font-heading text-[24px] leading-tight text-foreground">{selected.title || "Untitled"}</h1>
              {selected.updated_date && <p className="text-[11px] text-muted-foreground mt-1">Edited {new Date(selected.updated_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>}
            </div>
            {isList ? (
              <>
                {selected.folder_id && folders.find((f) => f.id === selected.folder_id) && (
                  <span className="self-start -mt-2 text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-[#E4E9D5] text-[#566033]">{folders.find((f) => f.id === selected.folder_id).name}</span>
                )}
                {renderChecklist()}
              </>
            ) : (
              <>
                <div className="ql-snow cursor-text" onClick={() => setEditingId(selected.id)}>
                  {stripHtml(selected.content)
                    ? <div className="ql-editor !p-0 !min-h-[120px] text-[15px] leading-relaxed text-foreground" dangerouslySetInnerHTML={{ __html: selected.content }} />
                    : <p className="text-sm text-muted-foreground italic min-h-[120px]">Nothing here yet. Tap to start writing.</p>}
                </div>
                <NoteAttachments attachments={selected.attachments} onPreview={setViewerAttachment} />
                <p className="text-[11px] text-muted-foreground text-center pt-6">Tap Edit or the text to make changes</p>
              </>
            )}
          </div>
        )}
        {selected && isEditing && (
          <div className="flex flex-col gap-4">
            {isBlank && (
              <div className="flex gap-2">
                <button onClick={() => switchNoteType("text")} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm border transition-all ${!isList ? "bg-[#A7773F] text-[#F7F3EC] border-[#A7773F]" : "bg-card text-muted-foreground border-border hover:border-muted-foreground/30"}`}>
                  <FileText className="w-4 h-4" /> Note
                </button>
                <button onClick={() => switchNoteType("list")} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm border transition-all ${isList ? "bg-[#A7773F] text-[#F7F3EC] border-[#A7773F]" : "bg-card text-muted-foreground border-border hover:border-muted-foreground/30"}`}>
                  <List className="w-4 h-4" /> List
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              {isList ? <List className="w-4 h-4 text-[#B49399] flex-shrink-0" /> : <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
              <input value={selected.title} onChange={(e) => setSelected({ ...selected, title: e.target.value })} placeholder={isList ? "List name (e.g. Grocery)" : "Title"} className="flex-1 bg-transparent border-0 border-b border-border rounded-none text-foreground text-[19px] font-heading px-0 py-1 outline-none focus:border-ring transition-colors" autoFocus />
            </div>

            <div className="flex items-center gap-2">
              <FolderIcon className="w-3.5 h-3.5 text-muted-foreground" />
              <select value={selected.folder_id || ""} onChange={(e) => changeFolder(e.target.value)} className="bg-card border border-border rounded-lg px-3 py-1.5 text-xs text-muted-foreground outline-none focus:border-ring transition-colors">
                <option value="">No collection</option>
                {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>

            {isList ? (
              renderChecklist()
            ) : (
              <>
                <div className="bg-card rounded-xl overflow-hidden border border-border quill-notes">
                  <ReactQuill theme="snow" value={selected.content || ""} onChange={(val) => setSelected({ ...selected, content: val })} modules={{ toolbar: [[{ size: ["small", false, "large", "huge"] }], ["bold", "italic", "underline", "strike"], [{ list: "ordered" }, { list: "bullet" }], ["link", "blockquote", "clean"]] }} style={{ minHeight: "320px" }} />
                </div>
                <NoteAttachments attachments={selected.attachments} onRemove={removeAttachment} onPreview={setViewerAttachment} />
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#A7773F] px-1">Saved automatically</span>
                  <button onClick={() => setShowAttachmentSheet(true)} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg text-sm transition-colors"><Paperclip className="w-4 h-4" /> Attach</button>
                </div>
              </>
            )}
          </div>
        )}
        </div>

        <AttachmentSheet open={showAttachmentSheet} onClose={() => setShowAttachmentSheet(false)} onUpload={handleUpload} />
        <AttachmentViewer attachment={viewerAttachment} onClose={() => setViewerAttachment(null)} />
      </div>
    );
  }

  if (openCollection) {
    return (
      <div className="max-w-[900px] mx-auto w-full pb-8">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-6 md:px-10 lg:px-14 pb-4 border-b border-border flex items-center gap-2.5" style={{ paddingTop: "1.25rem" }}>
          <button onClick={() => setOpenCollection(null)} className="w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex-shrink-0" title="Back to collections">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span
            className="w-6 h-6 rounded-[7px] flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${accentHex(openCollection.accent_color)}1F` }}
          >
            <FolderIcon className="w-3.5 h-3.5" style={{ color: accentHex(openCollection.accent_color) }} strokeWidth={1.8} />
          </span>
          <h1 className="font-heading text-[17px] text-foreground flex-1 min-w-0 truncate">{openCollection.name}</h1>
          <button onClick={() => setLongPressFolder(openCollection)} className="w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex-shrink-0" title="Edit collection">
            <Pencil className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 md:px-10 lg:px-14 pt-5 space-y-5">
        <button onClick={() => startNewNote(openCollection.id)} className="w-full h-[60px] flex items-center gap-3 bg-card border border-border rounded-2xl pl-4 pr-5 text-left transition-all hover:shadow-[0_8px_24px_-14px_rgba(0,0,0,0.14)] hover:-translate-y-0.5 active:translate-y-0">
          <span className="w-8 h-8 rounded-full bg-[#B49399] flex items-center justify-center flex-shrink-0">
            <Plus className="w-3.5 h-3.5 text-white" strokeWidth={1.8} />
          </span>
          <span className="font-body text-[14px] text-muted-foreground">Add a note to {openCollection.name}…</span>
        </button>

        {collectionNotes.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl py-10 text-center">
            <p className="font-body text-[15px] text-muted-foreground">No notes in this collection yet.</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {collectionNotes.map((n, i) => (
              <div key={n.id} className={`flex items-center transition-colors ${i !== 0 ? "border-t border-border/60" : ""}`}>
                <button onClick={() => setSelected(n)} className="flex-1 min-w-0 h-[58px] flex items-center px-4 text-left hover:bg-secondary/60 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-[15px] font-medium text-foreground truncate leading-snug">{n.title || "Untitled"}</p>
                    <p className="font-body text-[12px] text-muted-foreground mt-0.5 truncate">{n.note_type === "list" ? `${(n.list_items || []).length} items` : (stripHtml(n.content) || "Empty note")}</p>
                  </div>
                </button>
                <button onClick={() => setNoteMenu(n)} className="w-8 h-8 mr-3 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"><MoreHorizontal className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}
        </div>

        <CollectionSheet
          folder={longPressFolder}
          onClose={() => setLongPressFolder(null)}
          onUpdate={updateCollection}
          onDelete={deleteCollection}
        />
        <NoteMenuSheet
          note={noteMenu}
          folders={folders}
          onClose={() => setNoteMenu(null)}
          onDelete={remove}
          onMove={moveNoteToFolder}
          onPin={togglePin}
          onEdit={(n) => { setNoteMenu(null); setSelected(n); setEditingId(n.id); }}
        />
      </div>
    );
  }

  return (
    <>
      <NotesLanding
        notes={notes}
        folders={folders}
        savedPlaces={savedPlaces}
        loading={loading}
        onQuickCapture={(type) => startNewNote(null, type)}
        onOpenCollection={(f) => setOpenCollection(f)}
        onOpenNote={(n) => setSelected(n)}
        onNewCollection={() => setShowNewCollection(true)}
        onLongPressCollection={(f) => setLongPressFolder(f)}
        onNoteMenu={(n) => setNoteMenu(n)}
        onAddPlace={openAddPlace}
        onPlaceMenu={(p) => setPlaceMenu(p)}
      />
      <NewCollectionSheet
        open={showNewCollection}
        onClose={() => setShowNewCollection(false)}
        onCreate={createCollection}
      />
      <CollectionSheet
        folder={longPressFolder}
        onClose={() => setLongPressFolder(null)}
        onUpdate={updateCollection}
        onDelete={deleteCollection}
      />
      <NoteMenuSheet
        note={noteMenu}
        folders={folders}
        onClose={() => setNoteMenu(null)}
        onDelete={remove}
        onMove={moveNoteToFolder}
        onPin={togglePin}
        onEdit={(n) => { setNoteMenu(null); setSelected(n); setEditingId(n.id); }}
      />
      <PlaceFormSheet
        form={placeForm}
        onChange={setPlaceForm}
        onClose={() => setPlaceForm(null)}
        onSave={savePlace}
      />
      <PlaceMenuSheet
        place={placeMenu}
        onClose={() => setPlaceMenu(null)}
        onEdit={openEditPlace}
        onDelete={deletePlace}
      />
    </>
  );
}

function NoteMenuSheet({ note, folders, onClose, onDelete, onMove, onEdit, onPin }) {
  if (!note) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="w-8" />
          <p className="font-heading text-base text-foreground truncate max-w-[200px]">{note.title}</p>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">×</button>
        </div>
        <div className="h-1 w-10 rounded-full bg-border mx-auto mb-1" />
        <div className="px-2 pb-6 pt-2">
          <button onClick={() => onEdit(note)} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-foreground hover:bg-secondary transition-colors">
            <Pencil className="w-4 h-4" /> Edit note
          </button>
          <button onClick={() => onPin(note)} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-foreground hover:bg-secondary transition-colors">
            <Pin className="w-4 h-4" /> {note.pinned ? "Unpin note" : "Pin note"}
          </button>
          <div className="border-t border-border my-2" />
          <div className="px-3 pb-2">
            <p className="font-body text-[11px] uppercase tracking-wider text-muted-foreground">Move to</p>
          </div>
          <button onClick={() => onMove(note.id, null)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-muted-foreground hover:bg-secondary transition-colors">
            <FolderIcon className="w-4 h-4" /> No collection
          </button>
          {folders.filter((f) => !f.archived).map((f) => (
            <button key={f.id} onClick={() => onMove(note.id, f.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-secondary transition-colors ${note.folder_id === f.id ? "text-foreground font-medium" : "text-muted-foreground"}`}>
              <FolderIcon className="w-4 h-4" /> {f.name}
            </button>
          ))}
          <div className="border-t border-border my-2" />
          <button onClick={() => onDelete(note.id)} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-destructive hover:bg-secondary transition-colors">
            <Trash2 className="w-4 h-4" /> Delete note
          </button>
        </div>
      </div>
    </div>
  );
}

// Pick the closest of our own categories from Google's place types.
function guessPlaceType(types = [], primary = "") {
  const t = new Set(types);
  const has = (...k) => k.some((x) => t.has(x));
  if (has("cafe", "coffee_shop", "bakery", "tea_house")) return "Café";
  if (has("bar", "night_club", "wine_bar", "pub")) return "Bar";
  if (has("restaurant", "meal_takeaway", "meal_delivery", "food") || /restaurant/i.test(primary)) return "Restaurant";
  if (has("lodging", "hotel", "resort_hotel", "bed_and_breakfast")) return "Hotel";
  if (has("park", "national_park", "state_park", "playground")) return "Park";
  if (has("tourist_attraction", "museum", "art_gallery", "amusement_park", "zoo", "aquarium", "landmark")) return "Attraction";
  if (has("store", "shopping_mall", "clothing_store", "book_store", "home_goods_store", "market", "supermarket")) return "Shop";
  return "";
}

// Add/edit a saved place. Type a name to find the real place: its address,
// category and a photo fill in automatically. A place can still be typed by hand.
function PlaceFormSheet({ form, onChange, onClose, onSave }) {
  const [nameHits, setNameHits] = useState([]);
  const [nameSearching, setNameSearching] = useState(false);
  const [typedName, setTypedName] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [filling, setFilling] = useState(false);
  const nameTimer = useRef(null);
  const debounceTimer = useRef(null);
  const formRef = useRef(form);
  formRef.current = form;
  const patch = (p) => onChange({ ...formRef.current, ...p });

  useEffect(() => {
    if (!form || !typedName || form.name.trim().length < 2) { setNameHits([]); return; }
    clearTimeout(nameTimer.current);
    nameTimer.current = setTimeout(async () => {
      setNameSearching(true);
      try {
        const { predictions } = await base44.integrations.Core.SearchPlacesAutocomplete({ input: form.name });
        setNameHits(predictions || []);
      } catch { setNameHits([]); } finally { setNameSearching(false); }
    }, 300);
    return () => clearTimeout(nameTimer.current);
  }, [form?.name, typedName]);

  useEffect(() => {
    if (!form) { setSuggestions([]); return; }
    if (!form.address || form.address.trim().length < 2 || form.place_id) { setSuggestions([]); return; }
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { predictions } = await base44.integrations.Core.SearchPlacesAutocomplete({ input: form.address });
        setSuggestions(predictions || []);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(debounceTimer.current);
  }, [form?.address]);

  if (!form) return null;

  const pickSuggestion = (description) => {
    patch({ address: description, place_id: "" });
    setSuggestions([]);
  };

  // A real place was chosen: fill what we know now, then fetch the rest.
  const choosePlace = async (hit) => {
    setNameHits([]);
    setTypedName(false);
    patch({
      name: hit.name || hit.description.split(",")[0],
      address: hit.secondary || hit.description,
      place_id: hit.placeId,
      type: guessPlaceType(hit.types) || formRef.current.type,
    });
    setFilling(true);
    try {
      const d = await base44.integrations.Core.LookupPlace({ place_id: hit.placeId });
      patch({
        name: d.name || formRef.current.name,
        address: d.address || formRef.current.address,
        maps_url: d.mapsUrl || "",
        type: guessPlaceType(d.types, d.primaryType) || formRef.current.type,
      });
      if (d.url) {
        const blob = await (await fetch(d.url)).blob();
        const file = new File([blob], "place.jpg", { type: blob.type || "image/jpeg" });
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        patch({ photo_url: file_url, photo_credit: d.attribution || "Google" });
      }
    } catch (e) {
      console.error("Place lookup failed:", e); // the place itself is still usable
    } finally {
      setFilling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <p className="font-heading text-lg text-foreground">{form.id ? "Edit place" : "Save a place"}</p>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 pb-6 pt-2 space-y-3">
          <div className="relative">
            <label className="font-body text-[12px] text-muted-foreground mb-1 block">Name</label>
            <input
              autoFocus
              value={form.name}
              onChange={(e) => { setTypedName(true); patch({ name: e.target.value, place_id: "" }); }}
              placeholder="Search a place, e.g. Nari"
              autoComplete="off"
              className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-[14px] text-foreground outline-none focus:border-ring transition-colors"
            />
            {(nameHits.length > 0 || nameSearching) && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg z-10 py-1 max-h-60 overflow-y-auto">
                {nameSearching && nameHits.length === 0 ? (
                  <p className="px-3 py-2 font-body text-[12px] text-muted-foreground">Searching…</p>
                ) : (
                  nameHits.map((h) => (
                    <button key={h.placeId} onClick={() => choosePlace(h)} className="w-full text-left px-3 py-2 hover:bg-secondary transition-colors">
                      <span className="block font-body text-[13.5px] text-foreground truncate">{h.name || h.description}</span>
                      {h.secondary && <span className="block font-body text-[11.5px] text-muted-foreground truncate">{h.secondary}</span>}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {(form.photo_url || filling) && (
            <div className="relative h-32 rounded-2xl overflow-hidden bg-secondary">
              {form.photo_url && <img src={form.photo_url} alt="" className="w-full h-full object-cover" />}
              {filling && <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white text-xs">Finding details and a photo…</div>}
              {form.photo_url && !filling && (
                <>
                  <span className="absolute bottom-1.5 left-2 text-[10px] text-white/90 drop-shadow">Photo: {form.photo_credit || "Google"}</span>
                  <button onClick={() => patch({ photo_url: "", photo_credit: "" })} aria-label="Remove photo" className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/45 text-white flex items-center justify-center">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          )}

          <div>
            <label className="font-body text-[12px] text-muted-foreground mb-1.5 block">Type</label>
            <div className="grid grid-cols-3 gap-1.5">
              {PLACE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => patch({ type: form.type === t ? "" : t })}
                  className={`py-2 rounded-lg text-[12px] font-medium transition-colors ${
                    form.type === t ? "bg-[#A7773F] text-[#F7F3EC]" : "bg-secondary text-foreground hover:bg-secondary/70"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="relative">
            <label className="font-body text-[12px] text-muted-foreground mb-1 block">Address</label>
            <input
              value={form.address}
              onChange={(e) => patch({ address: e.target.value, place_id: "" })}
              placeholder="Search worldwide…"
              autoComplete="off"
              className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-[14px] text-foreground outline-none focus:border-ring transition-colors"
            />
            {(suggestions.length > 0 || searching) && (
              <div className="absolute left-0 right-0 bottom-full mb-1 bg-card border border-border rounded-xl shadow-lg z-10 py-1 max-h-52 overflow-y-auto">
                {searching && suggestions.length === 0 ? (
                  <p className="px-3 py-2 font-body text-[12px] text-muted-foreground">Searching…</p>
                ) : (
                  suggestions.map((s) => (
                    <button
                      key={s.placeId}
                      onClick={() => pickSuggestion(s.description)}
                      className="w-full text-left px-3 py-2 font-body text-[12.5px] text-foreground hover:bg-secondary transition-colors truncate"
                    >
                      {s.description}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <div>
            <label className="font-body text-[12px] text-muted-foreground mb-1 block">Notes</label>
            <textarea
              value={form.notes || ""}
              onChange={(e) => patch({ notes: e.target.value })}
              rows={3}
              placeholder="What to order, who recommended it, when to go…"
              className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-[14px] text-foreground outline-none focus:border-ring transition-colors resize-none"
            />
          </div>
          <button type="button" onClick={() => patch({ visited: !form.visited, visited_on: !form.visited && !form.visited_on ? new Date().toISOString().slice(0, 10) : form.visited_on })}
            className="w-full flex items-center justify-between bg-secondary border border-border rounded-xl px-4 py-2.5">
            <span className="text-[14px] text-foreground">Been there</span>
            <span className="relative w-10 h-6 rounded-full transition-colors" style={{ backgroundColor: form.visited ? "#A7773F" : "#E7D9C6" }}>
              <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all" style={{ left: form.visited ? "18px" : "2px" }} />
            </span>
          </button>
          {form.visited && (
            <div className="flex items-end justify-between gap-3">
              <div>
                <label className="font-body text-[12px] text-muted-foreground mb-1 block">Your rating</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" aria-label={`${n} star${n === 1 ? "" : "s"}`} onClick={() => patch({ rating: form.rating === n ? 0 : n })}
                      className="text-[26px] leading-none" style={{ color: n <= (form.rating || 0) ? "#A7773F" : "#D9CBB3" }}>★</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="font-body text-[12px] text-muted-foreground mb-1 block">Visited</label>
                <input type="date" value={form.visited_on || ""} onChange={(e) => patch({ visited_on: e.target.value })}
                  className="bg-secondary border border-border rounded-xl px-3 py-2 text-[13px] text-foreground outline-none" />
              </div>
            </div>
          )}
          <button
            onClick={onSave}
            disabled={!form.name.trim() || filling}
            className="w-full py-2.5 rounded-full bg-[#A7773F] text-[#F7F3EC] text-[14px] font-medium flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            <Check className="w-4 h-4" /> {filling ? "One moment…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PlaceMenuSheet({ place, onClose, onEdit, onDelete }) {
  if (!place) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="w-8" />
          <p className="font-heading text-base text-foreground truncate max-w-[200px]">{place.name}</p>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="h-1 w-10 rounded-full bg-border mx-auto mb-1" />
        <div className="px-2 pb-6 pt-2">
          {place.address && (
            <a
              href={mapsUrl(place.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-foreground hover:bg-secondary transition-colors"
            >
              <Navigation className="w-4 h-4" /> Open in maps
            </a>
          )}
          <button onClick={() => onEdit(place)} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-foreground hover:bg-secondary transition-colors">
            <Pencil className="w-4 h-4" /> Edit
          </button>
          <div className="border-t border-border my-2" />
          <button onClick={() => onDelete(place.id)} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-destructive hover:bg-secondary transition-colors">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}
