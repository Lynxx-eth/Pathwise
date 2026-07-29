// Quiz Mode (Step 5) — real questions, server-side grading, live mastery move.
//
// The correct answer isn't in the payload until after the student answers, so
// it can't be read out of the network tab. Time-on-question is measured here
// and sent along: it feeds the "guessing vs understanding" signal.
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppShell from "../components/AppShell";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useRewardToasts } from "../lib/toast";
import {
  FlameIcon,
  CheckIcon,
  AlertIcon,
  TrendingUpIcon,
  SparklesIcon,
} from "../components/icons";
import { ErrorState, InlineError, Loading } from "../components/states";

interface QuizItem {
  id: string;
  position: number;
  number: number;
  total: number;
  topicName: string;
  question: string;
  options: string[];
}

interface SessionState {
  session: {
    id: string;
    kind: string;
    status: string;
    courseId: string;
    courseName: string;
    total: number;
    answeredCount: number;
    correctCount: number;
  };
  progress: { position: number; answered: boolean; isCorrect: boolean | null }[];
  current: QuizItem | null;
}

interface AnswerResponse {
  result: {
    isCorrect: boolean;
    correctIndex: number;
    explanation: string;
    selectedIndex: number;
  };
  mastery: { before: number; after: number } | null;
  xp: {
    gained: number;
    total: number;
    rank: { level: number; name: string };
    rankedUp: boolean;
  };
  streak: { count: number; best: number };
  newBadges: { key: string; name: string; description: string }[];
  remaining: number;
  completion: {
    correctCount: number;
    total: number;
    xpBonus: number;
    perfect: boolean;
  } | null;
}

