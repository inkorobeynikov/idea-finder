"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";

export function LoginScreen() {
  const { signIn } = useStore();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    const { error } = await signIn(email.trim(), pw);
    if (error) {
      setError(error);
      setLoading(false);
    }
    // On success, the auth listener flips `authed` and this screen unmounts.
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <span className="brand-mark">IF</span>
          <span className="name">Idea Finder</span>
        </div>
        <h1 className="login-title">Welcome back</h1>
        <p className="login-sub">Sign in to your internal workspace</p>

        <div className="login-form">
          <div>
            <label className="field-label">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@idea-finder.dev"
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="field-label">Password</label>
            <input
              className="input"
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <p style={{ margin: 0, fontSize: 12.5, color: "#B91C1C" }}>{error}</p>
          )}
          <button className="btn primary" type="submit" disabled={loading}>
            {loading ? <span className="spin" /> : "Sign in"}
          </button>
        </div>

        <div className="login-foot">Internal tool · 2 seats</div>
      </form>
    </div>
  );
}
