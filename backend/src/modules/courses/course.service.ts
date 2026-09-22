import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import prisma from '../../config/database';
import { faissStore, VectorItem } from '../vector/vector.service';
import { aiService } from '../ai/ai.service';
import { agentService, extractThoughtAndCleanAnswer } from '../ai/agent.service';
import { webTools } from '../ai/tools/web.tools';
import { scheduleTaskReminders } from '../notifications/notification.queue';
import { deeplyCalculateAcademicDeadline } from '../../utils/systemDateTime';
import { cleanMojibake, repairChunkMathDelimiters } from '../../utils/textSanitizer';

const baseDir = process.env.VERCEL ? '/tmp' : process.cwd();
const CHAT_HISTORIES_DIR = path.resolve(baseDir, 'chat_histories');
const ROOT_CHAT_HISTORIES_DIR = path.resolve(baseDir, 'root_chat_histories');
const LEGACY_CHAT_HISTORY_FILE = path.resolve(baseDir, 'course_chat_histories.json');

export interface CreateCourseInput {
  name: string;
  colorTag?: string;
}

export interface IngestMaterialInput {
  courseId: string;
  title: string;
  content: string;
  sourceType?: 'text' | 'document' | 'voice' | 'image' | 'slides' | 'spreadsheet';
}

export interface ChatMessage {
  id: string;
  courseId: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  sources?: Array<{ text: string; score: number; filename?: string }>;
  imageUrl?: string;
  imageUrls?: string[];
  attachedFile?: { name: string; type: string };
  attachedFiles?: Array<{ name: string; type: string }>;
  widgets?: any[];
  toolCalls?: any[];
  thought?: string;
}

class CourseService {
  private chatHistories: Map<string, ChatMessage[]> = new Map();

  constructor() {
    this.loadHistoriesFromDisk();
  }

  public getCourseHistoryPath(courseId: string): string {
    return path.join(CHAT_HISTORIES_DIR, `course_${courseId}.json`);
  }

  private sanitizeMessageHistory(msgs: ChatMessage[]): ChatMessage[] {
    return msgs.map((msg) => ({
      ...msg,
      text: cleanMojibake(msg.text || ''),
      sources: msg.sources?.map((s) => ({
        ...s,
        text: repairChunkMathDelimiters(s.text || ''),
        filename: cleanMojibake(s.filename || ''),
      })),
    }));
  }

  private loadHistoriesFromDisk(): void {
    try {
      if (!fs.existsSync(CHAT_HISTORIES_DIR)) {
        try { fs.mkdirSync(CHAT_HISTORIES_DIR, { recursive: true }); } catch {}
      }

      // 1. Read all independent course history files from chat_histories/
      const files = fs.readdirSync(CHAT_HISTORIES_DIR);
      for (const file of files) {
        if (file.startsWith('course_') && file.endsWith('.json')) {
          const courseId = file.replace(/^course_/, '').replace(/\.json$/, '');
          const filePath = path.join(CHAT_HISTORIES_DIR, file);
          try {
            const raw = fs.readFileSync(filePath, 'utf-8');
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              this.chatHistories.set(courseId, this.sanitizeMessageHistory(parsed as ChatMessage[]));
            }
          } catch (e) {
            console.error(`[CourseService] Error reading independent history ${file}:`, e);
          }
        }
      }

      // 2. Migration & Fallback: If legacy course_chat_histories.json exists, load any courses not yet in chat_histories/
      if (fs.existsSync(LEGACY_CHAT_HISTORY_FILE)) {
        try {
          const raw = fs.readFileSync(LEGACY_CHAT_HISTORY_FILE, 'utf-8');
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            for (const [courseId, msgs] of Object.entries(parsed)) {
              if (Array.isArray(msgs)) {
                // If not yet loaded from independent file, or independent file was empty
                if (!this.chatHistories.has(courseId) || this.chatHistories.get(courseId)!.length === 0) {
                  const sanitized = this.sanitizeMessageHistory(msgs as ChatMessage[]);
                  this.chatHistories.set(courseId, sanitized);
                  // Immediately write independent history file for this course!
                  this.saveCourseHistoryToDisk(courseId, sanitized);
                }
              }
            }
          }
        } catch (e) {
          console.error('[CourseService] Error migrating legacy course_chat_histories.json:', e);
        }
      }

