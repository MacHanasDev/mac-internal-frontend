"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { getProfile, getToken, login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("prashanthbr@machanas.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!getToken()) return;
    getProfile()
      .then(() => router.replace("/hr"))
      .catch(() => undefined);
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      router.replace("/hr");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
          <div className="brand">
            <div className="brand-mark">MI</div>
            <div className="brand-copy">
              <strong>Mac Internal</strong>
              <span className="small">Secure org workspace</span>
            </div>
          </div>

          <h1>Sign in</h1>
          <p className="muted">
            Use your MacProc credentials. HR data is available only to HR_ADMIN or SUPERADMIN roles.
          </p>

          {error ? <div className="banner error">{error}</div> : null}

          <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
            <label>
              Email
              <input
                autoComplete="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              Password
              <input
                autoComplete="current-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
          </div>

          <button className="btn primary" type="submit" disabled={loading} style={{ marginTop: 16 }}>
            {loading ? "Signing in" : "Sign in"} <ArrowRight size={16} />
          </button>
        </form>
      </section>

      <section className="auth-art">
        <div>
          <LockKeyhole size={42} />
          <h1 style={{ maxWidth: 620, marginTop: 18 }}>
            Internal tools for people, payroll, and operations.
          </h1>
          <p className="muted" style={{ maxWidth: 560 }}>
            This app is separate from the main MacProc commercial workflow, but uses the same backend auth and HR API.
          </p>
        </div>
      </section>
    </main>
  );
}
