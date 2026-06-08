"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeIndianRupee,
  Building2,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  Loader2,
  Mail,
  Phone,
  type LucideIcon,
  Plus,
  RefreshCw,
  Users
} from "lucide-react";
import InternalShell from "@/components/InternalShell";
import {
  clearToken,
  getEmployeeDetail,
  getHrDashboard,
  getProfile,
  getToken,
  listActionItems,
  listAuditEvents,
  listEmployees,
  listLeaveRequests,
  listPayrollLines,
  listPayrollRuns,
  listSalaryStructures,
  saveActionItem,
  saveEmployee,
  saveLeaveRequest,
  savePayrollLine,
  savePayrollRun,
  saveSalaryStructure,
  type ActionItem,
  type AuditEvent,
  type DashboardSummary,
  type Employee,
  type EmployeeDetail,
  type LeaveRequest,
  type PayrollLine,
  type PayrollRun,
  type SalaryStructure,
  type UserProfile
} from "@/lib/api";

type HrView = "overview" | "people" | "leave" | "payroll" | "actions" | "audit";
type Banner = { type: "ok" | "error"; message: string } | null;
type ModalState =
  | { kind: "employee"; item?: Employee }
  | { kind: "leave"; item?: LeaveRequest }
  | { kind: "salary"; item?: SalaryStructure }
  | { kind: "payrollRun"; item?: PayrollRun }
  | { kind: "payrollLine"; item?: PayrollLine }
  | { kind: "action"; item?: ActionItem }
  | null;

const EMPTY_SUMMARY: DashboardSummary = {
  total_employees: 0,
  active_employees: 0,
  pending_leave_requests: 0,
  open_action_items: 0,
  overdue_action_items: 0,
  open_payroll_runs: 0
};

function normalizeRole(role?: string | null) {
  return String(role || "").toUpperCase().replace(/-/g, "_").trim();
}

function canAccessHr(role?: string | null) {
  const normalized = normalizeRole(role);
  return normalized === "HR_ADMIN" || normalized === "SUPERADMIN";
}

function pretty(value?: string | null) {
  return String(value || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN");
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN");
}

function money(value?: number | string | null) {
  const amount = Number(value || 0);
  return amount.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  });
}

function statusClass(value?: string | null) {
  const normalized = normalizeRole(value);
  if (["ACTIVE", "APPROVED", "DONE", "PAID", "CALCULATED"].includes(normalized)) return "good";
  if (["PENDING", "OPEN", "IN_PROGRESS", "DRAFT", "ON_NOTICE"].includes(normalized)) return "warn";
  if (["REJECTED", "CANCELLED", "EXITED", "BLOCKED"].includes(normalized)) return "bad";
  return "";
}

