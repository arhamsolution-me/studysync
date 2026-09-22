# 04 — Page-by-Page Logic

## 1. Landing Page (public)
- Explains the product in one screen: voice → task → reminder → done.
- Light theme, generous white space, justified body copy.
- CTA: "Sign in with Google" (primary — unlocks email auto-ingestion) and "Sign up with email" (secondary).

## 2. Auth Pages (Login / Signup / Forgot Password)
- Standard email+password with Argon2id hashing, plus Google OAuth button.
- Forgot-password flow: time-limited signed reset token emailed, single-use.
- On first Google sign-in, explicitly request Gmail read-only consent as a **separate, clearly-explained step** ("We'll scan for assignment/quiz emails — nothing else"), not bundled silently into login.

## 3. Dashboard (home after login)
- Top: "This week" strip — next 5 upcoming tasks, soonest first, color-coded by type.
- Middle: Month/Semester progress rollup — "12 of 20 tasks done this month" with a simple progress bar.
- Bottom: Quick-capture bar — mic icon (voice) + text input (manual) always visible.
- Logic: dashboard queries are the read-heavy path — served from the Postgres read replica once Stage 2 scaling kicks in, cached in Redis for ~60 seconds per user to absorb repeated loads.

## 4. Calendar Page
- Month / Week / Semester view toggle.
- Each day cell shows colored dots per task type; clicking a day opens a side panel listing that day's tasks with status toggles (mark done).
- Semester view: a horizontal timeline banner across the whole semester date range, with density markers showing "heavy week" clusters — helps the student see crunch periods coming.

## 5. Task Detail / Edit Page
- Full task fields editable; shows `source` badge (Voice / Email / Manual) and, for email-sourced tasks, a link back to the original email for verification.
- "Confirm" button for email-auto-detected tasks that are still in an unconfirmed state.

## 6. Voice Capture Modal
- Big mic button, waveform animation while recording, live partial transcript as Groq Whisper streams back.
- After transcription, shows the Gemini-extracted structured task (title/type/subject/deadline) in an editable preview **before** saving — student always gets a last look, never a silent auto-commit.

## 7. Notification Settings Page
- Toggle email / WhatsApp per channel.
- Lead-time picker (e.g. "remind me: 1 day before", "3 hours before", custom).
- WhatsApp number verification (OTP via WhatsApp Cloud API) before enabling that channel.

## 8. Email Connection Settings
- Shows Gmail connection status; "Disconnect" revokes the OAuth token and stops ingestion immediately.
- Shows a log of recently auto-detected tasks from email, with a one-tap "not a task, ignore" to help the classifier's prompt tuning over time (logged, used to refine the extraction prompt manually — not a live-learning model, to keep this FYP-scoped).

## 9. Account / Security Settings
- Change password, enable/disable 2FA, view active sessions (with "log out of all devices" button — revokes all refresh tokens).
- "Delete my account" — hard delete flow with a confirmation step, purges tasks/reminders/tokens.

## 10. Admin Panel (minimal, for your own demo/support use)
- Aggregate stats only: total users, tasks created this week, notification delivery s .
- No access to individual student task content — enforced at the query layer, not just hidden in the UI.
