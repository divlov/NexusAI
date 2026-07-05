---
trigger: always_on
---

# OpusAgent Engineering Rules

This document defines the architecture, coding standards, and system boundaries for the OpusAgent codebase.

The goal is to maintain a production-grade AI SaaS architecture that demonstrates senior-level full-stack engineering practices.

---

# Core Philosophy

This project is NOT:
- a toy CRUD app
- a simple ChatGPT wrapper
- a monolithic backend
- a synchronous AI request system

This project IS:
- an async AI operations platform
- a multi-tenant SaaS system
- a queue-driven architecture
- a secure integration platform
- a real-time agent orchestration system

Optimize for:
- scalability
- maintainability
- clear boundaries
- observability
- security
- developer experience

---

# Monorepo Structure

/apps
  /web       -> Next.js frontend + API gateway
  /worker    -> BullMQ background workers

/packages
  /db        -> Prisma schema + DB utilities
  /shared    -> shared types/constants
  /ai        -> LangGraph + agent orchestration
  /ui        -> reusable UI components

Never place business logic directly inside pages/components.

---

# Tech Stack

Frontend:
- Next.js App Router
- TypeScript
- Tailwind
- shadcn/ui
- TanStack Query

Backend:
- Next.js Route Handlers
- Node.js workers
- BullMQ
- Redis

Database:
- PostgreSQL
- Prisma ORM
- pgvector

AI:
- Google Gemini
- LangGraph
- function/tool calling

Auth:
- JWT (deliberate choice; not Clerk)

---

# Architectural Rules

## 1. API Routes Must Stay Thin

API routes are traffic controllers only.

Allowed responsibilities:
- authentication
- authorization
- validation
- enqueue jobs
- return responses

Forbidden:
- long-running AI execution
- direct Gemini loops
- business orchestration
- blocking operations

All heavy tasks MUST run in workers.

---

## 2. All AI Execution Happens In Workers

LLM orchestration must ONLY run inside `/apps/worker`.

Workers are responsible for:
- LangGraph loops
- tool execution
- retries
- approval pausing
- audit logging
- progress streaming

Never execute AI workflows inside React components or route handlers.

---

## 3. Queue-First Architecture

All agent tasks must go through BullMQ.

Flow:
1. User submits task
2. API validates request
3. Job added to BullMQ
4. Worker consumes job
5. Worker updates state
6. Frontend streams updates

Never bypass queues for convenience.

---

## 4. Multi-Tenancy Is Mandatory

Every database entity must contain:
- tenantId
- createdAt
- updatedAt

Tenant isolation is critical.

Never query tenant-scoped data without filtering by tenantId.

Always assume cross-tenant leakage is a critical security vulnerability.

---

## 5. OAuth Tokens Must Be Encrypted

Third-party credentials must NEVER be stored in plain text.

Use:
- AES-256-GCM
- Node crypto module
- ENCRYPTION_KEY environment variable

Encryption/decryption must be centralized in shared utilities.

Never duplicate encryption logic.

---

# Database Rules

Use Prisma as the primary ORM.

Preferred approach:
- Prisma for standard queries
- raw SQL only when justified
- pgvector via SQL migrations

All schema changes must:
- include migrations
- maintain type safety
- avoid breaking production data

Never use Prisma `any` types.

---

# TypeScript Rules

TypeScript strict mode must remain enabled.

Forbidden:
- any
- ts-ignore
- massive untyped objects

Required:
- explicit interfaces
- zod validation
- typed service boundaries
- shared DTOs

Prefer:
- discriminated unions
- enums for statuses
- typed utility functions

---

# Validation Rules

All external input must be validated using Zod.

This includes:
- API requests
- query params
- environment variables
- webhook payloads
- AI structured outputs

Never trust:
- frontend payloads
- tool responses
- LLM outputs

---

# AI System Rules

## LangGraph

Use LangGraph for:
- planning
- execution loops
- approval pauses
- retries
- branching workflows

Avoid giant prompts.

