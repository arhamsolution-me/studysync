import { Router, Response, NextFunction } from 'express';
import { authGuard } from '../../middleware/authGuard';
import { AuthRequest } from '../../middleware/authGuard';
import { sendImmediateDigest, getDigestPreview } from './notification.queue';
import { emailService } from './email.service';
import prisma, { loadUserSettings } from '../../config/database';

const router = Router();

/**
 * POST /api/notifications/digest/trigger
 * Triggers an immediate pending tasks digest email for the authenticated student.
 */
router.post('/digest/trigger', authGuard, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await sendImmediateDigest(req.userId!);
    res.status(200).json({
      success: true,
      message: `Pending tasks summary email sent (${result.pendingTasksCount} tasks).`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/notifications/digest/preview
 * Returns the exact pending tasks summary email content without actually sending.
 */
router.get('/digest/preview', authGuard, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const preview = await getDigestPreview(req.userId!);
    res.status(200).json({
      success: true,
      data: preview,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/notifications/test-email
 * Sends a live test verification email from devnexes.support@gmail.com to the student's email.
 */
router.post('/test-email', authGuard, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let recipientEmail = req.body?.email?.trim();

    if (!recipientEmail) {
      const user = await prisma.user.findUnique({
        where: { id: req.userId || 'personal-user' },
        select: { email: true },
      });
      recipientEmail = user?.email || loadUserSettings().email;
    }

    if (!recipientEmail) {
      res.status(400).json({ success: false, message: 'Please provide an email address.' });
      return;
    }

    console.log(`[Email] Dispatching test notification from devnexes.support@gmail.com to: ${recipientEmail}`);

    const result = await emailService.sendEmail({
      to: recipientEmail,
      subject: 'StudySync AI — Test Notification (Devnexes Support)',
      text: `Hello,\n\nThis is a live test notification sent from devnexes.support@gmail.com!\n\nYour notification email has been verified and set to: ${recipientEmail}\n\nAll future task reminders, deadlines, and pending task digests will be delivered to this inbox.\n\nBest regards,\nStudySync AI (Devnexes Support)`,
    });

    res.status(200).json({
      success: true,
      message: `Test email sent to ${recipientEmail} from devnexes.support@gmail.com!`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
