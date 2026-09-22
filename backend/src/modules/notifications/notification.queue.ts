import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import prisma, { loadUserSettings } from '../../config/database';
import { config } from '../../config';
import { aiService } from '../ai/ai.service';
import { emailService } from './email.service';
import { whatsAppService } from '../whatsapp/whatsapp.service';
import { formatForWhatsApp } from '../whatsapp/whatsapp.formatter';

const REMINDER_QUEUE = 'reminder-notifications';
const DIGEST_QUEUE = 'pending-task-digest';

let reminderQueue: Queue | null = null;
let digestQueue: Queue | null = null;
let isRedisAvailable = false;

const redisConnectionConfig = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
  retryStrategy: (times: number) => (times > 1 ? null : 1000),
};

export async function checkAndInitRedisQueues(): Promise<boolean> {
  try {
    const probe = new IORedis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      connectTimeout: 800,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
      lazyConnect: true,
    });
    probe.on('error', () => {});
    await probe.connect();
    await probe.ping();
    await probe.quit();

    isRedisAvailable = true;
    console.log('[Queue] ✅ Connected to Redis — BullMQ workers active.');

    reminderQueue = new Queue(REMINDER_QUEUE, {
      connection: redisConnectionConfig,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 86400 },
        removeOnFail: { age: 604800 },
      },
    });
    reminderQueue.on('error', () => {});

    digestQueue = new Queue(DIGEST_QUEUE, {
      connection: redisConnectionConfig,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: { age: 86400 },
        removeOnFail: { age: 604800 },
      },
    });
    digestQueue.on('error', () => {});

    startReminderWorker();
    startDigestWorker();
    return true;
  } catch {
    isRedisAvailable = false;
    console.log('[Queue] ℹ️  Redis not running locally.');
    console.log('[Queue] 🚀 Running in Standalone Email Reminder Mode (No Redis/Docker required)');
    return false;
  }
}

// ─── Schedule Individual Reminder ─────────────────────────────────────

export async function scheduleReminder(
  taskId: string,
  channel: 'email' | 'whatsapp',
  scheduledFor: Date
) {
  const reminder = await prisma.reminder.create({
    data: {
      taskId,
      channel,
      scheduledFor,
      status: 'pending',
    },
  });

  if (isRedisAvailable && reminderQueue) {
    try {
      const delay = Math.max(0, scheduledFor.getTime() - Date.now());
      await reminderQueue.add(
        'send-reminder',
        {
          reminderId: reminder.id,
          taskId,
          channel,
        },
        { delay, jobId: `reminder-${reminder.id}` }
      );
    } catch (err) {
      // Redis unavailable: Standalone reminder engine handles dispatch
    }
  }

  return reminder;
}

// ─── Schedule All Reminders for a New Task (Day-Wise & Week-Wise) ──

export async function scheduleTaskReminders(taskId: string, userId?: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId },
  });

  if (!task) return;

  const now = new Date();
  const deadline = new Date(task.deadline);
  const deadlineMs = deadline.getTime();
  const diffDays = (deadlineMs - now.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays <= 0) return; // Task already in the past

  // Helper to set date to 9:00 AM morning for professional day-wise delivery
  const setMorningTime = (date: Date): Date => {
    const d = new Date(date);
    d.setHours(9, 0, 0, 0);
    return d;
  };

  // 1. Week-Wise Reminder: 1 Week (7 Days) Before Deadline
  if (diffDays >= 7) {
    const oneWeekBefore = setMorningTime(new Date(deadlineMs - 7 * 24 * 60 * 60 * 1000));
    if (oneWeekBefore > now) {
      await scheduleReminder(taskId, 'email', oneWeekBefore);
      console.log(`[Reminder] 📅 Scheduled 1-Week reminder for "${task.title}" at ${oneWeekBefore.toISOString()}`);
    }
  }

  // 2. Day-Wise Reminder: 3 Days Before Deadline
  if (diffDays >= 3) {
    const threeDaysBefore = setMorningTime(new Date(deadlineMs - 3 * 24 * 60 * 60 * 1000));
    if (threeDaysBefore > now) {
      await scheduleReminder(taskId, 'email', threeDaysBefore);
      console.log(`[Reminder] 📅 Scheduled 3-Day reminder for "${task.title}" at ${threeDaysBefore.toISOString()}`);
    }
  }

  // 3. Day-Wise Reminder: 1 Day Before Deadline (Email & WhatsApp)
  if (diffDays >= 1) {
    const oneDayBefore = setMorningTime(new Date(deadlineMs - 1 * 24 * 60 * 60 * 1000));
    if (oneDayBefore > now) {
      await scheduleReminder(taskId, 'email', oneDayBefore);
      await scheduleReminder(taskId, 'whatsapp', oneDayBefore);
      console.log(`[Reminder] 📅 Scheduled 1-Day WhatsApp & Email reminder for "${task.title}" at ${oneDayBefore.toISOString()}`);
    }
  }

  // 4. Day-Of Deadline Morning Reminder (9:00 AM on due date)
  const dueDayMorning = setMorningTime(new Date(deadlineMs));
  if (dueDayMorning > now && dueDayMorning.getTime() < deadlineMs) {
    await scheduleReminder(taskId, 'email', dueDayMorning);
    console.log(`[Reminder] 📅 Scheduled Due-Day morning reminder for "${task.title}" at ${dueDayMorning.toISOString()}`);
  } else if (now < deadline && diffDays < 1) {
    // If created today with deadline today, trigger immediate notification
    await scheduleReminder(taskId, 'email', now);
    await scheduleReminder(taskId, 'whatsapp', now);
    console.log(`[Reminder] ⚡ Due Today: Scheduled immediate WhatsApp & Email reminder for "${task.title}"`);
  }
}

