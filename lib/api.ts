export type UserProfile = {
  username: string;
  full_name?: string | null;
  phone?: string | null;
  role?: string | null;
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

export type EmployeeDetail = Employee & {
  bank_account?: EmployeeBankAccount | null;
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

export type ListResponse<T> = {
  items: T[];
  total: number;
};

const API_BASE = process.env.NEXT_PUBLIC_INTERNAL_API_BASE || "/api/backend";
const TOKEN_KEY = "mac.internal.token";

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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  headers.set("content-type", "application/json");
  headers.set("x-app-context", "mac_internal");
  if (token) headers.set("authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.detail || payload?.message || `Request failed ${response.status}`;
    throw new Error(String(detail));
  }
  return payload as T;
}

export async function login(username: string, password: string) {
  const payload = await request<{ access_token: string; token_type: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password, app: "mac_internal" })
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
