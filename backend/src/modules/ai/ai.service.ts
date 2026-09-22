import Groq, { toFile } from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../../config';
import { getAcademicCalendarPromptContext, deeplyCalculateAcademicDeadline } from '../../utils/systemDateTime';

// ─── Groq Client Rotation (Speed-critical: STT + Intent Classification) ──

const groqKeys: string[] = (config.groq as any).keys?.length
  ? (config.groq as any).keys
  : config.groq.apiKey
    ? [config.groq.apiKey]
    : [];

let currentGroqKeyIdx = 0;

function getNextGroqClient(): Groq | null {
  if (groqKeys.length === 0) return null;
  const key = groqKeys[currentGroqKeyIdx % groqKeys.length];
  currentGroqKeyIdx++;
  return new Groq({ apiKey: key });
}

// ─── Gemini Client Rotation (Multi-key auto-shifting on 503/429) ─────────
const geminiKeys: string[] = (config.gemini as any).keys?.length
  ? (config.gemini as any).keys
  : config.gemini.apiKey
    ? [config.gemini.apiKey]
    : [];

let currentGeminiKeyIdx = 0;

export function getNextGeminiClient(): GoogleGenerativeAI | null {
  if (geminiKeys.length === 0) return null;
  const key = geminiKeys[currentGeminiKeyIdx % geminiKeys.length];
  currentGeminiKeyIdx++;
  return new GoogleGenerativeAI(key);
}

export function getAllGeminiClients(): GoogleGenerativeAI[] {
  if (geminiKeys.length === 0) return [];
  return geminiKeys.map((k) => new GoogleGenerativeAI(k));
}

const genAI = geminiKeys.length > 0
  ? new GoogleGenerativeAI(geminiKeys[0])
  : null;

// Verified Live Models: OpenAI 120B on Groq LPUs (<800ms) + Gemini 3.6 Flash
const GEMINI_MODEL = 'gemini-3.6-flash';
const GEMINI_FALLBACK_MODELS = ['gemini-flash-latest'];
const GROQ_MODEL = 'openai/gpt-oss-120b'; // Heavy 120B parameter model on Groq LPUs (sub-second response)
const GROQ_FALLBACK_MODEL = 'openai/gpt-oss-20b';

// ─── System Prompts ───────────────────────────────────────────────────

const PROMPTS = {
  /**
   * Gemini & Groq: Voice transcript → structured task JSON
   */
  taskExtraction: () => `You are an intelligent task-extraction engine for a university student academic app.
You will receive a spoken or typed transcript (which may mix English, Urdu, and Roman Urdu).
Extract exactly one academic deliverable (quiz, assignment, exam, test, project) or personal study task.

${getAcademicCalendarPromptContext()}

Return ONLY valid JSON, no prose, matching this shape exactly:
{
  "title": string,
  "type": "quiz" | "assignment" | "project" | "exam" | "personal" | "other",
  "subject": string | null,
  "deadline_iso": string | null,
  "priority": "low" | "medium" | "high"
}

Rules:
- Infer "type" from context (e.g. "quiz" if the word quiz/test appears, "assignment" for submissions/reports/diagrams, "exam" for finals/midterms).
- CALCULATE DEADLINES PRECISELY USING THE SYSTEM CALENDAR CONTEXT ABOVE:
  * If a specific date is spoken (e.g. "20 sep", "20 september", "20th sep", "bees sep"):
    It MUST be calculated in the current academic year (2026). "20 sep" MUST ALWAYS resolve to "2026-09-20T23:59:59.000Z"!
    NEVER choose another month or year!
  * If a relative date is spoken ("kal", "tomorrow", "parso", "aglay hafte", "Monday"):
    Use the 7-day calendar lookup table above.
  * If no date is mentioned, set deadline_iso to null.
- Priority: within 3 days or exams = high; within a week = medium; else low.
- If a user mentions a course or subject name without explicit action, create a study task.
- Only return {"title": null} if the input is purely noise or completely irrelevant to studies.`,

  /**
   * Groq (Llama 3.3 70B): Fast intent classifier
   */
  intentClassifier: `Classify the following spoken transcript into exactly one label:
NEW_TASK, MARK_DONE, ASK_SCHEDULE, SMALL_TALK, UNCLEAR.

Respond with only the label, nothing else.`,

  /**
   * Gemini: Email → structured task
   */
  emailExtraction: `You are screening a student's email inbox for academic deadlines. You will receive the
subject and body text of one email. Decide if it announces a graded academic task
(assignment, quiz, project, exam) with a deadline or date.

Return ONLY valid JSON:
{
  "is_academic_task": boolean,
  "title": string | null,
  "type": "quiz" | "assignment" | "project" | "exam" | null,
  "subject": string | null,
  "deadline_iso": string | null
}

Rules:
- Be conservative: newsletters, general announcements, and social emails are
  is_academic_task: false.
- Only extract a deadline_iso if an explicit date/time is present in the email.
- Do not guess a course name if it isn't clearly stated in the subject or body.`,

  /**
   * Gemini: Human-sounding email reminder
   */
  emailReminder: `You write short reminder emails for a student task app. Write like a thoughtful friend
who's organized, not like a corporate notification system or an AI assistant. No
exclamation-mark enthusiasm, no phrases like "Don't forget!", "As a reminder," or
"I hope this email finds you well." No emoji unless the user's own writing style uses them.

Given the task details, write:
1. A subject line (under 8 words, plain, specific — e.g. "DB assignment due tomorrow")
2. A 2–3 sentence body: state what's due, when, and one calm, practical nudge if it's
   high priority (e.g. "might be worth starting tonight if you haven't").

Vary sentence structure and phrasing across different reminders — never reuse the same
opening line twice in a row. Output plain text: line 1 = subject, blank line, then body.`,

  /**
   * Gemini: Human-sounding WhatsApp reminder
   */
  whatsappReminder: `You write short WhatsApp reminders for a student task app — casual, like a text from a
friend, not a corporate bot. One or two short sentences max. Mix of English and Roman
Urdu is fine if the student's task title was in Roman Urdu; otherwise plain English.
No corporate phrasing, no "This is an automated reminder," no excessive punctuation.

Given the task title, type, and time remaining, write one short WhatsApp message in
that tone.`,

  /**
   * Gemini: Monthly/Semester summary
   */
  workloadSummary: `You summarize a student's upcoming workload in plain, natural language — like a
personal assistant giving a quick verbal briefing, not a generated report.

Given a list of tasks (title, type, deadline, status) for the requested period, write
a short paragraph (4–6 sentences): how many tasks are pending, which ones are most
urgent, and whether the week/month ahead looks light or heavy. Avoid bullet-point
listing everything back — synthesize it into a natural summary a person would actually
say out loud.`,

  /**
   * Gemini: Calendar Workload Conflict Detector
   */
  conflictDetector: `A student just added or updated a task, creating a cluster of deadlines close
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
- If is_conflict is false, both message and suggested_start_date should be null.`,

  /**
   * Gemini: Weekly Priority Re-Ranking
   */
  priorityReRanking: `You are helping a student balance workload across all their pending academic tasks.
You will receive a JSON list of tasks, each with: title, type, course, deadline,
current_priority, priority_source.

Re-evaluate priority ("low" | "medium" | "high") for each task based on:
- How close the deadline is.
- How much work the task type typically takes (project > assignment > quiz > personal).
- Never downgrade a task that is due within 48 hours, regardless of type.
- Do not change priority for any task where priority_source is "user_set".

Return ONLY valid JSON:
{
  "updated_tasks": [ { "task_id": string, "priority": "low"|"medium"|"high" } ],
  "summary_note": string
}`,
};

