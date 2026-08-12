// netlify/functions/upload.js
//
// Replaces: base44.integrations.Core.UploadFile({ file })
// Client sends base64-encoded file data; this stores it in Netlify Blobs
// and returns a { file_url } pointing at the companion file.js function.

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

  try {
    const { filename, contentType, base64Data } = JSON.parse(event.body);
    if (!base64Data) throw new Error("Missing base64Data");

    const store = getStore("guia-files");
    const fileId = randomUUID();
    const key = `${user.sub}/${fileId}-${filename || "file"}`;

    await store.set(key, Buffer.from(base64Data, "base64"), {
      metadata: { contentType: contentType || "application/octet-stream" },
    });

    const siteUrl = process.env.URL || `https://${event.headers.host}`;
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ file_url: `${siteUrl}/.netlify/functions/file?key=${encodeURIComponent(key)}` }),
    };
  } catch (err) {
    console.error("upload.js error:", err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
