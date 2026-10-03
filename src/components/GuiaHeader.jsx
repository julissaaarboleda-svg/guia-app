// Renders once in Layout.jsx, above <Outlet />, so it's automatic on every
// page — current and future — instead of needing to be added per-page.
export default function GuiaHeader() {
  return (
    <div
      className="sticky top-0 z-30 flex items-center justify-between bg-background/95 backdrop-blur-sm border-b border-border px-4 md:px-6 flex-shrink-0"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)", paddingBottom: "10px" }}
    >
      <img src="/guia-logo.svg" alt="Guía" className="h-8 md:h-10 w-auto" />
    </div>
  );
}
