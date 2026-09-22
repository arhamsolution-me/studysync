import { Response, NextFunction } from 'express';
import { taskService } from './task.service';
import { AuthRequest } from '../../middleware/authGuard';
import { scheduleTaskReminders } from '../notifications/notification.queue';
import prisma from '../../config/database';

class TaskController {
  /**
   * POST /api/tasks
   */
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const task = await taskService.createTask(req.userId!, req.body);

      // Automatically schedule reminder based on user's lead time setting
      try {
        await scheduleTaskReminders(task.id, req.userId!);
      } catch (queueErr) {
        // Safe fallback if redis/queue offline
      }

      res.status(201).json({
        success: true,
        message: 'Task added to your calendar.',
        data: { task },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/tasks
   */
  async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { status, type, startDate, endDate } = req.query as any;
      const tasks = await taskService.getUserTasks(req.userId!, {
        status,
        type,
        startDate,
        endDate,
      });

      res.status(200).json({
        success: true,
        data: { tasks, count: tasks.length },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/tasks/:id
   */
  async getOne(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const task = await taskService.getTaskById(req.userId!, req.params.id as string);

      res.status(200).json({
        success: true,
        data: { task },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/tasks/:id
   */
  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const task = await taskService.updateTask(req.userId!, req.params.id as string, req.body);

      // If deadline changed, purge outdated pending reminders and reschedule for new deadline
      if (req.body.deadline) {
        try {
          await prisma.reminder.deleteMany({
            where: { taskId: task.id, status: 'pending' },
          });
          await scheduleTaskReminders(task.id, req.userId!);
        } catch (queueErr) {
          // Safe fallback
        }
      }

      res.status(200).json({
        success: true,
        message: 'Task updated.',
        data: { task },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/tasks/:id
   */
  async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await taskService.deleteTask(req.userId!, req.params.id as string);

      try {
        await prisma.reminder.deleteMany({
          where: { taskId: req.params.id as string },
        });
      } catch (err) {
        // Safe fallback
      }

      res.status(200).json({
        success: true,
        message: 'Task removed.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/tasks/calendar?start=...&end=...
   */
  async calendar(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { start, end } = req.query as { start: string; end: string };
      const tasks = await taskService.getCalendarTasks(req.userId!, start, end);

      res.status(200).json({
        success: true,
        data: { tasks },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/tasks/dashboard
   */
  async dashboard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await taskService.getDashboard(req.userId!);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const taskController = new TaskController();
