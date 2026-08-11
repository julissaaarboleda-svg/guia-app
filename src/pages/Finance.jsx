import { useState, useEffect, Fragment } from "react";
import { base44 } from "@/api/base44Client";
import { Trash2, Check, ChevronDown, ChevronUp, ChevronRight, Pencil, X } from "lucide-react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import ActionCircle from "@/components/ActionCircle";
import PageHeader from "@/components/PageHeader";

import BudgetTab from "@/components/finance/BudgetTab";
import FinanceSummary from "@/components/finance/FinanceSummary";

const TABS = ["summary", "bill", "budget", "savings_goal", "loan", "credit_score"];

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
const TAB_LABELS = { summary: "Summary", credit_score: "Credit Scores", savings_goal: "Savings Goals", bill: "Bills", loan: "Loans", subscription: "Subscriptions", budget: "Budget" };
const TAB_EMOJIS = { summary: "📈", credit_score: "📊", savings_goal: "🏦", bill: "📋", loan: "💳", subscription: "🔄", budget: "💰" };

export default function Finance() {
  const [items, setItems] = useState([]);
  const [buckets, setBuckets] = useState([]);
  const [activeTab, setActiveTab] = useState("summary");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({});
  const [expandedItem, setExpandedItem] = useState(null);
  const [editingNotes, setEditingNotes] = useState(null);
  const [notesContent, setNotesContent] = useState("");
  const [editingItemId, setEditingItemId] = useState(null);
  const [editItemForm, setEditItemForm] = useState({});
  const [collapsed, setCollapsed] = useState({});

  const load = async () => {
    const [i, b] = await Promise.all([
      base44.entities.FinanceItem.list("-created_date"),
      base44.entities.BudgetBucket.list("-created_date"),
    ]);
    setItems(i);
    setBuckets(b);
  };

  useEffect(() => { load(); }, []);

  const tabItems = activeTab === "bill"
    ? items.filter(i => i.type === "bill" || i.type === "subscription")
    : items.filter(i => i.type === activeTab);
  if (activeTab === "bill") {
    tabItems.sort((a, b) => {
      if (a.type !== b.type) return a.type === "bill" ? -1 : 1;
      if (a.type === "bill") return (b.is_fixed ? 1 : 0) - (a.is_fixed ? 1 : 0);
      return 0;
    });
  }
  const subMonthlyEquivalent = items
    .filter(i => i.type === "subscription")
    .reduce((sum, sub) => {
      const amt = sub.amount || 0;
      if (sub.billing_cycle === "yearly") return sum + amt / 12;
      if (sub.billing_cycle === "quarterly") return sum + amt / 3;
      if (sub.billing_cycle === "weekly") return sum + amt * 4.33;
      return sum + amt;
    }, 0);

  const openAdd = () => {
    setForm({ type: activeTab, subType: "bill", name: "", score: "", target_score: "", bureau: "", current_amount: "", target_amount: "", amount: "", due_date: "", paid: false, monthly_payment: "", total_amount: "", amount_paid: "", billing_cycle: "monthly", renewal_date: "",       is_fixed: false, category: "", customCategory: "", recurrence: "one_time", due_day: "", addToBudget: false });
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
          data.due_day = form.due_day ? Number(form.due_day) : null;
          data.due_date = null;
        }
      }
    }
    await base44.entities.FinanceItem.create(data);
    if (formType === "bill" && form.recurrence === "one_time" && form.addToBudget && data.amount) {
      const mk = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
      await base44.entities.BudgetBucket.create({
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
    await base44.entities.FinanceItem.delete(id);
    load();
  };

  const togglePaid = async (item) => {
    await base44.entities.FinanceItem.update(item.id, { paid: !item.paid });
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
    await base44.entities.FinanceItem.update(item.id, { notes: notesContent });
    setEditingNotes(null);
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
      paid: item.paid || false,
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
      data.target_score = Number(editItemForm.target_score) || null;
    } else if (item.type === "savings_goal") {
      data.current_amount = Number(editItemForm.current_amount) || 0;
      data.target_amount = Number(editItemForm.target_amount) || null;
    } else if (item.type === "bill") {
      data.amount = Number(editItemForm.amount) || null;
      data.due_date = editItemForm.due_date || null;
      data.paid = editItemForm.paid;
      data.is_fixed = editItemForm.is_fixed || false;
      data.category = editItemForm.category === "__new__" ? (editItemForm.customCategory || "") : (editItemForm.category || "");
      data.billing_cycle = editItemForm.recurrence || "one_time";
      if (editItemForm.recurrence && editItemForm.recurrence !== "one_time") {
        data.due_day = editItemForm.due_day ? Number(editItemForm.due_day) : null;
        data.due_date = null;
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
    await base44.entities.FinanceItem.update(item.id, data);
    setEditingItemId(null);
    load();
  };

  const getScoreColor = (score) => {
    if (!score) return "text-muted-foreground";
    if (score >= 750) return "text-foreground";
    if (score >= 670) return "text-muted-foreground";
    return "text-destructive";
  };

  return (
    <>
      <div className="max-w-[1200px] mx-auto w-full">
      <PageHeader title="Finance" subtitle="Your financial picture" />
      <div className="p-6 md:p-8 pb-28">

      {/* Tabs */}
      <div className="sticky top-[71px] md:top-[75px] z-20 bg-background -mx-6 md:-mx-8 px-6 md:px-8 flex flex-wrap gap-x-5 gap-y-1 border-b border-border mb-6">
        {TABS.map(t => (
          <button key={t} onClick={() => { setActiveTab(t); setAdding(false); setEditingItemId(null); }}
            className={`pb-2.5 text-sm transition-colors border-b-2 -mb-[1px] whitespace-nowrap ${
              activeTab === t
                ? "border-foreground text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Summary tab */}
      {activeTab === "summary" && (
        <FinanceSummary items={items} buckets={buckets} onNavigate={(t) => { setActiveTab(t); setAdding(false); setEditingItemId(null); }} />
      )}

      {/* Budget tab — self-contained */}
      {activeTab === "budget" && <BudgetTab />}

      {/* Add button */}
      {activeTab !== "budget" && activeTab !== "summary" && (
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-foreground">{TAB_LABELS[activeTab]}</h2>
      </div>
      )}

      {/* Add form */}
      {adding && activeTab !== "budget" && (
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
              <button onClick={() => setForm(f => ({ ...f, subType: "bill" }))} className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${form.subType !== "subscription" ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"}`}>Bill</button>
              <button onClick={() => setForm(f => ({ ...f, subType: "subscription" }))} className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${form.subType === "subscription" ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"}`}>Subscription</button>
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
                  {form.recurrence && form.recurrence !== "one_time" ? (
                    <>
                      <label className="block text-xs font-medium text-foreground mb-1">Due day (1-31)</label>
                      <input type="number" min="1" max="31" value={form.due_day || ""} onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))} placeholder="1"
                        className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors" />
                    </>
                  ) : (
                    <>
                      <label className="block text-xs font-medium text-foreground mb-1">Due date</label>
                      <input type="date" value={form.due_date || ""} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
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
                  <input type="date" value={form.due_date || ""} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
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
                <input type="date" value={form.renewal_date || ""} onChange={e => setForm(f => ({ ...f, renewal_date: e.target.value }))}
                  className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Notes (optional)</label>
                <ReactQuill value={form.notes || ""} onChange={(value) => setForm(f => ({ ...f, notes: value }))} placeholder="Add notes..." className="bg-secondary rounded-lg quill-notes" theme="snow" />
              </div>
            </>
          )}

          <div className="flex gap-2">
            <button onClick={add} className="flex-1 bg-foreground text-background py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-colors">Add</button>
            <button onClick={() => setAdding(false)} className="px-4 py-2 text-muted-foreground text-sm hover:text-foreground transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Items */}
      {activeTab !== "budget" && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {tabItems.length === 0 && !adding && (
          <div className="text-center py-10 text-muted-foreground bg-card border border-border rounded-2xl">
            <p className="text-2xl mb-2">{TAB_EMOJIS[activeTab]}</p>
            <p className="text-sm">No {TAB_LABELS[activeTab].toLowerCase()} yet.</p>
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
                  <h3 className="font-heading text-sm text-foreground">Fixed Expenses</h3>
                  <span className="text-xs text-muted-foreground ml-auto">{tabItems.filter(i => i.type === "bill" && i.is_fixed).length} items</span>
                </button>
              </div>
            )}
            {showVariableHeader && (
              <div className="col-span-full">
                <button type="button" onClick={() => setCollapsed(c => ({ ...c, variable: !c.variable }))} className="flex items-center gap-1.5 w-full py-1">
                  {collapsed.variable ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                  <h3 className="font-heading text-sm text-foreground">Variable Expenses</h3>
                  <span className="text-xs text-muted-foreground ml-auto">{tabItems.filter(i => i.type === "bill" && !i.is_fixed).length} items</span>
                </button>
              </div>
            )}
            {showSubsHeader && (
              <div className="col-span-full">
                <button type="button" onClick={() => setCollapsed(c => ({ ...c, subs: !c.subs }))} className="flex items-center gap-1.5 w-full py-1">
                  {collapsed.subs ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                  <h3 className="font-heading text-sm text-foreground">Subscriptions</h3>
                  <span className="text-xs text-muted-foreground ml-auto">${subMonthlyEquivalent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo</span>
                </button>
              </div>
            )}
          {!isCollapsed && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {editingItemId === item.id ? (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-heading text-foreground">Edit</p>
                  <button onClick={() => setEditingItemId(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                </div>

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
                        {editItemForm.recurrence && editItemForm.recurrence !== "one_time" ? (
                          <>
                            <label className="block text-xs font-medium text-foreground mb-1">Due day (1-31)</label>
                            <input type="number" min="1" max="31" value={editItemForm.due_day || ""} onChange={e => setEditItemForm(f => ({ ...f, due_day: e.target.value }))} placeholder="1"
                              className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
                          </>
                        ) : (
                          <>
                            <label className="block text-xs font-medium text-foreground mb-1">Due date</label>
                            <input type="date" value={editItemForm.due_date} onChange={e => setEditItemForm(f => ({ ...f, due_date: e.target.value }))}
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
                        <input type="date" value={editItemForm.due_date} onChange={e => setEditItemForm(f => ({ ...f, due_date: e.target.value }))}
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
                      <input type="date" value={editItemForm.renewal_date} onChange={e => setEditItemForm(f => ({ ...f, renewal_date: e.target.value }))}
                        className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
                    </div>
                  </>
                )}

                <div className="flex gap-2">
                  <button onClick={() => saveEditItem(item)} className="flex-1 bg-foreground text-background py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-colors">Save</button>
                  <button onClick={() => setEditingItemId(null)} className="px-4 py-2 text-muted-foreground text-sm hover:text-foreground transition-colors">Cancel</button>
                </div>
              </div>
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
                      <p className="font-medium text-foreground">{item.name}</p>
                      {item.type === "credit_score" && (
                        <span className="text-muted-foreground">
                          {expandedItem?.id === item.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </span>
                      )}
                    </div>

                    {item.type === "credit_score" && (
                      <div className="mt-2">
                        {item.bureau && <p className="text-xs text-muted-foreground mb-1">{item.bureau}</p>}
                        <div className="flex items-baseline gap-2">
                          <span className={`text-2xl font-bold ${getScoreColor(item.score)}`}>{item.score || "—"}</span>
                          {item.target_score && <span className="text-xs text-muted-foreground">target: {item.target_score}</span>}
                        </div>
                        {item.score && item.target_score && (
                          <div className="mt-2 w-full h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-foreground rounded-full" style={{ width: `${Math.min((item.score / item.target_score) * 100, 100)}%` }} />
                          </div>
                        )}
                      </div>
                    )}

                    {item.type === "savings_goal" && (
                      <div className="mt-2">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-lg font-bold text-foreground">${(item.current_amount || 0).toLocaleString()}</span>
                          {item.target_amount && <span className="text-xs text-muted-foreground">of ${Number(item.target_amount).toLocaleString()}</span>}
                        </div>
                        {item.target_amount && (
                          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-accent rounded-full" style={{ width: `${Math.min(((item.current_amount || 0) / item.target_amount) * 100, 100)}%` }} />
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-1.5">Tap to edit</p>
                      </div>
                    )}

                    {item.type === "bill" && (
                      <div className="mt-1">
                        <div className="flex items-center gap-3">
                          {item.amount && <span className="text-foreground font-semibold">${Number(item.amount).toLocaleString()}</span>}
                          {item.is_fixed && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-foreground text-background font-body">Fixed</span>}
                          {item.billing_cycle && item.billing_cycle !== "one_time" && <span className="text-[10px] text-muted-foreground capitalize">{item.billing_cycle}</span>}
                          {item.billing_cycle && item.billing_cycle !== "one_time" && item.due_day
                            ? <span className="text-xs text-muted-foreground">Day {item.due_day}</span>
                            : item.due_date && <span className="text-xs text-muted-foreground">Due {fmtDate(item.due_date)}</span>}
                          <button
                            onClick={(e) => { e.stopPropagation(); togglePaid(item); }}
                            className={`ml-auto text-xs px-2 py-0.5 rounded-full border transition-colors ${item.paid ? "bg-muted text-foreground border-border" : "bg-secondary text-muted-foreground border-input hover:border-ring"}`}
                          >
                            {item.paid ? "✓ Paid" : "Mark paid"}
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{item.billing_cycle && item.billing_cycle !== "one_time" ? <span className="capitalize">{item.billing_cycle}{item.due_day ? ` · Day ${item.due_day}` : ""}</span> : "Tap to edit"}</p>
                      </div>
                    )}

                    {item.type === "loan" && (() => {
                      const paidPct = item.total_amount > 0 ? Math.min(((item.amount_paid || 0) / item.total_amount) * 100, 100) : 0;
                      return (
                        <div className="mt-2">
                          {item.monthly_payment && <p className="text-xs text-muted-foreground mb-1">Monthly: ${Number(item.monthly_payment).toLocaleString()}</p>}
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-lg font-bold text-foreground">${Number(item.amount_paid || 0).toLocaleString()}</span>
                            {item.total_amount && <span className="text-xs text-muted-foreground">of ${Number(item.total_amount).toLocaleString()}</span>}
                          </div>
                          {item.total_amount && (
                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-accent rounded-full" style={{ width: `${paidPct}%` }} />
                            </div>
                          )}
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-xs text-muted-foreground">{Math.round(paidPct)}% paid off</span>
                            {item.due_date && <span className="text-xs text-muted-foreground">Due {fmtDate(item.due_date)}</span>}
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); togglePaid(item); }}
                            className={`mt-2 text-xs px-2 py-0.5 rounded-full border transition-colors ${item.paid ? "bg-muted text-foreground border-border" : "bg-secondary text-muted-foreground border-input hover:border-ring"}`}
                          >
                            {item.paid ? "✓ Paid" : "Mark paid"}
                          </button>
                        </div>
                      );
                    })()}

                    {item.type === "subscription" && (
                      <div className="mt-1">
                        {item.amount && <p className="text-lg font-bold text-foreground">${Number(item.amount).toLocaleString()}</p>}
                        <p className="text-xs text-muted-foreground capitalize">{item.billing_cycle || "monthly"}{item.renewal_date ? ` · Renews ${fmtDate(item.renewal_date)}` : ""}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => openEditItem(item)} className="text-muted-foreground/60 hover:text-foreground transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => remove(item.id)} className="text-muted-foreground/40 hover:text-rose-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Notes - only for credit_score when expanded */}
            {item.type === "credit_score" && expandedItem?.id === item.id && editingItemId !== item.id && (
              <div className="border-t border-border bg-secondary p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-foreground">Notes</h3>
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
                      <button onClick={() => saveNotes(item)} className="bg-foreground text-background px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90 transition-colors">Save</button>
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
    </div>
    </div>
      {activeTab !== "budget" && activeTab !== "summary" && <ActionCircle onClick={openAdd} label="Add item" />}
    </>
  );
}