// Sample data: a made-up person's life in Guía, for demos, onboarding and help-center screenshots.
// Every record carries is_sample: true, so "Clear sample data" removes exactly these and nothing else.
// Dates are relative to the day it's loaded, so it always looks current.
import { ent } from "@/lib/freshEntities";
import { buildMonths, compactRows } from "@/lib/spending";

export const SAMPLE_MODE_KEY = "guia-sample-mode";
export const isSampleMode = () => { try { return localStorage.getItem(SAMPLE_MODE_KEY) === "1"; } catch { return false; } };
export const setSampleMode = (on) => { try { on ? localStorage.setItem(SAMPLE_MODE_KEY, "1") : localStorage.removeItem(SAMPLE_MODE_KEY); } catch { /* ignore */ } };

// Every entity type sample data can touch (used by Clear).
export const SAMPLE_ENTITIES = ["Routine", "Task", "Goal", "Note", "Folder", "Project", "Trip", "FinanceItem", "BudgetBucket", "MonthlyIncome", "SpendingStatement", "CreditDoc", "CreditCase", "Business", "BusinessEntry", "BusinessGoal", "CareerEntry"];

const pad = (n) => String(n).padStart(2, "0");
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const dayOfMonth = (n) => ((n - 1 + 28) % 28) + 1; // keep due days 1–28
let uidN = 0;
const uid = () => `s${Date.now().toString(36)}${(uidN++).toString(36)}`;

