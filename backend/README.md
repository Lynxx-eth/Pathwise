# Backend — Pathwise API (Node + Fastify + Prisma + SQLite)

TypeScript backend. All AI features go through a swappable provider (mock by
default, OpenAI when configured), so the whole app runs for free in development.

> Note: the original docs suggested Python + FastAPI. We build in TypeScript so
> the whole stack shares one language and runs with no extra toolchain.

## Setup

```bash
npm install
cp .env.example .env      # then edit if you like (defaults work out of the box)
npm run prisma:migrate    # creates the SQLite database
npm run dev               # starts the API on http://localhost:4000
```

The dev server auto-loads `.env` and restarts on file changes.

> **Dev runner note:** we run the backend by compiling with `tsc` and running
> the output with Node's built-in `--watch` (see the `dev` script) rather than
> `tsx`. On this machine esbuild (which `tsx` uses) couldn't spawn its worker,
> so we avoid it entirely. `npm run dev` runs the type-checker and the server
> together and restarts on save.

## Environment (`.env`)

| Var | Meaning |
|---|---|
| `DATABASE_URL` | SQLite file location (default `file:./dev.db`) |
| `JWT_SECRET` | Secret for signing login tokens — change in production |
| `CORS_ORIGIN` | Frontend origin (default `http://localhost:5173`) |
| `PORT` | API port (default `4000`) |
| `AI_PROVIDER` | `mock` (free, default) or `openai` |
| `OPENAI_API_KEY` | Only needed when `AI_PROVIDER=openai` |
| `OPENAI_MODEL` | Default `gpt-4o-mini` |
| `FREE_COURSE_CAP` | Free-tier course limit (default `3`) |

To use real AI later: set `AI_PROVIDER=openai` and paste your key into
`OPENAI_API_KEY`, then restart. Everything else stays the same.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET  | `/api/health` | — | Health + active AI provider |
| POST | `/api/auth/signup` | — | Create account, returns token |
| POST | `/api/auth/signin` | — | Log in, returns token |
| GET  | `/api/auth/me` | ✔ | Current user |
| POST | `/api/auth/accept-privacy` | ✔ | Record one-time privacy acceptance |
| GET  | `/api/courses` | ✔ | List the user's courses |
| POST | `/api/courses` | ✔ | Create a course (enforces free-tier cap) |
| GET  | `/api/courses/:id` | ✔ | Course detail: knowledge map + materials |
| POST | `/api/courses/:id/uploads` | ✔ | Upload a material (PDF/DOCX/PPTX), parse + map it |

Auth is a Bearer JWT: `Authorization: Bearer <token>`.

## Course Intelligence pipeline (Step 2)

`POST /api/courses/:id/uploads` runs synchronously:
`save file → extract text (src/lib/parse.ts) → extract & weight topics
(AI provider) → merge into the course Knowledge Map (src/lib/knowledge.ts)`.
Re-uploading more materials **expands** the same map — repeated topics gain
emphasis weight rather than duplicating.

## Layout

```
prisma/schema.prisma   → database models
src/lib/               → env, prisma client, auth helpers, file storage
src/ai/                → AI provider interface + mock + openai adapters
src/plugins/           → JWT auth guard
src/routes/            → auth + courses routes
src/server.ts          → Fastify app entry
```

## Handy commands

- `npm run prisma:studio` — visual database browser
- `npm run prisma:migrate` — create/apply a migration after editing the schema
- `npm run build && npm start` — production build + run
