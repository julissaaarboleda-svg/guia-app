// netlify/functions/file.js
//
// Serves back a file previously stored via upload.js.
// Called as: /.netlify/functions/file?key=<userId>/<fileId>-<filename>
//
// Keys of the form <userId>/private/<fileId>-<filename> are private: they are
// only served (or deleted) when the signed-in user is the owner.

const { getStore, connectLambda } = require("@netlify/blobs");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

exports.handler = async (event, context) => {
  connectLambda(event); // required for getStore() to auto-detect credentials — see @netlify/blobs docs
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };

  const key = event.queryStringParameters && event.queryStringParameters.key;
  if (!key) return { statusCode: 400, body: "Missing ?key=" };

  const user = context.clientContext && context.clientContext.user;
  const userId = user && (user.sub || user.email);
  const isPrivate = key.split("/")[1] === "private";
  const owns = !!userId && key.startsWith(`${userId}/`);

  if (isPrivate && !owns) return { statusCode: user ? 403 : 401, body: "Not allowed" };

  const store = getStore("guia-files");

  if (event.httpMethod === "DELETE") {
    if (!owns) return { statusCode: user ? 403 : 401, body: "Not allowed" };
    await store.delete(key);
    return { statusCode: 200, headers: CORS, body: "ok" };
  }

  const result = await store.getWithMetadata(key, { type: "arrayBuffer" });
  if (!result) return { statusCode: 404, body: "Not found" };

  return {
    statusCode: 200,
    headers: {
      ...CORS,
      "Content-Type": result.metadata?.contentType || "application/octet-stream",
      "Cache-Control": isPrivate ? "private, no-store" : "public, max-age=31536000, immutable",
    },
    body: Buffer.from(result.data).toString("base64"),
    isBase64Encoded: true,
  };
};
