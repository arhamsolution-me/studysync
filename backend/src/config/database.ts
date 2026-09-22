import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from './index';
import { supabaseRepo } from './supabaseRepo';
import { testSupabaseConnection } from './supabase';

testSupabaseConnection().catch(() => {});

const SETTINGS_FILE = path.resolve(process.cwd(), 'user_settings.json');

export function loadUserSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('[Settings] Error loading user_settings.json:', err);
  }
  return {
    email: 'devnexes.support@gmail.com',
    fullName: 'Personal Student',
    reminderLeadTimeMins: 1440,
    whatsappNumber: '',
  };
}

export function saveUserSettings(settings: any) {
  try {
    const existing = loadUserSettings();
    const merged = { ...existing, ...settings };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Settings] Error saving user_settings.json:', err);
  }
}

const COURSES_FILE = path.resolve(process.cwd(), 'courses.json');
const TASKS_FILE = path.resolve(process.cwd(), 'tasks.json');
const KEYS_FILE = path.resolve(process.cwd(), 'user_api_keys.json');
const SUBSCRIPTIONS_FILE = path.resolve(process.cwd(), 'subscriptions.json');

function loadCoursesFromDisk(): Map<string, any> {
  const map = new Map<string, any>();
  try {
    if (fs.existsSync(COURSES_FILE)) {
      const arr = JSON.parse(fs.readFileSync(COURSES_FILE, 'utf-8'));
      if (Array.isArray(arr)) {
        arr.forEach((c: any) => map.set(c.id, c));
      }
    }
  } catch (e) {
    console.error('[Database] Error reading courses.json:', e);
  }
  return map;
}

