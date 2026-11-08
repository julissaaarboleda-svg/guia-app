import { posStyle } from "@/lib/imagePos";

// An <img> that fills its (overflow-hidden) parent, framed by a saved position.
export default function AdjustableImage({ src, pos, alt = "", className = "", style, ...rest }) {
  return <img src={src} alt={alt} className={`w-full h-full object-cover ${className}`} style={{ ...posStyle(pos), ...style }} {...rest} />;
}
