"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "../../lib/config";
import Link from "next/link";
import AuthShell from "../components/AuthShell";

export default function LoginPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(formData),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      // Store user
      localStorage.setItem(
        "user",
        JSON.stringify(data.user)
      );

      console.log("Login successful:", data);

      router.push("/chat");
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Welcome back" eyebrow="Your conversations, in one place">
      <form onSubmit={handleSubmit} className="auth-form">

        {error && (
          <p className="auth-error">
            {error}
          </p>
        )}

        <label className="auth-label">
          Email address
          <input
            type="email"
            name="email"
            placeholder="you@example.com"
            value={formData.email}
            onChange={handleChange}
            className="auth-input"
            required
          />
        </label>

        <label className="auth-label">
          Password
          <input
            type="password"
            name="password"
            placeholder="Your password"
            value={formData.password}
            onChange={handleChange}
            className="auth-input"
            required
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="auth-submit"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
        <p className="auth-footer">
          New to Ping? <Link href="/register">Create an account</Link>
        </p>
      </form>
    </AuthShell>
  );
}