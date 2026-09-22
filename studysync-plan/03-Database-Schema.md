# 03 — Database Schema (PostgreSQL)

## users
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| full_name | text | |
| email | text, unique | |
| password_hash | text | Argon2id, null if OAuth-only |
| google_oauth_id | text, nullable | |
| gmail_refresh_token_enc | text, nullable | encrypted |
| whatsapp_number | text, nullable | E.164 format |
| totp_secret_enc | text, nullable | encrypted, for 2FA |
| role | enum('student','admin') | default 'student' |
| reminder_lead_time_mins | int | default 1440 (1 day) |
| created_at, updated_at | timestamptz | |

## tasks
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users | |
| title | text | |
| type | enum('quiz','assignment','project','exam','personal','other') | |
| subject | text, nullable | |
| description | text, nullable | |
| deadline | timestamptz | |
| priority | enum('low','medium','high') | |
| status | enum('pending','done','missed') | |
| source | enum('voice','email','manual') | |
| created_at, updated_at | timestamptz | |

## reminders
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| task_id | UUID FK → tasks | |
| channel | enum('email','whatsapp') | |
| scheduled_for | timestamptz | |
| sent_at | timestamptz, nullable | |
| status | enum('pending','sent','failed') | |
| generated_message | text, nullable | cached AI-generated wording |

## email_ingestion_log
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users | |
| gmail_message_id | text | dedup key, unique per user |
| processed_at | timestamptz | |
| extracted_task_id | UUID FK → tasks, nullable | null if classified as "not academic" |

## audit_log
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users, nullable | |
| action | text | e.g. "login", "task_created", "account_deleted" |
| metadata | jsonb | |
| ip_address | text | |
| created_at | timestamptz | |

## Relationships
- One `user` → many `tasks`
- One `task` → many `reminders` (one per channel per scheduled lead time)
- One `user` → many `email_ingestion_log` rows (dedup prevents re-processing the same email)

## Indexing Notes
- `tasks(user_id, deadline)` — composite index, this is the query that powers the calendar view
- `reminders(scheduled_for, status)` — powers the BullMQ scheduler's "what's due to send now" query
- `email_ingestion_log(user_id, gmail_message_id)` — unique composite index for dedup
