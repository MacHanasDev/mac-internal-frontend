export type UserProfile = {
  username: string;
  full_name?: string | null;
  phone?: string | null;
  role?: string | null;
  roles?: string[] | null;
  app?: string | null;
  allowed_apps?: string[] | null;
};

export type DashboardSummary = {
  total_employees: number;
  active_employees: number;
  pending_leave_requests: number;
  open_action_items: number;
  overdue_action_items: number;
  open_payroll_runs: number;
};

export type Employee = {
  id: string;
  employee_code: string;
  full_name: string;
  app_user_id?: string | null;
  app_user_email?: string | null;
  work_email?: string | null;
  personal_email?: string | null;
  phone?: string | null;
  department?: string | null;
  designation?: string | null;
  employment_type: string;
  employment_status: string;
  joining_date?: string | null;
  exit_date?: string | null;
  manager_employee_id?: string | null;
  manager_name?: string | null;
};

export type EmployeeBankAccount = {
  id: string;
  bank_name?: string | null;
  account_number?: string | null;
  ifsc_code?: string | null;
  account_type?: string | null;
  status?: string | null;
  updated_at?: string | null;
};

export type LeaveMonthlySummary = {
  id: string;
  period_start: string;
  period_end: string;
  leave_type: string;
  total_days?: number | string | null;
  count_status: string;
  raw_leave_note?: string | null;
};

export type LeaveBalance = {
  id: string;
  leave_type: string;
  effective_year: number;
  balance_period_start: string;
  base_balance_days: number | string;
  monthly_accrual_days: number | string;
  months_accrued_since_period_start: number | string;
  current_balance_days: number | string;
  used_days: number | string;
  pending_days: number | string;
};

export type EmployeeDetail = Employee & {
  bank_account?: EmployeeBankAccount | null;
  leave_monthly_summaries?: LeaveMonthlySummary[];
  leave_balances?: LeaveBalance[];
};

export type LeaveRequest = {
  id: string;
  employee_id: string;
  employee_name?: string | null;
  employee_code?: string | null;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason?: string | null;
  status: string;
  rejection_reason?: string | null;
};

export type SalaryStructure = {
  id: string;
  employee_id: string;
  employee_name?: string | null;
  employee_code?: string | null;
  effective_from: string;
  effective_to?: string | null;
  currency: string;
  ctc_annual: number;
  basic_monthly: number;
  hra_monthly: number;
  special_allowance_monthly: number;
  other_allowances_monthly: number;
  employer_pf_monthly: number;
  variable_pay_annual: number;
  status: string;
};

export type PayrollRun = {
  id: string;
  period_start: string;
  period_end: string;
  pay_date?: string | null;
  status: string;
  notes?: string | null;
  line_count: number;
  total_gross_pay: number;
  total_net_pay: number;
};

export type PayrollLine = {
  id: string;
  payroll_run_id: string;
  employee_id: string;
  employee_name?: string | null;
  employee_code?: string | null;
  paid_days: number;
  leave_without_pay_days: number;
  gross_pay: number;
  deductions: number;
  tax_deduction: number;
  reimbursements: number;
  net_pay: number;
};

export type ActionItem = {
  id: string;
  employee_id?: string | null;
  employee_name?: string | null;
  title: string;
  description?: string | null;
  category: string;
  priority: string;
  status: string;
  due_date?: string | null;
};

export type AuditEvent = {
  id: string;
  table_name: string;
  record_id?: string | null;
  event_type: string;
  actor_email?: string | null;
  actor_role?: string | null;
  occurred_at: string;
  changed_fields?: string[] | null;
  reason?: string | null;
};

export type FinanceSummary = {
  total_inflow: number;
  total_outflow: number;
  net_cash_movement: number;
  customer_receipts: number;
  supplier_payments: number;
  salary_cost: number;
  operating_expenses: number;
  tax_payments: number;
  bank_charges: number;
  interest_income: number;
  investor_investments: number;
  loan_disbursements: number;
  loan_repayments: number;
  loan_interest: number;
  unclassified_inflow: number;
  unclassified_outflow: number;
  transaction_count: number;
  needs_review_count: number;
};

export type FinanceMonthly = {
  month: string;
  total_inflow: number;
  total_outflow: number;
  net_cash_movement: number;
  customer_receipts: number;
  supplier_payments: number;
  salary_cost: number;
  operating_expenses: number;
  investor_investments: number;
  internal_transfer_inflow?: number;
  internal_transfer_outflow?: number;
  loan_disbursements: number;
  loan_repayments: number;
  loan_interest: number;
  unclassified_total: number;
};

export type FinanceGroupTotal = {
  cashflow_group: string;
  direction: string;
  transaction_count: number;
  amount: number;
};

