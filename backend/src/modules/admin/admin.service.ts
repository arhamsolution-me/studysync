import prisma from '../../config/database';
import { supabase, toCamelCase } from '../../config/supabase';

export interface AdminUserListItem {
  id: string;
  fullName: string;
  email: string;
  role: string;
  plan: string;
  isBlocked: boolean;
  isVerified: boolean;
  university?: string;
  major?: string;
  aiProviderPreference: string;
  activeByokProvider?: string;
  coursesCount: number;
  tasksCount: number;
  chatMessagesCount: number;
  createdAt: string;
  lastActive?: string;
}

export interface AdminCourseListItem {
  id: string;
  name: string;
  colorTag?: string;
  isBlocked: boolean;
  createdAt: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  materialsCount: number;
  chatMessagesCount: number;
}

class AdminService {
  /**
   * High-level KPI and system activity overview
   */
  async getOverview() {
    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // 1. User metrics
      const [
        totalUsersRes,
        newUsersWeekRes,
        proUsersRes,
        campusUsersRes,
        byokUsersRes,
        blockedUsersRes,
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('plan', 'pro'),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('plan', 'campus'),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('ai_provider_preference', 'byok'),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_blocked', true),
      ]);

      const totalUsers = totalUsersRes.count || 0;
      const newUsersWeek = newUsersWeekRes.count || 0;
      const proUsers = proUsersRes.count || 0;
      const campusUsers = campusUsersRes.count || 0;
      const freeUsers = Math.max(0, totalUsers - proUsers - campusUsers);
      const byokUsers = byokUsersRes.count || 0;
      const systemAiUsers = Math.max(0, totalUsers - byokUsers);
      const blockedUsers = blockedUsersRes.count || 0;

