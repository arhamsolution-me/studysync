# 07 — Voice Capture & Notification Pipeline (Step by Step)

## A. Voice Capture Pipeline

1. **Record**: Browser MediaRecorder API captures audio (WebM/Opus), max 30 seconds per utterance.
2. **Upload**: POST to `/api/voice/capture` (multipart), authenticated via access JWT.
3. **Transcribe**: Backend forwards audio to Groq `whisper-large-v3`. Typical latency: under 2 seconds for a 10–15 second clip.
4. **Route**: Transcript sent to Groq's fast classifier (prompt G in file 05) to decide `NEW_TASK` / `MARK_DONE` / `ASK_SCHEDULE` / `SMALL_TALK` / `UNCLEAR`.
5. **Extract** (if `NEW_TASK`): Transcript sent to Gemini with prompt B → structured JSON task.
6. **Preview**: Structured task shown to the student in an editable card — nothing is saved yet.
7. **Confirm**: Student taps "Save" (or edits first) → task inserted into `tasks` table, `source: "voice"`.
8. **Schedule**: Reminder rows created in `reminders` table based on the user's configured lead time(s), enqueued in BullMQ with a `delay` matching `deadline - lead_time`.

## B. Email Auto-Ingestion Pipeline

1. **Poll**: A scheduled worker (cron every 15 minutes) runs per connected user, using their stored Gmail OAuth refresh token.
2. **Filter cheaply first**: Gmail API query filters to recent unread mail from likely academic senders/domains before any LLM call — keeps API cost down.
3. **Classify**: Each candidate email's subject + body (truncated to ~1000 tokens) sent to Gemini with prompt C.
4. **Dedup**: Check `email_ingestion_log` for that `gmail_message_id` — skip if already processed.
5. **Insert**: If `is_academic_task: true`, insert into `tasks` with `source: "email"` and `status` flagged as unconfirmed (a boolean or a lightweight status value) until the student reviews it on the dashboard.
6. **Log**: Record the processed message ID either way, so it's never re-scanned.

## C. Reminder Delivery Pipeline

1. **Trigger**: BullMQ worker picks up a job when its scheduled time arrives.
2. **Re-check**: Confirm the task is still `pending` (not already marked done or deleted) — skip sending if not.
3. **Generate wording**: Call Gemini with prompt D (email) or E (WhatsApp) depending on the reminder's channel — pass task title/type/urgency.
4. **Anti-AI-phrasing check**: Run the generated text through the checklist in file 05 section H before sending; regenerate once if it fails.
5. **Send**:
   - Email → SendGrid/SES API call.
   - WhatsApp → Meta WhatsApp Cloud API, using a pre-approved message template if sending outside a 24-hour user-initiated window (Meta's policy requirement), otherwise free-form.
6. **Record**: Update the `reminders` row with `sent_at` and `status`.
7. **Retry**: On failure, BullMQ's built-in retry with exponential backoff (e.g. 3 attempts); after final failure, flag for the student to see a "reminder failed to send" notice in-app as a fallback.

## D. Failure/Edge-Case Handling
- If Groq transcription returns empty/low-confidence text, prompt the student to retry rather than sending garbage to Gemini.
- If Gemini returns malformed JSON (rare but possible), retry once with a stricter "return ONLY JSON" reminder appended; if it fails twice, surface a manual-entry fallback form instead of blocking the student.
- If a student's Gmail OAuth token is revoked/expired, disable email ingestion for that user and surface a "reconnect Gmail" prompt rather than failing silently.
