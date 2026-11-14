import { useLocation } from "react-router-dom";
import { Plus } from "lucide-react";
import { CAPTURE_PAGES } from "@/lib/capture";

// Renders once in Layout.jsx, above <Outlet />, so it's automatic on every
// page — current and future — instead of needing to be added per-page.
export default function GuiaHeader() {
  const { pathname } = useLocation();
  const canCapture = CAPTURE_PAGES.includes(pathname);
  return (
    <div
      className="sticky top-0 z-30 flex items-center justify-between bg-background/95 backdrop-blur-sm border-b border-border px-4 md:px-6 flex-shrink-0"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)", paddingBottom: "10px" }}
    >
      <img src="/guia-logo.svg" alt="Guía" className="h-8 md:h-10 w-auto" />
      {canCapture && (
        <button
          type="button"
          aria-label="Quick capture"
          onClick={() => window.dispatchEvent(new Event("guia:capture-open"))}
          className="w-8 h-8 rounded-full bg-[#A7773F] text-[#F7F3EC] flex items-center justify-center active:scale-95 transition-transform"
        >
          <Plus className="w-[18px] h-[18px]" strokeWidth={2.25} />
        </button>
      )}
    </div>
  );
}
