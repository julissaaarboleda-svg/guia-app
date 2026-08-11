import { motion } from "framer-motion";

export default function Greeting({ dateStr, greeting, firstName, status }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
    >
      <p className="font-body text-muted-foreground text-[10px] tracking-[0.22em] uppercase mb-2">{dateStr}</p>
      <h1 className="font-heading text-[2rem] sm:text-[2.4rem] text-foreground font-semibold leading-[1.05]">
        {greeting},<br />
        {firstName}.
      </h1>
      {status ? (
        <p className="font-body text-[13px] text-muted-foreground/80 mt-2.5 truncate font-normal leading-snug">
          {status}
        </p>
      ) : null}
    </motion.div>
  );
}