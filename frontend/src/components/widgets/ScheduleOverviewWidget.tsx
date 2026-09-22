import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ArrowRight,
  BookOpen,
  Calendar,
} from 'lucide-react';

export interface ScheduleOverviewData {
  title: string;
  tasks: Array<{
    id: string;
    title: string;
    type: string;
    subject?: string;
    deadline: string;
    priority?: string;
    timeRemaining?: string;
  }>;
  calendarUrl?: string;
}

interface ScheduleOverviewWidgetProps {
  data: ScheduleOverviewData;
}

export default function ScheduleOverviewWidget({ data }: ScheduleOverviewWidgetProps) {
  const navigate = useNavigate();
  const { title, tasks, calendarUrl = '/calendar' } = data;

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

  const formatTaskDay = (deadlineStr: string) => {
    try {
      const d = new Date(deadlineStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
      }
    } catch {}
    return deadlineStr;
  };

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
            <CalendarDays size={16} />
          </div>
          <span style={{ fontWeight: 600, fontSize: '0.92rem', letterSpacing: '0.01em', color: '#F1F5F9' }}>
            {title || 'Academic Schedule & Deadlines'}
          </span>
        </div>

        <span
          style={{
            fontSize: '0.75rem',
            padding: '3px 9px',
            borderRadius: '12px',
            background: 'rgba(99, 102, 241, 0.2)',
            color: '#C7D2FE',
            fontWeight: 600,
          }}
        >
          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
        </span>
      </div>

      {/* Task List */}
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {tasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#94A3B8', fontSize: '0.85rem' }}>
            🎉 No upcoming academic tasks or deadlines found. You are all caught up!
          </div>
        ) : (
          tasks.map((task) => {
            const typeStyle = getTypeStyle(task.type);
            return (
              <div
                key={task.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'rgba(30, 41, 59, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  gap: '12px',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                    <span
                      style={{
                        padding: '2px 7px',
                        borderRadius: '5px',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        background: typeStyle.bg,
                        color: typeStyle.text,
                        border: `1px solid ${typeStyle.border}`,
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                      }}
                    >
                      {typeStyle.label}
                    </span>
                    <span
                      style={{
                        fontSize: '0.88rem',
                        fontWeight: 600,
                        color: '#FFFFFF',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {task.title}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.76rem', color: '#94A3B8' }}>
                    {task.subject && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <BookOpen size={11} style={{ color: '#818CF8' }} />
                        {task.subject}
                      </span>
                    )}
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={11} style={{ color: '#F59E0B' }} />
                      {formatTaskDay(task.deadline)}
                    </span>
                  </div>
                </div>

                {task.timeRemaining && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '4px 8px',
                      borderRadius: '6px',
                      background: 'rgba(99, 102, 241, 0.15)',
                      color: '#A5B4FC',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {task.timeRemaining}
                  </span>
                )}
              </div>
            );
          })
        )}

        {/* Footer Navigation */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
          <button
            type="button"
            onClick={() => navigate(calendarUrl)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '9px',
              background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
              transition: 'all 0.2s ease',
            }}
          >
            <Calendar size={14} />
            <span>Open Full Calendar</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
