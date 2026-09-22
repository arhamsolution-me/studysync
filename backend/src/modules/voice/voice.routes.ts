

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { aiService } from '../ai/ai.service';
import { taskService } from '../tasks/task.service';
import { authGuard, voiceLimiter, auditLog, AuthRequest } from '../../middleware';

const router = Router();

// Multer config: accept audio files up to 10MB, store in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are accepted.'));
    }
  },
});

/**
 * POST /api/voice/transcribe
 * High-speed Whisper transcription: receives spoken voice note and returns accurate text
 */
router.post(
  '/transcribe',
  authGuard,
  upload.single('audio'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No audio file received. Please try recording again.',
        });
        return;
      }

      const transcript = await aiService.transcribeAudio(
        req.file.buffer,
        req.file.originalname || 'recording.webm'
      );

      if (!transcript || transcript.trim().length === 0) {
        res.status(400).json({
          success: false,
          message: 'Could not hear any clear speech. Please speak closer to the microphone.',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          transcript: transcript.trim(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/voice/capture
 * Full voice pipeline:
 * 1. Receive audio → Groq Whisper STT
 * 2. Groq Llama intent classification
 * 3. If NEW_TASK → Gemini structured extraction
 * 4. Return preview data (student confirms before saving)
 */
router.post(
  '/capture',
  authGuard,
  voiceLimiter,
  upload.single('audio'),
  auditLog('voice_capture'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No audio file received. Please try recording again.',
        });
        return;
      }

      // Step 1: Transcribe with Groq Whisper
      const transcript = await aiService.transcribeAudio(
        req.file.buffer,
        req.file.originalname || 'recording.webm'
      );

      if (!transcript || transcript.trim().length < 3) {
        res.status(400).json({
          success: false,
          message: 'Could not hear that clearly — try speaking a bit louder or closer to the mic.',
          data: { transcript: transcript || '' },
        });
        return;
      }

      // Step 2: Directly extract task details (in English, Urdu, or Roman Urdu)
      const extracted = await aiService.extractTaskFromTranscript(transcript);

      if (extracted && extracted.title !== null) {
        res.status(200).json({
          success: true,
          message: 'Got it — check the details and save when ready.',
          data: {
            transcript,
            intent: 'NEW_TASK',
            extracted: {
              title: extracted.title,
              type: extracted.type || 'other',
              subject: extracted.subject || null,
              deadline: extracted.deadline_iso || null,
              priority: extracted.priority || 'medium',
              source: 'voice',
            },
          },
        });
        return;
      }

      // Step 3: If not a task, check other commands
      const intent = await aiService.classifyIntent(transcript);
      if (intent === 'MARK_DONE') {
        res.status(200).json({
          success: true,
          message: 'Sounds like you want to mark something done.',
          data: { transcript, intent },
        });
      } else if (intent === 'ASK_SCHEDULE') {
        const dashboard = await taskService.getDashboard(req.userId!);
        res.status(200).json({
          success: true,
          data: { transcript, intent, schedule: dashboard.upcoming },
        });
      } else {
        res.status(200).json({
          success: true,
          message: "Didn't catch a specific task — try saying something like \"quiz tomorrow for Database\".",
          data: { transcript, intent },
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/voice/text-command
 * Natural language task extraction directly from text
 */
router.post(
  '/text-command',
  authGuard,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { text } = req.body;
      if (!text || !text.trim()) {
        res.status(400).json({ success: false, message: 'Please provide some text.' });
        return;
      }

      const extracted = await aiService.extractTaskFromTranscript(text.trim());
      if (!extracted || extracted.title === null) {
        res.status(200).json({
          success: true,
          message: 'Could not detect a specific task. Try phrasing with a deadline and subject.',
          data: { transcript: text.trim(), extracted: null },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          transcript: text.trim(),
          extracted: {
            title: extracted.title,
            type: extracted.type || 'other',
            subject: extracted.subject || null,
            deadline: extracted.deadline_iso || null,
            priority: extracted.priority || 'medium',
            source: 'voice',
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
