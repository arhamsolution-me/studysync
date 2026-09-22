import { useState } from 'react';
import { ListOrdered, CheckCircle2, Circle, Lightbulb, Check } from 'lucide-react';

export interface StepItem {
  stepNumber: number;
  title: string;
  detail: string;
  tip?: string;
}

export interface StepCardWidgetProps {
  data: {
    title: string;
    description?: string;
    steps: StepItem[];
  };
}

export default function StepCardWidget({ data }: StepCardWidgetProps) {
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});

  const toggleStep = (stepNum: number) => {
    setCompletedSteps((prev) => ({
      ...prev,
      [stepNum]: !prev[stepNum],
    }));
  };

  const steps = data.steps || [];
  const completedCount = steps.filter((s) => completedSteps[s.stepNumber]).length;
  const progressPercent = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '16px',
        padding: '20px',
        margin: '16px 0',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F3F4F6', paddingBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ListOrdered size={18} color="#2563EB" />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#111827' }}>{data.title}</h4>
            {data.description && <span style={{ fontSize: '0.80rem', color: '#6B7280' }}>{data.description}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: progressPercent === 100 ? '#059669' : '#6B7280' }}>
            {completedCount}/{steps.length} done
          </span>
          {progressPercent === 100 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#DCFCE7', color: '#166534', padding: '3px 8px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 600 }}>
              <Check size={12} /> Complete
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ width: '100%', height: 4, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
        <div
          style={{
            width: `${progressPercent}%`,
            height: '100%',
            background: progressPercent === 100 ? '#10B981' : '#3B82F6',
            transition: 'width 0.25s ease',
          }}
        />
      </div>

      {/* Steps List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {steps.map((step) => {
          const isDone = !!completedSteps[step.stepNumber];

          return (
            <div
              key={step.stepNumber}
              onClick={() => toggleStep(step.stepNumber)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '12px 14px',
                borderRadius: '12px',
                background: isDone ? '#F9FAFB' : '#FAFAFA',
                border: `1px solid ${isDone ? '#E5E7EB' : '#F3F4F6'}`,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  marginTop: 2,
                  color: isDone ? '#10B981' : '#9CA3AF',
                }}
              >
                {isDone ? <CheckCircle2 size={20} color="#10B981" /> : <Circle size={20} />}
              </button>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: isDone ? '#9CA3AF' : '#2563EB', background: isDone ? '#E5E7EB' : '#DBEAFE', padding: '1px 7px', borderRadius: 6 }}>
                    Step {step.stepNumber}
                  </span>
                  <span
                    style={{
                      fontSize: '0.90rem',
                      fontWeight: 600,
                      color: isDone ? '#6B7280' : '#111827',
                      textDecoration: isDone ? 'line-through' : 'none',
                    }}
                  >
                    {step.title}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: '0.84rem',
                    color: isDone ? '#9CA3AF' : '#4B5563',
                    lineHeight: 1.5,
                  }}
                >
                  {step.detail}
                </div>

                {step.tip && (
                  <div
                    style={{
                      marginTop: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: '#FEF3C7',
                      color: '#92400E',
                      padding: '4px 10px',
                      borderRadius: 8,
                      fontSize: '0.76rem',
                    }}
                  >
                    <Lightbulb size={13} />
                    <span>Tip: {step.tip}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
