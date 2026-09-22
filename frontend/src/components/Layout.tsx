import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  GraduationCap,
  Bot,
  Settings,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import { authApi } from '../services/api';
import toast from 'react-hot-toast';

interface LayoutProps {
  user: { fullName: string; email: string; role?: string };
  onLogout: () => void;
}

export default function Layout({ user, onLogout }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isChatbotPage = location.pathname.startsWith('/chatbot');
  const isCoursesPage = location.pathname.startsWith('/my-courses');
  const isDashboardPage = location.pathname === '/dashboard' || location.pathname === '/' || location.pathname === '';
  const isAdminPage = location.pathname.startsWith('/admin');

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch { }
    onLogout();
    navigate('/');
    toast.success('Signed out safely.');
  };

  return (
    <div className={`app-layout has-sidebar ${isChatbotPage ? 'chatbot-mode' : ''}`}>
      {/* ─── Sleek Left Sidebar Navigation ──────────────────────────────── */}
      <aside className="app-sidebar">
        {/* Top: Brand Header (Large Clean Logo, No Border, No Shade) */}
        <div className="sidebar-brand-container">
          <NavLink to="/dashboard" className="sidebar-brand-link" title="StudySync AI — Dashboard">
            <img
              src="/studysync-logo-transparent.png"
              alt="StudySync AI"
              className="sidebar-brand-logo-img"
            />
          </NavLink>
        </div>

        {/* Center: Main Navigation List Divided into Modern Sections */}
        <nav className="sidebar-nav">
          <div className="sidebar-nav-section">
            <div className="sidebar-nav-label">Workspace</div>
            <NavLink
              to="/dashboard"
              className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
              title="Dashboard"
            >
              <div className="sidebar-nav-icon-wrap">
                <LayoutDashboard size={19} />
              </div>
              <span className="sidebar-nav-title">Dashboard</span>
            </NavLink>

            <NavLink
              to="/calendar"
              className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
              title="Calendar"
            >
              <div className="sidebar-nav-icon-wrap">
                <CalendarDays size={19} />
              </div>
              <span className="sidebar-nav-title">Calendar</span>
            </NavLink>

            <NavLink
              to="/my-courses"
              className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
              title="Courses"
            >
              <div className="sidebar-nav-icon-wrap">
                <GraduationCap size={19} />
              </div>
              <span className="sidebar-nav-title">Courses</span>
            </NavLink>
          </div>

          <div className="sidebar-nav-section">
            <div className="sidebar-nav-label">Intelligence</div>
            <NavLink
              to="/chatbot"
              className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
              title="AI Chatbot Assistant"
            >
              <div className="sidebar-nav-icon-wrap">
                <Bot size={19} />
              </div>
              <span className="sidebar-nav-title">AI Chatbot</span>
              <span className="sidebar-ai-glow-badge">AI 2.0</span>
            </NavLink>
          </div>

          <div className="sidebar-nav-section">
            <div className="sidebar-nav-label">Preferences</div>
            <NavLink
              to="/settings"
              className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
              title="Settings"
            >
              <div className="sidebar-nav-icon-wrap">
                <Settings size={19} />
              </div>
              <span className="sidebar-nav-title">Settings</span>
            </NavLink>
          </div>

          {user?.role === 'admin' && (
            <div className="sidebar-nav-section">
              <div className="sidebar-nav-label" style={{ color: '#F59E0B' }}>Governance</div>
              <NavLink
                to="/admin"
                className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
                title="Admin Portal"
              >
                <div className="sidebar-nav-icon-wrap" style={{ color: '#F59E0B' }}>
                  <ShieldCheck size={19} />
                </div>
                <span className="sidebar-nav-title" style={{ fontWeight: 600 }}>Admin Portal</span>
                <span style={{
                  marginLeft: 'auto',
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(239, 68, 68, 0.25))',
                  color: '#F59E0B',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  padding: '2px 7px',
                  borderRadius: '9999px',
                  letterSpacing: '0.05em'
                }}>
                  Admin
                </span>
              </NavLink>
            </div>
          )}

          <div className="sidebar-logout-item">
            <button
              type="button"
              onClick={handleLogout}
              className="sidebar-logout-btn-link"
              title="Log out safely"
            >
              <div className="sidebar-nav-icon-wrap">
                <LogOut size={18} />
              </div>
              <span className="sidebar-nav-title">Sign Out</span>
            </button>
          </div>
        </nav>
      </aside>

      {/* ─── Main Viewport Area ───────────────────────────────────────── */}
      <main className={`main-content ${isChatbotPage ? 'chatbot-mode' : ''}`}>
        <div
          className={`page-container ${isChatbotPage ? 'page-container-chatbot' : ''} ${isCoursesPage ? 'page-container-courses' : ''
            } ${isDashboardPage ? 'page-container-dashboard' : ''} ${isAdminPage ? 'page-container-admin' : ''}`}
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
}
