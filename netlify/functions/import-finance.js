// netlify/functions/import-finance.js
//
// Reads a bank statement, bill, receipt photo or spreadsheet export and returns
// a list of finance items sorted into Guía's categories. The file is sent to
// Gemini for this one request and is NOT stored anywhere.
//
// Body: { filename, contentType, base64Data, existing?: [{ name, amount, type }], mode?: "items" | "schedule" }
// mode "schedule" reads a loan payment schedule and returns { payments: [{ date, amount }], payoff_amount }.

const { GoogleGenAI } = require("@google/genai");
const { claudeEnabled, claudeText, fileBlock } = require("../lib/ai.cjs");
const { getStore, connectLambda } = require("@netlify/blobs");

const RATE_LIMIT = 20;
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
      "kind": "bill" | "subscription" | "loan" | "credit_card" | "savings_goal" | "skip",
      "alternatives": ["other kinds that are plausible, from the same list, excluding kind"],
      "confidence": number between 0 and 1,
      "is_fixed": true if the amount is the same every period, else false,
      "billing_cycle": "monthly" | "weekly" | "quarterly" | "yearly" | "one_time",
      "due_day": day of month as a number or null,
      "category": "Housing" | "Utilities" | "Groceries" | "Dining" | "Transportation" | "Insurance" | "Healthcare" | "Personal" | "Entertainment" | "Other",
      "matches_existing": "the exact name of an item from EXISTING ITEMS below if this is clearly the same obligation (for example a landlord or property-management payment matches an existing Rent item), otherwise null",
      "reason": "one short sentence on why you chose this kind"
    }
  ]
}

Rules:
- "bill" = utilities, rent, insurance, phone, anything paid on a due date that is not a streaming or app subscription.
- "subscription" = streaming, apps, memberships, software, anything that renews automatically.
- "credit_card" = payments to credit card issuers or store cards. Use the payment amount.
- "loan" = installment debt only: car, student, personal loans, mortgages, buy-now-pay-later. Use the monthly payment as amount.
- "savings_goal" = transfers to savings or investment accounts.
- Use "skip" for purchases that are not worth tracking (one-off groceries, restaurants, fuel, ATM cash, refunds) and for income/deposits.
- Combine repeat charges from the same merchant into ONE item.
- Never include account numbers, card numbers, addresses or any other personal identifiers anywhere in the output.
- When unsure, lower the confidence and fill alternatives rather than guessing.
- Return at most 40 items. If nothing relevant is found, return {"items": []}.`;

const SCHEDULE_PROMPT = `Read the attached document, which shows a loan's upcoming payment schedule (for example a table of payment dates and amounts in an email, a statement or a screenshot).

Return ONLY JSON in this exact shape:
{
  "payments": [ { "date": "YYYY-MM-DD", "amount": number } ],
  "payoff_amount": number or null
}

Rules:
- One entry per payment, in date order. If a row says "Number of Payments" greater than 1, repeat it that many times only if the dates are given; otherwise list it once.
- Dates must be full ISO dates (YYYY-MM-DD).
- Set payoff_amount only if the document states an amount to pay the whole loan off today; otherwise null.
- Never include account numbers or personal identifiers.
- If there is no schedule, return {"payments": [], "payoff_amount": null}.`;

const BUSINESS_PROMPT = `You are helping a small business owner log their business activity. Read the attached business bank or card statement (or a list of transactions) and return each transaction worth logging.

Return ONLY JSON in this exact shape:
{
  "entries": [
    {
      "date": "YYYY-MM-DD",
      "name": "short, human name, e.g. Etsy payout, Fabric.com, Shopify fee",
      "kind": "sale" | "expense" | "skip",
      "amount": positive number,
      "note": "one short phrase of context, or empty",
      "confidence": number between 0 and 1
    }
  ]
}

Rules:
- "sale" = money coming in from customers or marketplaces (payouts, client payments, deposits for orders).
- "expense" = money going out for the business: supplies, materials, software, shipping, fees, advertising, rent, insurance, contractors, equipment.
- Use "skip" for transfers between the owner's own accounts, owner draws or contributions, loan proceeds, refunds of your own purchases, and anything personal.
- Dates must be full ISO dates. If the statement shows only month and day, use the year of the statement period.
- Keep each transaction as its own entry. Only merge identical charges on the same day from the same merchant.
- Amounts are always positive; "kind" says which direction.
- Never include account numbers, card numbers, addresses or any other personal identifiers anywhere in the output.
- When unsure, lower the confidence rather than guessing.
- Return at most 150 entries, most recent first. If nothing relevant is found, return {"entries": []}.`;

const CAREER_PROMPT = `You are helping someone build their career history in a personal app. Read the attached document (a resume, a performance review, an offer letter, a certificate or a transcript) and extract the career entries worth keeping.

