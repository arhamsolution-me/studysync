import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { adminApi } from '../services/api';
import {
  Users,
  BookOpen,
  CheckCircle,
  Cpu,
  RefreshCw,
  Search,
  Shield,
  Key,
  Database,
  Server,
  Sparkles,
  Zap,
  Lock,
  ChevronRight,
  UserCheck,
  UserX,
  ExternalLink,
  Activity,
  Award,
} from 'lucide-react';

interface AdminPortalProps {
  user: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  };
}

export default function AdminPortal({ user }: AdminPortalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'courses' | 'ai' | 'health'>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [overview, setOverview] = useState<any>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [usersPagination, setUsersPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [userSearch, setUserSearch] = useState('');
  const [userPlanFilter, setUserPlanFilter] = useState('all');
  const [userStatusFilter, setUserStatusFilter] = useState('all');

  const [coursesList, setCoursesList] = useState<any[]>([]);
  const [coursesPagination, setCoursesPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [courseSearch, setCourseSearch] = useState('');
  const [courseStatusFilter, setCourseStatusFilter] = useState('all');

  const [aiUsage, setAiUsage] = useState<any>(null);

  // Updating states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers(1);
    } else if (activeTab === 'courses') {
      fetchCourses(1);
    } else if (activeTab === 'ai') {
      fetchAiUsage();
    }
  }, [activeTab, userPlanFilter, userStatusFilter, courseStatusFilter]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchOverview(),
        fetchUsers(1),
        fetchCourses(1),
        fetchAiUsage(),
      ]);
    } catch (err: any) {
      toast.error('Failed to load some admin telemetry.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadAllData();
      toast.success('Admin telemetry refreshed live.');
    } catch {
      toast.error('Error refreshing data.');
    } finally {
      setRefreshing(false);
    }
  };

  const fetchOverview = async () => {
    try {
      const res = await adminApi.getOverview();
      if (res.data.success) {
        setOverview(res.data.data);
      }
    } catch (err: any) {
      console.error('Error fetching overview:', err);
    }
  };

  const fetchUsers = async (page = 1) => {
    try {
      const res = await adminApi.getUsers({
        page,
        limit: 15,
        search: userSearch,
        plan: userPlanFilter,
        status: userStatusFilter,
      });
      if (res.data.success) {
        setUsersList(res.data.data.users);
        setUsersPagination(res.data.data.pagination);
      }
    } catch (err: any) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchCourses = async (page = 1) => {
    try {
      const res = await adminApi.getCourses({
        page,
        limit: 15,
        search: courseSearch,
        status: courseStatusFilter,
      });
      if (res.data.success) {
        setCoursesList(res.data.data.courses);
        setCoursesPagination(res.data.data.pagination);
      }
    } catch (err: any) {
      console.error('Error fetching courses:', err);
    }
  };

  const fetchAiUsage = async () => {
    try {
      const res = await adminApi.getAiUsage();
      if (res.data.success) {
        setAiUsage(res.data.data);
      }
    } catch (err: any) {
      console.error('Error fetching AI usage:', err);
    }
  };

  const handleUpdatePlan = async (userId: string, newPlan: 'free' | 'pro' | 'campus') => {
    setActionLoadingId(userId);
    try {
      const res = await adminApi.updateUserPlan(userId, newPlan);
      if (res.data.success) {
        toast.success(res.data.message || `Plan updated to ${newPlan.toUpperCase()}`);
        setUsersList((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, plan: newPlan } : u))
        );
        fetchOverview();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update user plan');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleUserBlock = async (userId: string, currentStatus: boolean, userEmail: string) => {
    const nextStatus = !currentStatus;
    if (userId === user.id && nextStatus) {
      toast.error('You cannot suspend your own admin account!');
      return;
    }
    const confirmMsg = nextStatus
      ? `Are you sure you want to suspend ${userEmail}? They will be blocked from logging in.`
      : `Unblock ${userEmail}?`;

    if (!window.confirm(confirmMsg)) return;

    setActionLoadingId(userId);
    try {
      const res = await adminApi.updateUserStatus(userId, nextStatus);
      if (res.data.success) {
        toast.success(res.data.message);
        setUsersList((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, isBlocked: nextStatus } : u))
        );
        fetchOverview();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to change user status');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleCourseBlock = async (courseId: string, currentStatus: boolean, courseName: string) => {
    const nextStatus = !currentStatus;
    const confirmMsg = nextStatus
      ? `Suspend course "${courseName}"? Students will not be able to chat or generate tasks for it.`
      : `Unblock course "${courseName}"?`;

    if (!window.confirm(confirmMsg)) return;

    setActionLoadingId(courseId);
    try {
      const res = await adminApi.updateCourseStatus(courseId, nextStatus);
      if (res.data.success) {
        toast.success(res.data.message);
        setCoursesList((prev) =>
          prev.map((c) => (c.id === courseId ? { ...c, isBlocked: nextStatus } : c))
        );
        fetchOverview();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update course status');
    } finally {
      setActionLoadingId(null);
    }
  };

  if (loading && !overview) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-600 rounded-full animate-spin mb-4" />
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Connecting to Admin Telemetry...</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">Verifying role and querying Supabase Cloud database</p>
      </div>
    );
  }

  const uStats = overview?.users || {};
  const aStats = overview?.activity || {};

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fadeIn">
      {/* ─── ADMIN BANNER & HEADER ─── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 sm:p-8 mb-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 tracking-wide uppercase">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                Root Administrator Portal
              </span>
              <span className="text-xs text-slate-400">
                Connected as: <strong className="text-slate-200">{user.email}</strong>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              StudySync AI Operations Center
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Real-time student telemetry, subscription governance, BYOK vs System AI consumption tracking, and course moderation.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium border border-white/15 transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Syncing...' : 'Sync Telemetry'}
            </button>
            <a
              href="https://supabase.com/dashboard/project/twluwkcduduvswmjvqfl"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-md shadow-indigo-600/30 active:scale-95"
            >
              <Database className="w-4 h-4" />
              Supabase DB
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </a>
          </div>
        </div>

        {/* ─── QUICK METRICS ROW ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-indigo-500/20">
          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Users className="w-3 h-3 text-indigo-400" /> Total Students
            </span>
            <div className="text-xl font-bold mt-1 text-white">{uStats.total ?? 0}</div>
            <span className="text-[11px] text-emerald-400">+{uStats.newThisWeek ?? 0} this week</span>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Award className="w-3 h-3 text-amber-400" /> Pro / Campus
            </span>
            <div className="text-xl font-bold mt-1 text-white">
              {(uStats.planBreakdown?.pro ?? 0) + (uStats.planBreakdown?.campus ?? 0)}
            </div>
            <span className="text-[11px] text-slate-400">
              {uStats.planBreakdown?.free ?? 0} on Free
            </span>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Key className="w-3 h-3 text-purple-400" /> BYOK Users
            </span>
            <div className="text-xl font-bold mt-1 text-purple-300">
              {uStats.aiModeBreakdown?.byok ?? 0}
            </div>
            <span className="text-[11px] text-slate-400">Own API Key</span>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Cpu className="w-3 h-3 text-cyan-400" /> System AI Users
            </span>
            <div className="text-xl font-bold mt-1 text-cyan-300">
              {uStats.aiModeBreakdown?.system ?? 0}
            </div>
            <span className="text-[11px] text-slate-400">Using Server Key</span>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <BookOpen className="w-3 h-3 text-blue-400" /> Active Courses
            </span>
            <div className="text-xl font-bold mt-1 text-white">
              {(aStats.totalCourses ?? 0) - (aStats.blockedCourses ?? 0)}
            </div>
            <span className="text-[11px] text-rose-400">
              {aStats.blockedCourses ?? 0} suspended
            </span>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-emerald-400" /> Tasks Logged
            </span>
            <div className="text-xl font-bold mt-1 text-white">{aStats.totalTasks ?? 0}</div>
            <span className="text-[11px] text-emerald-400">
              {aStats.completedTasks ?? 0} completed
            </span>
          </div>
        </div>
      </div>

      {/* ─── NAVIGATION TABS ─── */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6 gap-2 sm:gap-4 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          Overview & Analytics
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${
            activeTab === 'users'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Student Directory ({usersPagination.total || uStats.total || 0})
        </button>

        <button
          onClick={() => setActiveTab('courses')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${
            activeTab === 'courses'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Course Moderation ({coursesPagination.total || aStats.totalCourses || 0})
        </button>

        <button
          onClick={() => setActiveTab('ai')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${
            activeTab === 'ai'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Key className="w-4 h-4" />
          AI & BYOK Quotas
        </button>

        <button
          onClick={() => setActiveTab('health')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${
            activeTab === 'health'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Server className="w-4 h-4" />
          System & Health
        </button>
      </div>

      {/* ─── TAB 1: OVERVIEW & ANALYTICS ─── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Plan Distribution Card */}
            <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-semibold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                <Award className="w-5 h-5 text-indigo-500" />
                Subscription Plans Breakdown
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    <span>Free Plan (Standard)</span>
                    <span>{uStats.planBreakdown?.free ?? 0} students</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-400 rounded-full"
                      style={{ width: `${((uStats.planBreakdown?.free || 0) / (uStats.total || 1)) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold">Pro Plan ($9/mo)</span>
                    <span className="font-semibold">{uStats.planBreakdown?.pro ?? 0} students</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full"
                      style={{ width: `${((uStats.planBreakdown?.pro || 0) / (uStats.total || 1)) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">Campus Plan (University)</span>
                    <span className="font-semibold">{uStats.planBreakdown?.campus ?? 0} students</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${((uStats.planBreakdown?.campus || 0) / (uStats.total || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* AI Engine Distribution */}
            <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-semibold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                <Cpu className="w-5 h-5 text-purple-500" />
                AI Key Consumption Model
              </h3>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/60 mb-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-cyan-500" /> Server System Key
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">{uStats.aiModeBreakdown?.system ?? 0}</span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Consuming server tokens (Gemini 2.5 Flash / Groq Llama 3.3).
                </div>
              </div>

              <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-purple-700 dark:text-purple-300 font-medium flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-purple-500" /> Student BYOK Keys
                  </span>
                  <span className="font-bold text-purple-700 dark:text-purple-300">{uStats.aiModeBreakdown?.byok ?? 0}</span>
                </div>
                <div className="text-xs text-purple-600/80 dark:text-purple-400/80">
                  Zero cost to server — users provided custom Gemini/Groq/OpenAI keys.
                </div>
              </div>
            </div>

            {/* Activity Summary */}
            <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-semibold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-emerald-500" />
                Workload & Knowledge Base
              </h3>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                  <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{aStats.totalCourses ?? 0}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Courses Created</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                  <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{aStats.totalMaterials ?? 0}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Docs & Notes Indexed</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                  <div className="text-xl font-bold text-cyan-600 dark:text-cyan-400">{aStats.totalChatMessages ?? 0}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">AI Interactions</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                  <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{aStats.totalTasks ?? 0}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Academic Tasks</div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Signups Table */}
          <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" />
                Latest Registered Students
              </h3>
              <button
                onClick={() => setActiveTab('users')}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1"
              >
                View full directory <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Plan</th>
                    <th className="py-3 px-4">AI Mode</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {(overview?.recentSignups || []).map((u: any) => (
                    <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-750 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900 dark:text-white">{u.fullName || 'Student'}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{u.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                          u.role === 'admin' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="uppercase text-xs font-bold text-indigo-600 dark:text-indigo-400">{u.plan || 'FREE'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs text-slate-600 dark:text-slate-300">
                          {u.aiProviderPreference === 'byok' ? '🔑 Custom BYOK' : '⚡ Server System'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {u.isBlocked ? (
                          <span className="inline-flex items-center gap-1 text-xs text-rose-600 font-medium">
                            <Lock className="w-3 h-3" /> Suspended
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                            <CheckCircle className="w-3 h-3" /> Active
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: STUDENT USERS DIRECTORY ─── */}
      {activeTab === 'users' && (
        <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchUsers(1)}
                placeholder="Search students by email or name..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
              <select
                value={userPlanFilter}
                onChange={(e) => setUserPlanFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Plans</option>
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="campus">Campus</option>
              </select>

              <select
                value={userStatusFilter}
                onChange={(e) => setUserStatusFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="blocked">Suspended Only</option>
              </select>

              <button
                onClick={() => fetchUsers(1)}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors"
              >
                Search
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Plan (Click to Change)</th>
                  <th className="py-3 px-4">AI Mode</th>
                  <th className="py-3 px-4 text-center">Courses</th>
                  <th className="py-3 px-4 text-center">Tasks</th>
                  <th className="py-3 px-4 text-center">Chats</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Moderation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {usersList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 text-sm">
                      No student records match the search filter.
                    </td>
                  </tr>
                ) : (
                  usersList.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-750 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                          {u.fullName || 'Student'}
                          {u.role === 'admin' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-500">
                              ADMIN
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{u.email}</div>
                        {u.university && (
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                            {u.university} {u.major ? `• ${u.major}` : ''}
                          </div>
                        )}
                      </td>

                      {/* Plan Change Dropdown */}
                      <td className="py-3 px-4">
                        <select
                          disabled={actionLoadingId === u.id}
                          value={u.plan || 'free'}
                          onChange={(e) => handleUpdatePlan(u.id, e.target.value as any)}
                          className={`text-xs font-bold uppercase rounded-lg px-2.5 py-1.5 border transition-all cursor-pointer ${
                            u.plan === 'pro'
                              ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700'
                              : u.plan === 'campus'
                              ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          <option value="free">FREE</option>
                          <option value="pro">PRO ($9/mo)</option>
                          <option value="campus">CAMPUS (Unltd)</option>
                        </select>
                      </td>

                      {/* AI Mode & BYOK status */}
                      <td className="py-3 px-4">
                        {u.aiProviderPreference === 'byok' ? (
                          <div className="flex items-center gap-1.5 text-xs text-purple-700 dark:text-purple-300 font-medium">
                            <Key className="w-3.5 h-3.5 text-purple-500" />
                            <span>BYOK ({u.activeByokProvider || 'Custom'})</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium">
                            <Zap className="w-3.5 h-3.5 text-cyan-500" />
                            <span>Server System</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center font-semibold text-slate-700 dark:text-slate-300">
                        {u.coursesCount}
                      </td>

                      <td className="py-3 px-4 text-center font-semibold text-slate-700 dark:text-slate-300">
                        {u.tasksCount}
                      </td>

                      <td className="py-3 px-4 text-center font-semibold text-slate-700 dark:text-slate-300">
                        {u.chatMessagesCount}
                      </td>

                      <td className="py-3 px-4">
                        {u.isBlocked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                            <UserX className="w-3 h-3" /> Suspended
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            <UserCheck className="w-3 h-3" /> Active
                          </span>
                        )}
                      </td>

                      {/* Action: Block / Unblock */}
                      <td className="py-3 px-4 text-right">
                        <button
                          disabled={actionLoadingId === u.id || u.id === user.id}
                          onClick={() => handleToggleUserBlock(u.id, u.isBlocked, u.email)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 disabled:opacity-40 ${
                            u.isBlocked
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                              : 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                          }`}
                        >
                          {u.isBlocked ? 'Reactivate' : 'Suspend'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2">
            <span>
              Showing page {usersPagination.page} of {usersPagination.totalPages} ({usersPagination.total} total students)
            </span>
            <div className="flex gap-2">
              <button
                disabled={usersPagination.page <= 1}
                onClick={() => fetchUsers(usersPagination.page - 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={usersPagination.page >= usersPagination.totalPages}
                onClick={() => fetchUsers(usersPagination.page + 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: COURSE MODERATION ─── */}
      {activeTab === 'courses' && (
        <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
              <input
                type="text"
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchCourses(1)}
                placeholder="Search courses by course title..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-3">
              <select
                value={courseStatusFilter}
                onChange={(e) => setCourseStatusFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Course Statuses</option>
                <option value="active">Active Courses</option>
                <option value="blocked">Suspended Courses</option>
              </select>

              <button
                onClick={() => fetchCourses(1)}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors"
              >
                Search
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-4">Course</th>
                  <th className="py-3 px-4">Student Owner</th>
                  <th className="py-3 px-4 text-center">Docs / Notes</th>
                  <th className="py-3 px-4 text-center">Chat Queries</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Moderation Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {coursesList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 text-sm">
                      No courses match the moderation query.
                    </td>
                  </tr>
                ) : (
                  coursesList.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-750 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: c.colorTag || '#6366F1' }}
                          />
                          {c.name}
                        </div>
                        <div className="text-xs text-slate-400 font-mono">ID: {c.id.substring(0, 13)}...</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800 dark:text-slate-200">{c.ownerName}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{c.ownerEmail}</div>
                      </td>

                      <td className="py-3 px-4 text-center font-semibold text-slate-700 dark:text-slate-300">
                        {c.materialsCount}
                      </td>

                      <td className="py-3 px-4 text-center font-semibold text-slate-700 dark:text-slate-300">
                        {c.chatMessagesCount}
                      </td>

                      <td className="py-3 px-4">
                        {c.isBlocked ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                            <Lock className="w-3 h-3" /> Suspended
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            <CheckCircle className="w-3 h-3" /> Active
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400">
                        {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          disabled={actionLoadingId === c.id}
                          onClick={() => handleToggleCourseBlock(c.id, c.isBlocked, c.name)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 disabled:opacity-40 ${
                            c.isBlocked
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                              : 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                          }`}
                        >
                          {c.isBlocked ? 'Reactivate Course' : 'Suspend Course'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2">
            <span>
              Showing page {coursesPagination.page} of {coursesPagination.totalPages} ({coursesPagination.total} total courses)
            </span>
            <div className="flex gap-2">
              <button
                disabled={coursesPagination.page <= 1}
                onClick={() => fetchCourses(coursesPagination.page - 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={coursesPagination.page >= coursesPagination.totalPages}
                onClick={() => fetchCourses(coursesPagination.page + 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 4: AI & BYOK QUOTAS ─── */}
      {activeTab === 'ai' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-semibold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                <Key className="w-5 h-5 text-purple-500" />
                BYOK Registered Keys
              </h3>
              <div className="text-3xl font-extrabold text-purple-600 dark:text-purple-400 mb-4">
                {aiUsage?.keysRegistered?.total ?? 0}
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-700">
                  <span className="text-slate-600 dark:text-slate-400">Google Gemini Keys:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{aiUsage?.keysRegistered?.gemini ?? 0}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-700">
                  <span className="text-slate-600 dark:text-slate-400">Groq (Llama) Keys:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{aiUsage?.keysRegistered?.groq ?? 0}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-700">
                  <span className="text-slate-600 dark:text-slate-400">OpenAI (GPT-4o) Keys:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{aiUsage?.keysRegistered?.openai ?? 0}</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-6 shadow-sm md:col-span-2">
              <h3 className="text-base font-semibold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                <Cpu className="w-5 h-5 text-indigo-500" />
                Token Quota Policies Enforced
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 mb-2">
                    Free Plan
                  </span>
                  <div className="text-lg font-bold text-slate-900 dark:text-white">50,000</div>
                  <div className="text-xs text-slate-500 mt-1">tokens / month</div>
                  <div className="text-[11px] text-slate-400 mt-3 border-t border-slate-200 dark:border-slate-800 pt-2">
                    Model: Gemini 2.5 Flash via server key. Max 3 courses.
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
                  <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-indigo-600 text-white mb-2">
                    Pro Plan ($9/mo)
                  </span>
                  <div className="text-lg font-bold text-indigo-700 dark:text-indigo-300">500,000</div>
                  <div className="text-xs text-indigo-600/70 dark:text-indigo-400 mt-1">tokens / month</div>
                  <div className="text-[11px] text-indigo-600/70 dark:text-indigo-400 mt-3 border-t border-indigo-200 dark:border-indigo-800 pt-2">
                    Gemini 2.5 Flash/Pro + Groq Llama 3.3. Max 15 courses.
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                  <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-amber-500 text-white mb-2">
                    Campus / BYOK
                  </span>
                  <div className="text-lg font-bold text-amber-700 dark:text-amber-300">Unlimited</div>
                  <div className="text-xs text-amber-600/70 dark:text-amber-400 mt-1">tokens / month</div>
                  <div className="text-[11px] text-amber-600/70 dark:text-amber-400 mt-3 border-t border-amber-200 dark:border-amber-800 pt-2">
                    Zero server token liability. All models supported.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 5: SYSTEM & HEALTH ─── */}
      {activeTab === 'health' && (
        <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-6 shadow-sm space-y-6">
          <h3 className="text-base font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-indigo-500" />
            Infrastructure & Runtime Status
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm text-emerald-900 dark:text-emerald-300">Vercel Serverless Function</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="text-xs text-emerald-700 dark:text-emerald-400">
                Live at <code className="bg-white/60 dark:bg-black/30 px-1 py-0.5 rounded">/api/health</code>. HTTP 200 OK.
              </div>
            </div>

            <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm text-emerald-900 dark:text-emerald-300">Supabase Cloud DB</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              </div>
              <div className="text-xs text-emerald-700 dark:text-emerald-400">
                PostgreSQL 17 active in <code className="bg-white/60 dark:bg-black/30 px-1 py-0.5 rounded">ap-south-1</code>.
              </div>
            </div>

            <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-950/20">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm text-indigo-900 dark:text-indigo-300">WASM Crypto Engine</span>
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              </div>
              <div className="text-xs text-indigo-700 dark:text-indigo-400">
                WebAssembly Argon2id active with 0 native C++ dependencies.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
