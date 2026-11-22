// Save a file from Guía without stranding people on iPhone.
//
// On an iPhone home-screen app, a normal "download" link opens a full-screen
// file preview with no way back. So on phones we hand the file to the share
// sheet instead (Save Image, Save to Files, AirDrop, Messages…). Computers
// keep the normal download.

const isStandaloneIOS = () => {
  try {
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    return ios;
  } catch { return false; }
};

function plainDownload(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// source: a Blob/File, or a URL to fetch. Returns "shared" | "downloaded" | "cancelled".
export async function saveFile(source, name = "file", type) {
  let blob = source;
  if (typeof source === "string") {
    const res = await fetch(source);
    blob = await res.blob();
  }
  const file = blob instanceof File && blob.name === name ? blob : new File([blob], name, { type: type || blob.type || "application/octet-stream" });

  const canShare = typeof navigator !== "undefined" && navigator.canShare && navigator.share && (() => { try { return navigator.canShare({ files: [file] }); } catch { return false; } })();
  const touch = typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches || isStandaloneIOS());

  if (canShare && touch) {
    try {
      await navigator.share({ files: [file], title: name });
      return "shared";
    } catch (e) {
      if (e && e.name === "AbortError") return "cancelled";
      // Share needs a fresh tap on some phones; fall through.
    }
  }
  if (isStandaloneIOS()) {
    // Last resort on iPhone: open it in a browser sheet that has a Done button.
    const url = URL.createObjectURL(file);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return "downloaded";
  }
  plainDownload(file, name);
  return "downloaded";
}
