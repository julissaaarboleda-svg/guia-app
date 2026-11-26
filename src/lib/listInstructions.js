// Turn AI steps into rich text for a list's instructions.
const esc = (t) => String(t || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function stepsToHtml({ key_info, steps = [], tips = [] }) {
  let html = "";
  if (key_info) html += `<p><strong>${esc(key_info)}</strong></p>`;
  if (steps.length) html += `<ol>${steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>`;
  if (tips.length) html += `<p><strong>Tips</strong></p><ul>${tips.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`;
  return html;
}

// First line of plain text, for previews under a list's name.
export function firstLine(html) {
  const d = typeof document !== "undefined" ? document.createElement("div") : null;
  if (!d) return "";
  d.innerHTML = String(html || "").replace(/<\/(p|li|h\d)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n");
  return (d.textContent || "").split("\n").map((s) => s.trim()).find(Boolean) || "";
}

export const hasText = (html) => !!firstLine(html);
