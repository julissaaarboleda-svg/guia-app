import { useState, useRef, useEffect } from "react";
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
  const [openUpward, setOpenUpward] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("touchstart", handler); };
  }, []);

  const openPicker = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpward(spaceBelow < 380);
    }
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
      // end selection
      if (isBefore(day, s)) {
        // clicked before start → swap
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
  const startPad = getDay(firstDay); // 0=Sun

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

      {open && (
        <div className={`absolute z-50 bg-white border border-stone-200 rounded-2xl shadow-xl p-4 w-[320px] left-0 ${openUpward ? "bottom-full mb-1" : "top-full mt-1"}`}>
          {/* Month nav */}
          <div className="flex items-center justify-between mb-3">
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

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
              <div key={d} className="text-center text-xs text-stone-400 font-medium py-1">{d}</div>
            ))}
          </div>

          {/* Days grid */}
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

          {/* Hint */}
          <p className="text-xs text-stone-400 text-center mt-3">
            {selecting === "start" ? "Tap to set start date" : "Tap to set end date"}
          </p>
        </div>
      )}
    </div>
  );
}