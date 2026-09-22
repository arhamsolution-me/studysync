import { WhatsAppService } from './whatsapp.service';
import { whatsAppStateManager } from './whatsapp.state';
import { courseService } from '../courses/course.service';
import { formatForWhatsApp } from './whatsapp.formatter';
import { buildWhatsAppCalendarMessage } from './whatsapp.calendar';
import { aiService } from '../ai/ai.service';
import { taskService } from '../tasks/task.service';
import { scheduleTaskReminders } from '../notifications/notification.queue';
import { parseAcademicDeadline } from '../ai/agent.service';
import prisma from '../../config/database';

export class WhatsAppHandler {
  /**
   * Processes incoming WhatsApp messages and routes commands.
   */
  async handleIncomingMessage(service: WhatsAppService, msg: any): Promise<void> {
    const remoteJid = msg.key?.remoteJid;
    if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') {
      return; // Ignore group chats and status broadcasts
    }

    // ─── STRICT "ME / YOU" CHAT FILTER ────────────────────────────────
    // Only process messages from the student's personal self-chat ("You" / "Message yourself").
    const myPhone = service.getMyPhoneNumber() || '923030111550';
    const myLid = service.getMyLid();
    const chatIdentifier = remoteJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');

    const isSelfChat =
      (Boolean(myPhone) && chatIdentifier === myPhone) ||
      (Boolean(myLid) && chatIdentifier === myLid);

    if (!isSelfChat) {
      // Completely ignore all messages sent to other contacts or received from other contacts
      return;
    }

    // Skip if message was sent by the bot itself (prevents infinite loop in "Me" chat)
    if (msg.key?.id && service.isSentByBot(msg.key.id)) {
      return;
    }

    // ─── EXTRACT CONTENT (Text or Audio Voice Note) ───────────────────
    const m = msg.message;
    if (!m) return;

    const inner =
      m.ephemeralMessage?.message ||
      m.viewOnceMessage?.message ||
      m.documentWithCaptionMessage?.message ||
      m;

    let text = (
      inner.conversation ||
      inner.extendedTextMessage?.text ||
      inner.imageMessage?.caption ||
      inner.videoMessage?.caption ||
      inner.documentMessage?.caption ||
      ''
    ).trim();

    const isAudio = Boolean(inner.audioMessage || (inner.documentMessage?.mimetype?.startsWith('audio/')));

    if (!text && !isAudio) return;

    // Additional bot signature filter to prevent reflection loops in self-chat
    if (
      text.startsWith('🎓 *StudySync') ||
      text.startsWith('📚 *Connected to') ||
      text.startsWith('📚 *Switched to') ||
      text.startsWith('📚 *Please specify') ||
      text.startsWith('📅 *STUDYSYNC') ||
      text.startsWith('📅 *Your StudySync') ||
      text.startsWith('📅 *Calendar Event') ||
      text.startsWith('👋 *Exited') ||
      text.startsWith('💤 *StudySync') ||
      text.startsWith('🤖 *StudySync') ||
      text.startsWith('🔔 *StudySync') ||
      text.startsWith('❌ Course not found') ||
      text.startsWith('ℹ️ *StudySync') ||
      text.startsWith('ℹ️ You are in the main') ||
      text.startsWith('🎙️ *Lecture Voice') ||
      text.startsWith('🎙️ *Voice Note')
    ) {
      return;
    }

    // Unified target JID to send replies (always deliver to user's phone JID so it lands in self-chat)
    const replyJid = myPhone ? `${myPhone}@s.whatsapp.net` : remoteJid;

    // Unified session key for this student
    const sessionKey = myPhone || 'personal-user';
    const session = whatsAppStateManager.getSession(sessionKey);
    whatsAppStateManager.updateActivity(sessionKey);
    const userId = 'personal-user';

