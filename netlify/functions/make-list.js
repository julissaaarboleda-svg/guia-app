// netlify/functions/make-list.js
//
// "Import list": turns a recipe, build instructions, a sewing pattern, a packing
// guide (a link, a photo/PDF, or note text) into things to buy or gather,
// grouped the way you'd shop for them.
//
// Body: { url?: string, file?: { mimeType, data (base64), name }, text?: string }
// Returns: { title, groups: [{ name, items: [{ text, maybe_have }] }], reason? }
// Files are read once and not stored.

const { GoogleGenAI } = require("@google/genai");
const { withUsage } = require("../lib/usage.cjs");
const { claudeEnabled, claudeText, fileBlock, CLAUDE_FAST_MODEL } = require("../lib/ai.cjs");
const { readLink, safeUrl } = require("../lib/linkread.cjs");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const reply = (statusCode, body) => ({ statusCode, headers: CORS, body: JSON.stringify(body) });

const ASK = `From this content, make the list of things someone needs to buy or gather to do it.
It could be a recipe (ingredients), furniture or DIY instructions (materials, hardware, tools), a sewing pattern (fabric, notions, thread), a packing guide, a party plan, or anything similar.
Return only JSON:
{"title":"short name of the project or dish, under 6 words","groups":[{"name":"group name","items":[{"text":"item with amount","maybe_have":false}]}]}
Rules:
- Groups fit the topic (food: Produce, Meat & seafood, Dairy, Bakery, Pantry, Spices, Frozen; builds: Lumber, Hardware, Paint & finish, Tools; sewing: Fabric, Notions, Thread; otherwise sensible groups).
- Write each item the way you'd shop for it: short, item first, then how much to buy in store units ("Sharp cheddar, 10 oz", "Heavy cream, 1 pint", "Evaporated milk, 2 cans", "Wood screws 1¼ in, 24"). No gram conversions, no prep notes ("for greasing", "for garnish", "shredded"). Combine duplicates into one line with the total.
- "maybe_have": true for basics most people already own (salt, pepper, cooking oil, water; common tools like a screwdriver, tape measure, scissors, iron).
- Leave out steps, equipment that is only mentioned in passing, and anything that isn't something to get.
- At most 40 items. If the content has nothing to make a list from, return {"title":"","groups":[]}.`;

function parseJson(text) {
  const s = String(text || ""); const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b < 0) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

async function ask({ text, file }) {
  if (claudeEnabled()) {
    const content = file
      ? [fileBlock(file.mimeType, file.data), { type: "text", text: ASK }]
      : `${ASK}\n\nContent:\n${text}`;
    try { return parseJson(await claudeText({ content, model: CLAUDE_FAST_MODEL, maxTokens: 2000, timeoutMs: 22000 })); } catch (e) { console.error("Claude make-list failed:", e.message); }
  }
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const parts = file ? [{ inlineData: { mimeType: file.mimeType, data: file.data } }, { text: ASK }] : [{ text: `${ASK}\n\nContent:\n${text}` }];
  const r = await ai.models.generateContent({ model: "gemini-3.6-flash", contents: [{ role: "user", parts }] });
  return parseJson(r.text);
}

const READABLE = /^(image\/(jpeg|png|webp|gif)|application\/pdf)$/i;

const handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return reply(405, { error: "Method not allowed" });
  const user = context.clientContext && context.clientContext.user;
  if (!user) return reply(401, { error: "Not authenticated" });

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return reply(400, { error: "Bad request" }); }
  try {
    let out;
    if (body.file && body.file.data) {
      if (String(body.file.data).length > 14_000_000) return reply(413, { error: "That file is too large. Try a screenshot of the list part." });
      const mt = String(body.file.mimeType || "").toLowerCase();
      if (READABLE.test(mt)) out = await ask({ file: { mimeType: mt, data: body.file.data } });
      else if (/^text\//.test(mt) || /\.(txt|md|csv)$/i.test(body.file.name || "")) out = await ask({ text: Buffer.from(body.file.data, "base64").toString("utf8").slice(0, 18000) });
      else return reply(200, { title: "", groups: [], reason: "unreadable" });
    } else if (body.url) {
      const u = safeUrl(body.url);
      if (!u) return reply(400, { error: "That doesn't look like a web link." });
      const read = await readLink(u, { fullText: true });
      if (read.text.length < 20) return reply(200, { title: "", groups: [], reason: "unreadable" });
      out = await ask({ text: read.text });
    } else if (body.text && String(body.text).trim().length > 10) {
      out = await ask({ text: String(body.text).slice(0, 18000) });
    } else {
      return reply(400, { error: "Nothing to read." });
    }
    const groups = ((out && out.groups) || [])
      .map((g) => ({ name: String(g.name || "Items").slice(0, 40), items: (g.items || []).filter((i) => i && i.text).slice(0, 40).map((i) => ({ text: String(i.text).slice(0, 120), maybe_have: !!i.maybe_have })) }))
      .filter((g) => g.items.length);
    return reply(200, { title: String((out && out.title) || "").slice(0, 60), groups, reason: groups.length ? "" : "nothing_found" });
  } catch (err) {
    console.error("make-list failed:", err);
    return reply(500, { error: "Couldn't read that. Try a screenshot of the list part." });
  }
};

exports.handler = withUsage(handler, () => 1);
