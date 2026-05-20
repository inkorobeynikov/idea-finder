"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";

export function LoginScreen() {
  const { signIn } = useStore();
  const [email, setEmail] = useState("adam@idea-finder.dev");
  const [pw, setPw] = useState("••••••••••");
  const [loading, setLoading] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => signIn(), 480);
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@idea-finder.dev"
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
            />
          </div>
          <button className="btn primary" type="submit" disabled={loading}>
            {loading ? <span className="spin" /> : "Sign in"}
          </button>
        </div>

        <div className="login-foot">Internal tool · 2 seats</div>
      </form>
    </div>
  );
}