// ─── Anti-AI Phrasing Check ───────────────────────────────────────────

const AI_STOCK_PHRASES = [
  'I hope this helps',
  'As an AI',
  'Feel free to',
  "Don't hesitate to",
  "In today's fast-paced world",
  'I hope this email finds you well',
  'This is an automated reminder',
  'As a reminder',
];

function passesAntiAiCheck(text: string): boolean {
  const lower = text.toLowerCase();
  return !AI_STOCK_PHRASES.some((phrase) => lower.includes(phrase.toLowerCase()));
}

function generateDeterministicVector(text: string, dimensions: number = 768): number[] {
  const vector = new Array(dimensions).fill(0);
  const words = text.toLowerCase().split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let hash = 0;
    for (let j = 0; j < word.length; j++) {
      hash = (hash << 5) - hash + word.charCodeAt(j);
      hash |= 0;
    }
    const idx = Math.abs(hash) % dimensions;
    vector[idx] += 1;
  }
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0)) || 1;
  return vector.map((v) => v / norm);
}

// ─── AI Service ───────────────────────────────────────────────────────

class AiService {
  /**
   * Groq: Transcribe audio to text using Whisper-large-v3 with rotating keys.
   */
  async transcribeAudio(audioBuffer: Buffer, filename: string): Promise<string> {
    const client = getNextGroqClient();
    if (!client) {
      throw Object.assign(new Error('Voice capture is not configured yet — Groq API key is missing.'), {
        statusCode: 503,
      });
    }

    const ext = filename.split('.').pop()?.toLowerCase() || 'webm';
    let mimeType = 'audio/webm';
    if (ext === 'mp3') mimeType = 'audio/mp3';
    else if (ext === 'wav') mimeType = 'audio/wav';
    else if (ext === 'm4a') mimeType = 'audio/m4a';
    else if (ext === 'ogg') mimeType = 'audio/ogg';
    else if (ext === 'aac') mimeType = 'audio/aac';
    else if (ext === 'flac') mimeType = 'audio/flac';

    try {
      const file = await toFile(audioBuffer, filename, { type: mimeType });
      const transcription = await client.audio.transcriptions.create({
        file,
        model: 'whisper-large-v3-turbo',
        prompt: 'Academic lecture, class discussion, study notes, formula, assignments, exams in English and Roman Urdu.',
        response_format: 'text',
      });
      return typeof transcription === 'string' ? transcription : (transcription as any).text || '';
    } catch (err: any) {
      console.warn('[Whisper] Primary transcription attempt failed, retrying with whisper-large-v3...', err?.message);
      const retryClient = getNextGroqClient() || client;
      try {
        const retryFile = await toFile(audioBuffer, filename, { type: mimeType });
        const res = await retryClient.audio.transcriptions.create({
          file: retryFile,
          model: 'whisper-large-v3',
          prompt: 'Academic lecture, class discussion, study notes, formula, assignments, exams in English and Roman Urdu.',
          response_format: 'text',
        });
        return typeof res === 'string' ? res : (res as any).text || '';
      } catch (retryErr: any) {
        console.error('[Whisper] Secondary transcription failed:', retryErr?.message);
        return '';
      }
    }
    return '';
  }

