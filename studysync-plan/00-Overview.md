# StudySync AI — Voice-Driven Academic Reminder & Task System
### Final Year Project Plan — UMT Lahore

---

## 1. Problem Statement

University students juggle assignments, quizzes, projects, and semester deadlines that arrive through scattered channels — LMS emails, WhatsApp groups, verbal announcements in class. Nothing centralizes this into a single, always-updated calendar that reminds the student proactively, in a human way, without them typing anything.

## 2. One-Line Pitch

StudySync AI lets a student **speak** a task ("Aaj mujhe database assignment submit karna hai, deadline Friday raat"), and the system automatically classifies it (quiz / assignment / project / exam), places it on a live calendar, and reminds the student by **email and WhatsApp** at the right time — while also **auto-detecting tasks from university emails** without the student typing anything.

## 3. Core Feature Set

| # | Feature | Description |
|---|---|---|
| 1 | Voice Task Capture | Student speaks naturally; Groq-hosted Whisper transcribes; Gemini extracts task type, subject, deadline, priority |
| 2 | Email Auto-Ingestion | System reads connected university/Gmail inbox, detects assignment/quiz announcements, auto-creates calendar entries |
| 3 | Smart Calendar | Month/week/day/semester views; color-coded by task type and urgency; shows "done" vs "pending" |
| 4 | Multi-Channel Reminders | Email (formal, styled) + WhatsApp (short, conversational) — timed by user-configured lead time (e.g. 1 day before, 3 hours before) |
| 5 | Auto-Categorization | Every captured task is auto-tagged: Quiz, Assignment, Project, Exam, Personal, Other |
| 6 | Semester / Month Overview | Rollup dashboard: "This is what's left this month / this semester" |
| 7 | Human-Sounding Notifications | Generated reminder text reads like a person wrote it — no robotic AI phrasing, no repeated templates |
| 8 | Secure Multi-User Platform | Full auth, encrypted data, built to scale to 100,000+ concurrent student accounts |

## 4. Why Gemini + Groq (both)

- **Groq** — used wherever *speed* matters: real-time voice transcription (Whisper-large-v3 on Groq) and fast intent classification (Llama 3.3 70B on Groq) so the app feels instant when the student is speaking.
- **Gemini** — used wherever *reasoning quality and tone* matter: turning a rough spoken sentence into a clean structured task, writing the human-sounding reminder message, and summarizing "what's due this month" in natural language.

This split keeps the app fast where speed is felt (voice) and high-quality where wording is felt (notifications, summaries).

## 5. Non-Negotiable Constraints (from project brief)

- No dark theme — clean, light, academic-friendly UI.
- No robotic/AI-sounding text anywhere a human reads it (reminders, summaries) — must read naturally, like a person wrote it.
- Justified body text with correct line-height/spacing — treated as a real typography requirement, not an afterthought.
- Full security on auth and every API route.
- Architecture must be able to scale to 100,000+ users without a rewrite.

## 6. Document Index

1. `00-Overview.md` — this file
2. `01-Architecture-TechStack.md` — full stack, service breakdown, data flow
3. `02-Security-Auth-Scaling.md` — auth, hardening, 100k-user scaling plan
4. `03-Database-Schema.md` — tables/collections, relationships
5. `04-Page-by-Page-Logic.md` — every screen and exactly what it does
6. `05-AI-Prompts-Gemini-Groq.md` — ready-to-use system prompts for both APIs
7. `06-UI-UX-Design-Guide.md` — light theme, typography, spacing rules
8. `07-Notification-Voice-Pipeline.md` — voice capture → reminder delivery, step by step
9. `08-Roadmap-Milestones.md` — FYP-friendly phased build plan
