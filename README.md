# StudySync AI — Intelligent Academic Task & Deadline Management

> AI-powered study companion that captures tasks via voice, syncs academic deadlines, and sends intelligent reminders including daily pending task digests so you never miss an assignment, quiz, or project.

---

## 🌟 Key Features

1. **🎙️ Voice-First Task Capture**:
   - Record tasks in natural speech (English & Roman Urdu code-switching supported).
   - Fast Groq Whisper-large-v3 speech-to-text transcription.
   - Dual-AI pipeline: Groq Llama 3.3 for intent classification + Google Gemini for structured metadata extraction.
   - Preview and review modal before confirming tasks.

2. **📅 Academic Calendar & Dashboard**:
   - Monthly interactive calendar with color-coded task dots and date filter panels.
   - Dashboard with task statistics, completion progress bar, urgency highlights, and quick-add actions.
   - Full CRUD operations with instant optimistic updates.

3. **📬 Smart Email & WhatsApp Notifications**:
   - **Deadline Reminders**: Scheduled BullMQ background worker triggers notifications at customizable lead times (e.g. 1 hour, 1 day before).
   - **Remaining/Pending Tasks Digest**: BullMQ daily repeating worker compiles all remaining pending tasks into an organized digest email ("*Yeh tasks abhi baqi hain*") with urgent tasks highlighted.
   - **Gemini Tone Engine**: Creates human-sounding, friendly academic messages (with anti-AI-phrasing filters).
   - **On-Demand Digest Trigger & Preview**: Instant testing and email preview directly from the Settings screen.

4. **🔒 Enterprise-Grade Security**:
   - Argon2id password hashing.
   - JWT access + refresh token rotation with token theft detection.
   - Redis-backed distributed rate limiting.
   - Helmet security headers, CORS protection, and Zod input validation.

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or v20+)
- [Docker & Docker Compose](https://www.docker.com/) (for PostgreSQL and Redis)

---

### Step 1: Start Database & Redis
In the root directory (`d:\MYtaskAgent`):
```bash
docker-compose up -d
```
This starts:
- **PostgreSQL 16** on `localhost:5432` (`studysync` db)
- **Redis 7** on `localhost:6379`

---

### Step 2: Configure & Start Backend
Navigate to the `backend/` folder:
```bash
cd backend
```

Ensure `.env` exists (copied from `.env.example`):
```env
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/studysync?schema=public"
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_ACCESS_SECRET=your-access-secret
JWT_REFRESH_SECRET=your-refresh-secret

# AI API Keys
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key

# Email Notifications (Optional: Leave empty for console dispatch simulation)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM="StudySync AI <reminders@studysync.ai>"
```

Push Prisma schema to the database:
```bash
npx prisma db push
```

Start the backend development server:
```bash
npm run dev
```
The API server will run at `http://localhost:5000`.

---

### Step 3: Start Frontend
In another terminal, navigate to `frontend/`:
```bash
cd frontend
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 📂 Project Structure

```
MYtaskAgent/
├── docker-compose.yml       # PostgreSQL 16 + Redis 7 services
├── backend/
│   ├── prisma/
│   │   └── schema.prisma    # User, Task, Reminder, AuditLog models
│   ├── src/
│   │   ├── config/          # Environment configuration
│   │   ├── middleware/      # AuthGuard, RateLimiter, Validation, ErrorHandler
│   │   ├── modules/
│   │   │   ├── ai/          # Groq STT/Llama + Gemini extraction & tone generator
│   │   │   ├── auth/        # Register, Login, Token rotation
│   │   │   ├── tasks/       # CRUD, Dashboard, Calendar engine
│   │   │   ├── voice/       # Audio upload & transcription endpoint
│   │   │   └── notifications/ # BullMQ queues, Nodemailer service, routes
│   │   └── server.ts        # Express app and worker initialization
│   └── tsconfig.json
└── frontend/
    ├── src/
    │   ├── components/      # Layout, TaskModal, VoiceModal
    │   ├── pages/           # Landing, Login, Register, Dashboard, Calendar, Settings
    │   ├── services/        # Axios API client (Auth, Tasks, Voice, Notifications)
    │   ├── index.css        # Academic light-theme design system
    │   ├── App.tsx          # Route setup & auth state provider
    │   └── main.tsx
    └── vite.config.ts
```

---

## 🧪 Build Verification

Both frontend and backend are fully typed and verified:
- Backend build: `npm run build` (in `backend/`) ➔ Clean `tsc` compilation to `dist/`
- Frontend build: `npm run build` (in `frontend/`) ➔ Vite production bundle generated in `dist/`
