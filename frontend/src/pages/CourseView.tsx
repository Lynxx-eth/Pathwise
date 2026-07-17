// Course knowledge map (Step 2 DoD): the weighted topic list produced from
// uploaded materials, plus the ability to add more materials later.
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { api, ApiError } from "../lib/api";
import {
  BookIcon,
  FileIcon,
  CheckIcon,
  AlertIcon,
  UploadIcon,
} from "../components/icons";

interface Topic {
  id: string;
  name: string;
  summary: string | null;
  weight: number;
}
interface UploadRow {
  id: string;
  filename: string;
  sizeBytes: number;
  status: string;
  error: string | null;
}
interface CourseDetail {
  id: string;
  name: string;
  icon: string;
  topics: Topic[];
  uploads: UploadRow[];
}

function emphasisLabel(weight: number): string {
  if (weight >= 0.75) return "High emphasis";
  if (weight >= 0.5) return "Medium";
  return "Light";
}

export default function CourseView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get<{ course: CourseDetail }>(`/api/courses/${id}`);
      setCourse(r.course);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) navigate("/courses");
      else setError("Couldn't load this course.");
    }
  }, [id, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  async function onAddFiles(files: FileList | null) {
    if (!files || files.length === 0 || !id) return;
    setAdding(true);
    setError(null);
    for (const file of Array.from(files)) {
      try {
        await api.upload(`/api/courses/${id}/uploads`, file);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Upload failed.");
      }
    }
    await load();
    setAdding(false);
  }

  if (!course) {
    return (
      <AppShell>
        {error ? (
          <p style={{ color: "var(--danger)" }}>{error}</p>
        ) : (
          <p style={{ color: "var(--ink-soft)" }}>Loading course…</p>
        )}
      </AppShell>
    );
  }

  const maxWeight = Math.max(0.001, ...course.topics.map((t) => t.weight));

  return (
    <AppShell>
      <button
        className="back-link"
        style={{ background: "none", border: "none", cursor: "pointer", marginBottom: 14 }}
        onClick={() => navigate("/courses")}
      >
        ← All courses
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
        <div className="course-icon">
          <BookIcon cls="icon" />
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 2 }}>
            Knowledge map
          </div>
          <h2 className="section-title" style={{ margin: 0 }}>
            {course.name}
          </h2>
        </div>
      </div>
      <p className="section-sub">
        {course.topics.length} topics extracted from {course.uploads.length} file
        {course.uploads.length === 1 ? "" : "s"}, weighted by how much your material
        emphasizes them.
      </p>

      {error && (
        <div className="form-error" style={{ display: "flex", gap: 8 }}>
          <AlertIcon cls="icon-sm" /> {error}
        </div>
      )}

      {/* Topics */}
      {course.topics.length === 0 ? (
        <div className="empty-state">
          <div className="icon-circle">
            <UploadIcon cls="icon-lg" />
          </div>
          <h3 style={{ fontSize: 17, marginBottom: 6 }}>No topics yet</h3>
          <p style={{ color: "var(--ink-soft)", fontSize: 14, maxWidth: 340, margin: "0 auto 18px" }}>
            Add a syllabus or slide deck and Pathwise will map its topics.
          </p>
          <button className="btn btn-primary" onClick={() => inputRef.current?.click()} disabled={adding}>
            {adding ? "Reading…" : "Add materials"}
          </button>
        </div>
      ) : (
        <div style={{ marginBottom: 28 }}>
          {course.topics.map((t) => (
            <div className="topic-row" key={t.id}>
              <div className="t-main">
                <div className="t-name">{t.name}</div>
                <div className="topic-weight">
                  <span style={{ width: `${(t.weight / maxWeight) * 100}%` }} />
                </div>
              </div>
              <div className="topic-emphasis">{emphasisLabel(t.weight)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Materials */}
      <div className="topbar" style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 16 }}>Materials</h3>
        <button
          className="btn btn-ghost"
          style={{ padding: "8px 14px", fontSize: 13 }}
          onClick={() => inputRef.current?.click()}
          disabled={adding}
        >
          {adding ? "Reading…" : "+ Add materials"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.pptx"
          multiple
          hidden
          onChange={(e) => onAddFiles(e.target.files)}
        />
      </div>

      {course.uploads.length === 0 ? (
        <p style={{ color: "var(--ink-soft)", fontSize: 13.5 }}>No files yet.</p>
      ) : (
        course.uploads.map((u) => (
          <div className="file-row" key={u.id}>
            <FileIcon cls="icon-lg" style={{ color: "var(--primary-dark)" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="fname">{u.filename}</div>
              <div className="fmeta">
                {(u.sizeBytes / 1024).toFixed(0)} KB
                {u.status === "failed" && u.error ? ` — ${u.error}` : ""}
              </div>
            </div>
            {u.status === "processed" ? (
              <span className="pill pill-mint">
                <CheckIcon cls="icon-sm" /> Mapped
              </span>
            ) : u.status === "failed" ? (
              <span className="pill pill-coral">Failed</span>
            ) : (
              <span className="pill pill-muted">{u.status}</span>
            )}
          </div>
        ))
      )}
    </AppShell>
  );
}
