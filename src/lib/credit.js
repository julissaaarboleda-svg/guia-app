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
// "CAPITAL ONE BANK USA NA" → "Capital One Bank USA NA". Reports print names in capitals; this reads easier.
const KEEP_UPPER = new Set(["USA", "NA", "LLC", "N.A.", "FSB", "TD", "BMO", "PNC", "HSBC", "USAA", "GM", "BB&T", "CB", "AR", "ATT", "AT&T", "US", "TX", "CA", "FL", "NY", "II", "III"]);
export function prettyName(name) {
  const s = String(name || "").trim();
  if (!s || /[a-z]/.test(s)) return s; // already mixed case
  return s.split(/(\s+|\/|-)/).map((w) => {
    if (!w.trim() || w === "/" || w === "-") return w;
    if (KEEP_UPPER.has(w.replace(/[,.]$/, ""))) return w;
    if (/^(INC|CO|CORP|LTD)[,.]?$/.test(w)) return w.charAt(0) + w.slice(1).toLowerCase();
    return w.charAt(0) + w.slice(1).toLowerCase();
  }).join("");
}

export const accountKey = (a) => `${norm(a.creditor)}|${a.last4 || ""}`;

// Merge the same account across reports and letters.
export function mergeAccounts(docs) {
  const map = {};
  // Reports first: they carry account numbers, so letters without one can attach to them.
  const ordered = [...docs].sort((x, y) => (x.doc_type === "credit_report" ? 0 : 1) - (y.doc_type === "credit_report" ? 0 : 1));
  ordered.forEach((doc) => (doc.accounts || []).forEach((a) => {
    let k = accountKey(a);
    if (!a.last4) {
      // A letter often has no account number: match it to an account from the same company.
      const n = norm(a.creditor);
      // Several accounts can share a lender's name (two Capital One cards and a Capital One auto loan),
      // so pick the closest name, preferring the same kind of account.
      const exact = Object.keys(map).filter((x) => x.startsWith(`${n}|`));
      const pool = exact.length ? exact : (n.length >= 5 ? Object.keys(map).filter((x) => { const xn = x.split("|")[0]; return xn.length >= 5 && (xn.startsWith(n) || n.startsWith(xn)); }) : []);
      const score = (x) => (a.kind && map[x].kind === a.kind ? 1000 : 0) - Math.abs(x.split("|")[0].length - n.length);
      const hit = pool.sort((x, y) => score(y) - score(x))[0];
      if (hit) k = hit;
    }
    const m = (map[k] = map[k] || { key: k, creditor: prettyName(a.creditor), sources: [], bureaus: new Set(), late: [] });
    m.sources.push({ docId: doc.id, type: doc.doc_type, date: doc.doc_date, bureau: doc.bureau, from: doc.from, status: a.status || "", balance: a.balance == null ? null : Number(a.balance) });
    if (doc.bureau && doc.doc_type === "credit_report") m.bureaus.add(doc.bureau);
    ["original_creditor", "kind", "status", "opened", "last_payment", "first_delinquency", "last4", "address"].forEach((f) => { if (a[f] && !m[f]) m[f] = f === "original_creditor" ? prettyName(a[f]) : a[f]; });
    ["balance", "limit", "amount_requested", "past_due", "days_past_due"].forEach((f) => { if (a[f] != null) m[f] = a[f]; });
    if (a.dispute_deadline) m.dispute_deadline = a.dispute_deadline;
    if (doc.doc_type === "collector_letter" || doc.doc_type === "creditor_letter") {
      m.letterDate = doc.doc_date || m.letterDate;
      if (doc.from_address) m.address = doc.from_address; // the letter's own return address is the best place to write
    }
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
    // A letter or statement says it's paid, but a report still shows a balance or a charge-off.
    const paidProof = a.sources.filter((x) => x.type !== "credit_report" && (x.status === "paid" || x.status === "closed" && x.balance === 0 || x.balance === 0))
      .sort((x, y) => String(y.date).localeCompare(String(x.date)))[0];
    const badReport = paidProof && a.sources.find((x) => x.type === "credit_report" && (x.status === "charged_off" || x.status === "collection" || Number(x.balance) > 0));
    const mdec = decisions[`${a.key}|paid`] || {};
    if (badReport && !mdec.resolved) {
      items.push({ key: `${a.key}|paid`, kind: "mismatch", account: a, paidProof, badReport, when: mdec.paidWhen || null,
        title: `${a.creditor} · report doesn't match your letter`, label: "Doesn't match",
        detail: `${paidProof.from || "Your letter"}${paidProof.date ? ` (${niceDate(paidProof.date)})` : ""} says it's paid, but ${badReport.bureau || "a report"} shows ${badReport.status === "charged_off" ? "charged off" : badReport.status === "collection" ? "a collection" : ""}${Number(badReport.balance) > 0 ? `${badReport.status === "charged_off" || badReport.status === "collection" ? " with " : ""}a ${money(badReport.balance)} balance` : ""}.` });
    }
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
      // Another collection agency reporting the exact same amount is often the same debt under a second name.
      const amt = Number(a.amount_requested || a.balance) || 0;
      const twin = !dup && amt > 0 ? accounts.find((b) => b !== a && isCollection(b) && norm(b.creditor) !== norm(a.creditor) && Number(b.amount_requested || b.balance) === amt) : null;
      const missing = reportBureaus.length > 1 ? reportBureaus.filter((b) => !a.bureaus.includes(b)) : [];
      const deadline = a.dispute_deadline || (a.letterDate ? addDays(a.letterDate, 30) : "");
      const lastPay = a.last_payment || a.first_delinquency;
      const old = !lastPay || asDate(lastPay) < asDate(addYears(today(), -3));
      items.push({ key: a.key, kind: "collection", account: a, deadline, dup, missing, old,
        falloff: a.first_delinquency ? addYears(a.first_delinquency, 7) : "",
        title: `${a.creditor}${a.amount_requested || a.balance ? ` · ${money(a.amount_requested || a.balance)}` : ""}`,
        twin: twin ? twin.creditor : null,
        label: twin ? "May be counted twice" : "Collection",
        detail: dup ? `A collection for ${a.original_creditor}, which still shows a balance too. See "Sold, still owed". Ask the collector for proof before paying.`
          : twin ? `Same amount as the ${twin.creditor} collection (${money(amt)}). Agencies sometimes report one debt under two names. Compare the original creditor and dates.`
          : `A collection${a.original_creditor ? ` for ${a.original_creditor}` : ""}. Ask for proof before paying anything.` });
      return;
    }
    const inactive = /charged|closed|collection|sold|paid/.test(String(a.status || ""));
    // Past due right now: the thing that keeps adding new late marks every month.
    if (!inactive && (Number(a.past_due) > 0 || Number(a.days_past_due) > 0)) {
      const pd = Number(a.past_due) || 0, days = Number(a.days_past_due) || 0;
      items.push({ key: `${a.key}|pastdue`, kind: "pastdue", account: a, pastDue: pd, days,
        title: `${a.creditor} · ${pd ? `${money(pd)} past due` : "past due, amount not shown"}${days ? ` · ${days} days` : ""}`, label: "Past due",
        detail: "Past due right now. Each month it stays late can add a new late mark, and long-late accounts can be charged off." });
    }
    // Over the limit: worse than just high usage, and can bring fees.
    if (isCard(a) && !inactive && Number(a.limit) > 0 && Number(a.balance) > Number(a.limit)) {
      const lim = Number(a.limit), bal = Number(a.balance);
      items.push({ key: a.key, kind: "overlimit", account: a, pct: Math.round((bal / lim) * 100), toLimit: Math.ceil(bal - lim), target: Math.round(bal - lim * 0.29),
        title: `${a.creditor}${a.last4 ? ` ${a.last4}` : ""} · ${money(bal)} of ${money(lim)}`, label: "Over limit",
        detail: "Over the limit. Getting under it first can avoid fees; then aim for under 30%." });
    } else if (isCard(a) && !/charged|closed|collection/.test(String(a.status || "")) && Number(a.limit) > 0 && Number(a.balance) / Number(a.limit) > 0.3) {
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
      items.push({ key, kind: "breach", inquiry: q, breach, owner: dec.owner || null, title: `Inquiry · ${prettyName(q.creditor)} · ${niceDate(q.date)}`, label: "After the breach",
        detail: "A credit check after the breach notice. Did you apply for credit here?" });
    });
  }

  // Sold, still owed: the original lender still shows a balance after the debt went to a collector.
  const soldSeen = new Set();
  accounts.forEach((b) => {
    if (isCollection(b) || !(Number(b.balance) > 0) || /paid/.test(String(b.status || ""))) return;
    const buyer = b.status === "sold" ? null : accounts.find((c) => isCollection(c) && c.original_creditor && (norm(c.original_creditor) === norm(b.creditor) || (norm(c.original_creditor).length >= 5 && norm(b.creditor).startsWith(norm(c.original_creditor)))));
    if (b.status !== "sold" && !buyer) return;
    const key = `${b.key}|sold`;
    if (soldSeen.has(key) || (decisions[key] || {}).resolved) return;
    soldSeen.add(key);
    items.push({ key, kind: "sold", account: b, buyer: buyer ? buyer.creditor : "",
      title: `${b.creditor} · ${money(b.balance)}${b.bureaus.length ? ` on ${b.bureaus.join(", ")}` : ""}`, label: "Sold, still owed",
      detail: `${buyer ? `This debt went to ${buyer.creditor}, but ` : "This account was sold or transferred, but "}${b.creditor} still reports a ${money(b.balance)} balance. After a sale it should show $0, or the same debt counts twice.` });
  });

  // Your info: a once-over of names and addresses on each report.
  if (reports.length && !(decisions["info|review"] || {}).resolved) {
    items.push({ key: "info|review", kind: "info", account: null, title: "Check the names and addresses on each report", label: "Your info",
      detail: "Misspelled names, addresses you never lived at, or employers you don't recognize can mix someone else's records into yours, or point to identity theft." });
  }

  const order = { mismatch: 0, breach: 1, pastdue: 2, overlimit: 3, collection: 4, utilization: 5, sold: 6, late: 7, info: 8 };
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
  if (item.kind === "mismatch") {
    const before = item.when === "before";
    return [
      { id: "compare", title: "Check the dates", body: "Compare your payoff date with the charge-off date on the report. Pick below which happened first." },
      { id: "bureau", title: before ? "Dispute the charge-off" : "Ask the bureau to show $0 and paid",
        body: before ? "If you paid before it was charged off, the charge-off is wrong. Send the bureau your payoff letter and ask for it to show paid as agreed."
          : "A charge-off paid afterward can stay on the report, but it should show a $0 balance and paid. Send your payoff letter and ask them to update it.", letter: "paidmismatch" },
      { id: "lender", tips: [{ ok: true, text: "send a copy of the payoff letter and keep the original" }], title: "Ask the lender to correct what it reports", body: "Lenders report to the bureaus, so ask them to send the update too. Attach the same letter.", letter: "lenderupdate" },
      { id: "recheck", title: "Check your reports in 30–45 days", body: "Upload the new report or the bureau's answer here to see if it changed." },
    ];
  }
  if (item.kind === "collection") {
    return [
      { id: "validate", title: "Ask them to prove it", tips: [{ ok: false, text: "send your SSN or ID to a collector. They already have what they need to find the account." }], body: item.deadline
        ? `A written request by ${niceDate(item.deadline)} (30 days from their letter) pauses collection until they send proof.`
        : "A written request within 30 days of their first letter pauses collection until they send proof. You can still ask after that.", letter: "validation" },
      { id: "dates", title: "Check the dates", body: `${item.falloff ? `Falls off your report around ${niceDate(item.falloff)}. ` : ""}Check your state's time limit before paying or promising anything.`,
        tips: [{ ok: false, text: "say \"I'll pay\" or make a small payment on an old debt before you've checked. In many states it can restart the clock." }] },
      { id: "dispute", title: "Dispute anything wrong", body: item.dup || item.twin ? "If it's the same debt as the other listing, dispute the duplicate with the bureau. Only dispute it if you've checked it's a repeat."
        : item.missing.length ? `Only on ${item.account.bureaus.join(" and ")}, not ${item.missing.join(" or ")}. Check it's accurate.` : "If the amount, dates or owner are wrong, dispute it with the bureau.", letter: "dispute" },
      { id: "negotiate", title: "Negotiate in writing first", body: "If it's valid: ask for removal in exchange for payment (pay-for-delete) or a settlement, in writing, before paying. They don't have to agree.", letter: "paydelete",
        tips: [{ ok: true, text: "pay with a one-time card payment or a money order, and keep the receipt" }, { ok: false, text: "give them access to your bank account" }, { ok: false, text: "agree to anything over the phone. Ask for it in writing." }] },
    ];
  }
  if (item.kind === "pastdue") {
    return [
      { id: "catchup", title: item.pastDue ? `Pay the ${money(item.pastDue)} past due` : "Pay the past-due amount", body: "Bringing it current (paying what's past due, not the whole balance) stops new late marks from being added.",
        tips: [{ ok: true, text: "turn on autopay for at least the minimum once it's current" }, { ok: false, text: "skip it hoping it drops off. Each month late is reported again." }] },
      { id: "hardship", title: "Can't pay it all? Call and ask", body: "Many lenders offer a hardship plan, a lower payment or a new due date. Ask them to confirm any arrangement in writing." },
      { id: "goodwilllater", title: "Later: ask for a goodwill adjustment", body: "Once you've been on time for a few months, a goodwill letter can ask them to remove the late marks.", letter: "goodwill" },
    ];
  }
  if (item.kind === "overlimit") {
    return [
      { id: "underlimit", title: `Pay about ${money(item.toLimit)} to get under the limit`, body: "Over-limit balances can bring fees and look worse than high usage.", goal: true },
      { id: "under30", title: `Then about ${money(item.target)} more to get under 30%`, body: "Under 30% of the limit usually helps the most. Under 10% helps more." },
    ];
  }
  if (item.kind === "sold") {
    return [
      { id: "soldcheck", title: "Check it matches the collection", body: item.buyer ? `Compare the amount and dates with the ${item.buyer} collection.` : "Look for the collector that bought it on your report." },
      { id: "solddispute", title: "Ask the bureau to show $0", body: "A sold or transferred account should show a $0 balance with the lender that sold it.", letter: "soldzero" },
    ];
  }
  if (item.kind === "info") {
    return [
      { id: "inforead", title: "Read the personal information section", body: "On each report, check name spellings, addresses, employers and dates of birth." },
      { id: "infodispute", title: "Ask each bureau to remove what's wrong", body: "Only list what's actually wrong. Keep your current address and any you really lived at.", letter: "infofix",
        tips: [{ ok: false, text: "ask them to remove your current address or a name you really use" }] },
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
// ---------- Addresses ----------
// Standard dispute addresses, used when a report doesn't print its own. They change from time to time.
export const BUREAU_ADDR = {
  Equifax: "Equifax Information Services LLC\nP.O. Box 740256\nAtlanta, GA 30374-0256",
  Experian: "Experian\nP.O. Box 4500\nAllen, TX 75013",
  TransUnion: "TransUnion LLC Consumer Dispute Center\nP.O. Box 2000\nChester, PA 19016",
};
export const BUREAUS = ["Equifax", "Experian", "TransUnion"];
export const BUREAU_SHORT = { Equifax: "EQ", Experian: "EX", TransUnion: "TU" };
export const bureauKey = (b) => (/equifax/i.test(b) ? "Equifax" : /experian/i.test(b) ? "Experian" : /trans\s*union/i.test(b) ? "TransUnion" : "");
export function bureauAddress(b, docs = []) {
  const k = bureauKey(b || "");
  if (!k) return null;
  const rep = docs.find((d) => d.doc_type === "credit_report" && bureauKey(d.bureau || "") === k && d.dispute_address);
  if (rep) {
    const lines = rep.dispute_address.split(/,\s*(?=(?:P\.?O\.?|\d|[A-Z][a-z]+,?\s+[A-Z]{2}\b))/).join("\n");
    return { text: new RegExp(k, "i").test(lines) ? lines : `${k}\n${lines}`, source: "report" };
  }
  return { text: BUREAU_ADDR[k], source: "standard" };
}
const toBureau = (b, ctx) => { const ad = bureauAddress(b, ctx.docs); return `To: ${ad ? ad.text : `${b}\n[Bureau dispute address]`}`; };
const toCompany = (a, name) => `To: ${name}\n${a.address ? a.address.replace(/,\s*(?=[A-Z][a-z]+,?\s+[A-Z]{2}\s+\d{5})/, "\n") : "[Mailing address from their letter]"}`;
const longToday = () => new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const signOff = (sender) => `\n\nSincerely,\n${(sender && sender.name) || "[Your full name]"}\n${(sender && sender.address) || "[Your mailing address]"}\n${longToday()}`;
// Letters that go to a credit bureau: one per bureau that shows the item.
export const BUREAU_LETTERS = new Set(["dispute", "paidmismatch", "unverified", "mov", "block", "soldzero", "infofix"]);

export function letterFor(type, item, ctx = {}) {
  const a = item.account || {};
  const name = a.creditor || item.inquiry?.creditor || "[Company name]";
  const ref = a.last4 ? ` (account ending ${a.last4})` : "";
  const sign = signOff(ctx.sender);
  const bureau = ctx.bureau || (a.bureaus && a.bureaus[0]) || "[Equifax / Experian / TransUnion]";
  switch (type) {
    case "validation":
      return `${toCompany(a, name)}\n\nRe: Request for validation${ref}\n\nI received your letter${a.letterDate ? ` dated ${niceDate(a.letterDate)}` : ""} about an alleged debt. I am requesting validation. Please send me:\n\n1. The amount you say is owed and how it was calculated, including interest and fees\n2. The name and address of the original creditor\n3. Proof that you own this debt or are authorized to collect it\n4. A copy of the original agreement or the last statement from the original creditor\n5. The date of the last payment on the account\n\nPlease stop collection activity until you have provided this information. This letter is not an acknowledgment that I owe this debt.${sign}`;
    case "dispute":
      return `${toBureau(bureau, ctx)}\n\nRe: Dispute of inaccurate information\n\nI am writing to dispute the following item on my credit report:\n\n${name}${ref}${a.amount_requested || a.balance ? `, ${money(a.amount_requested || a.balance)}` : ""}\n\nReason: ${item.dup ? `This debt also appears under the original creditor, ${a.original_creditor}, so it is being reported twice.` : item.twin ? `This appears to be the same debt as the ${item.twin} collection for the same amount, so it is being reported twice. [Add what matches: original creditor, dates.]` : "[Explain what is wrong: amount, dates, status, or that it is not mine]"}\n\nPlease investigate and correct or remove this item. I have enclosed [copies of supporting documents].${sign}`;
    case "paidmismatch": {
      const p = item.paidProof || {};
      const before = item.when === "before";
      return `${toBureau(ctx.bureau || (item.badReport && item.badReport.bureau) || bureau, ctx)}\n\nRe: Dispute of inaccurate account status${ref}\n\nThe following account on my credit report is reported inaccurately:\n\n${name}${ref}\n\nYour report shows ${item.badReport && item.badReport.status === "charged_off" ? "a charge-off" : "an unpaid status"}${item.badReport && Number(item.badReport.balance) > 0 ? ` with a balance of ${money(item.badReport.balance)}` : ""}. ${p.from || "The lender"} confirmed in writing${p.date ? ` on ${niceDate(p.date)}` : ""} that this account is paid in full. A copy of that letter is enclosed.\n\n${before ? "I paid this account in full before it was charged off, so the charge-off is inaccurate. Please update the account to show it as paid as agreed with a $0 balance." : "Please update this account to show a $0 balance and a paid status."}${sign}`;
    }
    case "lenderupdate": {
      const p = item.paidProof || {};
      return `${toCompany(a, name)}\n\nRe: Correct credit reporting${ref}\n\nYour letter${p.date ? ` dated ${niceDate(p.date)}` : ""} confirms this account is paid in full (copy enclosed). However, the credit bureaus still show ${item.badReport && Number(item.badReport.balance) > 0 ? `a balance of ${money(item.badReport.balance)}` : "it as unpaid"}${item.badReport && item.badReport.status === "charged_off" ? " and a charge-off" : ""}.\n\nPlease update what you report to all three credit bureaus to show a $0 balance and paid${item.when === "before" ? " as agreed" : ""}, and confirm in writing when it's done.${sign}`;
    }
    case "soldzero":
      return `${toBureau(bureau, ctx)}\n\nRe: Dispute of inaccurate balance${ref}\n\nThe following account is reported with a balance that should be $0:\n\n${name}${ref}, reported balance ${money(a.balance)}\n\n${item.buyer ? `This debt was sold or transferred to ${item.buyer}, which now reports it as a collection.` : "This account was sold or transferred to another company."} Because ${name} no longer owns this debt, reporting a balance counts the same debt twice. Please update ${name}'s account to show a $0 balance and that it was sold or transferred.${sign}`;
    case "infofix":
      return `${toBureau(bureau, ctx)}\n\nRe: Correct my personal information\n\nPlease remove the following information from my credit file because it is not mine or is out of date:\n\n- Names: [list the misspelled names exactly as shown]\n- Addresses: [list addresses you never lived at]\n- Employers: [list any you don't recognize]\n\nMy correct name and current address are shown below. I have enclosed a copy of my ID and proof of address.${sign}`;
    case "goodwill":
      return `${toCompany(a, name)}\n\nRe: Goodwill adjustment request${ref}\n\nI have been a customer since ${a.opened ? niceDate(a.opened) : "[year]"}. My records show a late payment reported in ${a.late && a.late.length ? niceDate(a.late[a.late.length - 1].date) : "[month and year]"}. [Briefly explain what happened.]\n\nSince then I have paid on time. I would be grateful if you would consider removing this late payment from my credit reports as a goodwill gesture.${sign}`;
    case "paydelete":
      return `${toCompany(a, name)}\n\nRe: Settlement offer${ref}\n\nThis letter is not an acknowledgment that I owe this debt.\n\nI am willing to pay $[amount] to resolve this account, on the condition that you agree to request deletion of this account from all credit bureaus you report to within [30] days of payment.\n\nIf you agree, please confirm these terms in writing on your letterhead before I make any payment.${sign}`;
    case "block": {
      const items = (ctx.items || [item]).map((it) => `- ${it.account ? `${it.account.creditor}${it.account.last4 ? ` (ending ${it.account.last4})` : ""}${it.account.opened ? `, opened ${niceDate(it.account.opened)}` : ""}` : `Inquiry by ${it.inquiry.creditor} on ${niceDate(it.inquiry.date)}`}`).join("\n");
      return `${toBureau(bureau, ctx)}\n\nRe: Block of information resulting from identity theft\n\nI am a victim of identity theft. The items below are on my credit report and are not mine. Please block them and notify the companies that reported them.\n\n${items}\n\nEnclosed:\n- My FTC Identity Theft Report from IdentityTheft.gov\n- Proof of identity [copy of ID] and proof of address [recent bill]\n${item.breach ? `- Data breach notice from ${item.breach.from || "[company]"}, dated ${niceDate(item.breach.breach_date)}\n` : ""}${sign}`;
    }
    case "fraud":
      return `${toCompany(a, name)}\n\nRe: Account or inquiry opened without my permission${ref}\n\nI did not open or authorize ${item.inquiry ? `the credit inquiry on ${niceDate(item.inquiry.date)}` : `this account${a.opened ? `, opened ${niceDate(a.opened)}` : ""}`}. I believe it resulted from identity theft${item.breach ? ` after my information was exposed in a data breach reported by ${item.breach.from || "[company]"} on ${niceDate(item.breach.breach_date)}` : ""}.\n\nPlease close it, remove my name from it, stop reporting it to the credit bureaus, and confirm in writing. I have enclosed my FTC Identity Theft Report.${sign}`;
    default: return "";
  }
}
export const LETTER_TITLE = { soldzero: "Dispute: sold debt should show $0", infofix: "Correct my personal information", paidmismatch: "Dispute: paid but shows unpaid", lenderupdate: "Ask the lender to correct it", validation: "Ask them to prove the debt", dispute: "Dispute with the bureau", goodwill: "Goodwill request", paydelete: "Pay-for-delete offer", block: "Identity theft block", fraud: "Not mine: tell the company" };

// One timeline from every document plus what the person has done.
export function timeline(docs, caseRec = {}) {
  const ev = [];
  docs.forEach((d) => {
    if (d.doc_type === "breach_notice") ev.push({ date: d.breach_date || d.doc_date, tone: "bad", text: `${d.from || "A company"} says your data was exposed${d.breach_what ? ` (${d.breach_what})` : ""}.` });
    else if (d.doc_type === "collector_letter" || d.doc_type === "creditor_letter") (d.accounts || []).forEach((a) => ev.push({ date: d.doc_date, tone: a.status === "paid" ? "good" : "warn", text: a.status === "paid" ? `${prettyName(a.creditor)} confirms it's paid.` : `${prettyName(a.creditor)} asks for ${money(a.amount_requested || a.balance) || "payment"}.` }));
    else if (d.doc_type === "dispute_response") (d.results || []).forEach((r) => ev.push({ date: d.doc_date, tone: r.outcome === "deleted" || r.outcome === "updated" ? "good" : "info", text: `${d.from || "Bureau"}: ${prettyName(r.creditor)} ${r.outcome}${r.note ? `. ${r.note}` : ""}.` }));
    else if (d.doc_type === "credit_report") ev.push({ date: d.doc_date, tone: "info", text: `${d.bureau || "Credit"} report${d.score ? ` · score ${d.score}` : ""}` });
  });
  mergeAccounts(docs).forEach((a) => {
    (a.late || []).forEach((l) => ev.push({ date: l.date, tone: "warn", text: `${a.creditor}: ${l.days || 30} days late.` }));
    if (isCollection(a) && a.first_delinquency) ev.push({ date: a.first_delinquency, tone: "warn", text: `${a.creditor} first went late.` });
  });
  Object.values(caseRec.decisions || {}).forEach((dec) => (dec.sent || []).forEach((s) => ev.push({ date: s.date, tone: "info", text: `You sent: ${LETTER_TITLE[s.type] || s.type} (${s.to}).` })));
  const seen = new Set();
  return ev.filter((e) => e.date && !seen.has(`${e.date}|${e.text}`) && seen.add(`${e.date}|${e.text}`)).sort((a, b) => b.date.localeCompare(a.date));
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
  const checkBacks = Object.values(caseRec.decisions || {}).flatMap((v) => (v.sent || []).filter((s) => !s.reply).map((s) => ({ ...s, due: sentDue(s) }))).filter((s) => s.due >= now).sort((a, b) => a.due.localeCompare(b.due));
  return { scores, wins, coming, checkBacks };
}

// ---------- After a letter is sent: replies, no-reply follow-ups ----------
export const CFPB = "https://www.consumerfinance.gov/complaint/";
export const REPLY_WAIT_DAYS = 30;
// The reply clock starts when the letter is delivered, if you've recorded that; otherwise when it was mailed.
export const sentDue = (s) => addDays(s.delivered || s.date, REPLY_WAIT_DAYS);
export const isOverdue = (s) => !s.reply && sentDue(s) < today();

// What they might say back, per letter.
export const OUTCOMES = {
  soldzero: [["updated", "Updated to $0"], ["deleted", "Removed"], ["verified", "Said it's accurate"]],
  infofix: [["updated", "Corrected"], ["verified", "Didn't change it"]],
  paidmismatch: [["updated", "Updated to paid"], ["deleted", "Removed"], ["verified", "Said it's accurate"]],
  lenderupdate: [["updated", "Agreed to update"], ["declined", "Refused"]],
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

export function followUpLetter(type, item, s, ctx = {}) {
  const a = item.account || {};
  const name = a.creditor || item.inquiry?.creditor || "[Company name]";
  const ref = a.last4 ? ` (account ending ${a.last4})` : "";
  const sign = signOff(ctx.sender);
  const bureau = ctx.bureau || (a.bureaus && a.bureaus[0]) || "[Equifax / Experian / TransUnion]";
  if (type === "followup") {
    return `${toCompany(a, s?.to || name)}\n\nRe: Second request${ref}\n\nOn ${s ? niceDate(s.date) : "[date]"}, I sent you a letter (${s ? LETTER_TITLE[s.type] || "request" : "request"}). A copy is enclosed. I have not received a response.\n\nPlease respond in writing within 15 days. If I do not hear from you, I will file a complaint with the Consumer Financial Protection Bureau.${sign}`;
  }
  if (type === "unverified") {
    return `${toBureau(bureau, ctx)}\n\nRe: Dispute of unverified collection account\n\nThe following collection account is on my credit report:\n\n${name}${ref}${a.amount_requested || a.balance ? `, ${money(a.amount_requested || a.balance)}` : ""}\n\nOn ${s ? niceDate(s.date) : "[date]"}, I asked the collector to validate this debt. ${s?.reply ? "Their response did not include proof that I owe it." : "They have not responded."} Copies of my request${s?.reply ? " and their response" : ""} are enclosed.\n\nPlease investigate and remove this unverified account.${sign}`;
  }
  if (type === "mov") {
    return `${toBureau(bureau, ctx)}\n\nRe: Request for method of verification${ref}\n\nI disputed ${name} on ${s ? niceDate(s.date) : "[date]"}, and you responded that it was verified.\n\nPlease tell me how you verified this information, including the name, address and phone number of anyone you contacted.${sign}`;
  }
  return letterFor(type, item, ctx);
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

// A long PDF is read a few pages at a time; put the pieces back into one document.
export function mergeParts(parts) {
  const ok = parts.filter(Boolean);
  if (!ok.length) return null;
  const pick = (f) => ok.map((d) => d[f]).find((v) => v != null && v !== "");
  const types = ok.map((d) => d.doc_type).filter((t) => t && t !== "other");
  const doc_type = types.includes("credit_report") ? "credit_report" : types[0] || "other";
  const seen = new Set();
  const inquiries = ok.flatMap((d) => d.inquiries || []).filter((q) => { const k = `${norm(q.creditor)}|${q.date}`; if (seen.has(k)) return false; seen.add(k); return true; });
  return {
    doc_type, doc_date: pick("doc_date"), from: pick("from"), bureau: pick("bureau"), score: pick("score"),
    from_address: pick("from_address"), dispute_address: pick("dispute_address"),
    breach_date: pick("breach_date"), breach_what: pick("breach_what"),
    accounts: ok.flatMap((d) => d.accounts || []),
    inquiries,
    results: ok.flatMap((d) => d.results || []),
    summary: pick("summary") || "",
  };
}


// ---------- The whole picture ----------
const amountOf = (a) => Number(a.amount_requested || a.balance) || 0;

export function overview(docs, caseRec = {}) {
  const { accounts, items } = analyze(docs, caseRec);
  const decisions = caseRec.decisions || {};
  const reports = docs.filter((d) => d.doc_type === "credit_report");
  const bureaus = [...new Set(reports.map((d) => d.bureau).filter(Boolean))];
  const latestReport = [...reports].sort((a, b) => String(b.doc_date).localeCompare(String(a.doc_date)))[0];
  const cols = accounts.filter(isCollection);
  const openCards = accounts.filter((a) => isCard(a) && !/charged|closed|collection/.test(String(a.status || "")) && Number(a.limit) > 0);
  const cardBal = openCards.reduce((t, a) => t + (Number(a.balance) || 0), 0);
  const cardLim = openCards.reduce((t, a) => t + Number(a.limit), 0);
  const lateCount = accounts.reduce((t, a) => t + (a.late || []).length, 0);
  const lateAccounts = accounts.filter((a) => (a.late || []).length).length;
  const pr = progress(docs, caseRec);
  const scores = pr.scores;
  const firstScore = scores[0], lastScore = scores[scores.length - 1];

  // Your plan: up to five steps in a fixed order, built only from what the documents show.
  const isStarted = (list) => list.some((i) => { const d = decisions[i.key] || {}; return (d.sent || []).length || Object.values(d.done || {}).some(Boolean); });
  const who = (i) => (i.account && i.account.creditor) || (i.inquiry && prettyName(i.inquiry.creditor)) || "";
  const names = (list, n = 2) => { const ns = [...new Set(list.map(who).filter(Boolean))]; return ns.slice(0, n).join(" · ") + (ns.length > n ? ` · ${ns.length - n} more` : ""); };
  const plan = [];
  const s1 = items.filter((i) => i.kind === "mismatch" || i.kind === "breach");
  if (s1.length) {
    const onlyBreach = s1.every((i) => i.kind === "breach");
    plan.push({ filter: onlyBreach ? "breach" : "mismatch", keys: s1.map((i) => i.key), started: isStarted(s1),
      title: onlyBreach ? "Sort out accounts opened after the breach" : "Fix what you have proof for",
      text: onlyBreach ? `${s1.length} ${s1.length === 1 ? "account or inquiry" : "accounts or inquiries"} to confirm: ${names(s1)}` : s1.filter((i) => i.kind === "mismatch").map((i) => `${who(i)}: your letter vs. the report`).join(" · ") });
  }
  const s2 = items.filter((i) => i.kind === "pastdue");
  const pastDueTotal = s2.reduce((t, i) => t + (i.pastDue || 0), 0);
  if (s2.length) plan.push({ filter: "pastdue", keys: s2.map((i) => i.key), started: isStarted(s2),
    title: `Get current${pastDueTotal ? ` · ${money(pastDueTotal)}${s2.some((i) => !i.pastDue) ? "+" : ""}` : ""}`,
    text: s2.slice(0, 4).map((i) => `${who(i)}${i.account.last4 ? ` ${i.account.last4}` : ""}${i.pastDue ? ` (${money(i.pastDue)})` : i.days ? ` (${i.days} days)` : ""}`).join(" · ") + (s2.length > 4 ? ` · ${s2.length - 4} more` : ""),
    note: "Each month these stay late can add a new late mark." });
  const s3 = items.filter((i) => i.kind === "overlimit" || i.kind === "utilization");
  if (s3.length) plan.push({ filter: s3.some((i) => i.kind === "overlimit") ? "overlimit" : "utilization", keys: s3.map((i) => i.key), started: isStarted(s3),
    title: s3.some((i) => i.kind === "overlimit") ? "Get cards under their limits" : "Get card balances under 30%",
    rows: [...s3].sort((x, y) => (y.kind === "overlimit") - (x.kind === "overlimit") || y.pct - x.pct).slice(0, 5)
      .map((i) => ({ name: `${who(i)}${i.account.last4 && !who(i).includes(i.account.last4) ? ` ${i.account.last4}` : ""}`, toLimit: i.kind === "overlimit" ? i.toLimit : null, to30: Math.max(0, i.target) })) });
  const s4 = items.filter((i) => i.kind === "collection");
  if (s4.length) {
    const asked = s4.filter((i) => ((decisions[i.key] || {}).sent || []).some((x) => x.type === "validation"));
    plan.push({ filter: "collection", keys: s4.map((i) => i.key), started: isStarted(s4),
      title: asked.length === s4.length ? "Collections: negotiate in writing" : "Collections: proof first, then negotiate",
      text: s4.slice(0, 2).map((i) => `${who(i)} ${money(amountOf(i.account))}`).join(" · ") + (s4.length > 2 ? ` · ${s4.length - 2} more` : ""),
      note: "Settlements often start around 30 to 50% of the balance, but there's no set rule. Get the terms, and deletion if they agree, in writing before paying." });
  }
  const s5 = items.filter((i) => i.kind === "sold" || i.kind === "info" || (i.kind === "collection" && i.twin));
  if (s5.length) {
    const parts = [];
    s5.filter((i) => i.kind === "sold").forEach((i) => parts.push(`${who(i)} still shows ${money(i.account.balance)}${i.buyer ? ` after going to ${i.buyer}` : " after being sold"}`));
    const twins = s5.filter((i) => i.kind === "collection");
    if (twins.length) parts.push(`${names(twins)} may be the same debt`);
    if (s5.some((i) => i.kind === "info")) parts.push("review your names and addresses");
    plan.push({ filter: s5.some((i) => i.kind === "sold") ? "sold" : s5.some((i) => i.kind === "collection") ? "twice" : "info", keys: s5.map((i) => i.key), started: isStarted(s5),
      title: "Clean up duplicates and your info", text: parts.join(" · ") });
  }
  // Nothing to fix: keep it steady instead of an empty plan.
  const upkeep = !plan.some((p) => p.filter !== "info") && reports.length > 0;
  if (upkeep) {
    plan.length = 0;
    plan.push({ upkeep: true, title: "Pay every bill on time", text: "Payment history matters most. Autopay for at least the minimum is an easy safety net." });
    plan.push({ upkeep: true, title: "Keep card balances under 30%", text: cardLim ? `You're using ${Math.round((cardBal / cardLim) * 100)}% of your limits right now.` : "Under 10% is even better." });
    plan.push({ upkeep: true, title: "Check your reports every few months", text: "They're free every week at AnnualCreditReport.com. Upload new ones here to compare." });
  }
  plan.forEach((p, i) => { p.n = i + 1; });
  const planNote = !reports.length ? "Upload a full credit report for a complete plan." : bureaus.length < 3 ? (() => { const miss = BUREAUS.filter((b) => !bureaus.includes(b)); return `Checked ${bureaus.join(" and ")} only. Upload the ${miss.join(" and ")} ${miss.length > 1 ? "reports" : "report"} to compare.`; })() : "";
  const pastDueCount = s2.length;
  const overLimitCount = items.filter((i) => i.kind === "overlimit").length;

  // Progress: handled = resolved, or a letter sent.
  const resolved = Object.values(decisions).filter((v) => v.resolved).length;
  const inFlight = items.filter((i) => ((decisions[i.key] || {}).sent || []).length).length;
  const lettersSent = Object.values(decisions).reduce((t, v) => t + (v.sent || []).length, 0);
  return {
    bureaus, latestReport,
    score: lastScore ? lastScore.score : null, scoreBureau: lastScore && lastScore.bureau,
    scoreChange: firstScore && lastScore && firstScore !== lastScore ? { delta: lastScore.score - firstScore.score, since: firstScore.date } : null,
    collections: { count: cols.length, total: cols.reduce((t, a) => t + amountOf(a), 0) },
    lateCount, lateAccounts,
    usage: cardLim ? Math.round((cardBal / cardLim) * 100) : null,
    plan, planNote, upkeep, pastDueCount, pastDueTotal, overLimitCount,
    nextFalloff: pr.coming[0] || null,
    handled: resolved + inFlight, total: resolved + items.length, resolved, inFlight, lettersSent, wins: pr.wins.length,
  };
}

// For the Life Progress ring on Home.
export function creditProgress(docs, caseRec = {}) {
  if (!docs.length) return null;
  const o = overview(docs, caseRec);
  return { handled: o.handled, total: o.total };
}


// ---------- Before you mail: what goes in the envelope, per letter ----------
const SIGN = "Sign and date the letter";
const COPIES = "Copies only. Keep your originals and a copy of this letter";
const CERT = "Send certified mail, return receipt requested";
const ID = "Copy of your ID (driver's license or passport)";
const ADDR = "Proof of address (a recent utility bill or bank statement)";
const REPORT = "Copy of the report page with the item circled";
export const CHECKLIST = {
  dispute: [SIGN, ID, ADDR, REPORT, "Anything that shows it's wrong (statements, receipts, letters)", COPIES, CERT],
  paidmismatch: [SIGN, ID, ADDR, REPORT, "Copy of your payoff letter", COPIES, CERT],
  unverified: [SIGN, ID, ADDR, REPORT, "Copy of your proof request and the mail receipt", "Their reply, if they sent one", COPIES, CERT],
  mov: [SIGN, ID, ADDR, "Copy of the bureau's dispute result", COPIES, CERT],
  block: [SIGN, "Your FTC Identity Theft Report (IdentityTheft.gov)", ID, ADDR, REPORT, "Copy of the breach notice, if you have one", COPIES, CERT],
  validation: [SIGN, "Copy of their letter (keep the original)", "Mail it within 30 days of their letter if you can", "Don't include your SSN or ID", CERT],
  paydelete: [SIGN, "Don't send any payment with this letter", "Wait for their written agreement before paying", COPIES, CERT],
  goodwill: [SIGN, "Keep it short and polite", "Regular mail or their online form is fine"],
  soldzero: [SIGN, ID, ADDR, REPORT, "The collection's page too, if it shows on the same report", COPIES, CERT],
  infofix: [SIGN, ID, ADDR, "Copy of the personal information page, with what's wrong circled", COPIES, CERT],
  lenderupdate: [SIGN, "Copy of your payoff letter", REPORT, COPIES, CERT],
  fraud: [SIGN, "Your FTC Identity Theft Report", ID, COPIES, CERT],
  followup: [SIGN, "Copy of your first letter and its mail receipt", COPIES, CERT],
};
export const uspsTrack = (n) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(String(n).replace(/\s+/g, ""))}`;

// ---------- Know your rights (general information) ----------
export const RIGHTS = [
  { title: "How to send a letter so it counts", points: [
    "Send it certified mail with a return receipt. The receipt is your proof of when they got it.",
    "Send copies, never originals. Keep a copy of everything you send, with the date.",
    "One bureau per envelope, and ideally one issue per letter.",
    "Online disputes are faster, but mail leaves a clearer paper trail if things go wrong.",
  ] },
  { title: "How long bureaus and collectors have to answer", points: [
    "Credit bureaus generally have 30 days after they receive your dispute to investigate. It can be up to 45 if you send more information during that time.",
    "They have to tell you the result in writing and give you a free copy of your report if it changed.",
    "A collector's first notice gives you 30 days to dispute the debt in writing. If you do, they must pause collecting until they send you verification.",
  ] },
  { title: "Old debts and time limits", points: [
    "Each state sets a time limit for suing over a debt, often 3 to 6 years. After it passes, a collector can still ask you to pay but shouldn't sue or threaten to.",
    "In many states, a payment or a written promise to pay can restart that clock. Check your state's rule first.",
    "Separately, most negative items drop off credit reports about 7 years after the account first went late, whether or not it's paid.",
  ] },
  { title: "Dealing with collectors: what they can't do", points: [
    "Collectors can't harass you, threaten you, lie about what you owe, or call at inconvenient times (generally before 8 a.m. or after 9 p.m.).",
    "You can ask in writing that they contact you only in writing, or stop contacting you.",
    "Keep a log of every call: the date, who you spoke with, and what was said.",
  ] },
  { title: "Free reports and where to complain", points: [
    "Free credit reports from all three bureaus, every week: AnnualCreditReport.com.",
    "Complaints about a bureau, lender or collector: the Consumer Financial Protection Bureau (consumerfinance.gov/complaint).",
    "Identity theft: IdentityTheft.gov for a report and recovery plan.",
    "Your state attorney general's office also takes complaints.",
  ] },
];
