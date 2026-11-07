// Shared helpers for calling Claude from Netlify functions.
// Claude is the primary model; set AI_PROVIDER=gemini in Netlify to turn it off.

const CLAUDE_MODEL = "claude-sonnet-5-5";
const CLAUDE_FAST_MODEL = "claude-haiku-5-5";

function claudeEnabled() {
  return !!process.env.ANTHROPIC_API_KEY && process.env.AI_PROVIDER !== "gemini";
}

// content: a string, or an array of Claude content blocks.
async function claudeText({ content, model = CLAUDE_MODEL, maxTokens = 4096, search = false, maxUses = 2, timeoutMs = 0 }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  const controller = timeoutMs ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller ? controller.signal : undefined,
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: "user", content }],
        ...(search ? { tools: [{ type: "web_search_20250305", name: "web_search", max_uses: maxUses }] } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || `Claude request failed (${res.status})`);
    return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Turn a base64 file into a Claude content block (PDF or image).
function fileBlock(mimeType, base64Data) {
  if (mimeType === "application/pdf") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64Data } };
  }
  return { type: "image", source: { type: "base64", media_type: mimeType || "image/jpeg", data: base64Data } };
}

module.exports = { claudeEnabled, claudeText, fileBlock, CLAUDE_MODEL, CLAUDE_FAST_MODEL };
