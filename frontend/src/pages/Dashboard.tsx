import { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  ClipboardList,
  Clock,
  CheckCircle2,
  GripVertical,
  CalendarClock,
  Edit3,
  Check,
  Calendar,
} from 'lucide-react';
import { tasksApi, coursesApi } from '../services/api';
import toast from 'react-hot-toast';
import TaskModal from '../components/TaskModal';

interface DashboardProps {
  user: { fullName: string };
}

interface TaskItem {
  id: string;
  title: string;
  type: string;
  subject?: string | null;
  deadline: string;
  priority: string;
  status: string;
  description?: string | null;
}

interface CourseItem {
  id: string;
  name: string;
  colorTag?: string;
}

const DEFAULT_GRAPH_ORDER = ['velocity', 'courses', 'urgency', 'efficiency'];

// Helper to generate a smooth Catmull-Rom cubic Bezier spline path through data points
function createSmoothSplinePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : points.length - 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return path;
}

interface DashboardMoveableCardProps {
  cardId: string;
  title: string;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  children: (width: number) => React.ReactNode;
}

function DashboardMoveableCard({
  title,
  isDragging,
  onDragStart,
  onDragOver,
  onDragEnd,
  children,
}: DashboardMoveableCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState<number>(650);

  useEffect(() => {
    if (!cardRef.current) return;
    const update = () => {
      if (cardRef.current) {
        // card has padding 24px on left and right = 48px
        const w = cardRef.current.clientWidth - 48;
        if (w > 100) setContentWidth(Math.round(w));
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={cardRef}
      draggable={true}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      className={`dashboard-moveable-card ${isDragging ? 'is-dragging' : ''}`}
    >
      {/* Card Header: Simple Graph Name & Live Drag Handle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '14px',
          paddingBottom: '12px',
          borderBottom: '1px solid #F1F5F9',
        }}
      >
        <span
          title="Drag card to rearrange"
          style={{ cursor: 'grab', color: isDragging ? '#4F46E5' : '#94A3B8', display: 'flex', alignItems: 'center' }}
        >
          <GripVertical size={16} />
        </span>
        <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.01em' }}>
          {title}
        </h3>
      </div>

      {/* Linear Graph Body */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', width: '100%', overflow: 'hidden' }}>
        {children(contentWidth)}
      </div>
    </div>
  );
}

export default function Dashboard({ user: _user }: DashboardProps) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);

  // Hover state for interactive linear graphs
  const [hoveredDayIdx, setHoveredDayIdx] = useState<number | null>(null);

  // Moveable graph cards order state with localStorage persistence
  const [graphOrder, setGraphOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('studysync_dashboard_linear_order');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 4) return parsed;
      }
    } catch { }
    return DEFAULT_GRAPH_ORDER;
  });

  // Real-time live drag-and-drop state
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);

  // Task Modal state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [tasksRes, coursesRes] = await Promise.all([
        tasksApi.getAll(),
        coursesApi.getAll().catch(() => ({ data: { data: { courses: [] } } })),
      ]);

      const fetchedTasks: TaskItem[] = tasksRes.data?.data?.tasks || [];
      const fetchedCourses: CourseItem[] = coursesRes.data?.data?.courses || [];

      setTasks(fetchedTasks);
      setCourses(fetchedCourses);
    } catch {
      toast.error('Could not load dashboard data. Try refreshing.');
    }
  };

  // ─── Metric Calculations ──────────────────────────────────────────
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'done');
  const pendingTasks = tasks.filter((t) => t.status !== 'done');

  const taskSubjects = Array.from(new Set(tasks.map((t) => t.subject).filter(Boolean))) as string[];
  const registeredCourseNames = courses.map((c) => c.name);
  const allUniqueCourseNames = Array.from(new Set([...registeredCourseNames, ...taskSubjects]));
  const totalCoursesCount = Math.max(courses.length, allUniqueCourseNames.length);

  const completionPercentage = totalTasks > 0 ? Math.round((doneTasks.length / totalTasks) * 100) : 0;

  // ─── Real-Time Live Drag & Drop Reordering ────────────────────────
  const handleDragStart = (id: string, e: React.DragEvent) => {
    setDraggedCardId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (targetId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (!draggedCardId || draggedCardId === targetId) return;

    // Instant real-time rearrangement: as soon as the user hovers over another card,
    // the target card automatically shifts its position smoothly!
    setGraphOrder((prev) => {
      const fromIdx = prev.indexOf(draggedCardId);
      const toIdx = prev.indexOf(targetId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;

      const next = [...prev];
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, draggedCardId);
      try {
        localStorage.setItem('studysync_dashboard_linear_order', JSON.stringify(next));
      } catch { }
      return next;
    });
  };

  const handleDragEnd = () => {
    setDraggedCardId(null);
  };

  // ─── Task Status Toggle Handler ──────────────────────────────────
  const handleToggleTaskStatus = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'done' ? 'pending' : 'done';
    try {
      await tasksApi.update(taskId, { status: newStatus });
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      );
      toast.success(newStatus === 'done' ? 'Marked as completed!' : 'Marked as pending.');
    } catch {
      toast.error('Could not update task status.');
    }
  };

  // ─── Format Day-Wise Deadline ────────────────────────────────────
  const formatDeadlineDayWise = (deadline: string) => {
    if (!deadline) return 'No date';
    const d = new Date(deadline);
    const today = new Date();
    const isPast = d.getTime() < today.getTime() - 24 * 60 * 60 * 1000;
    const isToday =
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const isTomorrow =
      d.getDate() === tomorrow.getDate() &&
      d.getMonth() === tomorrow.getMonth() &&
      d.getFullYear() === tomorrow.getFullYear();

    if (isToday) return 'Due Today';
    if (isTomorrow) return 'Tomorrow';
    if (isPast) return 'Overdue';

    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const getTypeStyle = (type: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      quiz: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
      assignment: { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
      project: { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' },
      exam: { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
      personal: { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' },
      other: { bg: '#F8FAFC', text: '#475569', border: '#E2E8F0' },
    };
    return colors[type?.toLowerCase()] || colors.other;
  };

  // ─── Coming Up Next Tasks (Sorted Chronologically) ───────────────
  const upcomingTasks = [...tasks]
    .filter((t) => t.status !== 'done')
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 6);

  // ─── 4 DIVERSE VISUAL GRAPHS (BAR, DONUT, LINEAR WAVE, RADIAL GAUGE) ──
  // ─────────────────────────────────────────────────────────────────

  // ─── GRAPH 1: Academic Velocity & Output (Interactive Weekly Bar Chart)
  const renderVelocityBarChart = (width: number) => {
    const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const today = new Date();
    // Monday as start of week: 0=Mon, 6=Sun
    const currentDayIdx = (today.getDay() + 6) % 7;

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - currentDayIdx);
    startOfWeek.setHours(0, 0, 0, 0);

    const weekData = DAYS_SHORT.map((dayLabel, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      const completedOnDay = doneTasks.filter((t) => t.deadline && t.deadline.startsWith(dateStr)).length;
      const scheduledOnDay = tasks.filter((t) => t.deadline && t.deadline.startsWith(dateStr)).length;

      return {
        label: dayLabel,
        isToday: i === currentDayIdx,
        completed: completedOnDay,
        scheduled: scheduledOnDay,
      };
    });

    const maxVal = Math.max(...weekData.map((d) => Math.max(d.completed, d.scheduled)), 3);

    const chartLeft = 32;
    const chartRight = Math.max(width - 16, 200);
    const chartBottom = 130;
    const chartTop = 22;
    const chartHeight = chartBottom - chartTop;
    const groupWidth = (chartRight - chartLeft) / 7;
    const barWidth = Math.max(Math.min(groupWidth * 0.28, 14), 6);

    return (
      <div style={{ width: '100%' }}>
        {/* Simple Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', fontWeight: 700, color: '#059669' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: '#10B981' }} />
            Completed ({doneTasks.length})
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', fontWeight: 700, color: '#4F46E5' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: '#6366F1' }} />
            Scheduled ({totalTasks})
          </span>
        </div>

        <svg
          width="100%"
          height="160"
          viewBox={`0 0 ${width} 160`}
          style={{ overflow: 'visible', width: '100%' }}
          onMouseLeave={() => setHoveredDayIdx(null)}
        >
          {/* Reference Grid */}
          {[0, 0.5, 1].map((ratio) => {
            const y = chartBottom - ratio * chartHeight;
            const val = Math.round(ratio * maxVal);
            return (
              <g key={ratio}>
                <line x1={chartLeft} y1={y} x2={chartRight} y2={y} stroke="#F1F5F9" strokeDasharray="3 3" strokeWidth="1" />
                <text x={chartLeft - 8} y={y + 3} fontSize="9" fontWeight="600" fill="#94A3B8" textAnchor="end">
                  {val}
                </text>
              </g>
            );
          })}
          <line x1={chartLeft} y1={chartBottom} x2={chartRight} y2={chartBottom} stroke="#E2E8F0" strokeWidth="1.2" />

          {/* Vertical Columns per Day */}
          {weekData.map((d, i) => {
            const centerX = chartLeft + i * groupWidth + groupWidth / 2;
            const compBarHeight = (d.completed / maxVal) * chartHeight;
            const schedBarHeight = (d.scheduled / maxVal) * chartHeight;
            const isHovered = hoveredDayIdx === i;

            return (
              <g
                key={d.label}
                onMouseEnter={() => setHoveredDayIdx(i)}
                style={{ cursor: 'pointer' }}
              >
                {/* Background hover highlight */}
                {isHovered && (
                  <rect
                    x={centerX - groupWidth / 2 + 2}
                    y={chartTop}
                    width={groupWidth - 4}
                    height={chartHeight + 2}
                    rx="6"
                    fill="#F1F5F9"
                    opacity="0.6"
                  />
                )}

                {/* Scheduled Bar (Indigo) */}
                <rect
                  x={centerX - barWidth - 2}
                  y={chartBottom - schedBarHeight}
                  width={barWidth}
                  height={Math.max(schedBarHeight, 3)}
                  rx="3"
                  fill={d.scheduled > 0 ? '#6366F1' : '#E2E8F0'}
                  opacity={d.scheduled > 0 ? 1 : 0.4}
                />

                {/* Completed Bar (Emerald) */}
                <rect
                  x={centerX + 2}
                  y={chartBottom - compBarHeight}
                  width={barWidth}
                  height={Math.max(compBarHeight, 3)}
                  rx="3"
                  fill={d.completed > 0 ? '#10B981' : '#E2E8F0'}
                  opacity={d.completed > 0 ? 1 : 0.4}
                />

                {/* Tooltip on hover */}
                {isHovered && (
                  <g>
                    <rect
                      x={Math.max(10, Math.min(width - 94, centerX - 45))}
                      y={Math.min(chartBottom - Math.max(compBarHeight, schedBarHeight) - 26, chartTop - 4)}
                      width="90"
                      height="20"
                      rx="5"
                      fill="#0F172A"
                    />
                    <text
                      x={Math.max(55, Math.min(width - 49, centerX))}
                      y={Math.min(chartBottom - Math.max(compBarHeight, schedBarHeight) - 12, chartTop + 10)}
                      fontSize="9"
                      fontWeight="700"
                      fill="#FFFFFF"
                      textAnchor="middle"
                    >
                      {d.completed} done / {d.scheduled} load
                    </text>
                  </g>
                )}

                {/* Day label */}
                <text
                  x={centerX}
                  y="148"
                  fontSize="10"
                  fontWeight={d.isToday ? '800' : '600'}
                  fill={d.isToday ? '#4F46E5' : '#64748B'}
                  textAnchor="middle"
                >
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  // ─── GRAPH 2: Course Workload Breakdown (Modern Radial Donut Chart)
  const renderCourseDonutChart = (_width: number) => {
    const courseStatsMap = new Map<string, number>();
    allUniqueCourseNames.forEach((name) => courseStatsMap.set(name, 0));

    tasks.forEach((t) => {
      const subject = t.subject || 'General';
      courseStatsMap.set(subject, (courseStatsMap.get(subject) || 0) + 1);
    });

    const coursesList = Array.from(courseStatsMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const totalCourseTasks = coursesList.reduce((sum, c) => sum + c.count, 0) || totalTasks || 1;
    const COLORS = ['#6366F1', '#0EA5E9', '#F59E0B', '#10B981', '#EC4899', '#8B5CF6'];

    const radius = 54;
    const strokeWidth = 14;
    const circumference = 2 * Math.PI * radius;
    let cumulativeAngle = 0;

    const top5 = coursesList.slice(0, 5);
    const hasMore = coursesList.length > 5;
    const otherCount = hasMore ? coursesList.slice(5).reduce((sum, c) => sum + c.count, 0) : 0;
    const displayList = hasMore ? [...top5, { name: 'Others', count: otherCount }] : top5;

    const segments = displayList.map((c, i) => {
      const share = totalCourseTasks > 0 ? (c.count > 0 ? c.count / totalCourseTasks : 1 / Math.max(displayList.length, 1)) : 1;
      const strokeDasharray = `${Math.max(share * circumference - 2, 2)} ${circumference}`;
      const strokeDashoffset = -cumulativeAngle * circumference;
      cumulativeAngle += share;

      return {
        ...c,
        color: COLORS[i % COLORS.length],
        percent: totalCourseTasks > 0 ? Math.round((c.count / totalCourseTasks) * 100) : 0,
        strokeDasharray,
        strokeDashoffset,
      };
    });

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          gap: 24,
          padding: '8px 12px',
          boxSizing: 'border-box',
          minHeight: 160,
        }}
      >
        {/* SVG Donut Ring */}
        <div style={{ position: 'relative', width: 140, height: 140, flexShrink: 0 }}>
          <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: 'rotate(-90deg)' }}>
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="transparent"
              stroke="#F1F5F9"
              strokeWidth={strokeWidth}
            />
            {segments.map((seg) => (
              <circle
                key={seg.name}
                cx="70"
                cy="70"
                r={radius}
                fill="transparent"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={seg.strokeDasharray}
                strokeDashoffset={seg.strokeDashoffset}
                strokeLinecap="round"
                style={{ transition: 'all 0.3s ease' }}
              />
            ))}
          </svg>
          {/* Donut Center Count */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>
              {totalTasks}
            </span>
            <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginTop: 3 }}>
              Total Tasks
            </span>
          </div>
        </div>

        {/* Legend List */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
          {segments.map((seg) => (
            <div
              key={seg.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.78rem',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
                <span
                  style={{
                    color: '#334155',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={seg.name}
                >
                  {seg.name}
                </span>
              </div>
              <span style={{ color: '#0F172A', fontWeight: 700, flexShrink: 0 }}>
                {seg.count} <span style={{ color: '#94A3B8', fontWeight: 500 }}>({seg.percent}%)</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ─── GRAPH 3: Urgency Burden & Deadline Index (Smooth Wave Area Chart)
  const renderUrgencyLinearGraph = (width: number) => {
    const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const currentDayIdx = today.getDay();

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - currentDayIdx);
    startOfWeek.setHours(0, 0, 0, 0);

    const weekBurden = DAYS_SHORT.map((dayLabel, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      const tasksOnDay = tasks.filter((t) => t.deadline && t.deadline.startsWith(dateStr));
      const score = tasksOnDay.reduce((acc, t) => {
        if (t.priority === 'high') return acc + 3;
        if (t.priority === 'medium') return acc + 2;
        return acc + 1;
      }, 0);

      return {
        label: dayLabel,
        dayNum: d.getDate(),
        isToday: i === currentDayIdx,
        score,
        count: tasksOnDay.length,
      };
    });

    const maxScore = Math.max(...weekBurden.map((d) => d.score), 5);

    const chartLeft = 32;
    const chartRight = Math.max(width - 16, 200);
    const chartBottom = 130;
    const chartTop = 22;
    const chartHeight = chartBottom - chartTop;
    const stepX = (chartRight - chartLeft) / 6;

    const points = weekBurden.map((d, i) => ({
      x: chartLeft + i * stepX,
      y: chartBottom - (d.score / maxScore) * chartHeight,
      ...d,
    }));

    const spline = createSmoothSplinePath(points);
    const area = `${spline} L ${points[6].x} ${chartBottom} L ${points[0].x} ${chartBottom} Z`;

    return (
      <div style={{ width: '100%' }}>
        <svg width="100%" height="160" viewBox={`0 0 ${width} 160`} style={{ overflow: 'visible', width: '100%' }}>
          <defs>
            <linearGradient id="urgencyAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#EF4444" stopOpacity="0.32" />
              <stop offset="50%" stopColor="#F59E0B" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#6366F1" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="urgencyLineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6366F1" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#EF4444" />
            </linearGradient>
          </defs>

          {/* Reference Baseline */}
          <line x1={chartLeft} y1={chartTop} x2={chartRight} y2={chartTop} stroke="#F1F5F9" strokeDasharray="3 3" strokeWidth="1" />
          <line x1={chartLeft} y1={(chartTop + chartBottom) / 2} x2={chartRight} y2={(chartTop + chartBottom) / 2} stroke="#F1F5F9" strokeDasharray="3 3" strokeWidth="1" />
          <line x1={chartLeft} y1={chartBottom} x2={chartRight} y2={chartBottom} stroke="#E2E8F0" strokeWidth="1.2" />

          {/* Y Axis labels */}
          <text x={chartLeft - 8} y={chartTop + 4} fontSize="9" fontWeight="600" fill="#94A3B8" textAnchor="end">{maxScore}</text>
          <text x={chartLeft - 8} y={(chartTop + chartBottom) / 2 + 4} fontSize="9" fontWeight="600" fill="#94A3B8" textAnchor="end">{Math.round(maxScore / 2)}</text>
          <text x={chartLeft - 8} y={chartBottom + 3} fontSize="9" fontWeight="600" fill="#94A3B8" textAnchor="end">0</text>

          {/* Area fill */}
          <path d={area} fill="url(#urgencyAreaGrad)" />

          {/* Spline line */}
          <path d={spline} fill="none" stroke="url(#urgencyLineGrad)" strokeWidth="3" strokeLinecap="round" />

          {/* Nodes */}
          {points.map((pt) => (
            <g key={pt.label}>
              <circle
                cx={pt.x}
                cy={pt.y}
                r={pt.isToday ? '5.5' : '4'}
                fill={pt.score >= 3 ? '#EF4444' : pt.score > 0 ? '#F59E0B' : '#6366F1'}
                stroke="#FFFFFF"
                strokeWidth="2"
              />
              {pt.score > 0 && (
                <text x={pt.x} y={pt.y - 7} fontSize="9" fontWeight="800" fill="#0F172A" textAnchor="middle">
                  {pt.score}
                </text>
              )}
              <text
                x={pt.x}
                y="148"
                fontSize="10"
                fontWeight={pt.isToday ? '800' : '600'}
                fill={pt.isToday ? '#4F46E5' : '#64748B'}
                textAnchor="middle"
              >
                {pt.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  };

  // ─── GRAPH 4: Completion Efficiency & Benchmark (Radial Progress Gauge)
  const renderEfficiencyGaugeChart = (_width: number) => {
    const targetEff = 80;
    const currentEff = completionPercentage;

    const r = 62;
    const strokeWidth = 12;
    const circumference = Math.PI * r;
    const progressOffset = circumference * (1 - Math.min(Math.max(currentEff, 0), 100) / 100);

    return (
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px 0',
          minHeight: 160,
        }}
      >
        {/* Semi-circular SVG Gauge */}
        <div style={{ position: 'relative', width: 170, height: 95, overflow: 'hidden' }}>
          <svg width="170" height="95" viewBox="0 0 170 95" style={{ overflow: 'visible' }}>
            <defs>
              <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#06B6D4" />
                <stop offset="100%" stopColor="#10B981" />
              </linearGradient>
            </defs>

            {/* Background Track Arc */}
            <path
              d="M 15 85 A 62 62 0 0 1 155 85"
              fill="none"
              stroke="#F1F5F9"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />

            {/* 80% Benchmark Target Tick */}
            <line
              x1="126"
              y1="34"
              x2="134"
              y2="28"
              stroke="#6366F1"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {/* Active Progress Arc */}
            <path
              d="M 15 85 A 62 62 0 0 1 155 85"
              fill="none"
              stroke="url(#gaugeGrad)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={progressOffset}
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>

          {/* Center Percentage Display */}
          <div
            style={{
              position: 'absolute',
              bottom: 4,
              left: 0,
              right: 0,
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>
              {currentEff}%
            </span>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', marginTop: 2 }}>
              Completion Rate
            </span>
          </div>
        </div>

        {/* Milestone Indicator Pills */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <span
            style={{
              padding: '3px 10px',
              borderRadius: '6px',
              background: '#ECFDF5',
              color: '#059669',
              fontSize: '0.72rem',
              fontWeight: 700,
              border: '1px solid #A7F3D0',
            }}
          >
            ✓ {doneTasks.length} Completed
          </span>

          <span
            style={{
              padding: '3px 10px',
              borderRadius: '6px',
              background: '#FFFBEB',
              color: '#D97706',
              fontSize: '0.72rem',
              fontWeight: 700,
              border: '1px solid #FDE68A',
            }}
          >
            ⏱️ {pendingTasks.length} Remaining
          </span>

          <span
            style={{
              padding: '3px 10px',
              borderRadius: '6px',
              background: '#EEF2FF',
              color: '#4F46E5',
              fontSize: '0.72rem',
              fontWeight: 700,
              border: '1px solid #C7D2FE',
            }}
          >
            🎯 {targetEff}% Benchmark
          </span>
        </div>
      </div>
    );
  };

  // Map graph ID to simple title and dynamic render function
  const getGraphCardContent = (id: string) => {
    switch (id) {
      case 'velocity':
        return {
          title: 'Academic Velocity',
          render: (w: number) => renderVelocityBarChart(w),
        };
      case 'courses':
        return {
          title: 'Course Workload',
          render: (w: number) => renderCourseDonutChart(w),
        };
      case 'urgency':
        return {
          title: 'Priority Burden',
          render: (w: number) => renderUrgencyLinearGraph(w),
        };
      case 'efficiency':
        return {
          title: 'Completion Efficiency',
          render: (w: number) => renderEfficiencyGaugeChart(w),
        };
      default:
        return { title: '', render: () => null };
    }
  };

  return (
    <div className="dashboard-page-wrapper">
      {/* ─── Executive Header Bar ───────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.025em', margin: 0 }}>
            Academic Dashboard
          </h1>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: '#4F46E5',
              background: '#EEF2FF',
              padding: '2px 8px',
              borderRadius: 6,
              letterSpacing: '0.02em',
            }}
          >
            EXECUTIVE VIEW
          </span>
        </div>
      </div>

      {/* ─── 1. TOP STAT CARDS (4 Flush Aligned Cards) ──────────────── */}
      <div className="dashboard-stats-grid">
        {/* Card 1: Total Courses */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '16px',
            padding: '20px 22px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03), 0 4px 12px rgba(0, 0, 0, 0.02)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '12px',
              background: '#EEF2FF',
              color: '#4F46E5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <BookOpen size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
              {totalCoursesCount}
            </div>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 3 }}>
              Total Courses
            </div>
          </div>
        </div>

        {/* Card 2: Total Tasks */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '16px',
            padding: '20px 22px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03), 0 4px 12px rgba(0, 0, 0, 0.02)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '12px',
              background: '#F0F9FF',
              color: '#0284C7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ClipboardList size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
              {totalTasks}
            </div>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 3 }}>
              Total Tasks
            </div>
          </div>
        </div>

        {/* Card 3: Pending Tasks */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '16px',
            padding: '20px 22px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03), 0 4px 12px rgba(0, 0, 0, 0.02)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '12px',
              background: '#FFFBEB',
              color: '#D97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#D97706', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
              {pendingTasks.length}
            </div>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 3 }}>
              Pending Tasks
            </div>
          </div>
        </div>

        {/* Card 4: Done Tasks */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '16px',
            padding: '20px 22px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03), 0 4px 12px rgba(0, 0, 0, 0.02)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '12px',
              background: '#ECFDF5',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#059669', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
              {doneTasks.length}
            </div>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 3 }}>
              Completed Tasks
            </div>
          </div>
        </div>
      </div>


      {/* ─── 2. 4 PROFESSIONAL MOVEABLE LINEAR GRAPHS ───────────────── */}
      <div className="dashboard-graphs-grid">
        {graphOrder.map((cardId) => {
          const { title, render } = getGraphCardContent(cardId);
          const isDragging = draggedCardId === cardId;

          return (
            <DashboardMoveableCard
              key={cardId}
              cardId={cardId}
              title={title}
              isDragging={isDragging}
              onDragStart={(e) => handleDragStart(cardId, e)}
              onDragOver={(e) => handleDragOver(cardId, e)}
              onDragEnd={handleDragEnd}
            >
              {(width) => render(width)}
            </DashboardMoveableCard>
          );
        })}
      </div>

      {/* ─── 3. COMING UP NEXT SECTION (Flush Aligned Table / Agenda) ── */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          padding: '22px 24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03), 0 6px 16px rgba(0, 0, 0, 0.02)',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '18px',
            paddingBottom: '14px',
            borderBottom: '1px solid #F1F5F9',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarClock size={18} color="#4F46E5" />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.015em' }}>
                Coming Up Next
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: '#64748B' }}>
                Chronological deadline agenda with day-wise scheduling
              </p>
            </div>
          </div>

          <span
            style={{
              fontSize: '0.74rem',
              fontWeight: 700,
              color: '#4F46E5',
              background: '#EEF2FF',
              padding: '3px 10px',
              borderRadius: '6px',
            }}
          >
            {upcomingTasks.length} pending
          </span>
        </div>

        {/* Upcoming Tasks List */}
        {upcomingTasks.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {upcomingTasks.map((task) => {
              const typeStyle = getTypeStyle(task.type);
              const isDone = task.status === 'done';
              const formattedDate = formatDeadlineDayWise(task.deadline);
              const isOverdue = formattedDate === 'Overdue';

              return (
                <div
                  key={task.id}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: `1px solid ${isOverdue ? '#FECACA' : '#E2E8F0'}`,
                    borderLeft: `4px solid ${task.priority === 'high' ? '#EF4444' : task.priority === 'medium' ? '#F59E0B' : '#94A3B8'
                      }`,
                    background: isDone ? '#F8FAFC' : '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '14px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                    <button
                      type="button"
                      onClick={() => handleToggleTaskStatus(task.id, task.status)}
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '5px',
                        border: `2px solid ${isDone ? '#10B981' : '#CBD5E1'}`,
                        background: isDone ? '#10B981' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFFFFF',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                      title={isDone ? 'Mark as pending' : 'Mark as done'}
                    >
                      {isDone && <Check size={12} />}
                    </button>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: 3 }}>
                        <span
                          style={{
                            fontSize: '0.66rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: typeStyle.bg,
                            color: typeStyle.text,
                            border: `1px solid ${typeStyle.border}`,
                          }}
                        >
                          {task.type}
                        </span>

                        {task.subject && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              color: '#4F46E5',
                              background: '#EEF2FF',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            <BookOpen size={10} />
                            {task.subject}
                          </span>
                        )}

                        <span
                          style={{
                            fontSize: '0.66rem',
                            fontWeight: 600,
                            color: task.priority === 'high' ? '#DC2626' : task.priority === 'medium' ? '#D97706' : '#64748B',
                          }}
                        >
                          • {task.priority} priority
                        </span>
                      </div>

                      <div
                        style={{
                          fontSize: '0.92rem',
                          fontWeight: 700,
                          color: isDone ? '#94A3B8' : '#0F172A',
                          textDecoration: isDone ? 'line-through' : 'none',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {task.title}
                      </div>
                    </div>
                  </div>

                  {/* Deadline & Edit Action */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: isOverdue ? '#FEF2F2' : '#F1F5F9',
                        color: isOverdue ? '#DC2626' : '#334155',
                        border: isOverdue ? '1px solid #FECACA' : '1px solid #E2E8F0',
                      }}
                    >
                      <Calendar size={12} color={isOverdue ? '#DC2626' : '#64748B'} />
                      {formattedDate}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingTask(task);
                        setIsTaskModalOpen(true);
                      }}
                      title="Edit task"
                      style={{
                        border: '1px solid #E2E8F0',
                        background: '#FFFFFF',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        color: '#475569',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Edit3 size={11} />
                      <span>Edit</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '36px 10px', color: '#94A3B8' }}>
            <CheckCircle2 size={36} color="#10B981" style={{ margin: '0 auto 8px auto', opacity: 0.8 }} />
            <p style={{ fontSize: '0.92rem', fontWeight: 600, color: '#334155', margin: '0 0 4px 0' }}>
              All caught up! No pending deadlines.
            </p>
            <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
              Add new assignments or quizzes to schedule automated reminders.
            </span>
          </div>
        )}
      </div>

      {/* Task Modal for Creating / Editing */}
      {isTaskModalOpen && (
        <TaskModal
          onClose={() => {
            setIsTaskModalOpen(false);
            setEditingTask(null);
          }}
          onSaved={() => {
            setIsTaskModalOpen(false);
            setEditingTask(null);
            loadDashboardData();
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
              }
              : undefined
          }
        />
      )}
    </div>
  );
}
