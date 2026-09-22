# 06 — UI/UX Design Guide (Light Theme, Human-Readable Typography)

## 1. Theme
- **Light theme only** — no dark-mode toggle needed for this FYP scope.
- Base background: near-white (`#FAFAF9` or similar warm off-white — pure `#FFFFFF` everywhere reads flat/clinical).
- Primary accent: a single calm color for actions/links (e.g. a muted indigo or teal) — avoid neon or saturated colors; this is a study tool, not a game.
- Task-type color tags (used consistently across calendar/dashboard):
  - Quiz — amber
  - Assignment — blue
  - Project — purple
  - Exam — red/coral
  - Personal — green

## 2. Typography
- Body font: a humanist sans-serif (Inter, Source Sans, or similar) — avoid geometric/robotic fonts for body copy.
- **Justified text** for paragraph content (summaries, email previews, landing page copy) with hyphenation enabled where the framework supports it, to avoid ugly rivers of whitespace that unhyphenated justification can create.
- Line-height: 1.5–1.6 for body text, never tighter than 1.4 — this is the single biggest readability lever.
- Paragraph spacing: consistent vertical rhythm — use a spacing scale (4/8/12/16/24/32px) rather than ad hoc margins, so every page feels the same "hand" designed it.
- Max line length for body text: ~65–75 characters — never let a paragraph stretch full-width on a large screen; constrain with a max-width container.

## 3. Layout Principles
- Generous white space over dense packing — a reminder app's job is to reduce anxiety, not visually add to it.
- Calendar grid: clear cell boundaries, but light (avoid heavy black grid lines — use a soft gray).
- Cards (task cards, dashboard summary cards): subtle shadow or 1px border, rounded corners (~8–12px), never harsh drop shadows.

## 4. Voice Capture UI
- The mic button should feel calm, not alarming — a soft pulsing ring while listening, not a flashing red recording indicator.
- Show the live transcript as it streams in — this builds trust that the system heard correctly before it commits anything.

## 5. Accessibility
- Minimum 4.5:1 contrast ratio for all text (standard WCAG AA).
- All interactive elements keyboard-navigable; calendar cells and task cards reachable via Tab.
- Don't rely on color alone for task-type — pair each color tag with a small icon or label text.

## 6. Content/Copy Tone (matches the AI-generation rules in file 05)
- Interface copy (buttons, empty states, error messages) should read like a helpful person wrote it: "Nothing due this week — nice." instead of "No tasks found in the current date range."
- Error messages explain what happened and what to do next, never raw technical text ("500 Internal Server Error" should never reach the user).
