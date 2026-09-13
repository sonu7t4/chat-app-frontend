"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "../../lib/config";
import Link from "next/link";
import AuthShell from "../components/AuthShell";

export default function RegisterPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    username: "",
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
        `${API_URL}/api/auth/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Registration failed");
      }

      console.log(data);

      router.push("/login");
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Create your space" eyebrow="A calmer way to keep in touch">
      <form onSubmit={handleSubmit} className="auth-form">

        {error && (
          <p className="auth-error">
            {error}
          </p>
        )}

        <label className="auth-label">
          Username
          <input
            type="text"
            name="username"
            placeholder="How should people find you?"
            value={formData.username}
            onChange={handleChange}
            className="auth-input"
            required
          />
        </label>

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
            placeholder="At least 8 characters"
            value={formData.password}
            onChange={handleChange}
            className="auth-input"
            minLength={8}
            required
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="auth-submit"
        >
          {loading ? "Creating..." : "Register"}
        </button>
        <p className="auth-footer">
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </form>
    </AuthShell>
  );
}