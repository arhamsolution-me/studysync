# 02 — Security, Authentication & Scaling to 100,000+ Users

## 1. Authentication

- **Password storage**: Argon2id (preferred over bcrypt for new projects) with per-user salt, memory cost tuned to your server's RAM.
- **Login flow**: email + password → server issues a short-lived **access JWT (15 min)** + a long-lived **refresh token (7–30 days)** stored as an httpOnly, Secure, SameSite=Strict cookie. Never store tokens in localStorage (XSS-exposed).
- **OAuth2 (Google Sign-In)**: required anyway for Gmail auto-ingestion, so reuse it as the login method for students who want email scanning — one consent screen, two purposes.
- **Refresh rotation**: every refresh-token use issues a new refresh token and invalidates the old one (detects token theft — if an old, already-used refresh token is replayed, kill all sessions for that user).
- **2FA (optional but recommended for FYP demo points)**: TOTP-based (Google Authenticator style), stored as an encrypted secret.

## 2. API Security

- **Rate limiting**: per-IP and per-user, via Redis (e.g. 100 requests/min general, 5 requests/min on `/auth/login` to blunt brute force).
- **Input validation**: schema-validate every request body (Zod on Node, or class-validator on NestJS) — reject anything malformed before it touches business logic.
- **CORS**: locked to your actual frontend origin(s) only, never `*`.
- **CSRF**: SameSite cookies + CSRF token on state-changing requests if you use cookie-based auth.
- **SQL injection**: use an ORM/query builder (Prisma, TypeORM, Knex) with parameterized queries — never raw string concatenation.
- **Secrets management**: all API keys (Gemini, Groq, WhatsApp, SendGrid) in environment variables / a secrets manager (e.g. Doppler, AWS Secrets Manager) — never committed to git, never sent to the frontend.
- **HTTPS everywhere**: TLS termination at Nginx/load balancer; HSTS header enabled.
- **Security headers**: Helmet.js (or equivalent) for `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`.
- **Least privilege on integrations**: Gmail OAuth scope is read-only (`gmail.readonly`), never full-access.
- **Audit logging**: log every auth event and every data-modifying action (who, what, when) to a separate append-only log table — useful both for security review and for demonstrating good practice in your FYP defense.

## 3. Role-Based Access Control (RBAC)

| Role | Permissions |
|---|---|
| Student | Full CRUD on own tasks/reminders; read-only on own account settings |
| Admin (you, for demo/support) | View aggregate usage stats, manage flagged accounts — never read individual task content without explicit support-ticket context |

Keep the permission model simple for the FYP — a `role` column on the user table plus middleware that checks it — but design the middleware so new roles (e.g. "University Admin" for a future B2B version) slot in without rewriting the check logic.

## 4. Data Protection

- Encrypt sensitive fields at rest where it matters (OAuth refresh tokens, TOTP secrets) using field-level encryption (e.g. `pgcrypto` in Postgres or application-level AES-256-GCM).
- Backups: automated daily Postgres backups, encrypted, retained on a rolling window.
- GDPR-style hygiene even for a local FYP: a "delete my account" flow that actually purges data, not just flags it inactive.

## 5. Scaling Plan — 100,000+ Users

This doesn't need to be built on day one — it needs to be **designed for**, so nothing you build in month 1 blocks it later.

**Stage 1 (0–1,000 users, FYP demo stage)**
- Single app server + single Postgres instance + Redis. This is already enough for your defense demo.

**Stage 2 (1,000–20,000 users)**
- Move to 2–3 stateless app instances behind a load balancer (round-robin or least-connections).
- Add a Postgres read replica for calendar/dashboard reads; writes stay on primary.
- Move the notification queue workers to their own process/instance, separate from the web-request-handling instances, so a burst of reminder jobs never slows down page loads.

**Stage 3 (20,000–100,000+ users)**
- Split the modular monolith at its natural seams (Auth service, Task/Calendar service, Notification service, AI-orchestration service) — each independently scalable.
- Introduce a CDN (Cloudflare) for static frontend assets.
- Move from a single Redis to a Redis cluster if the job queue volume demands it.
- Consider a message broker (Kafka/RabbitMQ) if the notification volume outgrows BullMQ's Redis-based model.
- Database: partition/shard the `tasks` and `reminders` tables by user_id range or by time (e.g. archive completed tasks older than 2 semesters to a cold table) to keep hot-path queries fast.
- Add horizontal auto-scaling (Kubernetes HPA or equivalent) driven by CPU/queue-depth metrics.

**The key design decision that makes this possible**: keep every app server **stateless** from day one (no in-memory session storage, no local file writes) — that single choice is what lets you go from 1 server to 50 without rewriting anything.
