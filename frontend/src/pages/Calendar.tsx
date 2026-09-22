import { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CheckCircle2,
  Calendar as CalendarIcon,
  Edit3,
  CalendarDays,
  BookOpen,
  Check,
} from 'lucide-react';
import { tasksApi } from '../services/api';
import TaskModal from '../components/TaskModal';
import toast from 'react-hot-toast';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface CalendarTask {
  id: string;
  title: string;
  type: string;
  deadline: string;
  priority: string;
  status: string;
  subject?: string | null;
  description?: string | null;
  source?: string;
}

export default function Calendar() {
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<CalendarTask | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    loadTasks();
  }, [year, month]);

  const loadTasks = async () => {
    // Buffer by 2 months before and after to cover month/week/day navigation smoothly
    const start = new Date(year, month - 2, 1).toISOString();
    const end = new Date(year, month + 3, 0, 23, 59, 59).toISOString();

    try {
      const { data } = await tasksApi.calendar(start, end);
      const rawTasks = data.data.tasks || [];
      setTasks(rawTasks.filter((t: CalendarTask) => t.status !== 'done'));
    } catch {
      toast.error('Could not load calendar data.');
    }
  };

  // ─── Navigation Handlers (Day, Week, Month) ──────────────────────
  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(year, month - 1, 1));
    } else if (viewMode === 'week') {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 1);
      setCurrentDate(d);
      setSelectedDate(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      );
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(year, month + 1, 1));
    } else if (viewMode === 'week') {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 1);
      setCurrentDate(d);
      setSelectedDate(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      );
    }
  };

  const goToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    );
  };

  // ─── Helpers ─────────────────────────────────────────────────────
  const getTasksForDate = (dateStr: string) => {
    return tasks.filter((t) => {
      if (!t.deadline || t.status === 'done') return false;
      const d = new Date(t.deadline);
      const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return localDateStr === dateStr;
    });
  };

  const getTagColor = (type: string) => {
    const colors: Record<string, string> = {
      quiz: '#DC2626', // Red
      assignment: '#2563EB', // Blue
      project: '#7C3AED', // Purple
      exam: '#D97706', // Amber
      personal: '#059669', // Emerald
      other: '#475569',
    };
    return colors[type] || colors.other;
  };

  const today = new Date();
  const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const isToday = (day: number, isCurrentMonth: boolean) => {
    return (
      isCurrentMonth &&
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  // ─── Week Days Calculation ───────────────────────────────────────
  const getWeekDays = (baseDate: Date) => {
    const current = new Date(baseDate);
    const dayOfWeek = current.getDay(); // 0 is Sun, 6 is Sat
    const startOfWeek = new Date(current);
    startOfWeek.setDate(current.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);

    const days: Array<{ dayName: string; dayNumber: number; dateStr: string; fullDate: Date; isToday: boolean }> = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const isTodayDate =
        d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear();

      days.push({
        dayName: DAYS[i],
        dayNumber: d.getDate(),
        dateStr,
        fullDate: d,
        isToday: isTodayDate,
      });
    }
    return days;
  };

  // ─── Dynamic Header Title ────────────────────────────────────────
  const getViewTitle = () => {
    if (viewMode === 'month') {
      return `${MONTHS[month]} ${year}`;
    }
    if (viewMode === 'week') {
      const weekDays = getWeekDays(currentDate);
      const start = weekDays[0].fullDate;
      const end = weekDays[6].fullDate;
      const startMonth = MONTHS[start.getMonth()].slice(0, 3);
      const endMonth = MONTHS[end.getMonth()].slice(0, 3);
      if (start.getFullYear() !== end.getFullYear()) {
        return `${startMonth} ${start.getDate()}, ${start.getFullYear()} – ${endMonth} ${end.getDate()}, ${end.getFullYear()}`;
      }
      if (start.getMonth() === end.getMonth()) {
        return `${startMonth} ${start.getDate()} – ${end.getDate()}, ${start.getFullYear()}`;
      }
      return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${start.getFullYear()}`;
    }
    // Day view
    return currentDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // ─── Build Month Grid (42 cells) ─────────────────────────────────
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const calendarDays: Array<{ day: number; isCurrentMonth: boolean; date: string }> = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const prevM = month === 0 ? 12 : month;
    const prevY = month === 0 ? year - 1 : year;
    calendarDays.push({
      day: d,
      isCurrentMonth: false,
      date: `${prevY}-${String(prevM).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push({
      day: d,
      isCurrentMonth: true,
      date: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    });
  }
  const remaining = 42 - calendarDays.length;
  for (let d = 1; d <= remaining; d++) {
    const nextM = month === 11 ? 1 : month + 2;
    const nextY = month === 11 ? year + 1 : year;
    calendarDays.push({
      day: d,
      isCurrentMonth: false,
      date: `${nextY}-${String(nextM).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    });
  }

  // ─── Action Handlers ─────────────────────────────────────────────
  const handleToggleStatus = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'done' ? 'pending' : 'done';
    try {
      await tasksApi.update(taskId, { status: newStatus });
      if (newStatus === 'done') {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        toast.success('Task completed and removed from calendar.');
      } else {
        loadTasks();
        toast.success('Task marked as pending.');
      }
    } catch {
      toast.error('Could not update the task.');
    }
  };

  const openAddTaskForDate = (dateStr?: string) => {
    setSelectedDate(dateStr || todayDateStr);
    setEditingTask(null);
    setIsTaskModalOpen(true);
  };

  const selectedTasks = selectedDate ? getTasksForDate(selectedDate) : [];

  // Active Day in Day View
  const activeDayDateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
  const dayViewTasks = getTasksForDate(activeDayDateStr);
  const dayViewDoneCount = dayViewTasks.filter((t) => t.status === 'done').length;

  return (
    <div style={{ width: '100%', paddingBottom: '30px' }}>
      {/* ─── Calendar Page Header ───────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>
            Academic Calendar
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.86rem', marginTop: 4 }}>
            Day-wise, week-wise & month-wise academic schedule & deadlines
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* ─── View Mode Switcher: Month | Week | Day ─────────────── */}
          <div
            style={{
              display: 'flex',
              background: '#F1F5F9',
              padding: '3px',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('month')}
              style={{
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: viewMode === 'month' ? 700 : 600,
                borderRadius: '8px',
                border: 'none',
                background: viewMode === 'month' ? '#FFFFFF' : 'transparent',
                color: viewMode === 'month' ? '#0F172A' : '#64748B',
                boxShadow: viewMode === 'month' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => setViewMode('week')}
              style={{
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: viewMode === 'week' ? 700 : 600,
                borderRadius: '8px',
                border: 'none',
                background: viewMode === 'week' ? '#FFFFFF' : 'transparent',
                color: viewMode === 'week' ? '#0F172A' : '#64748B',
                boxShadow: viewMode === 'week' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('day');
                if (!selectedDate) {
                  setSelectedDate(activeDayDateStr);
                }
              }}
              style={{
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: viewMode === 'day' ? 700 : 600,
                borderRadius: '8px',
                border: 'none',
                background: viewMode === 'day' ? '#FFFFFF' : 'transparent',
                color: viewMode === 'day' ? '#0F172A' : '#64748B',
                boxShadow: viewMode === 'day' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Day
            </button>
          </div>

          {/* ─── Prev / Next / Title Controller ─────────────────────── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '10px',
              padding: '3px',
            }}
          >
            <button
              className="btn btn-ghost btn-sm"
              onClick={handlePrev}
              title="Previous"
              style={{ padding: '6px' }}
            >
              <ChevronLeft size={18} />
            </button>
            <span
              style={{
                fontWeight: 700,
                minWidth: viewMode === 'day' ? 220 : viewMode === 'week' ? 190 : 150,
                textAlign: 'center',
                fontSize: '0.9rem',
                color: '#0F172A',
                padding: '0 6px',
              }}
            >
              {getViewTitle()}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleNext}
              title="Next"
              style={{ padding: '6px' }}
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={goToday}
            style={{ fontWeight: 600, padding: '7px 14px' }}
          >
            Today
          </button>

          <button
            type="button"
            onClick={() => openAddTaskForDate()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              background: '#0F172A',
              color: '#FFFFFF',
              borderRadius: '9px',
              border: 'none',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.12)',
            }}
          >
            <Plus size={15} />
            <span>Add Event</span>
          </button>
        </div>
      </div>

      {/* ─── 1. MONTH VIEW ─────────────────────────────────────────── */}
      {viewMode === 'month' && (
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
          {/* Calendar Grid Container */}
          <div
            style={{
              flex: 1,
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 4px 18px rgba(0,0,0,0.02)',
            }}
          >
            <div className="calendar-grid">
              {DAYS.map((day) => (
                <div
                  key={day}
                  className="calendar-header-cell"
                  style={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}
                >
                  {day}
                </div>
              ))}

              {calendarDays.map((cd, i) => {
                const dayTasks = cd.isCurrentMonth ? getTasksForDate(cd.date) : [];
                const isSelected = selectedDate === cd.date;

                return (
                  <div
                    key={i}
                    className={`calendar-cell ${isToday(cd.day, cd.isCurrentMonth) ? 'today' : ''} ${!cd.isCurrentMonth ? 'other-month' : ''}`}
                    onClick={() => cd.isCurrentMonth && setSelectedDate(cd.date)}
                    style={{
                      outline: isSelected ? '2px solid #6366F1' : 'none',
                      outlineOffset: -2,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-start',
                      gap: 4,
                      minHeight: '108px',
                      padding: '8px',
                      cursor: cd.isCurrentMonth ? 'pointer' : 'default',
                      background: isSelected ? '#F8FAFC' : cd.isCurrentMonth ? '#FFFFFF' : '#FAFAFB',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: isToday(cd.day, cd.isCurrentMonth) ? 800 : 600,
                          color: isToday(cd.day, cd.isCurrentMonth)
                            ? '#4F46E5'
                            : cd.isCurrentMonth
                            ? '#1E293B'
                            : '#94A3B8',
                          background: isToday(cd.day, cd.isCurrentMonth) ? '#EEF2FF' : 'transparent',
                          padding: isToday(cd.day, cd.isCurrentMonth) ? '2px 6px' : '0',
                          borderRadius: '6px',
                        }}
                      >
                        {cd.day}
                      </span>
                      {dayTasks.length > 0 && (
                        <span
                          style={{
                            fontSize: '0.66rem',
                            fontWeight: 700,
                            color: '#6366F1',
                            background: '#EEF2FF',
                            padding: '1px 5px',
                            borderRadius: '4px',
                          }}
                        >
                          {dayTasks.length}
                        </span>
                      )}
                    </div>

                    {/* Clean Day-Wise Task Badges (No rigid time stamp clutter) */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                        width: '100%',
                        overflow: 'hidden',
                        marginTop: 2,
                      }}
                    >
                      {dayTasks.slice(0, 3).map((t) => {
                        const tagColor = getTagColor(t.type);
                        const isDone = t.status === 'done';
                        return (
                          <div
                            key={t.id}
                            title={`${t.subject ? `[Topic: ${t.subject}] ` : ''}${t.title} (${t.type}) • Click to Edit`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDate(cd.date);
                              setEditingTask(t);
                              setIsTaskModalOpen(true);
                            }}
                            style={{
                              background: isDone ? '#F1F5F9' : '#FFFFFF',
                              border: `1px solid ${tagColor}30`,
                              borderLeft: `3px solid ${tagColor}`,
                              borderRadius: '4px',
                              padding: '3px 5px',
                              fontSize: '0.68rem',
                              lineHeight: 1.25,
                              color: isDone ? '#94A3B8' : '#0F172A',
                              textDecoration: isDone ? 'line-through' : 'none',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 4,
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3, overflow: 'hidden', flex: 1 }}>
                              {t.subject && (
                                <span
                                  style={{
                                    fontSize: '0.58rem',
                                    fontWeight: 700,
                                    color: tagColor,
                                    background: `${tagColor}15`,
                                    padding: '1px 3px',
                                    borderRadius: '3px',
                                    flexShrink: 0,
                                    lineHeight: 1.1,
                                  }}
                                >
                                  {t.subject}
                                </span>
                              )}
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>
                                {t.title}
                              </span>
                            </div>
                            <span
                              style={{
                                fontSize: '0.58rem',
                                color: tagColor,
                                flexShrink: 0,
                                fontWeight: 700,
                                textTransform: 'capitalize',
                                opacity: 0.85,
                              }}
                            >
                              {t.type}
                            </span>
                          </div>
                        );
                      })}

                      {dayTasks.length > 3 && (
                        <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#6366F1', paddingLeft: 2 }}>
                          +{dayTasks.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ─── Month View Side Drawer: Selected Date Agenda ──────── */}
          {selectedDate && (
            <div
              style={{
                width: '330px',
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '16px',
                padding: '18px',
                boxShadow: '0 4px 18px rgba(0, 0, 0, 0.03)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CalendarIcon size={16} color="#6366F1" />
                  <h4 style={{ fontSize: '0.94rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const [y, m, d] = selectedDate.split('-').map(Number);
                    setCurrentDate(new Date(y, m - 1, d));
                    setViewMode('day');
                  }}
                  style={{
                    background: '#EEF2FF',
                    color: '#4F46E5',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    cursor: 'pointer',
                  }}
                >
                  Day View &rarr;
                </button>
              </div>

              {selectedTasks.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {selectedTasks.map((task) => {
                    const tagColor = getTagColor(task.type);
                    const isDone = task.status === 'done';

                    return (
                      <div
                        key={task.id}
                        style={{
                          padding: '12px',
                          borderRadius: '10px',
                          border: `1px solid ${isDone ? '#E2E8F0' : `${tagColor}30`}`,
                          background: isDone ? '#F8FAFC' : '#FFFFFF',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 10,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(task.id, task.status)}
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: '6px',
                            border: `2px solid ${isDone ? '#10B981' : '#CBD5E1'}`,
                            background: isDone ? '#10B981' : 'transparent',
                            cursor: 'pointer',
                            flexShrink: 0,
                            marginTop: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#FFFFFF',
                            fontSize: '0.65rem',
                            transition: 'all 0.15s ease',
                          }}
                          title={isDone ? 'Mark as pending' : 'Mark as done'}
                        >
                          {isDone && <CheckCircle2 size={12} color="#FFFFFF" />}
                        </button>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          {task.subject && (
                            <div style={{ marginBottom: 4 }}>
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  background: '#EEF2FF',
                                  color: '#4F46E5',
                                  border: '1px solid #C7D2FE',
                                  padding: '2px 7px',
                                  borderRadius: '5px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <span>📚</span> {task.subject}
                              </span>
                            </div>
                          )}

                          <div
                            style={{
                              fontSize: '0.88rem',
                              fontWeight: 700,
                              textDecoration: isDone ? 'line-through' : 'none',
                              color: isDone ? '#94A3B8' : '#0F172A',
                              lineHeight: 1.3,
                              wordBreak: 'break-word',
                            }}
                          >
                            {task.title}
                          </div>

                          <div style={{ display: 'flex', gap: 6, marginTop: 7, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span
                              style={{
                                fontSize: '0.66rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: `${tagColor}15`,
                                color: tagColor,
                                border: `1px solid ${tagColor}30`,
                              }}
                            >
                              {task.type}
                            </span>

                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 600,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background:
                                  task.priority === 'high' ? '#FEF2F2' : task.priority === 'low' ? '#F8FAFC' : '#FFFBEB',
                                color:
                                  task.priority === 'high' ? '#DC2626' : task.priority === 'low' ? '#64748B' : '#D97706',
                                border: `1px solid ${task.priority === 'high' ? '#FECACA' : task.priority === 'low' ? '#E2E8F0' : '#FDE68A'}`,
                              }}
                            >
                              {task.priority || 'medium'}
                            </span>

                            <button
                              type="button"
                              onClick={() => {
                                setEditingTask(task);
                                setIsTaskModalOpen(true);
                              }}
                              style={{
                                marginLeft: 'auto',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '3px 8px',
                                background: '#F1F5F9',
                                color: '#334155',
                                border: '1px solid #CBD5E1',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                              title="Edit event"
                            >
                              <Edit3 size={11} />
                              <span>Edit</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px 10px', color: '#94A3B8' }}>
                  <CalendarDays size={24} style={{ margin: '0 auto 8px auto', opacity: 0.4 }} />
                  <p style={{ fontSize: '0.82rem', margin: 0 }}>No tasks due on this day.</p>
                  <button
                    type="button"
                    onClick={() => openAddTaskForDate(selectedDate)}
                    style={{
                      marginTop: 10,
                      background: 'none',
                      border: '1px dashed #CBD5E1',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '0.75rem',
                      color: '#6366F1',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    + Add Task for this day
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── 2. WEEK VIEW (7 Days Columns) ─────────────────────────── */}
      {viewMode === 'week' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            gap: '12px',
            alignItems: 'stretch',
          }}
        >
          {getWeekDays(currentDate).map((wDay) => {
            const dayTasks = getTasksForDate(wDay.dateStr);

            return (
              <div
                key={wDay.dateStr}
                style={{
                  background: '#FFFFFF',
                  border: wDay.isToday ? '2px solid #6366F1' : '1px solid #E2E8F0',
                  borderRadius: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: '480px',
                  boxShadow: wDay.isToday ? '0 4px 16px rgba(99, 102, 241, 0.12)' : '0 2px 8px rgba(0,0,0,0.02)',
                  overflow: 'hidden',
                }}
              >
                {/* Day Header */}
                <div
                  style={{
                    padding: '12px 10px',
                    borderBottom: '1px solid #E2E8F0',
                    background: wDay.isToday ? '#EEF2FF' : '#F8FAFC',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: wDay.isToday ? '#4F46E5' : '#64748B',
                        display: 'block',
                      }}
                    >
                      {wDay.dayName}
                    </span>
                    <span
                      style={{
                        fontSize: '1.05rem',
                        fontWeight: 800,
                        color: wDay.isToday ? '#4F46E5' : '#0F172A',
                      }}
                    >
                      {wDay.dayNumber}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {dayTasks.length > 0 && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          background: wDay.isToday ? '#6366F1' : '#E2E8F0',
                          color: wDay.isToday ? '#FFFFFF' : '#475569',
                          borderRadius: '10px',
                          padding: '1px 6px',
                        }}
                      >
                        {dayTasks.length}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => openAddTaskForDate(wDay.dateStr)}
                      title={`Add task for ${wDay.dayName} ${wDay.dayNumber}`}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        background: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: '#475569',
                      }}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>

                {/* Day Tasks List (Day-Wise, no rigid hourly grid) */}
                <div style={{ padding: '8px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
                  {dayTasks.length === 0 ? (
                    <div
                      style={{
                        height: '100%',
                        minHeight: 120,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#CBD5E1',
                        fontSize: '0.75rem',
                        textAlign: 'center',
                        padding: '16px 4px',
                      }}
                    >
                      No tasks
                    </div>
                  ) : (
                    dayTasks.map((t) => {
                      const tagColor = getTagColor(t.type);
                      const isDone = t.status === 'done';

                      return (
                        <div
                          key={t.id}
                          onClick={() => {
                            setSelectedDate(wDay.dateStr);
                            setEditingTask(t);
                            setIsTaskModalOpen(true);
                          }}
                          style={{
                            background: isDone ? '#F8FAFC' : '#FFFFFF',
                            border: `1px solid ${isDone ? '#E2E8F0' : `${tagColor}35`}`,
                            borderLeft: `3px solid ${tagColor}`,
                            borderRadius: '8px',
                            padding: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 5,
                            transition: 'all 0.15s ease',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4 }}>
                            <span
                              style={{
                                fontSize: '0.62rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                color: tagColor,
                                background: `${tagColor}15`,
                                padding: '1px 5px',
                                borderRadius: '4px',
                              }}
                            >
                              {t.type}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleStatus(t.id, t.status);
                              }}
                              style={{
                                width: 16,
                                height: 16,
                                borderRadius: '4px',
                                border: `1.5px solid ${isDone ? '#10B981' : '#CBD5E1'}`,
                                background: isDone ? '#10B981' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#FFFFFF',
                                cursor: 'pointer',
                                padding: 0,
                              }}
                              title={isDone ? 'Mark pending' : 'Mark done'}
                            >
                              {isDone && <Check size={10} />}
                            </button>
                          </div>

                          {t.subject && (
                            <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#4F46E5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              📚 {t.subject}
                            </span>
                          )}

                          <div
                            style={{
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              color: isDone ? '#94A3B8' : '#0F172A',
                              textDecoration: isDone ? 'line-through' : 'none',
                              lineHeight: 1.25,
                              wordBreak: 'break-word',
                            }}
                          >
                            {t.title}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                            <span
                              style={{
                                fontSize: '0.62rem',
                                fontWeight: 600,
                                color: t.priority === 'high' ? '#DC2626' : t.priority === 'low' ? '#64748B' : '#D97706',
                              }}
                            >
                              {t.priority}
                            </span>
                            <span style={{ fontSize: '0.64rem', color: '#94A3B8' }}>Day-wise</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── 3. DAY VIEW (Focused Single Day Agenda) ────────────────── */}
      {viewMode === 'day' && (
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 18px rgba(0,0,0,0.02)',
          }}
        >
          {/* Day View Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '18px',
              borderBottom: '1px solid #E2E8F0',
              marginBottom: '20px',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    background: '#EEF2FF',
                    color: '#4F46E5',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    textTransform: 'uppercase',
                  }}
                >
                  Day View
                </span>
                <span style={{ fontSize: '0.85rem', color: '#64748B' }}>
                  {dayViewTasks.length} task{dayViewTasks.length !== 1 ? 's' : ''} scheduled • {dayViewDoneCount} completed
                </span>
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0F172A', marginTop: 6, margin: 0 }}>
                {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </h2>
            </div>

            <button
              type="button"
              onClick={() => openAddTaskForDate(activeDayDateStr)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                background: '#4F46E5',
                color: '#FFFFFF',
                borderRadius: '10px',
                border: 'none',
                fontSize: '0.86rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)',
              }}
            >
              <Plus size={16} />
              <span>Add Task for this Day</span>
            </button>
          </div>

          {/* Day View Tasks List */}
          {dayViewTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94A3B8' }}>
              <CalendarDays size={48} style={{ margin: '0 auto 12px auto', opacity: 0.35, color: '#6366F1' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#334155', margin: '0 0 6px 0' }}>
                No Academic Deadlines for this Day
              </h3>
              <p style={{ fontSize: '0.86rem', color: '#64748B', maxWidth: 420, margin: '0 auto 16px auto' }}>
                You have no pending assignments, quizzes, or exams scheduled for this date.
              </p>
              <button
                type="button"
                onClick={() => openAddTaskForDate(activeDayDateStr)}
                style={{
                  padding: '7px 16px',
                  background: '#F1F5F9',
                  color: '#334155',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                + Schedule an Event for Today
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {dayViewTasks.map((task) => {
                const tagColor = getTagColor(task.type);
                const isDone = task.status === 'done';

                return (
                  <div
                    key={task.id}
                    style={{
                      padding: '16px 20px',
                      borderRadius: '12px',
                      border: `1px solid ${isDone ? '#E2E8F0' : `${tagColor}35`}`,
                      borderLeft: `5px solid ${tagColor}`,
                      background: isDone ? '#F8FAFC' : '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 16,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(task.id, task.status)}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '7px',
                          border: `2px solid ${isDone ? '#10B981' : '#CBD5E1'}`,
                          background: isDone ? '#10B981' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#FFFFFF',
                          cursor: 'pointer',
                          flexShrink: 0,
                          transition: 'all 0.15s ease',
                        }}
                        title={isDone ? 'Mark as pending' : 'Mark as done'}
                      >
                        {isDone && <CheckCircle2 size={16} color="#FFFFFF" />}
                      </button>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              background: `${tagColor}15`,
                              color: tagColor,
                              border: `1px solid ${tagColor}30`,
                            }}
                          >
                            {task.type}
                          </span>

                          {task.subject && (
                            <span
                              style={{
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                color: '#4F46E5',
                                background: '#EEF2FF',
                                padding: '2px 8px',
                                borderRadius: '5px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <BookOpen size={12} />
                              {task.subject}
                            </span>
                          )}

                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              padding: '2px 7px',
                              borderRadius: '4px',
                              background:
                                task.priority === 'high' ? '#FEF2F2' : task.priority === 'low' ? '#F8FAFC' : '#FFFBEB',
                              color:
                                task.priority === 'high' ? '#DC2626' : task.priority === 'low' ? '#64748B' : '#D97706',
                              border: `1px solid ${task.priority === 'high' ? '#FECACA' : task.priority === 'low' ? '#E2E8F0' : '#FDE68A'}`,
                            }}
                          >
                            {task.priority || 'medium'} priority
                          </span>
                        </div>

                        <div
                          style={{
                            fontSize: '1rem',
                            fontWeight: 700,
                            color: isDone ? '#94A3B8' : '#0F172A',
                            textDecoration: isDone ? 'line-through' : 'none',
                          }}
                        >
                          {task.title}
                        </div>

                        {task.description && (
                          <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: 4 }}>
                            {task.description}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingTask(task);
                        setIsTaskModalOpen(true);
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '6px 12px',
                        background: '#F8FAFC',
                        color: '#334155',
                        border: '1px solid #CBD5E1',
                        borderRadius: '8px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      <Edit3 size={13} />
                      <span>Edit</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Task Creation & Edit Modal ────────────────────────────── */}
      {isTaskModalOpen && (
        <TaskModal
          onClose={() => {
            setIsTaskModalOpen(false);
            setEditingTask(null);
          }}
          onSaved={() => {
            setIsTaskModalOpen(false);
            setEditingTask(null);
            loadTasks();
          }}
          initialData={
            editingTask
              ? {
                  id: editingTask.id,
                  title: editingTask.title,
                  type: editingTask.type,
                  subject: editingTask.subject || null,
                  deadline: editingTask.deadline,
                  priority: editingTask.priority,
                  description: editingTask.description || '',
                  source: editingTask.source || 'manual',
                }
              : {
                  title: '',
                  type: 'assignment',
                  subject: null,
                  deadline: selectedDate || activeDayDateStr,
                  priority: 'medium',
                  source: 'manual',
                }
          }
        />
      )}
    </div>
  );
}
