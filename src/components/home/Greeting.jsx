import { motion } from "framer-motion";
import { Target, Plane } from "lucide-react";
export default function Greeting({ dateStr, greeting, firstName, status }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
    >
      <p className="font-body text-muted-foreground text-[10px] tracking-[0.22em] uppercase mb-2">{dateStr}</p>
      <h1 className="font-heading text-[1.5rem] sm:text-[1.75rem] text-foreground font-semibold leading-tight truncate">
        {greeting}, {firstName}.
      </h1>
      {status ? (
        <p className="font-body text-[13px] text-muted-foreground/90 mt-2 truncate font-normal leading-snug flex items-center gap-1.5">
          {status.startsWith("✈") ? <Plane className="w-3.5 h-3.5 flex-shrink-0 text-[#A7773F]" strokeWidth={1.5} /> : <Target className="w-3.5 h-3.5 flex-shrink-0 text-[#A7773F]" strokeWidth={1.5} />}{status.replace(/^[^\p{L}\p{N}]+/u, "")}
        </p>
      ) : null}
    </motion.div>
  );
}
