import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import { authGuard, AuthRequest } from '../../middleware/authGuard';
import { courseService } from './course.service';
import {
  extractTextFromBuffer,
  isAudioFile,
  isImageFile,
  isPresentationFile,
  isSpreadsheetFile,
} from './documentParser';

const router = Router();

const uploadDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

router.use(authGuard);

/**
 * GET /api/courses
 */
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const courses = await courseService.getCourses(req.userId!);
    res.status(200).json({ success: true, data: { courses } });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/courses/faiss/info
 * Returns status of index.faiss and index.pkl files
 */
router.get('/faiss/info', async (_req: AuthRequest, res: Response) => {
  const info = courseService.getFaissInfo();
  res.status(200).json({ success: true, data: info });
});

/**
 * POST /api/courses
 */
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, colorTag } = req.body;
    if (!name || typeof name !== 'string') {
      res.status(400).json({ success: false, message: 'Course name is required.' });
      return;
    }

    const course = await courseService.createCourse(req.userId!, { name, colorTag });
    res.status(201).json({
      success: true,
      data: { course },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/courses/:id/tasks
 * Get all pending and completed tasks for a specific course
 */
router.get('/:id/tasks', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const courseId = req.params.id as string;
    const data = await courseService.getCourseTasks(req.userId!, courseId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/courses/:id/materials
 */
router.post('/:id/materials', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const courseId = req.params.id as string;
    const { title, content, sourceType } = req.body;

    if (!content || typeof content !== 'string') {
      res.status(400).json({ success: false, message: 'Material content is required.' });
      return;
    }

    const result = await courseService.ingestMaterial(req.userId!, {
      courseId,
      title: title || 'Study Notes',
      content,
      sourceType,
    });

    res.status(200).json({
      success: true,
      message: `Indexed ${result.chunksIndexed} chunks into FAISS vector database.`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/courses/:id/upload
 * Upload document(s), voice recording, or study image(s) (PDF, DOCX, TXT, MP3, WAV, PNG, JPG) to extract, transcribe, analyze, and index into FAISS
 */
router.post('/:id/upload', uploadDocument.any(), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const courseId = req.params.id as string;
    const rawFiles: Express.Multer.File[] =
      (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);
    const seenUploads = new Set<string>();
    const uploadedFiles: Express.Multer.File[] = [];
    for (const f of rawFiles) {
      const key = `${f.originalname}_${f.size}`;
      if (!seenUploads.has(key)) {
        seenUploads.add(key);
        uploadedFiles.push(f);
      }
    }

    if (uploadedFiles.length === 0) {
      res.status(400).json({ success: false, message: 'Please select a file, image, or record audio to upload.' });
      return;
    }

    if (uploadedFiles.length === 1) {
      const singleFile = uploadedFiles[0];
      const originalName = singleFile.originalname || 'attachment';
      const isAudio = isAudioFile(originalName);
      const isImg = isImageFile(originalName);
      const isPresentation = isPresentationFile(originalName);
      const isSpreadsheet = isSpreadsheetFile(originalName);

      const textContent = await extractTextFromBuffer(singleFile.buffer, originalName);

      if (!textContent || textContent.trim().length < 3) {
        res.status(400).json({
          success: false,
          message: isImg
            ? 'Could not extract any recognizable content or text from this image. Please try a clearer picture.'
            : isAudio
            ? 'Could not transcribe any spoken words from this audio. Please speak clearly or check microphone volume.'
            : isPresentation
            ? 'Could not extract readable slide text from this presentation. Please ensure it contains text slides.'
            : 'Could not extract readable text from this file. Please ensure it contains readable text.',
        });
        return;
      }

      const sourceType = isImg
        ? 'image'
        : isAudio
        ? 'voice'
        : isPresentation
        ? 'slides'
        : isSpreadsheet
        ? 'spreadsheet'
        : 'document';

      // Ingest into FAISS vector store for this course
      const result = await courseService.ingestMaterial(req.userId!, {
        courseId,
        title: originalName,
        content: textContent.trim(),
        sourceType,
      });

      let botMessage = '';
      if (isImg) {
        botMessage = `🖼️ **Study Image / Diagram Analyzed & Saved!** (${originalName})\n\n### Extracted Notes & Visual Content:\n${textContent.trim()}\n\n---\n*I have indexed all **${result.chunksIndexed} sections** of this visual material into your course knowledge base. You can now ask me any questions, explanations, or formula derivations based on this image!*`;
      } else if (isAudio) {
        botMessage = `🎙️ **Voice Recording / Audio Transcribed & Saved!** (${originalName})\n\n**Spoken Transcript:**\n> "${textContent.trim()}"\n\nI have indexed all **${result.chunksIndexed} sections** of this recording into this course's knowledge base. You can now ask me:\n- *"voice my kya kya bat hui ha sari btao"*\n- *"What was discussed in this audio recording?"*\n- *"Summarize the main points from the voice note."*`;
      } else if (isPresentation) {
        botMessage = `📊 **Presentation Slides Processed & Saved!** (${originalName})\n\nI have extracted all slide content and indexed **${result.chunksIndexed} sections** into this course's knowledge base. You can now ask me to summarize individual slides, generate quiz questions from the lecture, or explain any concept covered in these slides!`;
      } else if (isSpreadsheet) {
        botMessage = `📈 **Spreadsheet Data Processed & Saved!** (${originalName})\n\nI have read and indexed **${result.chunksIndexed} sections** of this dataset into this course's knowledge base. You can now ask questions or calculations about this data!`;
      } else {
        botMessage = `📄 **${originalName}** has been processed and saved to this course's knowledge base!\n\nI have read and indexed **${result.chunksIndexed} sections** of this document. You can now ask me any questions, summaries, or explanations based on it!`;
      }

      // Auto-detect and schedule any quizzes/assignments mentioned in audio transcript or notes
      const autoScheduleResult = await courseService.autoScheduleTasksFromContent(
        req.userId!,
        courseId,
        textContent.trim()
      );

      if (autoScheduleResult.created.length > 0) {
        const createdNotes = autoScheduleResult.created
          .map(
            (t) =>
              `\n- 📌 **Task:** ${t.title} (${t.type || 'Task'})\n- 📅 **Due Date:** ${new Date(t.deadline).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}\n- 📆 **Calendar:** Calendar section mein update ho gaya hai\n- ✉️ **Email Reminders:** 1 din pehle (24h) aur 12 ghante pehle auto email scheduled`
          )
          .join('\n');
        botMessage += `\n\n${createdNotes}`;
      }

      // Automatically add confirmation to course chat history
      const botMsg = courseService.addAssistantSystemMessage(courseId, botMessage);

      res.status(200).json({
        success: true,
        message: isImg
          ? `Successfully analyzed image "${originalName}" and saved notes to course knowledge base.`
          : isAudio
          ? `Successfully transcribed and saved voice recording "${originalName}" into course knowledge base.`
          : `Successfully indexed ${result.chunksIndexed} chunks from ${originalName}.`,
        data: {
          filename: originalName,
          isAudio,
          isImage: isImg,
          extractedContent: textContent.trim(),
          chunksIndexed: result.chunksIndexed,
          totalCourseChunks: result.totalCourseChunks,
          systemMessage: botMsg,
          createdTasks: autoScheduleResult.created,
          discardedTasks: autoScheduleResult.discarded,
        },
      });
      return;
    }

    // MULTIPLE FILES BATCH UPLOAD:
    let totalChunks = 0;
    const processedFiles: string[] = [];
    const allCreatedTasks: any[] = [];
    const allDiscardedTasks: any[] = [];
    const summaryLines: string[] = [];

    for (const f of uploadedFiles) {
      const originalName = f.originalname || 'attachment';
      const isImg = isImageFile(originalName);
      const isAudio = isAudioFile(originalName);
      const isPresentation = isPresentationFile(originalName);
      const isSpreadsheet = isSpreadsheetFile(originalName);
      try {
        const textContent = await extractTextFromBuffer(f.buffer, originalName);
        if (textContent && textContent.trim().length >= 3) {
          const sourceType = isImg
            ? 'image'
            : isAudio
            ? 'voice'
            : isPresentation
            ? 'slides'
            : isSpreadsheet
            ? 'spreadsheet'
            : 'document';
          const result = await courseService.ingestMaterial(req.userId!, {
            courseId,
            title: originalName,
            content: textContent.trim(),
            sourceType,
          });
          totalChunks += result.chunksIndexed;
          processedFiles.push(originalName);
          const icon = isImg ? '🖼️' : isAudio ? '🎙️' : isPresentation ? '📊' : isSpreadsheet ? '📈' : '📄';
          summaryLines.push(`- ${icon} **${originalName}** (${result.chunksIndexed} sections)`);

          const autoScheduleResult = await courseService.autoScheduleTasksFromContent(
            req.userId!,
            courseId,
            textContent.trim()
          );
          allCreatedTasks.push(...autoScheduleResult.created);
          allDiscardedTasks.push(...autoScheduleResult.discarded);
        }
      } catch (err) {
        console.warn(`[Upload] Failed to process ${originalName}:`, err);
      }
    }

    let batchBotMsg = `📁 **${processedFiles.length} Study Files / Images Processed & Saved!**\n\n${summaryLines.join('\n')}\n\n*Total **${totalChunks} sections** indexed into course knowledge base.*`;
    if (allCreatedTasks.length > 0) {
      const createdNotes = allCreatedTasks
        .map(
          (t) =>
            `\n- 📌 **Auto-Scheduled**: **${t.title}** (📅 Due: ${new Date(t.deadline).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })})`
        )
        .join('');
      batchBotMsg += `\n\n---\n### 🗓️ Academic Task Reminder Set${createdNotes}`;
    }

    const botMsg = courseService.addAssistantSystemMessage(courseId, batchBotMsg);

    res.status(200).json({
      success: true,
      message: `Successfully processed and indexed ${processedFiles.length} files (${totalChunks} sections).`,
      data: {
        processedFiles,
        totalChunksIndexed: totalChunks,
        systemMessage: botMsg,
        createdTasks: allCreatedTasks,
        discardedTasks: allDiscardedTasks,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/courses/:id/chat (RAG Question Answering + Multimodal Multi-Image / Attachment support)
 */
router.post('/:id/chat', uploadDocument.any(), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const courseId = req.params.id as string;
    let question = (req.body.question || '').trim();
    const enableThink = req.body.think === true || req.body.think === 'true' || req.body.enableThink === true;

    const rawFiles: Express.Multer.File[] =
      (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);
    const seenChatFiles = new Set<string>();
    const uploadedFiles: Express.Multer.File[] = [];
    for (const f of rawFiles) {
      const key = `${f.originalname}_${f.size}`;
      if (!seenChatFiles.has(key)) {
        seenChatFiles.add(key);
        uploadedFiles.push(f);
      }
    }

    if (!question && uploadedFiles.length === 0) {
      res.status(400).json({ success: false, message: 'Question or an image/file is required.' });
      return;
    }

    const contextSections: string[] = [];
    const filesMetadata: Array<{ filename: string; mimeType: string; base64?: string; isImage: boolean }> = [];

    for (let i = 0; i < uploadedFiles.length; i++) {
      const f = uploadedFiles[i];
      const originalName = f.originalname || `attachment_${i + 1}`;
      const isImg = isImageFile(originalName);
      const isAudio = isAudioFile(originalName);
      const isPresentation = isPresentationFile(originalName);
      const isSpreadsheet = isSpreadsheetFile(originalName);
      const textContent = await extractTextFromBuffer(f.buffer, originalName);

      if (textContent && textContent.trim()) {
        const sourceType = isImg
          ? 'image'
          : isAudio
          ? 'voice'
          : isPresentation
          ? 'slides'
          : isSpreadsheet
          ? 'spreadsheet'
          : 'document';
        // Index into FAISS memory for this course
        await courseService.ingestMaterial(req.userId!, {
          courseId,
          title: originalName,
          content: textContent.trim(),
          sourceType,
        });

        if (isImg) {
          contextSections.push(`[Attached Image ${i + 1} Analysis (${originalName})]:\n${textContent.trim()}`);
        } else if (isAudio) {
          contextSections.push(`[Attached Audio Transcript (${originalName})]:\n${textContent.trim()}`);
        } else if (isPresentation) {
          contextSections.push(`[Attached Presentation Slides (${originalName})]:\n${textContent.trim()}`);
        } else if (isSpreadsheet) {
          contextSections.push(`[Attached Spreadsheet Dataset (${originalName})]:\n${textContent.trim()}`);
        } else {
          contextSections.push(`[Attached Document Content (${originalName})]:\n${textContent.trim()}`);
        }
      }

      if (isImg) {
        const ext = originalName.split('.').pop()?.toLowerCase() || 'png';
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
        filesMetadata.push({
          filename: originalName,
          mimeType: mime,
          base64: `data:${mime};base64,${f.buffer.toString('base64')}`,
          isImage: true,
        });
      } else {
        filesMetadata.push({
          filename: originalName,
          mimeType: f.mimetype || 'application/octet-stream',
          isImage: false,
        });
      }
    }

    const fileContext = contextSections.join('\n\n');

    if (!question) {
      const imageCount = filesMetadata.filter((m) => m.isImage).length;
      if (imageCount > 1) {
        const names = filesMetadata
          .filter((m) => m.isImage)
          .map((m) => m.filename)
          .join(', ');
        question = `Please analyze and explain all ${imageCount} attached study images (${names}) in detail, comparing their key concepts, equations, and connections.`;
      } else if (imageCount === 1) {
        question = `Please explain and summarize what is in this image (${filesMetadata[0].filename}) in detail.`;
      } else if (uploadedFiles.length > 0) {
        question = `Please review and summarize the attached study materials.`;
      }
    }

    const result = await courseService.queryCourseRAG(
      req.userId!,
      courseId,
      question,
      fileContext,
      filesMetadata,
      enableThink
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/courses/:id/tasks
 * Returns pending and completed tasks for this course
 */
router.get('/:id/tasks', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const courseId = req.params.id as string;
    const result = await courseService.getCourseTasks(req.userId!, courseId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/courses/:id/chat/history
 * Returns independent chat history for this specific course (strictly scoped to user)
 */
router.get('/:id/chat/history', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const courseId = req.params.id as string;
    const course = await courseService.getCourseById(req.userId!, courseId);
    if (!course) {
      res.status(404).json({ success: false, message: 'Course not found or access denied.' });
      return;
    }

    const history = await courseService.getChatHistory(courseId, req.userId);

    res.status(200).json({
      success: true,
      data: { history },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/courses/:id/chat/history
 * Clears chat history for this course
 */
router.delete('/:id/chat/history', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const courseId = req.params.id as string;
    const course = await courseService.getCourseById(req.userId!, courseId);
    if (!course) {
      res.status(404).json({ success: false, message: 'Course not found or access denied.' });
      return;
    }

    await courseService.clearChatHistory(courseId, req.userId);

    res.status(200).json({
      success: true,
      message: 'Chat history cleared for this course.',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/courses/:id
 * Delete course and its materials
 */
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const courseId = req.params.id as string;
    await courseService.deleteCourse(req.userId!, courseId);

    res.status(200).json({
      success: true,
      message: 'Course deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/courses/:id/workspace-file
 * Download or view a generated workspace file
 */
router.get('/:id/workspace-file', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const courseId = req.params.id as string;
    const filePath = req.query.path as string;
    const download = req.query.download === 'true';

    if (!filePath) {
      res.status(400).json({ success: false, message: 'File path required.' });
      return;
    }

    const course = await courseService.getCourseById(req.userId!, courseId);
    if (!course) {
      res.status(404).json({ success: false, message: 'Course not found or access denied.' });
      return;
    }

    const { getCourseWorkspaceDir } = await import('../ai/tools/file.tools');
    const pathMod = await import('path');
    const fsMod = await import('fs');

    const workspaceDir = pathMod.default.resolve(getCourseWorkspaceDir(courseId));
    const safePath = pathMod.default.resolve(workspaceDir, filePath);

    if (!safePath.toLowerCase().startsWith(workspaceDir.toLowerCase()) || !fsMod.default.existsSync(safePath)) {
      res.status(404).json({ success: false, message: 'File not found in workspace.' });
      return;
    }

    const cleanFilename = pathMod.default.basename(safePath);
    const ext = pathMod.default.extname(cleanFilename).toLowerCase();

    const mimeMap: Record<string, string> = {
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.pdf': 'application/pdf',
      '.py': 'text/x-python; charset=utf-8',
      '.txt': 'text/plain; charset=utf-8',
      '.csv': 'text/csv; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.md': 'text/markdown; charset=utf-8',
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.ts': 'application/typescript; charset=utf-8',
    };

    const contentType = mimeMap[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    if (download) {
      res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}"`);
      const fileStream = fsMod.default.createReadStream(safePath);
      fileStream.pipe(res);
    } else {
      const previewFile = safePath + '.preview.txt';
      if (fsMod.default.existsSync(previewFile)) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `inline; filename="${cleanFilename}.txt"`);
        res.sendFile(previewFile);
        return;
      }

      // If .preview.txt does not exist, extract on the fly
      if (ext === '.docx' || ext === '.doc') {
        try {
          const mammothMod = await import('mammoth');
          const mammoth = mammothMod.default || mammothMod;
          const result = await mammoth.extractRawText({ path: safePath });
          const text = result.value || '';
          if (text.trim()) {
            try { fsMod.default.writeFileSync(previewFile, text, 'utf-8'); } catch {}
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Content-Disposition', `inline; filename="${cleanFilename}.txt"`);
            res.send(text);
            return;
          }
        } catch (e) {
          console.error('[workspace-file] DOCX preview extraction failed:', e);
        }
      } else if (ext === '.pdf') {
        try {
          const pdfParse = require('pdf-parse-fork');
          const dataBuffer = fsMod.default.readFileSync(safePath);
          const pdfData = await pdfParse(dataBuffer);
          if (pdfData.text && pdfData.text.trim()) {
            try { fsMod.default.writeFileSync(previewFile, pdfData.text, 'utf-8'); } catch {}
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Content-Disposition', `inline; filename="${cleanFilename}.txt"`);
            res.send(pdfData.text);
            return;
          }
        } catch (e) {
          console.error('[workspace-file] PDF preview extraction failed:', e);
        }
      } else if (['.py', '.txt', '.md', '.csv', '.json', '.js', '.ts', '.html', '.css', '.c', '.cpp', '.java', '.sql', '.sh', '.yaml', '.yml'].includes(ext)) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `inline; filename="${cleanFilename}"`);
        res.sendFile(safePath);
        return;
      }

      // Never send raw binary ZIP or bytecode to the preview route
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `inline; filename="${cleanFilename}.txt"`);
      res.send(`Document: ${cleanFilename}\n\nThis document is ready for download. Please click the Download button above to open it in your desktop reader.`);
    }
  } catch (error) {
    next(error);
  }
});

export default router;