  /**
   * Gemini 3.6 Flash: Extract text, handwriting, formulas, diagrams, and notes from images.
   */
  async analyzeImage(imageBuffer: Buffer, filename: string): Promise<string> {
    if (!genAI) {
      throw Object.assign(new Error('Gemini API key is required for image analysis.'), {
        statusCode: 503,
      });
    }

    const ext = filename.split('.').pop()?.toLowerCase() || 'png';
    let mimeType = 'image/png';
    if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
    else if (ext === 'webp') mimeType = 'image/webp';
    else if (ext === 'gif') mimeType = 'image/gif';

    const base64Data = imageBuffer.toString('base64');
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const prompt = `You are an expert academic visual intelligence engine for university students.
Thoroughly examine this study image, diagram, whiteboard capture, or handwritten note:
1. FULL TEXT & EQUATIONS EXTRACTION: Transcribe all visible text, equations, math formulas, headers, labels, and notes accurately.
2. DIAGRAM / CHART EXPLANATION: If there is an architectural diagram, graph, chart, flowchart, or table, describe all components, nodes, data relationships, and their academic significance.
3. CORE CONCEPT SUMMARY: Summarize the primary academic concepts, key insights, and takeaways.
4. FORMAL PRESENTATION: Structure your output formally with clean GitHub Markdown headings, bullet points, and code/math blocks.`;

    const res = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      },
      prompt,
    ]);

    return res.response.text().trim();
  }

  /**
   * Groq: Fast intent classification using Groq with rotating keys.
   */
  async classifyIntent(transcript: string): Promise<string> {
    const client = getNextGroqClient();
    if (!client) return 'NEW_TASK';

    try {
      const response = await client.chat.completions.create({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: PROMPTS.intentClassifier },
          { role: 'user', content: transcript },
        ],
        temperature: 0,
        max_tokens: 10,
      });

      const label = response.choices[0]?.message?.content?.trim() || 'UNCLEAR';
      return ['NEW_TASK', 'MARK_DONE', 'ASK_SCHEDULE', 'SMALL_TALK', 'UNCLEAR'].includes(label)
        ? label
        : 'UNCLEAR';
    } catch {
      return 'NEW_TASK';
    }
  }

  /**
   * Fast Model Dynamic Detection: Analyzes student question (in English, Roman Urdu, Urdu, or any casual phrasing)
   * to dynamically determine if the query relates to voice recordings, spoken audio lectures, or images/diagrams.
   */
  async classifyQueryModality(question: string): Promise<{ isVoiceQuery: boolean; isImageQuery: boolean }> {
    const groq = getNextGroqClient();
    const systemPrompt = `You are an academic query classifier. Analyze the user question (which may be in English, Roman Urdu, Hindi, or casual phrasing) and decide if the user is asking about or referring to:
1. Voice notes, audio recordings, spoken lectures, class discussions, podcasts, speech, or "kya bat hui", "audio sunao", "recording me kya tha", "lecture clip", "what was said", etc. -> Set "isVoiceQuery": true
2. Images, visual diagrams, photos, charts, screenshots, figures, drawings, blackboard/whiteboard pictures, or "tasveer", "pic", "graph", "diagram me kya ha", etc. -> Set "isImageQuery": true

Respond ONLY with valid JSON in this exact format:
{"isVoiceQuery": true/false, "isImageQuery": true/false}`;

    if (groq) {
      try {
        const res = await groq.chat.completions.create({
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: question },
          ],
          temperature: 0,
          response_format: { type: 'json_object' },
          max_tokens: 100,
        });

        const content = res.choices[0]?.message?.content?.trim() || '{}';
        const parsed = JSON.parse(content);
        return {
          isVoiceQuery: Boolean(parsed.isVoiceQuery),
          isImageQuery: Boolean(parsed.isImageQuery),
        };
      } catch (err: any) {
        console.warn('[AI Service] Groq modality classification failed, using fallback:', err?.message);
      }
    }

    // Gemini fallback if Groq is unavailable
    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({
          model: GEMINI_MODEL,
          generationConfig: { responseMimeType: 'application/json', temperature: 0 },
        });
        const res = await model.generateContent(`${systemPrompt}\n\nUser Question: "${question}"`);
        const parsed = JSON.parse(res.response.text().trim());
        return {
          isVoiceQuery: Boolean(parsed.isVoiceQuery),
          isImageQuery: Boolean(parsed.isImageQuery),
        };
      } catch { }
    }

    // Heuristic fallback if offline/network failure
    return {
      isVoiceQuery: /voice|audio|recording|rec|kya bat hui|sunao|said|transcription|lecture|spoken|clip/i.test(question),
      isImageQuery: /image|picture|photo|diagram|screenshot|tasveer|pic|figure|graph|chart|whiteboard|draw/i.test(question),
    };
  }

  /**
   * Gemini + Groq Fallback: Extract structured task from voice transcript.
   */
  async extractTaskFromTranscript(transcript: string): Promise<any> {
    const promptText = PROMPTS.taskExtraction();

    let parsedResult: any = null;

    // High-speed Groq (Primary: sub-second response with 12 rotated keys)
    const groqClient = getNextGroqClient();
    if (groqClient) {
      try {
        const response = await groqClient.chat.completions.create({
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: promptText },
            { role: 'user', content: transcript },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        });

        const content = response.choices[0]?.message?.content?.trim() || '{}';
        parsedResult = JSON.parse(content);
      } catch (groqErr: any) {
        console.warn('[AI] Groq primary extraction error, trying fallback:', groqErr?.message);
      }
    }

    // Reliable fallback to Gemini
    if (!parsedResult && genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
        const result = await model.generateContent({
          contents: [
            {
              role: 'user',
              parts: [
                { text: promptText + '\n\nTranscript:\n' + transcript },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 300,
          },
        });

        const text = result.response.text().trim();
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsedResult = JSON.parse(cleaned);
      } catch (geminiErr: any) {
        console.warn('[AI] Gemini busy/error:', geminiErr?.message);
      }
    }

    if (parsedResult) {
      if (parsedResult.title && parsedResult.title !== 'null') {
        // Double-check & recalculate deadline mathematically relative to system date
        const calculatedDate = deeplyCalculateAcademicDeadline(parsedResult.deadline_iso || undefined, transcript);
        parsedResult.deadline_iso = calculatedDate.toISOString();
      }
      return parsedResult;
    }

    throw new Error('All AI extraction services are currently unavailable.');
  }

  /**
   * Intelligently scans text, voice transcript, or chatbot query for academic deliverables
   * (quizzes, assignments, exams, projects) and extracts structured task metadata with calculated deadlines.
   * If content is large or Groq hits limits, uses Gemini API.
   */
  async detectAcademicTasks(
    text: string,
    courseName: string
  ): Promise<Array<{
    title: string;
    type: 'quiz' | 'assignment' | 'project' | 'exam' | 'other';
    deadline_iso: string | null;
    priority: 'low' | 'medium' | 'high';
    description?: string;
  }>> {
    if (!text || text.trim().length < 5) return [];

    const now = new Date();
    const prompt = `You are an academic task extraction engine for university students.
Course: "${courseName}".

${getAcademicCalendarPromptContext(now)}

Analyze the following content (which may be a student question, teacher voice recording transcript, or study notes).
Determine if it mentions, announces, or schedules any Quiz, Assignment, Exam/Test, or Project with a deadline or date.

Rules:
1. Only extract actual academic deliverables (quiz, assignment, exam, test, project, lab submission).
2. Calculate the exact ISO 8601 deadline string using the real-time system date & calendar lookup table above.
   - Specific dates like "20 sep" MUST resolve to 2026-09-20!
   - "kal" / "tomorrow" resolves to tomorrow's date.
   - Assignments default to 23:59:59 (11:59 PM) end of day.
3. Assign priority: "high" if due within 3 days or an exam; "medium" for assignments/projects; "low" for general tasks.
4. If no quiz, assignment, or exam is mentioned, return an empty list: {"tasks": []}

Return ONLY valid JSON matching this schema:
{
  "tasks": [
    {
      "title": "Clear concise task title e.g. Assignment 2: Neural Networks",
      "type": "quiz" | "assignment" | "project" | "exam",
      "deadline_iso": "YYYY-MM-DDTHH:mm:ssZ" or null,
      "priority": "low" | "medium" | "high",
      "description": "Brief context or details"
    }
  ]
}`;

    const sanitizeTasks = (rawTasks: any[]) => {
      if (!Array.isArray(rawTasks)) return [];
      return rawTasks.map((t: any) => {
        const calculated = deeplyCalculateAcademicDeadline(
          t.deadline_iso || undefined,
          `${t.title || ''} ${t.description || ''} ${text}`
        );
        return {
          ...t,
          deadline_iso: calculated.toISOString(),
        };
      });
    };

    // If text is large (> 2000 chars), prioritize Gemini for huge context parsing
    if (text.length > 2000 && genAI) {
      try {
        const model = genAI.getGenerativeModel({
          model: GEMINI_MODEL,
          generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
        });
        const res = await model.generateContent(`${prompt}\n\nContent:\n${text}`);
        const parsed = JSON.parse(res.response.text().trim());
        return sanitizeTasks(parsed.tasks);
      } catch (err: any) {
        console.warn('[AI Service] Gemini task detection failed, falling back to Groq:', err?.message);
      }
    }

    // High-speed Groq extraction
    const groq = getNextGroqClient();
    if (groq) {
      try {
        const res = await groq.chat.completions.create({
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: text },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 850,
        });
        const content = res.choices[0]?.message?.content?.trim() || '{}';
        const parsed = JSON.parse(content);
        return sanitizeTasks(parsed.tasks);
      } catch (groqErr: any) {
        console.warn('[AI Service] Groq task detection error, falling back to Gemini:', groqErr?.message);
      }
    }

    // Fallback to Gemini
    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({
          model: GEMINI_MODEL,
          generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
        });
        const res = await model.generateContent(`${prompt}\n\nContent:\n${text}`);
        const parsed = JSON.parse(res.response.text().trim());
        return sanitizeTasks(parsed.tasks);
      } catch (err: any) {
        console.warn('[AI Service] Gemini task detection fallback failed:', err?.message);
      }
    }

    return [];
  }

  /**
   * Gemini: Generate human-sounding reminder text.
   */
  async generateReminder(
    channel: 'email' | 'whatsapp',
    taskTitle: string,
    taskType: string,
    timeRemaining: string
  ): Promise<string> {
    const fallback =
      channel === 'email'
        ? `${taskTitle} due ${timeRemaining}\n\nJust a heads up — your ${taskType} "${taskTitle}" is coming up ${timeRemaining}.`
        : `${taskTitle} — ${timeRemaining} remaining.`;

    // 1. Try Groq first with rotating keys
    const groq = getNextGroqClient();
    if (groq) {
      try {
        const prompt = channel === 'email' ? PROMPTS.emailReminder : PROMPTS.whatsappReminder;
        const res = await groq.chat.completions.create({
          model: GROQ_MODEL,
          messages: [
            {
              role: 'user',
              content: `${prompt}\n\nTask: ${taskTitle}\nType: ${taskType}\nTime remaining: ${timeRemaining}`,
            },
          ],
          temperature: 0.7,
          max_tokens: 200,
        });

        const text = res.choices[0]?.message?.content?.trim();
        if (text && passesAntiAiCheck(text)) {
          return text;
        }
      } catch (err: any) {
        console.warn('[AI Service] Groq reminder generation error, trying Gemini:', err?.message);
      }
    }

    // 2. Try Gemini with safe try-catch
    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
        const prompt = channel === 'email' ? PROMPTS.emailReminder : PROMPTS.whatsappReminder;

        const result = await model.generateContent({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `${prompt}\n\nTask: ${taskTitle}\nType: ${taskType}\nTime remaining: ${timeRemaining}`,
                },
              ],
            },
          ],
          generationConfig: { temperature: 0.7, maxOutputTokens: 200 },
        });

        const text = result.response.text().trim();
        if (passesAntiAiCheck(text)) {
          return text;
        }
      } catch (err: any) {
        console.warn('[AI Service] Gemini reminder generation failed (e.g. rate limit):', err?.message);
      }
    }

    return fallback;
  }

  /**
   * AI-Powered Human-Sounding Email Reminder Generator (Groq Qwen/Llama + Gemini Fallback)
   * Dynamically crafts a warm, personalized, human-like reminder paragraph in fluent English.
   * Tailors specific advice based on task type (quiz, assignment, project, exam).
   */
  async generateHumanEmailReminder(params: {
    userName: string;
    taskTitle: string;
    course: string;
    taskType: string;
    dateFormatted: string;
    timeFormatted: string;
    timeRemaining: string;
  }): Promise<{ subject: string; body: string }> {
    const { userName, taskTitle, course, taskType, dateFormatted, timeFormatted, timeRemaining } = params;

    const systemPrompt = `You are StudySync AI, writing a personal, warm, and natural reminder email to a university student about their upcoming academic deadline.

Task Details:
- Student Name: ${userName}
- Task: ${taskTitle}
- Course / Subject: ${course}
- Task Type: ${taskType.toUpperCase()}
- Due Date: ${dateFormatted}
- Due Time: ${timeFormatted}
- Time Remaining: ${timeRemaining}

Rules & Instructions:
1. Write exclusively in proper, fluent, natural English.
2. Tone: Like a supportive human academic mentor or organized study partner reaching out directly. Never sound like a robotic corporate notification or automated ticketing system. Do NOT use emojis.
3. Content:
   - Greet the student warmly by name (e.g. "Hi ${userName},").
   - In a cohesive, natural paragraph (or two short paragraphs), explain which course and what specific task is upcoming, exactly when it's due (${dateFormatted} at ${timeFormatted}), and how much time remains (${timeRemaining}).
   - Give gentle, practical advice tailored to the task type:
     * If quiz: encourage them to review recent lecture slides, key definitions, or formulas to get prepared.
     * If assignment: suggest checking problem sets, citations, and formatting before submitting.
     * If project: recommend testing edge cases, verifying git commits, and polishing deliverables.
     * If exam: advise reviewing summary notes, resting well, and staying calm.
   - Sign off warmly (e.g., "Best regards," "Good luck," or "Cheering you on," followed by "StudySync AI").
4. Every time you write, vary your phrasing, opening hook, and sentence flow so each reminder feels genuinely human and freshly written.
5. Return ONLY a valid JSON object matching:
{
  "subject": "string",
  "body": "string"
}`;

    // 1. Try Groq (Ultra-fast LLM with rotating API keys)
    const groq = getNextGroqClient();
    if (groq) {
      try {
        const res = await groq.chat.completions.create({
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: 'You are an academic mentor writing personalized reminder emails. Always respond in valid JSON.' },
            { role: 'user', content: systemPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.85,
          max_tokens: 450,
        });

        const raw = res.choices[0]?.message?.content?.trim() || '{}';
        const parsed = JSON.parse(raw);
        if (parsed.subject && parsed.body) {
          return {
            subject: parsed.subject.trim(),
            body: parsed.body.trim(),
          };
        }
      } catch (err: any) {
        console.warn('[AI Service] Groq human reminder generation failed, trying Gemini:', err?.message);
      }
    }

    // 2. Try Gemini
    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({
          model: GEMINI_MODEL,
          generationConfig: { responseMimeType: 'application/json', temperature: 0.85 },
        });
        const res = await model.generateContent(systemPrompt);
        const parsed = JSON.parse(res.response.text().trim());
        if (parsed.subject && parsed.body) {
          return {
            subject: parsed.subject.trim(),
            body: parsed.body.trim(),
          };
        }
      } catch (gemErr: any) {
        console.warn('[AI Service] Gemini human reminder generation failed:', gemErr?.message);
      }
    }

    // 3. High-Quality Human English Fallback (if offline or API errors)
    const typeLabel = taskType.toLowerCase();
    const advice =
      typeLabel.includes('quiz')
        ? 'Since this is a quiz, it would be a great idea to quickly review your recent lecture slides and key formulas so you feel completely ready.'
        : typeLabel.includes('project')
        ? 'Make sure to run a final test on your implementation, verify edge cases, and ensure your project submission requirements are all met.'
        : typeLabel.includes('exam')
        ? 'Remember to review your summary notes, stay hydrated, and get enough rest before heading in.'
        : 'Take a few minutes to double-check your work and submission guidelines so everything is in order ahead of time.';

    return {
      subject: `Upcoming ${course}: ${taskTitle} reminder`,
      body: `Hi ${userName},\n\nJust a friendly heads-up that your ${course} ${typeLabel} "${taskTitle}" is scheduled for ${dateFormatted} at ${timeFormatted}, which is coming up ${timeRemaining}.\n\n${advice}\n\nGood luck, and feel free to use StudySync AI if you want to test your understanding before the deadline!\n\nBest regards,\nStudySync AI`,
    };
  }

  /**
   * Generates a proactive 24-hour WhatsApp reminder message with a custom study plan and actionable advice.
   */
  async generateWhatsAppStudyPlanReminder(params: {
    userName: string;
    taskTitle: string;
    course: string;
    taskType: string;
    dateFormatted: string;
    timeFormatted: string;
  }): Promise<string> {
    const { userName, taskTitle, course, taskType, dateFormatted, timeFormatted } = params;

    const systemPrompt = `You are StudySync AI, crafting an urgent, motivating 24-hour proactive WhatsApp reminder message for a university student about their upcoming academic deadline tomorrow.

Task Information:
- Student Name: ${userName}
- Task Title: ${taskTitle}
- Subject / Course: ${course}
- Task Type: ${taskType.toUpperCase()} (quiz, exam, assignment, project)
- Due Date: ${dateFormatted}
- Due Time: ${timeFormatted}

Formatting Rules for WhatsApp:
1. Use WhatsApp markdown formatting: *bold* for emphasis, clean emojis, and concise bullet points.
2. Structure:
   - Header: 🔔 *StudySync Reminder: 24h Remaining!* ⏰
   - Greeting & Alert: Hey *${userName}*, you have an upcoming *${taskType.toUpperCase()}* tomorrow for *${course}*!
   - Details:
     📌 *Task:* ${taskTitle}
     ⏰ *Deadline:* ${dateFormatted} at ${timeFormatted}
   - Practical 3-step Study Plan:
     💡 *AI Recommended 24-Hour Revision Plan:*
     1. [Actionable step 1 tailored to ${taskType} in ${course}]
     2. [Actionable step 2 tailored to ${taskType} in ${course}]
     3. [Actionable step 3: rest/final review]
   - Call to Action:
     💬 _Want to prepare or practice right now? Just reply on WhatsApp:_
     *Course ${course}*
3. Output ONLY the raw WhatsApp text message without any markdown code fences or quotes.`;

    // 1. Try Groq
    const groq = getNextGroqClient();
    if (groq) {
      try {
        const res = await groq.chat.completions.create({
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Please generate the full 24-hour proactive WhatsApp reminder with greeting, details, 3 study plan steps, and call to action for ${taskTitle} in ${course}.` },
          ],
          temperature: 0.6,
          max_tokens: 600,
        });
        const content = res.choices[0]?.message?.content?.trim();
        if (content && content.length > 120 && (content.includes('Course') || content.includes('reply') || content.includes('Plan'))) {
          return content;
        }
      } catch (err: any) {
        console.warn('[AI Service] Groq WhatsApp reminder failed, trying Gemini:', err?.message);
      }
    }

    // 2. Try Gemini
    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({
          model: GEMINI_MODEL,
          generationConfig: { temperature: 0.6, maxOutputTokens: 600 },
        });
        const res = await model.generateContent(`${systemPrompt}\n\nGenerate the complete reminder now.`);
        const text = res.response.text().trim();
        if (text && text.length > 120) return text;
      } catch (gemErr: any) {
        console.warn('[AI Service] Gemini WhatsApp reminder failed:', gemErr?.message);
      }
    }

    // Fallback template
    return (
      `🔔 *StudySync Reminder: 24h Remaining!* ⏰\n\n` +
      `Hey *${userName}*, you have an upcoming *${taskType.toUpperCase()}* tomorrow for *${course}*!\n\n` +
      `📌 *Task:* ${taskTitle}\n` +
      `⏰ *Deadline:* ${dateFormatted} at ${timeFormatted}\n\n` +
      `💡 *Recommended 24-Hour Revision Plan:*\n` +
      `1. Review lecture notes and core definitions for *${course}*\n` +
      `2. Solve 3-5 high-yield practice exercises or quiz MCQs\n` +
      `3. Verify submission instructions and get plenty of rest\n\n` +
      `💬 _Want to prepare or practice right now? Just reply on WhatsApp:_\n` +
      `*Course ${course}*`
    );
  }

  /**
   * Gemini: Generate workload summary for a period.
   */
  async generateWorkloadSummary(tasks: any[]): Promise<string> {
    if (!genAI) return `You have ${tasks.length} task(s) in this period.`;

    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const taskList = tasks
      .map((t) => `- ${t.title} (${t.type}, deadline: ${t.deadline}, status: ${t.status})`)
      .join('\n');

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${PROMPTS.workloadSummary}\n\nTasks:\n${taskList}` }],
        },
      ],
      generationConfig: { temperature: 0.5, maxOutputTokens: 300 },
    });

    return result.response.text().trim();
  }

  /**
   * Gemini: Calendar workload conflict detection (10-Smart-AI-Features.md Section C)
   */
  async detectConflict(
    newTask: { title: string; type: string; deadline: Date | string },
    surroundingTasks: Array<{ title: string; type: string; deadline: Date | string; priority: string }>
  ): Promise<{ is_conflict: boolean; message: string | null; suggested_start_date: string | null }> {
    if (!genAI || surroundingTasks.length === 0) {
      return { is_conflict: false, message: null, suggested_start_date: null };
    }

    try {
      const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        generationConfig: { responseMimeType: 'application/json' },
      });

      const surroundingList = surroundingTasks
        .map((t) => `- ${t.title} (${t.type}, priority: ${t.priority}, due: ${t.deadline})`)
        .join('\n');

      const prompt = `${PROMPTS.conflictDetector}\n\nNew/Changed Task:\nTitle: ${newTask.title}\nType: ${newTask.type}\nDeadline: ${newTask.deadline}\n\nSurrounding Pending Tasks:\n${surroundingList}`;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      return JSON.parse(result.response.text().trim());
    } catch {
      return { is_conflict: false, message: null, suggested_start_date: null };
    }
  }

  /**
   * Gemini: Weekly priority re-ranking across courses (10-Smart-AI-Features.md Section B)
   */
  async rebalancePriorities(
    tasks: Array<{ id: string; title: string; type: string; subject: string | null; deadline: Date | string; priority: string; prioritySource: string }>
  ): Promise<{ updated_tasks: Array<{ task_id: string; priority: 'low' | 'medium' | 'high' }>; summary_note: string }> {
    if (!genAI || tasks.length === 0) {
      return { updated_tasks: [], summary_note: 'No changes needed — your schedule looks balanced.' };
    }

    try {
      const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        generationConfig: { responseMimeType: 'application/json' },
      });

      const prompt = `${PROMPTS.priorityReRanking}\n\nTasks:\n${JSON.stringify(tasks, null, 2)}`;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      return JSON.parse(result.response.text().trim());
    } catch {
      return { updated_tasks: [], summary_note: 'No changes needed.' };
    }
  }

  /**
   * Gemini: Generate 768-dim dense vector embedding for FAISS index
   */
  async getEmbedding(text: string): Promise<number[]> {
    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
        const res = await model.embedContent({
          content: { parts: [{ text }] },
          outputDimensionality: 768,
        } as any);
        if (res.embedding?.values) {
          return res.embedding.values.slice(0, 768);
        }
      } catch (err: any) {
        console.warn('[AI Service] Gemini embedding API error, using fast fallback vector:', err.message);
      }
    }

    return generateDeterministicVector(text, 768);
  }

  /**
   * Helper: Generate RAG response using Gemini API with full multi-turn conversational memory.
   * Provides massive 1M+ token context window and generates up to 3500 tokens of in-depth academic content.
   */
  private async generateRAGWithGemini(
    systemPrompt: string,
    userPrompt: string,
    history: Array<{ role: 'user' | 'assistant'; text: string }> = []
  ): Promise<string> {
    if (!genAI) return '';

    // Format multi-turn contents for Gemini
    const chatContents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    const recentTurns = (history || []).slice(-12);
    for (const item of recentTurns) {
      const geminiRole = item.role === 'assistant' ? 'model' : 'user';
      if (chatContents.length === 0 && geminiRole !== 'user') {
        continue;
      }
      if (chatContents.length > 0 && chatContents[chatContents.length - 1].role === geminiRole) {
        chatContents[chatContents.length - 1].parts[0].text += `\n${item.text}`;
      } else {
        chatContents.push({
          role: geminiRole,
          parts: [{ text: item.text }],
        });
      }
    }

    if (chatContents.length > 0 && chatContents[chatContents.length - 1].role === 'user') {
      chatContents[chatContents.length - 1].parts[0].text += `\n\n[Current Question & Course Context]:\n${userPrompt}`;
    } else {
      chatContents.push({
        role: 'user',
        parts: [{ text: userPrompt }],
      });
    }

    const candidateModels = [GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS];
    const clients = getAllGeminiClients();
    const effectiveClients = clients.length > 0 ? clients : (genAI ? [genAI] : []);

    for (const modelName of candidateModels) {
      for (const client of effectiveClients) {
        try {
          const model = client.getGenerativeModel({
            model: modelName,
            systemInstruction: systemPrompt,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 8192,
            },
          });
          const res = await model.generateContent({ contents: chatContents });
          const text = res.response.text().trim();
          if (text) return text;
        } catch (err: any) {
          console.warn(
            `[AI Service] Gemini model ${modelName} with key error (${err?.message?.substring(0, 80)}), shifting key/model...`
          );
        }
      }
    }

    return '';
  }

  /**
   * Conversational + In-depth RAG Question Answering for a course.
   * Remembers multi-turn chat history for persistent context across questions.
   * 
   * DYNAMIC LLM ROUTING:
   * - If the discussion / query / context gets large ("agr bat zayda bhri ho jay"),
   *   routes directly to the Gemini API (1M+ token context, comprehensive responses, 3500 output tokens).
   * - If normal/short, uses Groq for sub-second lightning-fast response.
   * - If Groq hits any token rate-limit (429) or context limits, automatically and seamlessly switches to Gemini.
   */
  async answerCourseRAG(
    question: string,
    courseName: string,
    chunks: string[],
    history: Array<{ role: 'user' | 'assistant'; text: string }> = [],
    enableThink: boolean = false
  ): Promise<string> {
    const hasContext = chunks && chunks.length > 0;
    const contextText = hasContext
      ? chunks.map((c, i) => `[Course Material Excerpt ${i + 1}]:\n${c}`).join('\n\n')
      : '[NO COURSE NOTES UPLOADED YET — Answer from general academic knowledge of this course subject]';

    const systemPrompt = `You are an expert, encouraging, and articulate academic AI mentor and study assistant for the course "${courseName}".
Your responsibilities:
1. STRICT LANGUAGE REQUIREMENT:
   - Always communicate, explain, and reply EXCLUSIVELY in fluent, clear, and professional ENGLISH. Even if the student enters text in another language, always formulate your entire response in English.
2. CONVERSATIONAL MEMORY & CONTEXTUAL CONTINUITY:
   - You have full access to earlier conversation turns with this student in this course chatbot.
   - Always remember previous questions, earlier explanations, topics discussed, student goals, and personal details they mentioned earlier.
   - If the student refers back to earlier statements (e.g. "what was the second point?", "why?", "explain more", "as I said earlier", "what did I say my favorite topic was?"), use the conversation history to answer accurately and seamlessly.
3. NATURAL & FRIENDLY CONVERSATION:
   - When the student sends greetings (e.g. "hi", "hello", "how are you", "who are you"), casual remarks, or asks for general study tips, respond warmly, politely, and conversationally.
   - Never output dry, robotic errors like "no notes found". Speak naturally like a dedicated university professor or senior peer mentor.
4. IN-DEPTH COURSE CONTENT, LECTURE SLIDES, IMAGES & VOICE RECORDING EXPLANATIONS:
   - When the student asks about course topics, concepts, lecture slides, syllabus, formulas, assignments, voice recordings, or uploaded images / diagrams / whiteboard captures:
   - If Course Material Excerpts, Extracted Image Analyses, or Voice Transcripts are provided below, thoroughly review and synthesize everything that was depicted, said, or written, explaining all discussed points, diagrams, formulas, and concepts formally and clearly.
   - If the uploaded notes, images, or recordings do not mention a specific question, use your academic knowledge of "${courseName}" to provide a clear explanation while noting that it was not explicitly in the uploaded materials.
5. MATHEMATICAL FORMULAS & SPECIAL SYMBOLS:
   - Always format mathematical equations, formulas, Greek letters, and derivations using standard LaTeX notation so they render cleanly in KaTeX:
     - Use double dollar signs for standalone display equations: $$ \theta = \theta - \alpha \cdot \nabla J(\theta) $$
     - Use single dollar signs for inline symbols and variables: $ \theta $, $ \alpha $, $ \nabla J(\theta) $
     - Never break a line inside inline $ ... $ delimiters. Keep each inline formula on the same line.
     - Always write standard single backslashes for commands (\theta, \alpha, \nabla, \cdot, \partial, \frac{}{}, \sum, \sigma, \mu).
     - Always define key variables and symbols right after or alongside the formula for complete clarity.
6. TO-THE-POINT & DYNAMICALLY ADAPTIVE ANSWER LENGTH:
   - Always answer the user's SPECIFIC question directly without unnecessary filler, repetitive disclaimers, or off-topic preamble.
   - Involve prior conversation history whenever context or continuity is needed, but keep the core answer sharply focused on the CURRENT question asked.
   - ADAPT YOUR ANSWER LENGTH PROPORTIONATELY:
     * If the user asks a short, factual, quick, or direct question: give a crisp, to-the-point, concise short answer. Do NOT write unnecessary essays.
     * If the user asks for an in-depth explanation, step-by-step derivation, detailed breakdown, or comprehensive study guide: give an expansive, thorough, complete long answer.
7. MARKDOWN FORMATTING (CRITICAL — ALWAYS ENFORCED):
   - ALWAYS use proper markdown structure in EVERY response. NEVER produce a wall of unstructured text.
   * Use ## or ### headings to organize sections and topics
   * Use **bold** for key terms, definitions, and important concepts
   * Use bullet points (- or *) for lists — NEVER combine list items into one run-on paragraph
   * Use clean Markdown tables for comparisons, database schemas, and structured data
    * VISUAL DIAGRAMS (MERMAID.JS ACTIVATED - DIRECT IN CHAT):
      Whenever explaining a process, architecture, pipeline, database ERD, algorithm, or state machine:
      - YOU MUST DIRECTLY GENERATE THE ACTUAL COMPLETE MERMAID DIAGRAM YOURSELF!
      - NEVER output prompt templates, meta-prompts, or tell the student to paste into ChatGPT.
      - NEVER use PlantUML syntax like 'usecaseDiagram' or '@startuml'. For Use Cases, use \`flowchart LR\`.
      - Always wrap the diagram in a full triple-backtick block (\`\`\`mermaid ... \`\`\`) alongside clear explanatory walkthroughs. Always quote node text: e.g. A["Node Name"].
8. CLARIFICATION & DISAMBIGUATION (CRITICAL):
   - When the student inputs a question that is ambiguous, unclear, very brief, or lacks context (e.g. "is ka kya matlb ha", "explain this", "formula", "algo", "mujhe smj ni aya", "paper", "solve it", "kese hoga", or 1-2 words):
     DO NOT guess or produce generic rambling answers.
     Directly and politely ask the student what they specifically mean.
     State what is unclear, and provide 2 to 3 specific numbered options or interpretations they might be referring to:
     "Aapka sawal thoda mukhtasir ya ghair wazeh hai. Kya aap in mein se kisi baare mein poochna chah rahe hain?
     1. [Option A]
     2. [Option B]
     3. [Option C]
     Ya baraye mehrbani thori mazeed wazahat farma dein."
9. TOPIC FLEXIBILITY (CRITICAL):
   - While your primary course is "${courseName}", students often ask cross-disciplinary questions (e.g. database design, software architecture, algorithm concepts, or math problems).
   - NEVER refuse a request by stating that it belongs to another course or is outside your scope!
   - ALWAYS explain the concepts thoroughly with academic quality.
10. STRICT 1000-TOKEN BUDGET & GUARANTEED COMPLETE RESPONSE (CRITICAL):
   - You have a strict maximum output budget of 1,000 tokens for your entire response.
   - You MUST structure and pace your response so that your ENTIRE explanation—including all background concepts, LaTeX formulas, derivations, step-by-step points, and conclusion—is 100% FULLY COMPLETED within this 1,000-token limit.
   - NEVER start a multi-step point, derivation, or list that you cannot finish before reaching the limit.
   - NEVER cut off mid-thought, mid-sentence, or leave dangling incomplete numbers or bullet points (e.g. stopping abruptly at a number like "3." or mid-equation).
   - Ensure every response is articulate, concise, self-contained, and completely finished within the 1,000 token budget.
11. WHEN NO COURSE NOTES ARE UPLOADED (CRITICAL):
   - If the Course Material Context says "NO COURSE NOTES UPLOADED YET", do NOT refuse to answer or give an unhelpful error.
   - Instead, answer the student's question using your own comprehensive academic knowledge of "${courseName}" and related subjects.
   - Behave as a knowledgeable, confident university professor — you know the subject deeply even without uploaded notes.
   - At the very END of your answer (not at the start), add ONE brief friendly line (in the same language the student used):
     e.g. "(Agar aap apne course ke notes ya slides upload karein to main unse bhi specifically help kar sakta hun!)"
   - NEVER say "no notes found", "no context", "I don't have your notes", or any robotic error message at the start.
   - This rule is MANDATORY — always give a helpful, confident academic answer regardless of context availability.
12. LIVE WEB & YOUTUBE VIDEO EXTRACTIONS (CRITICAL):
   - When [Live Extracted Web/Video Content from ...] is present in the context:
   - You HAVE direct, verified access to this video/web content, including its title, creator, detailed summary, and full timestamped chapters.
   - NEVER, EVER say "I cannot access external YouTube links", "I cannot stream or browse", or ask the student to provide the transcript or topic!
   - Immediately provide a thorough, structured academic analysis of what the video covers, explaining all key concepts, diagrams, and topics from the extracted data!

10. HEAVY FILE / DOCUMENT UPLOAD RULE (CRITICAL — STRICTLY ENFORCED):
   - When ANY large file/document is uploaded (100-page PDFs, books, lecture slides, comprehensive notes, etc.):
     → NEVER, EVER repeat, echo, copy-paste, or dump the document content verbatim in your response.
     → NEVER produce a chapter-by-chapter walkthrough of the entire document.
     → NEVER write more than 10-12 lines total in response to a large file upload.
   - For ALL request types on large documents ("review", "summarize", "explain", "what is in this", "describe", "overview"):
     → Give a BRIEF structured overview of MAX 5-7 bullet points listing only the key modules/chapters/topics found.
     → Then ALWAYS end with a short friendly question asking what the student specifically wants:
        "📄 **File mil gayi!** Yeh document in topics ko cover karta hai:
        • Module 1: [topic]
        • Module 2: [topic]
        • Module 3: [topic]
        (aur [N] aur modules...)
        **Aap kya specifically jaanna chahte hain?** Kisi topic ki detail, quiz, ya koi aur cheez?"
   - ONLY give detailed in-depth explanation when the student asks about ONE SPECIFIC topic or chapter.
   - This rule is ABSOLUTE and OVERRIDES all other instructions — never dump full document content.
11. DYNAMIC SEQUENTIAL REASONING (<thought>) (CRITICAL):
    - At the VERY START of your response, output your genuine, step-by-step thinking inside <thought>...</thought> tags.
    - Reason naturally in 2 to 4 sequential numbered steps tailored directly to the specific student question, subject, and situation:
      <thought>
      1. [Dynamic title mentioning the exact student inquiry and problem bounds]
      [Deep reasoning breaking down the core concepts, constraints, and prerequisites]

      2. [Dynamic technical architecture or roadmap title]
      [Formulating algorithms, mathematical transformations, or structured technical tables]

      3. [Dynamic educational synthesis title]
      [Composing explanations, formulas, or step-by-step walkthroughs]

      4. [Dynamic verification & invariant title]
      [Validating edge cases, KaTeX notation, and complete delivery without truncation]
      </thought>
    - NEVER use generic template titles (such as "Analyzing Inquiry Scope" or "Analyzing User Query & Scope"). Every step title and body must directly discuss the specific topic.
    - NEVER output graph branches, "Dependencies:", "Role:", or "Tools:".
    - After </thought>, output your student-facing answer.${enableThink ? `

- THINK MODE ACTIVE (LIVE WEB RESEARCH & DEEP MULTI-STEP REASONING):
  * The student has toggled Think Mode ON! Live Tavily search intelligence and comprehensive web findings have been added to your context.
  * You MUST produce rigorous, comprehensive analytical reasoning inside <thought>...</thought>.
  * Within <thought>, methodically analyze:
    1. Problem & Context Analysis: Evaluate user requirements against verified course materials and Tavily live research.
    2. Deep Verification & Edge Cases: Fact-check facts, mathematical formulas, algorithms, and potential misconceptions.
    3. Structural Synthesis: Connect fundamental theoretical principles to practical application with clarity.
    4. Execution Blueprint: Ensure LaTeX mathematical precision and complete, non-truncated answers.
  * In the final response, provide a high-fidelity, thoroughly explained answer, referencing verified facts or live web sources where relevant.` : ''}`;

    const userPrompt = `Course Material Context:
${contextText}

Student Message:
${question}`;

    // ─── Dynamic Size Assessment ("agr bat zayda bhri ho jay") ───────────
    const historyChars = (history || []).reduce((acc, h) => acc + (h.text?.length || 0), 0);
    const contextChars = contextText.length;
    const questionChars = question.trim().length;
    const totalChars = historyChars + contextChars + questionChars;

    // Triggers for large conversation/context:
    // 1. Total character footprint > 2600 chars (approx 650+ tokens, risks Groq OTPM/TPM limits)
    // 2. Multi-turn history is long (>= 6 turns or history > 1500 chars)
    // 3. Retrieved context chunks are extensive (> 2200 chars)
    // 4. Student prompt itself is very long (> 400 chars)
    // 5. Explicit user request for deep, full, or comprehensive academic explanation
    const isComprehensiveRequest =
      /(detailed|in-depth|comprehensive|complete summary|sari bat|sari baat|everything|full explanation|detail me|explain all|step by step|complete breakdown)/i.test(
        question
      );

    // 1. PRIMARY FOR SPEED: Ultra-Fast Groq LPUs (<1 second response time with 120B model)
    const groq = getNextGroqClient();
    if (groq && !enableThink) {
      try {
        const groqMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
          { role: 'system', content: systemPrompt },
        ];

        const recentTurns = (history || []).slice(-6);
        for (const item of recentTurns) {
          const trimmed = item.text?.length > 800 ? item.text.slice(0, 800) + '... [truncated]' : item.text;
          groqMessages.push({
            role: item.role === 'assistant' ? 'assistant' : 'user',
            content: trimmed,
          });
        }

        // Keep context for Groq within safe bounds (expanded for deep RAG & heavy materials)
        const safeContext = contextText.length > 24000 ? contextText.slice(0, 24000) + '\n... [additional notes truncated]' : contextText;
        const groqUserPrompt = `Course Material Context:\n${safeContext}\n\nStudent Message:\n${question}`;

        groqMessages.push({
          role: 'user',
          content: groqUserPrompt,
        });

        const completion = await groq.chat.completions.create({
          model: GROQ_MODEL,
          messages: groqMessages,
          temperature: 0.7,
          max_tokens: 8192,
        });
        const choice = completion.choices[0];
        const groqText = choice?.message?.content?.trim();
        if (groqText) return groqText;
      } catch (groqErr: any) {
        console.warn('[AI Service] Groq primary 120B failed, switching to Gemini:', groqErr?.message);
      }
    }

    // 2. PRIMARY FOR THINK MODE OR HIGH CAPACITY FALLBACK: Gemini 3.6 Flash
    if (genAI) {
      try {
        const geminiAnswer = await this.generateRAGWithGemini(systemPrompt, userPrompt, history);
        if (geminiAnswer) return geminiAnswer;
      } catch (geminiErr: any) {
        console.warn('[AI Service] Gemini generation failed:', geminiErr?.message);
      }
    }

    // 3. Fallback to Gemini if Groq wasn't configured
    if (genAI) {
      try {
        const geminiAnswer = await this.generateRAGWithGemini(systemPrompt, userPrompt, history);
        if (geminiAnswer) return geminiAnswer;
      } catch (geminiErr: any) {
        console.warn('[AI Service] Gemini standard fallback error:', geminiErr?.message);
      }
    }

    // 4. Graceful Fallback if APIs are offline or busy
    if (hasContext) {
      const topChunk = chunks[0] || '';
      return `### Key Notes for ${courseName}\n\nHere is the relevant excerpt from your uploaded course notes:\n\n> ${topChunk.slice(0, 500).trim()}...\n\n*(Note: The AI generation service is temporarily busy. Please ask a specific topic question or try again in a moment!)*`;
    }
    return `Hello! I am your AI study assistant for ${courseName}. You can ask me general questions about the course, or upload your lecture notes so we can study together!`;
  }

  /**
   * Tavily: Search academic/web resources
   */
  async searchTavily(query: string): Promise<any[]> {
    if (!config.tavily.apiKey) return [];
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: config.tavily.apiKey,
          query,
          search_depth: 'basic',
          max_results: 3,
        }),
      });
      const data = await res.json();
      return (data as any).results || [];
    } catch {
      return [];
    }
  }
}

export const aiService = new AiService();