// Small seeded random, so the sample looks the same every time it's loaded.
function rng(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// History for a routine: done most days, never today (so there's something to tick), a live streak ending yesterday.
function routineLog(steps, days, rate, streakLen, seed, today) {
  const r = rng(seed); const log = {};
  for (let i = 1; i <= 42; i++) {
    const d = addDays(today, -i);
    if (days && !days.includes(d.getDay())) continue;
    const inStreak = i <= streakLen;
    if (inStreak || r() < rate) log[keyOf(d)] = steps.map((s) => s.id);
  }
  return log;
}

function build(today = new Date()) {
  today = new Date(today); today.setHours(12, 0, 0, 0);
  const k = (n) => keyOf(addDays(today, n));
  const iso = (n) => addDays(today, n).toISOString();
  const S = { is_sample: true };

  const st = (...texts) => texts.map((text) => ({ id: uid(), text }));
  const morning = st("Make the bed", "Stretch for 10 minutes", "Write 3 lines in my journal");
  const water = st("Glass of water on waking", "Bottle with lunch", "Bottle in the afternoon");
  const evening = st("Skincare", "Read 20 pages", "Phone on the charger by 10");
  const workout = st("Warm-up", "Strength, 30 minutes", "Cool down and stretch");

  const routines = [
    { name: "Morning routine", color: "cognac", slot: "morning", remind_at: "07:00", days: null, steps: morning, log: routineLog(morning, null, 0.85, 6, 11, today), best_streak: 12 },
    { name: "Water", color: "olive", slot: "anytime", remind_at: "12:00", days: null, steps: water, log: routineLog(water, null, 0.7, 2, 22, today), best_streak: 9 },
    { name: "Evening wind-down", color: "mauve", slot: "evening", remind_at: "21:30", days: null, steps: evening, log: routineLog(evening, null, 0.6, 3, 33, today), best_streak: 7 },
    { name: "Workout", color: "charcoal", slot: "morning", remind_at: "06:30", days: [1, 3, 5], steps: workout, log: routineLog(workout, [1, 3, 5], 0.8, 0, 44, today), best_streak: 8 },
  ];

  const tasks = [
    { title: "Renew car registration", priority: "urgent", due_date: k(-2), completed: false, category: "personal" },
    { title: "Call the dentist to reschedule", priority: "high", due_date: k(0), completed: false, category: "health" },
    { title: "Send invoice to Bloom Studio", priority: "normal", due_date: k(0), completed: false, category: "business" },
    { title: "Pick up dry cleaning", priority: "low", due_date: k(1), completed: false, category: "personal" },
    { title: "Book Lisbon flights", priority: "high", due_date: k(5), completed: false, category: "travel" },
    { title: "Update resume summary", priority: "high", due_date: null, completed: false, category: "career" },
    { title: "Mail the rent check", priority: "normal", due_date: k(-4), completed: true, completed_at: iso(-4) },
    { title: "Order birthday gift for Mom", priority: "normal", due_date: k(-3), completed: true, completed_at: iso(-3) },
    { title: "Submit expense report", priority: "normal", due_date: k(-2), completed: true, completed_at: iso(-1) },
  ].map((t) => ({ notes: "", source: "sample", ...t }));

  const sub = (...items) => items.map(([text, completed]) => ({ id: uid(), text, completed: !!completed }));
  const goals = [
    { title: "Run a half marathon", category: "health", status: "in_progress", target_date: k(150), sub_tasks: sub(["Run a 5K without stopping", true], ["Buy proper running shoes", true], ["Follow a 12-week plan", true], ["Run 10 miles", false], ["Sign up for a spring race", false]) },
    { title: "Build a $10,000 emergency fund", category: "finance", status: "in_progress", target_date: k(240), sub_tasks: sub(["Open a high-yield savings account", true], ["Set up automatic transfers", true], ["Reach $5,000", false], ["Reach $10,000", false]) },
    { title: "Launch the online shop", category: "business", status: "in_progress", target_date: k(60), sub_tasks: sub(["Photograph the first collection", true], ["Write product descriptions", false], ["Set up payments", false], ["Announce the launch", false]) },
    { title: "Learn conversational Portuguese", category: "personal", status: "in_progress", target_date: k(45), sub_tasks: sub(["Practice 15 minutes a day", true], ["Learn restaurant phrases", false], ["Have a 5-minute conversation", false]) },
  ];

  const notes = [
    { title: "Lisbon ideas", note_type: "text", pinned: true, content: "<p>Sunset at Miradouro da Senhora do Monte. Tram 28 early in the morning before the crowds. Day trip to Sintra, book the palace tickets ahead.</p><p>Pastries to try: pastel de nata warm with cinnamon.</p>" },
    { title: "Grocery list", note_type: "list", content: "", list_items: [{ text: "Oat milk", checked: true }, { text: "Spinach", checked: false }, { text: "Salmon", checked: false }, { text: "Lemons", checked: true }, { text: "Coffee beans", checked: false }] },
    { title: "Books to read", note_type: "list", content: "", list_items: [{ text: "A memoir about starting over", checked: true }, { text: "Something set in Portugal", checked: false }, { text: "A book on money habits", checked: false }] },
    { title: "Shop launch checklist", note_type: "text", content: "<p>Final photo edits, price every piece, write the welcome email, and pick a launch date that isn't a holiday weekend.</p>" },
    { title: "Weekly reflection", note_type: "text", content: "<p>Felt calmer this week. Morning routine is sticking. Want to protect Sunday evenings for planning.</p>" },
  ].map((n) => ({ folder_id: null, attachments: [], ...n }));

  const projects = [
    { title: "Home office refresh", description: "A calmer, brighter place to work from home.", status: "active", category: "personal", target_date: k(30),
      tasks: [{ title: "Pick a paint color", due_date: k(-6), completed: true, assignees: [] }, { title: "Order a desk lamp", due_date: k(3), completed: false, assignees: [] }, { title: "Hang shelves", due_date: k(10), completed: false, assignees: [] }, { title: "Add plants", due_date: k(14), completed: false, assignees: [] }],
      visible_tabs: { tasks: true, resources: true, notes: true, support: false, budget: true } },
  ];

  const tripStart = 45;
  const trips = [{
    title: "Lisbon & Porto", country: "Portugal", cities: ["Lisbon", "Porto"], start_date: k(tripStart), end_date: k(tripStart + 8), status: "planning",
    description: "", flag_emoji: "🇵🇹", hero_image_url: "", budget_target: 3200,
    itinerary: [
      { day: 1, date: k(tripStart), title: "Arrive in Lisbon", city: "Lisbon", description: "Check in and an easy first evening.", activities: [{ time: "15:00", activity: "Check in", name: "Hotel in Alfama", location: "Alfama, Lisbon", notes: "" }, { time: "19:30", activity: "Dinner", name: "Seafood by the river", location: "Cais do Sodré", notes: "" }] },
      { day: 2, date: k(tripStart + 1), title: "Old town and views", city: "Lisbon", description: "", activities: [{ time: "08:30", activity: "Tram 28", name: "Ride the full route", location: "Martim Moniz", notes: "Go early" }, { time: "18:00", activity: "Sunset", name: "Miradouro da Senhora do Monte", location: "Graça", notes: "" }] },
      { day: 3, date: k(tripStart + 2), title: "Day trip to Sintra", city: "Sintra", description: "", activities: [{ time: "09:00", activity: "Train to Sintra", name: "From Rossio station", location: "Rossio", notes: "" }] },
    ],
    packing_items: [["Passport", "essentials", true], ["Travel adapter", "tech", true], ["Comfortable walking shoes", "clothing", false], ["Light jacket", "clothing", false], ["Sunscreen", "toiletries", false], ["Phone charger", "tech", true], ["Reusable water bottle", "misc", false], ["Daily vitamins", "health", false]].map(([name, category, packed]) => ({ name, category, quantity: 1, packed, source: "sample" })),
  }];

  // Finance
  const mk = monthKey(today);
  const d = today.getDate();
  const paidNow = { paid: true, paid_month: mk };
  const finance = [
    { type: "bill", name: "Rent", amount: 1650, billing_cycle: "monthly", due_day: 1, category: "Housing", is_fixed: true, ...(d >= 1 ? paidNow : { paid: false }) },
    { type: "bill", name: "City Power & Light", amount: 118, billing_cycle: "monthly", due_day: dayOfMonth(d + 2), category: "Utilities", is_fixed: false, paid: false },
    { type: "bill", name: "Phone", amount: 85, billing_cycle: "monthly", due_day: dayOfMonth(d - 3), category: "Utilities", is_fixed: true, ...paidNow },
    { type: "bill", name: "Internet", amount: 70, billing_cycle: "monthly", due_day: dayOfMonth(d + 9), category: "Utilities", is_fixed: true, paid: false },
    { type: "bill", name: "Car insurance", amount: 142, billing_cycle: "monthly", due_day: dayOfMonth(d + 6), category: "Insurance", is_fixed: true, paid: false },
    { type: "subscription", name: "Streaming", amount: 15.99, billing_cycle: "monthly", renewal_date: null },
    { type: "subscription", name: "Gym membership", amount: 39, billing_cycle: "monthly", renewal_date: null },
    { type: "subscription", name: "Cloud storage", amount: 2.99, billing_cycle: "monthly", renewal_date: null },
    { type: "savings_goal", name: "Emergency fund", target_amount: 10000, current_amount: 4200 },
    { type: "savings_goal", name: "Lisbon trip", target_amount: 3200, current_amount: 1850 },
    { type: "credit_score", name: "Equifax", bureau: "Equifax", score: 702, score_updated: k(-12), score_history: [{ score: 681, date: k(-95) }, { score: 694, date: k(-50) }, { score: 702, date: k(-12) }], target_score: 740 },
    { type: "credit_score", name: "Experian", bureau: "Experian", score: 695, score_updated: k(-12), score_history: [{ score: 676, date: k(-95) }, { score: 695, date: k(-12) }], target_score: 740 },
    { type: "credit_score", name: "TransUnion", bureau: "TransUnion", score: 708, score_updated: k(-12), score_history: [{ score: 690, date: k(-95) }, { score: 708, date: k(-12) }], target_score: 740 },
  ].map((f) => ({ notes: "", ...f }));
  // An auto loan with a payment schedule and a payoff quote, so early-payoff savings show.
  const schedule = [];
  for (let i = -3; i < 20; i++) { const pd = new Date(today.getFullYear(), today.getMonth() + i, 12, 12); schedule.push({ id: uid(), date: keyOf(pd), amount: 385, paid: pd < today }); }
  finance.push({ type: "loan", name: "Auto loan, Riverbend Credit Union", monthly_payment: 385, total_amount: 18000, amount_paid: 9240, payoff_amount: 6950, schedule, due_date: null, paid: false, notes: "" });

  const buckets = [["Groceries", 600], ["Dining", 250], ["Transportation", 300], ["Shopping", 200], ["Entertainment", 150]]
    .map(([name, allocated_amount]) => ({ name, allocated_amount, spent_amount: 0, is_fixed: false, month: mk }));
  const income = [{ amount: 5400, month: mk }];

  // Two-and-a-bit months of purchases at made-up merchants.
  const MERCH = { Groceries: ["Green Basket Market", "Corner Grocer"], Dining: ["Corner Café", "Taqueria Sol", "Noodle House"], Transportation: ["Metro Fuel", "City Parking"], Shopping: ["Maple & Co.", "Home Goods Outlet"], Entertainment: ["Starlight Cinema", "Bookshop on Main"], Healthcare: ["Northside Pharmacy"], Personal: ["Glow Salon"] };
  const AMT = { Groceries: [45, 120], Dining: [12, 55], Transportation: [30, 60], Shopping: [20, 90], Entertainment: [12, 40], Healthcare: [10, 35], Personal: [40, 85] };
  const FREQ = { Groceries: 0.32, Dining: 0.38, Transportation: 0.18, Shopping: 0.12, Entertainment: 0.08, Healthcare: 0.04, Personal: 0.03 };
  const r = rng(77); const rows = [];
  const start = new Date(today.getFullYear(), today.getMonth() - 2, 1, 12);
  for (let x = new Date(start); x < today; x = addDays(x, 1)) {
    for (const c of Object.keys(FREQ)) {
      if (r() < FREQ[c]) { const [lo, hi] = AMT[c]; const list = MERCH[c]; rows.push({ d: keyOf(x), m: list[Math.floor(r() * list.length)], a: Math.round((lo + r() * (hi - lo)) * 100) / 100, c, t: "purchase" }); }
    }
  }
  const statements = [{ file_url: "", file_type: "", label: "Sample checking account", filename: "sample-statement.pdf", count: rows.length, months: buildMonths(rows), rows: compactRows(rows) }];

  // A fictional credit report: two healthy cards, the auto loan, one late payment and one small collection.
  const credit = [{
    doc_type: "credit_report", doc_date: k(-12), from: "Experian", bureau: "Experian", bureaus: ["Experian"], scores: [{ bureau: "Experian", score: 695 }], score: 695,
    from_address: "", dispute_address: "P.O. Box 4500, Allen, TX 75013", breach_date: "", breach_what: "",
    accounts: [
      { creditor: "Harbor Bank Visa", kind: "credit_card", status: "open", balance: 1240, limit: 5000, past_due: null, days_past_due: null, opened: "2019-04", last_payment: k(-20), late: [], last4: "4417", bureaus: ["Experian"] },
      { creditor: "Maple Rewards Card", kind: "credit_card", status: "open", balance: 2380, limit: 3000, past_due: null, days_past_due: null, opened: "2021-08", last_payment: k(-18), late: [{ date: monthKey(addDays(today, -200)), days: 30 }], last4: "2210", bureaus: ["Experian"] },
      { creditor: "Riverbend Credit Union", kind: "auto_loan", status: "open", balance: 7580, limit: null, past_due: null, days_past_due: null, opened: "2023-03", last_payment: k(-5), late: [], last4: "8803", bureaus: ["Experian"] },
      { creditor: "Apex Recovery Group", original_creditor: "Lakeside Medical Clinic", kind: "collection", status: "collection", balance: 220, limit: null, past_due: 220, days_past_due: null, opened: monthKey(addDays(today, -300)), first_delinquency: monthKey(addDays(today, -400)), last_payment: "", late: [], last4: "", address: "P.O. Box 1200, Dallas, TX 75201", bureaus: ["Experian"] },
    ],
    inquiries: [{ creditor: "Riverbend Credit Union", date: "2023-03-02" }],
    results: [], summary: "A sample Experian credit report with two cards, an auto loan, one late payment and one small medical collection.",
    filename: "sample-experian-report.pdf", file_hash: null, pages: 6,
  }];

  const business = { name: "Sofia Studio", is_default: true, revenue_goal: 20000 };
  const bizEntries = [
    ["Sale", "Custom tote order", -26, 180, null], ["Sale", "Market booth sales", -19, 640, null], ["Expense", "Canvas and thread", -24, null, 95],
    ["Sale", "Online order, linen set", -11, 220, null], ["Expense", "Booth fee", -20, null, 75], ["Sale", "Workshop tickets", -4, 360, null],
  ].map(([category, name, off, revenue, expense]) => ({ category, name, date: k(off), revenue, expense, location: "", description: "", notes: "", document_id: null }));
  const bizGoals = [{ title: "Reach $20,000 in sales this year", description: "", target_value: 20000, current_value: 7400, unit: "$", target_date: `${today.getFullYear()}-12-31`, notes: "", status: "active" }];

  const career = [
    { entry_type: "job", title: "Operations Manager", company: "Brightline Logistics", start_date: "2021-06-01", current: true, description: "Lead a team of six and run day-to-day operations for the regional hub." },
    { entry_type: "job", title: "Customer Success Lead", company: "Nimbus Software", start_date: "2017-02-01", end_date: "2021-05-31", description: "Built the onboarding program and cut churn by a third." },
    { entry_type: "education", title: "B.A. Business Administration", company: "State University", start_date: "2012-08-01", end_date: "2016-05-15" },
    { entry_type: "certification", title: "Project Management Professional (PMP)", company: "", start_date: "2022-09-01" },
  ];

  const tag = (list) => list.map((x) => ({ ...x, ...S }));
  return {
    Routine: tag(routines), Task: tag(tasks), Goal: tag(goals), Note: tag(notes), Project: tag(projects), Trip: tag(trips),
    FinanceItem: tag(finance), BudgetBucket: tag(buckets), MonthlyIncome: tag(income), SpendingStatement: tag(statements),
    CreditDoc: tag(credit), CareerEntry: tag(career),
    _business: { ...business, ...S }, BusinessEntry: tag(bizEntries), BusinessGoal: tag(bizGoals),
  };
}

async function pool(items, size, fn) {
  let i = 0;
  const run = async () => { while (i < items.length) { const idx = i++; await fn(items[idx], idx); } };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, run));
}