function saveCoursesToDisk(map: Map<string, any>) {
  try {
    const arr = Array.from(map.values());
    fs.writeFileSync(COURSES_FILE, JSON.stringify(arr, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Database] Error saving courses.json:', e);
  }
}

function loadTasksFromDisk(): Map<string, any> {
  const map = new Map<string, any>();
  try {
    if (fs.existsSync(TASKS_FILE)) {
      const arr = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf-8'));
      if (Array.isArray(arr)) {
        arr.forEach((t: any) => map.set(t.id, t));
      }
    }
  } catch (e) {
    console.error('[Database] Error reading tasks.json:', e);
  }
  return map;
}

function saveTasksToDisk(map: Map<string, any>) {
  try {
    const arr = Array.from(map.values());
    fs.writeFileSync(TASKS_FILE, JSON.stringify(arr, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Database] Error saving tasks.json:', e);
  }
}

function loadKeysFromDisk(): Map<string, any> {
  const map = new Map<string, any>();
  try {
    if (fs.existsSync(KEYS_FILE)) {
      const arr = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf-8'));
      if (Array.isArray(arr)) {
        arr.forEach((k: any) => map.set(k.id, k));
      }
    }
  } catch (e) {
    console.error('[Database] Error reading user_api_keys.json:', e);
  }
  return map;
}

function saveKeysToDisk(map: Map<string, any>) {
  try {
    const arr = Array.from(map.values());
    fs.writeFileSync(KEYS_FILE, JSON.stringify(arr, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Database] Error saving user_api_keys.json:', e);
  }
}

function loadSubscriptionsFromDisk(): Map<string, any> {
  const map = new Map<string, any>();
  try {
    if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
      const arr = JSON.parse(fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf-8'));
      if (Array.isArray(arr)) {
        arr.forEach((s: any) => map.set(s.id || s.userId, s));
      }
    }
  } catch (e) {
    console.error('[Database] Error reading subscriptions.json:', e);
  }
  return map;
}

function saveSubscriptionsToDisk(map: Map<string, any>) {
  try {
    const arr = Array.from(map.values());
    fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(arr, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Database] Error saving subscriptions.json:', e);
  }
}

// ─── In-Memory Store (Active when PostgreSQL/Docker is not running) ───

const memoryDb = {
  users: new Map<string, any>(),
  tasks: loadTasksFromDisk(),
  reminders: new Map<string, any>(),
  auditLogs: [] as any[],
  courses: loadCoursesFromDisk(),
  userApiKeys: loadKeysFromDisk(),
  subscriptions: loadSubscriptionsFromDisk(),
  courseMaterials: new Map<string, any>(),
  passwordResets: new Map<string, any>(),
  chatMessages: new Map<string, any>(),
};

// Pre-populate with a demo user for immediate testing without registration
const initialSettings = loadUserSettings();
const demoUserId = 'd3b07384-d113-4602-9c0e-e2c7c5980001';
memoryDb.users.set(demoUserId, {
  id: demoUserId,
  fullName: 'UMT Student',
  email: initialSettings.email || 'devnexes.support@gmail.com',
  passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$qHn2rM5rCg5B+Y/pU2fLvw$oE7mN2Y3N9Y2/1k9B8A7Q6W5E4R3T2Y1', // Password123
  role: 'student',
  isVerified: true,
  otpCode: null,
  otpExpiresAt: null,
  reminderLeadTimeMins: 1440,
  refreshToken: null,
  avatarUrl: null,
  university: 'University of Management and Technology',
  major: 'Computer Science',
  semester: '6th Semester',
  isOnboarded: true,
  plan: 'free',
  aiProviderPreference: 'system',
  activeByokProvider: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

// Seed personal user
const personalUserId = 'personal-user';
memoryDb.users.set(personalUserId, {
  id: personalUserId,
  fullName: initialSettings.fullName || 'Personal Student',
  email: initialSettings.email || 'devnexes.support@gmail.com',
  passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$qHn2rM5rCg5B+Y/pU2fLvw$oE7mN2Y3N9Y2/1k9B8A7Q6W5E4R3T2Y1',
  role: 'student',
  isVerified: true,
  otpCode: null,
  otpExpiresAt: null,
  reminderLeadTimeMins: initialSettings.reminderLeadTimeMins || 1440,
  whatsappNumber: initialSettings.whatsappNumber || '',
  refreshToken: null,
  avatarUrl: null,
  university: 'University of Management and Technology',
  major: 'Software Engineering',
  semester: '6th Semester',
  isOnboarded: true,
  plan: 'pro',
  aiProviderPreference: 'system',
  activeByokProvider: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

let isPostgresAvailable = false;

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: config.databaseUrl || 'postgresql://postgres:postgres@localhost:5432/studysync?schema=public',
  connectionTimeoutMillis: 2000,
});

pool.on('error', () => {
  isPostgresAvailable = false;
});

// Quick check if PostgreSQL is reachable
pool.connect()
  .then((client) => {
    isPostgresAvailable = true;
    client.release();
    console.log('[Database] ✅ Connected to PostgreSQL database');
  })
  .catch(() => {
    isPostgresAvailable = false;
    console.log('\n[Database] ℹ️  PostgreSQL not running locally.');
    console.log('[Database] 🚀 Running in Standalone In-Memory Mode (No Docker required)');
    console.log('[Database] 👤 Demo user: student@umt.edu.pk / Password123 (or register any new account!)\n');
  });

const adapter = new PrismaPg(pool);
const realPrisma = new PrismaClient({ adapter });

// In-Memory Handlers
const mockPrisma: any = {
  user: {
    findUnique: async ({ where }: { where: { email?: string; id?: string } }) => {
      if (where.email) {
        for (const u of memoryDb.users.values()) {
          if (u.email.toLowerCase() === where.email.toLowerCase()) return { ...u };
        }
        return null;
      }
      if (where.id) {
        const u = memoryDb.users.get(where.id);
        return u ? { ...u } : null;
      }
      return null;
    },
    create: async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const user = {
        id,
        role: 'student',
        reminderLeadTimeMins: 1440,
        refreshToken: null,
        avatarUrl: null,
        university: null,
        major: null,
        semester: null,
        isOnboarded: false,
        plan: 'free',
        aiProviderPreference: 'system',
        activeByokProvider: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      memoryDb.users.set(id, user);
      return { ...user };
    },
    findFirst: async ({ where }: { where?: any } = {}) => {
      let users = Array.from(memoryDb.users.values());
      if (where?.id) users = users.filter((u) => u.id === where.id);
      if (where?.email) users = users.filter((u) => u.email.toLowerCase() === where.email.toLowerCase());
      return users[0] ? { ...users[0] } : null;
    },
    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const u = memoryDb.users.get(where.id);
      if (!u) throw new Error('User not found');
      const updated = { ...u, ...data, updatedAt: new Date() };
      memoryDb.users.set(where.id, updated);
      if (where.id === personalUserId) {
        saveUserSettings({
          email: updated.email,
          fullName: updated.fullName,
          reminderLeadTimeMins: updated.reminderLeadTimeMins,
          whatsappNumber: updated.whatsappNumber,
        });
      }
      return { ...updated };
    },
  },
  task: {
    findMany: async ({ where, orderBy, take, include, select }: { where?: any; orderBy?: any; take?: number; include?: any; select?: any } = {}) => {
      let results: any[] = Array.from(memoryDb.tasks.values());
      if (where?.id) {
        if (typeof where.id === 'object' && Array.isArray(where.id.in)) {
          results = results.filter((t) => where.id.in.includes(t.id));
        } else {
          results = results.filter((t) => t.id === where.id);
        }
      }
      if (where?.userId) {
        results = results.filter((t) => t.userId === where.userId);
      }
      if (where?.courseId) {
        results = results.filter((t) => t.courseId === where.courseId);
      }
      if (where?.status) {
        if (typeof where.status === 'object') {
          if (where.status.not !== undefined) {
            results = results.filter((t) => t.status !== where.status.not);
          }
          if (Array.isArray(where.status.in)) {
            results = results.filter((t) => where.status.in.includes(t.status));
          }
        } else {
          results = results.filter((t) => t.status === where.status);
        }
      }
      if (where?.type) {
        if (typeof where.type === 'object') {
          if (where.type.not !== undefined) {
            results = results.filter((t) => t.type !== where.type.not);
          }
          if (Array.isArray(where.type.in)) {
            results = results.filter((t) => where.type.in.includes(t.type));
          }
        } else {
          results = results.filter((t) => t.type === where.type);
        }
      }
      if (where?.confirmed !== undefined) {
        results = results.filter((t) => t.confirmed === where.confirmed);
      }
      if (where?.deadline) {
        if (where.deadline.gte) {
          const gte = new Date(where.deadline.gte).getTime();
          results = results.filter((t) => new Date(t.deadline).getTime() >= gte);
        }
        if (where.deadline.lte) {
          const lte = new Date(where.deadline.lte).getTime();
          results = results.filter((t) => new Date(t.deadline).getTime() <= lte);
        }
        if (where.deadline.gt) {
          const gt = new Date(where.deadline.gt).getTime();
          results = results.filter((t) => new Date(t.deadline).getTime() > gt);
        }
        if (where.deadline.lt) {
          const lt = new Date(where.deadline.lt).getTime();
          results = results.filter((t) => new Date(t.deadline).getTime() < lt);
        }
      }

      // Simple sort
      if (orderBy?.deadline === 'desc') {
        results.sort((a, b) => new Date(b.deadline).getTime() - new Date(a.deadline).getTime());
      } else {
        results.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
      }

      if (take && typeof take === 'number') {
        results = results.slice(0, take);
      }

      return results.map((t) => {
        const item = { ...t };
        if (include?.reminders) {
          item.reminders = Array.from(memoryDb.reminders.values()).filter((r) => r.taskId === item.id);
        }
        return item;
      });
    },
    findFirst: async ({ where, include }: { where: any; include?: any }) => {
      let res: any = null;
      if (where?.id) {
        const t = memoryDb.tasks.get(where.id);
        if (t) res = { ...t };
      }
      if (!res) {
        const all = await mockPrisma.task.findMany({ where, include });
        if (!all[0]) return null;
        res = { ...all[0] };
      }
      if (include?.user && res?.userId) {
        const u = memoryDb.users.get(res.userId);
        res.user = u ? { ...u } : null;
      }
      if (include?.reminders && res?.id) {
        res.reminders = Array.from(memoryDb.reminders.values()).filter((r) => r.taskId === res.id);
      }
      return res;
    },
    findUnique: async ({ where, include }: { where: { id: string }; include?: any }) => {
      const t = memoryDb.tasks.get(where.id);
      if (!t) return null;
      const res = { ...t };
      if (include?.user) {
        const u = memoryDb.users.get(res.userId);
        res.user = u ? { ...u } : null;
      }
      if (include?.reminders) {
        res.reminders = Array.from(memoryDb.reminders.values()).filter((r) => r.taskId === res.id);
      }
      return res;
    },
    create: async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const task = {
        id,
        status: 'pending',
        confirmed: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
        deadline: new Date(data.deadline),
      };
      memoryDb.tasks.set(id, task);
      saveTasksToDisk(memoryDb.tasks);
      return { ...task };
    },
    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const t = memoryDb.tasks.get(where.id);
      if (!t) throw new Error('Task not found');
      const updated = {
        ...t,
        ...data,
        deadline: data.deadline ? new Date(data.deadline) : t.deadline,
        updatedAt: new Date(),
      };
      memoryDb.tasks.set(where.id, updated);
      saveTasksToDisk(memoryDb.tasks);
      return { ...updated };
    },
    delete: async ({ where }: { where: { id: string } }) => {
      const t = memoryDb.tasks.get(where.id);
      memoryDb.tasks.delete(where.id);
      saveTasksToDisk(memoryDb.tasks);
      return t;
    },
    count: async ({ where }: { where?: any }) => {
      const all = await mockPrisma.task.findMany({ where });
      return all.length;
    },
  },
  reminder: {
    create: async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const reminder = { id, status: 'pending', createdAt: new Date(), ...data };
      memoryDb.reminders.set(id, reminder);
      return { ...reminder };
    },
    findUnique: async ({ where }: { where: { id: string } }) => {
      const r = memoryDb.reminders.get(where.id);
      return r ? { ...r } : null;
    },
    findMany: async ({ where }: { where?: any } = {}) => {
      let results = Array.from(memoryDb.reminders.values());
      if (where?.status) {
        if (typeof where.status === 'object' && where.status.not !== undefined) {
          results = results.filter((r) => r.status !== where.status.not);
        } else {
          results = results.filter((r) => r.status === where.status);
        }
      }
      if (where?.taskId) {
        if (typeof where.taskId === 'object' && Array.isArray(where.taskId.in)) {
          results = results.filter((r) => where.taskId.in.includes(r.taskId));
        } else {
          results = results.filter((r) => r.taskId === where.taskId);
        }
      }
      if (where?.scheduledFor?.lte) {
        const lteDate = new Date(where.scheduledFor.lte).getTime();
        results = results.filter((r) => new Date(r.scheduledFor).getTime() <= lteDate);
      }
      if (where?.scheduledFor?.gte) {
        const gteDate = new Date(where.scheduledFor.gte).getTime();
        results = results.filter((r) => new Date(r.scheduledFor).getTime() >= gteDate);
      }
      return results.map((r) => ({ ...r }));
    },
    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const r = memoryDb.reminders.get(where.id);
      if (!r) return null;
      const updated = { ...r, ...data };
      memoryDb.reminders.set(where.id, updated);
      return { ...updated };
    },
    delete: async ({ where }: { where: { id: string } }) => {
      const r = memoryDb.reminders.get(where.id);
      memoryDb.reminders.delete(where.id);
      return r;
    },
    deleteMany: async ({ where }: { where?: any } = {}) => {
      let count = 0;
      for (const [id, r] of memoryDb.reminders.entries()) {
        let match = true;
        if (where?.taskId && r.taskId !== where.taskId) match = false;
        if (where?.status && r.status !== where.status) match = false;
        if (match) {
          memoryDb.reminders.delete(id);
          count++;
        }
      }
      return { count };
    },
  },
  auditLog: {
    create: async ({ data }: { data: any }) => {
      const entry = { id: crypto.randomUUID(), createdAt: new Date(), ...data };
      memoryDb.auditLogs.push(entry);
      return entry;
    },
  },
  course: {
    findMany: async ({ where }: { where: any }) => {
      let results = Array.from(memoryDb.courses.values());
      if (where?.userId) results = results.filter((c) => c.userId === where.userId);
      return results.map((c) => ({ ...c }));
    },
    findFirst: async ({ where }: { where: any }) => {
      let results = Array.from(memoryDb.courses.values());
      if (where?.id) {
        const byId = results.find((c) => c.id === where.id);
        if (byId) return { ...byId };
      }
      if (where?.userId) results = results.filter((c) => c.userId === where.userId);
      return results[0] ? { ...results[0] } : null;
    },
    findUnique: async ({ where }: { where: { id: string } }) => {
      const c = memoryDb.courses.get(where.id);
      return c ? { ...c } : null;
    },
    create: async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const course = { id, createdAt: new Date(), ...data };
      memoryDb.courses.set(id, course);
      saveCoursesToDisk(memoryDb.courses);
      return { ...course };
    },
    delete: async ({ where }: { where: { id: string } }) => {
      const c = memoryDb.courses.get(where.id);
      memoryDb.courses.delete(where.id);
      saveCoursesToDisk(memoryDb.courses);
      return c;
    },
  },
  userApiKey: {
    findMany: async ({ where }: { where?: any } = {}) => {
      let results = Array.from(memoryDb.userApiKeys.values());
      if (where?.userId) results = results.filter((k) => k.userId === where.userId);
      if (where?.provider) results = results.filter((k) => k.provider === where.provider);
      if (where?.isActive !== undefined) results = results.filter((k) => k.isActive === where.isActive);
      return results.map((k) => ({ ...k }));
    },
    findFirst: async ({ where }: { where: any }) => {
      let results = Array.from(memoryDb.userApiKeys.values());
      if (where?.userId) results = results.filter((k) => k.userId === where.userId);
      if (where?.provider) results = results.filter((k) => k.provider === where.provider);
      if (where?.isActive !== undefined) results = results.filter((k) => k.isActive === where.isActive);
      return results[0] ? { ...results[0] } : null;
    },
    findUnique: async ({ where }: { where: any }) => {
      if (where?.id) {
        const k = memoryDb.userApiKeys.get(where.id);
        return k ? { ...k } : null;
      }
      if (where?.userId_provider) {
        const { userId, provider } = where.userId_provider;
        for (const k of memoryDb.userApiKeys.values()) {
          if (k.userId === userId && k.provider === provider) return { ...k };
        }
        return null;
      }
      return null;
    },
    create: async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const apiKey = {
        id,
        isActive: true,
        isValidated: true,
        lastValidatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      memoryDb.userApiKeys.set(id, apiKey);
      saveKeysToDisk(memoryDb.userApiKeys);
      return { ...apiKey };
    },
    update: async ({ where, data }: { where: any; data: any }) => {
      let target: any = null;
      if (where?.id) {
        target = memoryDb.userApiKeys.get(where.id);
      } else if (where?.userId_provider) {
        const { userId, provider } = where.userId_provider;
        for (const k of memoryDb.userApiKeys.values()) {
          if (k.userId === userId && k.provider === provider) {
            target = k;
            break;
          }
        }
      }
      if (!target) throw new Error('ApiKey not found');
      const updated = { ...target, ...data, updatedAt: new Date() };
      memoryDb.userApiKeys.set(target.id, updated);
      saveKeysToDisk(memoryDb.userApiKeys);
      return { ...updated };
    },
    upsert: async ({ where, update, create }: { where: any; update: any; create: any }) => {
      let existing: any = null;
      if (where?.userId_provider) {
        const { userId, provider } = where.userId_provider;
        for (const k of memoryDb.userApiKeys.values()) {
          if (k.userId === userId && k.provider === provider) {
            existing = k;
            break;
          }
        }
      }
      if (existing) {
        const updated = { ...existing, ...update, updatedAt: new Date() };
        memoryDb.userApiKeys.set(existing.id, updated);
        saveKeysToDisk(memoryDb.userApiKeys);
        return { ...updated };
      } else {
        const id = create.id || crypto.randomUUID();
        const created = {
          id,
          isActive: true,
          isValidated: true,
          lastValidatedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          ...create,
        };
        memoryDb.userApiKeys.set(id, created);
        saveKeysToDisk(memoryDb.userApiKeys);
        return { ...created };
      }
    },
    delete: async ({ where }: { where: any }) => {
      let targetId: string | null = null;
      if (where?.id) {
        targetId = where.id;
      } else if (where?.userId_provider) {
        const { userId, provider } = where.userId_provider;
        for (const [id, k] of memoryDb.userApiKeys.entries()) {
          if (k.userId === userId && k.provider === provider) {
            targetId = id;
            break;
          }
        }
      }
      if (targetId) {
        const item = memoryDb.userApiKeys.get(targetId);
        memoryDb.userApiKeys.delete(targetId);
        saveKeysToDisk(memoryDb.userApiKeys);
        return item;
      }
      return null;
    },
    deleteMany: async ({ where }: { where?: any } = {}) => {
      let count = 0;
      for (const [id, k] of memoryDb.userApiKeys.entries()) {
        let match = true;
        if (where?.userId && k.userId !== where.userId) match = false;
        if (where?.provider && k.provider !== where.provider) match = false;
        if (match) {
          memoryDb.userApiKeys.delete(id);
          count++;
        }
      }
      saveKeysToDisk(memoryDb.userApiKeys);
      return { count };
    },
  },
  subscription: {
    findUnique: async ({ where }: { where: { userId?: string; id?: string } }) => {
      if (where?.userId) {
        for (const s of memoryDb.subscriptions.values()) {
          if (s.userId === where.userId) return { ...s };
        }
        return null;
      }
      if (where?.id) {
        const s = memoryDb.subscriptions.get(where.id);
        return s ? { ...s } : null;
      }
      return null;
    },
    findFirst: async ({ where }: { where?: any } = {}) => {
      let results = Array.from(memoryDb.subscriptions.values());
      if (where?.userId) results = results.filter((s) => s.userId === where.userId);
      return results[0] ? { ...results[0] } : null;
    },
    create: async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const sub = {
        id,
        status: 'active',
        plan: 'free',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      memoryDb.subscriptions.set(id, sub);
      saveSubscriptionsToDisk(memoryDb.subscriptions);
      return { ...sub };
    },
    update: async ({ where, data }: { where: any; data: any }) => {
      let target: any = null;
      if (where?.userId) {
        for (const s of memoryDb.subscriptions.values()) {
          if (s.userId === where.userId) {
            target = s;
            break;
          }
        }
      } else if (where?.id) {
        target = memoryDb.subscriptions.get(where.id);
      }
      if (!target) throw new Error('Subscription not found');
      const updated = { ...target, ...data, updatedAt: new Date() };
      memoryDb.subscriptions.set(target.id, updated);
      saveSubscriptionsToDisk(memoryDb.subscriptions);
      return { ...updated };
    },
    upsert: async ({ where, update, create }: { where: any; update: any; create: any }) => {
      let existing: any = null;
      if (where?.userId) {
        for (const s of memoryDb.subscriptions.values()) {
          if (s.userId === where.userId) {
            existing = s;
            break;
          }
        }
      }
      if (existing) {
        const updated = { ...existing, ...update, updatedAt: new Date() };
        memoryDb.subscriptions.set(existing.id, updated);
        saveSubscriptionsToDisk(memoryDb.subscriptions);
        return { ...updated };
      } else {
        const id = create.id || crypto.randomUUID();
        const created = {
          id,
          status: 'active',
          plan: 'free',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
          cancelAtPeriodEnd: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...create,
        };
        memoryDb.subscriptions.set(id, created);
        saveSubscriptionsToDisk(memoryDb.subscriptions);
        return { ...created };
      }
    },
  },
  courseMaterial: {
    findMany: async ({ where }: { where?: any } = {}) => {
      let results = Array.from(memoryDb.courseMaterials.values());
      if (where?.courseId) results = results.filter((m) => m.courseId === where.courseId);
      return results.map((m) => ({ ...m }));
    },
    create: async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const material = { id, createdAt: new Date(), ...data };
      memoryDb.courseMaterials.set(id, material);
      return { ...material };
    },
    delete: async ({ where }: { where: { id: string } }) => {
      const m = memoryDb.courseMaterials.get(where.id);
      memoryDb.courseMaterials.delete(where.id);
      return m;
    },
  },
  passwordReset: {
    create: async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const entry = { id, used: false, createdAt: new Date(), ...data };
      memoryDb.passwordResets.set(id, entry);
      return { ...entry };
    },
    findFirst: async ({ where }: { where: any }) => {
      let list = Array.from(memoryDb.passwordResets.values());
      if (where?.email) list = list.filter((r) => r.email.toLowerCase() === where.email.toLowerCase());
      if (where?.otpCode) list = list.filter((r) => r.otpCode === where.otpCode);
      if (where?.used !== undefined) list = list.filter((r) => r.used === where.used);
      return list[list.length - 1] || null;
    },
    update: async ({ where, data }: { where: any; data: any }) => {
      const r = memoryDb.passwordResets.get(where.id);
      if (r) {
        const updated = { ...r, ...data };
        memoryDb.passwordResets.set(where.id, updated);
        return { ...updated };
      }
      return null;
    },
  },
  chatMessage: {
    create: async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const entry = { id, createdAt: new Date(), ...data };
      memoryDb.chatMessages.set(id, entry);
      return { ...entry };
    },
    findMany: async ({ where, orderBy }: { where?: any; orderBy?: any } = {}) => {
      let list = Array.from(memoryDb.chatMessages.values());
      if (where?.courseId) list = list.filter((m) => m.courseId === where.courseId);
      if (where?.userId) list = list.filter((m) => m.userId === where.userId);
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      return list.map((m) => ({ ...m }));
    },
    deleteMany: async ({ where }: { where?: any } = {}) => {
      let count = 0;
      for (const [id, m] of memoryDb.chatMessages.entries()) {
        let match = true;
        if (where?.courseId && m.courseId !== where.courseId) match = false;
        if (where?.userId && m.userId !== where.userId) match = false;
        if (match) {
          memoryDb.chatMessages.delete(id);
          count++;
        }
      }
      return { count };
    },
  },
};

