// netlify/functions/import-finance.js
//
// Reads a bank statement, bill, receipt photo or spreadsheet export and returns
// a list of finance items sorted into Guía's categories. The file is sent to
// Gemini for this one request and is NOT stored anywhere.
//
// Body: { filename, contentType, base64Data }

const { GoogleGenAI } = require("@google/genai");
const { getStore, connectLambda } = require("@netlify/blobs");

const RATE_LIMIT = 10;
const WINDOW_MS = 60 * 60 * 1000;
const MAX_BYTES = 4.2 * 1024 * 1024;

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const reply = (statusCode, body) => ({ statusCode, headers: CORS, body: JSON.stringify(body) });

const PROMPT = `You are helping someone organise their personal finances. Read the attached document (a bank or card statement, a bill, a receipt, or a list) and extract the recurring and one-off financial items worth tracking.

Return ONLY JSON in this exact shape:
{
  "items": [
    {
      "name": "short, human name, e.g. Rent, Netflix, CenterPoint Energy",
      "amount": number or null,
      "kind": "bill" | "subscription" | "loan" | "savings_goal" | "skip",
      "alternatives": ["other kinds that are plausible, from the same list, excluding kind"],
      "confidence": number between 0 and 1,
      "is_fixed": true if the amount is the same every period, else false,
      "billing_cycle": "monthly" | "weekly" | "quarterly" | "yearly" | "one_time",
      "due_day": day of month as a number or null,
      "category": "Housing" | "Utilities" | "Groceries" | "Dining" | "Transportation" | "Insurance" | "Healthcare" | "Personal" | "Entertainment" | "Other",
      "reason": "one short sentence on why you chose this kind"
    }
  ]
}

Rules:
- "bill" = utilities, rent, insurance, phone, anything paid on a due date that is not a streaming or app subscription.
- "subscription" = streaming, apps, memberships, software, anything that renews automatically.
- "loan" = car, student, personal loans, credit card payments, mortgages. Use the monthly payment as amount.
- "savings_goal" = transfers to savings or investment accounts.
- Use "skip" for purchases that are not worth tracking (one-off groceries, restaurants, fuel, ATM cash, refunds) and for income/deposits.
- Combine repeat charges from the same merchant into ONE item.
- Never include account numbers, card numbers, addresses or any other personal identifiers anywhere in the output.
- When unsure, lower the confidence and fill alternatives rather than guessing.
- Return at most 40 items. If nothing relevant is found, return {"items": []}.`;

const KINDS = ["bill", "subscription", "loan", "savings_goal", "skip"];

function parseJson(text) {
  try { return JSON.parse(text); } catch { /* fall through */ }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

exports.handler = async (event, context) => {
  connectLambda(event);
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return reply(405, { error: "Method not allowed" });

  const user = context.clientContext && context.clientContext.user;
  if (!user) return reply(401, { error: "Not authenticated" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return reply(500, { error: "The AI key isn't set up on the server (GEMINI_API_KEY)." });

  let filename, contentType, base64Data;
  try { ({ filename, contentType, base64Data } = JSON.parse(event.body || "{}")); }
  catch { return reply(400, { error: "That upload couldn't be read." }); }
  if (!base64Data) return reply(400, { error: "No file received." });

  const bytes = Buffer.from(base64Data, "base64");
  if (bytes.length > MAX_BYTES) return reply(413, { error: "That file is too large. Try a file under 4 MB, or one statement month at a time." });

  const name = (filename || "").toLowerCase();
  const type = (contentType || "").toLowerCase();
  const isText = type.startsWith("text/") || /\.(csv|txt|tsv)$/.test(name);
  const isPdf = type === "application/pdf" || name.endsWith(".pdf");
  const isImage = type.startsWith("image/");
  if (!isText && !isPdf && !isImage) {
    return reply(415, { error: "Use a PDF, a photo or screenshot, or a CSV. For Excel, save or export it as CSV first." });
  }

  try {
    const store = getStore("rate-limits");
    const key = `import-${user.sub || user.email || "unknown"}`;
    const now = Date.now();
    let rec = await store.get(key, { type: "json" });
    if (!rec || now - rec.windowStart > WINDOW_MS) rec = { count: 0, windowStart: now };
    if (rec.count >= RATE_LIMIT) {
      const mins = Math.ceil((WINDOW_MS - (now - rec.windowStart)) / 60000);
      return reply(429, { error: `You've reached the import limit for this hour. Try again in about ${mins} minute(s).` });
    }
    rec.count += 1;
    await store.setJSON(key, rec);
  } catch (err) {
    console.error("import-finance rate limit check failed (allowing):", err);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const parts = [{ text: PROMPT }];
    if (isText) parts.push({ text: `\n\nDocument (${filename || "text"}):\n` + bytes.toString("utf8").slice(0, 120000) });
    else parts.push({ inlineData: { mimeType: isPdf ? "application/pdf" : (type || "image/jpeg"), data: base64Data } });

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [{ role: "user", parts }],
      config: { responseMimeType: "application/json" },
    });
    const parsed = parseJson(response.text || "");
    if (!parsed || !Array.isArray(parsed.items)) return reply(502, { error: "The file was read, but the result wasn't usable. Try again, or try a clearer copy." });

    const items = parsed.items.slice(0, 40).map((it) => {
      const kind = KINDS.includes(it.kind) ? it.kind : "skip";
      const amt = Number(it.amount);
      return {
        name: String(it.name || "").slice(0, 80),
        amount: Number.isFinite(amt) && amt > 0 ? Math.round(amt * 100) / 100 : null,
        kind,
        alternatives: (Array.isArray(it.alternatives) ? it.alternatives : []).filter((k) => KINDS.includes(k) && k !== kind),
        confidence: Math.max(0, Math.min(1, Number(it.confidence) || 0)),
        is_fixed: !!it.is_fixed,
        billing_cycle: ["monthly", "weekly", "quarterly", "yearly", "one_time"].includes(it.billing_cycle) ? it.billing_cycle : "monthly",
        due_day: Number.isInteger(Number(it.due_day)) && Number(it.due_day) >= 1 && Number(it.due_day) <= 31 ? Number(it.due_day) : null,
        category: String(it.category || "").slice(0, 40),
        reason: String(it.reason || "").slice(0, 160),
      };
    }).filter((it) => it.name);

    return reply(200, { items });
  } catch (err) {
    console.error("import-finance.js error:", err);
    return reply(500, { error: "Couldn't read that file right now. Try again in a moment." });
  }
};
