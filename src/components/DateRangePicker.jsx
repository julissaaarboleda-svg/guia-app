import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { format, parseISO, isValid, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isSameDay, isWithinInterval, isBefore, isAfter, addMonths, subMonths } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";

function parseDate(str) {
  if (!str) return null;
  const d = parseISO(str);
  return isValid(d) ? d : null;
}

function toISO(d) {
  return d ? format(d, "yyyy-MM-dd") : "";
}

function displayRange(startStr, endStr) {
  const s = parseDate(startStr);
  const e = parseDate(endStr);
  if (!s && !e) return "Select dates";
  if (s && !e) return format(s, "MMM d, yyyy") + " – ?";
  if (s && e) {
    const sameYear = s.getFullYear() === e.getFullYear();
    const sameMonth = sameYear && s.getMonth() === e.getMonth();
    if (sameMonth) return `${format(s, "MMM d")} – ${format(e, "d, yyyy")}`;
    if (sameYear) return `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}`;
    return `${format(s, "MMM d, yyyy")} – ${format(e, "MMM d, yyyy")}`;
  }
  return "Select dates";
}

export default function DateRangePicker({ startDate, endDate, onChange, label, placeholder }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => parseDate(startDate) || new Date());
  const [selecting, setSelecting] = useState("start"); // "start" | "end"
  const [hovered, setHovered] = useState(null);
  const [coords, setCoords] = useState(null); // { top, left, width, openUpward }
  const ref = useRef(null);
  const popupRef = useRef(null);

  // NOTE: this popup used to be `position: absolute` nested inside a parent
  // with `overflow: hidden` (the New Journey / Edit Trip bottom sheet). That
  // clips ANY descendant that extends past the sheet's bounds — no z-index
  // can override CSS overflow clipping — which silently cut off the top of
  // the calendar (the month header + first row of days) whenever the popup
  // was taller than the visible sheet area. Rendering through a portal with
  // fixed, screen-relative coordinates sidesteps that entirely.
  useEffect(() => {
    const handler = (e) => {
      if (
        ref.current && !ref.current.contains(e.target) &&
        popupRef.current && !popupRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("touchstart", handler); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < 420;
      setCoords({
        left: rect.left,
        width: rect.width,
        top: openUpward ? undefined : rect.bottom + 4,
        bottom: openUpward ? window.innerHeight - rect.top + 4 : undefined,
        openUpward,
      });
    };
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  const openPicker = () => {
    setSelecting(startDate ? "end" : "start");
    setMonth(parseDate(startDate) || new Date());
    setOpen(true);
  };

  const clear = (e) => {
    e.stopPropagation();
    onChange({ startDate: "", endDate: "" });
    setSelecting("start");
  };

  const handleDayClick = (day) => {
    const s = parseDate(startDate);
    if (selecting === "start" || !s) {
      onChange({ startDate: toISO(day), endDate: "" });
      setSelecting("end");
    } else {
      if (isBefore(day, s)) {
        onChange({ startDate: toISO(day), endDate: toISO(s) });
      } else {
        onChange({ startDate: toISO(s), endDate: toISO(day) });
      }
      setOpen(false);
      setSelecting("start");
      setHovered(null);
    }
  };

  const firstDay = startOfMonth(month);
  const lastDay = endOfMonth(month);
  const days = eachDayOfInterval({ start: firstDay, end: lastDay });
  const startPad = getDay(firstDay);

  const s = parseDate(startDate);
  const e = parseDate(endDate);

  const isStart = (d) => s && isSameDay(d, s);
  const isEnd = (d) => e && isSameDay(d, e);
  const isInRange = (d) => {
    if (s && e) return isWithinInterval(d, { start: s, end: e });
    if (s && selecting === "end" && hovered) {
      const rangeEnd = isBefore(hovered, s) ? s : hovered;
      const rangeStart = isBefore(hovered, s) ? hovered : s;
      return isWithinInterval(d, { start: rangeStart, end: rangeEnd });
    }
    return false;
  };
  const isRangeStart = (d) => {
    if (isStart(d)) return true;
    if (!e && selecting === "end" && hovered && s && isBefore(hovered, s) && isSameDay(d, hovered)) return true;
    return false;
  };
  const isRangeEnd = (d) => {
    if (isEnd(d)) return true;
    if (!e && selecting === "end" && hovered && s && !isBefore(hovered, s) && isSameDay(d, hovered)) return true;
    if (!e && selecting === "end" && hovered && s && isSameDay(d, s)) return true;
    return false;
  };

  const hasValue = startDate || endDate;

  return (
    <div className="relative" ref={ref}>
      {label && <label className="text-xs text-stone-500 mb-1 block">{label}</label>}
      <button
        type="button"
        onClick={openPicker}
        className="w-full flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-left transition-colors hover:border-stone-400 focus:outline-none focus:border-stone-400 min-h-[44px]"
      >
        <CalendarDays className="w-4 h-4 text-stone-400 flex-shrink-0" />
        <span className={hasValue ? "text-stone-900 flex-1" : "text-stone-400 flex-1"}>
          {hasValue ? displayRange(startDate, endDate) : (placeholder || "Select date range")}
        </span>
        {hasValue && (
          <span onMouseDown={clear} className="text-stone-300 hover:text-stone-600 p-1 -mr-1 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </span>
        )}
      </button>

      {open && coords && createPortal(
        <div
          ref={popupRef}
          className="fixed z-[95] bg-white border border-stone-200 rounded-2xl shadow-xl w-[320px] max-h-[70vh] overflow-y-auto"
          style={{ left: coords.left, top: coords.top, bottom: coords.bottom, maxWidth: "calc(100vw - 24px)" }}
        >
          <div className="sticky top-0 bg-white flex items-center justify-between px-4 pt-4 pb-3 z-10">
            <button type="button" onClick={() => setMonth(subMonths(month, 1))}
              className="p-2 rounded-lg hover:bg-stone-100 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
              <ChevronLeft className="w-4 h-4 text-stone-600" />
            </button>
            <span className="text-sm font-semibold text-stone-900">{format(month, "MMMM yyyy")}</span>
            <button type="button" onClick={() => setMonth(addMonths(month, 1))}
              className="p-2 rounded-lg hover:bg-stone-100 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
              <ChevronRight className="w-4 h-4 text-stone-600" />
            </button>
          </div>
          <div className="px-4 pb-4">
            <div className="grid grid-cols-7 mb-1">
              {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
                <div key={d} className="text-center text-xs text-stone-400 font-medium py-1">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} />)}
              {days.map(day => {
                const rangeStart = isRangeStart(day);
                const rangeEnd = isRangeEnd(day);
                const inRange = isInRange(day);
                const isStartDay = isStart(day);
                const isEndDay = isEnd(day);
                const isSelected = isStartDay || isEndDay;

                return (
                  <div
                    key={day.toISOString()}
                    className={`relative flex items-center justify-center cursor-pointer select-none
                      ${inRange ? "bg-stone-100" : ""}
                      ${rangeStart ? "rounded-l-full" : ""}
                      ${rangeEnd ? "rounded-r-full" : ""}
                      ${!rangeStart && !rangeEnd && inRange ? "rounded-none" : ""}
                    `}
                    style={{ minHeight: 44 }}
                    onClick={() => handleDayClick(day)}
                    onMouseEnter={() => selecting === "end" && setHovered(day)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <span className={`w-9 h-9 flex items-center justify-center rounded-full text-sm font-medium transition-colors
                      ${isSelected ? "bg-stone-800 text-white" : ""}
                      ${!isSelected && inRange ? "text-stone-800" : ""}
                      ${!isSelected && !inRange ? "text-stone-700 hover:bg-stone-200" : ""}
                    `}>
                      {format(day, "d")}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-stone-400 text-center mt-3">
              {selecting === "start" ? "Tap to set start date" : "Tap to set end date"}
            </p>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