      // 2. Content & Activity metrics
      const [
        totalTasksRes,
        completedTasksRes,
        totalCoursesRes,
        blockedCoursesRes,
        totalMessagesRes,
        totalMaterialsRes,
      ] = await Promise.all([
        supabase.from('tasks').select('*', { count: 'exact', head: true }),
        supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'done'),
        supabase.from('courses').select('*', { count: 'exact', head: true }),
        supabase.from('courses').select('*', { count: 'exact', head: true }).eq('is_blocked', true),
        supabase.from('chat_messages').select('*', { count: 'exact', head: true }),
        supabase.from('course_materials').select('*', { count: 'exact', head: true }),
      ]);

      // 3. Recent 5 signups
      const { data: recentUsers } = await supabase
        .from('users')
        .select('id, full_name, email, role, plan, created_at, ai_provider_preference, is_blocked')
        .order('created_at', { ascending: false })
        .limit(5);

      return {
        users: {
          total: totalUsers,
          newThisWeek: newUsersWeek,
          blocked: blockedUsers,
          planBreakdown: {
            free: freeUsers,
            pro: proUsers,
            campus: campusUsers,
          },
          aiModeBreakdown: {
            system: systemAiUsers,
            byok: byokUsers,
          },
        },
        activity: {
          totalTasks: totalTasksRes.count || 0,
          completedTasks: completedTasksRes.count || 0,
          totalCourses: totalCoursesRes.count || 0,
          blockedCourses: blockedCoursesRes.count || 0,
          totalChatMessages: totalMessagesRes.count || 0,
          totalMaterials: totalMaterialsRes.count || 0,
        },
        recentSignups: (recentUsers || []).map(toCamelCase),
      };
    } catch (err: any) {
      console.error('[AdminService] getOverview error:', err);
      throw new Error(`Failed to calculate system overview: ${err.message}`);
    }
  }

  /**
   * Searchable, filterable list of all registered students with full usage statistics
   */
  async getUsers(params: {
    search?: string;
    plan?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    try {
      let query = supabase
        .from('users')
        .select('id, full_name, email, role, plan, is_blocked, is_verified, university, major, ai_provider_preference, active_byok_provider, created_at, updated_at', { count: 'exact' });

      if (params.search && params.search.trim()) {
        const s = params.search.trim().toLowerCase();
        query = query.or(`email.ilike.%${s}%,full_name.ilike.%${s}%`);
      }

      if (params.plan && params.plan !== 'all') {
        query = query.eq('plan', params.plan);
      }

      if (params.status === 'blocked') {
        query = query.eq('is_blocked', true);
      } else if (params.status === 'active') {
        query = query.eq('is_blocked', false);
      }

      query = query
        .order('created_at', { ascending: false })
        .range(skip, skip + limit - 1);

      const { data: users, count, error } = await query;
      if (error) {
        throw new Error(`Failed to query users: ${error.message}`);
      }

      const userIds = (users || []).map((u) => u.id);

      // Fetch aggregated counts for these users in batch
      const [coursesRes, tasksRes, messagesRes] = await Promise.all([
        userIds.length > 0 ? supabase.from('courses').select('user_id').in('user_id', userIds) : { data: [] },
        userIds.length > 0 ? supabase.from('tasks').select('user_id').in('user_id', userIds) : { data: [] },
        userIds.length > 0 ? supabase.from('chat_messages').select('user_id').in('user_id', userIds) : { data: [] },
      ]);

      const courseCountMap = new Map<string, number>();
      (coursesRes.data || []).forEach((row: any) => {
        courseCountMap.set(row.user_id, (courseCountMap.get(row.user_id) || 0) + 1);
      });

      const taskCountMap = new Map<string, number>();
      (tasksRes.data || []).forEach((row: any) => {
        taskCountMap.set(row.user_id, (taskCountMap.get(row.user_id) || 0) + 1);
      });

      const messageCountMap = new Map<string, number>();
      (messagesRes.data || []).forEach((row: any) => {
        messageCountMap.set(row.user_id, (messageCountMap.get(row.user_id) || 0) + 1);
      });

      const enrichedUsers: AdminUserListItem[] = (users || []).map((u: any) => {
        const camel = toCamelCase(u) as any;
        return {
          id: camel.id,
          fullName: camel.fullName || 'Student',
          email: camel.email || '',
          role: camel.role || 'student',
          plan: camel.plan || 'free',
          isBlocked: Boolean(camel.isBlocked),
          isVerified: Boolean(camel.isVerified),
          university: camel.university,
          major: camel.major,
          aiProviderPreference: camel.aiProviderPreference || 'system',
          activeByokProvider: camel.activeByokProvider,
          coursesCount: courseCountMap.get(camel.id) || 0,
          tasksCount: taskCountMap.get(camel.id) || 0,
          chatMessagesCount: messageCountMap.get(camel.id) || 0,
          createdAt: camel.createdAt,
          lastActive: camel.updatedAt || camel.createdAt,
        };
      });

      return {
        users: enrichedUsers,
        pagination: {
          total: count || 0,
          page,
          limit,
          totalPages: Math.ceil((count || 0) / limit),
        },
      };
    } catch (err: any) {
      console.error('[AdminService] getUsers error:', err);
      throw new Error(`Failed to list users: ${err.message}`);
    }
  }

  /**
   * Update a student's subscription plan directly from admin dashboard
   */
  async updateUserPlan(userId: string, plan: 'free' | 'pro' | 'campus') {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw Object.assign(new Error('User not found.'), { statusCode: 404 });
      }

      // 1. Update user record
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { plan } as any,
      });

      // 2. Sync / insert subscription row
      try {
        const existingSub = await prisma.subscription.findFirst({ where: { userId } });
        if (existingSub) {
          await prisma.subscription.update({
            where: { id: existingSub.id },
            data: { plan, status: 'active' } as any,
          });
        } else {
          await prisma.subscription.create({
            data: {
              userId,
              plan,
              status: 'active',
            } as any,
          });
        }
      } catch (subErr: any) {
        console.warn('[AdminService] Subscription record sync notice:', subErr.message);
      }

      return {
        success: true,
        message: `Plan for ${user.email} successfully updated to ${plan.toUpperCase()}.`,
        user: updatedUser,
      };
    } catch (err: any) {
      console.error('[AdminService] updateUserPlan error:', err);
      throw err;
    }
  }

  /**
   * Block or unblock a user account
   */
  async updateUserStatus(userId: string, isBlocked: boolean) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw Object.assign(new Error('User not found.'), { statusCode: 404 });
      }

      const { data, error } = await supabase
        .from('users')
        .update({ is_blocked: isBlocked, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select('id, email, is_blocked')
        .single();

      if (error) {
        throw new Error(`Failed to update status: ${error.message}`);
      }

      return {
        success: true,
        message: isBlocked
          ? `User ${user.email} has been suspended.`
          : `User ${user.email} has been unblocked.`,
        user: toCamelCase(data),
      };
    } catch (err: any) {
      console.error('[AdminService] updateUserStatus error:', err);
      throw err;
    }
  }

  /**
   * Searchable list of all courses across all students for moderation
   */
  async getCourses(params: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    try {
      let query = supabase
        .from('courses')
        .select('id, user_id, name, color_tag, is_blocked, created_at', { count: 'exact' });

      if (params.search && params.search.trim()) {
        query = query.ilike('name', `%${params.search.trim()}%`);
      }

      if (params.status === 'blocked') {
        query = query.eq('is_blocked', true);
      } else if (params.status === 'active') {
        query = query.eq('is_blocked', false);
      }

      query = query
        .order('created_at', { ascending: false })
        .range(skip, skip + limit - 1);

      const { data: courses, count, error } = await query;
      if (error) {
        throw new Error(`Failed to query courses: ${error.message}`);
      }

      const courseList = courses || [];
      const userIds = Array.from(new Set(courseList.map((c) => c.user_id)));
      const courseIds = courseList.map((c) => c.id);

      // Fetch user owners
      const { data: users } = userIds.length > 0
        ? await supabase.from('users').select('id, full_name, email').in('id', userIds)
        : { data: [] };

      const userMap = new Map<string, { fullName: string; email: string }>();
      (users || []).forEach((u: any) => {
        userMap.set(u.id, { fullName: u.full_name, email: u.email });
      });

      // Fetch material & chat counts
      const [matRes, chatRes] = await Promise.all([
        courseIds.length > 0 ? supabase.from('course_materials').select('course_id').in('course_id', courseIds) : { data: [] },
        courseIds.length > 0 ? supabase.from('chat_messages').select('course_id').in('course_id', courseIds) : { data: [] },
      ]);

      const matCountMap = new Map<string, number>();
      (matRes.data || []).forEach((m: any) => {
        matCountMap.set(m.course_id, (matCountMap.get(m.course_id) || 0) + 1);
      });

      const chatCountMap = new Map<string, number>();
      (chatRes.data || []).forEach((c: any) => {
        chatCountMap.set(c.course_id, (chatCountMap.get(c.course_id) || 0) + 1);
      });

      const enrichedCourses: AdminCourseListItem[] = courseList.map((c: any) => {
        const camel = toCamelCase(c);
        const owner = userMap.get(camel.userId) || { fullName: 'Unknown Student', email: 'unknown' };
        return {
          id: camel.id,
          name: camel.name,
          colorTag: camel.colorTag,
          isBlocked: Boolean(camel.isBlocked),
          createdAt: camel.createdAt,
          ownerId: camel.userId,
          ownerName: owner.fullName,
          ownerEmail: owner.email,
          materialsCount: matCountMap.get(camel.id) || 0,
          chatMessagesCount: chatCountMap.get(camel.id) || 0,
        };
      });

      return {
        courses: enrichedCourses,
        pagination: {
          total: count || 0,
          page,
          limit,
          totalPages: Math.ceil((count || 0) / limit),
        },
      };
    } catch (err: any) {
      console.error('[AdminService] getCourses error:', err);
      throw new Error(`Failed to list courses: ${err.message}`);
    }
  }

  /**
   * Block or unblock a course
   */
  async updateCourseStatus(courseId: string, isBlocked: boolean) {
    try {
      const course = await prisma.course.findUnique({ where: { id: courseId } });
      if (!course) {
        throw Object.assign(new Error('Course not found.'), { statusCode: 404 });
      }

      const { data, error } = await supabase
        .from('courses')
        .update({ is_blocked: isBlocked, updated_at: new Date().toISOString() })
        .eq('id', courseId)
        .select('id, name, is_blocked')
        .single();

      if (error) {
        throw new Error(`Failed to update course status: ${error.message}`);
      }

      return {
        success: true,
        message: isBlocked
          ? `Course "${course.name}" has been suspended.`
          : `Course "${course.name}" has been unblocked.`,
        course: toCamelCase(data),
      };
    } catch (err: any) {
      console.error('[AdminService] updateCourseStatus error:', err);
      throw err;
    }
  }

  /**
   * Detailed insight into AI Provider and Token Quotas
   */
  async getAiUsageMetrics() {
    try {
      const [
        totalKeysRes,
        geminiKeysRes,
        groqKeysRes,
        openaiKeysRes,
        byokUsersRes,
        systemUsersRes,
      ] = await Promise.all([
        supabase.from('user_api_keys').select('*', { count: 'exact', head: true }),
        supabase.from('user_api_keys').select('*', { count: 'exact', head: true }).eq('provider', 'gemini'),
        supabase.from('user_api_keys').select('*', { count: 'exact', head: true }).eq('provider', 'groq'),
        supabase.from('user_api_keys').select('*', { count: 'exact', head: true }).eq('provider', 'openai'),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('ai_provider_preference', 'byok'),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('ai_provider_preference', 'system'),
      ]);

      return {
        keysRegistered: {
          total: totalKeysRes.count || 0,
          gemini: geminiKeysRes.count || 0,
          groq: groqKeysRes.count || 0,
          openai: openaiKeysRes.count || 0,
        },
        userPreferences: {
          byok: byokUsersRes.count || 0,
          system: systemUsersRes.count || 0,
        },
        plansQuotas: {
          free: {
            monthlyTokenLimit: 50000,
            aiModels: 'Gemini 2.5 Flash (System Key)',
            maxCourses: 3,
          },
          pro: {
            monthlyTokenLimit: 500000,
            aiModels: 'Gemini 2.5 Flash / Pro + Groq Llama 3.3 (System Key)',
            maxCourses: 15,
          },
          campus: {
            monthlyTokenLimit: 'Unlimited',
            aiModels: 'All System Models + Custom BYOK Keys (OpenAI, Gemini, Groq)',
            maxCourses: 'Unlimited',
          },
        },
      };
    } catch (err: any) {
      console.error('[AdminService] getAiUsageMetrics error:', err);
      throw new Error(`Failed to load AI usage metrics: ${err.message}`);
    }
  }
}

export const adminService = new AdminService();
