# 10 — Smart AI Features: Summarizer, Priority Re-Ranking, Conflict Detector

Three Gemini-powered features layered on top of the base plan. All three reuse existing
infrastructure (course materials, tasks table, BullMQ scheduler) — no new services needed.

---

## A. Notes Summarizer

### Concept
Student uploads a long PDF/slide deck as course material (already supported by the
ingestion pipeline in file 09). In addition to chunking it for the RAG chatbot, run one
extra pass that produces a **one-page summary + key points list**, shown immediately
after upload so the student gets value without having to ask the chatbot anything.

### Schema Addition
Add to `course_materials`:
| Column | Type | Notes |
|---|---|---|
| summary_text | text, nullable | one-page summary, generated after ingestion |
| key_points | jsonb, nullable | array of short strings |
| summary_status | enum('pending','ready','failed') | default 'pending' |

### Pipeline
1. After a material's raw text is stored and chunked (file 09, section 4), enqueue a
   background job (BullMQ) — summarization should never block the upload response,
   since long PDFs can be tens of thousands of tokens.
2. If the raw text exceeds Gemini's comfortable single-call context, chunk it into
   large sections (e.g. 5–8k tokens each), summarize each with the "section summary"
   prompt below, then run one final pass combining section summaries into the final
   one-page summary + key points.
3. Store results, set `summary_status = 'ready'`.
4. Frontend polls or gets a WebSocket push to reveal the summary card on the material's page once ready.

### Prompt — Section Summary (used when material is long enough to need chunked summarization)
```
Summarize the following section of study material in 4–6 sentences, in plain language
a student would actually use to review before an exam. Preserve any specific
definitions, formulas, or named concepts exactly as written — do not paraphrase
technical terms into something vaguer.

--- Section ---
{{section_text}}
```

### Prompt — Final One-Page Summary + Key Points
```
You are producing a one-page study summary for the course material below (already
pre-summarized in sections if it was long). Write like a strong student's own revision
notes — clear, direct, no filler like "This document discusses" or "In conclusion."

Return ONLY valid JSON:
{
  "one_page_summary": string,
  "key_points": string[]
}

Rules:
- "one_page_summary": roughly 250–400 words, organized in short paragraphs (no headers needed).
- "key_points": 5–10 short bullet-style strings, each one fact/definition/formula a
  student would want on a flashcard — not full sentences copied from the summary.
- Preserve technical accuracy over brevity — never sacrifice a specific number,
  formula, or term to make a sentence shorter.
```

---

## B. Auto Priority Re-Ranking

### Concept
Once a week (or whenever the workload changes significantly — e.g. a new task added
with a near deadline), Gemini looks at everything pending across all courses and
re-balances each task's priority, rather than leaving priority as a static value set
once at creation.

### Schema Addition
Add to `tasks`:
| Column | Type | Notes |
|---|---|---|
| priority_source | enum('user_set','ai_suggested') | tracks whether the current priority came from the student or the re-ranker |
| priority_last_updated | timestamptz | |

Add a new table `priority_rerank_log`:
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users | |
| ran_at | timestamptz | |
| summary_note | text | short Gemini-written explanation of what changed and why |

