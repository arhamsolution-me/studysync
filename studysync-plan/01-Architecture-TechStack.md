# 01 — System Architecture & Tech Stack

## 1. High-Level Architecture (microservice-leaning, monolith-first)

Build as a **modular monolith** first (fast for an FYP timeline), but structured so each module can be split into its own microservice later without touching the others. This is the realistic path to "handles 100,000+ users" without over-engineering a student project on day one.

```
                        ┌─────────────────────┐
                        │      Web Client      │  (React + Tailwind, light theme)
                        └──────────┬───────────┘
                                   │ HTTPS (JWT in httpOnly cookie)
                        ┌──────────▼───────────┐
                        │     API Gateway       │  (rate limiting, auth check, routing)
                        └──────────┬───────────┘
        ┌──────────────┬──────────┼──────────────┬───────────────┐
        ▼              ▼          ▼              ▼               ▼
   Auth Module   Task Module  Calendar Module  Notification   AI Module
   (JWT, OAuth)  (CRUD, tags) (views, rollups) Module (email/  (Gemini+Groq
                                                WhatsApp queue) orchestration)
        │              │          │              │               │
        └──────────────┴──────────┴──────┬───────┴───────────────┘
                                          ▼
                              ┌───────────────────────┐
                              │   PostgreSQL (primary) │
                              │   Redis (cache/queue)  │
                              └───────────────────────┘
```

## 2. Recommended Stack

**Frontend**
- React (Vite) + TypeScript
- Tailwind CSS (light theme design tokens — see `06-UI-UX-Design-Guide.md`)
- React Query for server-state caching
- FullCalendar.io or a custom calendar component for month/week/semester views

**Backend**
- Node.js + Express (or NestJS if you want structured modules out of the box — recommended for FYP grading, since NestJS enforces clean architecture)
- PostgreSQL as the primary database (relational — tasks, users, reminders all have clear relationships)
- Redis — session cache, rate-limit counters, and the notification job queue
- BullMQ (Redis-backed) — background job queue for scheduled reminders (email/WhatsApp)

**AI Layer**
- **Groq API** — `whisper-large-v3` for speech-to-text, `llama-3.3-70b-versatile` for fast intent classification
- **Gemini API** — `gemini-2.0-flash` (or latest available) for structured task extraction, human-sounding message generation, and monthly/semester summaries

**Integrations**
- Gmail API (OAuth2) — read-only scope to scan for assignment/quiz emails
- WhatsApp Cloud API (Meta) — official, not a scraping wrapper — for reminder delivery
- SMTP (SendGrid or Amazon SES) — for outbound formal email reminders

**Infrastructure**
- Docker for every service (consistent dev/prod environment)
- Nginx as reverse proxy + TLS termination
- Deploy target: any VPS to start (Hetzner/DigitalOcean), designed to move to Kubernetes later if usage grows

## 3. Data Flow — Voice Task Example

1. Student taps mic on web app → browser records audio → uploads to `/api/voice/capture`
2. Backend streams audio to **Groq Whisper** → returns raw transcript in ~1–2 seconds
3. Transcript sent to **Gemini** with a structured-extraction prompt → returns JSON: `{title, type, subject, deadline, priority}`
4. Backend validates JSON, inserts into `tasks` table, schedules reminder jobs in BullMQ based on user's lead-time preference
5. Calendar view updates instantly (WebSocket or polling) — task appears with correct color tag

## 4. Data Flow — Email Auto-Ingestion

1. Scheduled worker (every 15 min) uses Gmail API to fetch new unread emails matching keywords/sender patterns (LMS domains, "assignment", "quiz", "due")
2. Email body sent to **Gemini** with an extraction prompt → returns structured task or `null` if not academic
3. If a task is detected, it's inserted with `source: "email"` and flagged for the student to confirm/edit (never auto-commits without a lightweight confirm step, to avoid false positives)

## 5. Data Flow — Reminder Delivery

1. BullMQ job fires at the scheduled lead time
2. Job calls **Gemini** to generate the actual wording of the reminder (different tone for email vs WhatsApp — see `05-AI-Prompts-Gemini-Groq.md`)
3. Email sent via SendGrid/SES; WhatsApp sent via Meta Cloud API
4. Delivery status logged; failed sends retried with exponential backoff (BullMQ built-in)

## 6. Why This Scales

- Stateless API layer → horizontally scalable behind a load balancer (add more app instances, no code change)
- Redis handles both caching and the job queue, keeping the database free of scheduling load
- PostgreSQL read replicas can be added once read traffic (calendar views, dashboards) grows past what one instance handles
- All AI calls are async/queued, never blocking the request-response cycle for anything except the sub-2-second voice capture flow
