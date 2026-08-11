import { useState, useEffect, useRef } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

export default function ProjectNotes({ notes, onSave }) {
  const [value, setValue] = useState(notes || "");
  const saveTimer = useRef(null);

  useEffect(() => { setValue(notes || ""); }, [notes]);

  const handleChange = (html) => {
    setValue(html);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onSave(html), 800); // debounced autosave, like Notes.jsx
  };

  return (
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
  );
}
