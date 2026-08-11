import { base44 } from "@/api/base44Client";

// Referenced by Dashboard.jsx as getHomeAi(digest).then(setAi), where the result
// is destructured as { summary, insight } — insight feeds TodaysInsight.jsx's card.
// Real source was never sent; reconstructed to match that call site exactly.
export async function getHomeAi(digest) {
  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a warm, encouraging life-organization assistant inside the Guía app. Based on this snapshot of the user's day, write ONE short, specific, encouraging insight (under 140 characters, no fluff, no generic advice) that references something concrete from the data.

Snapshot: ${digest}

Return JSON: { "insight": "the one-sentence insight" }`,
      response_json_schema: {
        type: "object",
        properties: { insight: { type: "string" } },
      },
    });
    return { summary: null, insight: res?.insight || null };
  } catch {
    return { summary: null, insight: null };
  }
}
