"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BanknoteArrowDown,
  BanknoteArrowUp,
  FileSpreadsheet,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  TrendingUp,
  type LucideIcon,
  Upload,
  X
} from "lucide-react";
import InternalShell from "@/components/InternalShell";
import {
  clearToken,
  getFinanceCategories,
  getFinanceDashboard,
  getProfile,
  getToken,
  listFinanceImports,
  listFinanceRules,
  listFinanceTransactions,
  bulkUpdateFinanceTransactionClassification,
  updateFinanceRule,
  updateFinanceTransactionClassification,
  uploadBankStatement,
  type FinanceClassificationRule,
  type FinanceDashboard,
  type FinanceImport,
  type FinanceProfitabilityPeriod,
  type FinanceSummary,
  type FinanceTransaction,
  type UserProfile
} from "@/lib/api";

type FinanceView = "overview" | "upload" | "review" | "transactions" | "rules" | "whatif";
type Banner = { type: "ok" | "error"; message: string } | null;
type TransactionLoadOptions = {
  cashflowFilter?: string;
  directionFilter?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
  needsReview?: boolean;
};

const EMPTY_SUMMARY: FinanceSummary = {
  total_inflow: 0,
  total_outflow: 0,
  net_cash_movement: 0,
  customer_receipts: 0,
  supplier_payments: 0,
  salary_cost: 0,
  operating_expenses: 0,
  tax_payments: 0,
  bank_charges: 0,
  interest_income: 0,
  investor_investments: 0,
  loan_disbursements: 0,
  loan_repayments: 0,
  loan_interest: 0,
  unclassified_inflow: 0,
  unclassified_outflow: 0,
  transaction_count: 0,
  needs_review_count: 0
};

const EMPTY_DASHBOARD: FinanceDashboard = {
  summary: EMPTY_SUMMARY,
  monthly: [],
  profitability: null,
  groups: [],
  top_counterparties: []
};

const DEFAULT_CASHFLOW_GROUPS = [
  "CUSTOMER_RECEIPT",
  "SUPPLIER_PAYMENT",
  "SALARY",
  "OPERATING_EXPENSE",
  "TAX",
  "BANK_CHARGE",
  "INTERNAL_TRANSFER",
  "INTEREST_INCOME",
  "INVESTOR_INVESTMENT",
  "LOAN_DISBURSEMENT",
  "LOAN_REPAYMENT",
  "LOAN_INTEREST",
  "OTHER_INCOME",
  "OTHER_EXPENSE",
  "UNCLASSIFIED"
];

const COUNTERPARTY_TYPES = ["CUSTOMER", "SUPPLIER", "EMPLOYEE", "BANK", "GOVERNMENT", "INTERNAL", "INVESTOR", "UNKNOWN"];

const DEFAULT_PL_CATEGORIES = [
  "Customer receipts",
  "Goods purchase",
  "Salary cost",
  "Travel and conveyance",
  "Operating expense",
  "Statutory and tax payments",
  "Bank charges",
  "Internal transfer",
  "Interest income",
  "Investor investment",
  "Loan received",
  "Loan principal repayment",
  "Loan interest expense",
  "Other income",
  "Other expense",
  "Unclassified inflow",
  "Unclassified outflow"
];

function normalizeRole(role?: string | null) {
  return String(role || "").toUpperCase().replace(/-/g, "_").trim();
}

function canAccessFinance(user?: UserProfile | null) {
  const roles = [normalizeRole(user?.role), ...(user?.roles || []).map(normalizeRole)].filter(Boolean);
  return roles.includes("SUPERADMIN");
}

function pretty(value?: string | null) {
  return String(value || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function money(value?: number | string | null) {
  const amount = Number(value || 0);
  return amount.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  });
}

function percent(value?: number | string | null) {
  const amount = Number(value || 0);
  return `${amount.toFixed(1)}%`;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN");
}

