# Pathwise

An AI study companion for university students — upload your course materials, get a personalized study plan, spaced-repetition quizzes, and a Socratic tutor that guides instead of answers.

## Repo structure

```
docs/       → Product blueprint, build plan, and team ops checklist. Read these first.
mockup/     → Static HTML/CSS visual reference for every screen (open mockup/index.html in a browser)
frontend/   → React + TypeScript app (in progress)
backend/    → Python + FastAPI backend (in progress)
```

## Start here

1. Read `docs/pathwise-master-blueprint.md` — the full product spec: vision, features, monetization, gamification, architecture.
2. Read `docs/pathwise-build-plan.md` — the step-by-step build order, priority-ranked (P0 → P3), with a suggested team split.
3. Read `docs/pathwise-ops-checklist.md` — non-code fundamentals (legal, privacy, AI cost economics, team process).
4. Open `mockup/index.html` in a browser to see every screen — this is the visual source of truth for the frontend build.

## Stack

- Frontend: React + TypeScript, Vite, Tailwind CSS
- Backend: Node + Fastify + Prisma (TypeScript)
- Database: SQLite (MVP)
- AI: swappable provider — mock (free, default) or OpenAI

## Run it locally

Two terminals:

```bash
# Terminal 1 — backend
cd backend && npm install && npm run prisma:migrate && npm run dev

# Terminal 2 — frontend
cd frontend && npm install && npm run dev
```

Then open http://localhost:5173. The frontend proxies `/api` to the backend
on port 4000.

## Status

**Step 1 (Foundation) — done.** Auth, database, session handling, privacy
screen, empty Courses home.

**Step 2 (Course Intelligence Engine) — done.** Upload PDF/DOCX/PPTX → text
extraction → AI topic extraction + emphasis weighting → per-course Knowledge
Map. Adding more materials expands the map. AI runs against a free mock
provider until you add an OpenAI key.

**Step 3 (Courses Home) — done.** Course cards wired to real data (mastery %,
topic count, streak), and the free-tier course cap enforced with an upsell
screen (billing itself is deferred to Step 13).

Next: **Step 4 — Mastery & Spaced Repetition Engine** (underpins Study Plan,
Quiz, and Confidence Score). See `docs/pathwise-build-plan.md`.
