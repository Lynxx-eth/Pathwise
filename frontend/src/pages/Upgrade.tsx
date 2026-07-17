// Course-cap upsell (Step 3). Billing isn't live yet (that's Step 13), so the
// upgrade button is a "Pro coming soon" placeholder — no payment is taken.
import { useNavigate } from "react-router-dom";
import {
  SparklesIcon,
  BookOpenIcon,
  TrendingUpIcon,
  BrainCircuitIcon,
} from "../components/icons";

const benefits = [
  {
    Icon: BookOpenIcon,
    title: "Unlimited courses",
    body: "Add as many as you're taking",
  },
  {
    Icon: TrendingUpIcon,
    title: "Full analytics history",
    body: "See your whole progress trend, not just this week",
  },
  {
    Icon: BrainCircuitIcon,
    title: "Cosmetic pet items",
    body: "Exclusive skins and accessories for your companion",
  },
];

export default function Upgrade() {
  const navigate = useNavigate();

  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ width: 440, textAlign: "center" }}>
        <div className="auth-mascot" style={{ margin: "0 auto 18px auto" }}>
          <SparklesIcon cls="icon-lg" />
        </div>
        <h1 style={{ fontSize: 21, marginBottom: 8 }}>
          You've reached your course limit
        </h1>
        <p style={{ color: "var(--ink-soft)", fontSize: 13, marginBottom: 22 }}>
          Free plans cover up to 3 courses. Upgrade to Pathwise Pro for unlimited
          courses and more.
        </p>

        <div className="card" style={{ textAlign: "left", marginBottom: 22 }}>
          {benefits.map(({ Icon, title, body }, i) => (
            <div
              key={title}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                marginBottom: i < benefits.length - 1 ? 14 : 0,
              }}
            >
              <Icon cls="icon" style={{ color: "var(--primary-dark)", marginTop: 1 }} />
              <div style={{ fontSize: 13 }}>
                <strong>{title}</strong>
                <br />
                <span style={{ color: "var(--ink-soft)" }}>{body}</span>
              </div>
            </div>
          ))}
        </div>

        <button
          className="btn btn-primary btn-block"
          style={{ marginBottom: 10 }}
          onClick={() =>
            alert("Payments aren't live yet — Pathwise Pro is coming soon!")
          }
        >
          Upgrade — $6.99/mo
          <span className="pill pill-muted" style={{ marginLeft: 8, padding: "3px 8px" }}>
            Soon
          </span>
        </button>
        <button
          onClick={() => navigate("/courses")}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 12.5,
            color: "var(--ink-soft)",
            fontWeight: 600,
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