export type FinanceCounterpartyTotal = {
  counterparty_type: string;
  counterparty_name: string;
  cashflow_group: string;
  transaction_count: number;
  amount: number;
};

export type FinanceProfitabilityPeriod = {
  sort_order: number;
  period_key: string;
  period_label: string;
  period_start: string;
  period_end: string;
  customer_payments: number;
  goods_purchased: number;
  operating_margin_amount: number;
  operating_margin_pct?: number | null;
  ebt_expenses: number;
  earnings_before_tax_amount: number;
  earnings_before_tax_pct?: number | null;
};

export type FinanceProfitability = {
  fy_label: string;
  period_start: string;
  period_end: string;
  quarters: FinanceProfitabilityPeriod[];
  overall?: FinanceProfitabilityPeriod | null;
};

export type FinanceCategories = {
  cashflow_groups: string[];
  counterparty_types: string[];
  pl_categories: string[];
};

export type FinanceDashboard = {
  summary: FinanceSummary;
  monthly: FinanceMonthly[];
  profitability?: FinanceProfitability | null;
  groups: FinanceGroupTotal[];
  top_counterparties: FinanceCounterpartyTotal[];
};

export type FinanceTransaction = {
  id: string;
  transaction_date: string;
  value_date?: string | null;
  description: string;
  reference_no?: string | null;
  amount: number;
  direction: "DR" | "CR";
  signed_amount: number;
  balance?: number | null;
  cashflow_group: string;
  pl_category: string;
  pl_subcategory?: string | null;
  counterparty_type: string;
  counterparty_name?: string | null;
  is_internal_transfer: boolean;
  is_reviewed: boolean;
  classification_confidence: number;
  classification_source: string;
  notes?: string | null;
  bank_name?: string | null;
  account_number_masked?: string | null;
};

export type FinanceImport = {
  id: string;
  file_name: string;
  source_format: string;
  statement_period_start?: string | null;
  statement_period_end?: string | null;
  rows_seen: number;
  rows_imported: number;
  rows_duplicate: number;
  rows_error: number;
  status: string;
  created_at: string;
  bank_name?: string | null;
  account_number_masked?: string | null;
};

export type FinanceUploadResult = {
  import: FinanceImport;
  bank_account: {
    id: string;
    entity_name: string;
    bank_name?: string | null;
    account_number_masked: string;
  };
  summary: {
    rows_seen: number;
    rows_imported: number;
    rows_duplicate: number;
    rows_error: number;
  };
};

export type FinanceClassificationRule = {
  id: string;
  rule_name: string;
  match_type: string;
  pattern: string;
  cashflow_group: string;
  pl_category: string;
  pl_subcategory?: string | null;
  counterparty_type: string;
  counterparty_name?: string | null;
  is_internal_transfer: boolean;
  priority: number;
  is_active: boolean;
  auto_created: boolean;
  support_count: number;
  match_count: number;
  correction_count: number;
  precision_score: number;
  last_matched_at?: string | null;
  last_confirmed_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type ListResponse<T> = {
  items: T[];
  total: number;
};

const API_BASE = process.env.NEXT_PUBLIC_INTERNAL_API_BASE || "/api/backend";
const TOKEN_KEY = "mac.internal.token";
const APP_CONTEXT = "mac_internal";

export function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

function requestHeaders(options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!isFormData) headers.set("content-type", "application/json");
  headers.set("x-app-context", APP_CONTEXT);
  return headers;
}

async function refreshAccessToken() {
  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: requestHeaders(),
    credentials: "include"
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    clearToken();
    throw new Error("Session expired. Please sign in again.");
  }
  setToken(String(payload.access_token));
  return payload as { access_token: string; token_type: string };
}

async function request<T>(path: string, options: RequestInit = {}, retryAuth = true): Promise<T> {
  const token = getToken();
  const headers = requestHeaders(options);
  if (token) headers.set("authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include"
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && retryAuth && path !== "/auth/login" && path !== "/auth/refresh") {
      await refreshAccessToken();
      return request<T>(path, options, false);
    }
    const detail = payload?.detail || payload?.message || `Request failed ${response.status}`;
    throw new Error(String(detail));
  }
  return payload as T;
}

export async function login(username: string, password: string) {
  const payload = await request<{ access_token: string; token_type: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password, app: APP_CONTEXT })
  });
  setToken(payload.access_token);
  return payload;
}

export async function getProfile() {
  return request<UserProfile>("/auth/me");
}

export async function getHrDashboard() {
  return request<{ summary: DashboardSummary; latest_payroll_run?: PayrollRun | null }>("/pgvector/hr/dashboard");
}

export async function listEmployees(params = "") {
  return request<ListResponse<Employee>>(`/pgvector/hr/employees${params}`);
}

