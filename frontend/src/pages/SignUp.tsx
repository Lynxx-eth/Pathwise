import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";
import { BrainIcon } from "../components/icons";

export default function SignUp() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      await signup(name, email, password);
      // New users always see the privacy statement next (shown once).
      navigate("/privacy");
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
        <h1 style={{ fontSize: 23, marginBottom: 6 }}>Start learning better</h1>
        <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginBottom: 26 }}>
          Understand your courses — not just cram them.
        </p>

        {error && <div className="form-error">{error}</div>}

        <div className="field">
          <label>Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ada Lovelace"
            required
          />
        </div>
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
            placeholder="At least 8 characters"
            required
          />
        </div>

        <button
          className="btn btn-primary btn-block"
          style={{ marginTop: 6 }}
          disabled={busy}
        >
          {busy ? "Creating account…" : "Create account"}
        </button>

        <p
          style={{
            textAlign: "center",
            fontSize: 13,
            color: "var(--ink-soft)",
            marginTop: 22,
          }}
        >
          Already have an account?{" "}
          <Link to="/signin" style={{ color: "var(--primary)", fontWeight: 700 }}>
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
