import { useState, useEffect, useRef } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

// Register custom font sizes for the editor size dropdown
const Size = ReactQuill.Quill.import("attributors/style/size");
Size.whitelist = ["small", "12px", "14px", "16px", "18px", "large", "huge"];
ReactQuill.Quill.register(Size, true);
import { base44 } from "@/api/base44Client";
import {
  Plus, Trash2, List, FileText, Check, ArrowLeft, Paperclip, Pencil,
  Folder as FolderIcon, Share2, Download, MoreHorizontal,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import AttachmentSheet from "@/components/notes/AttachmentSheet";
import NoteAttachments from "@/components/notes/NoteAttachments";
import AttachmentViewer from "@/components/notes/AttachmentViewer";
import NotesLanding from "@/components/notes/NotesLanding";
import CollectionSheet from "@/components/notes/CollectionSheet";
import NewCollectionSheet from "@/components/notes/NewCollectionSheet";
import { accentHex } from "@/components/notes/collectionAccents";

export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [folders, setFolders] = useState([]);
  const [activeFolder, setActiveFolder] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState("text");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selected, setSelected] = useState(null);
  const [newItemText, setNewItemText] = useState("");
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [openCollection, setOpenCollection] = useState(null);
  const [longPressFolder, setLongPressFolder] = useState(null);
  const [noteMenu, setNoteMenu] = useState(null);
  const [moveNote, setMoveNote] = useState(null);
  const [viewerAttachment, setViewerAttachment] = useState(null);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const newItemRef = useRef(null);
  const autoSaveTimer = useRef(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const [n, f] = await Promise.all([
      base44.entities.Note.list("-updated_date"),
      base44.entities.Folder.list("-created_date"),
    ]);
    setNotes(n);
    setFolders(f);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createCollection = async (data) => {
    await base44.entities.Folder.create({
      name: data.name,
      icon_type: data.icon_type || "folder",
      emoji: data.emoji,
      accent_color: data.accent_color || "sage",
    });
    setShowNewCollection(false);
    await load();
  };

  const updateCollection = async (id, patch) => {
    await base44.entities.Folder.update(id, patch);
    await load();
    if (openCollection?.id === id) setOpenCollection((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const deleteCollection = async (id) => {
    const folderNotes = notes.filter((n) => n.folder_id === id);
    if (folderNotes.length > 0) {
      await base44.entities.Note.updateMany({ folder_id: id }, { $unset: { folder_id: "" } });
    }
    await base44.entities.Folder.delete(id);
    if (openCollection?.id === id) setOpenCollection(null);
    await load();
  };

  const add = async () => {
    if (!title.trim()) return;
    const data = { title: title.trim(), note_type: newType };
    if (openCollection) data.folder_id = openCollection.id;
    if (newType === "text") data.content = content;
    else data.list_items = [];
    const n = await base44.entities.Note.create(data);
    setTitle(""); setContent(""); setAdding(false); setNewType("text");
    setNotes(prev => [n, ...prev]);
    setSelected(n);
  };

  // Silent persist used by both the debounced auto-save and manual Save button.
  // Updates local state first (list view + editor both reflect it instantly),
  // then writes to the backend in the background — no full reload needed.
  const persistNote = async (note, showToast = false) => {
    const patch = { title: note.title, content: note.content, list_items: note.list_items, attachments: note.attachments || [] };
    setNotes(prev => prev.map(n => n.id === note.id ? { ...n, ...patch } : n));
    await base44.entities.Note.update(note.id, patch);
    if (showToast) toast({ title: "Note saved" });
  };

  const save = async () => {
    if (!selected) return;
    await persistNote(selected, true);
    backToList();
  };

  // Auto-save: fires ~900ms after the person stops typing in title/content,
  // so nothing is lost if they navigate away without hitting Save.
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
    await base44.entities.Note.delete(id);
  };

  const addListItem = async () => {
    if (!newItemText.trim() || !selected) return;
    const items = [...(selected.list_items || []), { text: newItemText.trim(), checked: false }];
    const updated = { ...selected, list_items: items };
    setSelected(updated);
    setNotes(prev => prev.map(n => n.id === selected.id ? { ...n, list_items: items } : n));
    setNewItemText("");
    await base44.entities.Note.update(selected.id, { list_items: items });
    newItemRef.current?.focus();
  };

  const toggleItem = async (idx) => {
    const items = (selected.list_items || []).map((it, i) =>
      i === idx ? { ...it, checked: !it.checked } : it
    );
    setSelected({ ...selected, list_items: items });
    setNotes(prev => prev.map(n => n.id === selected.id ? { ...n, list_items: items } : n));
    await base44.entities.Note.update(selected.id, { list_items: items });
  };

  const removeItem = async (idx) => {
    const items = (selected.list_items || []).filter((_, i) => i !== idx);
    setSelected({ ...selected, list_items: items });
    setNotes(prev => prev.map(n => n.id === selected.id ? { ...n, list_items: items } : n));
    await base44.entities.Note.update(selected.id, { list_items: items });
  };

  const handleUpload = async (newAttachments) => {
    if (!selected) return;
    const updated = [...(selected.attachments || []), ...newAttachments];
    setSelected({ ...selected, attachments: updated });
    setNotes(prev => prev.map(n => n.id === selected.id ? { ...n, attachments: updated } : n));
    await base44.entities.Note.update(selected.id, { attachments: updated });
    toast({ title: "Attachment saved", description: `${newAttachments.length} file${newAttachments.length > 1 ? "s" : ""} uploaded.` });
  };

  const removeAttachment = async (idx) => {
    const updated = (selected.attachments || []).filter((_, i) => i !== idx);
    setSelected({ ...selected, attachments: updated });
    setNotes(prev => prev.map(n => n.id === selected.id ? { ...n, attachments: updated } : n));
    await base44.entities.Note.update(selected.id, { attachments: updated });
  };

  const changeFolder = async (folderId) => {
    if (!selected) return;
    setSelected({ ...selected, folder_id: folderId || null });
    setNotes(prev => prev.map(n => n.id === selected.id ? { ...n, folder_id: folderId || null } : n));
    await base44.entities.Note.update(selected.id, { folder_id: folderId || null });
    setMoveNote(null);
    toast({ title: folderId ? "Moved to collection" : "Removed from collection" });
  };

  const moveNoteToFolder = async (noteId, folderId) => {
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, folder_id: folderId || null } : n));
    await base44.entities.Note.update(noteId, { folder_id: folderId || null });
    setNoteMenu(null);
    toast({ title: folderId ? "Moved to collection" : "Removed from collection" });
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

  const isList = selected?.note_type === "list";
  const checkedCount = (selected?.list_items || []).filter((i) => i.checked).length;
  const totalCount = (selected?.list_items || []).length;
  const showingDetail = selected || adding;

  const backToList = async () => {
    // If the person opened a note and left without typing anything at all,
    // silently discard the empty draft instead of leaving clutter behind —
    // same behavior as Apple Notes.
    if (selected) {
      const isBlank = !selected.title?.trim() && !selected.content?.trim() &&
        (!selected.list_items || selected.list_items.length === 0) &&
        (!selected.attachments || selected.attachments.length === 0);
      if (isBlank) {
        setNotes(prev => prev.filter(n => n.id !== selected.id));
        base44.entities.Note.delete(selected.id).catch(() => {});
      }
    }
    setSelected(null);
    setAdding(false);
    setTitle(""); setContent(""); setNewType("text");
  };

  const collectionNotes = openCollection
    ? notes.filter((n) => n.folder_id === openCollection.id)
    : [];

  /* ---------------- Editor ---------------- */
  const noteFolder = adding
    ? openCollection
    : selected?.folder_id
      ? folders.find((f) => f.id === selected.folder_id)
      : null;

  if (showingDetail) {
    return (
      <div className="max-w-[900px] mx-auto w-full pb-12">
        {/* top bar */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-6 md:px-10 lg:px-14 pb-4 border-b border-border flex items-center gap-2.5" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}>
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

        {adding ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button onClick={() => setNewType("text")} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm border transition-all ${newType === "text" ? "bg-foreground text-background border-foreground" : "bg-card text-muted-foreground border-border hover:border-muted-foreground/30"}`}>
                <FileText className="w-4 h-4" /> Note
              </button>
              <button onClick={() => setNewType("list")} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm border transition-all ${newType === "list" ? "bg-foreground text-background border-foreground" : "bg-card text-muted-foreground border-border hover:border-muted-foreground/30"}`}>
                <List className="w-4 h-4" /> List
              </button>
            </div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={newType === "list" ? "List name (e.g. Grocery)" : "Title"} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-foreground text-[17px] font-normal outline-none focus:border-ring transition-colors" autoFocus onKeyDown={(e) => e.key === "Enter" && add()} />
            {newType === "text" && (
              <ReactQuill
                theme="snow"
                value={content}
                onChange={(val) => setContent(val)}
                modules={{ toolbar: [[{ size: ["small", false, "large", "huge"] }], ["bold", "italic", "underline", "strike"], [{ list: "ordered" }, { list: "bullet" }], ["link", "blockquote", "clean"]] }}
                style={{ minHeight: "240px" }}
              />
            )}
            {newType === "list" && <p className="text-[13px] text-muted-foreground leading-relaxed">You can add items after creating the list.</p>}
            <div className="flex gap-2">
              <button onClick={add} className="bg-foreground text-background px-5 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-colors">Create</button>
              <button onClick={backToList} className="px-4 py-2.5 text-muted-foreground text-sm hover:text-foreground transition-colors">Cancel</button>
            </div>
          </div>
        ) : selected ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              {isList ? <List className="w-4 h-4 text-[#B49399] flex-shrink-0" /> : <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
              <input value={selected.title} onChange={(e) => setSelected({ ...selected, title: e.target.value })} className="flex-1 bg-transparent border-0 border-b border-border rounded-none text-foreground text-[17px] font-semibold px-0 py-1 outline-none focus:border-ring transition-colors" />
            </div>

            <div className="flex items-center gap-2">
              <FolderIcon className="w-3.5 h-3.5 text-muted-foreground" />
              <select value={selected.folder_id || ""} onChange={(e) => changeFolder(e.target.value)} className="bg-card border border-border rounded-lg px-3 py-1.5 text-xs text-muted-foreground outline-none focus:border-ring transition-colors">
                <option value="">No collection</option>
                {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>

            {isList ? (
              <div className="flex flex-col gap-3">
                {totalCount > 0 && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{checkedCount}/{totalCount} done</p>
                    {checkedCount > 0 && (
                      <button onClick={async () => { const items = (selected.list_items || []).filter((i) => !i.checked); setSelected({ ...selected, list_items: items }); await base44.entities.Note.update(selected.id, { list_items: items }); }} className="text-xs text-muted-foreground hover:text-destructive transition-colors">Clear completed</button>
                    )}
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
                      {checked.length > 0 && unchecked.length > 0 && <li className="border-t border-border my-1" />}
                      {checked.map(({ item, idx }) => (
                        <li key={idx} className="flex items-center gap-3 group opacity-50">
                          <button onClick={() => toggleItem(idx)} className="w-5 h-5 rounded-full border-2 bg-muted-foreground/40 border-stone-400 flex items-center justify-center flex-shrink-0 transition-all"><Check className="w-3 h text-background" /></button>
                          <span className="text-sm flex-1 line-through text-muted-foreground">{item.text}</span>
                          <button onClick={() => removeItem(idx)} className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-destructive transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
                <div className="flex items-center gap-2 mt-2">
                  <input ref={newItemRef} value={newItemText} onChange={(e) => setNewItemText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addListItem()} placeholder="Add item…" className="flex-1 bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-ring transition-colors" />
                  <button onClick={addListItem} className="bg-foreground text-background p-2 rounded-xl hover:opacity-90 transition-colors"><Plus className="w-4 h-4" /></button>
                </div>
                <NoteAttachments attachments={selected.attachments} onRemove={removeAttachment} onPreview={setViewerAttachment} />
                <div className="flex items-center gap-2 mt-2">
                  <button onClick={save} className="bg-foreground text-background px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-colors">Save</button>
                  <button onClick={() => setShowAttachmentSheet(true)} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg text-sm transition-colors"><Paperclip className="w-4 h-4" /> Attach</button>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-card rounded-xl overflow-hidden border border-border quill-notes">
                  <ReactQuill theme="snow" value={selected.content || ""} onChange={(val) => setSelected({ ...selected, content: val })} modules={{ toolbar: [[{ size: ["small", false, "large", "huge"] }], ["bold", "italic", "underline", "strike"], [{ list: "ordered" }, { list: "bullet" }], ["link", "blockquote", "clean"]] }} style={{ minHeight: "320px" }} />
                </div>
                <NoteAttachments attachments={selected.attachments} onRemove={removeAttachment} onPreview={setViewerAttachment} />
                <div className="flex items-center gap-2">
                  <button onClick={save} className="bg-foreground text-background px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-colors">Save</button>
                  <button onClick={() => setShowAttachmentSheet(true)} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg text-sm transition-colors"><Paperclip className="w-4 h-4" /> Attach</button>
                </div>
              </>
            )}
          </div>
        ) : null}
        </div>

        <AttachmentSheet open={showAttachmentSheet} onClose={() => setShowAttachmentSheet(false)} onUpload={handleUpload} />
        <AttachmentViewer attachment={viewerAttachment} onClose={() => setViewerAttachment(null)} />
      </div>
    );
  }

  /* ---------------- Collection View ---------------- */
  if (openCollection) {
    return (
      <div className="max-w-[900px] mx-auto w-full pb-8">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-6 md:px-10 lg:px-14 pb-4 border-b border-border flex items-center gap-2.5" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}>
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
        <button onClick={() => { setAdding(true); }} className="w-full h-[60px] flex items-center gap-3 bg-card border border-border rounded-2xl pl-4 pr-5 text-left transition-all hover:shadow-[0_8px_24px_-14px_rgba(0,0,0,0.14)] hover:-translate-y-0.5 active:translate-y-0">
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
                    <p className="font-body text-[12px] text-muted-foreground mt-0.5 truncate">{n.note_type === "list" ? `${(n.list_items || []).length} items` : "Text note"}</p>
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
        />
      </div>
    );
  }

  /* ---------------- Landing ---------------- */
  return (
    <>
      <NotesLanding
        notes={notes}
        folders={folders}
        loading={loading}
        onQuickCapture={() => { setAdding(true); setSelected(null); }}
        onOpenCollection={(f) => setOpenCollection(f)}
        onOpenNote={(n) => setSelected(n)}
        onNewCollection={() => setShowNewCollection(true)}
        onLongPressCollection={(f) => setLongPressFolder(f)}
        onNoteMenu={(n) => setNoteMenu(n)}
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
      />
    </>
  );
}

/* ---------------- Note row menu ---------------- */
function NoteMenuSheet({ note, folders, onClose, onDelete, onMove }) {
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