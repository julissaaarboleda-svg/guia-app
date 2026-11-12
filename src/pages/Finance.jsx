import { useState, useEffect, useRef, Fragment } from "react";
import { createPortal } from "react-dom";
import { ent } from "@/lib/freshEntities";
import { Trash2, ChevronDown, ChevronUp, ChevronRight, Pencil, X, MoreHorizontal, Check, Plus } from "lucide-react";
import { isPaid, paidPatch, dueInfo, TONE_CLASS, monthKeyOf, billInMonth, isCanceled, monthlyEquivalent, needsReview } from "@/lib/financeHelpers";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import PageHeader from "@/components/PageHeader";
import DateInput from "@/components/DateInput";

import BudgetTab from "@/components/finance/BudgetTab";
import SpendingTab from "@/components/finance/SpendingTab";
import FinanceSummary from "@/components/finance/FinanceSummary";
import ImportSheet from "@/components/finance/ImportSheet";
import LoanDetails, { UpcomingLoans } from "@/components/finance/LoanDetails";
import CreditAssistant from "@/components/credit/CreditAssistant";

const TABS = ["summary", "budget", "bill", "savings_goal", "loan", "credit_score"];

const PRESET_CATEGORIES = [
  "Housing", "Utilities", "Groceries", "Dining", "Transportation",
  "Insurance", "Healthcare", "Personal", "Entertainment",
  "Savings", "Debt", "Subscriptions", "Education", "Gifts", "Other"
];

const RECURRENCE_OPTIONS = [
  { value: "one_time", label: "One-time" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

function safeDate(s) {
  if (!s) return null;
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}
function fmtDate(s) {
  const d = safeDate(s);
  return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
}
const scoreRating = (n) => n >= 800 ? { label: "Excellent", cls: "bg-[#E4E9D5] text-[#566033]" } : n >= 740 ? { label: "Very good", cls: "bg-[#E4E9D5] text-[#566033]" } : n >= 670 ? { label: "Good", cls: "bg-[#F3E8D6] text-[#8A5F27]" } : n >= 580 ? { label: "Fair", cls: "bg-[#F3E8D6] text-[#8A5F27]" } : { label: "Poor", cls: "bg-[#F4E6E7] text-[#8F5F65]" };
const withHistory = (item, newScore) => {
  const hist = Array.isArray(item.score_history) ? item.score_history : (item.score ? [{ score: item.score, date: (item.score_updated || item.created_date || new Date().toISOString()).slice(0, 10) }] : []);
  const today = new Date().toISOString().slice(0, 10);
  return { score: newScore, score_updated: today, score_history: [...hist.filter((h) => h.date !== today), { score: newScore, date: today }].slice(-24) };
};

function RowMenu({ open, onToggle, onClose, children }) {
  const btnRef = useRef(null);
  const [pos, setPos] = useState(null);
  // The row cards clip anything that overflows them, so the menu is drawn on the page itself.
  useEffect(() => {
    if (!open || !btnRef.current) { setPos(null); return; }
    const r = btnRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom - 110; // leave room for the bottom nav
    const up = spaceBelow < 150;
    setPos({ right: Math.max(8, window.innerWidth - r.right), ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }) });
  }, [open]);
  return (
    <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
      <button ref={btnRef} onClick={onToggle} aria-label="Options" className="p-1 text-muted-foreground/60 hover:text-foreground"><MoreHorizontal className="w-4 h-4" /></button>
      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-[89]" onClick={onClose} />
          <div style={pos} className="fixed bg-card border border-border rounded-lg shadow-lg z-[90] py-1 min-w-[150px]" onClick={(e) => e.stopPropagation()}>{children}</div>
        </>,
        document.body
      )}
    </div>
  );
}
const menuBtn = "w-full flex items-center gap-2 text-left px-3 py-2 text-xs hover:bg-secondary";

const ADD_LABELS = { credit_score: "score", savings_goal: "goal", bill: "bill", loan: "loan", subscription: "subscription", budget: "bucket" };
const TAB_LABELS = { summary: "Summary", credit_score: "Credit", savings_goal: "Savings Goals", bill: "Bills", loan: "Loans", subscription: "Subscriptions", budget: "Budget", spending: "Spending" };

