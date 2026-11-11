// GET: this account's plan and AI uses this month, for the "AI uses left" line in Settings.
const { connectLambda } = require("@netlify/blobs");
const { usageFor } = require("../lib/usage.cjs");
const CORS = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };

exports.handler = async (event, context) => {
  connectLambda(event);
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  const user = context.clientContext && context.clientContext.user;
  if (!user) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Not authenticated" }) };
  try {
    const { plan, used, limit, enforced, resets, resetsLabel, trialEnds, trialDaysLeft, trialEnded } = await usageFor(user);
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ plan, used, limit, enforced, resets, resetsLabel, trialEnds, trialDaysLeft, trialEnded }) };
  } catch (err) {
    console.error("usage failed:", err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Couldn't load usage." }) };
  }
};
