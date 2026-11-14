import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Target, Plane } from "lucide-react";

// Stays pinned under the header while Home scrolls, and gets more compact once pinned.
export default function Greeting({ dateStr, greeting, firstName, status }) {
  const sentinel = useRef(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const root = el.closest("main") || null;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), { root, threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinel} aria-hidden="true" className="h-px -mb-px" />
      <div
        className={`sticky top-0 z-[25] bg-background -mx-6 px-6 md:-mx-10 md:px-10 lg:-mx-12 lg:px-12 transition-[padding] duration-200 ${stuck ? "py-2 border-b border-border/50" : "py-0 border-b border-transparent"}`}
      >
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className={`font-body text-muted-foreground text-[10px] tracking-[0.22em] uppercase ${stuck ? "mb-0.5" : "mb-2"}`}>{dateStr}</p>
          <h1 className={`font-heading text-foreground font-semibold leading-tight truncate transition-[font-size] duration-200 ${stuck ? "text-[1.1rem]" : "text-[1.5rem] sm:text-[1.75rem]"}`}>
            {greeting}, {firstName}.
          </h1>
          {status ? (
            <p className={`font-body text-[13px] text-muted-foreground/90 truncate font-normal leading-snug flex items-center gap-1.5 ${stuck ? "mt-0.5" : "mt-2"}`}>
              {status.startsWith("✈") ? <Plane className="w-3.5 h-3.5 flex-shrink-0 text-[#A7773F]" strokeWidth={1.5} /> : <Target className="w-3.5 h-3.5 flex-shrink-0 text-[#A7773F]" strokeWidth={1.5} />}{status.replace(/^[^\p{L}\p{N}]+/u, "")}
            </p>
          ) : null}
        </motion.div>
      </div>
    </>
  );
}