      console.log(`[CourseService] ✅ Loaded independent chat histories for ${this.chatHistories.size} courses.`);
    } catch (err) {
      console.error('[CourseService] Error initializing chat histories:', err);
    }
  }

  /**
   * Save a single course's independent chat history to its dedicated file
   */
  public saveCourseHistoryToDisk(courseId: string, messages?: ChatMessage[]): void {
    try {
      if (!fs.existsSync(CHAT_HISTORIES_DIR)) {
        try { fs.mkdirSync(CHAT_HISTORIES_DIR, { recursive: true }); } catch {}
      }

      const msgs = messages || this.chatHistories.get(courseId) || [];
      this.chatHistories.set(courseId, msgs);

      const filePath = this.getCourseHistoryPath(courseId);
      fs.writeFileSync(filePath, JSON.stringify(msgs, null, 2), 'utf-8');

      // Also mirror to root chat_histories/ if root exists
      try {
        if (!fs.existsSync(ROOT_CHAT_HISTORIES_DIR)) {
          fs.mkdirSync(ROOT_CHAT_HISTORIES_DIR, { recursive: true });
        }
        const rootFilePath = path.join(ROOT_CHAT_HISTORIES_DIR, `course_${courseId}.json`);
        fs.writeFileSync(rootFilePath, JSON.stringify(msgs, null, 2), 'utf-8');
      } catch {}

      // Keep legacy course_chat_histories.json updated for backward compatibility
      this.syncLegacyHistoryFile();
    } catch (err) {
      console.error(`[CourseService] Error saving independent history for course ${courseId}:`, err);
    }
  }

  private syncLegacyHistoryFile(): void {
    try {
      const obj: Record<string, ChatMessage[]> = {};
      for (const [cId, msgs] of this.chatHistories.entries()) {
        obj[cId] = msgs;
      }
      fs.writeFileSync(LEGACY_CHAT_HISTORY_FILE, JSON.stringify(obj, null, 2), 'utf-8');
      const rootPath = path.resolve(process.cwd(), '../course_chat_histories.json');
      const backendPath = path.resolve(process.cwd(), 'backend/course_chat_histories.json');
      if (fs.existsSync(path.dirname(rootPath))) {
        try { fs.writeFileSync(rootPath, JSON.stringify(obj, null, 2), 'utf-8'); } catch {}
      }
      if (fs.existsSync(path.dirname(backendPath))) {
        try { fs.writeFileSync(backendPath, JSON.stringify(obj, null, 2), 'utf-8'); } catch {}
      }
    } catch {}
  }

  public saveHistoriesToDisk(): void {
    for (const courseId of this.chatHistories.keys()) {
      this.saveCourseHistoryToDisk(courseId);
    }
  }

  /**
   * List all courses for user with metadata
   */
  async getCourses(userId: string) {
    let courses = await prisma.course.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { tasks: true } },
      },
    });

    const allTasks = await prisma.task.findMany({
      where: { userId },
    });

    return courses.map((c: any) => {
      const cTasks = allTasks.filter(
        (t: any) =>
          t.courseId === c.id ||
          (t.subject && c.name && t.subject.toLowerCase().includes(c.name.toLowerCase())) ||
          (t.subject && c.name && c.name.toLowerCase().includes(t.subject.toLowerCase()))
      );
      const pendingCount = cTasks.filter((t: any) => t.status === 'pending').length;
      const completedCount = cTasks.filter((t: any) => t.status === 'done').length;

      return {
        ...c,
        chunksCount: faissStore.getItemsByCourse(c.id).length,
        messageCount: (this.chatHistories.get(c.id) || []).length,
        totalTasks: cTasks.length,
        pendingTasksCount: pendingCount,
        completedTasksCount: completedCount,
      };
    });
  }

  /**
   * Get a single course ensuring it belongs to the user
   */
  async getCourseById(userId: string, courseId: string) {
    return prisma.course.findFirst({
      where: { id: courseId, userId },
    });
  }

  /**
   * Get all pending and completed tasks for a course
   */
  async getCourseTasks(userId: string, courseId: string) {
    const course = await prisma.course.findFirst({
      where: { id: courseId, userId },
    });

    if (!course) {
      throw Object.assign(new Error('Course not found.'), { statusCode: 404 });
    }

    const allTasks = await prisma.task.findMany({
      where: { userId },
      orderBy: { deadline: 'asc' },
    });

    const courseTasks = allTasks.filter(
      (t: any) =>
        t.courseId === course.id ||
        (t.subject && course.name && t.subject.toLowerCase().includes(course.name.toLowerCase())) ||
        (t.subject && course.name && course.name.toLowerCase().includes(t.subject.toLowerCase()))
    );

    const pending = courseTasks.filter((t: any) => t.status === 'pending');
    const completed = courseTasks.filter((t: any) => t.status === 'done');

    return {
      course,
      total: courseTasks.length,
      pending,
      completed,
    };
  }

  /**
   * FAISS Vector Index Information (index.faiss and index.pkl status)
   */
  getFaissInfo() {
    return faissStore.getInfo();
  }

  /**
   * Create a new course
   */
  async createCourse(userId: string, input: CreateCourseInput) {
    const course = await prisma.course.create({
      data: {
        userId,
        name: input.name.trim(),
        colorTag: input.colorTag || '#6366F1',
      },
    });
    return course;
  }

  /**
   * Delete course, associated chat history, workspace files, and FAISS Vector Database embeddings
   */
  async deleteCourse(userId: string, courseId: string) {
    // 1. Delete course chat history and remove independent history file
    this.chatHistories.delete(courseId);
    try {
      const histPath = this.getCourseHistoryPath(courseId);
      if (fs.existsSync(histPath)) fs.unlinkSync(histPath);
      const rootHistPath = path.join(ROOT_CHAT_HISTORIES_DIR, `course_${courseId}.json`);
      if (fs.existsSync(rootHistPath)) fs.unlinkSync(rootHistPath);
      this.syncLegacyHistoryFile();
    } catch {}

    // 2. Delete all vectors & chunks from FAISS Vector Database
    faissStore.deleteCourseVectors(courseId);

    // 3. Delete course workspace storage folder
    const wsDir = path.resolve(process.cwd(), 'backend', 'storage', 'workspaces', courseId.replace(/[^a-zA-Z0-9_-]/g, '_'));
    if (fs.existsSync(wsDir)) {
      try {
        fs.rmSync(wsDir, { recursive: true, force: true });
      } catch {}
    }

    // 4. Delete course from DB
    try {
      await prisma.chatMessage.deleteMany({
        where: { courseId },
      });
    } catch {}
    return prisma.course.delete({
      where: { id: courseId },
    });
  }

  /**
   * Ingest notes/study material: chunks and creates FAISS vector index entries
   */
  async ingestMaterial(userId: string, input: IngestMaterialInput) {
    const course = await prisma.course.findFirst({
      where: { id: input.courseId, userId },
    });

    if (!course) {
      throw Object.assign(new Error('Course not found.'), { statusCode: 404 });
    }

    // Split text into chunks (~350 words per chunk)
    const rawChunks = this.chunkText(input.content, 350);
    const vectorItems: VectorItem[] = [];

    for (let i = 0; i < rawChunks.length; i++) {
      const chunkText = rawChunks[i];
      const vector = await aiService.getEmbedding(chunkText);

      vectorItems.push({
        id: crypto.randomUUID(),
        courseId: course.id,
        text: chunkText,
        vector,
        metadata: {
          filename: input.title,
          sourceType: input.sourceType || 'text',
          createdAt: new Date().toISOString(),
          chunkIndex: i + 1,
        },
      });
    }

    // Index in FAISS store
    faissStore.addBatch(vectorItems);

    return {
      success: true,
      courseName: course.name,
      chunksIndexed: vectorItems.length,
      totalCourseChunks: faissStore.getItemsByCourse(course.id).length,
    };
  }

  /**
   * Get independent chat history for a specific course (scoped to user when provided)
   */
  async getChatHistory(courseId: string, userId?: string): Promise<ChatMessage[]> {
    if (userId) {
      try {
        const dbMsgs = await prisma.chatMessage.findMany({
          where: { courseId, userId },
          orderBy: { createdAt: 'asc' },
        });
        if (dbMsgs && dbMsgs.length > 0) {
          const parsed = dbMsgs.map((m: any) => ({
            id: m.id,
            courseId: m.courseId,
            role: m.role as 'user' | 'assistant' | 'system',
            text: m.text,
            timestamp: m.createdAt instanceof Date ? m.createdAt.toISOString() : (m.createdAt || new Date().toISOString()),
            imageUrl: m.imageUrl || undefined,
            sources: typeof m.sources === 'string' ? JSON.parse(m.sources) : (m.sources || []),
            widgets: typeof m.widgets === 'string' ? JSON.parse(m.widgets) : (m.widgets || undefined),
            toolCalls: typeof m.toolCalls === 'string' ? JSON.parse(m.toolCalls) : (m.toolCalls || undefined),
            thought: m.thought || undefined,
          }));
          const sanitized = this.sanitizeMessageHistory(parsed as ChatMessage[]);
          this.chatHistories.set(courseId, sanitized);
          return sanitized;
        }
        // If student has no messages for this course yet, return empty list (never leak another student's disk history)
        return [];
      } catch (err) {
        console.warn('[CourseService] DB chat history read error:', err);
        return [];
      }
    }

    if (!this.chatHistories.has(courseId) || (this.chatHistories.get(courseId)!.length === 0)) {
      const filePath = this.getCourseHistoryPath(courseId);
      if (fs.existsSync(filePath)) {
        try {
          const raw = fs.readFileSync(filePath, 'utf-8');
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const sanitized = this.sanitizeMessageHistory(parsed as ChatMessage[]);
            this.chatHistories.set(courseId, sanitized);
            return sanitized;
          }
        } catch {}
      }
    }
    return this.chatHistories.get(courseId) || [];
  }

  /**
   * Clear independent chat history for a specific course
   */
  async clearChatHistory(courseId: string, userId?: string): Promise<void> {
    this.chatHistories.set(courseId, []);
    this.saveCourseHistoryToDisk(courseId, []);
    if (userId) {
      try {
        await prisma.chatMessage.deleteMany({
          where: { courseId, userId },
        });
      } catch (err) {
        console.warn('[CourseService] DB chat history clear error:', err);
      }
    }
  }

  /**
   * Add a system/assistant notification message into this course's chat history
   */
  addAssistantSystemMessage(courseId: string, text: string): ChatMessage {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      courseId,
      role: 'assistant',
      text: cleanMojibake(text),
      timestamp: new Date().toISOString(),
      sources: [],
    };
    const list = this.chatHistories.get(courseId) || [];
    list.push(msg);
    this.saveCourseHistoryToDisk(courseId, list);
    return msg;
  }

  /**
   * Automatically detects, extracts, and schedules academic tasks (quizzes, assignments, exams, projects)
   * from student messages, audio recordings, or course notes.
   * Discards tasks that already exist on the student's schedule to prevent duplicates.
   */
  async autoScheduleTasksFromContent(
    userId: string,
    courseId: string,
    content: string
  ): Promise<{
    created: Array<{ id: string; title: string; type: string; deadline: Date }>;
    discarded: Array<{ title: string; reason: string }>;
  }> {
    if (!content || content.trim().length < 5 || !/(quiz|quz|qz|quizz|assignment|asignment|asigmnt|exam|paper|pepar|imtihan|viva|deadline|due|schedule|remind|remainder|rmdr|yaad|yad|parso|prso|tarso|kal|kl|kall|aj|aaj|test|homework|kam|project|submission)/i.test(content)) {
      return { created: [], discarded: [] };
    }

    const course = await prisma.course.findFirst({
      where: { id: courseId, userId },
    });
    if (!course) return { created: [], discarded: [] };

    // 1. Detect tasks from content using AI
    const detected = await aiService.detectAcademicTasks(content, course.name);
    if (!detected || detected.length === 0) {
      return { created: [], discarded: [] };
    }

    // 2. Fetch all existing tasks for this user to check duplicates
    const allUserTasks = await prisma.task.findMany({
      where: { userId },
    });

    const created: Array<{ id: string; title: string; type: string; deadline: Date }> = [];
    const discarded: Array<{ title: string; reason: string }> = [];

    for (const item of detected) {
      const cleanTitle = (item.title || '').trim();
      if (!cleanTitle) continue;

      const itemType = (item.type || 'assignment') as any;
      const targetDeadline = deeplyCalculateAcademicDeadline(
        item.deadline_iso || undefined,
        `${cleanTitle} ${content}`
      );

      // Check if user is asking to change/reschedule an existing task
      const isReschedule =
        /\b(?:change|reschedule|shift|update|badal|badlo|timing)\b/i.test(content) ||
        /\b(?:change|reschedule|shift|update|badal)\b/i.test(cleanTitle);

      const matchingExistingTask = allUserTasks.find((t: any) => {
        if (t.status === 'cancelled') return false;
        const isSameCourse =
          t.courseId === courseId ||
          (t.subject && t.subject.toLowerCase().includes(course.name.toLowerCase())) ||
          (course.name && course.name.toLowerCase().includes(t.subject?.toLowerCase() || ''));
        return isSameCourse && t.type === itemType;
      });

      if (isReschedule && matchingExistingTask) {
        console.log(`[AutoSchedule] Rescheduled existing task "${matchingExistingTask.title}" to ${targetDeadline.toISOString()}`);
        const updatedTask = await prisma.task.update({
          where: { id: matchingExistingTask.id },
          data: { deadline: targetDeadline },
        });
        try {
          await prisma.reminder.deleteMany({
            where: { taskId: matchingExistingTask.id, status: 'pending' },
          });
          await scheduleTaskReminders(updatedTask.id, userId);
        } catch (err) {}
        created.push({
          id: updatedTask.id,
          title: updatedTask.title,
          type: updatedTask.type,
          deadline: targetDeadline,
        });
        continue;
      }

      // Deduplication check:
      // Match if existing task has:
      // - Same title (case-insensitive) OR
      // - Same course/subject AND same type AND within same day deadline OR
      // - Substring match in title for the same course
      const isDuplicate = allUserTasks.some((t: any) => {
        if (t.status === 'cancelled') return false;

        const titleA = (t.title || '').toLowerCase().trim();
        const titleB = cleanTitle.toLowerCase().trim();

        // Exact title match
        if (titleA === titleB) return true;

        const isSameCourse =
          t.courseId === courseId ||
          (t.subject && t.subject.toLowerCase().includes(course.name.toLowerCase())) ||
          (course.name && course.name.toLowerCase().includes(t.subject?.toLowerCase() || ''));

        // Substring title match in same course
        if (isSameCourse && (titleA.includes(titleB) || titleB.includes(titleA))) {
          return true;
        }

        // Same type and same deadline day for this course
        if (isSameCourse && t.type === itemType && t.deadline) {
          const d1 = new Date(t.deadline).toISOString().split('T')[0];
          const d2 = targetDeadline.toISOString().split('T')[0];
          if (d1 === d2) return true;
        }

        return false;
      });

      if (isDuplicate) {
        console.log(`[AutoSchedule] Discarded duplicate task "${cleanTitle}" for course "${course.name}"`);
        discarded.push({ title: cleanTitle, reason: 'Already exists on your schedule' });
        continue;
      }

      // Clean title from conversational noise
      let sanitizedTitle = cleanTitle
        .replace(/^(?:deadline\s+change\s+to|change\s+deadline\s+to|reschedule\s+to)\s+/i, '')
        .replace(/\s+deadline\s+change\s+to\s+.*$/i, '');
      if (!sanitizedTitle) sanitizedTitle = cleanTitle;

      // Create task in database!
      const newTask = await prisma.task.create({
        data: {
          userId,
          title: sanitizedTitle,
          type: itemType,
          subject: course.name,
          courseId: course.id,
          description: item.description || `Auto-scheduled from ${course.name} chatbot / voice notes.`,
          deadline: targetDeadline,
          priority: item.priority || 'medium',
          status: 'pending',
          source: 'voice' as any,
          confirmed: true,
        },
      });

      // Auto-schedule 24-hour and 12-hour email reminders
      try {
        await scheduleTaskReminders(newTask.id, userId);
      } catch {}

      allUserTasks.push(newTask);
      created.push({
        id: newTask.id,
        title: newTask.title,
        type: newTask.type,
        deadline: targetDeadline,
      });

      console.log(`[AutoSchedule] ✅ Auto-scheduled task "${sanitizedTitle}" for "${course.name}" due: ${targetDeadline.toISOString()}`);
    }

    return { created, discarded };
  }

  /**
   * RAG Query: Semantic search on FAISS vector store + Gemini/Groq answer generation + Multi-turn memory
   */
  async queryCourseRAG(
    userId: string,
    courseId: string,
    question: string,
    fileContext?: string,
    fileMetadata?:
      | { filename?: string; mimeType?: string; base64?: string; isImage?: boolean }
      | Array<{ filename?: string; mimeType?: string; base64?: string; isImage?: boolean }>,
    enableThink: boolean = false
  ) {
    const course = await prisma.course.findFirst({
      where: { id: courseId, userId },
    });

    if (!course) {
      throw Object.assign(new Error('Course not found.'), { statusCode: 404 });
    }

    // 1. Generate query vector
    const queryVector = await aiService.getEmbedding(question);

    // 2. Search FAISS index for top relevant chunks for this course
    const matches = faissStore.search(queryVector, courseId, 6);
    const contextChunks = matches.map((m) => m.item.text);

    // If file context was provided with this query (e.g. uploaded image/doc/audio)
    if (fileContext) {
      contextChunks.unshift(fileContext);
    }

    // 0. Detect any URLs in user prompt (especially YouTube video or web documentation)
    const urlMatch = question.match(/\bhttps?:\/\/\S+/i);
    let preloadedVideoWidget: any = null;
    if (urlMatch) {
      try {
        const fetched = await webTools.webFetch(urlMatch[0]);
        if (fetched.success && fetched.text) {
          contextChunks.unshift(`[Live Extracted Web/Video Content from ${urlMatch[0]}]:\n${fetched.text}`);
          if (fetched.videoData) {
            preloadedVideoWidget = {
              type: 'video',
              data: fetched.videoData,
            };
          }
        }
      } catch (err: any) {
        console.warn('[CourseService] Pre-fetch URL error:', err.message);
      }
    }

    // Tavily Web Intelligence & Deep Context Injection if Think mode is activated (skip if URL already extracted)
    const webSources: Array<{ text: string; score: number; filename?: string }> = [];
    if (enableThink && !urlMatch) {
      try {
        console.log(`[CourseService] 🧠 Think Mode active: Running Tavily live research for "${question}"...`);
        const searchRes = await webTools.webSearch(question, 3);
        if (searchRes.success && searchRes.results.length > 0) {
          const webResearchText = `[Tavily Live Web Intelligence & Verified Research for Deep Thinking]:\n` +
            searchRes.results.map((r, i) => `Source ${i + 1}: ${r.title} (${r.url})\nSummary: ${r.snippet}`).join('\n\n');
          contextChunks.unshift(webResearchText);

          for (const r of searchRes.results) {
            webSources.push({
              text: `[Web Search]: ${r.title} — ${r.snippet}`,
              score: r.score || 0.95,
              filename: r.url,
            });
          }
        }
      } catch (searchErr: any) {
        console.warn('[CourseService] Tavily search error:', searchErr.message);
      }
    }

    // Dynamic Model-Driven Modality Classification (detects voice/audio or image queries in any language)
    const modality = await aiService.classifyQueryModality(question);

    if (modality.isVoiceQuery) {
      const allCourseItems = faissStore.getItemsByCourse(courseId);
      const voiceItems = allCourseItems.filter(
        (item) => item.metadata?.sourceType === 'voice' || item.metadata?.sourceType === 'voice_recording'
      );
      for (const v of voiceItems) {
        if (!contextChunks.includes(v.text)) {
          contextChunks.push(`[Voice Recording Transcript: ${v.metadata?.filename || 'Audio Note'}]:\n${v.text}`);
        }
      }
    }

    if (modality.isImageQuery) {
      const allCourseItems = faissStore.getItemsByCourse(courseId);
      const imageItems = allCourseItems.filter((item) => item.metadata?.sourceType === 'image');
      for (const img of imageItems) {
        if (!contextChunks.includes(img.text)) {
          contextChunks.push(`[Uploaded Image Analysis: ${img.metadata?.filename || 'Diagram'}]:\n${img.text}`);
        }
      }
    }


    // Retrieve existing conversation history for this course
    const existingHistory = await this.getChatHistory(courseId, userId);
    const historyForAi = existingHistory.map((h) => ({
      role: h.role,
      text: h.text,
    }));

    // 3. Generate answer using Agent ReAct Loop or standard RAG
    let answer = '';
    let agentWidgets: any[] = [];
    let agentToolCalls: any[] = [];
    let agentThought: string | undefined = undefined;

    const isToolOrWidgetQuery =
      /(quiz|quz|qz|quizz|mcq|practice|question|chart|graph|plot|visualize|diagram|flowchart|erd|er diagram|architecture|pipeline|workflow|mindmap|sequence diagram|class diagram|state diagram|compare|comparison|table|step|guide|how to|email|draft|compose|message|translate|translation|tarjuma|file|bash|script|terminal|search|google|web|internet|memory|remember|remainder|reminder|remind|rmdr|rminder|yaad|yad|schedule|calendar|calander|clndr|assignment|asignment|asigmnt|asigmet|exam|paper|pepar|imtihan|viva|deadline|due|task|kal|kl|kall|parso|prso|tarso|aaj|aj|monday|tuesday|wednesday|thursday|friday|saturday|sunday|somwar|peer|mangal|budh|jummarat|jumerat|jumma|juma|hafta|itwar|docx|docz|pdf|word|txt|csv|py|download|link|export|bna|bana|code|video|youtube|youtu\.be|vimeo|watch\?v=)/i.test(
        question
      ) || Boolean(urlMatch);

    const shouldRunAgent = isToolOrWidgetQuery || enableThink;

    try {
      if (shouldRunAgent) {
        const agentResult = await agentService.runAgentLoop(
          courseId,
          course.name,
          question,
          historyForAi,
          contextChunks,
          userId,
          enableThink
        );
        if (agentResult && (agentResult.answer || agentResult.widgets.length > 0)) {
          answer = agentResult.answer;
          agentWidgets = agentResult.widgets || [];
          agentToolCalls = agentResult.toolCalls || [];
          agentThought = agentResult.thought;
        }
      }
    } catch (agentErr: any) {
      console.warn('[CourseService] Agent ReAct execution fallback:', agentErr.message);
    }

    if (!answer) {
      const ragRes = await aiService.answerCourseRAG(
        question,
        course.name,
        contextChunks,
        historyForAi,
        enableThink
      );
      if (typeof ragRes === 'object' && ragRes !== null) {
        answer = (ragRes as any).answer || '';
        if (!agentThought) agentThought = (ragRes as any).thought;
      } else {
        const { thought: parsedThought, cleanAnswer } = extractThoughtAndCleanAnswer(ragRes as string);
        if (parsedThought && !agentThought) {
          agentThought = parsedThought;
        }
        answer = cleanAnswer;
      }
    }

    // Dynamic Thinking Guarantee: If model didn't output <thought>, dynamically synthesize situation-aware thought
    if (!agentThought && (answer || agentWidgets.length > 0)) {
      agentThought = agentService.generateSituationAwareThought(
        question,
        answer,
        course.name,
        agentToolCalls,
        agentWidgets
      );
    }

    // Safety net: Guarantee video player widget attachment if YouTube/video link was provided
    if (preloadedVideoWidget && !agentWidgets.some((w) => w.type === 'video')) {
      agentWidgets.unshift(preloadedVideoWidget);
    }

    // Safety net: If user requested a downloadable file or doc, ensure it is created and attached
    if (!agentWidgets.some((w) => w.type === 'files')) {
      await agentService.autoDetectAndGenerateFile(
        question,
        answer,
        courseId,
        agentWidgets,
        agentToolCalls,
        historyForAi
      );
    }

    const sources = [
      ...webSources.map((s) => ({
        ...s,
        text: cleanMojibake(s.text),
      })),
      ...matches.map((m) => ({
        text: repairChunkMathDelimiters(m.item.text),
        score: Math.round(m.score * 100) / 100,
        filename: cleanMojibake(m.item.metadata?.filename || ''),
      })),
    ];

    // 4. Automatic Academic Task Detection & Deduplication (quizzes, assignments, exams)
    const alreadyScheduledByAgent = agentToolCalls.some(
      (tc) => tc.name === 'schedule_academic_task'
    );

    let autoScheduleResult: { created: any[]; discarded: any[] } = { created: [], discarded: [] };
    if (!alreadyScheduledByAgent) {
      const taskContentToScan = `${question} ${fileContext || ''}`.trim();
      autoScheduleResult = await this.autoScheduleTasksFromContent(
        userId,
        courseId,
        taskContentToScan
      );
    }

    let finalAnswer = answer;
    if (!answer && !isToolOrWidgetQuery && autoScheduleResult.created.length > 0) {
      const createdNotes = autoScheduleResult.created
        .map(
          (t) =>
            `\n- 📌 **Task:** ${t.title} (${t.type || 'Task'})\n- 📅 **Due Date:** ${new Date(t.deadline).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}\n- 📆 **Calendar:** Calendar section mein update ho gaya hai\n- ✉️ **Email Reminders:** 1 din pehle (24h) aur 12 ghante pehle auto email scheduled`
        )
        .join('\n');
      finalAnswer += `\n\n${createdNotes}`;
    }

    // 5. Save to course-specific independent chat history and persist to disk
    const metaList = Array.isArray(fileMetadata)
      ? fileMetadata
      : fileMetadata
      ? [fileMetadata]
      : [];
    const allImageUrls = metaList
      .filter((m) => m.isImage && m.base64)
      .map((m) => m.base64 as string);
    const allAttachedFiles = metaList
      .filter((m) => m.filename)
      .map((m) => ({ name: m.filename!, type: m.mimeType || 'file' }));

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      courseId,
      role: 'user',
      text: question,
      timestamp: new Date().toISOString(),
      imageUrl: allImageUrls[0] || undefined,
      imageUrls: allImageUrls.length > 0 ? allImageUrls : undefined,
      attachedFile: allAttachedFiles[0] || undefined,
      attachedFiles: allAttachedFiles.length > 0 ? allAttachedFiles : undefined,
    };

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      courseId,
      role: 'assistant',
      text: finalAnswer,
      sources,
      timestamp: new Date().toISOString(),
      widgets: agentWidgets.length > 0 ? agentWidgets : undefined,
      toolCalls: agentToolCalls.length > 0 ? agentToolCalls : undefined,
      thought: agentThought || undefined,
    };

    existingHistory.push(userMsg, assistantMsg);
    this.saveCourseHistoryToDisk(courseId, existingHistory);

    if (userId) {
      try {
        await prisma.chatMessage.create({
          data: {
            id: userMsg.id,
            userId,
            courseId,
            role: userMsg.role,
            text: userMsg.text,
            imageUrl: userMsg.imageUrl || null,
            sources: (userMsg.sources as any) || undefined,
            widgets: (userMsg.widgets as any) || undefined,
            toolCalls: (userMsg.toolCalls as any) || undefined,
            thought: userMsg.thought || null,
            createdAt: new Date(userMsg.timestamp || Date.now()),
          },
        });
        await prisma.chatMessage.create({
          data: {
            id: assistantMsg.id,
            userId,
            courseId,
            role: assistantMsg.role,
            text: assistantMsg.text,
            imageUrl: assistantMsg.imageUrl || null,
            sources: (assistantMsg.sources as any) || undefined,
            widgets: (assistantMsg.widgets as any) || undefined,
            toolCalls: (assistantMsg.toolCalls as any) || undefined,
            thought: assistantMsg.thought || null,
            createdAt: new Date(assistantMsg.timestamp || Date.now()),
          },
        });
      } catch (dbErr) {
        console.warn('[CourseService] Could not persist chat messages to DB:', dbErr);
      }
    }

    return {
      courseName: course.name,
      question,
      answer: finalAnswer,
      sources,
      widgets: agentWidgets,
      toolCalls: agentToolCalls,
      thought: agentThought || undefined,
      createdTasks: autoScheduleResult.created,
      discardedTasks: autoScheduleResult.discarded,
      userMessage: userMsg,
      assistantMessage: assistantMsg,
      history: existingHistory,
    };
  }

  /**
   * Helper: Chunk long text by words
   */
  private chunkText(text: string, wordsPerChunk: number = 350): string[] {
    const cleaned = cleanMojibake(text);
    const words = cleaned.trim().split(/\s+/);
    if (words.length <= wordsPerChunk) return [repairChunkMathDelimiters(cleaned.trim())];

    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += wordsPerChunk - 50) { // 50 word overlap
      const slice = words.slice(i, i + wordsPerChunk).join(' ');
      if (slice.trim().length > 0) {
        chunks.push(repairChunkMathDelimiters(slice.trim()));
      }
    }
    return chunks;
  }
}

export const courseService = new CourseService();
