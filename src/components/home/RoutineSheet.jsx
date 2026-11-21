import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Check, Pencil, X } from "lucide-react";
import { colorOf, dayKey, stepsFor, scheduleLabel } from "@/lib/routines";

// A routine's checklist for today, sliding up over Home so you never leave it.
// Swipe down, tap outside, or tap X to close.
export default function RoutineSheet({ routine, timeLabel, onStep, onAll, onClose }) {
  const [shown, setShown] = useState(false);
  const [drag, setDrag] = useState(0);
  const startY = useRef(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    const onKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { cancelAnimationFrame(id); window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, []);

  const close = () => { setShown(false); setTimeout(onClose, 260); };

  if (!routine) return null;
  const c = colorOf(routine);
  const steps = stepsFor(routine);
  const doneIds = new Set((routine.log || {})[dayKey()] || []);
  const done = steps.filter((s) => doneIds.has(s.id)).length;
  const all = steps.length > 0 && done >= steps.length;
  const offToday = steps.length === 0;
  const name = routine.name.replace(/^(morning|evening)\s*[·:-]\s*/i, "");

  const onTouchStart = (e) => { startY.current = e.touches[0].clientY; };
  const onTouchMove = (e) => { if (startY.current != null) setDrag(Math.max(0, e.touches[0].clientY - startY.current)); };
  const onTouchEnd = () => { if (drag > 90) close(); setDrag(0); startY.current = null; };

  return createPortal(
    <div className="fixed inset-0 z-[85]" role="dialog" aria-modal="true" aria-label={name}>
      <button type="button" aria-label="Close" onClick={close}
        className={`absolute inset-0 bg-[#2E2A27]/30 transition-opacity duration-300 ${shown ? "opacity-100" : "opacity-0"}`} />
      <div
        className="absolute left-0 right-0 bottom-0 max-w-lg mx-auto bg-[#F7F3EC] rounded-t-[22px] border-t border-[#E4DCCF] max-h-[85vh] flex flex-col"
        style={{ transform: shown ? `translateY(${drag}px)` : "translateY(100%)", transition: drag ? "none" : "transform 300ms cubic-bezier(.16,1,.3,1)", paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} className="px-5 pt-2.5 pb-1 cursor-grab">
          <div className="w-9 h-1 rounded-full bg-[#D9CFBF] mx-auto mb-3" />
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10.5px] tracking-[0.16em] uppercase font-medium" style={{ color: c }}>
                {timeLabel}{routine.hint ? ` · ${routine.hint}` : ""}
              </p>
              <h2 className="font-heading text-[21px] leading-tight text-[#2E2A27] mt-1">{name}</h2>
            </div>
            {!offToday && !(steps.length === 1 && steps[0].implicit) && <span className="text-[12px] mt-1" style={{ color: all ? "#7D8A53" : "#8A8078" }}>{done} of {steps.length}</span>}
            <button type="button" onClick={close} aria-label="Close" className="p-1 -mr-1 text-[#8A8078]"><X className="w-5 h-5" strokeWidth={1.5} /></button>
          </div>
        </div>

        <div className="px-5 overflow-y-auto">
          {offToday ? (
            <div className="mt-3">
              <p className="text-[13px] text-[#8A8078]">Not due today. It's on {scheduleLabel(routine)}.</p>
              {!(routine.steps || []).every((st) => st.implicit) && (
                <ul className="bg-white border border-[#E8E0D2] rounded-2xl px-4 mt-3">
                  {(routine.steps || []).map((st, i) => (
                    <li key={st.id} className={`py-2.5 ${i ? "border-t border-[#EFE8DC]" : ""}`}>
                      <span className="block text-[14px] text-[#6B635C]">{st.text}</span>
                      {st.note && <span className="block text-[12px] text-[#9A9088] mt-0.5">{st.note}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : steps.length === 1 && steps[0].implicit ? (
            <p className="text-[13px] text-[#8A8078] mt-3">{all ? "Done for today." : "One simple check. Tap Mark done when it's done."}</p>
          ) : (
          <div className="bg-white border border-[#E8E0D2] rounded-2xl px-4 mt-3">
            {steps.map((st, i) => {
              const on = doneIds.has(st.id);
              return (
                <button key={st.id} type="button" onClick={() => onStep(routine, st.id)}
                  className={`w-full flex items-start gap-3 py-3 text-left ${i ? "border-t border-[#EFE8DC]" : ""}`}>
                  <span className="w-[22px] h-[22px] rounded-full flex items-center justify-center flex-shrink-0 mt-[1px] transition-colors"
                    style={on ? { background: c } : { border: "1.5px solid #D9CFBF" }}>
                    {on && <Check className="w-3.5 h-3.5 text-white" strokeWidth={2.6} />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-[14.5px] ${on ? "text-[#8A8078] line-through" : "text-[#2E2A27]"}`}>{st.text}</span>
                    {st.note && <span className="block text-[12.5px] text-[#8A8078] mt-0.5">{st.note}</span>}
                  </span>
                </button>
              );
            })}
          </div>
          )}

          <div className="grid grid-cols-2 gap-2 mt-3">
            {offToday ? <span /> : (
            <button type="button" onClick={() => onAll(routine, !all)}
              className="h-11 rounded-xl bg-[#2E2A27] text-[#F7F3EC] text-[14px]">{all ? "Undo all" : "Mark all done"}</button>
            )}
            <Link to={`/goals?view=routines&edit=${routine.id}`}
              className="h-11 rounded-xl border border-[#E4DCCF] text-[#6B635C] text-[14px] flex items-center justify-center gap-1.5">
              <Pencil className="w-4 h-4" strokeWidth={1.5} />Edit
            </Link>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
