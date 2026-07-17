// Add-a-course flow (Step 2 / Step 3 onboarding): name + upload materials.
// Creates the course, uploads each file, runs the knowledge-map pipeline,
// then sends the student to the course's knowledge map.
import { useRef, useState, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { api, ApiError } from "../lib/api";
import { UploadIcon, FileIcon, CheckIcon, AlertIcon } from "../components/icons";

type FileStatus = "queued" | "uploading" | "ready" | "failed";
interface Item {
  file: File;
  status: FileStatus;
  error?: string;
}

const ACCEPT = ".pdf,.docx,.pptx";
const MAX_FILES = 10;

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function NewCourse() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<"idle" | "processing">("idle");
  const [error, setError] = useState<string | null>(null);
  const [topicCount, setTopicCount] = useState(0);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list).map((file) => ({
      file,
      status: "queued" as FileStatus,
    }));
    setItems((prev) => [...prev, ...incoming].slice(0, MAX_FILES));
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const readyCount = items.filter((i) => i.status === "ready").length;
  const doneCount = items.filter(
    (i) => i.status === "ready" || i.status === "failed"
  ).length;

  async function build() {
    setError(null);
    if (!name.trim()) return setError("Give your course a name first.");
    if (items.length === 0) return setError("Add at least one file to map.");

    setPhase("processing");

    // 1) Create the course.
    let courseId: string;
    try {
      const r = await api.post<{ course: { id: string } }>("/api/courses", {
        name: name.trim(),
      });
      courseId = r.course.id;
    } catch (err) {
      setPhase("idle");
      if (err instanceof ApiError && err.status === 402) {
        // Free-tier course cap — send to the upsell screen (Step 3).
        navigate("/upgrade");
      } else {
        setError(err instanceof ApiError ? err.message : "Couldn't create course.");
      }
      return;
    }

    // 2) Upload each file, running the pipeline per file.
    let totalTopics = 0;
    for (let i = 0; i < items.length; i++) {
      setItems((prev) =>
        prev.map((it, idx) => (idx === i ? { ...it, status: "uploading" } : it))
      );
      try {
        const r = await api.upload<{
          upload: { status: string; error: string | null };
          topicCount: number;
        }>(`/api/courses/${courseId}/uploads`, items[i].file);
        const ok = r.upload.status === "processed";
        totalTopics = r.topicCount;
        setTopicCount(r.topicCount);
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? {
                  ...it,
                  status: ok ? "ready" : "failed",
                  error: r.upload.error ?? undefined,
                }
              : it
          )
        );
      } catch (err) {
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? {
                  ...it,
                  status: "failed",
                  error: err instanceof ApiError ? err.message : "Upload failed",
                }
              : it
          )
        );
      }
    }

    // 3) Go to the knowledge map if anything succeeded.
    if (totalTopics > 0 || items.some((i) => i.status === "ready")) {
      navigate(`/courses/${courseId}`);
    } else {
      setPhase("idle");
      setError("We couldn't read any of those files. Try a different PDF, DOCX, or PPTX.");
    }
  }

  const processing = phase === "processing";
  const progressPct = items.length ? Math.round((doneCount / items.length) * 100) : 0;

  return (
    <AppShell>
      <div style={{ maxWidth: 680 }}>
        <div className="eyebrow">Add a course</div>
        <h2 className="section-title">Upload your course materials</h2>
        <p className="section-sub">
          Add the syllabus and slides — Pathwise builds your study map from them.
        </p>

        {error && (
          <div className="form-error" style={{ display: "flex", gap: 8 }}>
            <AlertIcon cls="icon-sm" /> {error}
          </div>
        )}

        <div className="field">
          <label>Course name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. BIO 201 — Cell Biology"
            disabled={processing}
          />
        </div>

        <div
          className={`upload-zone${dragging ? " drag" : ""}`}
          style={{ margin: "18px 0" }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <div className="icon-circle">
            <UploadIcon cls="icon-lg" />
          </div>
          <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 14.5 }}>
            Drop your syllabus &amp; slides here
          </div>
          <div style={{ color: "var(--ink-soft)", fontSize: 13, marginBottom: 18 }}>
            PDF, PPTX, or DOCX — up to {MAX_FILES} files
          </div>
          <button
            className="btn btn-ghost"
            onClick={() => inputRef.current?.click()}
            disabled={processing}
          >
            Browse files
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            hidden
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>

        {items.map((it, idx) => (
          <div className="file-row" key={idx}>
            <FileIcon cls="icon-lg" style={{ color: "var(--primary-dark)" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="fname">{it.file.name}</div>
              <div className="fmeta">
                {humanSize(it.file.size)}
                {it.status === "failed" && it.error ? ` — ${it.error}` : ""}
              </div>
            </div>
            {it.status === "ready" && (
              <span className="pill pill-mint">
                <CheckIcon cls="icon-sm" /> Ready
              </span>
            )}
            {it.status === "uploading" && <span className="pill pill-muted">Reading…</span>}
            {it.status === "failed" && <span className="pill pill-coral">Failed</span>}
            {it.status === "queued" && !processing && (
              <button
                className="btn btn-ghost"
                style={{ padding: "6px 12px", fontSize: 12 }}
                onClick={() => removeItem(idx)}
              >
                Remove
              </button>
            )}
          </div>
        ))}

        {processing && (
          <div className="card" style={{ background: "var(--primary-light)", border: "none", margin: "16px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--primary-dark)" }}>
                  Mapping your topics…
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>
                  Found {topicCount} topics across {readyCount} file
                  {readyCount === 1 ? "" : "s"} so far
                </div>
              </div>
            </div>
            <div className="progress-track" style={{ marginTop: 14 }}>
              <div className="progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}

        <button
          className="btn btn-primary btn-block"
          style={{ marginTop: 8 }}
          onClick={build}
          disabled={processing}
        >
          {processing ? "Building your map…" : "Build my knowledge map"}
        </button>
      </div>
    </AppShell>
  );
}
