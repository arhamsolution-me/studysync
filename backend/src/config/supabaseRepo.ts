import crypto from 'crypto';
import { supabase, toSnakeCase, toCamelCase } from './supabase';

export const supabaseRepo: any = {
  user: {
    findUnique: async ({ where }: { where: { email?: string; id?: string } }) => {
      try {
        let query = supabase.from('users').select('*');
        if (where.email) {
          query = query.ilike('email', where.email.trim().toLowerCase());
        } else if (where.id) {
          query = query.eq('id', where.id);
        } else {
          return null;
        }

        const { data, error } = await query.maybeSingle();
        if (error || !data) return null;
        return toCamelCase(data);
      } catch (err) {
        console.error('[SupabaseRepo] user.findUnique error:', err);
        return null;
      }
    },

    findFirst: async ({ where }: { where?: any } = {}) => {
      try {
        let query = supabase.from('users').select('*');
        if (where?.id) query = query.eq('id', where.id);
        if (where?.email) query = query.ilike('email', where.email.trim().toLowerCase());
        const { data, error } = await query.limit(1).maybeSingle();
        if (error || !data) return null;
        return toCamelCase(data);
      } catch (err) {
        console.error('[SupabaseRepo] user.findFirst error:', err);
        return null;
      }
    },

    create: async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const payload = toSnakeCase({
        id,
        role: 'student',
        reminderLeadTimeMins: 1440,
        isOnboarded: false,
        plan: 'free',
        aiProviderPreference: 'system',
        ...data,
      });

      const { data: created, error } = await supabase
        .from('users')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        console.error('[SupabaseRepo] user.create error:', error);
        throw new Error(`Failed to create user in Supabase: ${error.message}`);
      }
      return toCamelCase(created);
    },

    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const payload = toSnakeCase({
        ...data,
        updatedAt: new Date().toISOString(),
      });

      const { data: updated, error } = await supabase
        .from('users')
        .update(payload)
        .eq('id', where.id)
        .select('*')
        .single();

      if (error) {
        console.error('[SupabaseRepo] user.update error:', error);
        throw new Error(`Failed to update user in Supabase: ${error.message}`);
      }
      return toCamelCase(updated);
    },
  },

  course: {
    findMany: async ({ where, orderBy }: { where?: any; orderBy?: any } = {}) => {
      try {
        let query = supabase.from('courses').select('*');
        if (where?.userId) query = query.eq('user_id', where.userId);
        if (orderBy?.createdAt === 'desc') {
          query = query.order('created_at', { ascending: false });
        } else {
          query = query.order('created_at', { ascending: true });
        }

        const { data, error } = await query;
        if (error || !data) return [];
        return data.map(toCamelCase);
      } catch (err) {
        console.error('[SupabaseRepo] course.findMany error:', err);
        return [];
      }
    },

    findFirst: async ({ where }: { where: any }) => {
      try {
        let query = supabase.from('courses').select('*');
        if (where?.id) query = query.eq('id', where.id);
        if (where?.userId) query = query.eq('user_id', where.userId);
        const { data, error } = await query.limit(1).maybeSingle();
        if (error || !data) return null;
        return toCamelCase(data);
      } catch (err) {
        console.error('[SupabaseRepo] course.findFirst error:', err);
        return null;
      }
    },

    findUnique: async ({ where }: { where: { id: string } }) => {
      try {
        const { data, error } = await supabase
          .from('courses')
          .select('*')
          .eq('id', where.id)
          .maybeSingle();
        if (error || !data) return null;
        return toCamelCase(data);
      } catch (err) {
        console.error('[SupabaseRepo] course.findUnique error:', err);
        return null;
      }
    },

    create: async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const payload = toSnakeCase({
        id,
        ...data,
      });

      const { data: created, error } = await supabase
        .from('courses')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        console.error('[SupabaseRepo] course.create error:', error);
        throw new Error(`Failed to create course in Supabase: ${error.message}`);
      }
      return toCamelCase(created);
    },

    delete: async ({ where }: { where: { id: string } }) => {
      const { data, error } = await supabase
        .from('courses')
        .delete()
        .eq('id', where.id)
        .select('*')
        .maybeSingle();

      if (error) {
        console.error('[SupabaseRepo] course.delete error:', error);
        throw new Error(`Failed to delete course in Supabase: ${error.message}`);
      }
      return data ? toCamelCase(data) : null;
    },
  },

  task: {
    findMany: async ({ where, orderBy, take, include }: { where?: any; orderBy?: any; take?: number; include?: any } = {}) => {
      try {
        let query = supabase.from('tasks').select('*');
        if (where?.userId) query = query.eq('user_id', where.userId);
        if (where?.courseId) query = query.eq('course_id', where.courseId);
        if (where?.id) {
          if (typeof where.id === 'object' && Array.isArray(where.id.in)) {
            query = query.in('id', where.id.in);
          } else {
            query = query.eq('id', where.id);
          }
        }
        if (where?.status) {
          if (typeof where.status === 'object') {
            if (where.status.not !== undefined) query = query.neq('status', where.status.not);
            if (Array.isArray(where.status.in)) query = query.in('status', where.status.in);
          } else {
            query = query.eq('status', where.status);
          }
        }
        if (where?.type) {
          if (typeof where.type === 'object') {
            if (where.type.not !== undefined) query = query.neq('type', where.type.not);
            if (Array.isArray(where.type.in)) query = query.in('type', where.type.in);
          } else {
            query = query.eq('type', where.type);
          }
        }
        if (where?.confirmed !== undefined) {
          query = query.eq('confirmed', where.confirmed);
        }
        if (where?.deadline) {
          if (where.deadline.gte) query = query.gte('deadline', new Date(where.deadline.gte).toISOString());
          if (where.deadline.lte) query = query.lte('deadline', new Date(where.deadline.lte).toISOString());
          if (where.deadline.gt) query = query.gt('deadline', new Date(where.deadline.gt).toISOString());
          if (where.deadline.lt) query = query.lt('deadline', new Date(where.deadline.lt).toISOString());
        }

        if (orderBy?.deadline === 'desc') {
          query = query.order('deadline', { ascending: false });
        } else {
          query = query.order('deadline', { ascending: true });
        }

        if (take && typeof take === 'number') {
          query = query.limit(take);
        }

        const { data, error } = await query;
        if (error || !data) return [];
        const tasks = data.map(toCamelCase);

        if (include?.reminders && tasks.length > 0) {
          const taskIds = tasks.map((t: any) => t.id);
          const { data: reminders } = await supabase
            .from('reminders')
            .select('*')
            .in('task_id', taskIds);
          const mappedReminders = (reminders || []).map(toCamelCase);
          tasks.forEach((t: any) => {
            t.reminders = mappedReminders.filter((r: any) => r.taskId === t.id);
          });
        }

        return tasks;
      } catch (err) {
        console.error('[SupabaseRepo] task.findMany error:', err);
        return [];
      }
    },

    findFirst: async ({ where, include }: { where: any; include?: any }) => {
      try {
        const results = await supabaseRepo.task.findMany({ where, take: 1, include });
        return results[0] || null;
      } catch (err) {
        console.error('[SupabaseRepo] task.findFirst error:', err);
        return null;
      }
    },

    findUnique: async ({ where, include }: { where: { id: string }; include?: any }) => {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('id', where.id)
          .maybeSingle();

        if (error || !data) return null;
        const task = toCamelCase(data);

        if (include?.reminders) {
          const { data: reminders } = await supabase
            .from('reminders')
            .select('*')
            .eq('task_id', task.id);
          task.reminders = (reminders || []).map(toCamelCase);
        }

        return task;
      } catch (err) {
        console.error('[SupabaseRepo] task.findUnique error:', err);
        return null;
      }
    },

    create: async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const payload = toSnakeCase({
        id,
        status: 'pending',
        confirmed: true,
        ...data,
        deadline: data.deadline ? new Date(data.deadline).toISOString() : undefined,
      });

      const { data: created, error } = await supabase
        .from('tasks')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        console.error('[SupabaseRepo] task.create error:', error);
        throw new Error(`Failed to create task in Supabase: ${error.message}`);
      }
      return toCamelCase(created);
    },

    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const payload = toSnakeCase({
        ...data,
        deadline: data.deadline ? new Date(data.deadline).toISOString() : undefined,
        updatedAt: new Date().toISOString(),
      });

      const { data: updated, error } = await supabase
        .from('tasks')
        .update(payload)
        .eq('id', where.id)
        .select('*')
        .single();

      if (error) {
        console.error('[SupabaseRepo] task.update error:', error);
        throw new Error(`Failed to update task in Supabase: ${error.message}`);
      }
      return toCamelCase(updated);
    },

    delete: async ({ where }: { where: { id: string } }) => {
      const { data, error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', where.id)
        .select('*')
        .maybeSingle();

      if (error) {
        console.error('[SupabaseRepo] task.delete error:', error);
        throw new Error(`Failed to delete task in Supabase: ${error.message}`);
      }
      return data ? toCamelCase(data) : null;
    },

    count: async ({ where }: { where?: any } = {}) => {
      try {
        let query = supabase.from('tasks').select('*', { count: 'exact', head: true });
        if (where?.userId) query = query.eq('user_id', where.userId);
        if (where?.status) query = query.eq('status', where.status);
        const { count, error } = await query;
        if (error) return 0;
        return count || 0;
      } catch {
        return 0;
      }
    },
  },

  reminder: {
    create: async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const payload = toSnakeCase({
        id,
        status: 'pending',
        ...data,
        scheduledFor: data.scheduledFor ? new Date(data.scheduledFor).toISOString() : undefined,
      });

      const { data: created, error } = await supabase
        .from('reminders')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        console.error('[SupabaseRepo] reminder.create error:', error);
        throw new Error(`Failed to create reminder: ${error.message}`);
      }
      return toCamelCase(created);
    },

    findUnique: async ({ where }: { where: { id: string } }) => {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('id', where.id)
        .maybeSingle();
      if (error || !data) return null;
      return toCamelCase(data);
    },

    findMany: async ({ where }: { where?: any } = {}) => {
      try {
        let query = supabase.from('reminders').select('*');
        if (where?.status) {
          if (typeof where.status === 'object' && where.status.not !== undefined) {
            query = query.neq('status', where.status.not);
          } else {
            query = query.eq('status', where.status);
          }
        }
        if (where?.taskId) {
          if (typeof where.taskId === 'object' && Array.isArray(where.taskId.in)) {
            query = query.in('task_id', where.taskId.in);
          } else {
            query = query.eq('task_id', where.taskId);
          }
        }
        if (where?.scheduledFor?.lte) {
          query = query.lte('scheduled_for', new Date(where.scheduledFor.lte).toISOString());
        }
        if (where?.scheduledFor?.gte) {
          query = query.gte('scheduled_for', new Date(where.scheduledFor.gte).toISOString());
        }

        const { data, error } = await query;
        if (error || !data) return [];
        return data.map(toCamelCase);
      } catch (err) {
        console.error('[SupabaseRepo] reminder.findMany error:', err);
        return [];
      }
    },

    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const payload = toSnakeCase({
        ...data,
        sentAt: data.sentAt ? new Date(data.sentAt).toISOString() : undefined,
      });

      const { data: updated, error } = await supabase
        .from('reminders')
        .update(payload)
        .eq('id', where.id)
        .select('*')
        .maybeSingle();

      if (error) {
        console.error('[SupabaseRepo] reminder.update error:', error);
        return null;
      }
      return updated ? toCamelCase(updated) : null;
    },

    delete: async ({ where }: { where: { id: string } }) => {
      const { data, error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', where.id)
        .select('*')
        .maybeSingle();
      if (error) return null;
      return data ? toCamelCase(data) : null;
    },

    deleteMany: async ({ where }: { where?: any } = {}) => {
      try {
        let query = supabase.from('reminders').delete();
        if (where?.taskId) query = query.eq('task_id', where.taskId);
        if (where?.status) query = query.eq('status', where.status);
        const { error, count } = await query;
        if (error) return { count: 0 };
        return { count: count || 0 };
      } catch {
        return { count: 0 };
      }
    },
  },

  chatMessage: {
    create: async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const payload = toSnakeCase({
        id,
        ...data,
        createdAt: data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString(),
      });

      const { data: created, error } = await supabase
        .from('chat_messages')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        console.error('[SupabaseRepo] chatMessage.create error:', error);
        throw new Error(`Failed to save chat message to Supabase: ${error.message}`);
      }
      return toCamelCase(created);
    },

    findMany: async ({ where, orderBy }: { where?: any; orderBy?: any } = {}) => {
      try {
        let query = supabase.from('chat_messages').select('*');
        if (where?.courseId) query = query.eq('course_id', where.courseId);
        if (where?.userId) query = query.eq('user_id', where.userId);

        if (orderBy?.createdAt === 'desc') {
          query = query.order('created_at', { ascending: false });
        } else {
          query = query.order('created_at', { ascending: true });
        }

        const { data, error } = await query;
        if (error || !data) return [];
        return data.map(toCamelCase);
      } catch (err) {
        console.error('[SupabaseRepo] chatMessage.findMany error:', err);
        return [];
      }
    },

    deleteMany: async ({ where }: { where?: any } = {}) => {
      try {
        let query = supabase.from('chat_messages').delete();
        if (where?.courseId) query = query.eq('course_id', where.courseId);
        if (where?.userId) query = query.eq('user_id', where.userId);
        const { error, count } = await query;
        if (error) return { count: 0 };
        return { count: count || 0 };
      } catch {
        return { count: 0 };
      }
    },
  },

  courseMaterial: {
    findMany: async ({ where }: { where?: any } = {}) => {
      try {
        let query = supabase.from('course_materials').select('*');
        if (where?.courseId) query = query.eq('course_id', where.courseId);
        const { data, error } = await query;
        if (error || !data) return [];
        return data.map(toCamelCase);
      } catch (err) {
        return [];
      }
    },

    create: async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const payload = toSnakeCase({ id, ...data });
      const { data: created, error } = await supabase
        .from('course_materials')
        .insert(payload)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return toCamelCase(created);
    },

    delete: async ({ where }: { where: { id: string } }) => {
      const { data, error } = await supabase
        .from('course_materials')
        .delete()
        .eq('id', where.id)
        .select('*')
        .maybeSingle();
      if (error) return null;
      return data ? toCamelCase(data) : null;
    },
  },

  userApiKey: {
    findMany: async ({ where }: { where?: any } = {}) => {
      try {
        let query = supabase.from('user_api_keys').select('*');
        if (where?.userId) query = query.eq('user_id', where.userId);
        if (where?.provider) query = query.eq('provider', where.provider);
        const { data, error } = await query;
        if (error || !data) return [];
        return data.map(toCamelCase);
      } catch {
        return [];
      }
    },

    findFirst: async ({ where }: { where: any }) => {
      try {
        let query = supabase.from('user_api_keys').select('*');
        if (where?.userId) query = query.eq('user_id', where.userId);
        if (where?.provider) query = query.eq('provider', where.provider);
        const { data, error } = await query.limit(1).maybeSingle();
        if (error || !data) return null;
        return toCamelCase(data);
      } catch {
        return null;
      }
    },

    findUnique: async ({ where }: { where: any }) => {
      try {
        let query = supabase.from('user_api_keys').select('*');
        if (where?.id) {
          query = query.eq('id', where.id);
        } else if (where?.userId_provider) {
          query = query
            .eq('user_id', where.userId_provider.userId)
            .eq('provider', where.userId_provider.provider);
        }
        const { data, error } = await query.maybeSingle();
        if (error || !data) return null;
        return toCamelCase(data);
      } catch {
        return null;
      }
    },

    create: async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const payload = toSnakeCase({ id, ...data });
      const { data: created, error } = await supabase
        .from('user_api_keys')
        .insert(payload)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return toCamelCase(created);
    },

    update: async ({ where, data }: { where: any; data: any }) => {
      const payload = toSnakeCase({ ...data, updatedAt: new Date().toISOString() });
      let query = supabase.from('user_api_keys').update(payload);
      if (where?.id) query = query.eq('id', where.id);
      else if (where?.userId_provider) {
        query = query
          .eq('user_id', where.userId_provider.userId)
          .eq('provider', where.userId_provider.provider);
      }
      const { data: updated, error } = await query.select('*').single();
      if (error) throw new Error(error.message);
      return toCamelCase(updated);
    },

    upsert: async ({ where, update, create }: { where: any; update: any; create: any }) => {
      const existing = await supabaseRepo.userApiKey.findUnique({ where });
      if (existing) {
        return supabaseRepo.userApiKey.update({ where, data: update });
      }
      return supabaseRepo.userApiKey.create({ data: create });
    },

    delete: async ({ where }: { where: any }) => {
      let query = supabase.from('user_api_keys').delete();
      if (where?.id) query = query.eq('id', where.id);
      else if (where?.userId_provider) {
        query = query
          .eq('user_id', where.userId_provider.userId)
          .eq('provider', where.userId_provider.provider);
      }
      const { data, error } = await query.select('*').maybeSingle();
      if (error) return null;
      return data ? toCamelCase(data) : null;
    },

    deleteMany: async ({ where }: { where?: any } = {}) => {
      let query = supabase.from('user_api_keys').delete();
      if (where?.userId) query = query.eq('user_id', where.userId);
      if (where?.provider) query = query.eq('provider', where.provider);
      const { count } = await query;
      return { count: count || 0 };
    },
  },

  subscription: {
    findUnique: async ({ where }: { where: { userId?: string; id?: string } }) => {
      try {
        let query = supabase.from('subscriptions').select('*');
        if (where.userId) query = query.eq('user_id', where.userId);
        if (where.id) query = query.eq('id', where.id);
        const { data, error } = await query.maybeSingle();
        if (error || !data) return null;
        return toCamelCase(data);
      } catch {
        return null;
      }
    },

    findFirst: async ({ where }: { where?: any } = {}) => {
      try {
        let query = supabase.from('subscriptions').select('*');
        if (where?.userId) query = query.eq('user_id', where.userId);
        const { data, error } = await query.limit(1).maybeSingle();
        if (error || !data) return null;
        return toCamelCase(data);
      } catch {
        return null;
      }
    },

    create: async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const payload = toSnakeCase({ id, status: 'active', plan: 'free', ...data });
      const { data: created, error } = await supabase
        .from('subscriptions')
        .insert(payload)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return toCamelCase(created);
    },

    update: async ({ where, data }: { where: any; data: any }) => {
      const payload = toSnakeCase({ ...data, updatedAt: new Date().toISOString() });
      let query = supabase.from('subscriptions').update(payload);
      if (where?.id) query = query.eq('id', where.id);
      if (where?.userId) query = query.eq('user_id', where.userId);
      const { data: updated, error } = await query.select('*').single();
      if (error) throw new Error(error.message);
      return toCamelCase(updated);
    },

    upsert: async ({ where, update, create }: { where: any; update: any; create: any }) => {
      const existing = await supabaseRepo.subscription.findFirst({ where });
      if (existing) {
        return supabaseRepo.subscription.update({ where: { id: existing.id }, data: update });
      }
      return supabaseRepo.subscription.create({ data: create });
    },
  },

  passwordReset: {
    create: async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const payload = toSnakeCase({ id, used: false, ...data });
      const { data: created, error } = await supabase
        .from('password_resets')
        .insert(payload)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return toCamelCase(created);
    },

    findFirst: async ({ where }: { where: any }) => {
      try {
        let query = supabase.from('password_resets').select('*');
        if (where?.email) query = query.ilike('email', where.email.trim().toLowerCase());
        if (where?.otpCode) query = query.eq('otp_code', where.otpCode);
        if (where?.used !== undefined) query = query.eq('used', where.used);
        query = query.order('created_at', { ascending: false }).limit(1);
        const { data, error } = await query.maybeSingle();
        if (error || !data) return null;
        return toCamelCase(data);
      } catch {
        return null;
      }
    },

    update: async ({ where, data }: { where: any; data: any }) => {
      const payload = toSnakeCase(data);
      const { data: updated, error } = await supabase
        .from('password_resets')
        .update(payload)
        .eq('id', where.id)
        .select('*')
        .maybeSingle();
      if (error) return null;
      return updated ? toCamelCase(updated) : null;
    },
  },

  auditLog: {
    create: async ({ data }: { data: any }) => {
      try {
        const id = crypto.randomUUID();
        const payload = toSnakeCase({ id, ...data });
        await supabase.from('audit_log').insert(payload);
        return payload;
      } catch {
        return null;
      }
    },
  },
};