export default function Finance() {
  const [items, setItems] = useState([]);
  const [buckets, setBuckets] = useState([]);
  const [activeTab, setActiveTab] = useState("summary");
  const [scoresOpen, setScoresOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [spendKey, setSpendKey] = useState(0);
  const [budgetView, setBudgetView] = useState("budget");
  const [statements, setStatements] = useState([]);
  useEffect(() => { ent.SpendingStatement.list().then((s) => setStatements(s || [])).catch(() => {}); }, [spendKey]);
  const [form, setForm] = useState({});
  const [expandedItem, setExpandedItem] = useState(null);
  const [editingNotes, setEditingNotes] = useState(null);
  const [notesContent, setNotesContent] = useState("");
  const [editingItemId, setEditingItemId] = useState(null);
  const [editItemForm, setEditItemForm] = useState({});
  const [collapsed, setCollapsed] = useState({ variable: true, subs: true });
  const [menuId, setMenuId] = useState(null);
  const [contribId, setContribId] = useState(null);
  const [contribAmt, setContribAmt] = useState("");
  const [scoreId, setScoreId] = useState(null);
  const [scoreVal, setScoreVal] = useState("");

  const load = async () => {
    const [i, b] = await Promise.all([
      ent.FinanceItem.list("-created_date"),
      ent.BudgetBucket.list("-created_date"),
    ]);
    setItems(i);
    setBuckets(b);
  };

  useEffect(() => { load(); }, []);

  const tabItems = activeTab === "bill"
    ? items.filter(i => (i.type === "bill" || i.type === "subscription") && !isCanceled(i))
    : items.filter(i => i.type === activeTab);
  if (activeTab === "bill") {
    tabItems.sort((a, b) => {
      if (a.type !== b.type) return a.type === "bill" ? -1 : 1;
      if (a.type === "bill") return (b.is_fixed ? 1 : 0) - (a.is_fixed ? 1 : 0);
      return 0;
    });
  }
  const subMonthlyEquivalent = items
    .filter(i => i.type === "subscription" && !isCanceled(i))
    .reduce((sum, sub) => {
      const amt = sub.amount || 0;
      if (sub.billing_cycle === "yearly") return sum + amt / 12;
      if (sub.billing_cycle === "quarterly") return sum + amt / 3;
      if (sub.billing_cycle === "weekly") return sum + amt * 4.33;
      return sum + amt;
    }, 0);

  const openAdd = (tab = activeTab) => {
    setForm({ type: tab, subType: "bill", name: "", score: "", target_score: "", bureau: "", current_amount: "", target_amount: "", amount: "", due_date: "", paid: false, monthly_payment: "", total_amount: "", amount_paid: "", billing_cycle: "monthly", renewal_date: "",       is_fixed: false, category: "", customCategory: "", recurrence: "one_time", due_day: "", addToBudget: false });
    setAdding(true);
  };

  const add = async () => {
    if (!form.name) return;
    const formType = activeTab === "bill" ? (form.subType || "bill") : activeTab;
    const data = { type: formType, name: form.name, notes: form.notes || "" };
    if (formType === "credit_score") {
      data.bureau = form.bureau;
      data.score = Number(form.score) || null;
      data.target_score = Number(form.target_score) || null;
    } else if (formType === "savings_goal") {
      data.current_amount = Number(form.current_amount) || 0;
      data.target_amount = Number(form.target_amount) || null;
    } else if (formType === "loan") {
      data.monthly_payment = Number(form.monthly_payment) || null;
      data.total_amount = Number(form.total_amount) || null;
      data.amount_paid = Number(form.amount_paid) || 0;
      data.due_date = form.due_date || null;
      data.paid = false;
    } else if (formType === "subscription") {
      data.amount = Number(form.amount) || null;
      data.billing_cycle = form.billing_cycle || "monthly";
      data.renewal_date = form.renewal_date || null;
    } else {
      data.amount = Number(form.amount) || null;
      data.due_date = form.due_date || null;
      data.paid = false;
      if (formType === "bill") {
        data.is_fixed = form.is_fixed || false;
        data.category = form.category === "__new__" ? (form.customCategory || "") : (form.category || "");
        data.billing_cycle = form.recurrence || "one_time";
        if (form.recurrence && form.recurrence !== "one_time") {
          if (form.recurrence === "yearly") {
            data.due_date = form.due_date || null;
            data.due_day = form.due_date ? Number(form.due_date.slice(8, 10)) : null;
          } else {
            data.due_day = form.due_day ? Number(form.due_day) : null;
            data.due_date = null;
          }
        }
      }
    }
    await ent.FinanceItem.create(data);
    if (formType === "bill" && form.recurrence === "one_time" && form.addToBudget && data.amount) {
      const mk = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
      await ent.BudgetBucket.create({
        name: data.name,
        allocated_amount: data.amount,
        spent_amount: 0,
        is_fixed: false,
        category: data.category || "",
        month: mk,
      });
    }
    setAdding(false);
    load();
  };

  const remove = async (id) => {
    await ent.FinanceItem.delete(id);
    load();
  };

  const togglePaid = async (item) => {
    await ent.FinanceItem.update(item.id, paidPatch(item, !isPaid(item)));
    load();
  };

  const toggleExpand = (item) => {
    if (expandedItem?.id === item.id) {
      setExpandedItem(null);
      setEditingNotes(null);
    } else {
      setExpandedItem(item);
      setNotesContent(item.notes || "");
      setEditingNotes(null);
    }
  };

  const saveNotes = async (item) => {
    await ent.FinanceItem.update(item.id, { notes: notesContent });
    setEditingNotes(null);
    load();
  };

  const MOVE_KINDS = [["bill", "Bill"], ["subscription", "Subscription"], ["loan", "Loan"], ["credit_card", "Credit card"], ["savings_goal", "Savings goal"]];
  const currentKind = (item) => (item.type === "loan" && item.subtype === "credit_card" ? "credit_card" : item.type);
  const moveItem = async (item, kind) => {
    const amt = item.type === "loan" ? item.monthly_payment : item.type === "savings_goal" ? item.target_amount : item.amount;
    const cycle = item.billing_cycle && item.billing_cycle !== "one_time" ? item.billing_cycle : "monthly";
    let patch;
    if (kind === "bill") patch = { type: "bill", subtype: null, amount: amt ?? null, billing_cycle: item.billing_cycle || "one_time", paid: item.paid || false };
    else if (kind === "subscription") patch = { type: "subscription", subtype: null, amount: amt ?? null, billing_cycle: cycle };
    else if (kind === "loan" || kind === "credit_card") patch = { type: "loan", subtype: kind === "credit_card" ? "credit_card" : null, monthly_payment: amt ?? null, amount_paid: item.amount_paid || 0, paid: item.paid || false };
    else patch = { type: "savings_goal", subtype: null, target_amount: amt ?? null, current_amount: item.current_amount || 0 };
    await ent.FinanceItem.update(item.id, patch);
    setEditingItemId(null);
    setActiveTab(kind === "loan" || kind === "credit_card" ? "loan" : kind === "subscription" ? "bill" : kind);
    load();
  };

  const openEditItem = (item) => {
    setEditingItemId(item.id);
    setEditItemForm({
      name: item.name || "",
      bureau: item.bureau || "",
      score: item.score || "",
      target_score: item.target_score || "",
      current_amount: item.current_amount || 0,
      target_amount: item.target_amount || "",
      due_date: item.due_date || "",
      amount: item.amount || "",
      paid: isPaid(item),
      monthly_payment: item.monthly_payment || "",
      total_amount: item.total_amount || "",
      amount_paid: item.amount_paid || 0,
      billing_cycle: item.billing_cycle || "monthly",
      renewal_date: item.renewal_date || "",
      is_fixed: item.is_fixed || false,
      category: item.category || "",
      customCategory: "",
      recurrence: item.billing_cycle || "one_time",
      due_day: item.due_day?.toString() || "",
    });
  };

  const saveEditItem = async (item) => {
    let data = { name: editItemForm.name };
    if (item.type === "credit_score") {
      data.bureau = editItemForm.bureau;
      data.name = editItemForm.bureau || editItemForm.name;
      data.score = Number(editItemForm.score) || null;
      if (data.score && data.score !== item.score) Object.assign(data, withHistory(item, data.score));
      data.target_score = Number(editItemForm.target_score) || null;
    } else if (item.type === "savings_goal") {
      data.current_amount = Number(editItemForm.current_amount) || 0;
      data.target_amount = Number(editItemForm.target_amount) || null;
    } else if (item.type === "bill") {
      data.amount = Number(editItemForm.amount) || null;
      data.due_date = editItemForm.due_date || null;
      data.paid = editItemForm.paid;
      data.paid_month = editItemForm.paid ? monthKeyOf() : null;
      data.is_fixed = editItemForm.is_fixed || false;
      data.category = editItemForm.category === "__new__" ? (editItemForm.customCategory || "") : (editItemForm.category || "");
      data.billing_cycle = editItemForm.recurrence || "one_time";
      if (editItemForm.recurrence && editItemForm.recurrence !== "one_time") {
        if (editItemForm.recurrence === "yearly") {
          data.due_date = editItemForm.due_date || null;
          data.due_day = editItemForm.due_date ? Number(editItemForm.due_date.slice(8, 10)) : null;
        } else {
          data.due_day = editItemForm.due_day ? Number(editItemForm.due_day) : null;
          data.due_date = null;
        }
      }
    } else if (item.type === "loan") {
      data.monthly_payment = Number(editItemForm.monthly_payment) || null;
      data.total_amount = Number(editItemForm.total_amount) || null;
      data.amount_paid = Number(editItemForm.amount_paid) || 0;
      data.due_date = editItemForm.due_date || null;
      data.paid = editItemForm.paid;
    } else if (item.type === "subscription") {
      data.amount = Number(editItemForm.amount) || null;
      data.billing_cycle = editItemForm.billing_cycle || "monthly";
      data.renewal_date = editItemForm.renewal_date || null;
    }
    await ent.FinanceItem.update(item.id, data);
    setEditingItemId(null);
    load();
  };

  return (
    <>
      <div className="finance-ui max-w-[1200px] 2xl:max-w-[1400px] mx-auto w-full">
      <PageHeader
        title="Finance"
        subtitle="Your financial picture, at a glance."
        actions={
          <button onClick={() => setImporting(true)} className="border border-[#A7773F] text-[#A7773F] rounded-full font-heading text-[13px] px-3.5 py-1.5 hover:bg-[#A7773F]/10 transition-colors">
            Import file
          </button>
        }
      />
      <div className="p-6 md:p-8 pb-12">

      <ImportSheet open={importing} onClose={() => setImporting(false)} existing={items} statements={statements} onDone={(r) => { if (r?.spending) { setActiveTab("budget"); setBudgetView("spending"); } else setActiveTab("bill"); setSpendKey((k) => k + 1); load(); }} />

      {/* Tabs */}
      <div className="sticky top-[84px] z-20 bg-background -mx-6 md:-mx-8 px-6 md:px-8 py-2 flex gap-1.5 overflow-x-auto no-scrollbar mb-5">
        {TABS.map(t => (
          <button key={t} onClick={() => { setActiveTab(t); if (t === "budget") setBudgetView("budget"); setAdding(false); setEditingItemId(null); }}
            className={`px-3.5 py-1.5 rounded-full font-heading text-[13px] whitespace-nowrap flex-shrink-0 transition-colors ${
              activeTab === t
                ? "bg-[#A7773F] text-[#F7F3EC]"
                : "border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Summary tab */}
      {activeTab === "summary" && (
        <FinanceSummary items={items.filter(i => !isCanceled(i))} buckets={buckets} onNavigate={(t) => { if (t === "spending") { setActiveTab("budget"); setBudgetView("spending"); } else { setActiveTab(t); if (t === "budget") setBudgetView("budget"); } setAdding(false); setEditingItemId(null); }} onAddFirst={() => { setActiveTab("bill"); openAdd("bill"); }} />
      )}

      {/* Budget tab — self-contained */}
      {activeTab === "budget" && (
        <>
          <div className="flex p-1 rounded-full bg-[#ECE7DD] mb-5" role="tablist">
            {[["budget", "Plan"], ["spending", "Actual spending"]].map(([id, l]) => (
              <button key={id} role="tab" aria-selected={budgetView === id} onClick={() => setBudgetView(id)}
                className={`flex-1 py-1.5 rounded-full text-[13px] transition-all ${budgetView === id ? "bg-card text-foreground shadow-sm font-medium" : "text-muted-foreground"}`}>{l}</button>
            ))}
          </div>
          {budgetView === "budget" ? <BudgetTab key={`b${spendKey}`} /> : <SpendingTab key={`s${spendKey}`} items={items.filter(i => !isCanceled(i))} onImport={() => setImporting(true)} />}
        </>
      )}

      {/* Add button */}
      {activeTab !== "budget" && activeTab !== "spending" && activeTab !== "summary" && (
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-xl text-foreground">{TAB_LABELS[activeTab]}</h2>
        {!adding && activeTab !== "credit_score" && (
          <button onClick={() => openAdd()} className="font-body text-[13px] font-medium text-[#A7773F] px-1 py-1.5 hover:opacity-80 transition-opacity">
            + New {String(ADD_LABELS[activeTab] || "").toLowerCase()}
          </button>
        )}
      </div>
      )}

      {/* Add form */}
      {adding && activeTab !== "budget" && activeTab !== "spending" && (
        <div className="bg-card border border-border rounded-2xl p-4 mb-4 space-y-3">
          {activeTab === "credit_score" && (
            <>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Credit bureau</label>
                <input value={form.bureau || ""} onChange={e => setForm(f => ({ ...f, bureau: e.target.value, name: e.target.value }))} placeholder="e.g., Equifax, TransUnion, Experian"
                  className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Current score</label>
                  <input type="number" value={form.score || ""} onChange={e => setForm(f => ({ ...f, score: e.target.value }))} placeholder="720"
                    className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Target score</label>
                  <input type="number" value={form.target_score || ""} onChange={e => setForm(f => ({ ...f, target_score: e.target.value }))} placeholder="750"
                    className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Notes (optional)</label>
                <ReactQuill value={form.notes || ""} onChange={(value) => setForm(f => ({ ...f, notes: value }))} placeholder="Add notes..." className="bg-secondary rounded-lg quill-notes" theme="snow" />
              </div>
            </>
          )}

          {activeTab === "savings_goal" && (
            <>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Goal name</label>
                <input value={form.name || ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., Emergency Fund"
                  className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Amount saved</label>
                  <input type="number" value={form.current_amount || ""} onChange={e => setForm(f => ({ ...f, current_amount: e.target.value }))} placeholder="5000"
                    className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Target amount</label>
                  <input type="number" value={form.target_amount || ""} onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))} placeholder="10000"
                    className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Notes (optional)</label>
                <ReactQuill value={form.notes || ""} onChange={(value) => setForm(f => ({ ...f, notes: value }))} placeholder="Add notes..." className="bg-secondary rounded-lg quill-notes" theme="snow" />
              </div>
            </>
          )}

          {activeTab === "bill" && (
            <div className="flex gap-2">
              <button onClick={() => setForm(f => ({ ...f, subType: "bill" }))} className={`flex-1 py-1.5 text-xs font-medium rounded-full transition-colors ${form.subType !== "subscription" ? "bg-[#A7773F] text-[#F7F3EC]" : "bg-secondary text-muted-foreground"}`}>Bill</button>
              <button onClick={() => setForm(f => ({ ...f, subType: "subscription" }))} className={`flex-1 py-1.5 text-xs font-medium rounded-full transition-colors ${form.subType === "subscription" ? "bg-[#A7773F] text-[#F7F3EC]" : "bg-secondary text-muted-foreground"}`}>Subscription</button>
            </div>
          )}

          {activeTab === "bill" && form.subType !== "subscription" && (
            <>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Bill name</label>
                <input value={form.name || ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., Electric Bill"
                  className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Amount</label>
                  <input type="number" value={form.amount || ""} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="150"
                    className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors" />
                </div>
                <div>
                  {form.recurrence && form.recurrence !== "one_time" && form.recurrence !== "yearly" ? (
                    <>
                      <label className="block text-xs font-medium text-foreground mb-1">Due day (1-31)</label>
                      <input type="number" min="1" max="31" value={form.due_day || ""} onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))} placeholder="1"
                        className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors" />
                    </>
                  ) : (
                    <>
                      <label className="block text-xs font-medium text-foreground mb-1">{form.recurrence === "yearly" ? "Renews on" : "Due date"}</label>
                      <DateInput value={form.due_date || ""} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                        className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors" />
                    </>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Category (optional)</label>
                <select
                  value={form.category === "__new__" ? "__new__" : form.category || ""}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value, customCategory: e.target.value === "__new__" ? (f.customCategory || "") : "" }))}
                  className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring"
                >
                  <option value="">None</option>
                  {PRESET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="__new__">+ Add new category...</option>
                </select>
                {form.category === "__new__" && (
                  <input value={form.customCategory || ""} onChange={e => setForm(f => ({ ...f, customCategory: e.target.value }))} placeholder="Enter category name" autoFocus
                    className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring mt-2" />
                )}
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input type="checkbox" checked={form.is_fixed || false} onChange={e => setForm(f => ({ ...f, is_fixed: e.target.checked }))} className="rounded" />
                Fixed expense (auto-feeds budget)
              </label>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Recurrence</label>
                <select value={form.recurrence || "one_time"} onChange={e => setForm(f => ({ ...f, recurrence: e.target.value }))}
                  className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring">
                  {RECURRENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {form.recurrence === "one_time" && (
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input type="checkbox" checked={form.addToBudget || false} onChange={e => setForm(f => ({ ...f, addToBudget: e.target.checked }))} className="rounded" />
                  Add to this month's budget
                </label>
              )}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Notes (optional)</label>
                <ReactQuill value={form.notes || ""} onChange={(value) => setForm(f => ({ ...f, notes: value }))} placeholder="Add notes..." className="bg-secondary rounded-lg quill-notes" theme="snow" />
              </div>
            </>
          )}

          {activeTab === "loan" && (
            <>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Loan name</label>
                <input value={form.name || ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., Car Loan"
                  className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Monthly payment</label>
                  <input type="number" value={form.monthly_payment || ""} onChange={e => setForm(f => ({ ...f, monthly_payment: e.target.value }))} placeholder="450"
                    className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Total amount</label>
                  <input type="number" value={form.total_amount || ""} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} placeholder="20000"
                    className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Amount paid</label>
                  <input type="number" value={form.amount_paid || ""} onChange={e => setForm(f => ({ ...f, amount_paid: e.target.value }))} placeholder="0"
                    className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Next due date</label>
                  <DateInput value={form.due_date || ""} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                    className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Notes (optional)</label>
                <ReactQuill value={form.notes || ""} onChange={(value) => setForm(f => ({ ...f, notes: value }))} placeholder="Add notes..." className="bg-secondary rounded-lg quill-notes" theme="snow" />
              </div>
            </>
          )}

          {activeTab === "bill" && form.subType === "subscription" && (
            <>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Subscription name</label>
                <input value={form.name || ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., Netflix"
                  className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Amount</label>
                  <input type="number" value={form.amount || ""} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="15.99"
                    className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Billing cycle</label>
                  <select value={form.billing_cycle || "monthly"} onChange={e => setForm(f => ({ ...f, billing_cycle: e.target.value }))}
                    className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring">
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Renewal date</label>
                <DateInput value={form.renewal_date || ""} onChange={e => setForm(f => ({ ...f, renewal_date: e.target.value }))}
                  className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Notes (optional)</label>
                <ReactQuill value={form.notes || ""} onChange={(value) => setForm(f => ({ ...f, notes: value }))} placeholder="Add notes..." className="bg-secondary rounded-lg quill-notes" theme="snow" />
              </div>
            </>
          )}

          <div className="flex gap-2">
            <button onClick={add} className="flex-1 bg-[#A7773F] text-[#F7F3EC] py-2 rounded-full font-heading text-sm hover:opacity-90 transition-opacity">Add {ADD_LABELS[activeTab]}</button>
            <button onClick={() => setAdding(false)} className="px-4 py-2 text-muted-foreground text-sm hover:text-foreground transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {activeTab === "bill" && (() => {
        const mk = monthKeyOf();
        const monthBills = items.filter((i) => i.type === "bill" && billInMonth(i, mk));
        const total = monthBills.reduce((s, b) => s + (Number(b.amount) || 0), 0);
        const paid = monthBills.filter(isPaid).reduce((s, b) => s + (Number(b.amount) || 0), 0);
        if (!monthBills.length) return null;
        const money0 = (n) => `$${Math.round(n).toLocaleString()}`;
        return (
          <div className="bg-card border border-border rounded-2xl px-4 py-3 mb-3">
            <div className="flex items-start justify-between text-xs text-muted-foreground">
              <div>{new Date().toLocaleDateString("en-US", { month: "long" })}<p className="font-heading text-[15px] text-foreground mt-0.5">{money0(total)} in bills</p></div>
              <div className="text-right">Paid so far<p className="font-heading text-[15px] mt-0.5" style={{ color: "#566033" }}>{money0(paid)}</p></div>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2.5"><div className="h-full rounded-full" style={{ width: `${total ? Math.min(100, (paid / total) * 100) : 0}%`, background: "#A7773F" }} /></div>
          </div>
        );
      })()}

      {activeTab === "loan" && <UpcomingLoans items={items} />}

      {activeTab === "credit_score" && <CreditAssistant scoreItems={items.filter(i => i.type === "credit_score")} />}
      {activeTab === "credit_score" && (
        <div className="bg-card border border-border rounded-2xl px-4 py-3 mb-3 flex items-center gap-2">
          <button onClick={() => setScoresOpen(v => !v)} className="flex-1 flex items-center gap-2 text-left">
            <span className="text-sm text-foreground">Scores you've added</span>
            <span className="text-xs text-muted-foreground">{items.filter(i => i.type === "credit_score").length}</span>
          </button>
          <button onClick={() => { setScoresOpen(true); openAdd("credit_score"); }} className="text-xs text-[#A7773F] font-medium">+ Add</button>
          <button onClick={() => setScoresOpen(v => !v)} aria-label={scoresOpen ? "Hide scores" : "Show scores"} className="text-muted-foreground">
            {scoresOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      )}

      {/* Items */}
      {activeTab !== "budget" && activeTab !== "spending" && !(activeTab === "credit_score" && !scoresOpen) && (
      <div className={`grid grid-cols-1 lg:grid-cols-2 ${activeTab === "bill" ? "gap-2" : "gap-3"} [&>*:only-child]:col-span-full`}>
        {tabItems.length === 0 && !adding && activeTab !== "summary" && (
          <div className="text-center py-10 text-muted-foreground bg-card border border-border rounded-2xl">
            <p className="font-heading text-base text-foreground">No {TAB_LABELS[activeTab].toLowerCase()} yet.</p>
            <p className="text-xs mt-1 mb-4">Add your first one to get started.</p>
            <button onClick={() => openAdd()} className="bg-[#A7773F] text-[#F7F3EC] rounded-full font-heading text-[13px] px-4 py-1.5">+ Add {ADD_LABELS[activeTab]}</button>
          </div>
        )}

        {tabItems.map((item, idx) => {
          const groupKey = activeTab === "bill" ? (item.type === "subscription" ? "subs" : item.is_fixed ? "fixed" : "variable") : null;
          const isCollapsed = groupKey && collapsed[groupKey];
          const showFixedHeader = activeTab === "bill" && item.type === "bill" && item.is_fixed && (idx === 0 || !tabItems[idx - 1]?.is_fixed || tabItems[idx - 1]?.type !== "bill");
          const showVariableHeader = activeTab === "bill" && item.type === "bill" && !item.is_fixed && (idx === 0 || tabItems[idx - 1]?.is_fixed || tabItems[idx - 1]?.type !== "bill");
          const showSubsHeader = activeTab === "bill" && item.type === "subscription" && (idx === 0 || tabItems[idx - 1]?.type !== "subscription");
          return (
          <Fragment key={item.id}>
            {showFixedHeader && (
              <div className="col-span-full">
                <button type="button" onClick={() => setCollapsed(c => ({ ...c, fixed: !c.fixed }))} className="flex items-center gap-1.5 w-full py-1">
                  {collapsed.fixed ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                  <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground">Fixed expenses</h3>
                  <span className="text-xs text-muted-foreground ml-auto">{tabItems.filter(i => i.type === "bill" && i.is_fixed).length} {tabItems.filter(i => i.type === "bill" && i.is_fixed).length === 1 ? "item" : "items"}</span>
                </button>
              </div>
            )}
            {showVariableHeader && (
              <div className="col-span-full">
                <button type="button" onClick={() => setCollapsed(c => ({ ...c, variable: !c.variable }))} className="flex items-center gap-1.5 w-full py-1">
                  {collapsed.variable ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                  <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground">Variable expenses</h3>
                  <span className="text-xs text-muted-foreground ml-auto">{tabItems.filter(i => i.type === "bill" && !i.is_fixed).length} {tabItems.filter(i => i.type === "bill" && !i.is_fixed).length === 1 ? "item" : "items"}</span>
                </button>
              </div>
            )}
            {showSubsHeader && (
              <div className="col-span-full">
                <button type="button" onClick={() => setCollapsed(c => ({ ...c, subs: !c.subs }))} className="flex items-center gap-1.5 w-full py-1">
                  {collapsed.subs ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                  <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground">Subscriptions</h3>
                  <span className="text-xs text-muted-foreground ml-auto">${subMonthlyEquivalent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo · ${Math.round(subMonthlyEquivalent * 12).toLocaleString()}/yr</span>
                </button>
              </div>
            )}
          {!isCollapsed && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {editingItemId === item.id ? (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-heading text-foreground">Edit</p>
                  <button onClick={() => setEditingItemId(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                </div>

                {item.type !== "credit_score" && (
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground mb-1.5">Move to</p>
                    <div className="flex flex-wrap gap-1.5">
                      {MOVE_KINDS.map(([k, label]) => (
                        <button key={k} onClick={() => currentKind(item) !== k && moveItem(item, k)}
                          className={`px-3 py-1 rounded-full text-[11px] ${currentKind(item) === k ? "bg-[#A7773F] text-[#F7F3EC]" : "border border-border text-muted-foreground hover:border-[#A7773F]"}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {item.type === "credit_score" && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Credit bureau</label>
                      <input value={editItemForm.bureau} onChange={e => setEditItemForm(f => ({ ...f, bureau: e.target.value }))} placeholder="e.g. Equifax" autoFocus
                        className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Current score</label>
                        <input type="number" value={editItemForm.score} onChange={e => setEditItemForm(f => ({ ...f, score: e.target.value }))} placeholder="720"
                          className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Target score</label>
                        <input type="number" value={editItemForm.target_score} onChange={e => setEditItemForm(f => ({ ...f, target_score: e.target.value }))} placeholder="750"
                          className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
                      </div>
                    </div>
                  </>
                )}

                {item.type === "savings_goal" && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Goal name</label>
                      <input value={editItemForm.name} onChange={e => setEditItemForm(f => ({ ...f, name: e.target.value }))} autoFocus
                        className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Amount saved</label>
                        <input type="number" value={editItemForm.current_amount} onChange={e => setEditItemForm(f => ({ ...f, current_amount: e.target.value }))}
                          className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Target amount</label>
                        <input type="number" value={editItemForm.target_amount} onChange={e => setEditItemForm(f => ({ ...f, target_amount: e.target.value }))}
                          className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
                      </div>
                    </div>
                  </>
                )}

                {item.type === "bill" && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Bill name</label>
                      <input value={editItemForm.name} onChange={e => setEditItemForm(f => ({ ...f, name: e.target.value }))} autoFocus
                        className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Amount</label>
                        <input type="number" value={editItemForm.amount} onChange={e => setEditItemForm(f => ({ ...f, amount: e.target.value }))}
                          className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
                      </div>
                      <div>
                        {editItemForm.recurrence && editItemForm.recurrence !== "one_time" && editItemForm.recurrence !== "yearly" ? (
                          <>
                            <label className="block text-xs font-medium text-foreground mb-1">Due day (1-31)</label>
                            <input type="number" min="1" max="31" value={editItemForm.due_day || ""} onChange={e => setEditItemForm(f => ({ ...f, due_day: e.target.value }))} placeholder="1"
                              className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
                          </>
                        ) : (
                          <>
                            <label className="block text-xs font-medium text-foreground mb-1">{editItemForm.recurrence === "yearly" ? "Renews on" : "Due date"}</label>
                            <DateInput value={editItemForm.due_date} onChange={e => setEditItemForm(f => ({ ...f, due_date: e.target.value }))}
                              className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
                          </>
                        )}
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                      <input type="checkbox" checked={editItemForm.paid} onChange={e => setEditItemForm(f => ({ ...f, paid: e.target.checked }))} className="rounded" />
                      Mark as paid
                    </label>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Category (optional)</label>
                      <select
                        value={editItemForm.category === "__new__" ? "__new__" : editItemForm.category || ""}
                        onChange={e => setEditItemForm(f => ({ ...f, category: e.target.value, customCategory: e.target.value === "__new__" ? (f.customCategory || "") : "" }))}
                        className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring"
                      >
                        <option value="">None</option>
                        {PRESET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        <option value="__new__">+ Add new category...</option>
                      </select>
                      {editItemForm.category === "__new__" && (
                        <input value={editItemForm.customCategory || ""} onChange={e => setEditItemForm(f => ({ ...f, customCategory: e.target.value }))} placeholder="Enter category name" autoFocus
                          className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring mt-2" />
                      )}
                    </div>
                    <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                      <input type="checkbox" checked={editItemForm.is_fixed || false} onChange={e => setEditItemForm(f => ({ ...f, is_fixed: e.target.checked }))} className="rounded" />
                      Fixed expense (auto-feeds budget)
                    </label>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Recurrence</label>
                      <select value={editItemForm.recurrence || "one_time"} onChange={e => setEditItemForm(f => ({ ...f, recurrence: e.target.value }))}
                        className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring">
                        {RECURRENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </>
                )}

                {item.type === "loan" && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Loan name</label>
                      <input value={editItemForm.name} onChange={e => setEditItemForm(f => ({ ...f, name: e.target.value }))} autoFocus
                        className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Monthly payment</label>
                        <input type="number" value={editItemForm.monthly_payment} onChange={e => setEditItemForm(f => ({ ...f, monthly_payment: e.target.value }))}
                          className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Total amount</label>
                        <input type="number" value={editItemForm.total_amount} onChange={e => setEditItemForm(f => ({ ...f, total_amount: e.target.value }))}
                          className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Amount paid</label>
                        <input type="number" value={editItemForm.amount_paid} onChange={e => setEditItemForm(f => ({ ...f, amount_paid: e.target.value }))}
                          className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Due date</label>
                        <DateInput value={editItemForm.due_date} onChange={e => setEditItemForm(f => ({ ...f, due_date: e.target.value }))}
                          className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                      <input type="checkbox" checked={editItemForm.paid} onChange={e => setEditItemForm(f => ({ ...f, paid: e.target.checked }))} className="rounded" />
                      Mark as paid this month
                    </label>
                  </>
                )}

                {item.type === "subscription" && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Subscription name</label>
                      <input value={editItemForm.name} onChange={e => setEditItemForm(f => ({ ...f, name: e.target.value }))} autoFocus
                        className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Amount</label>
                        <input type="number" value={editItemForm.amount} onChange={e => setEditItemForm(f => ({ ...f, amount: e.target.value }))}
                          className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Billing cycle</label>
                        <select value={editItemForm.billing_cycle} onChange={e => setEditItemForm(f => ({ ...f, billing_cycle: e.target.value }))}
                          className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring">
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                          <option value="quarterly">Quarterly</option>
                          <option value="yearly">Yearly</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Renewal date</label>
                      <DateInput value={editItemForm.renewal_date} onChange={e => setEditItemForm(f => ({ ...f, renewal_date: e.target.value }))}
                        className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
                    </div>
                  </>
                )}

                <div className="flex gap-2">
                  <button onClick={() => saveEditItem(item)} className="flex-1 bg-[#A7773F] text-[#F7F3EC] py-2 rounded-full font-heading text-sm hover:opacity-90 transition-opacity">Save</button>
                  <button onClick={() => setEditingItemId(null)} className="px-4 py-2 text-muted-foreground text-sm hover:text-foreground transition-colors">Cancel</button>
                </div>
              </div>
            ) : (item.type === "bill" || item.type === "subscription") ? (
              (() => {
                const isBill = item.type === "bill";
                const due = isBill ? dueInfo(item) : null;
                const amt = Number(item.amount) || 0;
                const yearly = item.billing_cycle === "yearly";
                const subLine = isBill
                  ? due.label
                  : item.renewal_date
                    ? `Renews ${fmtDate(item.renewal_date)}${yearly ? ` · ≈$${Math.round(monthlyEquivalent(item))}/mo` : ""}`
                    : `${(item.billing_cycle || "monthly").replace(/^./, (c) => c.toUpperCase())}${yearly ? ` · ≈$${Math.round(monthlyEquivalent(item))}/mo` : ""}`;
                return (
                  <div className="flex items-center gap-3 px-4 py-3">
                    {isBill && (
                      <button
                        onClick={() => togglePaid(item)}
                        aria-label={due.tone === "paid" ? "Mark unpaid" : "Mark paid"}
                        className={`w-[22px] h-[22px] rounded-full border flex items-center justify-center flex-shrink-0 ${due.tone === "paid" ? "bg-[#566033] border-[#566033]" : "border-[#CFC7B8]"}`}
                      >
                        {due.tone === "paid" && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                      </button>
                    )}
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openEditItem(item)}>
                      <p className="text-[14.5px] text-foreground truncate">{item.name}
                        {isBill && item.is_fixed && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-[#F3E8D6] text-[#8A5F27] align-middle">Fixed</span>}
                        {!isBill && needsReview(item) && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-[#F4E6E7] text-[#8F5F65] align-middle">Review</span>}
                      </p>
                      <p className={`text-[11.5px] ${isBill ? TONE_CLASS[due.tone] : "text-muted-foreground"}`}>{subLine}</p>
                    </div>
                    <span className="font-heading text-[14px] text-foreground flex-shrink-0">${amt.toLocaleString(undefined, { minimumFractionDigits: Number.isInteger(amt) ? 0 : 2, maximumFractionDigits: 2 })}{!isBill && yearly ? "/yr" : ""}</span>
                    <RowMenu open={menuId === item.id} onToggle={() => setMenuId(menuId === item.id ? null : item.id)} onClose={() => setMenuId(null)}>
                      <button className={menuBtn} onClick={() => { setMenuId(null); openEditItem(item); }}><Pencil className="w-3.5 h-3.5" /> Edit</button>
                      {!isBill && <button className={menuBtn} onClick={async () => { setMenuId(null); await ent.FinanceItem.update(item.id, { reviewed_at: new Date().toISOString() }); load(); }}><Check className="w-3.5 h-3.5" /> Still using it</button>}
                      {!isBill && <button className={menuBtn} onClick={async () => { setMenuId(null); if (confirm(`Mark ${item.name} as canceled? It stays on record but stops counting in your totals.`)) { await ent.FinanceItem.update(item.id, { canceled_on: new Date().toISOString().slice(0, 10) }); load(); } }}><X className="w-3.5 h-3.5" /> Cancel subscription</button>}
                      <button className={`${menuBtn} text-[#8F5F65]`} onClick={() => { setMenuId(null); if (confirm(`Delete ${item.name}?`)) remove(item.id); }}><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                    </RowMenu>
                  </div>
                );
              })()
            ) : (
              <div
                className="p-4 cursor-pointer"
                onClick={() => {
                  if (item.type === "savings_goal" || item.type === "bill" || item.type === "loan" || item.type === "subscription") openEditItem(item);
                  else toggleExpand(item);
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-heading text-base text-foreground">{item.name}</p>
                      {item.type === "loan" && item.subtype === "credit_card" && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F0E6D6] text-[#8B6B3E] font-body">Credit card</span>}
                      {item.type === "credit_score" && (
                        <span className="text-muted-foreground">
                          {expandedItem?.id === item.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </span>
                      )}
                    </div>

                    {item.type === "credit_score" && (() => {
                      const sc = Number(item.score) || 0;
                      const hist = Array.isArray(item.score_history) ? item.score_history : [];
                      const prev = [...hist].reverse().find((h) => h.score !== sc);
                      const delta = prev && sc ? sc - prev.score : null;
                      const rating = sc ? scoreRating(sc) : null;
                      const toGo = item.target_score && sc ? Math.max(0, item.target_score - sc) : null;
                      return (
                        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2.5">
                            <span className="font-heading text-[22px] leading-none text-foreground">{sc || "—"}</span>
                            {rating && <span className={`text-[11px] px-2 py-0.5 rounded-full ${rating.cls}`}>{rating.label}</span>}
                            {delta != null && delta !== 0 && <span className={`text-[12px] font-medium ${delta > 0 ? "text-[#566033]" : "text-[#8F5F65]"}`}>{delta > 0 ? "▲" : "▼"} {Math.abs(delta)}</span>}
                          </div>
                          {sc > 0 && (
                            <div className="relative mt-3 h-1.5 rounded-full" style={{ background: "linear-gradient(90deg,#E7CFD2,#F3E8D6 45%,#CFD8B5)" }}>
                              <span className="absolute -top-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow" style={{ background: "#A7773F", left: `calc(${Math.min(100, Math.max(0, ((sc - 300) / 550) * 100))}% - 7px)` }} />
                              {item.target_score && <span className="absolute -top-0.5 w-0.5 h-2.5 bg-foreground/60" style={{ left: `${Math.min(100, Math.max(0, ((item.target_score - 300) / 550) * 100))}%` }} />}
                            </div>
                          )}
                          <div className="flex items-center justify-between text-[11.5px] text-muted-foreground mt-2">
                            <span>{toGo != null ? (toGo > 0 ? `${toGo} points to your ${item.target_score} target` : `Target of ${item.target_score} reached`) : "Add a target to track progress"}</span>
                            {item.score_updated && <span>Updated {fmtDate(item.score_updated)}</span>}
                          </div>
                          {scoreId === item.id ? (
                            <div className="flex items-center gap-2 mt-2">
                              <input type="number" inputMode="numeric" autoFocus value={scoreVal} onChange={(e) => setScoreVal(e.target.value)} placeholder="New score"
                                className="w-28 bg-secondary border border-input rounded-lg px-2 py-1.5 text-sm outline-none focus:border-ring" />
                              <button onClick={async () => { const v = Number(scoreVal); if (v >= 300 && v <= 850) { await ent.FinanceItem.update(item.id, withHistory(item, v)); load(); } setScoreId(null); }}
                                className="text-xs text-white rounded-full px-3.5 py-1.5" style={{ background: "#A7773F" }}>Save</button>
                              <button onClick={() => setScoreId(null)} className="text-xs text-muted-foreground">Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => { setScoreId(item.id); setScoreVal(""); }} className="text-xs font-medium mt-2" style={{ color: "#A7773F" }}>+ Update score</button>
                          )}
                        </div>
                      );
                    })()}

                    {item.type === "savings_goal" && (
                      <div className="mt-2">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="font-heading text-base text-foreground">${(item.current_amount || 0).toLocaleString()}</span>
                          {item.target_amount && <span className="text-xs text-muted-foreground">of ${Number(item.target_amount).toLocaleString()}</span>}
                        </div>
                        {item.target_amount && (
                          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ background: "#A7773F", width: `${Math.min(((item.current_amount || 0) / item.target_amount) * 100, 100)}%` }} />
                          </div>
                        )}
                        {item.target_amount && (
                          <p className="text-[11.5px] text-muted-foreground mt-1.5">{Math.round(Math.min(((item.current_amount || 0) / item.target_amount) * 100, 100))}% · ${Math.max(0, item.target_amount - (item.current_amount || 0)).toLocaleString()} to go</p>
                        )}
                        {contribId === item.id ? (
                          <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                            <input type="number" inputMode="decimal" autoFocus value={contribAmt} onChange={(e) => setContribAmt(e.target.value)} placeholder="Amount"
                              className="w-28 bg-secondary border border-input rounded-lg px-2 py-1.5 text-sm outline-none focus:border-ring" />
                            <button
                              onClick={async () => { const v = Number(contribAmt); if (v > 0) { await ent.FinanceItem.update(item.id, { current_amount: (item.current_amount || 0) + v }); load(); } setContribId(null); }}
                              className="text-xs text-white rounded-full px-3.5 py-1.5" style={{ background: "#A7773F" }}>Add</button>
                            <button onClick={() => setContribId(null)} className="text-xs text-muted-foreground">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); setContribId(item.id); setContribAmt(""); }} className="text-xs mt-2 font-medium" style={{ color: "#A7773F" }}>+ Add contribution</button>
                        )}
                      </div>
                    )}

                    {item.type === "bill" && (
                      <div className="mt-1">
                        <div className="flex items-center gap-3">
                          {item.amount && <span className="font-heading text-[14px] text-foreground">${Number(item.amount).toLocaleString()}</span>}
                          {item.is_fixed && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F0E6D6] text-[#8B6B3E] font-body">Fixed</span>}
                          {item.billing_cycle && item.billing_cycle !== "one_time" && item.billing_cycle !== "yearly" && item.due_day
                            ? <span className="text-xs text-muted-foreground">Day {item.due_day}</span>
                            : item.due_date && <span className="text-xs text-muted-foreground">Due {fmtDate(item.due_date)}</span>}
                          <button
                            onClick={(e) => { e.stopPropagation(); togglePaid(item); }}
                            className={`ml-auto text-xs px-2.5 py-1 rounded-full border transition-colors ${item.paid ? "bg-[#F0E6D6] text-[#8B6B3E] border-[#E3D2B6]" : "bg-transparent text-muted-foreground border-border hover:border-[#A7773F]"}`}
                          >
                            {item.paid ? "✓ Paid" : "Mark paid"}
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{item.billing_cycle && item.billing_cycle !== "one_time" ? <span className="capitalize">{item.billing_cycle}{item.billing_cycle === "yearly" ? (item.due_date ? ` · ${new Date(item.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "") : item.due_day ? ` · Day ${item.due_day}` : ""}</span> : null}</p>
                      </div>
                    )}

                    {item.type === "loan" && <LoanDetails item={item} onChange={load} />}

                    {item.type === "subscription" && (
                      <div className="mt-1">
                        {item.amount && <p className="font-heading text-base text-foreground">${Number(item.amount).toLocaleString()}</p>}
                        <p className="text-xs text-muted-foreground capitalize">{item.billing_cycle || "monthly"}{item.renewal_date ? ` · Renews ${fmtDate(item.renewal_date)}` : ""}</p>
                      </div>
                    )}
                  </div>

                  <RowMenu open={menuId === item.id} onToggle={() => setMenuId(menuId === item.id ? null : item.id)} onClose={() => setMenuId(null)}>
                    <button className={menuBtn} onClick={() => { setMenuId(null); openEditItem(item); }}><Pencil className="w-3.5 h-3.5" /> Edit</button>
                    {item.type === "savings_goal" && <button className={menuBtn} onClick={() => { setMenuId(null); setContribId(item.id); setContribAmt(""); }}><Plus className="w-3.5 h-3.5" /> Add contribution</button>}
                    <button className={`${menuBtn} text-[#8F5F65]`} onClick={() => { setMenuId(null); if (confirm(`Delete ${item.name}?`)) remove(item.id); }}><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                  </RowMenu>
                </div>
              </div>
            )}

            {/* Notes - only for credit_score when expanded */}
            {item.type === "credit_score" && expandedItem?.id === item.id && editingItemId !== item.id && (
              <div className="border-t border-border bg-secondary p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-heading text-sm text-foreground">Notes</h3>
                  {editingNotes !== item.id && (
                    <button onClick={() => setEditingNotes(item.id)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                  )}
                </div>
                {editingNotes === item.id ? (
                  <div className="space-y-2">
                    <ReactQuill value={notesContent} onChange={setNotesContent} className="bg-card rounded-lg quill-notes" theme="snow" />
                    <div className="flex gap-2">
                      <button onClick={() => saveNotes(item)} className="bg-[#A7773F] text-[#F7F3EC] px-3.5 py-1.5 rounded-full text-xs hover:opacity-90 transition-colors">Save</button>
                      <button onClick={() => { setEditingNotes(null); setNotesContent(item.notes || ""); }} className="px-3 py-1.5 text-muted-foreground text-xs hover:text-foreground transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-foreground quill-render" dangerouslySetInnerHTML={{ __html: item.notes || "<p class='text-muted-foreground'>No notes yet</p>" }} />
                )}
              </div>
            )}
          </div>
          )}
          </Fragment>
          );
        })}
      </div>
      )}
      {activeTab === "bill" && items.some(i => i.type === "subscription" && isCanceled(i)) && (() => {
        const canceled = items.filter(i => i.type === "subscription" && isCanceled(i));
        const saved = canceled.reduce((t, x) => t + monthlyEquivalent(x), 0);
        return (
          <div className="mt-3">
            <button type="button" onClick={() => setCollapsed(c => ({ ...c, canceled: !c.canceled }))} className="flex items-center gap-1.5 w-full py-1">
              {collapsed.canceled === false ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
              <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground">Canceled</h3>
              <span className="text-xs text-muted-foreground ml-auto">Saving ${saved.toLocaleString(undefined, { maximumFractionDigits: 2 })}/mo · ${Math.round(saved * 12).toLocaleString()}/yr</span>
            </button>
            {collapsed.canceled === false && (
              <div className="bg-card border border-border rounded-2xl divide-y divide-border/50 mt-1">
                {canceled.map(c => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-[14.5px] text-muted-foreground line-through truncate">{c.name}</p>
                      <p className="text-[11.5px] text-muted-foreground">Canceled {fmtDate(c.canceled_on)} · was ${Number(c.amount || 0).toLocaleString()}/{c.billing_cycle === "yearly" ? "yr" : c.billing_cycle === "quarterly" ? "qtr" : c.billing_cycle === "weekly" ? "wk" : "mo"}</p>
                    </div>
                    <RowMenu open={menuId === c.id} onToggle={() => setMenuId(menuId === c.id ? null : c.id)} onClose={() => setMenuId(null)}>
                      <button className={menuBtn} onClick={async () => { setMenuId(null); await ent.FinanceItem.update(c.id, { canceled_on: null }); load(); }}><Check className="w-3.5 h-3.5" /> Restore</button>
                      <button className={`${menuBtn} text-[#8F5F65]`} onClick={() => { setMenuId(null); if (confirm(`Delete ${c.name}?`)) remove(c.id); }}><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                    </RowMenu>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
    </div>
    </>
  );
}