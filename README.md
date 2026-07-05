# Nexus — AI Operations Platform

Nexus is an **async, multi-tenant, queue-driven agent orchestration platform**. Users connect integrations (Gmail, Slack, Jira, Calendar) and issue natural-language commands; an agent **plans** the work, **calls tools**, **pauses on risky actions for human approval**, **resumes**, **audits everything**, and **streams progress in real time**.

It is deliberately *not* a CRUD app or a ChatGPT wrapper. The design goal is to demonstrate production patterns: clean service boundaries, secure credential handling, background processing, human-in-the-loop control, and real-time UX.

> **Demo mode is on by default** (`NEXT_PUBLIC_IS_DEMO_MODE=true`) — the agent runs entirely on mocked plans/tool-results with **zero external API calls and zero mutations**, so the public deployment is safe and free to operate.

---

## Architecture

```
                          ┌──────────────────────────── apps/web (Next.js 15) ───────────────────────────┐
  Browser ── SSE ───────▶ │  Route handlers (thin):  auth · POST /tasks (202) · POST /approvals · /stream │
        ▲                 │  Custom auth (JWT cookie, Argon2id)   ·   BullMQ producer only                │
        │                 └───────────────┬───────────────────────────────────┬──────────────────────────┘
        │ progress events                 │ enqueue                            │ subscribe
        │ (Redis pub/sub)        ┌─────────▼─────────┐                ┌─────────▼─────────┐
        └────────────────────────│   Redis / BullMQ  │                │   PostgreSQL      │
                                 │  agent-tasks queue │                │  + pgvector       │
                                 └─────────┬─────────┘                └─────────▲─────────┘
                                           │ consume                            │ persist state + audit
                          ┌────────────────▼─────────────── apps/worker (Node) ─┴──────────────────────────┐
                          │  LangGraph loop: plan → execute ⇄ loop → complete                              │
                          │  Risky step → create Approval, checkpoint to DB, AWAITING_APPROVAL, pause      │
                          │  Approval decision → resume-task → continue from checkpoint                    │
                          └───────────────────────────────────────────────────────────────────────────────┘
```

### Monorepo layout

| Path | Responsibility |
|---|---|
| `apps/web` | Next.js App Router — UI + **thin** API gateway. Validates, authenticates, enqueues. Never runs AI. |
| `apps/worker` | Node service. **All** AI execution: LangGraph loop, tool calls, approval pause/resume, audit, progress publishing. |
| `packages/shared` | Zod env config, AES-256-GCM crypto, domain types / DTOs, queue constants + Redis connection. |
| `packages/db` | Prisma schema (multi-tenant), client singleton, pgvector migration. |
| `packages/ai` | LangGraph orchestration, tool registry, Gemini runtime, demo runtime, `createAgentRuntime` factory. |
| `packages/ui` | Minimal shared React components. |

---

## Key engineering decisions

- **Queue-first.** API routes validate → create a job row → enqueue → return **202**. No long-running work on the request path. All AI execution lives in the worker.
- **Human-in-the-loop via DB checkpoint.** When the agent hits a *risky* tool, the worker serializes the full graph state into `AgentJob.checkpoint`, records an `Approval`, sets `AWAITING_APPROVAL`, and ends the job cleanly. The approval API enqueues a `resume-task`; the worker rehydrates the checkpoint and continues. Using the DB as the durable store (rather than an in-process checkpointer) is what makes pause/resume survive across separate worker invocations.
- **One demo switch.** `createAgentRuntime(isDemo)` returns either the Gemini runtime or the demo runtime behind a single `AgentRuntime` interface — the worker and graph never branch on demo mode again.
- **Secrets never in plaintext.** OAuth tokens are stored only as AES-256-GCM ciphertext (`packages/shared/crypto.ts`); the audit logger scrubs secret-looking fields.
- **Multi-tenancy everywhere.** Every tenant-scoped row carries `orgId`; every query is org-filtered. Cross-tenant access is treated as a security bug.
- **Fail-fast config.** All env vars are Zod-validated in one module; `process.env` is never read elsewhere.
- **Real-time over polling.** Worker publishes `ProgressEvent`s to a per-job Redis channel; the web app relays them to the browser over SSE.

---

## Getting started

### Prerequisites
- Node ≥ 20, **pnpm** (`npm i -g pnpm`)
- Docker (for local Postgres + Redis)

### Setup

```bash
pnpm install

# Local infra (Postgres w/ pgvector + Redis)
docker compose up -d

# Environment
cp .env.example .env
# generate keys:
#   openssl rand -base64 32   → ENCRYPTION_KEY
#   openssl rand -base64 48   → AUTH_SECRET

# Database
pnpm --filter @nexus/db db:generate
pnpm --filter @nexus/db db:migrate
pnpm --filter @nexus/db db:pgvector   # adds the vector column + index

# Run (two terminals)
pnpm --filter @nexus/web dev          # http://localhost:3000
pnpm --filter @nexus/worker dev
```

In **demo mode** (default) you can open `http://localhost:3000/dashboard` directly — no login, no Gemini key. Submit a task like *"Summarize urgent customer issues and create Jira tickets"* and watch the timeline stream, pause on the risky Jira step for approval, then resume.

To run against real Gemini: set `NEXT_PUBLIC_IS_DEMO_MODE=false` and `GEMINI_API_KEY=…` (free key from https://aistudio.google.com/apikey). (Real Gmail/Slack/Jira/Calendar execution requires the OAuth integrations, which are a planned follow-up — see below.)

---

## Deployment targets
- **Web** → Vercel
- **Worker** → Render / Fly.io (long-lived Node process)
- **Redis** → Upstash · **Postgres** → Neon (enable the `vector` extension)

---

## Roadmap (out of current scope)
Polished dashboard/design system · real OAuth connect flows for all four providers · full RAG over pgvector · rate limiting · billing · automated test suite · CI/CD.
