import { Router } from 'express';
import { taskController } from './task.controller';
import { authGuard, validate, auditLog } from '../../middleware';
import { createTaskSchema, updateTaskSchema, calendarQuerySchema } from './task.schema';

const router = Router();

// All task routes require authentication
router.use(authGuard);

// Dashboard & Calendar (must come before /:id routes)
router.get('/dashboard', taskController.dashboard);
router.get(
  '/calendar',
  validate(calendarQuerySchema, 'query'),
  taskController.calendar
);

// CRUD
router.post(
  '/',
  validate(createTaskSchema),
  auditLog('task_created'),
  taskController.create
);

router.get('/', taskController.getAll);
router.get('/:id', taskController.getOne);

router.patch(
  '/:id',
  validate(updateTaskSchema),
  auditLog('task_updated'),
  taskController.update
);

router.delete(
  '/:id',
  auditLog('task_deleted'),
  taskController.remove
);

export default router;
