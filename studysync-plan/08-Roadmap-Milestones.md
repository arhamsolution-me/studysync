# 08 — Development Roadmap (FYP-Friendly Phasing)

## Phase 1 — Foundation (Weeks 1–3)
- Repo setup, Docker environment, CI basics
- Auth module: signup/login, JWT + refresh rotation, Google OAuth
- Database schema migrations (file 03)
- Basic light-theme design system (colors, type scale, spacing tokens)

## Phase 2 — Core Task Engine (Weeks 4–6)
- Manual task CRUD + calendar UI (month/week views)
- Dashboard with upcoming-tasks strip and progress rollup
- Notification settings page (channel toggles, lead-time picker)

## Phase 3 — Voice Pipeline (Weeks 7–9)
- Groq Whisper integration, voice capture modal with live transcript
- Groq fast-classifier routing
- Gemini structured-extraction integration + editable preview-before-save flow

## Phase 4 — Email Auto-Ingestion (Weeks 10–11)
- Gmail OAuth read-only scope, polling worker
- Gemini email-classification integration
- Ingestion log, dedup, unconfirmed-task review UI

## Phase 5 — Notification Delivery (Weeks 12–13)
- BullMQ job scheduling tied to task deadlines and lead times
- SendGrid/SES email delivery with Gemini-generated wording
- WhatsApp Cloud API integration + number verification flow

## Phase 6 — Security Hardening & Polish (Weeks 14–15)
- Rate limiting, Helmet headers, input validation audit
- 2FA (optional, strong demo point)
- Audit logging, account deletion flow
- Semester-view calendar timeline with density markers

## Phase 7 — Load Testing & Scaling Proof (Week 16, defense prep)
- Load-test the API with a tool like k6 or Artillery, simulating concurrent users
- Document the scaling plan (file 02) with actual numbers from your load test — this is strong material for the FYP defense: "here's our current single-instance capacity, here's the documented path to 100k+"
- Prepare a short demo script: voice capture → calendar → email/WhatsApp reminder, end to end

## Suggested Team Split (if not solo)
- **Backend/Auth/Security**: auth module, RBAC, hardening
- **AI Integration**: Gemini/Groq prompt work, pipeline orchestration, BullMQ jobs
- **Frontend**: calendar UI, dashboard, voice capture modal, design system
- **Integrations**: Gmail OAuth ingestion, WhatsApp/email delivery

## What to Emphasize in the FYP Report/Defense
- The dual-AI reasoning (why Groq for speed-critical paths, Gemini for quality-critical paths) — examiners like a justified architectural decision, not just "we used AI."
- The security section (file 02) — auth design and the explicit scaling plan show engineering maturity beyond a typical student CRUD app.
- The anti-"AI-sounding text" checklist (file 05, section H) — a genuinely distinctive, defensible design choice that most similar projects won't have thought about.