export async function getEmployeeDetail(id: string) {
  return request<{ item: EmployeeDetail }>(`/pgvector/hr/employees/${id}/details`);
}

export async function saveEmployee(payload: Partial<Employee>, id?: string) {
  return request<{ item: Employee }>(id ? `/pgvector/hr/employees/${id}` : "/pgvector/hr/employees", {
    method: id ? "PATCH" : "POST",
    body: JSON.stringify(payload)
  });
}

export async function listLeaveRequests(params = "") {
  return request<ListResponse<LeaveRequest>>(`/pgvector/hr/leave-requests${params}`);
}

export async function saveLeaveRequest(payload: Partial<LeaveRequest>, id?: string) {
  return request<{ item: LeaveRequest }>(id ? `/pgvector/hr/leave-requests/${id}` : "/pgvector/hr/leave-requests", {
    method: id ? "PATCH" : "POST",
    body: JSON.stringify(payload)
  });
}

export async function listSalaryStructures() {
  return request<ListResponse<SalaryStructure>>("/pgvector/hr/salary-structures");
}

export async function saveSalaryStructure(payload: Partial<SalaryStructure> & { audit_reason?: string }, id?: string) {
  return request<{ item: SalaryStructure }>(id ? `/pgvector/hr/salary-structures/${id}` : "/pgvector/hr/salary-structures", {
    method: id ? "PATCH" : "POST",
    body: JSON.stringify(payload)
  });
}

export async function listPayrollRuns() {
  return request<ListResponse<PayrollRun>>("/pgvector/hr/payroll-runs");
}

export async function savePayrollRun(payload: Partial<PayrollRun> & { audit_reason?: string }, id?: string) {
  return request<{ item: PayrollRun }>(id ? `/pgvector/hr/payroll-runs/${id}` : "/pgvector/hr/payroll-runs", {
    method: id ? "PATCH" : "POST",
    body: JSON.stringify(payload)
  });
}

export async function listPayrollLines(payrollRunId: string) {
  return request<ListResponse<PayrollLine>>(`/pgvector/hr/payroll-runs/${payrollRunId}/lines`);
}

export async function savePayrollLine(
  payrollRunId: string,
  payload: Partial<PayrollLine> & { audit_reason?: string },
  id?: string
) {
  return request<{ item: PayrollLine }>(id ? `/pgvector/hr/payroll-run-lines/${id}` : `/pgvector/hr/payroll-runs/${payrollRunId}/lines`, {
    method: id ? "PATCH" : "POST",
    body: JSON.stringify(payload)
  });
}

export async function listActionItems(params = "") {
  return request<ListResponse<ActionItem>>(`/pgvector/hr/action-items${params}`);
}

export async function saveActionItem(payload: Partial<ActionItem>, id?: string) {
  return request<{ item: ActionItem }>(id ? `/pgvector/hr/action-items/${id}` : "/pgvector/hr/action-items", {
    method: id ? "PATCH" : "POST",
    body: JSON.stringify(payload)
  });
}

export async function listAuditEvents(params = "") {
  return request<ListResponse<AuditEvent>>(`/pgvector/hr/audit-events${params}`);
}

export async function getFinanceDashboard(params = "") {
  return request<FinanceDashboard>(`/pgvector/finance/dashboard${params}`);
}

export async function listFinanceTransactions(params = "") {
  return request<ListResponse<FinanceTransaction>>(`/pgvector/finance/transactions${params}`);
}

export async function listFinanceImports() {
  return request<ListResponse<FinanceImport>>("/pgvector/finance/imports");
}

export async function listFinanceRules(params = "") {
  return request<ListResponse<FinanceClassificationRule>>(`/pgvector/finance/rules${params}`);
}

export async function updateFinanceRule(ruleId: string, payload: Partial<FinanceClassificationRule>) {
  return request<{ item: FinanceClassificationRule }>(`/pgvector/finance/rules/${ruleId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function getFinanceCategories() {
  return request<FinanceCategories>("/pgvector/finance/categories");
}

export async function uploadBankStatement(form: FormData) {
  return request<FinanceUploadResult>("/pgvector/finance/bank-statements/upload", {
    method: "POST",
    body: form
  });
}

export async function updateFinanceTransactionClassification(
  transactionId: string,
  payload: Partial<FinanceTransaction> & { save_rule?: boolean }
) {
  return request<{ item: FinanceTransaction }>(`/pgvector/finance/transactions/${transactionId}/classification`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function bulkUpdateFinanceTransactionClassification(
  payload: Partial<FinanceTransaction> & { transaction_ids: string[]; save_rule?: boolean }
) {
  return request<{ items: FinanceTransaction[]; total: number }>("/pgvector/finance/transactions/classification/bulk", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}
