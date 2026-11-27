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
{"title":"short name of the project or dish, under 6 words","groups":[{"name":"group name","items":[{"text":"item with amount","maybe_have":false}]}],"key_info":"one short line with the most useful fact (oven temp and time, servings, finished size), or empty","steps":["step 1 in your own concise words","step 2"]}
Rules:
- Groups fit the topic (food: Produce, Meat & seafood, Dairy, Bakery, Pantry, Spices, Frozen; builds: Lumber, Hardware, Paint & finish, Tools; sewing: Fabric, Notions, Thread; otherwise sensible groups).
- Write each item the way you'd shop for it: short, item first, then how much to buy in store units ("Sharp cheddar, 10 oz", "Heavy cream, 1 pint", "Evaporated milk, 2 cans", "Wood screws 1¼ in, 24"). No gram conversions, no prep notes ("for greasing", "for garnish", "shredded"). Combine duplicates into one line with the total.
- "maybe_have": true for kitchen staples and basics most people already keep on hand (salt, pepper, cooking oil, butter, flour, sugar, garlic powder, onion powder, paprika and other common dried spices, baking soda, vanilla, water; common tools like a screwdriver, tape measure, scissors, iron). Still list them: they go in the user's pantry section.
- Leave out steps, equipment that is only mentioned in passing, and anything that isn't something to get.
- "steps": the how-to steps, short and in order (at most 20), reworded concisely; [] if the content has none.
- At most 40 items. If the content has nothing to make a list from, return {"title":"","groups":[],"key_info":"","steps":[]}.`;

// "Upload" in a list's instructions: just the steps, as tidy rich text.
const ASK_STEPS = `Turn this into clear, concise instructions someone can follow.
Return only JSON: {"title":"short name","key_info":"one short line with the most useful fact (oven temp and time, servings, finished size), or empty","steps":["step 1","step 2"],"tips":["optional short tip"]}
Rules: reword in your own concise words; keep amounts and temperatures; at most 25 steps and 5 tips; leave out ads, stories and comments; if there are no instructions, return {"title":"","key_info":"","steps":[],"tips":[]}.`;

function parseJson(text) {
  const s = String(text || ""); const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b < 0) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

async function ask({ text, file, files, prompt = ASK }) {
  const ASK = prompt;
  const list = files || (file ? [file] : null);
  const multi = list && list.length > 1 ? `\n\nThese ${list.length} files are parts of the same thing, in order. Combine them into one result.` : "";
  if (claudeEnabled()) {
    const content = list
      ? [...list.map((f) => fileBlock(f.mimeType, f.data)), { type: "text", text: ASK + multi + (text ? `\n\nAlso:\n${text}` : "") }]
      : `${ASK}\n\nContent:\n${text}`;
    try { return parseJson(await claudeText({ content, model: CLAUDE_FAST_MODEL, maxTokens: 2000, timeoutMs: 22000 })); } catch (e) { console.error("Claude make-list failed:", e.message); }
  }
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const parts = list ? [...list.map((f) => ({ inlineData: { mimeType: f.mimeType, data: f.data } })), { text: ASK + multi + (text ? `\n\nAlso:\n${text}` : "") }] : [{ text: `${ASK}\n\nContent:\n${text}` }];
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
    const stepsOnly = body.mode === "instructions";
    const prompt = stepsOnly ? ASK_STEPS : ASK;
    const files = Array.isArray(body.files) ? body.files.filter((f) => f && f.data).slice(0, 8) : (body.file && body.file.data ? [body.file] : []);
    if (files.length > 1) {
      if (files.reduce((n, f) => n + String(f.data).length, 0) > 18_000_000) return reply(413, { error: "Those files are too large together. Try fewer, or smaller screenshots." });
      const readable = files.filter((f) => READABLE.test(String(f.mimeType || "").toLowerCase()));
      const texts = files.filter((f) => /^text\//i.test(f.mimeType || "") || /\.(txt|md|csv)$/i.test(f.name || "")).map((f) => Buffer.from(f.data, "base64").toString("utf8")).join("\n\n").slice(0, 12000);
      if (!readable.length && !texts) return reply(200, { title: "", groups: [], reason: "unreadable" });
      out = readable.length ? await ask({ files: readable.map((f) => ({ mimeType: String(f.mimeType).toLowerCase(), data: f.data })), text: texts, prompt }) : await ask({ text: texts, prompt });
    } else if (files.length === 1) {
      body.file = files[0];
      if (String(body.file.data).length > 14_000_000) return reply(413, { error: "That file is too large. Try a screenshot of the list part." });
      const mt = String(body.file.mimeType || "").toLowerCase();
      if (READABLE.test(mt)) out = await ask({ file: { mimeType: mt, data: body.file.data }, prompt });
      else if (/^text\//.test(mt) || /\.(txt|md|csv)$/i.test(body.file.name || "")) out = await ask({ text: Buffer.from(body.file.data, "base64").toString("utf8").slice(0, 18000), prompt });
      else return reply(200, { title: "", groups: [], reason: "unreadable" });
    } else if (body.url) {
      const u = safeUrl(body.url);
      if (!u) return reply(400, { error: "That doesn't look like a web link." });
      const read = await readLink(u, { fullText: true });
      if (read.text.length < 20) return reply(200, { title: "", groups: [], reason: "unreadable" });
      out = await ask({ text: read.text, prompt });
    } else if (body.text && String(body.text).trim().length > 10) {
      out = await ask({ text: String(body.text).slice(0, 18000), prompt });
    } else {
      return reply(400, { error: "Nothing to read." });
    }
    const clip = (a, n, len) => (Array.isArray(a) ? a : []).filter(Boolean).slice(0, n).map((x) => String(x).slice(0, len));
    const steps = clip(out && out.steps, 25, 400), tips = clip(out && out.tips, 5, 300);
    const keyInfo = String((out && out.key_info) || "").slice(0, 160);
    if (stepsOnly) return reply(200, { title: String((out && out.title) || "").slice(0, 60), key_info: keyInfo, steps, tips, reason: steps.length ? "" : "nothing_found" });
    const groups = ((out && out.groups) || [])
      .map((g) => ({ name: String(g.name || "Items").slice(0, 40), items: (g.items || []).filter((i) => i && i.text).slice(0, 40).map((i) => ({ text: String(i.text).slice(0, 120), maybe_have: !!i.maybe_have })) }))
      .filter((g) => g.items.length);
    return reply(200, { title: String((out && out.title) || "").slice(0, 60), groups, key_info: keyInfo, steps, reason: groups.length ? "" : "nothing_found" });
  } catch (err) {
    console.error("make-list failed:", err);
    return reply(500, { error: "Couldn't read that. Try a screenshot of the list part." });
  }
};

exports.handler = withUsage(handler, () => 1);
