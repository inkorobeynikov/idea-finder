"use client";

import { useStore } from "@/lib/store";
import { LoginScreen } from "./LoginScreen";
import { TopBar } from "./TopBar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { authed, authReady, dataReady, loadError } = useStore();

  // Wait until we know whether there's a session before deciding what to show.
  if (!authReady) {
    return <CenteredSpinner />;
  }

  if (!authed) return <LoginScreen />;

  return (
    <div className="app">
      <TopBar />
      {!dataReady ? (
        <CenteredSpinner />
      ) : loadError ? (
        <div className="page">
          <div className="empty" style={{ marginTop: 32 }}>
            <h4>Couldn&apos;t load data</h4>
            <p>{loadError}</p>
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function CenteredSpinner() {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span className="spin dark" style={{ width: 20, height: 20 }} />
    </div>
  );
}
