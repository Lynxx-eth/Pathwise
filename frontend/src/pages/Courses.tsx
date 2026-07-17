// Courses home (Step 3): the multi-course grid wired to real data —
// mastery %, topic count, streak flame — with a cap-aware "add course" card.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { BookIcon, PlusIcon, FlameIcon } from "../components/icons";

interface Course {
  id: string;
  name: string;
  icon: string;
  mastery: number;
  topicCount: number;
}
interface Meta {
  count: number;
  cap: number;
  isPremium: boolean;
  atCap: boolean;
}

// Mastery pill color shifts with progress, matching the design language.
function masteryPillClass(mastery: number): string {
  if (mastery >= 70) return "pill pill-mint";
  if (mastery >= 40) return "pill pill-green";
  return "pill pill-muted";
}

export default function Courses() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);

  useEffect(() => {
    api
      .get<{ courses: Course[]; meta: Meta }>("/api/courses")
      .then((r) => {
        setCourses(r.courses);
        setMeta(r.meta);
      })
      .catch(() => setCourses([]));
  }, []);

  const streak = user?.streakCount ?? 0;

  return (
    <AppShell>
      {courses === null ? (
        <p style={{ color: "var(--ink-soft)" }}>Loading your courses…</p>
      ) : courses.length === 0 ? (
        <div className="empty-state">
          <div className="icon-circle">
            <BookIcon cls="icon-lg" />
          </div>
          <h2 style={{ fontSize: 19, marginBottom: 6 }}>No courses yet</h2>
          <p
            style={{
              color: "var(--ink-soft)",
              fontSize: 14,
              maxWidth: 360,
              margin: "0 auto 20px",
            }}
          >
            Add your first course by uploading its syllabus or slides. Pathwise
            builds a personalized knowledge map from your own material.
          </p>
          <button className="btn btn-primary" onClick={() => navigate("/courses/new")}>
            <PlusIcon cls="icon" /> Add your first course
          </button>
        </div>
      ) : (
        <>
          {meta && !meta.isPremium && (
            <p style={{ color: "var(--ink-faint)", fontSize: 12.5, marginBottom: 14 }}>
              {meta.count} of {meta.cap} courses used on the free plan
            </p>
          )}
          <div className="courses-grid">
            {courses.map((c) => (
              <div
                key={c.id}
                className="course-card"
                onClick={() => navigate(`/courses/${c.id}`)}
                style={{ cursor: "pointer" }}
              >
                <div className="course-icon">
                  <BookIcon cls="icon" />
                </div>
                <div className="course-name">{c.name}</div>
                <div className="course-stats-row">
                  <span className={masteryPillClass(c.mastery)}>{c.mastery}% mastery</span>
                  <span className="streak-badge" style={{ color: "var(--accent)" }}>
                    <FlameIcon cls="icon-sm" /> {streak}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--ink-faint)",
                    fontWeight: 600,
                  }}
                >
                  {c.topicCount} topic{c.topicCount === 1 ? "" : "s"} mapped
                </div>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 12, padding: "8px 14px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/courses/${c.id}`);
                  }}
                >
                  View progress
                </button>
              </div>
            ))}

            {meta?.atCap ? (
              <button
                className="add-course-card"
                onClick={() => navigate("/upgrade")}
                style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
              >
                <PlusIcon cls="icon-lg" />
                Course limit reached — see Pro
              </button>
            ) : (
              <button className="add-course-card" onClick={() => navigate("/courses/new")}>
                <PlusIcon cls="icon-lg" />
                Add a course
              </button>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}
