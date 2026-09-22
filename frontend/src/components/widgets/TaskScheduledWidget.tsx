import { useNavigate } from 'react-router-dom';
import {
  CalendarCheck2,
  Mail,
  Bell,
  CheckCircle2,
  Calendar,
  ArrowRight,
  Sparkles,
  BookOpen,
} from 'lucide-react';

export interface TaskScheduledData {
  task: {
    id: string;
    title: string;
    type: string;
    subject?: string;
    deadline: string;
    priority?: string;
    description?: string;
  };
  reminders: Array<{
    label: string;
    timeFormatted: string;
    channel: string;
  }>;
  calendarUrl?: string;
}

interface TaskScheduledWidgetProps {
  data: TaskScheduledData;
}

export default function TaskScheduledWidget({ data }: TaskScheduledWidgetProps) {
  const navigate = useNavigate();
  const { task, reminders, calendarUrl = '/calendar' } = data;

  const getTypeStyle = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'quiz':
        return { bg: 'rgba(239, 68, 68, 0.15)', text: '#F87171', border: 'rgba(239, 68, 68, 0.3)', label: 'Quiz' };
      case 'assignment':
        return { bg: 'rgba(59, 130, 246, 0.15)', text: '#60A5FA', border: 'rgba(59, 130, 246, 0.3)', label: 'Assignment' };
      case 'exam':
        return { bg: 'rgba(168, 85, 247, 0.15)', text: '#C084FC', border: 'rgba(168, 85, 247, 0.3)', label: 'Exam' };
      case 'project':
        return { bg: 'rgba(16, 185, 129, 0.15)', text: '#34D399', border: 'rgba(16, 185, 129, 0.3)', label: 'Project' };
      default:
        return { bg: 'rgba(245, 158, 11, 0.15)', text: '#FBBF24', border: 'rgba(245, 158, 11, 0.3)', label: 'Task' };
    }
  };

  const getPriorityBadge = (priority?: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return { bg: 'rgba(239, 68, 68, 0.12)', text: '#EF4444', label: 'High Priority' };
      case 'low':
        return { bg: 'rgba(107, 114, 128, 0.15)', text: '#9CA3AF', label: 'Low Priority' };
      default:
        return { bg: 'rgba(245, 158, 11, 0.12)', text: '#F59E0B', label: 'Medium Priority' };
    }
  };

  const typeStyle = getTypeStyle(task.type);
  const priorityStyle = getPriorityBadge(task.priority);

  const formattedDeadline = new Date(task.deadline).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      style={{
        margin: '12px 0',
        borderRadius: '16px',
        border: '1px solid rgba(99, 102, 241, 0.35)',
        background: 'linear-gradient(145deg, rgba(17, 24, 39, 0.95) 0%, rgba(30, 27, 75, 0.85) 100%)',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45), 0 0 24px rgba(99, 102, 241, 0.18)',
        backdropFilter: 'blur(16px)',
        overflow: 'hidden',
        fontFamily: 'inherit',
        color: '#E0E7FF',
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.25) 0%, rgba(139, 92, 246, 0.2) 100%)',
          borderBottom: '1px solid rgba(99, 102, 241, 0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              color: '#FFFFFF',
              boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)',
            }}
          >
            <CalendarCheck2 size={16} />
          </div>
          <span style={{ fontWeight: 600, fontSize: '0.92rem', letterSpacing: '0.01em', color: '#F1F5F9' }}>
            Academic Task Scheduled
          </span>
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '0.74rem',
            fontWeight: 600,
            background: 'rgba(16, 185, 129, 0.16)',
            color: '#34D399',
            border: '1px solid rgba(16, 185, 129, 0.35)',
          }}
        >
          <CheckCircle2 size={12} />
          <span>Synced to Calendar</span>
        </div>
      </div>

      {/* Main Task Content */}
      <div style={{ padding: '16px 20px' }}>
        {/* Title and Badges */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
          <div>
            <h4
              style={{
                margin: 0,
                fontSize: '1.15rem',
                fontWeight: 700,
                color: '#FFFFFF',
                lineHeight: 1.3,
              }}
            >
              {task.title}
            </h4>
            {task.subject && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  marginTop: '4px',
                  fontSize: '0.8rem',
                  color: '#94A3B8',
                }}
              >
                <BookOpen size={13} style={{ color: '#818CF8' }} />
                <span>{task.subject}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <span
              style={{
                display: 'inline-block',
                padding: '3px 9px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 600,
                background: typeStyle.bg,
                color: typeStyle.text,
                border: `1px solid ${typeStyle.border}`,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {typeStyle.label}
            </span>
            <span
              style={{
                display: 'inline-block',
                padding: '3px 9px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 500,
                background: priorityStyle.bg,
                color: priorityStyle.text,
              }}
            >
              {priorityStyle.label}
            </span>
          </div>
        </div>

        {/* Deadline Banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            borderRadius: '10px',
            background: 'rgba(30, 41, 59, 0.7)',
            border: '1px solid rgba(148, 163, 184, 0.15)',
            marginBottom: '14px',
          }}
        >
          <Calendar size={16} style={{ color: '#F59E0B', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#94A3B8' }}>
              Due Date
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#F8FAFC' }}>
              {formattedDeadline}
            </div>
          </div>
        </div>

        {task.description && (
          <p style={{ margin: '0 0 14px 0', fontSize: '0.82rem', color: '#CBD5E1', lineHeight: 1.45 }}>
            {task.description}
          </p>
        )}

        {/* Dual Email Reminders Section */}
        <div
          style={{
            borderRadius: '12px',
            padding: '12px 14px',
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: '#A5B4FC',
              marginBottom: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            <Bell size={13} style={{ color: '#818CF8' }} />
            <span>Automated Day-Wise & Week-Wise Email Reminders</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {reminders && reminders.length > 0 ? (
              reminders.map((r, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'rgba(30, 41, 59, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Mail size={14} style={{ color: i === 0 ? '#38BDF8' : '#F472B6' }} />
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#F1F5F9' }}>
                      {r.label}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: '#CBD5E1', fontWeight: 500 }}>
                    {r.timeFormatted}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                Day-wise & week-wise reminders scheduled (1 Week, 3 Days, & 1 Day before deadline).
              </div>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '10px',
              fontSize: '0.74rem',
              color: '#94A3B8',
            }}
          >
            <Sparkles size={12} style={{ color: '#F59E0B' }} />
            <span>Automated dispatch via verified Gmail SMTP. Zero manual action required!</span>
          </div>
        </div>

        {/* Footer Action */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            onClick={() => navigate(calendarUrl)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 18px rgba(79, 70, 229, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(79, 70, 229, 0.35)';
            }}
          >
            <Calendar size={15} />
            <span>View in Calendar</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
