import { Router, Request, Response } from 'express';
import { authGuard, requireRole } from '../../middleware/authGuard';
import { adminService } from './admin.service';

const router = Router();

// Enforce authentication and strict Admin role for all routes in this module
router.use(authGuard as any);
router.use(requireRole('admin') as any);

/**
 * GET /api/admin/overview
 * System-wide KPIs, active users, tasks, courses, and AI breakdown
 */
router.get('/overview', async (_req: Request, res: Response) => {
  try {
    const overview = await adminService.getOverview();
    res.json({ success: true, data: overview });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/admin/users
 * Searchable, paginated student directory with course, task, and BYOK metrics
 */
router.get('/users', async (req: Request, res: Response) => {
  try {
    const result = await adminService.getUsers({
      search: req.query.search as string,
      plan: req.query.plan as string,
      status: req.query.status as string,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 20,
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/admin/users/:id/plan
 * Update a student's subscription plan (free, pro, campus)
 */
router.patch('/users/:id/plan', async (req: Request, res: Response) => {
  try {
    const { plan } = req.body;
    if (!plan || !['free', 'pro', 'campus'].includes(plan)) {
      res.status(400).json({
        success: false,
        message: 'Invalid plan. Allowed plans are: free, pro, campus.',
      });
      return;
    }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await adminService.updateUserPlan(id, plan);
    res.json(result);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/admin/users/:id/status
 * Block or unblock a user account
 */
router.patch('/users/:id/status', async (req: Request, res: Response) => {
  try {
    const { isBlocked } = req.body;
    if (typeof isBlocked !== 'boolean') {
      res.status(400).json({
        success: false,
        message: 'isBlocked must be a boolean (true or false).',
      });
      return;
    }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await adminService.updateUserStatus(id, isBlocked);
    res.json(result);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/admin/courses
 * Moderation directory for all courses across all students
 */
router.get('/courses', async (req: Request, res: Response) => {
  try {
    const result = await adminService.getCourses({
      search: req.query.search as string,
      status: req.query.status as string,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 20,
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/admin/courses/:id/status
 * Block or unblock a course
 */
router.patch('/courses/:id/status', async (req: Request, res: Response) => {
  try {
    const { isBlocked } = req.body;
    if (typeof isBlocked !== 'boolean') {
      res.status(400).json({
        success: false,
        message: 'isBlocked must be a boolean (true or false).',
      });
      return;
    }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await adminService.updateCourseStatus(id, isBlocked);
    res.json(result);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/admin/ai-usage
 * Overview of AI tokens, BYOK keys, and system quotas
 */
router.get('/ai-usage', async (_req: Request, res: Response) => {
  try {
    const metrics = await adminService.getAiUsageMetrics();
    res.json({ success: true, data: metrics });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