### Trigger Conditions
- Scheduled: every Sunday night (BullMQ recurring job), per user with pending tasks.
- Event-based: immediately after a new task is added whose deadline falls within the next 72 hours (a genuinely urgent addition shouldn't wait for Sunday).

### Pipeline
1. Pull all `pending` tasks for the user across all courses (title, type, deadline, current priority, course name, estimated effort if the student ever tagged one — otherwise infer from `type`, e.g. project > assignment > quiz for typical effort).
2. Send the full list to Gemini with the re-ranking prompt below.
3. Gemini returns an updated priority per task **plus a short plain-language note** explaining the overall change (this note is what gets shown to the student, not a silent database update — priority changes should never feel like a black box).
4. Update `tasks.priority` only where it changed, set `priority_source = 'ai_suggested'`, log the run in `priority_rerank_log`.
5. **Student always retains override**: if a student manually sets a priority afterward, set `priority_source = 'user_set'` and exclude that task from automatic re-ranking until its deadline passes or it's marked done — the AI should never keep overriding an explicit human decision.
6. Surface the `summary_note` as a small dismissible notification: "Adjusted a few priorities this week — your DB project moved up since two other deadlines landed the same week."

### Prompt — Weekly Priority Re-Ranking
```
You are helping a student balance workload across all their pending academic tasks.
You will receive a JSON list of tasks, each with: title, type, course, deadline,
current_priority, priority_source.

Re-evaluate priority ("low" | "medium" | "high") for each task based on:
- How close the deadline is.
- How much work the task type typically takes (project > assignment > quiz > personal, as a rough baseline — adjust if multiple tasks cluster in the same week, since clustering itself raises urgency).
- Never downgrade a task that is due within 48 hours, regardless of type.
- Do not change priority for any task where priority_source is "user_set" — leave those exactly as given.

Return ONLY valid JSON:
{
  "updated_tasks": [ { "task_id": string, "priority": "low"|"medium"|"high" } ],
  "summary_note": string
}

"summary_note": one short, plain-language sentence a student would actually want to
read (not a technical log) explaining the overall shift, e.g. "Bumped your DB project
up since it now overlaps with two other deadlines this week." If nothing meaningfully
changed, summary_note should say so simply, e.g. "No changes needed — your week looks balanced."
```

---

## C. Calendar Conflict Detector

### Concept
Whenever a task is created or its deadline changes (from any source — voice, email
auto-detect, manual, or OCR-derived), check whether it creates a workload pile-up
against existing tasks, and warn the student **before** the conflict sneaks up on them
— with a concrete alternative suggestion, not just a warning.

### What Counts as a "Conflict"
Not just literal same-timestamp collisions — the real problem for a student is **density**:
- 3+ high/medium-priority tasks due within the same 48-hour window.
- A new task whose deadline lands the same day as an existing exam.
- Total estimated effort for a single day/window exceeding a reasonable threshold (e.g. more than 2 "heavy" task types — project/exam — landing within 3 days of each other).

### Pipeline
1. On task create/update (any source), after it's saved, run a lightweight database
   query: fetch all other pending tasks within a ±5-day window of the new/changed deadline.
2. If that window has 3+ tasks or any project/exam overlap, send the cluster to Gemini
   with the conflict-detection prompt below.
3. If Gemini confirms a real conflict (not just "a normal busy week"), show an in-app
   warning banner + optional push/WhatsApp notification, with the suggested
   alternative timing included.
4. The alternative is always a **suggestion the student can accept or dismiss** — the
   system never auto-moves a deadline that isn't actually the student's to move (real
   academic deadlines are fixed by the instructor); what it can suggest is when the
   student should **start** working on it, not when it's due.

### Prompt — Conflict Detection & Suggestion
```
A student just added or updated a task, creating a cluster of deadlines close
together. You will receive: the new/changed task, and a list of other pending tasks
in the surrounding days.

Decide: is this actually a meaningful workload conflict (multiple heavy tasks
genuinely colliding), or just a normal moderately busy week that doesn't need a
warning? Be conservative — only flag it if a student would genuinely appreciate the
heads-up.

Return ONLY valid JSON:
{
  "is_conflict": boolean,
  "message": string | null,
  "suggested_start_date": string | null
}

Rules:
- Never suggest changing an actual deadline — deadlines are fixed by instructors.
  Only suggest when the student should realistically START working on the new/changed
  task to avoid the pile-up (an ISO date, earlier than its deadline).
- "message" should be short, calm, and specific — e.g. "Your DB project and OS
  assignment are both due Friday, plus a quiz Thursday. Might be worth starting the
  DB project this weekend instead of waiting." Never alarmist language.
- If is_conflict is false, both message and suggested_start_date should be null.
```

---

## D. Where These Plug Into the Existing Plan
- All three run as **background BullMQ jobs**, same infra as the reminder scheduler in file 07 — no new job system needed.
- All three are Gemini-only (no Groq needed) since none are latency-critical in the way voice capture is — they can take a few seconds without the student noticing.
- All three write a **user-visible explanation** (summary card, notification note, or warning message) rather than silently changing data — this matches the plan's existing principle (file 07, "preview before save") that AI actions stay transparent to the student.
