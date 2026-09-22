import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z
    .string()
    .min(1, 'Task title is required')
    .max(200, 'Title is too long'),
  type: z.enum(['quiz', 'assignment', 'project', 'exam', 'personal', 'other']),
  subject: z.string().max(100).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  deadline: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    'Please provide a valid date and time for the deadline'
  ),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  source: z.enum(['voice', 'email', 'manual']).default('manual'),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  type: z.enum(['quiz', 'assignment', 'project', 'exam', 'personal', 'other']).optional(),
  subject: z.string().max(100).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  deadline: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), 'Invalid deadline date')
    .optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  status: z.enum(['pending', 'done', 'missed']).optional(),
  confirmed: z.boolean().optional(),
});

export const calendarQuerySchema = z.object({
  start: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid start date'),
  end: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid end date'),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