export default function Quiz() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const { patchUser } = useAuth();
  const showRewards = useRewardToasts();

  const [state, setState] = useState<SessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<AnswerResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sessionXp, setSessionXp] = useState(0);
  const [runStreak, setRunStreak] = useState(0);

  // Set when a question is rendered; read when it's answered.
  const shownAt = useRef<number>(Date.now());

  async function load(id: string) {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get<SessionState>(`/api/quiz/sessions/${id}`);
      setState(res);
      setAnswer(null);
      shownAt.current = Date.now();
    } catch (err) {
      setLoadError(
        err instanceof ApiError ? err.message : "Couldn't load that quiz."
      );
    } finally {
      setLoading(false);
    }
  }

  // No session id in the URL: resume an active quiz, else send them to pick a
  // course. Starting one blind isn't possible — a quiz needs a course.
  useEffect(() => {
    if (sessionId) {
      void load(sessionId);
      return;
    }
    setLoading(true);
    api
      .get<{ session: { id: string } | null }>("/api/quiz/active")
      .then((res) => {
        if (res.session) navigate(`/quiz/${res.session.id}`, { replace: true });
        else navigate("/courses", { replace: true });
      })
      .catch(() => navigate("/courses", { replace: true }));
  }, [sessionId, navigate]);

  async function submit(index: number) {
    if (!sessionId || !state?.current || answer || submitting) return;
    setSubmitting(true);
    setActionError(null);

    const timeMs = Math.min(Date.now() - shownAt.current, 30 * 60 * 1000);

    try {
      const res = await api.post<AnswerResponse>(
        `/api/quiz/sessions/${sessionId}/answer`,
        { selectedIndex: index, timeMs }
      );
      setAnswer(res);
      setSessionXp((x) => x + res.xp.gained + (res.completion?.xpBonus ?? 0));
      setRunStreak((s) => (res.result.isCorrect ? s + 1 : 0));

      // Keep the rail's XP chip and streak honest without a refetch.
      patchUser({
        xp: res.xp.total,
        rank: {
          level: res.xp.rank.level,
          name: res.xp.rank.name,
          progress: 0,
          nextXp: null,
        },
        streakCount: res.streak.count,
        bestStreak: res.streak.best,
      });
      showRewards(res);
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Couldn't submit that answer."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function next() {
    if (!sessionId) return;
    if (answer?.completion) {
      navigate(`/progress/${state?.session.courseId ?? ""}`);
      return;
    }
    void load(sessionId);
  }

  if (loading) {
    return (
      <AppShell>
        <Loading label="Building your quiz…" />
      </AppShell>
    );
  }

  if (loadError || !state) {
    return (
      <AppShell>
        <ErrorState
          message={loadError ?? "Quiz not found."}
          onRetry={() => sessionId && load(sessionId)}
        />
      </AppShell>
    );
  }

  // Finished, and the student came back to the URL.
  if (!state.current && !answer) {
    return (
      <AppShell>
        <div className="empty-state">
          <div className="icon-circle">
            <CheckIcon cls="icon-lg" />
          </div>
          <h2 style={{ fontSize: 17, marginBottom: 6 }}>Quiz complete</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginBottom: 18 }}>
            You got {state.session.correctCount} of {state.session.total} right.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/progress/${state.session.courseId}`)}
          >
            See your progress
          </button>
        </div>
      </AppShell>
    );
  }

  const q = state.current;
  const completion = answer?.completion;

  return (
    <AppShell>
      <div className="topbar">
        <div className="dots-row" role="img" aria-label={`Question ${q ? q.number : state.session.total} of ${state.session.total}`}>
          {state.progress.map((p) => (
            <div
              key={p.position}
              className={`dot ${p.answered ? "filled" : ""} ${
                q && p.position === q.position ? "current" : ""
              }`}
            />
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {runStreak >= 2 && (
            <span className="streak-badge" style={{ color: "var(--accent)" }}>
              <FlameIcon cls="icon-sm" /> {runStreak} in a row
            </span>
          )}
          <span className="xp-chip">{sessionXp} XP</span>
        </div>
      </div>

      <InlineError message={actionError} />

      {q && (
        <>
          <div className="eyebrow">
            {q.topicName} · Question {q.number} of {q.total}
          </div>
          <h1 style={{ fontSize: 20, lineHeight: 1.4, marginBottom: 24 }}>
            {q.question}
          </h1>

          <div
            role="group"
            aria-label="Answer options"
            style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 22 }}
          >
            {q.options.map((opt, i) => {
              const answered = answer !== null;
              const isRight = answered && i === answer.result.correctIndex;
              const isWrongPick =
                answered && i === answer.result.selectedIndex && !answer.result.isCorrect;

              return (
                <button
                  key={`${q.id}-${i}`}
                  className={`quiz-option ${isRight ? "correct" : ""} ${isWrongPick ? "wrong" : ""}`}
                  onClick={() => submit(i)}
                  disabled={answered || submitting}
                  aria-pressed={answered && i === answer.result.selectedIndex}
                >
                  <span className="marker" aria-hidden="true">
                    {isRight && <CheckIcon cls="icon-sm" />}
                    {isWrongPick && <AlertIcon cls="icon-sm" />}
                  </span>
                  <span style={{ fontWeight: isRight ? 700 : 400 }}>{opt}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {answer && (
        <>
          <div
            className="card"
            role="status"
            style={{
              background: answer.result.isCorrect
                ? "var(--success-light)"
                : "var(--warning-light)",
              border: "none",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                color: answer.result.isCorrect ? "var(--primary-dark)" : "#8A6412",
                marginBottom: 3,
                fontSize: 14,
              }}
            >
              {answer.result.isCorrect ? "That's correct" : "Not quite"}
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>
              {answer.result.explanation}
            </div>
          </div>

          {answer.mastery && answer.mastery.after !== answer.mastery.before && (
            <div
              className="card"
              style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}
            >
              <TrendingUpIcon
                cls="icon"
                style={{
                  color:
                    answer.mastery.after > answer.mastery.before
                      ? "var(--success)"
                      : "var(--danger)",
                }}
              />
              <div style={{ fontSize: 13 }}>
                Mastery {answer.mastery.before}% → <strong>{answer.mastery.after}%</strong>
              </div>
              <span className="xp-chip" style={{ marginLeft: "auto" }}>
                +{answer.xp.gained} XP
              </span>
            </div>
          )}

          {completion && (
            <div
              className="card"
              style={{ marginBottom: 16, textAlign: "center", background: "var(--primary-light)", border: "none" }}
            >
              <SparklesIcon
                cls="icon-lg"
                style={{ margin: "0 auto 8px auto", color: "var(--primary-dark)" }}
              />
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                {completion.perfect ? "Perfect quiz!" : "Quiz complete"}
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>
                {completion.correctCount} of {completion.total} correct · +
                {completion.xpBonus} bonus XP
              </div>
            </div>
          )}

          <button className="btn btn-primary btn-block" onClick={next} autoFocus>
            {completion ? "See your progress" : "Next question"}
          </button>
        </>
      )}
    </AppShell>
  );
}