// Smart proxy: Primary is Supabase Cloud Database; falls back to local memoryDb if offline
const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop: string) {
    if (supabaseRepo[prop]) {
      const repoObject = supabaseRepo[prop];
      return new Proxy(repoObject, {
        get(subTarget, subProp: string) {
          return async (...args: any[]) => {
            try {
              return await (subTarget as any)[subProp](...args);
            } catch (err: any) {
              console.warn(`[PrismaProxy] Supabase ${prop}.${subProp} failed, falling back to memoryDb:`, err.message);
              if (mockPrisma[prop] && mockPrisma[prop][subProp]) {
                return await mockPrisma[prop][subProp](...args);
              }
              throw err;
            }
          };
        },
      });
    }

    if (isPostgresAvailable) {
      const realProp = (realPrisma as any)[prop];
      if (typeof realProp === 'object' && realProp !== null) {
        return new Proxy(realProp, {
          get(subTarget, subProp: string) {
            return async (...args: any[]) => {
              try {
                return await (subTarget as any)[subProp](...args);
              } catch (err: any) {
                if (mockPrisma[prop] && mockPrisma[prop][subProp]) {
                  return await mockPrisma[prop][subProp](...args);
                }
                throw err;
              }
            };
          },
        });
      }
      return realProp;
    }

    return mockPrisma[prop] || (realPrisma as any)[prop];
  },
});

export default prisma;