Return ONLY JSON in this exact shape:
{
  "entries": [
    {
      "kind": "job" | "review" | "education" | "certification" | "milestone" | "skills",
      "title": "job title, review name, degree or credential name; for kind skills use \"Skills\"",
      "organization": "employer, school or issuing body, or empty",
      "start_date": "YYYY-MM-DD or null",
      "end_date": "YYYY-MM-DD or null",
      "current": true only for the role the person holds now,
      "date_uncertain": true if you had to guess a month or day (for example only a year was given),
      "highlights": ["up to 5 short achievements or key points, keeping any numbers exactly as written"],
      "skills": ["individual skills or tools, only for kind skills or when a job lists its own"],
      "salary": number or null,
      "rating": number or null,
      "rating_scale": number or null,
      "confidence": number between 0 and 1
    }
  ]
}

Rules:
- Every job or role is its own "job" entry, newest first, including an "Earlier experience" section.
- When only a year is given, use January 1 for a start and December 31 for an end, and set date_uncertain to true. When a month is given, use the 1st.
- A role that runs to "Present" has end_date null and current true. At most one entry may be current.
- Put the whole core-competencies / skills / tools section into ONE entry of kind "skills" (max 30 skills).
- Degrees, schools and bootcamps are "education". Licenses and certificates are "certification". Awards and promotions that stand alone are "milestone". A performance review document is "review" with rating and rating_scale only if they are written in it.
- Set salary only when an explicit figure for that exact role appears in the document; otherwise null. Never guess pay.
- Never include phone numbers, email addresses, street addresses, ID numbers or any other personal identifiers anywhere in the output.
- Never invent anything that is not in the document. Lower the confidence when unsure.
- Return at most 40 entries. If nothing relevant is found, return {"entries": []}.`;

const ROUTINE_PROMPT = `You are helping someone set up routines in a personal app. Read the attached document (a workout plan, a skincare routine from a dermatologist or esthetician, a physical therapy sheet, a meal or wellness plan, or similar) and turn it into routines with ordered steps.

Return ONLY JSON in this shape, nothing else:
{"routines":[{"name":"","slot":"morning|evening|anytime","days":[1,3,5],"steps":[{"text":"","note":""}]}]}

Rules:
- One routine per distinct session in the document: separate AM and PM skincare, separate workout days (for example "Day A · Upper body" and "Day B · Lower body") as separate routines.
- name: short and clear, under 40 characters.
- slot: "morning" for AM/morning, "evening" for PM/night/bedtime, otherwise "anytime".
- days: weekday numbers with Sunday=0 ... Saturday=6, only if the document says which days (e.g. "Mon/Wed/Fri" -> [1,3,5]; "twice a week" with no days -> []). Use [] for every day or unknown.
- steps: in the order they are done. text is the step itself (an exercise, a product or action), under 60 characters. note holds the details: sets × reps, weight, duration, rest, amount, or tips like "pea-sized" or "avoid eyes"; under 80 characters, or "" if none.
- Skip headings, disclaimers, warm-up lectures and anything that is not an actionable step. At most 12 routines and 25 steps per routine.
- Do not invent steps that are not in the document.`;

const SPENDING_PROMPT = `You are helping someone understand their spending habits. Read the attached bank or card statement (or transaction list) and return every money-out transaction, one row each.

Return ONLY JSON in this exact shape:
{
  "transactions": [
    { "d": "YYYY-MM-DD", "m": "merchant, short and clean, e.g. H-E-B, Chipotle, Shell", "a": positive number, "c": "Groceries" | "Dining" | "Transportation" | "Utilities" | "Housing" | "Insurance" | "Healthcare" | "Personal" | "Shopping" | "Entertainment" | "Travel" | "Subscriptions" | "Other", "t": "purchase" | "skip" }
  ]
}

