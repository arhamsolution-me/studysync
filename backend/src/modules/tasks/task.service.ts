import prisma from '../../config/database';
import { CreateTaskInput, UpdateTaskInput } from './task.schema';
import { TaskStatus, TaskSource } from '@prisma/client';

class TaskService {
  /**
   * Create a new task for a user.
   */
  async createTask(userId: string, input: CreateTaskInput) {
    const task = await prisma.task.create({
      data: {
        userId,
        title: input.title,
        type: input.type,
        subject: input.subject || null,
        description: input.description || null,
        deadline: new Date(input.deadline),
        priority: input.priority,
        source: input.source as TaskSource,
        confirmed: input.source !== 'email', // Email-sourced tasks need confirmation
      },
    });

    return task;
  }

  /**
   * Get all tasks for a user (with optional filters).
   */
  async getUserTasks(
    userId: string,
    filters?: {
      status?: string;
      type?: string;
      startDate?: string;
      endDate?: string;
    }
  ) {
    const where: any = { userId };

    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.type) {
      where.type = filters.type;
    }
    if (filters?.startDate || filters?.endDate) {
      where.deadline = {};
      if (filters.startDate) where.deadline.gte = new Date(filters.startDate);
      if (filters.endDate) where.deadline.lte = new Date(filters.endDate);
    }

    return prisma.task.findMany({
      where,
      orderBy: { deadline: 'asc' },
      include: {
        reminders: {
          select: {
            id: true,
            channel: true,
            scheduledFor: true,
            status: true,
            sentAt: true,
          },
        },
      },
    });
  }

  /**
   * Get a single task by ID (with ownership check).
   */
  async getTaskById(userId: string, taskId: string) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, userId },
      include: {
        reminders: true,
      },
    });

    if (!task) {
      throw Object.assign(new Error('Task not found.'), { statusCode: 404 });
    }

    return task;
  }

  /**
   * Update a task (with ownership check).
   */
  async updateTask(userId: string, taskId: string, input: UpdateTaskInput) {
    // Verify ownership
    const existing = await prisma.task.findFirst({
      where: { id: taskId, userId },
    });

    if (!existing) {
      throw Object.assign(new Error('Task not found.'), { statusCode: 404 });
    }

    const updateData: any = { ...input };
    if (input.deadline) {
      updateData.deadline = new Date(input.deadline);
    }

    return prisma.task.update({
      where: { id: taskId },
      data: updateData,
    });
  }

  /**
   * Delete a task (with ownership check).
   */
  async deleteTask(userId: string, taskId: string) {
    const existing = await prisma.task.findFirst({
      where: { id: taskId, userId },
    });

    if (!existing) {
      throw Object.assign(new Error('Task not found.'), { statusCode: 404 });
    }

    await prisma.task.delete({ where: { id: taskId } });
  }

  /**
   * Get tasks for calendar view (date range query, optimized with index).
   */
  async getCalendarTasks(userId: string, start: string, end: string) {
    return prisma.task.findMany({
      where: {
        userId,
        status: { not: 'done' },
        deadline: {
          gte: new Date(start),
          lte: new Date(end),
        },
      },
      orderBy: { deadline: 'asc' },
      select: {
        id: true,
        title: true,
        type: true,
        subject: true,
        deadline: true,
        priority: true,
        status: true,
        source: true,
        confirmed: true,
      },
    });
  }

  /**
   * Get dashboard data: upcoming tasks + progress rollup.
   */
  async getDashboard(userId: string) {
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Next 5 upcoming tasks
    const upcoming = await prisma.task.findMany({
      where: {
        userId,
        status: 'pending',
        deadline: { gte: now },
      },
      orderBy: { deadline: 'asc' },
      take: 5,
      select: {
        id: true,
        title: true,
        type: true,
        subject: true,
        deadline: true,
        priority: true,
      },
    });

    // Monthly progress
    const [totalThisMonth, doneThisMonth] = await Promise.all([
      prisma.task.count({
        where: {
          userId,
          deadline: {
            gte: new Date(now.getFullYear(), now.getMonth(), 1),
            lte: endOfMonth,
          },
        },
      }),
      prisma.task.count({
        where: {
          userId,
          status: 'done',
          deadline: {
            gte: new Date(now.getFullYear(), now.getMonth(), 1),
            lte: endOfMonth,
          },
        },
      }),
    ]);

    // Unconfirmed email tasks
    const unconfirmedCount = await prisma.task.count({
      where: {
        userId,
        confirmed: false,
      },
    });

    return {
      upcoming,
      progress: {
        total: totalThisMonth,
        done: doneThisMonth,
        percentage: totalThisMonth > 0 ? Math.round((doneThisMonth / totalThisMonth) * 100) : 0,
      },
      unconfirmedTasks: unconfirmedCount,
    };
  }
}

export const taskService = new TaskService();
