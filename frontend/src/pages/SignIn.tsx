import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";
import { BrainIcon } from "../components/icons";

export default function SignIn() {
  const { signin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signin(email, password);
      navigate("/courses");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="auth-mascot">
          <BrainIcon cls="icon-lg" />
        </div>
        <h1 style={{ fontSize: 23, marginBottom: 6 }}>Welcome back</h1>
        <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginBottom: 26 }}>
          Pick up your streak where you left off.
        </p>

        {error && <div className="form-error">{error}</div>}

        <div className="field">
          <label>School email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@university.edu"
            required
          />
        </div>
        <div className="field">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>

        <button
          className="btn btn-primary btn-block"
          style={{ marginTop: 6 }}
          disabled={busy}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <p
          style={{
            textAlign: "center",
            fontSize: 13,
            color: "var(--ink-soft)",
            marginTop: 22,
          }}
        >
          New here?{" "}
          <Link to="/signup" style={{ color: "var(--primary)", fontWeight: 700 }}>
            Create an account
          </Link>
        </p>
      </form>
    </div>
  );
}
