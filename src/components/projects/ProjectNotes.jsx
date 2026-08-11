import { useState, useEffect } from "react";

export default function ProjectNotes({ notes, onSave }) {
  const [value, setValue] = useState(notes || "");

  useEffect(() => { setValue(notes || ""); }, [notes]);

  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => value !== notes && onSave(value)}
        rows={8}
        placeholder="Notes about this project..."
        className="w-full bg-muted border border-input rounded-lg px-3 py-2 text-sm outline-none focus:border-ring resize-none"
      />
    </div>
  );
}
