// netlify/functions/generate-image.js
//
// Replaces: base44.integrations.Core.GenerateImage({ prompt })
// Used by: generateCover (trip covers), ExploreTab (happening photo), generatePickImage
//
// Uses Gemini's image generation model and stores the result in Netlify Blobs
// (same pattern as upload.js) so it has a stable URL, matching Base44's { url } shape.

const { GoogleGenAI } = require("@google/genai");
const { getStore, connectLambda } = require("@netlify/blobs");
const { randomUUID } = require("node:crypto");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

exports.handler = async (event, context) => {
  connectLambda(event); // required for getStore() to auto-detect credentials — see @netlify/blobs docs
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const user = context.clientContext && context.clientContext.user;
  if (!user) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Not authenticated" }) };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "GEMINI_API_KEY not set" }) };

  try {
    const { prompt } = JSON.parse(event.body);
    if (!prompt) throw new Error("Missing 'prompt'");

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image",
      contents: prompt,
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p) => p.inlineData);
    if (!imagePart) throw new Error("Model did not return an image");

    const store = getStore("guia-files");
    const fileId = randomUUID();
    const key = `${user.sub}/generated/${fileId}.png`;
    await store.set(key, Buffer.from(imagePart.inlineData.data, "base64"), {
      metadata: { contentType: imagePart.inlineData.mimeType || "image/png" },
    });

    const siteUrl = process.env.URL || `https://${event.headers.host}`;
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ url: `${siteUrl}/.netlify/functions/file?key=${encodeURIComponent(key)}` }),
    };
  } catch (err) {
    console.error("generate-image.js error:", err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
