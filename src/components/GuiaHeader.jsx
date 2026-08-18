import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";

// Renders once in Layout.jsx, above <Outlet />, so it's automatic on every
// page — current and future — instead of needing to be added per-page.
export default function GuiaHeader() {
  return (
    <div
      className="sticky top-0 z-30 flex items-center justify-between bg-background/95 backdrop-blur-sm border-b border-border px-4 md:px-6 flex-shrink-0"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)", paddingBottom: "10px" }}
    >
      <img src="/guia-logo.png" alt="Guía" className="h-5 md:h-6 w-auto" />
      <Link
        to="/ai"
        className="flex items-center gap-1.5 bg-charcoal text-[#F5F1EB] text-[11.5px] md:text-[12.5px] font-body font-medium pl-2.5 pr-3 py-1.5 rounded-full hover:opacity-90 transition-opacity"
      >
        <Sparkles className="w-3 h-3" style={{ color: "#8FA05F" }} />
        How can I help you today?
      </Link>
    </div>
  );
}