function formatMonth(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function statusClass(value?: string | null) {
  const normalized = normalizeRole(value);
  if (["IMPORTED", "CUSTOMER_RECEIPT", "INTEREST_INCOME"].includes(normalized)) return "good";
  if (["UNCLASSIFIED", "PENDING", "INTERNAL_TRANSFER"].includes(normalized)) return "warn";
  if (["FAILED"].includes(normalized)) return "bad";
  return "";
}

function numberField(form: FormData, key: string, fallback = 0) {
  const value = form.get(key);
  if (typeof value !== "string" || !value.trim()) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionsWithCurrent(options: string[], current?: string | null) {
  const seen = new Set<string>();
  return [...options, current || ""]
    .map((item) => item.trim())
    .filter((item) => {
      const key = item.toLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export default function FinancePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [view, setView] = useState<FinanceView>("overview");
  const [dashboard, setDashboard] = useState<FinanceDashboard>(EMPTY_DASHBOARD);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [imports, setImports] = useState<FinanceImport[]>([]);
  const [rules, setRules] = useState<FinanceClassificationRule[]>([]);
  const [cashflowGroups, setCashflowGroups] = useState(DEFAULT_CASHFLOW_GROUPS);
  const [plCategories, setPlCategories] = useState(DEFAULT_PL_CATEGORIES);
  const [selectedTransaction, setSelectedTransaction] = useState<FinanceTransaction | null>(null);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);
  const [bulkClassificationOpen, setBulkClassificationOpen] = useState(false);
  const [cashflowFilter, setCashflowFilter] = useState("");
  const [directionFilter, setDirectionFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [needsReviewFilter, setNeedsReviewFilter] = useState(false);
  const [transactionScopeLabel, setTransactionScopeLabel] = useState("All Transactions");
  const [updatingRuleId, setUpdatingRuleId] = useState<string | null>(null);
  const [whatIf, setWhatIf] = useState({ revenueGrowth: 15, expenseGrowth: 8, salaryGrowth: 10, months: 12 });

  const authorized = canAccessFinance(user);
  const reviewTransactions = useMemo(
    () =>
      transactions
        .filter((item) => item.cashflow_group === "UNCLASSIFIED" || Number(item.classification_confidence || 0) < 70)
        .slice(0, 12),
    [transactions]
  );
  const selectedTransactions = useMemo(
    () => transactions.filter((item) => selectedTransactionIds.includes(item.id)),
    [selectedTransactionIds, transactions]
  );

  const whatIfResult = useMemo(() => {
    const months = Math.max(1, dashboard.monthly.length || 1);
    const monthlyRevenue = Number(dashboard.summary.customer_receipts || 0) / months;
    const monthlySupplier = Number(dashboard.summary.supplier_payments || 0) / months;
    const monthlySalary = Number(dashboard.summary.salary_cost || 0) / months;
    const monthlyOpex =
      (Number(dashboard.summary.operating_expenses || 0) +
        Number(dashboard.summary.tax_payments || 0) +
        Number(dashboard.summary.bank_charges || 0) +
        Number(dashboard.summary.loan_repayments || 0) +
        Number(dashboard.summary.loan_interest || 0)) /
      months;
    const projectedRevenue = monthlyRevenue * (1 + whatIf.revenueGrowth / 100);
    const projectedExpenses =
      monthlySupplier * (1 + whatIf.expenseGrowth / 100) +
      monthlyOpex * (1 + whatIf.expenseGrowth / 100) +
      monthlySalary * (1 + whatIf.salaryGrowth / 100);
    const monthlyDelta = projectedRevenue - projectedExpenses;
    return {
      projectedRevenue,
      projectedExpenses,
      monthlyDelta,
      periodDelta: monthlyDelta * whatIf.months
    };
  }, [dashboard, whatIf]);

  useEffect(() => {
    async function boot() {
      if (!getToken()) {
        router.replace("/login");
        return;
      }
      try {
        const profile = await getProfile();
        setUser(profile);
        if (!canAccessFinance(profile)) {
          setBooting(false);
          return;
        }
      } catch {
        clearToken();
        router.replace("/login");
        return;
      }
      setBooting(false);
    }

    void boot();
  }, [router]);

  const loadAll = useCallback(async (options: TransactionLoadOptions = {}) => {
    setLoading(true);
    setBanner(null);
    try {
      const params = new URLSearchParams();
      const effectiveCashflowFilter = options.cashflowFilter ?? cashflowFilter;
      const effectiveDirectionFilter = options.directionFilter ?? directionFilter;
      const effectiveFromDate = options.fromDate ?? fromDate;
      const effectiveToDate = options.toDate ?? toDate;
      const effectiveSearch = options.search ?? search;
      const effectiveNeedsReview = options.needsReview ?? needsReviewFilter;
      if (effectiveCashflowFilter) params.set("cashflow_group", effectiveCashflowFilter);
      if (effectiveDirectionFilter) params.set("direction", effectiveDirectionFilter);
      if (effectiveFromDate) params.set("from", effectiveFromDate);
      if (effectiveToDate) params.set("to", effectiveToDate);
      if (effectiveSearch.trim()) params.set("q", effectiveSearch.trim());
      if (effectiveNeedsReview) params.set("needs_review", "true");
      const [dashboardPayload, transactionPayload, importPayload, categoryPayload, rulesPayload] = await Promise.all([
        getFinanceDashboard(),
        listFinanceTransactions(params.toString() ? `?${params.toString()}` : ""),
        listFinanceImports(),
        getFinanceCategories().catch(() => null),
        listFinanceRules().catch(() => null)
      ]);
      setDashboard(dashboardPayload || EMPTY_DASHBOARD);
      setTransactions(transactionPayload.items || []);
      setImports(importPayload.items || []);
      setRules(rulesPayload?.items || []);
      if (categoryPayload?.cashflow_groups?.length) {
        setCashflowGroups(categoryPayload.cashflow_groups);
      }
      if (categoryPayload?.pl_categories?.length) {
        setPlCategories(categoryPayload.pl_categories);
      }
      setBanner({ type: "ok", message: "Finance data loaded" });
    } catch (error) {
      setBanner({ type: "error", message: error instanceof Error ? error.message : "Failed to load finance data" });
    } finally {
      setLoading(false);
    }
  }, [cashflowFilter, directionFilter, fromDate, needsReviewFilter, search, toDate]);

  useEffect(() => {
    if (!user || !authorized) return;
    const handle = window.setTimeout(() => {
      void loadAll();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [authorized, loadAll, user]);

  async function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploading(true);
    setBanner(null);
    try {
      const form = new FormData(event.currentTarget);
      const file = form.get("file");
      if (!(file instanceof File) || file.size === 0) throw new Error("Choose a bank statement file");
      const result = await uploadBankStatement(form);
      setBanner({
        type: "ok",
        message: `Imported ${result.summary.rows_imported} new rows, skipped ${result.summary.rows_duplicate} duplicates`
      });
      event.currentTarget.reset();
      await loadAll();
      setView("review");
    } catch (error) {
      setBanner({ type: "error", message: error instanceof Error ? error.message : "Upload failed" });
    } finally {
      setUploading(false);
    }
  }

  async function submitClassification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTransaction) return;
    const form = new FormData(event.currentTarget);
    try {
      await updateFinanceTransactionClassification(selectedTransaction.id, {
        cashflow_group: String(form.get("cashflow_group") || "UNCLASSIFIED"),
        pl_category: String(form.get("pl_category") || "Unclassified"),
        pl_subcategory: String(form.get("pl_subcategory") || "") || null,
        counterparty_type: String(form.get("counterparty_type") || "UNKNOWN"),
        counterparty_name: String(form.get("counterparty_name") || "") || null,
        is_internal_transfer: form.get("is_internal_transfer") === "on",
        notes: String(form.get("notes") || "") || null,
        save_rule: form.get("save_rule") === "on"
      });
      setSelectedTransaction(null);
      await loadAll();
    } catch (error) {
      setBanner({ type: "error", message: error instanceof Error ? error.message : "Classification update failed" });
    }
  }

  async function submitBulkClassification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTransactionIds.length) return;
    const form = new FormData(event.currentTarget);
    try {
      const result = await bulkUpdateFinanceTransactionClassification({
        transaction_ids: selectedTransactionIds,
        cashflow_group: String(form.get("cashflow_group") || "UNCLASSIFIED"),
        pl_category: String(form.get("pl_category") || "Unclassified"),
        pl_subcategory: String(form.get("pl_subcategory") || "") || null,
        counterparty_type: String(form.get("counterparty_type") || "UNKNOWN"),
        counterparty_name: String(form.get("counterparty_name") || "") || null,
        is_internal_transfer: form.get("is_internal_transfer") === "on",
        notes: String(form.get("notes") || "") || null,
        save_rule: form.get("save_rule") === "on"
      });
      setBulkClassificationOpen(false);
      setSelectedTransactionIds([]);
      setBanner({ type: "ok", message: `Updated ${result.total} transactions` });
      await loadAll();
    } catch (error) {
      setBanner({ type: "error", message: error instanceof Error ? error.message : "Bulk classification update failed" });
    }
  }

  function toggleTransactionSelection(transactionId: string) {
    setSelectedTransactionIds((ids) =>
      ids.includes(transactionId) ? ids.filter((id) => id !== transactionId) : [...ids, transactionId]
    );
  }

  function toggleVisibleTransactionSelection(items: FinanceTransaction[]) {
    const visibleIds = items.map((item) => item.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedTransactionIds.includes(id));
    setSelectedTransactionIds((ids) =>
      allVisibleSelected
        ? ids.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...ids, ...visibleIds]))
    );
  }

  function toggleRuleSelection(ruleId: string) {
    setSelectedRuleIds((ids) => (ids.includes(ruleId) ? ids.filter((id) => id !== ruleId) : [...ids, ruleId]));
  }

  function toggleVisibleRuleSelection(items: FinanceClassificationRule[]) {
    const visibleIds = items.map((item) => item.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedRuleIds.includes(id));
    setSelectedRuleIds((ids) =>
      allVisibleSelected
        ? ids.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...ids, ...visibleIds]))
    );
  }

  async function bulkUpdateRules(isActive: boolean) {
    if (!selectedRuleIds.length) return;
    setUpdatingRuleId("bulk");
    setBanner(null);
    try {
      const results = await Promise.all(selectedRuleIds.map((ruleId) => updateFinanceRule(ruleId, { is_active: isActive })));
      const updated = new Map(results.map((result) => [result.item.id, result.item]));
      setRules((items) => items.map((item) => updated.get(item.id) || item));
      setSelectedRuleIds([]);
      setBanner({ type: "ok", message: `${isActive ? "Enabled" : "Disabled"} ${results.length} learning rules` });
    } catch (error) {
      setBanner({ type: "error", message: error instanceof Error ? error.message : "Bulk rule update failed" });
    } finally {
      setUpdatingRuleId(null);
    }
  }

  function openMetricRecords(label: string, cashflowGroup = "", needsReview = false, direction = "") {
    setCashflowFilter(cashflowGroup);
    setDirectionFilter(direction);
    setFromDate("");
    setToDate("");
    setSearch("");
    setSelectedTransactionIds([]);
    setNeedsReviewFilter(needsReview);
    setTransactionScopeLabel(label);
    setView("transactions");
    void loadAll({ cashflowFilter: cashflowGroup, directionFilter: direction, fromDate: "", toDate: "", search: "", needsReview });
  }

  function clearTransactionScope() {
    setCashflowFilter("");
    setDirectionFilter("");
    setFromDate("");
    setToDate("");
    setSearch("");
    setSelectedTransactionIds([]);
    setNeedsReviewFilter(false);
    setTransactionScopeLabel("All Transactions");
    void loadAll({ cashflowFilter: "", directionFilter: "", fromDate: "", toDate: "", search: "", needsReview: false });
  }

  function applyTransactionFilters() {
    const label = cashflowFilter ? pretty(cashflowFilter) : "All Transactions";
    setSelectedTransactionIds([]);
    const directionLabel = directionFilter === "CR" ? "Inflow" : directionFilter === "DR" ? "Outflow" : "";
    const dateLabel = fromDate || toDate ? `${fromDate || "Start"} to ${toDate || "Today"}` : "";
    setTransactionScopeLabel([label, directionLabel, needsReviewFilter ? "Needs Review" : "", dateLabel, search.trim() ? "Search" : ""].filter(Boolean).join(" "));
    void loadAll();
  }

  async function toggleRule(rule: FinanceClassificationRule) {
    setUpdatingRuleId(rule.id);
    setBanner(null);
    try {
      const result = await updateFinanceRule(rule.id, { is_active: !rule.is_active });
      setRules((items) => items.map((item) => (item.id === rule.id ? result.item : item)));
      setBanner({ type: "ok", message: result.item.is_active ? "Learning rule enabled" : "Learning rule disabled" });
    } catch (error) {
      setBanner({ type: "error", message: error instanceof Error ? error.message : "Rule update failed" });
    } finally {
      setUpdatingRuleId(null);
    }
  }

  if (booting) {
    return (
      <main className="main">
        <Loader2 className="spin" />
        <p>Loading financial workspace</p>
      </main>
    );
  }

  if (!user) return null;

  if (!authorized) {
    return (
      <InternalShell user={user} active="finance">
        <section className="panel">
          <h1>Financial access restricted</h1>
          <p className="muted">This workspace requires SUPERADMIN.</p>
        </section>
      </InternalShell>
    );
  }

  return (
    <InternalShell user={user} active="finance">
      <header className="topbar">
        <div>
          <div className="eyebrow">Management Finance</div>
          <h1>Financial Cockpit</h1>
          <p className="muted">Bank-statement actuals, P&L review, counterparties, and scenarios.</p>
        </div>
        <div className="toolbar">
          <button className="btn secondary" type="button" onClick={() => void loadAll()} disabled={loading}>
            <RefreshCw size={15} /> {loading ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </header>

      {banner ? <div className={`banner ${banner.type}`}>{banner.message}</div> : null}

      <div className="view-tabs">
        {(["overview", "upload", "review", "transactions", "rules", "whatif"] as FinanceView[]).map((item) => (
          <button
            className={`tab-button ${view === item ? "active" : ""}`}
            key={item}
            type="button"
            onClick={() => setView(item)}
          >
            {pretty(item)}
          </button>
        ))}
      </div>

      {view === "overview" ? renderOverview() : null}
      {view === "upload" ? renderUpload() : null}
      {view === "review" ? renderReview() : null}
      {view === "transactions" ? renderTransactions() : null}
      {view === "rules" ? renderRules() : null}
      {view === "whatif" ? renderWhatIf() : null}
      {selectedTransaction ? renderClassificationModal() : null}
      {bulkClassificationOpen ? renderBulkClassificationModal() : null}
    </InternalShell>
  );

  function renderOverview() {
    const summary = dashboard.summary || EMPTY_SUMMARY;
    const cards: Array<{
      label: string;
      value: number;
      Icon: LucideIcon;
      cashflowGroup?: string;
      direction?: "CR" | "DR";
      needsReview?: boolean;
    }> = [
      { label: "Customer Receipts", value: summary.customer_receipts, Icon: BanknoteArrowDown, cashflowGroup: "CUSTOMER_RECEIPT" },
      { label: "Supplier Payments", value: summary.supplier_payments, Icon: BanknoteArrowUp, cashflowGroup: "SUPPLIER_PAYMENT" },
      { label: "Salary Cost", value: summary.salary_cost, Icon: BanknoteArrowUp, cashflowGroup: "SALARY" },
      { label: "Operating Expenses", value: summary.operating_expenses, Icon: BanknoteArrowUp, cashflowGroup: "OPERATING_EXPENSE" },
      { label: "Investor Investment", value: summary.investor_investments, Icon: BanknoteArrowDown, cashflowGroup: "INVESTOR_INVESTMENT" },
      { label: "Loan Inflow", value: summary.loan_disbursements, Icon: BanknoteArrowDown, cashflowGroup: "LOAN_DISBURSEMENT" },
      { label: "Loan Repayment", value: summary.loan_repayments, Icon: BanknoteArrowUp, cashflowGroup: "LOAN_REPAYMENT" },
      { label: "Loan Interest", value: summary.loan_interest, Icon: BanknoteArrowUp, cashflowGroup: "LOAN_INTEREST" },
      { label: "Unclassified Inflow", value: summary.unclassified_inflow, Icon: BanknoteArrowDown, cashflowGroup: "UNCLASSIFIED", direction: "CR" },
      { label: "Unclassified Outflow", value: summary.unclassified_outflow, Icon: BanknoteArrowUp, cashflowGroup: "UNCLASSIFIED", direction: "DR" },
      { label: "Net Cash Movement", value: summary.net_cash_movement, Icon: TrendingUp },
      { label: "Needs Review", value: summary.needs_review_count, Icon: Pencil, needsReview: true }
    ];
    return (
      <>
        <section className="metrics-grid">
          {cards.map(({ label, value, Icon, cashflowGroup = "", direction = "", needsReview = false }) => {
            return (
              <button
                className="metric-card metric-action"
                key={String(label)}
                type="button"
                onClick={() => openMetricRecords(label, cashflowGroup, needsReview, direction)}
              >
                <div className="button-row" style={{ justifyContent: "space-between" }}>
                  <div className="metric-label">{label}</div>
                  <Icon size={18} />
                </div>
                <div className="metric-value">{label === "Needs Review" ? String(value || 0) : money(value)}</div>
              </button>
            );
          })}
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Monthly Cash Trend</h2>
              <p className="muted">Classified actuals by month.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Month</th><th>Trend Inflow</th><th>Trend Outflow</th><th>Receipts</th><th>Supplier</th><th>Salary</th><th>Opex</th><th>Loan In</th><th>Loan Out</th><th>Unclassified</th><th>Trend Net</th></tr>
              </thead>
              <tbody>
                {dashboard.monthly.length ? dashboard.monthly.map((item) => {
                  const investorInvestment = Number(item.investor_investments || 0);
                  const internalTransferInflow = Number(item.internal_transfer_inflow || 0);
                  const internalTransferOutflow = Number(item.internal_transfer_outflow || 0);
                  const trendInflow = Number(item.total_inflow || 0) - investorInvestment - internalTransferInflow;
                  const trendOutflow = Number(item.total_outflow || 0) - internalTransferOutflow;
                  const trendNet = trendInflow - trendOutflow;
                  return (
                    <tr key={item.month}>
                      <td>{formatMonth(item.month)}</td>
                      <td>{money(trendInflow)}</td>
                      <td>{money(trendOutflow)}</td>
                      <td>{money(item.customer_receipts)}</td>
                      <td>{money(item.supplier_payments)}</td>
                      <td>{money(item.salary_cost)}</td>
                      <td>{money(item.operating_expenses)}</td>
                      <td>{money(item.loan_disbursements)}</td>
                      <td>{money(Number(item.loan_repayments || 0) + Number(item.loan_interest || 0))}</td>
                      <td>{money(item.unclassified_total)}</td>
                      <td><strong>{money(trendNet)}</strong></td>
                    </tr>
                  );
                }) : <tr><td colSpan={11}>No statement data imported.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {renderProfitabilitySections()}
      </>
    );
  }

  function renderProfitabilitySections() {
    const profitability = dashboard.profitability;
    if (!profitability) return null;
    const rows = [...profitability.quarters, profitability.overall].filter(Boolean) as FinanceProfitabilityPeriod[];
    return (
      <div className="grid-two">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Operation Margin</h2>
              <p className="muted">
                {profitability.fy_label} / Customer payments - goods purchased.
              </p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Period</th><th>Customer Payments</th><th>Goods Purchased</th><th>Margin</th><th>Margin %</th></tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={`margin-${item.period_key}`}>
                    <td>
                      <strong>{item.period_label}</strong>
                      <div className="small muted">{formatDate(item.period_start)} to {formatDate(item.period_end)}</div>
                    </td>
                    <td>{money(item.customer_payments)}</td>
                    <td>{money(item.goods_purchased)}</td>
                    <td><strong>{money(item.operating_margin_amount)}</strong></td>
                    <td><strong>{percent(item.operating_margin_pct)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Earnings Before Income Tax</h2>
              <p className="muted">
                {profitability.fy_label} / Customer payments - all pre-tax expenses.
              </p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Period</th><th>Customer Payments</th><th>Expenses</th><th>EBT</th><th>EBT %</th></tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={`ebt-${item.period_key}`}>
                    <td>
                      <strong>{item.period_label}</strong>
                      <div className="small muted">{formatDate(item.period_start)} to {formatDate(item.period_end)}</div>
                    </td>
                    <td>{money(item.customer_payments)}</td>
                    <td>{money(item.ebt_expenses)}</td>
                    <td><strong>{money(item.earnings_before_tax_amount)}</strong></td>
                    <td><strong>{percent(item.earnings_before_tax_pct)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  function renderUpload() {
    return (
      <div className="grid-two">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Upload Statement</h2>
              <p className="muted">CSV, XLSX, or XLS bank statement.</p>
            </div>
            <FileSpreadsheet size={20} />
          </div>
          <form className="form-grid" onSubmit={submitUpload}>
            <label className="full">
              Statement File
              <input name="file" type="file" accept=".csv,.xlsx,.xls,text/csv" required />
            </label>
            <label>
              Entity
              <input name="entity_name" defaultValue="MACHANAS PRIVATE LIMITED" />
            </label>
            <label>
              Bank
              <input name="bank_name" placeholder="Kotak Mahindra Bank" />
            </label>
            <label>
              Account Number
              <input name="account_number" placeholder="Optional, masked after import" />
            </label>
            <label>
              IFSC
              <input name="ifsc_code" placeholder="Optional" />
            </label>
            <div className="full button-row">
              <button className="btn primary" type="submit" disabled={uploading}>
                <Upload size={15} /> {uploading ? "Uploading" : "Upload"}
              </button>
            </div>
          </form>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Recent Imports</h2>
              <p className="muted">Incremental import history.</p>
            </div>
          </div>
          <div className="compact-list">
            {imports.length ? imports.slice(0, 8).map((item) => (
              <div className="compact-row" key={item.id}>
                <div className="button-row" style={{ justifyContent: "space-between" }}>
                  <strong>{item.file_name}</strong>
                  <span className={`status-pill ${statusClass(item.status)}`}>{pretty(item.status)}</span>
                </div>
                <div className="small muted">
                  {formatDate(item.statement_period_start)} to {formatDate(item.statement_period_end)} / {item.rows_imported} new / {item.rows_duplicate} duplicate
                </div>
              </div>
            )) : <div className="compact-row muted">No imports yet.</div>}
          </div>
        </section>
      </div>
    );
  }

  function renderReview() {
    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Review Queue</h2>
            <p className="muted">Unclassified and low-confidence transactions.</p>
          </div>
          <div className="toolbar">
            <button className="btn secondary" type="button" onClick={() => setView("transactions")}>All Transactions</button>
          </div>
        </div>
        {renderTransactionBulkBar(reviewTransactions)}
        {renderTransactionTable(reviewTransactions, true)}
      </section>
    );
  }

  function renderTransactions() {
    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>{transactionScopeLabel}</h2>
            <p className="muted">
              {needsReviewFilter ? "Rows that still need classification review." : "Bank-statement rows with P&L classification."}
            </p>
          </div>
          {needsReviewFilter ? <span className="status-pill warn">Needs Review</span> : null}
        </div>
        <form
          className="filter-panel"
          onSubmit={(event) => {
            event.preventDefault();
            applyTransactionFilters();
          }}
        >
          <label>
            Search
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
              }}
              placeholder="Description, counterparty, reference"
            />
          </label>
          <label>
            Cashflow Group
            <select
              value={cashflowFilter}
              onChange={(event) => {
                const nextValue = event.target.value;
                setCashflowFilter(nextValue);
              }}
            >
              <option value="">All groups</option>
              {cashflowGroups.map((item) => <option key={item} value={item}>{pretty(item)}</option>)}
            </select>
          </label>
          <label>
            Direction
            <select
              value={directionFilter}
              onChange={(event) => {
                setDirectionFilter(event.target.value);
              }}
            >
              <option value="">All directions</option>
              <option value="CR">Inflow</option>
              <option value="DR">Outflow</option>
            </select>
          </label>
          <label>
            From Date
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </label>
          <label>
            To Date
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
            />
          </label>
          <label className="filter-checkbox">
            <input
              type="checkbox"
              checked={needsReviewFilter}
              onChange={(event) => setNeedsReviewFilter(event.target.checked)}
            />
            Needs review only
          </label>
          <div className="filter-actions">
            <button className="btn primary" type="submit">Apply Filters</button>
            {transactionScopeLabel !== "All Transactions" || needsReviewFilter || cashflowFilter || directionFilter || fromDate || toDate || search ? (
              <button className="btn secondary" type="button" onClick={clearTransactionScope}>Clear</button>
            ) : null}
          </div>
        </form>
        {renderTransactionBulkBar(transactions)}
        {renderTransactionTable(transactions, false)}
      </section>
    );
  }

  function renderTransactionBulkBar(items: FinanceTransaction[]) {
    const visibleIds = items.map((item) => item.id);
    const visibleSelected = visibleIds.filter((id) => selectedTransactionIds.includes(id)).length;
    const allVisibleSelected = visibleIds.length > 0 && visibleSelected === visibleIds.length;
    return (
      <div className="bulk-bar">
        <div>
          <strong>{selectedTransactionIds.length} selected</strong>
          <div className="small muted">{visibleSelected} selected in this view</div>
        </div>
        <div className="toolbar">
          <button className="btn secondary" type="button" onClick={() => toggleVisibleTransactionSelection(items)} disabled={!items.length}>
            {allVisibleSelected ? "Unselect Visible" : "Select Visible"}
          </button>
          <button className="btn secondary" type="button" onClick={() => setSelectedTransactionIds([])} disabled={!selectedTransactionIds.length}>
            Clear
          </button>
          <button className="btn primary" type="button" onClick={() => setBulkClassificationOpen(true)} disabled={!selectedTransactionIds.length}>
            <Pencil size={14} /> Bulk Edit
          </button>
        </div>
      </div>
    );
  }

  function renderRules() {
    const activeCount = rules.filter((rule) => rule.is_active).length;
    const learnedCount = rules.filter((rule) => rule.auto_created).length;
    const selectedVisibleRules = rules.filter((rule) => selectedRuleIds.includes(rule.id)).length;
    const allVisibleRulesSelected = rules.length > 0 && selectedVisibleRules === rules.length;
    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Learning Rules</h2>
            <p className="muted">{activeCount} active / {learnedCount} learned / {rules.length} total</p>
          </div>
          <button className="btn secondary" type="button" onClick={() => void loadAll()} disabled={loading}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
        <div className="bulk-bar">
          <div>
            <strong>{selectedRuleIds.length} selected</strong>
            <div className="small muted">{activeCount} active / {rules.length - activeCount} disabled</div>
          </div>
          <div className="toolbar">
            <button className="btn secondary" type="button" onClick={() => toggleVisibleRuleSelection(rules)} disabled={!rules.length}>
              {allVisibleRulesSelected ? "Unselect Visible" : "Select Visible"}
            </button>
            <button className="btn secondary" type="button" onClick={() => void bulkUpdateRules(true)} disabled={!selectedRuleIds.length || updatingRuleId === "bulk"}>
              Enable
            </button>
            <button className="btn secondary" type="button" onClick={() => void bulkUpdateRules(false)} disabled={!selectedRuleIds.length || updatingRuleId === "bulk"}>
              Disable
            </button>
            <button className="btn secondary" type="button" onClick={() => setSelectedRuleIds([])} disabled={!selectedRuleIds.length}>
              Clear
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="table-check">
                  <input
                    type="checkbox"
                    aria-label="Select visible rules"
                    checked={allVisibleRulesSelected}
                    onChange={() => toggleVisibleRuleSelection(rules)}
                    disabled={!rules.length}
                  />
                </th>
                <th>Status</th>
                <th>Pattern</th>
                <th>Classification</th>
                <th>Counterparty</th>
                <th>Learning</th>
                <th>Last Used</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rules.length ? rules.map((rule) => (
                <tr key={rule.id}>
                  <td className="table-check">
                    <input
                      type="checkbox"
                      aria-label={`Select rule ${rule.pattern}`}
                      checked={selectedRuleIds.includes(rule.id)}
                      onChange={() => toggleRuleSelection(rule.id)}
                    />
                  </td>
                  <td>
                    <span className={`status-pill ${rule.is_active ? "good" : "warn"}`}>
                      {rule.is_active ? "Active" : "Disabled"}
                    </span>
                    <div className="small muted">{rule.auto_created ? "Learned" : "Manual"}</div>
                  </td>
                  <td>
                    <strong>{rule.pattern}</strong>
                    <div className="small muted">{pretty(rule.match_type)} / priority {rule.priority}</div>
                  </td>
                  <td>
                    <span className={`status-pill ${statusClass(rule.cashflow_group)}`}>{pretty(rule.cashflow_group)}</span>
                    <div className="small muted">{rule.pl_category}</div>
                  </td>
                  <td>
                    {rule.counterparty_name || "-"}
                    <div className="small muted">{pretty(rule.counterparty_type)}</div>
                  </td>
                  <td>
                    <strong>{Number(rule.precision_score || 0).toFixed(0)}%</strong>
                    <div className="small muted">
                      {rule.support_count || 0} support / {rule.match_count || 0} matches / {rule.correction_count || 0} corrections
                    </div>
                  </td>
                  <td>{formatDate(rule.last_matched_at || rule.last_confirmed_at)}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="btn secondary"
                        type="button"
                        onClick={() => void toggleRule(rule)}
                        disabled={updatingRuleId === rule.id}
                      >
                        {rule.is_active ? "Disable" : "Enable"}
                      </button>
                    </div>
                  </td>
                </tr>
              )) : <tr><td colSpan={8}>No learning rules yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  function renderWhatIf() {
    return (
      <div className="grid-two">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Scenario Inputs</h2>
              <p className="muted">Based on classified monthly actuals.</p>
            </div>
          </div>
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              setWhatIf({
                revenueGrowth: numberField(form, "revenueGrowth", whatIf.revenueGrowth),
                expenseGrowth: numberField(form, "expenseGrowth", whatIf.expenseGrowth),
                salaryGrowth: numberField(form, "salaryGrowth", whatIf.salaryGrowth),
                months: numberField(form, "months", whatIf.months)
              });
            }}
          >
            <label>
              Revenue Growth %
              <input name="revenueGrowth" type="number" step="0.1" defaultValue={whatIf.revenueGrowth} />
            </label>
            <label>
              Supplier/Opex Growth %
              <input name="expenseGrowth" type="number" step="0.1" defaultValue={whatIf.expenseGrowth} />
            </label>
            <label>
              Salary Growth %
              <input name="salaryGrowth" type="number" step="0.1" defaultValue={whatIf.salaryGrowth} />
            </label>
            <label>
              Months
              <input name="months" type="number" min="1" max="60" defaultValue={whatIf.months} />
            </label>
            <div className="full button-row">
              <button className="btn primary" type="submit"><TrendingUp size={15} /> Recalculate</button>
            </div>
          </form>
        </section>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Scenario Output</h2>
              <p className="muted">Projected management cash P&L.</p>
            </div>
          </div>
          <section className="metrics-grid">
            <article className="metric-card">
              <div className="metric-label">Monthly Revenue</div>
              <div className="metric-value">{money(whatIfResult.projectedRevenue)}</div>
            </article>
            <article className="metric-card">
              <div className="metric-label">Monthly Expense</div>
              <div className="metric-value">{money(whatIfResult.projectedExpenses)}</div>
            </article>
            <article className="metric-card">
              <div className="metric-label">Monthly Delta</div>
              <div className="metric-value">{money(whatIfResult.monthlyDelta)}</div>
            </article>
            <article className="metric-card">
              <div className="metric-label">Period Delta</div>
              <div className="metric-value">{money(whatIfResult.periodDelta)}</div>
            </article>
          </section>
        </section>
      </div>
    );
  }

  function renderTransactionTable(items: FinanceTransaction[], compact: boolean) {
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="table-check">
                <input
                  type="checkbox"
                  aria-label="Select visible transactions"
                  checked={items.length > 0 && items.every((item) => selectedTransactionIds.includes(item.id))}
                  onChange={() => toggleVisibleTransactionSelection(items)}
                  disabled={!items.length}
                />
              </th>
              <th>Date</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Group</th>
              <th>Counterparty</th>
              <th>Confidence</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.length ? items.map((item) => (
              <tr key={item.id}>
                <td className="table-check">
                  <input
                    type="checkbox"
                    aria-label={`Select transaction ${item.description}`}
                    checked={selectedTransactionIds.includes(item.id)}
                    onChange={() => toggleTransactionSelection(item.id)}
                  />
                </td>
                <td>{formatDate(item.transaction_date)}</td>
                <td>
                  <strong>{item.description}</strong>
                  <div className="small muted">{item.reference_no || item.account_number_masked || ""}</div>
                </td>
                <td>
                  <strong>{money(item.amount)}</strong>
                  <div className="small muted">{item.direction}</div>
                </td>
                <td>
                  <span className={`status-pill ${statusClass(item.cashflow_group)}`}>{pretty(item.cashflow_group)}</span>
                  <div className="small muted">{item.pl_category}</div>
                </td>
                <td>{item.counterparty_name || "-"}<div className="small muted">{pretty(item.counterparty_type)}</div></td>
                <td>
                  {Number(item.classification_confidence || 0).toFixed(0)}%
                  <div className="small muted">{pretty(item.classification_source)}</div>
                </td>
                <td>
                  <div className="row-actions">
                    <button className="btn secondary" type="button" onClick={() => setSelectedTransaction(item)}>
                      <Pencil size={14} /> {compact ? "Classify" : "Edit"}
                    </button>
                  </div>
                </td>
              </tr>
            )) : <tr><td colSpan={8}>No transactions found.</td></tr>}
          </tbody>
        </table>
      </div>
    );
  }

  function renderClassificationModal() {
    const item = selectedTransaction;
    if (!item) return null;
    const categoryFallback = item.direction === "CR" ? "Unclassified inflow" : "Unclassified outflow";
    const categoryOptions = optionsWithCurrent(plCategories, item.pl_category || categoryFallback);
    return (
      <div className="modal-backdrop" role="presentation">
        <form className="modal" onSubmit={submitClassification}>
          <div className="modal-header">
            <div>
              <h2>Classify Transaction</h2>
              <p className="muted">{formatDate(item.transaction_date)} / {money(item.amount)} {item.direction}</p>
            </div>
            <button className="icon-btn" type="button" onClick={() => setSelectedTransaction(null)} title="Close">
              <X size={16} />
            </button>
          </div>
          <div className="modal-body">
            <div className="compact-row" style={{ marginBottom: 12 }}>
              <strong>{item.description}</strong>
              <div className="small muted">{item.reference_no || "-"}</div>
            </div>
            <div className="form-grid">
              <label>
                Cashflow Group
                <select name="cashflow_group" defaultValue={item.cashflow_group}>
                  {optionsWithCurrent(cashflowGroups, item.cashflow_group).map((group) => (
                    <option key={group} value={group}>{pretty(group)}</option>
                  ))}
                </select>
              </label>
              <label>
                P&L Category
                <select name="pl_category" defaultValue={item.pl_category || categoryFallback}>
                  {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>
              <label>
                P&L Subcategory
                <input name="pl_subcategory" defaultValue={item.pl_subcategory || ""} />
              </label>
              <label>
                Counterparty Type
                <select name="counterparty_type" defaultValue={item.counterparty_type}>
                  {COUNTERPARTY_TYPES.map((type) => <option key={type} value={type}>{pretty(type)}</option>)}
                </select>
              </label>
              <label>
                Counterparty
                <input name="counterparty_name" defaultValue={item.counterparty_name || ""} />
              </label>
              <label>
                Notes
                <input name="notes" defaultValue={item.notes || ""} />
              </label>
              <label className="full">
                Review Flags
                <div className="button-row">
                  <label className="checkbox-row">
                    <input name="is_internal_transfer" type="checkbox" defaultChecked={item.is_internal_transfer} />
                    Internal transfer
                  </label>
                  <label className="checkbox-row">
                    <input name="save_rule" type="checkbox" defaultChecked />
                    Teach future transactions
                  </label>
                </div>
              </label>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn secondary" type="button" onClick={() => setSelectedTransaction(null)}>Cancel</button>
            <button className="btn primary" type="submit"><Save size={15} /> Save</button>
          </div>
        </form>
      </div>
    );
  }

  function renderBulkClassificationModal() {
    const seed = selectedTransactions[0];
    if (!selectedTransactionIds.length || !seed) return null;
    const categoryFallback = seed.direction === "CR" ? "Unclassified inflow" : "Unclassified outflow";
    const categoryOptions = optionsWithCurrent(plCategories, seed.pl_category || categoryFallback);
    const totalAmount = selectedTransactions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return (
      <div className="modal-backdrop" role="presentation">
        <form className="modal" onSubmit={submitBulkClassification}>
          <div className="modal-header">
            <div>
              <h2>Bulk Classify Transactions</h2>
              <p className="muted">{selectedTransactionIds.length} selected / visible total {money(totalAmount)}</p>
            </div>
            <button className="icon-btn" type="button" onClick={() => setBulkClassificationOpen(false)} title="Close">
              <X size={16} />
            </button>
          </div>
          <div className="modal-body">
            <div className="compact-row" style={{ marginBottom: 12 }}>
              <strong>{seed.description}</strong>
              <div className="small muted">Using the first selected transaction as the starting template.</div>
            </div>
            <div className="form-grid">
              <label>
                Cashflow Group
                <select name="cashflow_group" defaultValue={seed.cashflow_group}>
                  {optionsWithCurrent(cashflowGroups, seed.cashflow_group).map((group) => (
                    <option key={group} value={group}>{pretty(group)}</option>
                  ))}
                </select>
              </label>
              <label>
                P&L Category
                <select name="pl_category" defaultValue={seed.pl_category || categoryFallback}>
                  {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>
              <label>
                P&L Subcategory
                <input name="pl_subcategory" defaultValue={seed.pl_subcategory || ""} />
              </label>
              <label>
                Counterparty Type
                <select name="counterparty_type" defaultValue={seed.counterparty_type || "UNKNOWN"}>
                  {COUNTERPARTY_TYPES.map((type) => <option key={type} value={type}>{pretty(type)}</option>)}
                </select>
              </label>
              <label>
                Counterparty
                <input name="counterparty_name" defaultValue={seed.counterparty_name || ""} />
              </label>
              <label>
                Notes
                <input name="notes" defaultValue={seed.notes || ""} />
              </label>
              <label className="full">
                Review Flags
                <div className="button-row">
                  <label className="checkbox-row">
                    <input name="is_internal_transfer" type="checkbox" defaultChecked={seed.is_internal_transfer} />
                    Internal transfer
                  </label>
                  <label className="checkbox-row">
                    <input name="save_rule" type="checkbox" />
                    Teach future transactions
                  </label>
                </div>
              </label>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn secondary" type="button" onClick={() => setBulkClassificationOpen(false)}>Cancel</button>
            <button className="btn primary" type="submit"><Save size={15} /> Save Bulk Edit</button>
          </div>
        </form>
      </div>
    );
  }
}
