import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { adminApi, setAdminToken, getAdminToken } from '../services/api';
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
  Sparkles,
  Zap,
  Lock,
  UserCheck,
  UserX,
  ExternalLink,
  Activity,
  LogOut,
  KeyRound,
  ShieldAlert,
} from 'lucide-react';
import '../styles/admin.css';

export default function AdminPortal() {
  const navigate = useNavigate();
  const [adminUser, setAdminUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'courses' | 'ai' | 'security'>('overview');
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

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  // Action states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Initial authorization check
  useEffect(() => {
    checkAdminAuth();
  }, []);

  const checkAdminAuth = async () => {
    const token = getAdminToken();
    if (!token) {
      navigate('/admin/login', { replace: true });
      return;
    }

    try {
      const res = await adminApi.me();
      if (res.data.success && res.data.data) {
        setAdminUser(res.data.data);
        loadAllData();
      } else {
        setAdminToken(null);
        navigate('/admin/login', { replace: true });
      }
    } catch {
      setAdminToken(null);
      navigate('/admin/login', { replace: true });
    }
  };

  const handleLogout = async () => {
    try {
      await adminApi.logout();
    } catch {}
    setAdminToken(null);
    toast.success('Admin session ended securely.');
    navigate('/admin/login', { replace: true });
  };

  useEffect(() => {
    if (!adminUser) return;
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
    } catch {
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

  const handlePlanChange = async (userId: string, newPlan: 'free' | 'pro' | 'campus') => {
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
      toast.error(err?.response?.data?.message || 'Failed to update plan');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleUserBlock = async (userId: string, currentBlocked: boolean) => {
    const nextStatus = !currentBlocked;
    setActionLoadingId(userId);
    try {
      const res = await adminApi.updateUserStatus(userId, nextStatus);
      if (res.data.success) {
        toast.success(nextStatus ? 'Student account suspended' : 'Student account reactivated');
        setUsersList((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, isBlocked: nextStatus } : u))
        );
        fetchOverview();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update account status');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleCourseBlock = async (courseId: string, currentBlocked: boolean) => {
    const nextStatus = !currentBlocked;
    setActionLoadingId(courseId);
    try {
      const res = await adminApi.updateCourseStatus(courseId, nextStatus);
      if (res.data.success) {
        toast.success(nextStatus ? 'Course suspended' : 'Course restored');
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

  const handleChangeAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      toast.error('Please enter current and new passwords.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters long.');
      return;
    }

    setChangingPass(true);
    try {
      const res = await adminApi.changePassword({ currentPassword, newPassword });
      if (res.data.success) {
        toast.success('Admin password updated successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(res.data.message || 'Could not update password.');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to change password.');
    } finally {
      setChangingPass(false);
    }
  };

  if (loading && !overview) {
    return (
      <div className="admin-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '42px',
            height: '42px',
            border: '3px solid rgba(99,102,241,0.2)',
            borderTopColor: '#6366F1',
            borderRadius: '50%',
            animation: 'adminPulse 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#FFFFFF' }}>Connecting to Operations Vault...</h3>
          <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: '#94A3B8' }}>
            Verifying isolated admin session & telemetry
          </p>
        </div>
      </div>
    );
  }

  const uStats = overview?.users || {};
  const aStats = overview?.activity || {};

  return (
    <div className="admin-shell">
      <div className="admin-shell-glow" />
      <div className="admin-shell-glow-2" />

      {/* ─── Dedicated Admin Navigation Bar ─────────────────────────────── */}
      <header className="admin-nav">
        <div className="admin-nav-left">
          <div className="admin-brand-icon">
            <Shield size={22} />
          </div>
          <div className="admin-brand-text">
            <h2>StudySync AI Operations</h2>
            <p>High-Security Control Center</p>
          </div>
        </div>

        <div className="admin-nav-right">
          <div className="admin-badge-live">
            <span className="admin-pulse-dot" />
            Live DB Connected
          </div>

          {adminUser && (
            <div className="admin-user-pill">
              <Key size={14} style={{ color: '#F59E0B' }} />
              <span>Admin: <strong>{adminUser.username}</strong></span>
            </div>
          )}

          <button onClick={handleLogout} className="admin-btn-logout" title="Sign out of Operations">
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </header>

      {/* ─── Main Admin Container ───────────────────────────────────────── */}
      <main className="admin-container">
        {/* Banner Card */}
        <section className="admin-banner">
          <div className="admin-banner-glow" />
          <div>
            <div className="admin-banner-header">
              <span className="admin-role-badge">
                <Shield size={13} />
                Isolated Master Session
              </span>
              <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                Active Admin ID: <strong style={{ color: '#CBD5E1' }}>{adminUser?.email || 'admin@studysync.ai'}</strong>
              </span>
            </div>
            <h1 className="admin-banner-title">Platform Operations Center</h1>
            <p className="admin-banner-subtitle">
              Monitor real-time student activity, govern subscriptions, audit BYOK vs System AI token consumption, and enforce moderation.
            </p>
          </div>

          <div className="admin-banner-actions">
            <button
              onClick={handleRefresh}
              className="admin-btn-primary"
              disabled={refreshing}
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Syncing...' : 'Sync Telemetry'}
            </button>
            <a
              href="https://supabase.com/dashboard/project/twluwkcduduvswmjvqfl"
              target="_blank"
              rel="noopener noreferrer"
              className="admin-btn-secondary"
            >
              <Database size={15} style={{ color: '#38BDF8' }} />
              Supabase Cloud
              <ExternalLink size={13} />
            </a>
          </div>
        </section>

        {/* ─── 4 KPI Metrics Grid ───────────────────────────────────────── */}
        <section className="admin-stats-grid">
          <div className="admin-stat-card">
            <div className="admin-stat-top">
              <span className="admin-stat-label">Total Students</span>
              <div className="admin-stat-icon indigo">
                <Users size={19} />
              </div>
            </div>
            <div className="admin-stat-value">{uStats.total || 0}</div>
            <div className="admin-stat-subtext">
              <strong style={{ color: '#34D399' }}>+{uStats.newThisWeek || 0}</strong> new this week • {uStats.blocked || 0} suspended
            </div>
          </div>

          <div className="admin-stat-card">
            <div className="admin-stat-top">
              <span className="admin-stat-label">Pro / Campus Plans</span>
              <div className="admin-stat-icon amber">
                <Sparkles size={19} />
              </div>
            </div>
            <div className="admin-stat-value">
              {(uStats.planBreakdown?.pro || 0) + (uStats.planBreakdown?.campus || 0)}
            </div>
            <div className="admin-stat-subtext">
              {uStats.planBreakdown?.free || 0} on Free tier
            </div>
          </div>

          <div className="admin-stat-card">
            <div className="admin-stat-top">
              <span className="admin-stat-label">Active Courses</span>
              <div className="admin-stat-icon cyan">
                <BookOpen size={19} />
              </div>
            </div>
            <div className="admin-stat-value">{aStats.totalCourses || 0}</div>
            <div className="admin-stat-subtext">
              {aStats.blockedCourses || 0} suspended • {aStats.totalMaterials || 0} materials
            </div>
          </div>

          <div className="admin-stat-card">
            <div className="admin-stat-top">
              <span className="admin-stat-label">AI Interactions</span>
              <div className="admin-stat-icon emerald">
                <Cpu size={19} />
              </div>
            </div>
            <div className="admin-stat-value">{aStats.totalChatMessages || 0}</div>
            <div className="admin-stat-subtext">
              {uStats.aiModeBreakdown?.byok || 0} BYOK users • {uStats.aiModeBreakdown?.system || 0} System Key
            </div>
          </div>
        </section>

        {/* ─── Navigation Tabs ─────────────────────────────────────────── */}
        <nav className="admin-tabs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`admin-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          >
            <Activity size={16} />
            Overview & Analytics
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          >
            <Users size={16} />
            Student Directory
            <span className="admin-tab-badge">{uStats.total || 0}</span>
          </button>
          <button
            onClick={() => setActiveTab('courses')}
            className={`admin-tab-btn ${activeTab === 'courses' ? 'active' : ''}`}
          >
            <BookOpen size={16} />
            Course Moderation
            <span className="admin-tab-badge">{aStats.totalCourses || 0}</span>
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`admin-tab-btn ${activeTab === 'ai' ? 'active' : ''}`}
          >
            <Cpu size={16} />
            AI & BYOK Quotas
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`admin-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
          >
            <Lock size={16} />
            Security & Credentials
          </button>
        </nav>

        {/* ─── TAB 1: OVERVIEW & ANALYTICS ─────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="animate-fadeIn">
            <div className="admin-grid-2">
              <div className="admin-card-section">
                <h3>Subscription Plans Breakdown</h3>
                <p className="sub">Distribution of student accounts across billing tiers</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                      <span>Free Plan (Standard)</span>
                      <strong>{uStats.planBreakdown?.free || 0} students</strong>
                    </div>
                    <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '9999px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        background: '#94A3B8',
                        width: `${((uStats.planBreakdown?.free || 0) / Math.max(uStats.total || 1, 1)) * 100}%`
                      }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                      <span style={{ color: '#818CF8' }}>Pro Plan ($9/mo)</span>
                      <strong style={{ color: '#818CF8' }}>{uStats.planBreakdown?.pro || 0} students</strong>
                    </div>
                    <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '9999px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        background: '#6366F1',
                        width: `${((uStats.planBreakdown?.pro || 0) / Math.max(uStats.total || 1, 1)) * 100}%`
                      }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                      <span style={{ color: '#FBBF24' }}>Campus Plan (University)</span>
                      <strong style={{ color: '#FBBF24' }}>{uStats.planBreakdown?.campus || 0} students</strong>
                    </div>
                    <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '9999px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        background: '#F59E0B',
                        width: `${((uStats.planBreakdown?.campus || 0) / Math.max(uStats.total || 1, 1)) * 100}%`
                      }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="admin-card-section">
                <h3>AI Key Consumption Model</h3>
                <p className="sub">Platform resource usage vs user-provided BYOK keys</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ padding: '16px', background: 'var(--admin-bg-card)', borderRadius: '10px', border: '1px solid var(--admin-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Zap size={16} style={{ color: '#F59E0B' }} />
                        Server System Key
                      </span>
                      <span className="admin-pill plan-pro">{uStats.aiModeBreakdown?.system || 0} users</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#94A3B8' }}>
                      Consuming server system quotas (Gemini 2.5 Flash / Groq Llama 3.3).
                    </p>
                  </div>

                  <div style={{ padding: '16px', background: 'var(--admin-bg-card)', borderRadius: '10px', border: '1px solid var(--admin-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Key size={16} style={{ color: '#06B6D4' }} />
                        Student BYOK Keys
                      </span>
                      <span className="admin-pill plan-campus">{uStats.aiModeBreakdown?.byok || 0} users</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#94A3B8' }}>
                      Zero cost to server — users provided custom Gemini/Groq/OpenAI keys.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Signups */}
            <div className="admin-card-section">
              <h3>Recently Enrolled Students</h3>
              <p className="sub">Latest student registrations synced from Supabase Cloud</p>
              <div className="admin-table-wrapper" style={{ marginBottom: 0 }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Billing Plan</th>
                      <th>AI Preference</th>
                      <th>Registered</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(overview?.recentSignups || []).map((s: any) => (
                      <tr key={s.id}>
                        <td>
                          <div className="admin-user-cell">
                            <div className="admin-user-avatar">
                              {s.fullName?.[0]?.toUpperCase() || 'S'}
                            </div>
                            <div className="admin-user-info">
                              <h4>{s.fullName}</h4>
                              <p>{s.email}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`admin-pill plan-${s.plan || 'free'}`}>
                            {s.plan || 'free'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.8rem', color: '#CBD5E1' }}>
                            {s.aiProviderPreference === 'byok' ? 'Custom BYOK' : 'System Key'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                            {new Date(s.createdAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td>
                          <span className={`admin-pill ${s.isBlocked ? 'status-blocked' : 'status-active'}`}>
                            {s.isBlocked ? 'Suspended' : 'Active'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 2: STUDENT DIRECTORY ─────────────────────────────────── */}
        {activeTab === 'users' && (
          <div className="animate-fadeIn">
            <div className="admin-control-bar">
              <div className="admin-search-wrap">
                <Search className="admin-search-icon" size={17} />
                <input
                  type="text"
                  placeholder="Search students by name or email..."
                  className="admin-input-search"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchUsers(1)}
                />
              </div>

              <div className="admin-filter-group">
                <select
                  className="admin-select"
                  value={userPlanFilter}
                  onChange={(e) => setUserPlanFilter(e.target.value)}
                >
                  <option value="all">All Plans</option>
                  <option value="free">Free Tier</option>
                  <option value="pro">Pro Tier</option>
                  <option value="campus">Campus Tier</option>
                </select>

                <select
                  className="admin-select"
                  value={userStatusFilter}
                  onChange={(e) => setUserStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="blocked">Suspended Only</option>
                </select>

                <button
                  onClick={() => fetchUsers(1)}
                  className="admin-btn-secondary"
                >
                  Apply Filters
                </button>
              </div>
            </div>

            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Student Name & Email</th>
                    <th>Plan Management</th>
                    <th>Courses</th>
                    <th>Chat Msgs</th>
                    <th>AI Mode</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
                        No students found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    usersList.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div className="admin-user-cell">
                            <div className="admin-user-avatar">
                              {u.fullName?.[0]?.toUpperCase() || 'S'}
                            </div>
                            <div className="admin-user-info">
                              <h4>{u.fullName}</h4>
                              <p>{u.email}</p>
                              {u.university && (
                                <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                                  {u.university} {u.major ? `• ${u.major}` : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <select
                            className="admin-select"
                            value={u.plan || 'free'}
                            disabled={actionLoadingId === u.id}
                            onChange={(e) => handlePlanChange(u.id, e.target.value as any)}
                          >
                            <option value="free">Free</option>
                            <option value="pro">Pro ($9/mo)</option>
                            <option value="campus">Campus</option>
                          </select>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600 }}>{u.coursesCount || 0}</span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600 }}>{u.chatMessagesCount || 0}</span>
                        </td>
                        <td>
                          <span className={`admin-pill ${u.aiProviderPreference === 'byok' ? 'plan-campus' : 'plan-pro'}`}>
                            {u.aiProviderPreference === 'byok' ? `BYOK (${u.activeByokProvider || 'Custom'})` : 'System Key'}
                          </span>
                        </td>
                        <td>
                          <span className={`admin-pill ${u.isBlocked ? 'status-blocked' : 'status-active'}`}>
                            {u.isBlocked ? 'Suspended' : 'Active'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => handleToggleUserBlock(u.id, !!u.isBlocked)}
                            disabled={actionLoadingId === u.id}
                            className={`admin-btn-action ${u.isBlocked ? 'reactivate' : 'suspend'}`}
                          >
                            {u.isBlocked ? (
                              <>
                                <UserCheck size={14} />
                                Reactivate
                              </>
                            ) : (
                              <>
                                <UserX size={14} />
                                Suspend
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="admin-pagination">
                <span>
                  Showing {usersList.length} of {usersPagination.total} registered students
                </span>
                <div className="admin-pagination-btns">
                  <button
                    className="admin-page-btn"
                    disabled={usersPagination.page <= 1}
                    onClick={() => fetchUsers(usersPagination.page - 1)}
                  >
                    Previous
                  </button>
                  <span style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#FFFFFF' }}>
                    Page {usersPagination.page} of {usersPagination.totalPages}
                  </span>
                  <button
                    className="admin-page-btn"
                    disabled={usersPagination.page >= usersPagination.totalPages}
                    onClick={() => fetchUsers(usersPagination.page + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 3: COURSE MODERATION ─────────────────────────────────── */}
        {activeTab === 'courses' && (
          <div className="animate-fadeIn">
            <div className="admin-control-bar">
              <div className="admin-search-wrap">
                <Search className="admin-search-icon" size={17} />
                <input
                  type="text"
                  placeholder="Search courses by code or title..."
                  className="admin-input-search"
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchCourses(1)}
                />
              </div>

              <div className="admin-filter-group">
                <select
                  className="admin-select"
                  value={courseStatusFilter}
                  onChange={(e) => setCourseStatusFilter(e.target.value)}
                >
                  <option value="all">All Courses</option>
                  <option value="active">Active Only</option>
                  <option value="blocked">Suspended Only</option>
                </select>

                <button
                  onClick={() => fetchCourses(1)}
                  className="admin-btn-secondary"
                >
                  Apply Filters
                </button>
              </div>
            </div>

            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Instructor & Owner</th>
                    <th>Materials</th>
                    <th>Chats</th>
                    <th>Created</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Moderation</th>
                  </tr>
                </thead>
                <tbody>
                  {coursesList.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
                        No courses found.
                      </td>
                    </tr>
                  ) : (
                    coursesList.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <div>
                            <span style={{ fontWeight: 700, color: '#38BDF8', fontSize: '0.85rem' }}>
                              {c.code}
                            </span>
                            <h4 style={{ margin: '2px 0 0', fontSize: '0.88rem', color: '#FFFFFF' }}>
                              {c.title}
                            </h4>
                          </div>
                        </td>
                        <td>
                          <div>
                            <span style={{ color: '#FFFFFF' }}>{c.instructor || 'Not specified'}</span>
                            <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#94A3B8' }}>
                              Owner: {c.user?.fullName || c.user?.email || 'Student'}
                            </p>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600 }}>{c.materialsCount || 0}</span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600 }}>{c.chatsCount || 0}</span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                            {new Date(c.createdAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td>
                          <span className={`admin-pill ${c.isBlocked ? 'status-blocked' : 'status-active'}`}>
                            {c.isBlocked ? 'Suspended' : 'Active'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => handleToggleCourseBlock(c.id, !!c.isBlocked)}
                            disabled={actionLoadingId === c.id}
                            className={`admin-btn-action ${c.isBlocked ? 'reactivate' : 'suspend'}`}
                          >
                            {c.isBlocked ? (
                              <>
                                <CheckCircle size={14} />
                                Restore Course
                              </>
                            ) : (
                              <>
                                <ShieldAlert size={14} />
                                Suspend Course
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div className="admin-pagination">
                <span>
                  Showing {coursesList.length} of {coursesPagination.total} courses
                </span>
                <div className="admin-pagination-btns">
                  <button
                    className="admin-page-btn"
                    disabled={coursesPagination.page <= 1}
                    onClick={() => fetchCourses(coursesPagination.page - 1)}
                  >
                    Previous
                  </button>
                  <span style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#FFFFFF' }}>
                    Page {coursesPagination.page} of {coursesPagination.totalPages}
                  </span>
                  <button
                    className="admin-page-btn"
                    disabled={coursesPagination.page >= coursesPagination.totalPages}
                    onClick={() => fetchCourses(coursesPagination.page + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 4: AI & BYOK QUOTAS ─────────────────────────────────── */}
        {activeTab === 'ai' && (
          <div className="animate-fadeIn">
            {aiUsage && (
              <div className="admin-stats-grid" style={{ marginBottom: '24px' }}>
                <div className="admin-stat-card">
                  <div className="admin-stat-top">
                    <span className="admin-stat-label">System Key Consumers</span>
                    <div className="admin-stat-icon amber">
                      <Zap size={19} />
                    </div>
                  </div>
                  <div className="admin-stat-value">{aiUsage.userPreferences?.system || 0}</div>
                  <div className="admin-stat-subtext">Students relying on server AI keys</div>
                </div>

                <div className="admin-stat-card">
                  <div className="admin-stat-top">
                    <span className="admin-stat-label">BYOK Custom Keys</span>
                    <div className="admin-stat-icon cyan">
                      <Key size={19} />
                    </div>
                  </div>
                  <div className="admin-stat-value">{aiUsage.keysRegistered?.total || 0}</div>
                  <div className="admin-stat-subtext">
                    Gemini: {aiUsage.keysRegistered?.gemini || 0} • Groq: {aiUsage.keysRegistered?.groq || 0} • OpenAI: {aiUsage.keysRegistered?.openai || 0}
                  </div>
                </div>
              </div>
            )}

            <div className="admin-card-section">
              <h3>AI Consumption & BYOK Keys</h3>
              <p className="sub">Platform token quota enforcement and custom key distribution</p>

              <div className="admin-grid-2">
                <div className="admin-quota-tier">
                  <h4>
                    <span>Free Student Tier</span>
                    <span className="admin-pill plan-free">Default</span>
                  </h4>
                  <ul className="admin-quota-list">
                    <li>
                      <span>Monthly Token Quota:</span>
                      <span>50,000 tokens / mo</span>
                    </li>
                    <li>
                      <span>Active AI Model:</span>
                      <span>Gemini 2.5 Flash (System Key)</span>
                    </li>
                    <li>
                      <span>Allowed Courses:</span>
                      <span>3 courses maximum</span>
                    </li>
                    <li>
                      <span>BYOK Custom Keys:</span>
                      <span style={{ color: '#EF4444' }}>Not supported</span>
                    </li>
                  </ul>
                </div>

                <div className="admin-quota-tier" style={{ borderColor: 'rgba(99,102,241,0.4)' }}>
                  <h4>
                    <span>Pro Tier ($9/month)</span>
                    <span className="admin-pill plan-pro">Pro</span>
                  </h4>
                  <ul className="admin-quota-list">
                    <li>
                      <span>Monthly Token Quota:</span>
                      <span>500,000 tokens / mo</span>
                    </li>
                    <li>
                      <span>Active AI Models:</span>
                      <span>Gemini 2.5 Pro + Groq Llama 3.3</span>
                    </li>
                    <li>
                      <span>Allowed Courses:</span>
                      <span>15 courses</span>
                    </li>
                    <li>
                      <span>BYOK Custom Keys:</span>
                      <span style={{ color: '#10B981' }}>Supported</span>
                    </li>
                  </ul>
                </div>

                <div className="admin-quota-tier" style={{ borderColor: 'rgba(245,158,11,0.4)' }}>
                  <h4>
                    <span>Campus Enterprise Tier</span>
                    <span className="admin-pill plan-campus">Campus</span>
                  </h4>
                  <ul className="admin-quota-list">
                    <li>
                      <span>Monthly Token Quota:</span>
                      <span>Unlimited High-Speed</span>
                    </li>
                    <li>
                      <span>Active AI Models:</span>
                      <span>All Models + Web Search RAG</span>
                    </li>
                    <li>
                      <span>Allowed Courses:</span>
                      <span>Unlimited</span>
                    </li>
                    <li>
                      <span>BYOK Custom Keys:</span>
                      <span style={{ color: '#10B981' }}>OpenAI / Groq / Gemini</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 5: SECURITY & CREDENTIALS ───────────────────────────── */}
        {activeTab === 'security' && (
          <div className="animate-fadeIn">
            <div className="admin-card-section" style={{ maxWidth: '600px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <KeyRound size={20} style={{ color: '#F59E0B' }} />
                <h3 style={{ margin: 0 }}>Update Administrator Password</h3>
              </div>
              <p className="sub">
                Safely re-hash and update your administrative master credentials.
              </p>

              <form onSubmit={handleChangeAdminPassword}>
                <div className="admin-form-group">
                  <label className="admin-form-label" htmlFor="current-pass">Current Master Password</label>
                  <input
                    id="current-pass"
                    type="password"
                    className="admin-form-input"
                    style={{ paddingLeft: '14px' }}
                    placeholder="Current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label" htmlFor="new-pass">New Master Password</label>
                  <input
                    id="new-pass"
                    type="password"
                    className="admin-form-input"
                    style={{ paddingLeft: '14px' }}
                    placeholder="Min 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label" htmlFor="confirm-pass">Confirm New Master Password</label>
                  <input
                    id="confirm-pass"
                    type="password"
                    className="admin-form-input"
                    style={{ paddingLeft: '14px' }}
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="admin-btn-primary"
                  style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}
                  disabled={changingPass}
                >
                  <Lock size={16} />
                  {changingPass ? 'Updating Master Password...' : 'Save New Master Password'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
