import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus,
  CheckCircle2,
  Clock,
  Trash2,
  Bot,
  X,
  Calendar,
  Search,
  BookOpen,
  Upload,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { coursesApi, tasksApi } from '../services/api';

interface Course {
  id: string;
  name: string;
  colorTag: string;
  chunksCount?: number;
  totalTasks?: number;
  pendingTasksCount?: number;
  completedTasksCount?: number;
}

interface TaskItem {
  id: string;
  title: string;
  type: string;
  deadline: string;
  priority: string;
  status: 'pending' | 'done' | 'missed';
  subject?: string;
}

const COLOR_PALETTE = [
  '#4F46E5', // Indigo (Core StudySync Theme)
  '#2563EB', // Royal Blue
  '#7C3AED', // Purple / Violet
  '#0891B2', // Cyan / Ocean
  '#0D9488', // Teal
  '#059669', // Emerald Green
  '#EA580C', // Amber / Orange
  '#D946EF', // Fuchsia / Rose
];


export default function Courses() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  // Add Course Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseColor, setNewCourseColor] = useState(COLOR_PALETTE[0]);
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);

  // Course Hub / Detail Modal
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [activeTab, setActiveTab] = useState<'tasks' | 'notes'>('tasks');
  const [courseTasks, setCourseTasks] = useState<{
    pending: TaskItem[];
    completed: TaskItem[];
  }>({ pending: [], completed: [] });
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Notes Ingestion inside Modal
  const [notesTitle, setNotesTitle] = useState('');
  const [notesContent, setNotesContent] = useState('');
  const [isIngesting, setIsIngesting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const { data } = await coursesApi.getAll();
      setCourses(data.data?.courses || []);
    } catch {
      toast.error('Failed to load courses.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCourseDetails = async (course: Course, initialTab: 'tasks' | 'notes' = 'tasks') => {
    setActiveCourse(course);
    setActiveTab(initialTab);
    setLoadingTasks(true);
    try {
      const { data } = await coursesApi.getCourseTasks(course.id);
      setCourseTasks({
        pending: data.data?.pending || [],
        completed: data.data?.completed || [],
      });
    } catch {
      toast.error('Could not load course tasks.');
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleToggleTaskStatus = async (task: TaskItem) => {
    const newStatus = task.status === 'done' ? 'pending' : 'done';
    try {
      await tasksApi.update(task.id, { status: newStatus });
      toast.success(newStatus === 'done' ? 'Task marked complete!' : 'Task moved to pending.');
      if (activeCourse) {
        handleOpenCourseDetails(activeCourse, activeTab);
      }
      fetchCourses();
    } catch {
      toast.error('Failed to update task status.');
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseName.trim()) {
      toast.error('Please enter a course name');
      return;
    }

    try {
      setIsCreatingCourse(true);
      await coursesApi.create({
        name: newCourseName.trim(),
        colorTag: newCourseColor,
      });
      toast.success('Course created successfully!');
      setNewCourseName('');
      setShowAddModal(false);
      fetchCourses();
    } catch {
      toast.error('Failed to create course.');
    } finally {
      setIsCreatingCourse(false);
    }
  };

  const handleDeleteCourse = async (courseId: string, courseName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete "${courseName}"? All associated notes and chat history will be permanently deleted.`)) {
      return;
    }

    try {
      await coursesApi.delete(courseId);
      toast.success('Course deleted.');
      if (activeCourse?.id === courseId) {
        setActiveCourse(null);
      }
      fetchCourses();
    } catch {
      toast.error('Failed to delete course.');
    }
  };

  const handleIngestNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCourse || !notesContent.trim()) return;

    try {
      setIsIngesting(true);
      const { data } = await coursesApi.addMaterial(activeCourse.id, {
        title: notesTitle.trim() || 'Lecture Notes',
        content: notesContent.trim(),
      });
      toast.success(`Indexed ${data.data?.chunksIndexed || 1} note chunks into AI knowledge base!`);
      setNotesTitle('');
      setNotesContent('');
      fetchCourses();
    } catch {
      toast.error('Failed to index notes.');
    } finally {
      setIsIngesting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeCourse) return;

    try {
      setIsUploading(true);
      const fileList = Array.from(files);
      await coursesApi.uploadMaterial(activeCourse.id, fileList);
      toast.success(`Uploaded and indexed ${fileList.length} file(s) into AI Knowledge Base!`);
      fetchCourses();
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch {
      toast.error('Failed to upload files.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenChatbot = (course: Course, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    localStorage.setItem('studysync_last_selected_course', course.id);
    navigate(`/chatbot?courseId=${course.id}`);
  };

  // Filtered Courses Calculation
  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
      return matchesSearch;
    });
  }, [courses, searchQuery]);

  return (
    <div className="courses-page-container" style={{ width: '100%', maxWidth: '100%', margin: 0, padding: '24px 36px 80px 36px', boxSizing: 'border-box' }}>
      {/* ─── Header ────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          marginBottom: 24,
          paddingBottom: 20,
          borderBottom: '1px solid #E2E8F0',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>
              Courses
            </h1>
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#4F46E5',
                background: '#EEF2FF',
                padding: '3px 11px',
                borderRadius: 20,
                border: '1px solid #C7D2FE',
              }}
            >
              {courses.length} {courses.length === 1 ? 'Course' : 'Courses'}
            </span>
          </div>
          <p style={{ color: '#64748B', fontSize: '0.9rem', marginTop: 4, marginBottom: 0 }}>
            Manage academic subjects, syllabus tasks, and AI vector knowledge bases.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 10,
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(79, 70, 229, 0.28)',
            transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #4338CA 0%, #4F46E5 100%)';
            e.currentTarget.style.boxShadow = '0 6px 18px rgba(79, 70, 229, 0.38)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)';
            e.currentTarget.style.boxShadow = '0 4px 14px rgba(79, 70, 229, 0.28)';
            e.currentTarget.style.transform = 'none';
          }}
        >
          <Plus size={18} strokeWidth={2.4} />
          <span>Add Course</span>
        </button>
      </div>

      {/* ─── Search & Filter Bar ────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: 460 }}>
          <Search
            size={16}
            color="#6366F1"
            style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          />
          <input
            type="text"
            placeholder="Search courses by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 38px',
              borderRadius: 10,
              border: '1px solid #E2E8F0',
              fontSize: '0.88rem',
              background: '#FFFFFF',
              color: '#0F172A',
              outline: 'none',
              transition: 'all 0.15s ease',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#6366F1';
              e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.12)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#E2E8F0';
              e.target.style.boxShadow = 'none';
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: 4,
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {searchQuery && (
          <div style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 500 }}>
            Showing {filteredCourses.length} of {courses.length} courses
          </div>
        )}
      </div>

      {/* ─── Courses Grid ───────────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '3px solid #E2E8F0',
              borderTopColor: '#4F46E5',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 12px auto',
            }}
          />
          <span style={{ fontSize: '0.9rem', color: '#64748B', fontWeight: 500 }}>Loading academic courses...</span>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div
          style={{
            background: '#FFFFFF',
            border: '1.5px dashed #E2E8F0',
            borderRadius: 16,
            padding: '56px 24px',
            textAlign: 'center',
            maxWidth: 520,
            margin: '40px auto',
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)',
              border: '1px solid #C7D2FE',
              color: '#4F46E5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.15)',
            }}
          >
            <BookOpen size={24} />
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>
            {searchQuery ? 'No matching courses found' : 'No courses enrolled yet'}
          </h3>
          <p style={{ fontSize: '0.86rem', color: '#64748B', lineHeight: 1.5, marginBottom: 22 }}>
            {searchQuery
              ? `No course matches "${searchQuery}". Try a different search term or clear the filter.`
              : 'Add your university courses to organize assignments, quizzes, study notes, and get autonomous AI assistance.'}
          </p>
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                padding: '9px 18px',
                borderRadius: 8,
                background: '#EEF2FF',
                color: '#4F46E5',
                border: '1px solid #C7D2FE',
                fontWeight: 600,
                fontSize: '0.86rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#E0E7FF')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#EEF2FF')}
            >
              Clear Search
            </button>
          ) : (
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '11px 22px',
                borderRadius: 10,
                background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)',
                color: '#FFFFFF',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
                transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #4338CA 0%, #4F46E5 100%)';
                e.currentTarget.style.boxShadow = '0 6px 18px rgba(79, 70, 229, 0.4)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(79, 70, 229, 0.3)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <Plus size={16} />
              <span>Create Your First Course</span>
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            width: '100%',
          }}
        >
          {filteredCourses.map((course) => {
            const courseColor = course.colorTag || '#4F46E5';

            return (
              <div
                key={course.id}
                onClick={() => handleOpenChatbot(course)}
                style={{
                  background: '#FFFFFF',
                  borderRadius: 12,
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)',
                  transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 22px',
                  gap: 16,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1.5px)';
                  e.currentTarget.style.boxShadow = `0 6px 18px -2px ${courseColor}18, 0 2px 6px rgba(0, 0, 0, 0.04)`;
                  e.currentTarget.style.borderColor = `${courseColor}60`;
                  const del = e.currentTarget.querySelector('.row-delete-icon') as HTMLElement | null;
                  if (del) del.style.opacity = '1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '0 1px 4px rgba(0, 0, 0, 0.03)';
                  e.currentTarget.style.borderColor = '#E2E8F0';
                  const del = e.currentTarget.querySelector('.row-delete-icon') as HTMLElement | null;
                  if (del) del.style.opacity = '0';
                }}
              >
                {/* Left Subtle Color Accent Strip */}
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 4.5,
                    background: `linear-gradient(180deg, ${courseColor} 0%, #818CF8 100%)`,
                    borderRadius: '12px 0 0 12px',
                  }}
                />

                {/* Left: Course Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                  <h3
                    style={{
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      color: '#0F172A',
                      margin: 0,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={course.name}
                  >
                    {course.name}
                  </h3>
                </div>

                {/* Right: Actions (Delete on hover + Open Chatbot button) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <button
                    className="row-delete-icon"
                    onClick={(e) => handleDeleteCourse(course.id, course.name, e)}
                    title="Delete Course"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#94A3B8',
                      cursor: 'pointer',
                      padding: 6,
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#FEE2E2';
                      e.currentTarget.style.color = '#EF4444';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#94A3B8';
                    }}
                  >
                    <Trash2 size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleOpenChatbot(course, e)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      padding: '9px 18px',
                      background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)',
                      color: '#FFFFFF',
                      borderRadius: 8,
                      border: 'none',
                      fontSize: '0.86rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                      boxShadow: '0 2px 6px rgba(79, 70, 229, 0.22)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #4338CA 0%, #4F46E5 100%)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(79, 70, 229, 0.35)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)';
                      e.currentTarget.style.boxShadow = '0 2px 6px rgba(79, 70, 229, 0.22)';
                    }}
                  >
                    <Bot size={16} />
                    <span>Open Chatbot</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Course Hub Modal (Tasks & Notes Ingestion) ──────────── */}
      {activeCourse && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(6px)',
            padding: 16,
          }}
          onClick={() => setActiveCourse(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 620,
              maxHeight: '88vh',
              background: '#FFFFFF',
              borderRadius: 16,
              boxShadow: '0 20px 40px -8px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'fadeInScale 0.2s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px 16px 24px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: `${activeCourse.colorTag || '#6366F1'}18`,
                    color: activeCourse.colorTag || '#6366F1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1.25rem',
                    border: `1px solid ${activeCourse.colorTag || '#6366F1'}30`,
                  }}
                >
                  {activeCourse.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                    {activeCourse.name}
                  </h2>
                  <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 2 }}>
                    {courseTasks.pending.length} Pending • {courseTasks.completed.length} Done • {activeCourse.chunksCount || 0} Knowledge Chunks
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={(e) => handleOpenChatbot(activeCourse, e)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 12px',
                    background: '#EEF2FF',
                    color: '#4F46E5',
                    border: '1px solid #C7D2FE',
                    borderRadius: 8,
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Bot size={14} />
                  <span>Chatbot</span>
                </button>

                <button
                  onClick={() => setActiveCourse(null)}
                  style={{
                    background: '#F1F5F9',
                    border: 'none',
                    borderRadius: '50%',
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#64748B',
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Tabs */}
            <div
              style={{
                display: 'flex',
                borderBottom: '1px solid #E2E8F0',
                background: '#F8FAFC',
                padding: '0 24px',
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab('tasks')}
                style={{
                  padding: '12px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: `2.5px solid ${activeTab === 'tasks' ? '#4F46E5' : 'transparent'}`,
                  color: activeTab === 'tasks' ? '#4F46E5' : '#64748B',
                  fontWeight: activeTab === 'tasks' ? 700 : 500,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Clock size={15} />
                <span>Academic Tasks ({courseTasks.pending.length + courseTasks.completed.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('notes')}
                style={{
                  padding: '12px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: `2.5px solid ${activeTab === 'notes' ? '#4F46E5' : 'transparent'}`,
                  color: activeTab === 'notes' ? '#4F46E5' : '#64748B',
                  fontWeight: activeTab === 'notes' ? 700 : 500,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <BookOpen size={15} />
                <span>Add Study Materials (FAISS)</span>
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              {activeTab === 'tasks' ? (
                <div>
                  {loadingTasks ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748B', fontSize: '0.88rem' }}>
                      Loading tasks...
                    </div>
                  ) : (
                    <div>
                      {/* Pending Tasks */}
                      <div style={{ marginBottom: 24 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Clock size={14} />
                          <span>Pending ({courseTasks.pending.length})</span>
                        </div>

                        {courseTasks.pending.length === 0 ? (
                          <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0', color: '#64748B', fontSize: '0.84rem', textAlign: 'center' }}>
                            All tasks caught up for this course! 🎉
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {courseTasks.pending.map((task) => (
                              <div
                                key={task.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '12px 14px',
                                  background: '#FFFFFF',
                                  border: '1px solid #E2E8F0',
                                  borderRadius: 10,
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <input
                                    type="checkbox"
                                    checked={false}
                                    onChange={() => handleToggleTaskStatus(task)}
                                    style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#4F46E5' }}
                                  />
                                  <div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0F172A' }}>
                                      {task.title}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                      <Calendar size={12} />
                                      <span>Due: {new Date(task.deadline).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                                      <span>•</span>
                                      <span style={{ textTransform: 'capitalize' }}>{task.type}</span>
                                    </div>
                                  </div>
                                </div>

                                <span
                                  style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    padding: '2px 8px',
                                    borderRadius: 6,
                                    background: task.priority === 'high' ? '#FEE2E2' : '#FEF3C7',
                                    color: task.priority === 'high' ? '#B91C1C' : '#B45309',
                                  }}
                                >
                                  {task.priority}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Completed Tasks */}
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#16A34A', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <CheckCircle2 size={14} />
                          <span>Completed ({courseTasks.completed.length})</span>
                        </div>

                        {courseTasks.completed.length === 0 ? (
                          <div style={{ padding: '14px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0', color: '#94A3B8', fontSize: '0.84rem', textAlign: 'center' }}>
                            No completed tasks yet.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {courseTasks.completed.map((task) => (
                              <div
                                key={task.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '10px 14px',
                                  background: '#F8FAFC',
                                  border: '1px solid #E2E8F0',
                                  borderRadius: 10,
                                  opacity: 0.85,
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <input
                                    type="checkbox"
                                    checked={true}
                                    onChange={() => handleToggleTaskStatus(task)}
                                    style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#16A34A' }}
                                  />
                                  <div>
                                    <div style={{ fontSize: '0.88rem', fontWeight: 500, color: '#64748B', textDecoration: 'line-through' }}>
                                      {task.title}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 1 }}>
                                      Finished
                                    </div>
                                  </div>
                                </div>
                                <CheckCircle2 size={16} color="#16A34A" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Notes & Material Ingestion Tab */
                <div>
                  <div
                    style={{
                      background: '#EEF2FF',
                      border: '1px solid #C7D2FE',
                      borderRadius: 10,
                      padding: '12px 16px',
                      fontSize: '0.82rem',
                      color: '#3730A3',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      marginBottom: 18,
                    }}
                  >
                    <Sparkles size={18} color="#4F46E5" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <strong>AI FAISS Semantic Engine:</strong> Any lecture text, summaries, or slides you add here are converted to embeddings. The AI Chatbot will directly cite and use them when answering your questions!
                    </div>
                  </div>

                  {/* File Upload Option */}
                  <div
                    style={{
                      border: '1.5px dashed #CBD5E1',
                      borderRadius: 12,
                      padding: '20px',
                      textAlign: 'center',
                      background: '#F8FAFC',
                      marginBottom: 20,
                    }}
                  >
                    <Upload size={24} color="#6366F1" style={{ margin: '0 auto 8px auto' }} />
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0F172A' }}>
                      Upload Course Documents
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#64748B', marginTop: 2, marginBottom: 12 }}>
                      Supports PDF, DOCX, PPTX slides, XLSX, TXT, code files & voice notes
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                      accept=".pdf,.docx,.doc,.txt,.py,.md,.csv,.pptx,.ppt,.xlsx,.xls,.mp3,.wav,.m4a,.webm"
                    />
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        padding: '8px 18px',
                        background: '#EEF2FF',
                        border: '1px solid #C7D2FE',
                        borderRadius: 8,
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: '#4F46E5',
                        cursor: isUploading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isUploading) e.currentTarget.style.background = '#E0E7FF';
                      }}
                      onMouseLeave={(e) => {
                        if (!isUploading) e.currentTarget.style.background = '#EEF2FF';
                      }}
                    >
                      {isUploading ? 'Uploading & Indexing...' : 'Browse Files'}
                    </button>
                  </div>

                  {/* Text Notes Paste */}
                  <form onSubmit={handleIngestNotes}>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                        Note Title / Topic
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Chapter 4: Memory Management"
                        value={notesTitle}
                        onChange={(e) => setNotesTitle(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: 8,
                          border: '1px solid #CBD5E1',
                          fontSize: '0.86rem',
                          color: '#0F172A',
                          outline: 'none',
                          transition: 'all 0.15s ease',
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = '#6366F1';
                          e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.15)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = '#CBD5E1';
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                        Notes Content
                      </label>
                      <textarea
                        rows={5}
                        placeholder="Paste lecture notes, definitions, exam tips, or formulas..."
                        value={notesContent}
                        onChange={(e) => setNotesContent(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: '1px solid #CBD5E1',
                          fontSize: '0.86rem',
                          fontFamily: 'inherit',
                          color: '#0F172A',
                          outline: 'none',
                          transition: 'all 0.15s ease',
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = '#6366F1';
                          e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.15)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = '#CBD5E1';
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isIngesting || !notesContent.trim()}
                      style={{
                        width: '100%',
                        padding: '11px',
                        background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: 8,
                        fontSize: '0.88rem',
                        fontWeight: 600,
                        cursor: isIngesting || !notesContent.trim() ? 'not-allowed' : 'pointer',
                        opacity: isIngesting || !notesContent.trim() ? 0.6 : 1,
                        boxShadow: '0 4px 14px rgba(79, 70, 229, 0.28)',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isIngesting && notesContent.trim()) {
                          e.currentTarget.style.background = 'linear-gradient(135deg, #4338CA 0%, #4F46E5 100%)';
                          e.currentTarget.style.boxShadow = '0 6px 18px rgba(79, 70, 229, 0.38)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isIngesting && notesContent.trim()) {
                          e.currentTarget.style.background = 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)';
                          e.currentTarget.style.boxShadow = '0 4px 14px rgba(79, 70, 229, 0.28)';
                        }
                      }}
                    >
                      {isIngesting ? 'Vectorizing and Indexing into FAISS...' : 'Index Notes into AI Knowledge Base'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Add Course Modal ────────────────────────────────────── */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            backdropFilter: 'blur(6px)',
            padding: 16,
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 460,
              background: '#FFFFFF',
              borderRadius: 16,
              boxShadow: '0 20px 40px -8px rgba(0, 0, 0, 0.25)',
              padding: '24px 26px',
              animation: 'fadeInScale 0.2s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Add New Course
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748B', marginTop: 2, marginBottom: 0 }}>
                  Create a subject to track tasks and chat with AI
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                style={{
                  background: '#F1F5F9',
                  border: 'none',
                  borderRadius: '50%',
                  width: 30,
                  height: 30,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748B',
                }}
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateCourse}>
              {/* Course Name Input */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Course Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Operating Systems"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: 10,
                    border: '1.5px solid #CBD5E1',
                    fontSize: '0.9rem',
                    color: '#0F172A',
                    outline: 'none',
                    transition: 'all 0.15s ease',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#6366F1';
                    e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.15)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#CBD5E1';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>


              {/* Color Swatches */}
              <div style={{ marginBottom: 22 }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>
                  Accent Shade
                </label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {COLOR_PALETTE.map((c) => {
                    const isSelected = newCourseColor === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewCourseColor(c)}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: c,
                          border: isSelected ? '2.5px solid #FFFFFF' : '2px solid #FFFFFF',
                          boxShadow: isSelected ? `0 0 0 2.5px ${c}, 0 4px 10px rgba(0,0,0,0.2)` : '0 1px 3px rgba(0,0,0,0.12)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                          transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                        }}
                      >
                        {isSelected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#FFFFFF' }} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 8,
                    background: '#F1F5F9',
                    border: '1px solid #E2E8F0',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    color: '#475569',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#E2E8F0';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#F1F5F9';
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingCourse}
                  style={{
                    padding: '10px 22px',
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)',
                    border: 'none',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    color: '#FFFFFF',
                    cursor: isCreatingCourse ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
                    transition: 'all 0.18s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isCreatingCourse) {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #4338CA 0%, #4F46E5 100%)';
                      e.currentTarget.style.boxShadow = '0 6px 18px rgba(79, 70, 229, 0.4)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isCreatingCourse) {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)';
                      e.currentTarget.style.boxShadow = '0 4px 14px rgba(79, 70, 229, 0.3)';
                      e.currentTarget.style.transform = 'none';
                    }
                  }}
                >
                  {isCreatingCourse ? 'Creating...' : 'Save Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
