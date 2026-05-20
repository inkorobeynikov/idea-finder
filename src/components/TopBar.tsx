"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";

export function TopBar() {
  const pathname = usePathname();
  const { signOut, ideas, pages } = useStore();
  const onIdeasSection = pathname === "/ideas" || pathname.startsWith("/ideas/");

  return (
    <header className="topbar">
      <Link href="/" className="brand" style={{ textDecoration: "none" }}>
        <span className="brand-mark">IF</span>
        <span>Idea Finder</span>
      </Link>
      <nav>
        <Link className={pathname === "/" ? "active" : ""} href="/">
          All Ideas
        </Link>
        <Link className={onIdeasSection ? "active" : ""} href="/ideas">
          My Ideas
        </Link>
      </nav>
      <div className="right">
        <span
          style={{
            color: "var(--muted-2)",
            fontSize: 11.5,
            fontFamily: "var(--font-mono)",
          }}
        >
          {ideas.length} ideas · {pages.length} pages
        </span>
        <div className="user-chip" title="adam@idea-finder.dev">
          A
        </div>
        <button className="signout" onClick={signOut}>
          Sign out
        </button>
      </div>
    </header>
  );
}
