import { useState } from 'react';
import { HelpCircle, ArrowRight, Check } from 'lucide-react';

export interface UserInputOption {
  label: string;
  value: string;
  hint?: string;
}

export interface UserInputWidgetProps {
  data: {
    prompt: string;
    questionId?: string;
    options: UserInputOption[];
  };
}

export default function UserInputWidget({ data }: UserInputWidgetProps) {
  const [selectedVal, setSelectedVal] = useState<string | null>(null);

  const handleSelect = (opt: UserInputOption) => {
    setSelectedVal(opt.value);

    // Dispatch global event that Chatbot.tsx listens to
    window.dispatchEvent(
      new CustomEvent('chatbot:quick_reply', {
        detail: {
          value: opt.value,
          label: opt.label,
        },
      })
    );
  };

  const options = data.options || [];

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '16px',
        padding: '18px',
        margin: '14px 0',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <HelpCircle size={16} color="#3B82F6" />
        </div>
        <span style={{ fontSize: '0.92rem', fontWeight: 600, color: '#1E293B' }}>
          {data.prompt}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map((opt, idx) => {
          const isSelected = selectedVal === opt.value;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelect(opt)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 9999,
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                background: isSelected ? '#3B82F6' : '#F8FAFC',
                color: isSelected ? '#FFFFFF' : '#334155',
                border: `1.5px solid ${isSelected ? '#3B82F6' : '#E2E8F0'}`,
                boxShadow: isSelected ? '0 2px 8px rgba(59, 130, 246, 0.25)' : 'none',
              }}
            >
              {isSelected ? <Check size={14} /> : null}
              <span>{opt.label}</span>
              {opt.hint && (
                <span style={{ fontSize: '0.74rem', opacity: 0.8, fontWeight: 400 }}>
                  ({opt.hint})
                </span>
              )}
              {!isSelected && <ArrowRight size={13} style={{ opacity: 0.6 }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
