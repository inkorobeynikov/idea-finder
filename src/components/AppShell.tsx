"use client";

import { useStore } from "@/lib/store";
import { LoginScreen } from "./LoginScreen";
import { TopBar } from "./TopBar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { authed } = useStore();

  if (!authed) return <LoginScreen />;

  return (
    <div className="app">
      <TopBar />
      {children}
    </div>
  );
}