// ─── Schedule Daily Pending Task Digest for a User ────────────────────

export async function scheduleDailyDigest(userId: string) {
  if (isRedisAvailable && digestQueue) {
    try {
      await digestQueue.upsertJobScheduler(
        `digest-${userId}`,
        { pattern: '0 8 * * *' },
        {
          name: 'daily-digest',
          data: { userId },
        }
      );
    } catch {}
  }
}

// ─── Generate Pending Tasks Summary Email ─────────────────────────────

async function generatePendingTasksEmail(
  userName: string,
  tasks: Array<{ title: string; type: string; deadline: Date; priority: string; subject: string | null }>
): Promise<{ subject: string; body: string }> {
  if (tasks.length === 0) {
    return {
      subject: 'Nothing pending — you\'re all caught up',
      body: `Hey ${userName},\n\nYou don't have any pending tasks right now. Enjoy the free time while it lasts.`,
    };
  }

  // Use Gemini to write a natural summary
  const aiSummary = await aiService.generateReminder(
    'email',
    `Pending tasks summary for ${userName}`,
    'digest',
    `${tasks.length} tasks remaining`
  );

  // Build the task list section
  const urgentTasks = tasks.filter((t) => t.priority === 'high');
  const upcomingTasks = tasks.filter((t) => t.priority !== 'high');

  let taskList = '';

  if (urgentTasks.length > 0) {
    taskList += '\n🔴 URGENT:\n';
    urgentTasks.forEach((t) => {
      const deadline = new Date(t.deadline);
      const timeStr = formatDeadline(deadline);
      taskList += `  • ${t.title}${t.subject ? ` (${t.subject})` : ''} — ${timeStr}\n`;
    });
  }

  if (upcomingTasks.length > 0) {
    taskList += '\n📋 UPCOMING:\n';
    upcomingTasks.forEach((t) => {
      const deadline = new Date(t.deadline);
      const timeStr = formatDeadline(deadline);
      taskList += `  • ${t.title}${t.subject ? ` (${t.subject})` : ''} — ${timeStr}\n`;
    });
  }

  const subject = urgentTasks.length > 0
    ? `${urgentTasks.length} urgent + ${upcomingTasks.length} more tasks pending`
    : `${tasks.length} task${tasks.length > 1 ? 's' : ''} still on your plate`;

  const body = `Hey ${userName},\n\nHere's what's still pending:${taskList}\n${aiSummary}\n\n— StudySync`;

  return { subject, body };
}

function formatDeadline(deadline: Date): string {
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (diff < 0) return 'OVERDUE';
  if (days === 0) return `due in ${hours}h`;
  if (days === 1) return 'due tomorrow';
  if (days <= 7) return `due in ${days} days`;
  return `due ${deadline.toLocaleDateString('en-PK', { month: 'short', day: 'numeric' })}`;
}

function formatTimeRemaining(deadline: Date): string {
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 1) return `in ${days} days`;
  if (days === 1) return 'tomorrow';
  if (hours > 1) return `in ${hours} hours`;
  if (hours === 1) return 'in about an hour';
  return 'very soon';
}

// ─── Individual Reminder Worker ───────────────────────────────────────

