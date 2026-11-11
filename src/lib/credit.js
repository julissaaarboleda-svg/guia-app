// Credit assistant: turns the credit documents someone uploads (reports, collector letters,
// breach notices, dispute results, statements) into one picture: what's affecting their credit,
// a next step for each item, a timeline, and progress. Information only, never advice.
// Guía drafts letters; the person reviews, signs and sends them.

export const norm = (s) => String(s || "").toLowerCase().replace(/\b(inc|llc|na|n a|bank|corp|co|the|services|svcs|financial)\b/g, "").replace(/[^a-z0-9]/g, "");
const asDate = (d) => (d ? new Date(`${String(d).length === 7 ? `${d}-01` : d}T12:00:00`) : null);
const addYears = (d, n) => { const x = asDate(d); if (!x) return ""; x.setFullYear(x.getFullYear() + n); return x.toISOString().slice(0, 10); };
const addDays = (d, n) => { const x = asDate(d); if (!x) return ""; x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const today = () => new Date().toISOString().slice(0, 10);
export const money = (n) => (n == null ? "" : `$${Math.round(Number(n)).toLocaleString()}`);
export const niceDate = (d) => {
  const x = asDate(d); if (!x) return "";
  return x.toLocaleDateString("en-US", String(d).length === 7 ? { month: "short", year: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
};
export const DOC_LABEL = {
  credit_report: "Report", collector_letter: "Collector", creditor_letter: "Creditor", breach_notice: "Breach",
  dispute_response: "Response", statement: "Statement", other: "Other",
};
export const accountKey = (a) => `${norm(a.creditor)}|${a.last4 || ""}`;

// Merge the same account across reports and letters.
export function mergeAccounts(docs) {
  const map = {};
  docs.forEach((doc) => (doc.accounts || []).forEach((a) => {
    let k = accountKey(a);
    if (!a.last4) { const hit = Object.keys(map).find((x) => x.startsWith(`${norm(a.creditor)}|`)); if (hit) k = hit; }
    const m = (map[k] = map[k] || { key: k, creditor: a.creditor, sources: [], bureaus: new Set(), late: [] });
    m.sources.push({ docId: doc.id, type: doc.doc_type, date: doc.doc_date, bureau: doc.bureau });
    if (doc.bureau && doc.doc_type === "credit_report") m.bureaus.add(doc.bureau);
    ["original_creditor", "kind", "status", "opened", "last_payment", "first_delinquency", "last4"].forEach((f) => { if (a[f] && !m[f]) m[f] = a[f]; });
    ["balance", "limit", "amount_requested"].forEach((f) => { if (a[f] != null) m[f] = a[f]; });
    if (a.dispute_deadline) m.dispute_deadline = a.dispute_deadline;
    if (doc.doc_type === "collector_letter" || doc.doc_type === "creditor_letter") m.letterDate = doc.doc_date || m.letterDate;
    (a.late || []).forEach((l) => { if (!m.late.some((x) => x.date === l.date)) m.late.push(l); });
  }));
  return Object.values(map).map((m) => ({ ...m, bureaus: [...m.bureaus], late: m.late.sort((x, y) => x.date.localeCompare(y.date)) }));
}

const isCollection = (a) => a.kind === "collection" || a.status === "collection";
const isCard = (a) => a.kind === "credit_card";

// Everything worth acting on, each with its own playbook.
export function analyze(docs, caseRec = {}) {
  const decisions = caseRec.decisions || {};
  const accounts = mergeAccounts(docs);
  const reports = docs.filter((d) => d.doc_type === "credit_report");
  const reportBureaus = [...new Set(reports.map((d) => d.bureau).filter(Boolean))];
  const breach = docs.filter((d) => d.doc_type === "breach_notice" && d.breach_date).sort((a, b) => a.breach_date.localeCompare(b.breach_date))[0] || null;
  const items = [];

  accounts.forEach((a) => {
    const dec = decisions[a.key] || {};
    if (dec.resolved) return;
    const afterBreach = breach && a.opened && a.opened >= breach.breach_date;
    if (afterBreach && dec.owner !== "mine") {
      items.push({ key: a.key, kind: "breach", account: a, breach, owner: dec.owner || null,
        title: `${a.creditor} · opened ${niceDate(a.opened)}`, label: "After the breach",
        detail: `Opened after ${breach.from || "the breach notice"} (${niceDate(breach.breach_date)}). Is this account yours?` });
      if (dec.owner === "not_mine") return;
      if (!dec.owner) return;
    }
    if (isCollection(a)) {
      const dup = a.original_creditor && accounts.some((b) => b !== a && norm(b.creditor) === norm(a.original_creditor) && Number(b.balance) > 0);
      const missing = reportBureaus.length > 1 ? reportBureaus.filter((b) => !a.bureaus.includes(b)) : [];
      const deadline = a.dispute_deadline || (a.letterDate ? addDays(a.letterDate, 30) : "");
      const lastPay = a.last_payment || a.first_delinquency;
      const old = !lastPay || asDate(lastPay) < asDate(addYears(today(), -3));
      items.push({ key: a.key, kind: "collection", account: a, deadline, dup, missing, old,
        falloff: a.first_delinquency ? addYears(a.first_delinquency, 7) : "",
        title: `${a.creditor}${a.amount_requested || a.balance ? ` · ${money(a.amount_requested || a.balance)}` : ""}`,
        label: dup ? "May be counted twice" : "Collection",
        detail: dup ? `Also listed under the original creditor, ${a.original_creditor}, so it may be reported twice.` : `A collection${a.original_creditor ? ` for ${a.original_creditor}` : ""}. Ask for proof before paying anything.` });
      return;
    }
    if (isCard(a) && !/charged|closed|collection/.test(String(a.status || "")) && Number(a.limit) > 0 && Number(a.balance) / Number(a.limit) > 0.3) {
      const pct = Math.round((Number(a.balance) / Number(a.limit)) * 100);
      items.push({ key: a.key, kind: "utilization", account: a, pct, target: Math.round(Number(a.balance) - Number(a.limit) * 0.29),
        title: `${a.creditor} · ${money(a.balance)} of ${money(a.limit)} (${pct}%)`, label: "High balance",
        detail: "How much of your card limits you use is one of the biggest parts of a score." });
    }
    const lates = (a.late || []).filter(Boolean);
    if (lates.length && !isCollection(a)) {
      const last = lates[lates.length - 1];
      items.push({ key: `${a.key}|late`, kind: "late", account: a, falloff: addYears(last.date, 7),
        title: `${a.creditor} · ${lates.length === 1 ? `${last.days || 30} days late · ${niceDate(last.date)}` : `${lates.length} late payments`}`, label: "Late payment",
        detail: lates.length === 1 ? "One late payment. If you've been on time since, a goodwill letter is worth trying." : "Several late payments. Check each is accurate; dispute any that aren't." });
    }
  });

  // Hard inquiries after a breach that the person may not recognize.
  if (breach) {
    docs.flatMap((d) => d.inquiries || []).filter((q) => q.date && q.date >= breach.breach_date).forEach((q) => {
      const key = `inq|${norm(q.creditor)}|${q.date}`;
      const dec = decisions[key] || {};
      if (dec.owner === "mine" || dec.resolved) return;
      items.push({ key, kind: "breach", inquiry: q, breach, owner: dec.owner || null, title: `Inquiry · ${q.creditor} · ${niceDate(q.date)}`, label: "After the breach",
        detail: "A credit check after the breach notice. Did you apply for credit here?" });
    });
  }

  const order = { breach: 0, collection: 1, late: 2, utilization: 3 };
  items.sort((x, y) => order[x.kind] - order[y.kind]);
  return { accounts, items, breach, reportBureaus };
}

// Steps per item. Each step: { id, title, body, letter? }
export function stepsFor(item) {
  if (item.kind === "breach") {
    if (item.owner !== "not_mine") return [];
    return [
      { id: "ftc", title: "File an identity theft report", body: "At IdentityTheft.gov. You get an official report and a recovery plan.", link: "https://www.identitytheft.gov/" },
      { id: "alert", title: "Place a fraud alert or freeze", body: "Both are free. A freeze stops new accounts until you lift it. Contact each bureau to freeze." },
      { id: "block", title: "Ask the bureaus to block it", body: "Send your FTC report, proof of identity and a letter naming the fraudulent items.", letter: "block" },
      { id: "creditor", title: "Tell the company", body: "Let them know the account or inquiry wasn't you, with the same evidence.", letter: "fraud" },
    ];
  }
  if (item.kind === "collection") {
    return [
      { id: "validate", title: "Ask them to prove it", body: item.deadline
        ? `A written request by ${niceDate(item.deadline)} (30 days from their letter) pauses collection until they send proof.`
        : "A written request within 30 days of their first letter pauses collection until they send proof. You can still ask after that.", letter: "validation" },
      { id: "dates", title: "Check the dates", body: `${item.falloff ? `Falls off your report around ${niceDate(item.falloff)}. ` : ""}Check your state's time limit before paying or promising anything.` },
      { id: "dispute", title: "Dispute anything wrong", body: item.dup ? "It looks like it's reported twice. Dispute the duplicate with the bureau."
        : item.missing.length ? `Only on ${item.account.bureaus.join(" and ")}, not ${item.missing.join(" or ")}. Check it's accurate.` : "If the amount, dates or owner are wrong, dispute it with the bureau.", letter: "dispute" },
      { id: "negotiate", title: "Negotiate in writing first", body: "If it's valid: ask for removal in exchange for payment (pay-for-delete) or a settlement, in writing, before paying. They don't have to agree.", letter: "paydelete" },
    ];
  }
  if (item.kind === "utilization") {
    return [
      { id: "pay", title: `Pay it down by about ${money(item.target)}`, body: "Getting under 30% of the limit usually helps the most. Under 10% helps more.", goal: true },
      { id: "limit", title: "Optional: ask for a higher limit", body: "A higher limit lowers the percentage, but it may cause a hard inquiry. Ask first." },
    ];
  }
  if (item.kind === "late") {
    return [
      { id: "check", title: "Check it's accurate", body: "If you paid on time, dispute it with the bureau and include proof.", letter: "dispute" },
      { id: "goodwill", title: "Ask for a goodwill adjustment", body: `If it was a one-off, ask the lender to remove it. Otherwise it falls off around ${niceDate(item.falloff)}.`, letter: "goodwill" },
    ];
  }
  return [];
}

// Letters: templates, filled in with what the documents show. [Brackets] are for the person to fill.
export function letterFor(type, item, ctx = {}) {
  const a = item.account || {};
  const name = a.creditor || item.inquiry?.creditor || "[Company name]";
  const ref = a.last4 ? ` (account ending ${a.last4})` : "";
  const sign = "\n\nSincerely,\n[Your full name]\n[Your mailing address]\n[Date]";
  const bureau = ctx.bureau || (a.bureaus && a.bureaus[0]) || "[Equifax / Experian / TransUnion]";
  switch (type) {
    case "validation":
      return `To: ${name}\n[Collector's mailing address from their letter]\n\nRe: Request for validation${ref}\n\nI received your letter${a.letterDate ? ` dated ${niceDate(a.letterDate)}` : ""} about an alleged debt. I am requesting validation. Please send me:\n\n1. The amount you say is owed and how it was calculated, including interest and fees\n2. The name and address of the original creditor\n3. Proof that you own this debt or are authorized to collect it\n4. A copy of the original agreement or the last statement from the original creditor\n5. The date of the last payment on the account\n\nPlease stop collection activity until you have provided this information. This letter is not an acknowledgment that I owe this debt.${sign}`;
    case "dispute":
      return `To: ${bureau}\n[Bureau dispute address, from the bureau's website]\n\nRe: Dispute of inaccurate information\n\nI am writing to dispute the following item on my credit report:\n\n${name}${ref}${a.amount_requested || a.balance ? `, ${money(a.amount_requested || a.balance)}` : ""}\n\nReason: ${item.dup ? `This debt also appears under the original creditor, ${a.original_creditor}, so it is being reported twice.` : "[Explain what is wrong: amount, dates, status, or that it is not mine]"}\n\nPlease investigate and correct or remove this item. I have enclosed [copies of supporting documents].${sign}`;
    case "goodwill":
      return `To: ${name}\n[Customer service or credit reporting address]\n\nRe: Goodwill adjustment request${ref}\n\nI have been a customer since ${a.opened ? niceDate(a.opened) : "[year]"}. My records show a late payment reported in ${a.late && a.late.length ? niceDate(a.late[a.late.length - 1].date) : "[month and year]"}. [Briefly explain what happened.]\n\nSince then I have paid on time. I would be grateful if you would consider removing this late payment from my credit reports as a goodwill gesture.${sign}`;
    case "paydelete":
      return `To: ${name}\n[Collector's mailing address]\n\nRe: Settlement offer${ref}\n\nThis letter is not an acknowledgment that I owe this debt.\n\nI am willing to pay $[amount] to resolve this account, on the condition that you agree to request deletion of this account from all credit bureaus you report to within [30] days of payment.\n\nIf you agree, please confirm these terms in writing on your letterhead before I make any payment.${sign}`;
    case "block": {
      const items = (ctx.items || [item]).map((it) => `- ${it.account ? `${it.account.creditor}${it.account.last4 ? ` (ending ${it.account.last4})` : ""}${it.account.opened ? `, opened ${niceDate(it.account.opened)}` : ""}` : `Inquiry by ${it.inquiry.creditor} on ${niceDate(it.inquiry.date)}`}`).join("\n");
      return `To: ${bureau}\n[Bureau identity theft address, from the bureau's website]\n\nRe: Block of information resulting from identity theft\n\nI am a victim of identity theft. The items below are on my credit report and are not mine. Please block them and notify the companies that reported them.\n\n${items}\n\nEnclosed:\n- My FTC Identity Theft Report from IdentityTheft.gov\n- Proof of identity [copy of ID] and proof of address [recent bill]\n${item.breach ? `- Data breach notice from ${item.breach.from || "[company]"}, dated ${niceDate(item.breach.breach_date)}\n` : ""}${sign}`;
    }
    case "fraud":
      return `To: ${name}\n[Fraud department address or contact]\n\nRe: Account or inquiry opened without my permission${ref}\n\nI did not open or authorize ${item.inquiry ? `the credit inquiry on ${niceDate(item.inquiry.date)}` : `this account${a.opened ? `, opened ${niceDate(a.opened)}` : ""}`}. I believe it resulted from identity theft${item.breach ? ` after my information was exposed in a data breach reported by ${item.breach.from || "[company]"} on ${niceDate(item.breach.breach_date)}` : ""}.\n\nPlease close it, remove my name from it, stop reporting it to the credit bureaus, and confirm in writing. I have enclosed my FTC Identity Theft Report.${sign}`;
    default: return "";
  }
}
export const LETTER_TITLE = { validation: "Ask them to prove the debt", dispute: "Dispute with the bureau", goodwill: "Goodwill request", paydelete: "Pay-for-delete offer", block: "Identity theft block", fraud: "Not mine: tell the company" };

// One timeline from every document plus what the person has done.
export function timeline(docs, caseRec = {}) {
  const ev = [];
  docs.forEach((d) => {
    if (d.doc_type === "breach_notice") ev.push({ date: d.breach_date || d.doc_date, tone: "bad", text: `${d.from || "A company"} says your data was exposed${d.breach_what ? ` (${d.breach_what})` : ""}.` });
    else if (d.doc_type === "collector_letter" || d.doc_type === "creditor_letter") (d.accounts || []).forEach((a) => ev.push({ date: d.doc_date, tone: "warn", text: `${a.creditor} asks for ${money(a.amount_requested || a.balance) || "payment"}.` }));
    else if (d.doc_type === "dispute_response") (d.results || []).forEach((r) => ev.push({ date: d.doc_date, tone: r.outcome === "deleted" || r.outcome === "updated" ? "good" : "info", text: `${d.from || "Bureau"}: ${r.creditor} ${r.outcome}${r.note ? `. ${r.note}` : ""}.` }));
    else if (d.doc_type === "credit_report") ev.push({ date: d.doc_date, tone: "info", text: `${d.bureau || "Credit"} report${d.score ? ` · score ${d.score}` : ""}.` });
  });
  mergeAccounts(docs).forEach((a) => {
    (a.late || []).forEach((l) => ev.push({ date: l.date, tone: "warn", text: `${a.creditor}: ${l.days || 30} days late.` }));
    if (isCollection(a) && a.first_delinquency) ev.push({ date: a.first_delinquency, tone: "warn", text: `${a.creditor} first went late.` });
  });
  Object.values(caseRec.decisions || {}).forEach((dec) => (dec.sent || []).forEach((s) => ev.push({ date: s.date, tone: "info", text: `You sent: ${LETTER_TITLE[s.type] || s.type} (${s.to}).` })));
  return ev.filter((e) => e.date).sort((a, b) => b.date.localeCompare(a.date));
}

export function progress(docs, caseRec = {}) {
  const scores = [
    ...docs.filter((d) => d.score && d.doc_date).map((d) => ({ date: d.doc_date, score: d.score, bureau: d.bureau })),
    ...(caseRec.scores || []),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const wins = [
    ...docs.filter((d) => d.doc_type === "dispute_response").flatMap((d) => (d.results || []).filter((r) => r.outcome === "deleted" || r.outcome === "updated").map((r) => ({ date: d.doc_date, text: `${r.creditor} ${r.outcome === "deleted" ? "removed" : "corrected"}` }))),
    ...Object.entries(caseRec.decisions || {}).filter(([, v]) => v.resolved).map(([, v]) => ({ date: v.resolved.date, text: v.resolved.text })),
  ].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const now = today();
  const coming = [];
  mergeAccounts(docs).forEach((a) => {
    const base = isCollection(a) ? a.first_delinquency : (a.late && a.late.length ? a.late[a.late.length - 1].date : "");
    const f = base ? addYears(base, 7) : "";
    if (f && f > now) coming.push({ date: f, text: `${a.creditor} ${isCollection(a) ? "collection" : "late payment"} falls off` });
  });
  coming.sort((a, b) => a.date.localeCompare(b.date));
  const checkBacks = Object.values(caseRec.decisions || {}).flatMap((v) => (v.sent || []).map((s) => ({ ...s, due: addDays(s.date, 30) }))).filter((s) => s.due >= now).sort((a, b) => a.due.localeCompare(b.due));
  return { scores, wins, coming, checkBacks };
}

// ---------- After a letter is sent: replies, no-reply follow-ups ----------
export const CFPB = "https://www.consumerfinance.gov/complaint/";
export const REPLY_WAIT_DAYS = 30;
export const sentDue = (s) => addDays(s.date, REPLY_WAIT_DAYS);
export const isOverdue = (s) => !s.reply && sentDue(s) < today();

// What they might say back, per letter.
export const OUTCOMES = {
  validation: [["proof", "Sent proof"], ["no_proof", "Replied, no real proof"], ["stopped", "Dropped it / removed"]],
  dispute: [["deleted", "Removed"], ["updated", "Corrected"], ["verified", "Said it's accurate"]],
  goodwill: [["deleted", "Removed it"], ["declined", "Said no"]],
  paydelete: [["accepted", "Agreed in writing"], ["countered", "Made a counteroffer"], ["declined", "Said no"]],
  block: [["deleted", "Blocked / removed"], ["declined", "Refused"]],
  fraud: [["deleted", "Closed / removed"], ["declined", "Refused"]],
  followup: [["deleted", "Removed"], ["declined", "Refused"]],
  unverified: [["deleted", "Removed"], ["verified", "Said it's accurate"]],
  mov: [["deleted", "Removed"], ["verified", "Explained how they checked"]],
};
export const WIN = new Set(["deleted", "updated", "stopped"]);

// Steps when the 30 days pass with no answer.
export function noReplySteps(s) {
  const follow = { id: "nr-follow", title: "Send a follow-up", body: `Point to your ${niceDate(s.date)} letter and ask for an answer. Keep a copy.`, letter: "followup" };
  const cfpb = { id: "nr-cfpb", title: "File a complaint with the CFPB", body: "Free, online. Companies usually answer within 15 days.", link: CFPB };
  switch (s.type) {
    case "validation": return [
      { id: "nr-hold", title: "Don't pay yet", body: "They shouldn't keep collecting until they send proof. Write down any calls or letters you get meanwhile." },
      { id: "nr-unver", title: "Dispute it with the bureaus as unverified", body: "If it's on your report, tell the bureaus the collector didn't validate it.", letter: "unverified" },
      cfpb,
    ];
    case "dispute": return [follow, cfpb];
    case "block": return [{ ...follow, body: "Once a bureau accepts a block request it should act within a few business days. Follow up with your FTC report attached." }, cfpb];
    case "fraud": return [follow, cfpb];
    case "goodwill": return [{ ...follow, body: "Try once more, ideally to a different department or the executive office." }, { id: "nr-wait", title: "Or let it age", body: "Late payments matter less over time, and on-time months keep helping." }];
    case "paydelete": return [{ ...follow, body: "Repeat your offer, or adjust the amount. Still get it in writing before paying." }];
    default: return [cfpb];
  }
}

// Steps after they answer.
export function replySteps(s) {
  const o = s.reply && s.reply.outcome;
  const cfpb = { id: "r-cfpb", title: "File a complaint with the CFPB", body: "If you believe the response is wrong.", link: CFPB };
  if (WIN.has(o)) return [{ id: "r-check", title: "Check your reports in 30–60 days", body: "Make sure it changed on every bureau. Keep their letter." }];
  if (s.type === "validation" && o === "proof") return [
    { id: "r-review", title: "Check what they sent", body: "Does the amount, original creditor and account match? Anything wrong is worth disputing." },
    { id: "r-dates", title: "Check the dates before paying", body: "If it's an older debt, check your state's time limit first." },
    { id: "r-neg", title: "Negotiate in writing", body: "Offer pay-for-delete or a settlement, confirmed in writing before you pay.", letter: "paydelete" },
  ];
  if (s.type === "validation" && o === "no_proof") return [
    { id: "r-unver", title: "Dispute it with the bureaus as unverified", body: "A letter without the original agreement or a statement isn't real proof.", letter: "unverified" },
    { id: "r-follow", title: "Ask again for full proof", body: "Repeat what you asked for.", letter: "followup" }, cfpb,
  ];
  if (o === "verified") return [
    { id: "r-mov", title: "Ask how they checked", body: "You can ask the bureau how it verified the item and who it contacted.", letter: "mov" },
    { id: "r-evid", title: "Dispute again with new evidence", body: "Only if you have proof it's wrong: statements, letters, receipts.", letter: "dispute" }, cfpb,
  ];
  if (s.type === "paydelete" && o === "accepted") return [
    { id: "r-pay", title: "Pay exactly as agreed", body: "Use a traceable method, never give ongoing access to your bank account. Keep their written agreement." },
    { id: "r-check", title: "Check your reports in 30–60 days", body: "If it's still there, send them their own agreement." },
  ];
  if (s.type === "paydelete" && o === "countered") return [{ id: "r-decide", title: "Decide on their counter", body: "Agree only in writing, with deletion included. You can counter again.", letter: "paydelete" }];
  if (o === "declined") return [
    ...(s.type === "paydelete" ? [{ id: "r-settle", title: "Ask for a settlement instead", body: "Paid for less, reported as settled. Still get it in writing.", letter: "paydelete" }] : []),
    { id: "r-later", title: "Try again later", body: "A different person or department may say yes." }, ...(s.type === "block" || s.type === "fraud" ? [cfpb] : []),
  ];
  return [];
}

export function followUpLetter(type, item, s) {
  const a = item.account || {};
  const name = a.creditor || item.inquiry?.creditor || "[Company name]";
  const ref = a.last4 ? ` (account ending ${a.last4})` : "";
  const sign = "\n\nSincerely,\n[Your full name]\n[Your mailing address]\n[Date]";
  const bureau = (a.bureaus && a.bureaus[0]) || "[Equifax / Experian / TransUnion]";
  if (type === "followup") {
    return `To: ${s?.to || name}\n[Mailing address]\n\nRe: Second request${ref}\n\nOn ${s ? niceDate(s.date) : "[date]"}, I sent you a letter (${s ? LETTER_TITLE[s.type] || "request" : "request"}). A copy is enclosed. I have not received a response.\n\nPlease respond in writing within 15 days. If I do not hear from you, I will file a complaint with the Consumer Financial Protection Bureau.${sign}`;
  }
  if (type === "unverified") {
    return `To: ${bureau}\n[Bureau dispute address, from the bureau's website]\n\nRe: Dispute of unverified collection account\n\nThe following collection account is on my credit report:\n\n${name}${ref}${a.amount_requested || a.balance ? `, ${money(a.amount_requested || a.balance)}` : ""}\n\nOn ${s ? niceDate(s.date) : "[date]"}, I asked the collector to validate this debt. ${s?.reply ? "Their response did not include proof that I owe it." : "They have not responded."} Copies of my request${s?.reply ? " and their response" : ""} are enclosed.\n\nPlease investigate and remove this unverified account.${sign}`;
  }
  if (type === "mov") {
    return `To: ${bureau}\n[Bureau dispute address]\n\nRe: Request for method of verification${ref}\n\nI disputed ${name} on ${s ? niceDate(s.date) : "[date]"}, and you responded that it was verified.\n\nPlease tell me how you verified this information, including the name, address and phone number of anyone you contacted.${sign}`;
  }
  return letterFor(type, item);
}
LETTER_TITLE.followup = "Second request";
LETTER_TITLE.unverified = "Dispute: not validated";
LETTER_TITLE.mov = "Ask how they verified it";

// Deadlines worth a heads-up a week before (e.g. the 30-day window to ask a collector for proof).
export function deadlineNudges(items, caseRec = {}) {
  const nudged = new Set(caseRec.nudged || []);
  const now = today();
  return items.filter((i) => i.deadline && i.deadline >= now && !nudged.has(`${i.key}|${i.deadline}`)).map((i) => {
    const wk = addDays(i.deadline, -7);
    return { id: `${i.key}|${i.deadline}`, item: i, due: wk > now ? wk : now };
  });
}