    // ─── 0. VOICE NOTE / AUDIO INGESTION PIPELINE ─────────────────────
    if (isAudio) {
      console.log(`[WhatsApp Inbound Self-Chat Audio] Received voice note in state: ${session.state}`);

      if (session.state === 'OFF') {
        await service.sendMessage(
          replyJid,
          `🤖 *StudySync Assistant is currently OFF.*\n\nSend *agent on* to activate before recording lecture voice notes!`
        );
        return;
      }

      // 1. Download media buffer
      const audioBuffer = await service.downloadMedia(msg);
      if (!audioBuffer || audioBuffer.length === 0) {
        await service.sendMessage(
          replyJid,
          `⚠️ *Could not download voice note.* Please check your WhatsApp media settings and try sending again.`
        );
        return;
      }

      // 2. Transcribe via Groq Whisper STT
      const transcript = (await aiService.transcribeAudio(audioBuffer, 'lecture_voicenote.ogg')).trim();

      if (!transcript || transcript.length < 3) {
        await service.sendMessage(
          replyJid,
          `🎙️ *Voice Note Received, but no clear speech was detected.*\n\nPlease speak closer to the microphone and try recording again.`
        );
        return;
      }

      console.log(`[WhatsApp Voice Transcript] "${transcript}"`);

      // 3. Check if user spoke a system command
      const lowerTranscript = transcript.toLowerCase().trim().replace(/^[\/\s!#]+/, '');
      if (
        lowerTranscript === 'exit' ||
        lowerTranscript === 'leave' ||
        lowerTranscript === 'calendar' ||
        lowerTranscript === 'calander' ||
        lowerTranscript === 'schedule' ||
        lowerTranscript === 'weekly' ||
        lowerTranscript === 'semester' ||
        lowerTranscript === 'agent off' ||
        lowerTranscript === 'agent on'
      ) {
        text = lowerTranscript; // Pass into text command routing
      } else if (session.state === 'COURSE_CHAT' && session.activeCourseId) {
        // Check if student asked a direct question (e.g. "Paging kya hoti hai?", "Explain Banker's algorithm")
        const isQuestion =
          /\b(?:kya|kyun|kaise|kab|kon|konsa|explain|define|summarize|tell me|what|why|how|when|who|where|difference|samjha|samjhao|batao|bataiye)\b/i.test(transcript) ||
          transcript.trim().endsWith('?');

        const isLectureNoteIntent =
          /\b(?:professor|sir|mam|teacher|lecture|class|sir ne|prof ne|teacher ne|note|exam me|midterm me|final me|important|lazmi|topic)\b/i.test(transcript) ||
          !isQuestion;

        if (isQuestion && !isLectureNoteIntent) {
          console.log('[WhatsApp Voice Question] Treating voice note as an academic inquiry');
          text = transcript; // Route through Course RAG in step 6!
        } else {
          // ─── LECTURE NOTE EMBEDDING INTO FAISS ──────────────────────
          const courseId = session.activeCourseId;
          const courseName = session.activeCourseName || 'Course';

          const firstSentence = transcript.split(/[.!?\n]/)[0].trim();
          const shortTitle = firstSentence.length > 45 ? firstSentence.substring(0, 45) + '...' : firstSentence || 'Lecture Note';

          // 1. Ingest into Course FAISS Vector Store
          const ingestResult = await courseService.ingestMaterial(userId, {
            courseId,
            title: `Voice Note: ${shortTitle}`,
            content: transcript,
            sourceType: 'voice',
          });

          // 2. Auto-detect any deadlines (quizzes, assignments, exams)
          const autoScheduleResult = await courseService.autoScheduleTasksFromContent(
            userId,
            courseId,
            transcript
          );

          // 3. Append to course conversation history
          courseService.addAssistantSystemMessage(
            courseId,
            `🎙️ [Voice Note Transcribed]: "${transcript}"`
          );

          let reply = `🎙️ *Lecture Voice Note Captured & Embedded!* 🧠\n`;
          reply += `📚 *Course:* *${courseName}*\n`;
          reply += `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
          reply += `📝 *Transcribed Content:*\n> "${transcript}"\n\n`;
          reply += `✨ *Actions Taken:*\n`;
          reply += `• 💾 *Saved to Course Workspace*\n`;
          reply += `• 🧠 *Vector Embeddings Created:* Indexed ${ingestResult.chunksIndexed} chunk(s) into FAISS\n`;
          reply += `• 🔍 *RAG Ready:* You can now ask any question based on this lecture note!\n\n`;

          if (autoScheduleResult.created.length > 0) {
            reply += `📅 *Auto-Scheduled Deadlines Detected:*\n`;
            autoScheduleResult.created.forEach((t) => {
              const d = new Date(t.deadline);
              const dayStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
              reply += `• 📌 *${t.title}* [${(t.type || 'Task').toUpperCase()}]\n   🗓️ Day: *${dayStr}*\n   🔔 24-hour proactive reminders armed!\n`;
            });
            reply += `\n`;
          }

          reply += `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
          reply += `💡 _Tip: You can now ask questions about this lecture note anytime right here on WhatsApp!_`;

          await service.sendMessage(replyJid, reply);
          return;
        }
      } else {
        // ─── STANDBY MODE (NOT IN COURSE_CHAT) ────────────────────────
        // Check if student dictated a calendar task
        const extracted = await aiService.extractTaskFromTranscript(transcript);
        if (extracted && extracted.title && extracted.title !== 'null') {
          const targetDeadline = parseAcademicDeadline(extracted.deadline_iso || undefined, transcript);
          const task = await taskService.createTask(userId, {
            title: extracted.title,
            type: (extracted.type || 'assignment') as any,
            subject: extracted.subject || null,
            deadline: targetDeadline.toISOString(),
            priority: extracted.priority || 'high',
            description: `Scheduled via WhatsApp Voice Note: "${transcript}"`,
            source: 'voice',
          });
          await scheduleTaskReminders(task.id, userId);

          const dayStr = targetDeadline.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          let taskReply = `🎙️ *Voice Note Received & Scheduled on Calendar!* 📅\n`;
          taskReply += `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
          taskReply += `📝 *Transcript:* "${transcript}"\n\n`;
          taskReply += `📌 *Task:* *${task.title}* [${(task.type || 'Task').toUpperCase()}]\n`;
          if (task.subject) taskReply += `📚 *Subject:* ${task.subject}\n`;
          taskReply += `🗓️ *Day:* *${dayStr}*\n`;
          taskReply += `🔔 *Reminders:* 24-hour proactive alert armed!\n\n`;
          taskReply += `_View your full schedule anytime by sending *Calendar*._`;
          await service.sendMessage(replyJid, taskReply);
          return;
        }

        // Dictated lecture note without course:
        const courses = await courseService.getCourses(userId);
        const courseList = courses.map((c: any) => `• *Course ${c.name}*`).join('\n');
        let guideReply = `🎙️ *Voice Note Transcribed:*\n> "${transcript}"\n\n`;
        guideReply += `ℹ️ *You are currently in the main standby lobby.*\n`;
        guideReply += `To embed lecture notes into a specific course's FAISS knowledge base, please enter the course first:\n\n`;
        guideReply += `${courseList}\n\n`;
        guideReply += `👉 Reply: *Course <Course Name>* (e.g. *Course Operating Systems*) and send the voice note!`;
        await service.sendMessage(replyJid, guideReply);
        return;
      }
    }

    console.log(`[WhatsApp Inbound Self-Chat] "${text}"`);

    const lower = text.toLowerCase();

    // ─── 1. COMMAND: "agent on" ───────────────────────────────────────
    if (lower === 'agent on') {
      if (session.state !== 'OFF') {
        if (session.state === 'COURSE_CHAT' && session.activeCourseName) {
          await service.sendMessage(
            replyJid,
            `ℹ️ *StudySync Agent is already ON!* ✅\n\n` +
            `You are currently active in *${session.activeCourseName}* chatbot.\n` +
            `• Send any question to study with this course\n` +
            `• Type *exit* to return to the main menu\n` +
            `• Type *agent off* to deactivate`
          );
          return;
        } else {
          await service.sendMessage(
            replyJid,
            `ℹ️ *StudySync Agent is already ON!* ✅\n\n` +
            `You are in the main agent lobby.\n` +
            `• Send: *Course <Course Name>* to enter a course\n` +
            `• Send: *Calendar* (or *Weekly* / *Semester*) for day-wise schedule & quizzes\n` +
            `• Send: *agent off* to deactivate`
          );
          return;
        }
      }

      whatsAppStateManager.activateAgent(sessionKey);
      const courses = await courseService.getCourses(userId);

      const courseList = courses
        .map((c: any, i: number) => `${i + 1}. *${c.name}*`)
        .join('\n');

      const response =
        `🎓 *StudySync AI Agent is ON!* 🚀\n\n` +
        `Welcome! I am connected to your StudySync academic workspace.\n\n` +
        `📚 *Your Enrolled Courses:*\n` +
        `${courseList || '• No courses enrolled yet.'}\n\n` +
        `💬 *How to interact:*\n` +
        `👉 *Course <Course Name>* — Start chat with a course chatbot\n` +
        `   _(e.g., \`Course Database Systems\` or \`Course OS\`)_\n` +
        `👉 *Calendar* — Upcoming Quizzes, Assignments, Weekly Schedule & Semester Overview\n` +
        `👉 *agent off* — Turn off assistant`;

      await service.sendMessage(replyJid, response);
      return;
    }

    // ─── 2. COMMAND: "agent off" ──────────────────────────────────────
    if (lower === 'agent off') {
      whatsAppStateManager.deactivateAgent(sessionKey);
      const response =
        `💤 *StudySync Agent Deactivated.*\n\n` +
        `I am now in sleep mode. Send *agent on* whenever you want to study or manage your schedule!`;
      await service.sendMessage(replyJid, response);
      return;
    }

    // If agent is OFF, do not process further unless user asks to turn on
    if (session.state === 'OFF') {
      if (lower.includes('agent') || lower.includes('studysync') || lower.includes('help')) {
        await service.sendMessage(
          replyJid,
          `🤖 *StudySync Assistant is currently OFF.*\n\nSend *agent on* to activate!`
        );
      }
      return;
    }

    // ─── 3. COMMAND: "Course <Name>" ──────────────────────────────────
    // If the user is ALREADY inside a course (COURSE_CHAT):
    // - If they type "course" alone, or "Course <Same Course Name>", or questions about the course
    //   like "course outline kya hai", it should NOT be intercepted as a command; it should fall through to COURSE_CHAT as normal chat!
    // - If they explicitly type "Course <Different Course Name>", switch to that different course.
    const courseCmdMatch = text.match(/^course(?:\s+(.+))?$/i);
    if (courseCmdMatch) {
      const query = (courseCmdMatch[1] || '').trim().toLowerCase();

      // If user is currently in COURSE_CHAT:
      if (session.state === 'COURSE_CHAT') {
        if (!query) {
          // User sent just the word "course" while in COURSE_CHAT -> treat as normal chat!
          // (falls through to step 6 COURSE_CHAT)
        } else {
          const courses = await courseService.getCourses(userId);
          const matchedOtherCourse = courses.find((c: any) => {
            if (c.id === session.activeCourseId) return false; // Not the current course
            const cName = c.name.toLowerCase();
            if (cName === query) return true;
            if (query === 'db' || query === 'database') return cName.includes('database');
            if (query === 'os' || query === 'operating') return cName.includes('operating');
            if (query === 'ai') return cName.includes('artificial intelligence') || cName.includes('ai');
            if (query === 'calc' || query === 'calculus' || query === 'math') return cName.includes('calculus') || cName.includes('algebra');
            if (query.length >= 3 && (cName.includes(query) || (query.length > cName.length && query.includes(cName)))) return true;
            return false;
          });

          if (matchedOtherCourse) {
            // User explicitly requested to switch to another course
            whatsAppStateManager.enterCourse(sessionKey, matchedOtherCourse.id, matchedOtherCourse.name);
            const response =
              `📚 *Switched to Course:* *${matchedOtherCourse.name}* ✅\n` +
              `🔐 _Official Course Workspace Active_\n\n` +
              `💬 *What you can do:*\n` +
              `• Ask any question or concept from ${matchedOtherCourse.name}\n` +
              `• Type *exit* anytime to return to main menu`;
            await service.sendMessage(replyJid, response);
            return;
          } else {
            // Did not match another course (e.g. query is current course or question like "outline")
            // Let it fall through to step 6 COURSE_CHAT as a regular chat message!
          }
        }
      } else {
        // User is in IDLE mode (not inside a course)
        if (!query) {
          const courses = await courseService.getCourses(userId);
          const courseList = courses.map((c: any, i: number) => `${i + 1}. *Course ${c.name}*`).join('\n');
          await service.sendMessage(
            replyJid,
            `📚 *Please specify a course name:*\n\n${courseList}\n\n👉 Example: *Course Database Systems*`
          );
          return;
        }

        const courses = await courseService.getCourses(userId);
        const matched = courses.find((c: any) => {
          const cName = c.name.toLowerCase();
          if (cName === query) return true;
          if (cName.includes(query) || query.includes(cName)) return true;
          if (query === 'db' || query === 'database') return cName.includes('database');
          if (query === 'os' || query === 'operating') return cName.includes('operating');
          if (query === 'ai') return cName.includes('artificial intelligence') || cName.includes('ai');
          if (query === 'calc' || query === 'calculus' || query === 'math') return cName.includes('calculus') || cName.includes('algebra');
          return false;
        });

        if (matched) {
          whatsAppStateManager.enterCourse(sessionKey, matched.id, matched.name);
          const courseHistory = await courseService.getChatHistory(matched.id, userId);
          const lastUserQuestions = courseHistory
            .filter((m: any) => m.role === 'user')
            .slice(-2)
            .map((m: any) => `• _"${m.text.substring(0, 50)}${m.text.length > 50 ? '...' : ''}"_`)
            .join('\n');

          let historyRecap = '';
          if (courseHistory.length > 0 && lastUserQuestions) {
            historyRecap = `\n📜 *Recent Discussion in this Course:*\n${lastUserQuestions}\n`;
          }

          const response =
            `📚 *Connected to Course:* *${matched.name}* ✅\n` +
            `🔐 _Official Course Workspace Active (Strictly Isolated)_\n` +
            historyRecap +
            `\n💬 *What you can do:*\n` +
            `• Ask any question or concept from ${matched.name} notes\n` +
            `• Share deadline/quiz dates (e.g. _"Kal 5 baje quiz ha"_)\n` +
            `• Type *history* to view recent chat history for this course\n` +
            `• Type *exit* anytime to return to the main agent menu`;

          await service.sendMessage(replyJid, response);
          return;
        } else {
          const availableList = courses
            .map((c: any) => `• *Course ${c.name}*`)
            .join('\n');
          await service.sendMessage(
            replyJid,
            `❌ Course not found for: *"${query}"*\n\n` +
              `📚 *Available Courses:*\n${availableList}\n\n` +
              `Please reply with: *Course <Course Name>*`
          );
          return;
        }
      }
    }

    // ─── 4. COMMAND: "exit" or "leave" ────────────────────────────────
    if (lower === 'exit' || lower === 'leave' || lower === 'back' || lower === 'exit course') {
      if (session.state === 'COURSE_CHAT') {
        const prevName = session.activeCourseName || 'Course';
        whatsAppStateManager.exitCourse(sessionKey);
        const response =
          `👋 *Exited ${prevName} Chatbot.*\n\n` +
          `You are back in the main agent standby menu.\n\n` +
          `👉 Type *Course <Course Name>* to switch into another course.\n` +
          `👉 Type *Calendar* to view deadlines.\n` +
          `👉 Type *agent off* to deactivate.`;
        await service.sendMessage(replyJid, response);
      } else {
        await service.sendMessage(
          replyJid,
          `ℹ️ You are in the main agent menu. Type *agent off* to deactivate.`
        );
      }
      return;
    }

    // ─── 5. COMMAND: "calendar" / "schedule" / "weekly" / "semester" ──
    const cleanCmd = lower.replace(/^[\/\s!#]+/, '').trim();
    const isCalendarCommand =
      /^(?:calendar|calander|schedule|deadlines?|tasks?|weekly|semester|timetable|overview)$/i.test(cleanCmd) ||
      /\b(?:mera\s+calendar|calendar\s+dikhao|calendar\s+batao|mera\s+schedule|schedule\s+batao|weekly\s+schedule|semester\s+overview|upcoming\s+quizzes|upcoming\s+assignments)\b/i.test(lower);

    if (isCalendarCommand) {
      const [allTasks, courses] = await Promise.all([
        prisma.task.findMany({
          where: { userId },
          orderBy: { deadline: 'asc' },
        }),
        courseService.getCourses(userId),
      ]);

      const calendarMessage = buildWhatsAppCalendarMessage(allTasks, courses);
      await service.sendMessage(replyJid, calendarMessage);
      return;
    }

    // ─── 6. STATE: COURSE_CHAT (Academic RAG & Task Auto-Scheduling) ──
    if (session.state === 'COURSE_CHAT' && session.activeCourseId) {
      // Allow viewing official course history
      if (lower === 'history' || lower === 'chat history') {
        const history = await courseService.getChatHistory(session.activeCourseId, userId);
        if (history.length === 0) {
          await service.sendMessage(
            replyJid,
            `📜 *No previous chat history for ${session.activeCourseName}.*\nAsk any question to begin discussion!`
          );
          return;
        }
        const recent = history.slice(-6); // last 3 turns
        let historyText = `📜 *Official Chat History for ${session.activeCourseName}:*\n\n`;
        recent.forEach((m: any) => {
          const role = m.role === 'user' ? '👤 *You*' : '🤖 *AI*';
          const clean = formatForWhatsApp(m.text);
          historyText += `${role}: ${clean.substring(0, 160)}${clean.length > 160 ? '...' : ''}\n\n`;
        });
        historyText += `_Type your next question to continue discussion in ${session.activeCourseName}._`;
        await service.sendMessage(replyJid, historyText);
        return;
      }

      // Allow clearing history for this specific course
      if (lower === 'clear history' || lower === 'reset course') {
        courseService.clearChatHistory(session.activeCourseId);
        await service.sendMessage(
          replyJid,
          `🗑️ *Official chat history cleared for ${session.activeCourseName}.*\nYou have a clean slate for this course!`
        );
        return;
      }
      try {
        // Forward query to courseService.queryCourseRAG
        const ragResult = await courseService.queryCourseRAG(
          userId,
          session.activeCourseId,
          text
        );

        let answer = ragResult.answer || 'I have processed your request.';

        // Format Markdown and LaTeX math cleanly into Unicode for WhatsApp
        answer = formatForWhatsApp(answer);

        // Check if any academic task (quiz, assignment, exam) was auto-scheduled from this message
        const taskCheckRegex = /(quiz|assignment|exam|deadline|due|schedule|remind|parso|kal|test|homework|project|submission)/i;
        if (taskCheckRegex.test(text)) {
          // Look up recently created task for this course in the last 15 seconds
          const recentTask = await prisma.task.findFirst({
            where: {
              userId,
              courseId: session.activeCourseId,
              createdAt: { gte: new Date(Date.now() - 15000) },
            },
            orderBy: { createdAt: 'desc' },
          });

          if (recentTask) {
            const dl = new Date(recentTask.deadline);
            const dateStr = dl.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            const timeStr = dl.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            });

            const calendarConfirmation =
              `\n\n═══════════════════════════\n` +
              `📅 *Calendar Event Auto-Scheduled!* ⏰\n` +
              `📌 *Task:* ${recentTask.title}\n` +
              `🏷️ *Type:* ${(recentTask.type || 'task').toUpperCase()}\n` +
              `🗓️ *Due:* ${dateStr} at ${timeStr}\n` +
              `🔔 *WhatsApp Reminder:* 24 hours prior automatic study plan alert is active!\n` +
              `═══════════════════════════`;

            answer += calendarConfirmation;
          }
        }

        await service.sendMessage(replyJid, answer);
      } catch (ragErr: any) {
        console.error('[WhatsApp] RAG error:', ragErr);
        await service.sendMessage(
          replyJid,
          `⚠️ Sorry, I encountered an issue while processing your question for *${session.activeCourseName}*. Please try again.`
        );
      }
      return;
    }

    // ─── 7. STATE: IDLE (Standby mode, prompt to choose course) ─────────
    if (session.state === 'IDLE') {
      const courses = await courseService.getCourses(userId);
      const courseList = courses
        .map((c: any, i: number) => `${i + 1}. *Course ${c.name}*`)
        .join('\n');

      const helpMsg =
        `🤖 *StudySync Assistant is in Standby.*\n\n` +
        `Please select a course to start learning or asking questions:\n\n` +
        `${courseList}\n\n` +
        `👉 Send: *Course <Course Name>* (e.g. *Course Database Systems*)\n` +
        `👉 Send: *Calendar* to view upcoming deadlines\n` +
        `👉 Send: *agent off* to deactivate`;

      await service.sendMessage(replyJid, helpMsg);
    }
  }
}

export const whatsAppHandler = new WhatsAppHandler();
