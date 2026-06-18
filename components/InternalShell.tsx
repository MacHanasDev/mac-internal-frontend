"use client";

import type { ReactNode } from "react";
import {
  BarChart3,
  ClipboardList,
  Landmark,
  FileClock,
  LogOut,
  ShieldCheck,
  Users
} from "lucide-react";
import { clearToken, type UserProfile } from "@/lib/api";

type InternalShellProps = {
  children: ReactNode;
  user: UserProfile;
  active: "hr" | "finance" | "org" | "policies" | "reports";
};

export default function InternalShell({ children, user, active }: InternalShellProps) {
  function logout() {
    clearToken();
    window.location.href = "/login";
  }

  const normalizeRole = (roleValue?: string | null) => String(roleValue || "").toUpperCase().replace(/-/g, "_").trim();
  const role = normalizeRole(user.role);
  const roles = [role, ...(user.roles || []).map(normalizeRole)].filter(Boolean);
  const canUseFinance = roles.includes("SUPERADMIN") || roles.includes("FIN_ACCOUNTS");

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand">
            <div className="brand-mark">MI</div>
            <div className="brand-copy">
              <strong>Mac Internal</strong>
              <span className="small">Org operations</span>
            </div>
          </div>

          <nav className="nav-stack">
            <a className={`nav-link ${active === "hr" ? "active" : ""}`} href="/hr">
              <Users size={18} />
              <span>HR Workspace</span>
            </a>
            {canUseFinance ? (
              <a className={`nav-link ${active === "finance" ? "active" : ""}`} href="/finance">
                <Landmark size={18} />
                <span>Financial Cockpit</span>
              </a>
            ) : (
              <button className="nav-link disabled" type="button">
                <Landmark size={18} />
                <span>Financial Cockpit</span>
              </button>
            )}
            <button className="nav-link disabled" type="button">
              <ClipboardList size={18} />
              <span>Org Actions</span>
            </button>
            <button className="nav-link disabled" type="button">
              <FileClock size={18} />
              <span>Policies</span>
            </button>
            <button className="nav-link disabled" type="button">
              <BarChart3 size={18} />
              <span>Reports</span>
            </button>
          </nav>
        </div>

        <div>
          <div className="compact-row">
            <div className="button-row" style={{ justifyContent: "space-between" }}>
              <ShieldCheck size={18} />
              <span className="status-pill good">{role || "USER"}</span>
            </div>
            <strong style={{ display: "block", marginTop: 10 }}>
              {user.full_name || user.username}
            </strong>
            <p className="small muted" style={{ marginBottom: 12 }}>
              {user.username}
            </p>
            <button className="btn secondary" type="button" onClick={logout}>
              <LogOut size={15} /> Logout
            </button>
          </div>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
