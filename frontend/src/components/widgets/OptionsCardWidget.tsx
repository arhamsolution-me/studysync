import { useState } from 'react';
import { SlidersHorizontal, Check, X, Sparkles, AlertCircle } from 'lucide-react';

export interface OptionItem {
  id: string;
  title: string;
  subtitle?: string;
  pros?: string[];
  cons?: string[];
  badge?: string;
  recommendation?: boolean;
  actionPrompt?: string;
}

export interface OptionsCardWidgetProps {
  data: {
    title: string;
    description?: string;
    category?: string;
    options: OptionItem[];
    disclaimer?: string;
  };
}

export default function OptionsCardWidget({ data }: OptionsCardWidgetProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    data.options.find((o) => o.recommendation)?.id || data.options[0]?.id || null
  );

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F3F4F6', paddingBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SlidersHorizontal size={18} color="#16A34A" />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#111827' }}>{data.title}</h4>
            {data.description && <span style={{ fontSize: '0.80rem', color: '#6B7280' }}>{data.description}</span>}
          </div>
        </div>

        {data.category && (
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              background: '#F3F4F6',
              color: '#4B5563',
              padding: '3px 9px',
              borderRadius: 9999,
            }}
          >
            {data.category}
          </span>
        )}
      </div>

      {/* Options Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        {data.options.map((opt) => {
          const isSelected = selectedId === opt.id;

          return (
            <div
              key={opt.id}
              onClick={() => setSelectedId(opt.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: '16px',
                borderRadius: '14px',
                background: isSelected ? '#F8FAFC' : '#FFFFFF',
                border: `2px solid ${isSelected ? '#3B82F6' : '#E5E7EB'}`,
                cursor: 'pointer',
                transition: 'all 0.16s ease',
                position: 'relative',
              }}
            >
              {/* Badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.94rem', fontWeight: 600, color: '#0F172A' }}>{opt.title}</span>
                {opt.badge ? (
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      background: opt.recommendation ? '#DBEAFE' : '#F1F5F9',
                      color: opt.recommendation ? '#1E40AF' : '#475569',
                      padding: '2px 8px',
                      borderRadius: 9999,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {opt.recommendation && <Sparkles size={11} />}
                    {opt.badge}
                  </span>
                ) : opt.recommendation ? (
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      background: '#DBEAFE',
                      color: '#1E40AF',
                      padding: '2px 8px',
                      borderRadius: 9999,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Sparkles size={11} />
                    Recommended
                  </span>
                ) : null}
              </div>

              {opt.subtitle && <span style={{ fontSize: '0.82rem', color: '#64748B', lineHeight: 1.4 }}>{opt.subtitle}</span>}

              {/* Pros List */}
              {opt.pros && opt.pros.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                  {opt.pros.map((p, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#15803D' }}>
                      <Check size={13} style={{ flexShrink: 0 }} />
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Cons List */}
              {opt.cons && opt.cons.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {opt.cons.map((c, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#B91C1C' }}>
                      <X size={13} style={{ flexShrink: 0 }} />
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Disclaimer */}
      {data.disclaimer && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#FFFBEB',
            border: '1px solid #FEF3C7',
            borderRadius: '10px',
            padding: '8px 12px',
            fontSize: '0.76rem',
            color: '#92400E',
          }}
        >
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{data.disclaimer}</span>
        </div>
      )}
    </div>
  );
}