function textField(form: FormData, key: string) {
  const value = form.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function numberField(form: FormData, key: string) {
  const value = textField(form, key);
  return value == null ? null : Number(value);
}

export default function HrPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [view, setView] = useState<HrView>("overview");
  const [modal, setModal] = useState<ModalState>(null);
  const [employeeDetail, setEmployeeDetail] = useState<EmployeeDetail | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);

  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [salaryStructures, setSalaryStructures] = useState<SalaryStructure[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [selectedPayrollRunId, setSelectedPayrollRunIdState] = useState<string>("");
  const selectedPayrollRunIdRef = useRef("");
  const [payrollLines, setPayrollLines] = useState<PayrollLine[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState("");
  const [leaveStatusFilter, setLeaveStatusFilter] = useState("");
  const [actionStatusFilter, setActionStatusFilter] = useState("");
  const [auditTableFilter, setAuditTableFilter] = useState("");

  const authorized = canAccessHr(user?.role);
  const pendingLeave = useMemo(
    () => leaveRequests.filter((item) => item.status === "PENDING").slice(0, 6),
    [leaveRequests]
  );
  const openActions = useMemo(
    () => actionItems.filter((item) => !["DONE", "CANCELLED"].includes(item.status)).slice(0, 6),
    [actionItems]
  );

  const setSelectedPayrollRunId = useCallback((runId: string) => {
    selectedPayrollRunIdRef.current = runId;
    setSelectedPayrollRunIdState(runId);
  }, []);

  useEffect(() => {
    async function boot() {
      if (!getToken()) {
        router.replace("/login");
        return;
      }
      try {
        const profile = await getProfile();
        setUser(profile);
        if (!canAccessHr(profile.role)) {
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

  const loadAll = useCallback(async () => {
    setLoading(true);
    setBanner(null);
    try {
      const [dashboard, employeePayload, leavePayload, salaryPayload, payrollPayload, actionPayload, auditPayload] =
        await Promise.all([
          getHrDashboard(),
          listEmployees(employeeStatusFilter ? `?status=${employeeStatusFilter}` : ""),
          listLeaveRequests(leaveStatusFilter ? `?status=${leaveStatusFilter}` : ""),
          listSalaryStructures(),
          listPayrollRuns(),
          listActionItems(actionStatusFilter ? `?status=${actionStatusFilter}` : ""),
          listAuditEvents(auditTableFilter ? `?table_name=${encodeURIComponent(auditTableFilter)}` : "")
        ]);
      setSummary(dashboard.summary || EMPTY_SUMMARY);
      setEmployees(employeePayload.items || []);
      setLeaveRequests(leavePayload.items || []);
      setSalaryStructures(salaryPayload.items || []);
      setPayrollRuns(payrollPayload.items || []);
      setActionItems(actionPayload.items || []);
      setAuditEvents(auditPayload.items || []);

      const nextRunId = selectedPayrollRunIdRef.current || payrollPayload.items?.[0]?.id || "";
      setSelectedPayrollRunId(nextRunId);
      if (nextRunId) {
        const linePayload = await listPayrollLines(nextRunId);
        setPayrollLines(linePayload.items || []);
      } else {
        setPayrollLines([]);
      }
      setBanner({ type: "ok", message: "HR data loaded" });
    } catch (error) {
      setBanner({ type: "error", message: error instanceof Error ? error.message : "Failed to load HR data" });
    } finally {
      setLoading(false);
    }
  }, [actionStatusFilter, auditTableFilter, employeeStatusFilter, leaveStatusFilter, setSelectedPayrollRunId]);

  useEffect(() => {
    if (!user || !authorized) return;
    const handle = window.setTimeout(() => {
      void loadAll();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [authorized, loadAll, user]);

  async function loadPayrollLinesFor(runId: string) {
    setSelectedPayrollRunId(runId);
    if (!runId) {
      setPayrollLines([]);
      return;
    }
    const payload = await listPayrollLines(runId);
    setPayrollLines(payload.items || []);
  }

  async function openEmployeeDetails(employee: Employee) {
    setDetailLoadingId(employee.id);
    setBanner(null);
    try {
      const payload = await getEmployeeDetail(employee.id);
      setEmployeeDetail(payload.item);
    } catch (error) {
      setBanner({ type: "error", message: error instanceof Error ? error.message : "Failed to load employee details" });
    } finally {
      setDetailLoadingId(null);
    }
  }

  async function submitModal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal) return;
    const form = new FormData(event.currentTarget);
    try {
      if (modal.kind === "employee") {
        await saveEmployee(
          {
            employee_code: textField(form, "employee_code") || undefined,
            full_name: textField(form, "full_name") || undefined,
            work_email: textField(form, "work_email"),
            phone: textField(form, "phone"),
            department: textField(form, "department"),
            designation: textField(form, "designation"),
            employment_type: textField(form, "employment_type") || "FULL_TIME",
            employment_status: textField(form, "employment_status") || "ACTIVE",
            joining_date: textField(form, "joining_date"),
            exit_date: textField(form, "exit_date")
          },
          modal.item?.id
        );
      }
      if (modal.kind === "leave") {
        await saveLeaveRequest(
          {
            employee_id: textField(form, "employee_id") || undefined,
            leave_type: textField(form, "leave_type") || undefined,
            start_date: textField(form, "start_date") || undefined,
            end_date: textField(form, "end_date") || undefined,
            total_days: numberField(form, "total_days") || undefined,
            status: textField(form, "status") || "PENDING",
            reason: textField(form, "reason"),
            rejection_reason: textField(form, "rejection_reason")
          },
          modal.item?.id
        );
      }
      if (modal.kind === "salary") {
        await saveSalaryStructure(
          {
            employee_id: textField(form, "employee_id") || undefined,
            effective_from: textField(form, "effective_from") || undefined,
            effective_to: textField(form, "effective_to"),
            status: textField(form, "status") || "ACTIVE",
            ctc_annual: numberField(form, "ctc_annual") || 0,
            basic_monthly: numberField(form, "basic_monthly") || 0,
            hra_monthly: numberField(form, "hra_monthly") || 0,
            special_allowance_monthly: numberField(form, "special_allowance_monthly") || 0,
            other_allowances_monthly: numberField(form, "other_allowances_monthly") || 0,
            employer_pf_monthly: numberField(form, "employer_pf_monthly") || 0,
            variable_pay_annual: numberField(form, "variable_pay_annual") || 0,
            audit_reason: textField(form, "audit_reason") || "salary updated"
          },
          modal.item?.id
        );
      }
      if (modal.kind === "payrollRun") {
        await savePayrollRun(
          {
            period_start: textField(form, "period_start") || undefined,
            period_end: textField(form, "period_end") || undefined,
            pay_date: textField(form, "pay_date"),
            status: textField(form, "status") || "DRAFT",
            notes: textField(form, "notes"),
            audit_reason: textField(form, "audit_reason") || "payroll run updated"
          },
          modal.item?.id
        );
      }
      if (modal.kind === "payrollLine") {
        if (!selectedPayrollRunId && !modal.item?.payroll_run_id) throw new Error("Select a payroll run first");
        await savePayrollLine(
          modal.item?.payroll_run_id || selectedPayrollRunId,
          {
            employee_id: textField(form, "employee_id") || undefined,
            paid_days: numberField(form, "paid_days") || 0,
            leave_without_pay_days: numberField(form, "leave_without_pay_days") || 0,
            gross_pay: numberField(form, "gross_pay") || 0,
            deductions: numberField(form, "deductions") || 0,
            tax_deduction: numberField(form, "tax_deduction") || 0,
            reimbursements: numberField(form, "reimbursements") || 0,
            net_pay: numberField(form, "net_pay") || 0,
            audit_reason: textField(form, "audit_reason") || "payroll line updated"
          },
          modal.item?.id
        );
      }
      if (modal.kind === "action") {
        await saveActionItem(
          {
            title: textField(form, "title") || undefined,
            employee_id: textField(form, "employee_id"),
            category: textField(form, "category") || "GENERAL",
            priority: textField(form, "priority") || "MEDIUM",
            status: textField(form, "status") || "OPEN",
            due_date: textField(form, "due_date"),
            description: textField(form, "description")
          },
          modal.item?.id
        );
      }
      setModal(null);
      await loadAll();
    } catch (error) {
      setBanner({ type: "error", message: error instanceof Error ? error.message : "Save failed" });
    }
  }

  if (booting) {
    return (
      <main className="main">
        <Loader2 className="spin" />
        <p>Loading internal workspace</p>
      </main>
    );
  }

  if (!user) return null;

  if (!authorized) {
    return (
      <InternalShell user={user} active="hr">
        <section className="panel">
          <h1>HR access restricted</h1>
          <p className="muted">This internal workspace requires HR_ADMIN or SUPERADMIN.</p>
        </section>
      </InternalShell>
    );
  }

  return (
    <InternalShell user={user} active="hr">
      <header className="topbar">
        <div>
          <div className="eyebrow">People Operations</div>
          <h1>HR Workspace</h1>
          <p className="muted">Employees, leave, salary structures, payroll runs, action tracking, and audit history.</p>
        </div>
        <div className="toolbar">
          <button className="btn secondary" type="button" onClick={() => void loadAll()} disabled={loading}>
            <RefreshCw size={15} /> {loading ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </header>

      {banner ? <div className={`banner ${banner.type}`}>{banner.message}</div> : null}

      <div className="view-tabs">
        {(["overview", "people", "leave", "payroll", "actions", "audit"] as HrView[]).map((item) => (
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
      {view === "people" ? renderPeople() : null}
      {view === "leave" ? renderLeave() : null}
      {view === "payroll" ? renderPayroll() : null}
      {view === "actions" ? renderActions() : null}
      {view === "audit" ? renderAudit() : null}

      {modal ? renderModal() : null}
      {employeeDetail ? renderEmployeeDetailModal() : null}
    </InternalShell>
  );

  function renderOverview() {
    const cards: Array<[string, number, LucideIcon]> = [
      ["Employees", summary.total_employees, Users],
      ["Active Employees", summary.active_employees, Users],
      ["Pending Leave", summary.pending_leave_requests, CalendarDays],
      ["Open Actions", summary.open_action_items, ClipboardCheck],
      ["Overdue Actions", summary.overdue_action_items, ClipboardCheck],
      ["Open Payroll", summary.open_payroll_runs, BadgeIndianRupee]
    ];
    return (
      <>
        <section className="metrics-grid">
          {cards.map(([label, value, Icon]) => {
            return (
              <article className="metric-card" key={String(label)}>
                <div className="button-row" style={{ justifyContent: "space-between" }}>
                  <div className="metric-label">{label}</div>
                  <Icon size={18} />
                </div>
                <div className="metric-value">{String(value ?? 0)}</div>
              </article>
            );
          })}
        </section>
        <div className="grid-two">
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Pending Leave</h2>
                <p className="muted">Recent requests awaiting action.</p>
              </div>
              <button className="btn secondary" type="button" onClick={() => setView("leave")}>Open</button>
            </div>
            <div className="compact-list">
              {pendingLeave.length ? pendingLeave.map((item) => (
                <div className="compact-row" key={item.id}>
                  <strong>{item.employee_name}</strong>
                  <div className="small muted">{pretty(item.leave_type)} / {formatDate(item.start_date)} to {formatDate(item.end_date)}</div>
                </div>
              )) : <div className="compact-row muted">No pending leave.</div>}
            </div>
          </section>
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Open Actions</h2>
                <p className="muted">Highest priority people tasks.</p>
              </div>
              <button className="btn secondary" type="button" onClick={() => setView("actions")}>Open</button>
            </div>
            <div className="compact-list">
              {openActions.length ? openActions.map((item) => (
                <div className="compact-row" key={item.id}>
                  <strong>{item.title}</strong>
                  <div className="small muted">{pretty(item.priority)} / {item.employee_name || "General"} / due {formatDate(item.due_date)}</div>
                </div>
              )) : <div className="compact-row muted">No open actions.</div>}
            </div>
          </section>
        </div>
      </>
    );
  }

  function renderPeople() {
    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Employees</h2>
            <p className="muted">Employee master records.</p>
          </div>
          <div className="toolbar">
            <select value={employeeStatusFilter} onChange={(event) => setEmployeeStatusFilter(event.target.value)}>
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="ON_NOTICE">On notice</option>
              <option value="INACTIVE">Inactive</option>
              <option value="EXITED">Exited</option>
            </select>
            <button className="btn secondary" type="button" onClick={() => void loadAll()}>Apply</button>
            <button className="btn primary" type="button" onClick={() => setModal({ kind: "employee" })}>
              <Plus size={15} /> Employee
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Employee</th><th>Department</th><th>Designation</th><th>Status</th><th>Joining</th><th>App User</th><th /></tr></thead>
            <tbody>
              {employees.length ? employees.map((item) => (
                <tr
                  className="clickable-row"
                  key={item.id}
                  onClick={() => void openEmployeeDetails(item)}
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void openEmployeeDetails(item);
                    }
                  }}
                >
                  <td><strong>{item.full_name}</strong><div className="small muted">{item.employee_code} / {item.work_email || "-"}</div></td>
                  <td>{item.department || "-"}</td>
                  <td>{item.designation || "-"}</td>
                  <td><span className={`status-pill ${statusClass(item.employment_status)}`}>{pretty(item.employment_status)}</span></td>
                  <td>{formatDate(item.joining_date)}</td>
                  <td>{item.app_user_email || "-"}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="btn secondary"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void openEmployeeDetails(item);
                        }}
                        disabled={detailLoadingId === item.id}
                      >
                        {detailLoadingId === item.id ? "Opening" : "Details"}
                      </button>
                      <button
                        className="btn secondary"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setModal({ kind: "employee", item });
                        }}
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              )) : <tr><td colSpan={7}>No employees found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  function renderLeave() {
    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Leave Requests</h2>
            <p className="muted">Request, approve, reject, or cancel leave.</p>
          </div>
          <div className="toolbar">
            <select value={leaveStatusFilter} onChange={(event) => setLeaveStatusFilter(event.target.value)}>
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <button className="btn secondary" type="button" onClick={() => void loadAll()}>Apply</button>
            <button className="btn primary" type="button" onClick={() => setModal({ kind: "leave" })}><Plus size={15} /> Leave</button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th>Days</th><th>Status</th><th>Reason</th><th /></tr></thead>
            <tbody>
              {leaveRequests.length ? leaveRequests.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.employee_name}</strong><div className="small muted">{item.employee_code}</div></td>
                  <td>{pretty(item.leave_type)}</td>
                  <td>{formatDate(item.start_date)} to {formatDate(item.end_date)}</td>
                  <td>{item.total_days}</td>
                  <td><span className={`status-pill ${statusClass(item.status)}`}>{pretty(item.status)}</span></td>
                  <td>{item.reason || "-"}</td>
                  <td><div className="row-actions"><button className="btn secondary" type="button" onClick={() => setModal({ kind: "leave", item })}>Edit</button></div></td>
                </tr>
              )) : <tr><td colSpan={7}>No leave requests found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  function renderPayroll() {
    return (
      <>
        <div className="grid-two">
          <section className="panel">
            <div className="panel-header">
              <div><h2>Salary Structures</h2><p className="muted">Compensation records with audit trail.</p></div>
              <button className="btn primary" type="button" onClick={() => setModal({ kind: "salary" })}><Plus size={15} /> Salary</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Employee</th><th>Effective</th><th>CTC</th><th>Monthly Base</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {salaryStructures.length ? salaryStructures.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.employee_name}</strong><div className="small muted">{item.employee_code}</div></td>
                      <td>{formatDate(item.effective_from)}</td>
                      <td>{money(item.ctc_annual)}</td>
                      <td>{money(Number(item.basic_monthly || 0) + Number(item.hra_monthly || 0) + Number(item.special_allowance_monthly || 0) + Number(item.other_allowances_monthly || 0))}</td>
                      <td><span className={`status-pill ${statusClass(item.status)}`}>{pretty(item.status)}</span></td>
                      <td><div className="row-actions"><button className="btn secondary" type="button" onClick={() => setModal({ kind: "salary", item })}>Edit</button></div></td>
                    </tr>
                  )) : <tr><td colSpan={6}>No salary structures found.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel">
            <div className="panel-header">
              <div><h2>Payroll Runs</h2><p className="muted">Monthly run totals and status.</p></div>
              <button className="btn primary" type="button" onClick={() => setModal({ kind: "payrollRun" })}><Plus size={15} /> Run</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Period</th><th>Status</th><th>Lines</th><th>Net Pay</th><th /></tr></thead>
                <tbody>
                  {payrollRuns.length ? payrollRuns.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDate(item.period_start)} to {formatDate(item.period_end)}</td>
                      <td><span className={`status-pill ${statusClass(item.status)}`}>{pretty(item.status)}</span></td>
                      <td>{item.line_count || 0}</td>
                      <td>{money(item.total_net_pay)}</td>
                      <td><div className="row-actions"><button className="btn secondary" type="button" onClick={() => void loadPayrollLinesFor(item.id)}>Lines</button><button className="btn secondary" type="button" onClick={() => setModal({ kind: "payrollRun", item })}>Edit</button></div></td>
                    </tr>
                  )) : <tr><td colSpan={5}>No payroll runs found.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <section className="panel">
          <div className="panel-header">
            <div><h2>Payroll Lines</h2><p className="muted">Employee-level gross, deductions, and net pay.</p></div>
            <div className="toolbar">
              <select value={selectedPayrollRunId} onChange={(event) => void loadPayrollLinesFor(event.target.value)}>
                <option value="">Select run</option>
                {payrollRuns.map((item) => <option key={item.id} value={item.id}>{formatDate(item.period_start)} to {formatDate(item.period_end)} / {item.status}</option>)}
              </select>
              <button className="btn primary" type="button" onClick={() => setModal({ kind: "payrollLine" })}><Plus size={15} /> Line</button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Employee</th><th>Paid Days</th><th>LWP</th><th>Gross</th><th>Deductions</th><th>Tax</th><th>Net</th><th /></tr></thead>
              <tbody>
                {payrollLines.length ? payrollLines.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.employee_name}</strong><div className="small muted">{item.employee_code}</div></td>
                    <td>{item.paid_days}</td>
                    <td>{item.leave_without_pay_days}</td>
                    <td>{money(item.gross_pay)}</td>
                    <td>{money(item.deductions)}</td>
                    <td>{money(item.tax_deduction)}</td>
                    <td>{money(item.net_pay)}</td>
                    <td><div className="row-actions"><button className="btn secondary" type="button" onClick={() => setModal({ kind: "payrollLine", item })}>Edit</button></div></td>
                  </tr>
                )) : <tr><td colSpan={8}>No payroll lines found.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  function renderActions() {
    return (
      <section className="panel">
        <div className="panel-header">
          <div><h2>Action Tracker</h2><p className="muted">People operations follow-through.</p></div>
          <div className="toolbar">
            <select value={actionStatusFilter} onChange={(event) => setActionStatusFilter(event.target.value)}>
              <option value="">All statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="BLOCKED">Blocked</option>
              <option value="DONE">Done</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <button className="btn secondary" type="button" onClick={() => void loadAll()}>Apply</button>
            <button className="btn primary" type="button" onClick={() => setModal({ kind: "action" })}><Plus size={15} /> Action</button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Item</th><th>Employee</th><th>Category</th><th>Priority</th><th>Status</th><th>Due</th><th /></tr></thead>
            <tbody>
              {actionItems.length ? actionItems.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.title}</strong><div className="small muted">{item.description || ""}</div></td>
                  <td>{item.employee_name || "-"}</td>
                  <td>{pretty(item.category)}</td>
                  <td><span className={`status-pill ${statusClass(item.priority)}`}>{pretty(item.priority)}</span></td>
                  <td><span className={`status-pill ${statusClass(item.status)}`}>{pretty(item.status)}</span></td>
                  <td>{formatDate(item.due_date)}</td>
                  <td><div className="row-actions"><button className="btn secondary" type="button" onClick={() => setModal({ kind: "action", item })}>Edit</button></div></td>
                </tr>
              )) : <tr><td colSpan={7}>No action items found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  function renderAudit() {
    return (
      <section className="panel">
        <div className="panel-header">
          <div><h2>Payroll Audit</h2><p className="muted">Append-only changes for salary and payroll records.</p></div>
          <div className="toolbar">
            <select value={auditTableFilter} onChange={(event) => setAuditTableFilter(event.target.value)}>
              <option value="">All sensitive tables</option>
              <option value="hr.salary_structures">Salary structures</option>
              <option value="hr.payroll_runs">Payroll runs</option>
              <option value="hr.payroll_run_lines">Payroll lines</option>
            </select>
            <button className="btn secondary" type="button" onClick={() => void loadAll()}>Apply</button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>When</th><th>Table</th><th>Event</th><th>Actor</th><th>Fields</th><th>Reason</th></tr></thead>
            <tbody>
              {auditEvents.length ? auditEvents.map((item) => (
                <tr key={item.id}>
                  <td>{formatDateTime(item.occurred_at)}</td>
                  <td>{item.table_name}</td>
                  <td><span className={`status-pill ${statusClass(item.event_type)}`}>{pretty(item.event_type)}</span></td>
                  <td>{item.actor_email || "-"}<div className="small muted">{item.actor_role || ""}</div></td>
                  <td>{(item.changed_fields || []).slice(0, 8).join(", ")}</td>
                  <td>{item.reason || "-"}</td>
                </tr>
              )) : <tr><td colSpan={6}>No audit events found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  function renderModal() {
    if (!modal) return null;
    const title = {
      employee: modal?.item ? "Edit Employee" : "New Employee",
      leave: modal?.item ? "Edit Leave" : "New Leave",
      salary: modal?.item ? "Edit Salary" : "New Salary",
      payrollRun: modal?.item ? "Edit Payroll Run" : "New Payroll Run",
      payrollLine: modal?.item ? "Edit Payroll Line" : "New Payroll Line",
      action: modal?.item ? "Edit Action" : "New Action"
    }[modal.kind];

    return (
      <div className="modal-backdrop">
        <form className="modal" onSubmit={(event) => void submitModal(event)}>
          <div className="modal-header">
            <h2>{title}</h2>
            <button className="icon-btn" type="button" onClick={() => setModal(null)}>x</button>
          </div>
          <div className="modal-body">{renderModalFields()}</div>
          <div className="modal-footer">
            <button className="btn" type="button" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn primary" type="submit">Save</button>
          </div>
        </form>
      </div>
    );
  }

  function renderDetailValue(label: string, value?: string | number | null) {
    return (
      <div className="detail-item">
        <span>{label}</span>
        <strong>{value == null || value === "" ? "-" : value}</strong>
      </div>
    );
  }

  function renderEmployeeDetailModal() {
    if (!employeeDetail) return null;
    const bank = employeeDetail.bank_account;

    return (
      <div className="modal-backdrop">
        <section className="modal detail-modal">
          <div className="modal-header">
            <div>
              <h2>{employeeDetail.full_name}</h2>
              <p className="small muted">{employeeDetail.employee_code}</p>
            </div>
            <button className="icon-btn" type="button" onClick={() => setEmployeeDetail(null)}>x</button>
          </div>
          <div className="modal-body detail-body">
            <section className="detail-section">
              <div className="detail-heading">
                <Users size={17} />
                <h3>Employee Info</h3>
              </div>
              <div className="detail-grid">
                {renderDetailValue("Department", employeeDetail.department)}
                {renderDetailValue("Designation", employeeDetail.designation)}
                {renderDetailValue("Employment Type", pretty(employeeDetail.employment_type))}
                <div className="detail-item">
                  <span>Status</span>
                  <strong><span className={`status-pill ${statusClass(employeeDetail.employment_status)}`}>{pretty(employeeDetail.employment_status)}</span></strong>
                </div>
                {renderDetailValue("Joining Date", formatDate(employeeDetail.joining_date))}
                {renderDetailValue("Exit Date", formatDate(employeeDetail.exit_date))}
                {renderDetailValue("Manager", employeeDetail.manager_name)}
                {renderDetailValue("App User", employeeDetail.app_user_email)}
              </div>
            </section>

            <section className="detail-section">
              <div className="detail-heading">
                <Mail size={17} />
                <h3>Contact</h3>
              </div>
              <div className="detail-grid">
                {renderDetailValue("Work Email", employeeDetail.work_email)}
                {renderDetailValue("Personal Email", employeeDetail.personal_email)}
                <div className="detail-item">
                  <span>Phone</span>
                  <strong><Phone size={14} /> {employeeDetail.phone || "-"}</strong>
                </div>
              </div>
            </section>

            <section className="detail-section">
              <div className="detail-heading">
                <CreditCard size={17} />
                <h3>Bank Details</h3>
              </div>
              {bank ? (
                <div className="detail-grid">
                  {renderDetailValue("Bank Name", bank.bank_name)}
                  {renderDetailValue("Account Type", bank.account_type)}
                  {renderDetailValue("IFSC Code", bank.ifsc_code)}
                  {renderDetailValue("Account Number", bank.account_number)}
                  {renderDetailValue("Bank Record Status", pretty(bank.status))}
                  {renderDetailValue("Updated", formatDateTime(bank.updated_at))}
                </div>
              ) : (
                <div className="compact-row muted">No active bank details recorded.</div>
              )}
            </section>
          </div>
          <div className="modal-footer">
            <button
              className="btn secondary"
              type="button"
              onClick={() => {
                setModal({ kind: "employee", item: employeeDetail });
                setEmployeeDetail(null);
              }}
            >
              <Building2 size={15} /> Edit Employee
            </button>
            <button className="btn primary" type="button" onClick={() => setEmployeeDetail(null)}>Done</button>
          </div>
        </section>
      </div>
    );
  }

  function renderEmployeeSelect(selected?: string | null) {
    return (
      <select name="employee_id" defaultValue={selected || ""} required>
        <option value="">Select employee</option>
        {employees.map((item) => <option key={item.id} value={item.id}>{item.full_name} ({item.employee_code})</option>)}
      </select>
    );
  }

  function renderModalFields() {
    if (!modal) return null;
    if (modal.kind === "employee") {
      const item = modal.item;
      return (
        <div className="form-grid">
          <label>Employee Code<input name="employee_code" required defaultValue={item?.employee_code || ""} /></label>
          <label>Full Name<input name="full_name" required defaultValue={item?.full_name || ""} /></label>
          <label>Work Email<input name="work_email" type="email" defaultValue={item?.work_email || ""} /></label>
          <label>Phone<input name="phone" defaultValue={item?.phone || ""} /></label>
          <label>Department<input name="department" defaultValue={item?.department || ""} /></label>
          <label>Designation<input name="designation" defaultValue={item?.designation || ""} /></label>
          <label>Employment Type<select name="employment_type" defaultValue={item?.employment_type || "FULL_TIME"}><option value="FULL_TIME">Full Time</option><option value="PART_TIME">Part Time</option><option value="CONTRACT">Contract</option><option value="INTERN">Intern</option><option value="CONSULTANT">Consultant</option></select></label>
          <label>Status<select name="employment_status" defaultValue={item?.employment_status || "ACTIVE"}><option value="ACTIVE">Active</option><option value="ON_NOTICE">On Notice</option><option value="INACTIVE">Inactive</option><option value="EXITED">Exited</option></select></label>
          <label>Joining Date<input name="joining_date" type="date" defaultValue={item?.joining_date || ""} /></label>
          <label>Exit Date<input name="exit_date" type="date" defaultValue={item?.exit_date || ""} /></label>
        </div>
      );
    }
    if (modal.kind === "leave") {
      const item = modal.item;
      return (
        <div className="form-grid">
          <label>Employee{renderEmployeeSelect(item?.employee_id)}</label>
          <label>Leave Type<input name="leave_type" required defaultValue={item?.leave_type || "ANNUAL"} /></label>
          <label>Start Date<input name="start_date" required type="date" defaultValue={item?.start_date || ""} /></label>
          <label>End Date<input name="end_date" required type="date" defaultValue={item?.end_date || ""} /></label>
          <label>Total Days<input name="total_days" required type="number" step="0.5" defaultValue={item?.total_days || ""} /></label>
          <label>Status<select name="status" defaultValue={item?.status || "PENDING"}><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="CANCELLED">Cancelled</option></select></label>
          <label className="full">Reason<textarea name="reason" defaultValue={item?.reason || ""} /></label>
          <label className="full">Rejection Reason<textarea name="rejection_reason" defaultValue={item?.rejection_reason || ""} /></label>
        </div>
      );
    }
    if (modal.kind === "salary") {
      const item = modal.item;
      return (
        <div className="form-grid">
          <label>Employee{renderEmployeeSelect(item?.employee_id)}</label>
          <label>Effective From<input name="effective_from" required type="date" defaultValue={item?.effective_from || ""} /></label>
          <label>Effective To<input name="effective_to" type="date" defaultValue={item?.effective_to || ""} /></label>
          <label>Status<select name="status" defaultValue={item?.status || "ACTIVE"}><option value="ACTIVE">Active</option><option value="DRAFT">Draft</option><option value="SUPERSEDED">Superseded</option></select></label>
          <label>Annual CTC<input name="ctc_annual" type="number" step="0.01" defaultValue={item?.ctc_annual || 0} /></label>
          <label>Basic Monthly<input name="basic_monthly" type="number" step="0.01" defaultValue={item?.basic_monthly || 0} /></label>
          <label>HRA Monthly<input name="hra_monthly" type="number" step="0.01" defaultValue={item?.hra_monthly || 0} /></label>
          <label>Special Allowance<input name="special_allowance_monthly" type="number" step="0.01" defaultValue={item?.special_allowance_monthly || 0} /></label>
          <label>Other Allowances<input name="other_allowances_monthly" type="number" step="0.01" defaultValue={item?.other_allowances_monthly || 0} /></label>
          <label>Employer PF<input name="employer_pf_monthly" type="number" step="0.01" defaultValue={item?.employer_pf_monthly || 0} /></label>
          <label>Variable Annual<input name="variable_pay_annual" type="number" step="0.01" defaultValue={item?.variable_pay_annual || 0} /></label>
          <label>Audit Reason<input name="audit_reason" defaultValue={item ? "salary structure updated" : "salary structure created"} /></label>
        </div>
      );
    }
    if (modal.kind === "payrollRun") {
      const item = modal.item;
      return (
        <div className="form-grid">
          <label>Period Start<input name="period_start" required type="date" defaultValue={item?.period_start || ""} /></label>
          <label>Period End<input name="period_end" required type="date" defaultValue={item?.period_end || ""} /></label>
          <label>Pay Date<input name="pay_date" type="date" defaultValue={item?.pay_date || ""} /></label>
          <label>Status<select name="status" defaultValue={item?.status || "DRAFT"}><option value="DRAFT">Draft</option><option value="CALCULATED">Calculated</option><option value="APPROVED">Approved</option><option value="PAID">Paid</option><option value="CANCELLED">Cancelled</option></select></label>
          <label className="full">Notes<textarea name="notes" defaultValue={item?.notes || ""} /></label>
          <label className="full">Audit Reason<input name="audit_reason" defaultValue={item ? "payroll run updated" : "payroll run created"} /></label>
        </div>
      );
    }
    if (modal.kind === "payrollLine") {
      const item = modal.item;
      return (
        <div className="form-grid">
          <label>Employee{renderEmployeeSelect(item?.employee_id)}</label>
          <label>Paid Days<input name="paid_days" type="number" step="0.5" defaultValue={item?.paid_days || 0} /></label>
          <label>LWP Days<input name="leave_without_pay_days" type="number" step="0.5" defaultValue={item?.leave_without_pay_days || 0} /></label>
          <label>Gross Pay<input name="gross_pay" type="number" step="0.01" defaultValue={item?.gross_pay || 0} /></label>
          <label>Deductions<input name="deductions" type="number" step="0.01" defaultValue={item?.deductions || 0} /></label>
          <label>Tax Deduction<input name="tax_deduction" type="number" step="0.01" defaultValue={item?.tax_deduction || 0} /></label>
          <label>Reimbursements<input name="reimbursements" type="number" step="0.01" defaultValue={item?.reimbursements || 0} /></label>
          <label>Net Pay<input name="net_pay" type="number" step="0.01" defaultValue={item?.net_pay || 0} /></label>
          <label className="full">Audit Reason<input name="audit_reason" defaultValue={item ? "payroll line updated" : "payroll line created"} /></label>
        </div>
      );
    }
    const item = modal.item;
    return (
      <div className="form-grid">
        <label className="full">Title<input name="title" required defaultValue={item?.title || ""} /></label>
        <label>Employee<select name="employee_id" defaultValue={item?.employee_id || ""}><option value="">General</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name}</option>)}</select></label>
        <label>Category<input name="category" defaultValue={item?.category || "GENERAL"} /></label>
        <label>Priority<select name="priority" defaultValue={item?.priority || "MEDIUM"}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select></label>
        <label>Status<select name="status" defaultValue={item?.status || "OPEN"}><option value="OPEN">Open</option><option value="IN_PROGRESS">In Progress</option><option value="BLOCKED">Blocked</option><option value="DONE">Done</option><option value="CANCELLED">Cancelled</option></select></label>
        <label>Due Date<input name="due_date" type="date" defaultValue={item?.due_date || ""} /></label>
        <label className="full">Description<textarea name="description" defaultValue={item?.description || ""} /></label>
      </div>
    );
  }
}