Prefer:
- small focused prompts
- explicit tool schemas
- deterministic structured outputs

---

## Prompting Rules

All prompts must:
- define role clearly
- define expected output shape
- minimize ambiguity
- request structured JSON

Never parse freeform AI text if structured output is possible.

---

## Model Usage

Preferred models (Google Gemini):
- gemini-2.0-flash for development
- gemini-2.5-pro for advanced workflows

Use cheaper models whenever quality permits.

Optimize for:
- low token usage
- predictable outputs
- deterministic formatting

---

# Demo Mode Rules

Public deployments MUST run safely in demo mode.

Environment flag:
`NEXT_PUBLIC_IS_DEMO_MODE=true`

When enabled:
- no real Gemini calls
- no real OAuth actions
- no external mutations
- no email sending
- no Jira creation
- no Slack posting

Instead:
- return realistic mocked responses
- simulate agent planning
- simulate approval flows
- simulate audit logs

The public portfolio deployment should NEVER risk token abuse.

---

# Human-In-The-Loop Rules

Risky actions require approval.

Examples:
- sending emails
- deleting records
- creating external tickets
- mutating third-party systems

Required flow:
1. pause worker
2. persist state
3. mark status AWAITING_APPROVAL
4. notify frontend
5. resume after approval

Never allow destructive autonomous execution without approval support.

---

# Real-Time Rules

Frontend must receive live updates.

Preferred:
- Server Sent Events (SSE)

Acceptable:
- WebSockets

Use real-time updates for:
- job progress
- planning state
- approval requests
- audit events
- execution logs

Avoid polling whenever possible.

---

# UI Rules

The UI should feel:
- minimal
- modern
- operational
- enterprise-grade

Avoid:
- excessive animations
- gimmicky AI visuals
- cluttered dashboards

Prefer:
- clean spacing
- activity timelines
- execution logs
- approval cards
- operational dashboards

---

# Logging & Observability

Every agent run must produce:
- timestamps
- tool calls
- execution states
- approval decisions
- errors
- latency metrics

All failures must:
- be logged
- preserve context
- avoid leaking secrets

---

# Error Handling Rules

Never swallow errors.

Always:
- log context
- return typed failures
- preserve worker stability

Workers must:
- retry safely
- avoid duplicate execution
- handle partial failures

---

# Environment Variable Rules

All environment variables must:
- be validated with Zod
- fail fast on boot
- have clear naming

Examples:
- DATABASE_URL
- REDIS_URL
- GEMINI_API_KEY
- ENCRYPTION_KEY

Never access process.env directly outside config modules.

---

# Code Organization Rules

Prefer:
- service layer architecture
- modular utilities
- isolated domain logic

Avoid:
- god files
- deeply nested conditionals
- duplicated logic

Target:
- files under ~300 lines where reasonable

---

# Naming Conventions

Use:
- PascalCase for components/classes
- camelCase for functions/variables
- SCREAMING_SNAKE_CASE for constants

Queue names:
- kebab-case

Statuses:
- uppercase enums

Examples:
- PENDING
- PLANNING
- AWAITING_APPROVAL
- COMPLETED
- FAILED

---

# Git Rules

Commits should be:
- small
- scoped
- descriptive

Preferred format:
feat(worker): add approval pause handling

Avoid:
- “fix stuff”
- “update”
- giant mixed commits

---

# README Expectations

README must include:
- architecture diagram
- setup instructions
- screenshots
- demo explanation
- tech stack
- engineering decisions
- tradeoffs
- scaling discussion

Add:
- Loom walkthrough
- GIF demos
- system flow diagrams

---

# Senior-Level Engineering Expectations

Prioritize:
- architectural clarity
- explicit tradeoffs
- maintainability
- operational safety

The codebase should demonstrate:
- async systems understanding
- AI orchestration understanding
- SaaS architecture knowledge
- production security awareness
- modern TypeScript practices

Every major implementation should answer:
"Would this design survive in production?"