// netlify/functions/file.js
//
// Serves back a file previously stored via upload.js.
// Called as: /.netlify/functions/file?key=<userId>/<fileId>-<filename>

const { getStore, connectLambda } = require("@netlify/blobs");

exports.handler = async (event) => {
  connectLambda(event); // required for getStore() to auto-detect credentials — see @netlify/blobs docs
  const key = event.queryStringParameters && event.queryStringParameters.key;
  if (!key) return { statusCode: 400, body: "Missing ?key=" };

  const store = getStore("guia-files");
  const result = await store.getWithMetadata(key, { type: "arrayBuffer" });
  if (!result) return { statusCode: 404, body: "Not found" };

  return {
    statusCode: 200,
    headers: {
      "Content-Type": result.metadata?.contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
    body: Buffer.from(result.data).toString("base64"),
    isBase64Encoded: true,
  };
};
