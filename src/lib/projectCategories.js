import { PartyPopper, Home, Briefcase, Sparkles, Wallet, MoreHorizontal } from "lucide-react";

export const PROJECT_CATEGORIES = [
  { id: "event", label: "Event", Icon: PartyPopper },
  { id: "home", label: "Home", Icon: Home },
  { id: "work", label: "Work", Icon: Briefcase },
  { id: "personal", label: "Personal", Icon: Sparkles },
  { id: "financial", label: "Financial", Icon: Wallet },
  { id: "other", label: "Other", Icon: MoreHorizontal },
];
export const projectCategory = (id) => PROJECT_CATEGORIES.find((c) => c.id === id);

// Brand-toned status chips.
export const PROJECT_STATUS_CHIP = {
  planning: "bg-[#F3E8D6] text-[#8A5F27] border-[#E6D3B0]",
  active: "bg-[#E4E9D5] text-[#566033] border-[#CFD8B5]",
  on_hold: "bg-[#F4E6E7] text-[#8F5F65] border-[#E7CFD2]",
  completed: "bg-[#ECE7DD] text-[#6B655D] border-[#DDD6C8]",
};
