import Link from "next/link";
import ThemeToggle from "./components/ThemeToggle";

export default function Home() {
  return (
    <main className="auth-page">
      <div className="auth-atmosphere" aria-hidden="true" />
      <div className="auth-topbar">
        <span className="brand-mark">
          <span className="brand-mark-icon">✦</span>
          <span>Ping</span>
        </span>
        <ThemeToggle />
      </div>
      <section className="auth-card">
        <p className="auth-eyebrow">Private, simple, human</p>
        <h1>Good conversations start here.</h1>
        <p className="sidebar-meta">
          A focused space for the people and messages you care about.
        </p>
        <div className="auth-form" style={{ marginTop: 28 }}>
          <Link href="/login" className="auth-submit" style={{ textAlign: "center", textDecoration: "none" }}>
            Log in
          </Link>
          <Link href="/register" className="auth-input" style={{ textAlign: "center", textDecoration: "none" }}>
            Create an account
          </Link>
        </div>
      </section>
    </main>
  );
}