export function startReminderWorker() {
  if (!isRedisAvailable) return null;
  const worker = new Worker(
    REMINDER_QUEUE,
    async (job: Job) => {
      const { reminderId, taskId, channel } = job.data;

      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: { user: { select: { email: true, whatsappNumber: true, fullName: true } } },
      });

      if (!task || task.status !== 'pending') {
        await prisma.reminder.update({
          where: { id: reminderId },
          data: { status: 'sent', sentAt: new Date(), generatedMessage: '[Skipped: task no longer pending]' },
        });
        return;
      }

      const deadline = new Date(task.deadline);
      const dateFormatted = deadline.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const timeFormatted = deadline.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const timeRemaining = formatTimeRemaining(deadline);

      // Generate dynamic human-like reminder using AI model
      const { subject, body } = await aiService.generateHumanEmailReminder({
        userName: task.user?.fullName || 'Student',
        taskTitle: task.title,
        course: task.subject || 'General',
        taskType: task.type || 'task',
        dateFormatted,
        timeFormatted,
        timeRemaining,
      });

      // Dispatch
      if (channel === 'email' && task.user.email) {
        console.log(`[📧 Reminder] Dispatching human AI email to: ${task.user.email}`);
        await emailService.sendEmail({
          to: task.user.email,
          subject,
          text: body,
        });
      } else if (task.user.whatsappNumber) {
        console.log(`[📱 WhatsApp] To: ${task.user.whatsappNumber}`);
        console.log(`   Message: ${body}`);
        if (whatsAppService.isConnected) {
          await whatsAppService.sendMessage(task.user.whatsappNumber, formatForWhatsApp(body));
        }
      }

      await prisma.reminder.update({
        where: { id: reminderId },
        data: {
          status: 'sent',
          sentAt: new Date(),
          generatedMessage: body,
        },
      });
    },
    {
      connection: redisConnectionConfig,
      concurrency: 5,
    }
  );

  worker.on('error', () => {});
  worker.on('completed', (job) => {
    console.log(`[Reminder] ✅ Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Reminder] ❌ Job ${job?.id} failed:`, err.message);
  });

  console.log('[Reminder Worker] Started and listening for jobs');
  return worker;
}

// ─── Daily Digest Worker (Pending Tasks Summary Email) ────────────────

