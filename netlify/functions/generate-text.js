// netlify/functions/generate-text.js
//
// Generic replacement for the simpler base44.integrations.Core.InvokeLLM calls
// (ones that don't need Google Search grounding — e.g. generateTravelBrief,
// FinanceSummary's insights, generatePackingList, the AI Assistant chat).
//
// Body: { prompt: string, grounded?: boolean }
// Grounded calls (weather, top picks, suggestions, "know before you go") should
// use their own dedicated functions like generate-top-picks.js instead, since
// those need specific structured-output handling — this one is for everything else.

const { GoogleGenAI } = require("@google/genai");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function extractJson(text) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
}

exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const user = context.clientContext && context.clientContext.user;
  if (!user) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Not authenticated" }) };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "GEMINI_API_KEY not set" }) };

  try {
    const { prompt, grounded, wantJson } = JSON.parse(event.body);
    if (!prompt) throw new Error("Missing 'prompt'");

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      ...(grounded ? { config: { tools: [{ googleSearch: {} }] } } : {}),
    });
    const text = response.text;

    if (wantJson) {
      const parsed = extractJson(text);
      if (!parsed) throw new Error("Model response did not contain valid JSON");
      return { statusCode: 200, headers: CORS, body: JSON.stringify(parsed) };
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ text }) };
  } catch (err) {
    console.error("generate-text.js error:", err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
