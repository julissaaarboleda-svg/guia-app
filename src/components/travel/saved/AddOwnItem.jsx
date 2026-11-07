import { Plus } from "lucide-react";

export default function AddOwnItem({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 bg-[#A7773F] text-[#F7F3EC] rounded-full px-4 py-2 font-body text-[13px] font-medium hover:opacity-90 transition-opacity"
    >
      <Plus className="w-4 h-4" /> Add your own place
    </button>
  );
}