export async function loadSampleData(onProgress) {
  const data = build();
  // The business goes first so its entries and goals can point to it.
  let hasBiz = false;
  try { hasBiz = ((await ent.Business.list()) || []).length > 0; } catch { /* ignore */ }
  const biz = await ent.Business.create({ ...data._business, is_default: !hasBiz });
  const jobs = [];
  for (const [entity, list] of Object.entries(data)) {
    if (entity.startsWith("_")) continue;
    list.forEach((rec) => jobs.push([entity, entity === "BusinessEntry" || entity === "BusinessGoal" ? { ...rec, business_id: biz.id } : rec]));
  }
  let done = 0;
  await pool(jobs, 4, async ([entity, rec]) => {
    await ent[entity].create(rec);
    done += 1; onProgress?.(done, jobs.length);
  });
  setSampleMode(true);
  return jobs.length + 1;
}

export async function clearSampleData(onProgress) {
  const targets = [];
  for (const entity of SAMPLE_ENTITIES) {
    let list = [];
    try { list = (await ent[entity].list()) || []; } catch { list = []; }
    list.filter((x) => x.is_sample).forEach((x) => targets.push([entity, x.id]));
  }
  let done = 0;
  await pool(targets, 4, async ([entity, id]) => {
    try { await ent[entity].delete(id); } catch { /* already gone */ }
    done += 1; onProgress?.(done, targets.length);
  });
  setSampleMode(false);
  try { Object.keys(localStorage).filter((k) => k.startsWith("guia-fin-insights")).forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ }
  return targets.length;
}

// Pre-written AI results shown while sample data is on, so demos cost nothing and always look the same.
export const SAMPLE_AI = {
  "fin-insights": {
    focus: "Pay the City Power bill this week and keep your cards under 50% of their limits.",
    actions: [
      { text: "Pay City Power & Light ($118) before it's due on Thursday.", tab: "bill" },
      { text: "Move $400 to the Maple Rewards Card to bring it under 70% of its limit.", tab: "loan" },
      { text: "Set up a $200 automatic transfer to your emergency fund each payday.", tab: "savings_goal" },
    ],
  },
};