export function startDigestWorker() {
  if (!isRedisAvailable) return null;
  const worker = new Worker(
    DIGEST_QUEUE,
    async (job: Job) => {
      const { userId } = job.data;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true, email: true },
      });

      if (!user) return;

      // Get all pending tasks for this user
      const pendingTasks = await prisma.task.findMany({
        where: {
          userId,
          status: 'pending',
        },
        orderBy: [
          { priority: 'desc' }, // high first
          { deadline: 'asc' },  // soonest first
        ],
        select: {
          title: true,
          type: true,
          deadline: true,
          priority: true,
          subject: true,
        },
      });

      // Generate the summary email
      const email = await generatePendingTasksEmail(user.fullName, pendingTasks);

      console.log(`\n[📬 Daily Digest] Sending to: ${user.email} (${pendingTasks.length} pending tasks)`);
      await emailService.sendEmail({
        to: user.email,
        subject: email.subject,
        text: email.body,
      });
    },
    {
      connection: redisConnectionConfig,
      concurrency: 3,
    }
  );

  worker.on('error', () => {});
  worker.on('completed', (job) => {
    console.log(`[Digest] ✅ Daily digest ${job.id} sent`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Digest] ❌ Digest ${job?.id} failed:`, err.message);
  });

  console.log('[Digest Worker] Started — daily pending task summaries enabled');
  return worker;
}

// ─── Immediate Digest Trigger & Preview (For Manual Test / On-demand) ─

export async function sendImmediateDigest(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fullName: true, email: true },
  });

  if (!user) throw new Error('User not found');

  const pendingTasks = await prisma.task.findMany({
    where: {
      userId,
      status: 'pending',
    },
    orderBy: [
      { priority: 'desc' },
      { deadline: 'asc' },
    ],
    select: {
      title: true,
      type: true,
      deadline: true,
      priority: true,
      subject: true,
    },
  });

  const email = await generatePendingTasksEmail(user.fullName, pendingTasks);
  const result = await emailService.sendEmail({
    to: user.email,
    subject: email.subject,
    text: email.body,
  });

  return {
    email,
    sent: result.success,
    previewUrl: result.previewUrl,
    pendingTasksCount: pendingTasks.length,
  };
}

export async function getDigestPreview(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fullName: true, email: true },
  });

  if (!user) throw new Error('User not found');

  const pendingTasks = await prisma.task.findMany({
    where: {
      userId,
      status: 'pending',
    },
    orderBy: [
      { priority: 'desc' },
      { deadline: 'asc' },
    ],
    select: {
      title: true,
      type: true,
      deadline: true,
      priority: true,
      subject: true,
    },
  });

  const email = await generatePendingTasksEmail(user.fullName, pendingTasks);
  return {
    email,
    userEmail: user.email,
    pendingTasksCount: pendingTasks.length,
  };
}

// ─── Standalone In-Memory Polling Engine (Active with or without Redis) ──

export function startStandaloneReminderEngine() {
  console.log('[Reminder Engine] 🚀 Standalone email reminder engine started (checking every 30s)');

  const checkDueReminders = async () => {
    try {
      const now = new Date();
      const dueReminders = await prisma.reminder.findMany({
        where: {
          status: 'pending',
          scheduledFor: { lte: now },
        },
      });

      for (const rem of dueReminders) {
        try {
          const task = await prisma.task.findUnique({
            where: { id: rem.taskId },
            include: { user: { select: { email: true, fullName: true, whatsappNumber: true } } },
          });

          if (!task || task.status !== 'pending') {
            await prisma.reminder.update({
              where: { id: rem.id },
              data: { status: 'sent', sentAt: now, generatedMessage: '[Skipped: task cancelled or completed]' },
            });
            continue;
          }

          const userEmail = task.user?.email || process.env.SMTP_USER || 'devnexes.support@gmail.com';
          const userName = task.user?.fullName || 'Student';

          const deadline = new Date(task.deadline);
          const dateFormatted = deadline.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
          const timeFormatted = deadline.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          });
          const timeRemaining = formatTimeRemaining(deadline);

          // ─── Channel Dispatch: WhatsApp ─────────────────────────
          if (rem.channel === 'whatsapp') {
            const settings = loadUserSettings();
            const targetPhone =
              task.user?.whatsappNumber ||
              whatsAppService.phoneNumber ||
              settings.whatsappNumber;

            if (targetPhone && whatsAppService.isConnected) {
              const waBody = await aiService.generateWhatsAppStudyPlanReminder({
                userName,
                taskTitle: task.title,
                course: task.subject || 'General',
                taskType: task.type || 'task',
                dateFormatted,
                timeFormatted,
              });

              console.log(`[📱 WhatsApp Dispatch] Sending proactive 24h study plan reminder for "${task.title}" to +${targetPhone}...`);
              await whatsAppService.sendMessage(targetPhone, waBody);

              await prisma.reminder.update({
                where: { id: rem.id },
                data: {
                  status: 'sent',
                  sentAt: new Date(),
                  generatedMessage: waBody,
                },
              });
              console.log(`[📱 WhatsApp Dispatch] ✅ Successfully sent WhatsApp reminder for "${task.title}"!`);
            } else {
              console.log(`[📱 WhatsApp Dispatch] ⏳ WhatsApp target phone not linked (+${targetPhone || 'none'}). Waiting for connection.`);
            }
            continue;
          }

          // ─── Channel Dispatch: Email ────────────────────────────
          // Generate dynamic human-like reminder paragraph using AI model in proper English
          const { subject, body } = await aiService.generateHumanEmailReminder({
            userName,
            taskTitle: task.title,
            course: task.subject || 'General',
            taskType: task.type || 'task',
            dateFormatted,
            timeFormatted,
            timeRemaining,
          });

          console.log(`[📧 Email Dispatch] Sending AI human reminder for "${task.title}" to ${userEmail}...`);
          await emailService.sendEmail({
            to: userEmail,
            subject,
            text: body,
          });

          await prisma.reminder.update({
            where: { id: rem.id },
            data: {
              status: 'sent',
              sentAt: new Date(),
              generatedMessage: body,
            },
          });
          console.log(`[📧 Email Dispatch] ✅ Successfully sent reminder for "${task.title}"!`);
        } catch (itemErr: any) {
          console.error(`[Reminder Dispatch Error]:`, itemErr.message);
        }
      }
    } catch (err: any) {
      // Background check error
    }
  };

  // Run initial check after 2 seconds
  setTimeout(checkDueReminders, 2000);
  // Check every 30 seconds
  return setInterval(checkDueReminders, 30000);
}


