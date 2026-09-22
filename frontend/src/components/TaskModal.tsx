import { useState } from 'react';
import { X, Trash2, Bell } from 'lucide-react';
import { tasksApi } from '../services/api';
import toast from 'react-hot-toast';

interface TaskModalProps {
  onClose: () => void;
  onSaved: () => void;
  initialData?: {
    id?: string;
    title: string;
    type: string;
    subject: string | null;
    deadline: string | null;
    priority: string;
    description?: string;
    source?: string;
  };
}

export default function TaskModal({ onClose, onSaved, initialData }: TaskModalProps) {
  const isEditing = Boolean(initialData?.id);

  const getInitialDueDate = (deadlineStr?: string | null) => {
    if (!deadlineStr) return '';
    if (deadlineStr.includes('T')) {
      const d = new Date(deadlineStr);
      if (!isNaN(d.getTime())) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
    }
    return deadlineStr.slice(0, 10);
  };

  const [form, setForm] = useState({
    title: initialData?.title || '',
    type: initialData?.type || 'assignment',
    subject: initialData?.subject || '',
    dueDate: getInitialDueDate(initialData?.deadline),
    priority: initialData?.priority || 'medium',
    description: initialData?.description || '',
    source: initialData?.source || 'manual',
  });
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Day-wise deadline: set to end of the day (23:59:59) so it is cleanly scheduled day-wise
      const deadlineDate = form.dueDate ? new Date(`${form.dueDate}T23:59:59`) : new Date();
      const payload = {
        title: form.title,
        type: form.type,
        subject: form.subject,
        priority: form.priority,
        description: form.description,
        source: form.source,
        deadline: deadlineDate.toISOString(),
      };

      if (isEditing && initialData?.id) {
        await tasksApi.update(initialData.id, payload);
        toast.success('Task & reminders updated successfully!');
      } else {
        await tasksApi.create(payload);
        toast.success('Task added to your calendar with day-wise & week-wise email reminders.');
      }
      onSaved();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not save the task. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!initialData?.id) return;
    if (!window.confirm(`Are you sure you want to delete "${form.title}"?`)) return;

    setDeleting(true);
    try {
      await tasksApi.delete(initialData.id);
      toast.success('Task removed from calendar.');
      onSaved();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not delete the task.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-5)',
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              {isEditing ? 'Edit Academic Event' : initialData ? 'Review Captured Task' : 'Add Academic Task'}
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748B', marginTop: 3 }}>
              {isEditing
                ? 'Update deadline, topic, or reminders'
                : 'Set deadline and automatic email notifications'}
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: 6 }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="input-group">
            <label className="input-label" style={{ fontWeight: 600 }}>Task Title</label>
            <input
              className="input"
              placeholder="e.g. AI Assignment or Quiz 1"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className="input-group">
              <label className="input-label" style={{ fontWeight: 600 }}>Type</label>
              <select
                className="input"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="assignment">Assignment</option>
                <option value="quiz">Quiz</option>
                <option value="project">Project</option>
                <option value="exam">Exam</option>
                <option value="personal">Personal</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="input-group">
              <label className="input-label" style={{ fontWeight: 600 }}>Priority</label>
              <select
                className="input"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div className="input-group">
            <label className="input-label" style={{ fontWeight: 600 }}>
              Topic / Subject <span style={{ color: '#6366F1', fontWeight: 500 }}>(e.g. AI, Machine Learning)</span>
            </label>
            <input
              className="input"
              placeholder="e.g. Machine Learning, Computer Networks"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          </div>

          <div className="input-group">
            <label className="input-label" style={{ fontWeight: 600 }}>Due Date (Day)</label>
            <input
              type="date"
              className="input"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              required
            />
          </div>

          {/* Email Reminders Auto-Schedule Info Pill */}
          <div
            style={{
              padding: '10px 12px',
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              borderRadius: '8px',
              fontSize: '0.78rem',
              color: '#166534',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              lineHeight: 1.4,
            }}
          >
            <Bell size={16} color="#16A34A" style={{ flexShrink: 0 }} />
            <span>
              <strong>Auto Email Reminders:</strong> Scheduled <strong>day-wise & week-wise</strong> before this deadline. Changing the date will automatically re-schedule them.
            </span>
          </div>

          <div className="input-group">
            <label className="input-label" style={{ fontWeight: 600 }}>Description / Notes (optional)</label>
            <textarea
              className="input"
              rows={2}
              placeholder="Any extra instructions, LMS links, or notes..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isEditing ? 'space-between' : 'flex-end',
              gap: 'var(--space-3)',
              marginTop: 'var(--space-2)',
            }}
          >
            {isEditing && (
              <button
                type="button"
                className="btn"
                onClick={handleDelete}
                disabled={deleting || loading}
                style={{
                  background: '#FEF2F2',
                  color: '#DC2626',
                  border: '1px solid #FECACA',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                <Trash2 size={14} />
                <span>{deleting ? 'Deleting...' : 'Delete'}</span>
              </button>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading || deleting}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || deleting}
                style={{ fontWeight: 700 }}
              >
                {loading ? 'Saving...' : isEditing ? 'Update & Reschedule' : 'Add Task'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
