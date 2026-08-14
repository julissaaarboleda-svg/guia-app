import { ArrowLeft } from "lucide-react";

export default function PageHeader({ title, subtitle, onBack, actions }) {
  return (
    <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-md" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="flex items-center justify-between px-4 md:px-8 pt-3 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button onClick={onBack} className="p-1 -ml-1 text-muted-foreground hover:text-foreground flex-shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="min-w-0">
            <h1 className="font-heading text-xl md:text-2xl text-foreground font-bold truncate">{title}</h1>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0 ml-4">{actions}</div>}
      </div>
      <div className="h-px bg-border w-full" />
    </div>
  );
}