Rules:
- "purchase" = money spent on goods, services, bills or fees.
- Use "skip" for income and deposits, transfers between the person's own accounts, credit card payments, refunds and reversals.
- Amounts are always positive. Dates must be full ISO dates; if only month and day are shown, use the year of the statement period.
- Clean up merchant names: drop store numbers, city names, card suffixes and payment-processor prefixes such as SQ *, TST*, PAYPAL *.
- Never include account numbers, card numbers, addresses or any other personal identifiers anywhere in the output.
- Keep every transaction as its own row. Return at most 300 rows, in date order. If nothing is found, return {"transactions": []}.`;

const KINDS = ["bill", "subscription", "loan", "credit_card", "savings_goal", "skip"];

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
  const useClaude = claudeEnabled();
  if (!apiKey && !useClaude) return reply(500, { error: "The AI key isn't set up on the server." });

  let filename, contentType, base64Data, existing, mode;
  try { ({ filename, contentType, base64Data, existing, mode } = JSON.parse(event.body || "{}")); }
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
    const existingList = (Array.isArray(existing) ? existing : []).slice(0, 80)
      .map((e) => `- ${String(e.name || "").slice(0, 60)} (${e.type}, ${e.amount != null ? "$" + e.amount : "no amount"})`).join("\n");
    const promptText = mode === "routine" ? ROUTINE_PROMPT : mode === "spending" ? SPENDING_PROMPT : mode === "schedule" ? SCHEDULE_PROMPT : mode === "business" ? BUSINESS_PROMPT : mode === "career" ? CAREER_PROMPT : PROMPT + `\n\nEXISTING ITEMS:\n${existingList || "(none)"}`;
    const docText = isText ? `\n\nDocument (${filename || "text"}):\n` + bytes.toString("utf8").slice(0, 120000) : "";

    let rawText;
    if (useClaude) {
      try {
        const content = isText
          ? promptText + docText
          : [fileBlock(isPdf ? "application/pdf" : (type || "image/jpeg"), base64Data), { type: "text", text: promptText }];
        rawText = await claudeText({ content, maxTokens: mode === "business" || mode === "career" || mode === "spending" ? 12000 : 6000 });
      } catch (claudeErr) {
        console.error("import-finance Claude failed, falling back to Gemini:", claudeErr);
        if (!apiKey) throw claudeErr;
      }
    }
    if (rawText === undefined) {
      const ai = new GoogleGenAI({ apiKey });
      const parts = [{ text: promptText }];
      if (isText) parts.push({ text: docText });
      else parts.push({ inlineData: { mimeType: isPdf ? "application/pdf" : (type || "image/jpeg"), data: base64Data } });
      // The AI service is sometimes briefly overloaded; try once more, on a second model, before giving up.
      let response;
      try {
        response = await ai.models.generateContent({ model: "gemini-3.6-flash", contents: [{ role: "user", parts }], config: { responseMimeType: "application/json" } });
      } catch (firstErr) {
        console.error("import-finance first attempt failed, retrying:", firstErr);
        response = await ai.models.generateContent({ model: "gemini-3.5-flash", contents: [{ role: "user", parts }], config: { responseMimeType: "application/json" } });
      }
      rawText = response.text || "";
    }
    const parsed = parseJson(rawText || "");
    if (mode === "schedule") {
      if (!parsed || !Array.isArray(parsed.payments)) return reply(502, { error: "The file was read, but no schedule could be found in it." });
      const payments = parsed.payments.slice(0, 120).map((p) => ({ date: String(p.date || "").slice(0, 10), amount: Math.round(Number(p.amount) * 100) / 100 }))
        .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date) && Number.isFinite(p.amount) && p.amount > 0);
      const payoff = Number(parsed.payoff_amount);
      return reply(200, { payments, payoff_amount: Number.isFinite(payoff) && payoff > 0 ? payoff : null });
    }
    if (mode === "routine") {
      if (!parsed || !Array.isArray(parsed.routines)) return reply(502, { error: "The file was read, but no routine could be found in it. Try a clearer copy." });
      const routines = parsed.routines.slice(0, 12).map((r) => ({
        name: String(r.name || "").trim().slice(0, 60),
        slot: ["morning", "evening", "anytime"].includes(r.slot) ? r.slot : "anytime",
        days: (Array.isArray(r.days) ? r.days : []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).filter((d, i, a) => a.indexOf(d) === i),
        steps: (Array.isArray(r.steps) ? r.steps : []).slice(0, 25)
          .map((st) => ({ text: String(st?.text || "").trim().slice(0, 80), note: String(st?.note || "").trim().slice(0, 120) }))
          .filter((st) => st.text),
      })).filter((r) => r.name && r.steps.length);
      return reply(200, { routines });
    }
    if (mode === "spending") {
      if (!parsed || !Array.isArray(parsed.transactions)) return reply(502, { error: "The file was read, but no transactions could be found. Try again, or try a clearer copy." });
      const CATS = ["Groceries", "Dining", "Transportation", "Utilities", "Housing", "Insurance", "Healthcare", "Personal", "Shopping", "Entertainment", "Travel", "Subscriptions", "Other"];
      const transactions = parsed.transactions.slice(0, 300).map((r) => {
        const amt = Number(r.a);
        return {
          d: /^\d{4}-\d{2}-\d{2}$/.test(String(r.d || "").slice(0, 10)) ? String(r.d).slice(0, 10) : "",
          m: String(r.m || "").trim().slice(0, 60),
          a: Number.isFinite(amt) && amt > 0 ? Math.round(amt * 100) / 100 : null,
          c: CATS.includes(r.c) ? r.c : "Other",
          t: r.t === "skip" ? "skip" : "purchase",
        };
      }).filter((r) => r.m && r.a && r.d);
      return reply(200, { transactions });
    }
    if (mode === "career") {
      if (!parsed || !Array.isArray(parsed.entries)) return reply(502, { error: "The file was read, but the result wasn't usable. Try again, or try a clearer copy." });
      const CK = ["job", "review", "education", "certification", "milestone", "skills"];
      const iso = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(String(d || "").slice(0, 10)) ? String(d).slice(0, 10) : "");
      const strs = (a, n, len) => (Array.isArray(a) ? a : []).map((x) => String(x || "").trim().slice(0, len)).filter(Boolean).slice(0, n);
      let sawCurrent = false;
      const entries = parsed.entries.slice(0, 40).map((it) => {
        const kind = CK.includes(it.kind) ? it.kind : "milestone";
        const sal = Number(it.salary); const rat = Number(it.rating); const scale = Number(it.rating_scale);
        const current = kind === "job" && !!it.current && !sawCurrent;
        if (current) sawCurrent = true;
        return {
          kind,
          title: String(it.title || "").slice(0, 120),
          organization: String(it.organization || "").slice(0, 120),
          start_date: iso(it.start_date),
          end_date: current ? "" : iso(it.end_date),
          current,
          date_uncertain: !!it.date_uncertain,
          highlights: strs(it.highlights, 5, 300),
          skills: strs(it.skills, 30, 60),
          salary: kind === "job" && Number.isFinite(sal) && sal > 0 ? sal : null,
          rating: Number.isFinite(rat) && rat > 0 ? rat : null,
          rating_scale: Number.isFinite(scale) && scale > 0 ? scale : null,
          confidence: Math.max(0, Math.min(1, Number(it.confidence) || 0)),
        };
      }).filter((it) => it.title);
      return reply(200, { entries });
    }
    if (mode === "business") {
      if (!parsed || !Array.isArray(parsed.entries)) return reply(502, { error: "The file was read, but the result wasn't usable. Try again, or try a clearer copy." });
      const entries = parsed.entries.slice(0, 150).map((it) => {
        const amt = Number(it.amount);
        const kind = ["sale", "expense", "skip"].includes(it.kind) ? it.kind : "skip";
        return {
          date: /^\d{4}-\d{2}-\d{2}$/.test(String(it.date || "").slice(0, 10)) ? String(it.date).slice(0, 10) : "",
          name: String(it.name || "").slice(0, 80),
          kind,
          amount: Number.isFinite(amt) && amt > 0 ? Math.round(amt * 100) / 100 : null,
          note: String(it.note || "").slice(0, 120),
          confidence: Math.max(0, Math.min(1, Number(it.confidence) || 0)),
        };
      }).filter((it) => it.name && it.amount);
      return reply(200, { entries });
    }
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
        matches_existing: it.matches_existing ? String(it.matches_existing).slice(0, 80) : null,
        reason: String(it.reason || "").slice(0, 160),
      };
    }).filter((it) => it.name);

    return reply(200, { items });
  } catch (err) {
    console.error("import-finance.js error:", err);
    return reply(500, { error: "Couldn't read that file right now. Try again in a moment." });
  }
};
