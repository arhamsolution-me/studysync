# 09 — Courses Module & Per-Course RAG Chatbot

This extends the base plan (files 00–08) with: user-managed courses, tasks linked to a
specific course, and **one independent RAG chatbot per course** that the student can
feed material into and query — from the web chat, from voice, or from WhatsApp using a
`/<courseName>` command that "locks" the conversation to that course.

---

## 1. Concept

- Student adds their own courses freely (e.g. "Database Systems", "OS", "AI") — no fixed list, fully custom.
- Every task (quiz/assignment/etc.) can optionally be linked to a course.
- Each course gets its **own isolated chatbot** — its own uploaded material, its own chat history, its own vector index. Course A's chatbot never sees Course B's material or history.
- Student can talk to a course's chatbot three ways:
  1. **Web chat** — open the course page, chat normally.
  2. **Voice** — speak a question or upload a voice note as material; both get transcribed and handled the same way as text.
  3. **WhatsApp** — send `/<courseName>` once to switch the WhatsApp thread's active course, then every following message (text, voice note, or document) is routed to that course's chatbot and saved into that course's own history — until the student sends `/<anotherCourseName>` to switch, or `/end` to exit course mode.

---

## 2. Database Additions

### courses
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users | |
| name | text | student-defined, e.g. "Database Systems" |
| color_tag | text, nullable | for calendar/task display |
| created_at | timestamptz | |

### course_materials
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| course_id | UUID FK → courses | |
| source_type | enum('text','voice','document','image','chat_upload') | |
| original_filename | text, nullable | |
| raw_transcript_or_text | text | full text before chunking (OCR output for images) |
| ocr_confidence | numeric, nullable | average OCR confidence score, only set when source_type = 'image' |
| created_at | timestamptz | |

### course_material_chunks
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| material_id | UUID FK → course_materials | |
| course_id | UUID FK → courses | denormalized, speeds up retrieval filtering |
| chunk_text | text | ~300–500 tokens per chunk |
| embedding | vector(768) | pgvector column — dimension matches chosen embedding model |
| created_at | timestamptz | |

### course_chat_history
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| course_id | UUID FK → courses | |
| user_id | UUID FK → users | |
| channel | enum('web','voice','whatsapp') | |
| role | enum('user','assistant') | |
| message_text | text | transcribed if originally voice |
| created_at | timestamptz | |

### tasks (modification)
- Add `course_id UUID FK → courses, nullable` — links a task to a course when relevant.

### whatsapp_session_state (Redis, not Postgres — ephemeral)
- Key: `wa_session:{whatsapp_number}`
- Value: `{ "active_course_id": UUID, "last_activity": timestamp }`
- TTL: e.g. 6 hours of inactivity auto-clears the active course (student has to `/<courseName>` again) — prevents a stale context from silently capturing unrelated messages days later.

---

## 3. Vector Store Choice

Use **pgvector** (Postgres extension) rather than a separate vector database. Reasoning:
- Keeps the stack simple — no extra service to secure/scale for an FYP.
- Course-level isolation is a plain `WHERE course_id = ...` filter, which pgvector supports natively with an index.
- Scales fine to 100k+ users' worth of course material with an `ivfflat` or `hnsw` index on the `embedding` column, partitioned/filtered by `course_id`.
- If a future version needs standalone vector infra (Qdrant/Pinecone), the chunk table maps over cleanly since the schema is already chunk-based.

Embedding model: Gemini's embedding endpoint (`text-embedding-004` or latest) — keeps everything on one AI provider for text embeddings, reserving Groq for its speed-critical jobs (voice + fast routing) as in the base plan.

---

## 3a. OCR — Image/Handwritten Notes Ingestion

Students will often want to upload a **photo** instead of typing — a picture of a
textbook page, a whiteboard after class, a printed handout, or their own handwritten
notes. This needs its own step before the material can be chunked/embedded like
everything else.

**Engine choice**: Use **Gemini's built-in vision capability** (`gemini-2.0-flash` or
latest, which accepts images directly) instead of a separate OCR service. Reasoning:
- One less API/vendor to manage and secure — everything text-related already goes
  through Gemini.
