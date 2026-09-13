"use client";

import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

export default function AuthShell({ children, title, eyebrow }) {
  return (
    <main className="auth-page">
      <div className="auth-atmosphere" aria-hidden="true" />
      <div className="auth-topbar">
        <Link href="/" className="brand-mark">
          <span className="brand-mark-icon">✦</span>
          <span>Ping</span>
        </Link>
        <ThemeToggle />
      </div>
      <section className="auth-card">
        <p className="auth-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children}
      </section>
    </main>
  );
}
