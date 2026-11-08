import { useState, useEffect, useRef } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

// Project notes: opens in a read-only view (like the Notes tab); tap Edit or
// the text to change it, Done to finish. Edits autosave while typing, and are
// always flushed on Done / leaving the tab.

const stripHtml = (h) => (h || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

// Notes on a shared project can be written by collaborators, so never render
// their HTML as-is: drop scripts/embeds, event handlers and javascript: links.
function sanitize(html) {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,iframe,object,embed,link,meta,form,base").forEach((n) => n.remove());
  doc.body.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((a) => {
      const name = a.name.toLowerCase();
      const val = a.value.trim().toLowerCase();
      if (name.startsWith("on") || ((name === "href" || name === "src") && val.startsWith("javascript:"))) {
        el.removeAttribute(a.name);
      }
    });
    if (el.tagName === "A") { el.setAttribute("target", "_blank"); el.setAttribute("rel", "noopener noreferrer"); }
  });
  return doc.body.innerHTML;
}

export default function ProjectNotes({ notes, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(notes || "");
  const timer = useRef(null);
  const lastSaved = useRef(notes || "");
  const valueRef = useRef(notes || "");
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // Pull in changes from elsewhere (another device / collaborator) only when
  // not typing — otherwise our own autosave echo would overwrite newer text.
  useEffect(() => {
    if (editing) return;
    setValue(notes || "");
    valueRef.current = notes || "";
    lastSaved.current = notes || "";
  }, [notes, editing]);

  const flush = () => {
    clearTimeout(timer.current);
    timer.current = null;
    if (valueRef.current !== lastSaved.current) {
      lastSaved.current = valueRef.current;
      onSaveRef.current(valueRef.current);
    }
  };

  // Leaving the tab mid-typing must not lose the last edit.
  useEffect(() => () => flush(), []);

  const handleChange = (html) => {
    // Quill reports an empty doc as "<p><br></p>"; treat as empty.
    const next = stripHtml(html) || html.includes("<img") ? html : "";
    setValue(next);
    valueRef.current = next;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 800);
  };

  const done = () => { flush(); setEditing(false); };
  const hasText = !!stripHtml(value) || value.includes("<img");

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="font-heading text-[15px] text-foreground font-semibold">Notes</p>
        {editing ? (
          <button onClick={done} className="bg-[#A7773F] text-[#F7F3EC] rounded-full text-xs px-3.5 py-1.5">Done</button>
        ) : (
          <button onClick={() => setEditing(true)} className="border border-[#A7773F] text-[#A7773F] rounded-full text-xs px-3.5 py-1.5">Edit</button>
        )}
      </div>

      {editing ? (
        <div className="quill-projects">
          <ReactQuill
            theme="snow"
            value={value}
            onChange={handleChange}
            placeholder="Notes about this project..."
            modules={{
              toolbar: [
                ["bold", "italic", "underline"],
                [{ list: "ordered" }, { list: "bullet" }],
                ["link"],
                ["clean"],
              ],
            }}
          />
        </div>
      ) : (
        <div className="ql-snow cursor-text" onClick={() => setEditing(true)}>
          {hasText ? (
            <div className="ql-editor !p-0 !min-h-[120px] text-[15px] leading-relaxed text-foreground" dangerouslySetInnerHTML={{ __html: sanitize(value) }} />
          ) : (
            <p className="text-sm text-muted-foreground italic min-h-[120px]">Nothing here yet. Tap to start writing.</p>
          )}
          {hasText && <p className="text-[11px] text-muted-foreground text-center pt-6">Tap Edit or the text to make changes</p>}
        </div>
      )}
    </div>
  );
}