- Gemini reads both **printed and handwritten text** reasonably well and can be
  prompted to also describe diagrams/formulas in words, which a plain OCR engine
  (Tesseract) cannot do.
- No extra cost tier to worry about beyond the Gemini quota already used elsewhere in the plan.
- If handwriting quality later proves too inconsistent for Gemini alone, add
  **Tesseract** (free, offline) as a first-pass extractor and only fall back to Gemini
  vision for low-confidence pages — this is a drop-in upgrade, not a redesign.

**Pipeline**:
1. Image uploaded (web upload, or a photo sent via WhatsApp/voice-channel chat).
2. Basic pre-checks: file size limit, image format validation, reject obvious non-document photos early (optional, via a quick Gemini vision check: "does this look like study material?").
3. Send image to Gemini vision with the OCR extraction prompt below.
4. Store the returned text in `course_materials.raw_transcript_or_text`, `source_type = 'image'`, and the model's self-reported confidence/uncertainty flag in `ocr_confidence`.
5. **Low-confidence handling**: if Gemini flags parts as illegible (see prompt), surface those flagged lines back to the student in the upload confirmation screen ("Couldn't read this part clearly — want to retype it?") rather than silently embedding garbled text into the chatbot's knowledge base.
6. Once accepted, the extracted text proceeds through the normal chunk → embed steps exactly like typed material.

**Prompt — OCR Extraction (Gemini Vision)**
```
You are extracting study material from an image for a student's course notes. The
image may contain printed text, handwriting, diagrams with labels, or a mix.

Return ONLY valid JSON in this shape:
{
  "extracted_text": string,
  "contains_handwriting": boolean,
  "confidence": "high" | "medium" | "low",
  "unclear_sections": string[]
}

Rules:
- Transcribe all readable text faithfully, preserving structure (headings, bullet
  points, numbered lists) using plain-text formatting.
- For diagrams or figures, add a short bracketed description instead of skipping them,
  e.g. "[Diagram: ER diagram showing Student–Course many-to-many relationship]".
- If any word or line is genuinely illegible, do not guess — write "[unclear]" in its
  place and add a short description of that spot to "unclear_sections" (e.g. "second
  line under 'Normalization', looks crossed out").
- Set "confidence" to "low" if more than a few words across the page were unclear.
```

---

## 4. Material Ingestion Pipeline (any source)

1. **Input arrives** — as typed text, an uploaded document, a photo/screenshot, a voice note, or a WhatsApp message while a course is "active."
2. **Normalize to text**:
   - Text/document → extract text directly (PDF/docx text extraction).
   - Voice (web or WhatsApp voice note) → Groq `whisper-large-v3` transcription.
   - **Image (photo of handwritten notes, textbook page, whiteboard, slide screenshot)** → OCR (see section 3a below) → plain text.
3. **Store raw record** in `course_materials` (including OCR confidence score for images).
4. **Chunk**: split into ~300–500 token chunks with slight overlap (~50 tokens) to preserve context across chunk boundaries.
5. **Embed**: each chunk → Gemini embedding → store in `course_material_chunks.embedding`.
6. **Ready for retrieval** — no separate "processing" step needed; the moment chunks are embedded, they're queryable by the course chatbot.

## 5. Query/Chat Pipeline (any source)

1. **Input arrives** — a question, via web chat, voice, or WhatsApp (with an active course already set via `/<courseName>`).
2. **Normalize to text** (Groq Whisper if voice).
3. **Embed the question** (same Gemini embedding model).
4. **Retrieve**: pgvector similarity search, filtered to `course_id`, top-k (e.g. 5) chunks.
5. **Generate answer**: Gemini call with the RAG prompt (section 6 below), passing retrieved chunks as context.
6. **Save turn**: both the user's message and the assistant's reply are written to `course_chat_history` with the correct `channel` and `course_id` — this is the "save history per course" requirement, satisfied automatically on every turn regardless of which channel it came from.
7. **Deliver**: reply shown in web chat, spoken back (optional TTS) for voice, or sent as a WhatsApp reply.

---

## 6. WhatsApp Command Routing Logic

