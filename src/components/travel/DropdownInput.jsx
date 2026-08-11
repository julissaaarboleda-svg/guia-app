import { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function DropdownInput({ value, onChange, options, placeholder, icon: Icon, className = "" }) {
  const [custom, setCustom] = useState(false);
  const isCustomMode = custom || (value && !options.includes(value));

  if (isCustomMode) {
    return (
      <div className={`flex gap-1 ${className}`}>
        <input
          placeholder={placeholder}
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-ring"
          style={{ height: '40px' }}
        />
        <button
          type="button"
          onClick={() => { setCustom(false); onChange(""); }}
          className="text-muted-foreground hover:text-foreground px-2"
        >
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />}
      <select
        value={value || ""}
        onChange={e => {
          if (e.target.value === "__custom") {
            setCustom(true);
            onChange("");
          } else {
            onChange(e.target.value);
          }
        }}
        style={{ height: '40px' }}
        className={`w-full bg-muted border border-border rounded-lg ${Icon ? "pl-9" : "pl-3"} pr-9 text-sm outline-none focus:border-ring appearance-none ${className}`}
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
        <option value="__custom">Custom…</option>
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
    </div>
  );
}