```
On every inbound WhatsApp message:

1. Look up wa_session:{from_number} in Redis.

2. If message text matches /^\/([a-zA-Z0-9 _-]+)$/ (a slash command):
     a. Extract courseName.
     b. If courseName == "end": clear the session key, reply
        "Okay, exited course mode." and stop.
     c. Else: look up the user's course by fuzzy-matching courseName against
        their own `courses.name` list (case-insensitive, trims spaces).
        - If exactly one match: set active_course_id in Redis, reply
          "Switched to <Course Name>. Anything you send now goes here."
        - If no match: reply "No course found matching '<courseName>'. Your
          courses: <list>."
        - If multiple ambiguous matches: reply asking them to pick one from
          a short numbered list.
     d. Stop — do not treat the command itself as a chat message.

3. Else (not a slash command):
     a. If no active_course_id in session: reply "No course selected — send
        /<courseName> first (e.g. /DatabaseSystems)."
     b. Else: route the message (text, voice note, or photo) through the
        ingestion or query pipeline (sections 3a/4/5) using channel =
        "whatsapp" and the active course_id.
        - A photo attachment always goes through the OCR step (3a) first,
          then is treated as material (photos are virtually always shared
          as notes, not questions — no ambiguity check needed here).
        - For text/voice, decide ingestion vs. query using the same fast
          Groq classifier pattern from file 05 (prompt: "Is this a question
          for the assistant, or new material being shared?").
        - Bump last_activity on the Redis session to reset the TTL.
```

This is the exact mechanic the student described: `/<courseName>` locks the thread to
that course, everything afterward (text or voice) is saved into that course's own
history, and it stays "remembered" for future recall.

---

## 7. Prompts

### Course Material Ingestion — Chunk Labeling (optional but useful)
```
You will receive one chunk of study material a student uploaded for a specific course.
In one short line, describe what this chunk covers (a topic label), so it can be shown
in a "sources used" list when the chatbot answers from it later.

Return only the topic label, under 8 words, no punctuation at the end.
```

### Course RAG Chatbot — Answering with Retrieved Context
```
You are the dedicated study assistant for the course "{{course_name}}". Answer using
ONLY the material provided below, plus the recent conversation history for this course.
If the retrieved material doesn't contain the answer, say so plainly and suggest the
student upload the relevant notes/slides — do not invent facts or fill gaps from
general knowledge unless the student explicitly asks for outside explanation.

Write like a knowledgeable classmate helping out — clear, direct, no filler phrases
like "Based on the provided context" or "As an AI language model." Keep answers
proportionate to the question: a quick fact gets a short answer, a "explain this
concept" question gets a fuller one.

--- Retrieved course material ---
{{retrieved_chunks}}
--- End material ---

Recent conversation:
{{recent_history}}

Student's message: {{user_message}}
```

### WhatsApp Voice-Note-as-Material Confirmation
```
You will receive a transcript of a voice note a student sent while a specific course
was active, with no question mark or clear question phrasing in it. Decide: is this
the student ASKING something, or SHARING information/notes to be stored?

Return only one word: "QUESTION" or "MATERIAL".
```
Use this before deciding whether to run the ingestion pipeline (store + embed) or the
query pipeline (retrieve + answer) for ambiguous voice notes.

---

## 8. Page/UI Additions

- **My Courses page** — grid/list of the student's own courses, "+ Add Course" button, each card shows material count and last chat activity.
- **Course Detail page** — three sections: (1) chat panel (RAG chatbot, text + mic input), (2) uploaded material list (with the topic-label tags from the ingestion prompt above), (3) tasks linked to this course (pulled via `tasks.course_id`).
- **Task creation/edit** — add an optional "Course" dropdown so any task (voice-captured, email-detected, or manual) can be tied to a course.
- Calendar and dashboard task cards show the linked course name as a small subtitle when present.

## 9. Security Note Specific to This Module
- Course material and chat history are private per user — every retrieval query filters by both `course_id` AND `user_id` server-side (never trust a client-supplied course_id alone), so one student's uploaded notes can never surface in another student's chatbot even if course names collide (e.g. two students both naming a course "OS").
- WhatsApp number → user_id mapping must be verified (OTP, as already specified in file 04) before any course session can be activated from that number, so a spoofed sender number can't pull another student's course data.
