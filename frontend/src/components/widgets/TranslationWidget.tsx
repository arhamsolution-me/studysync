import { Languages, Volume2 } from 'lucide-react';

export interface TranslationWidgetProps {
  data: {
    originalText: string;
    translatedText: string;
    sourceLanguage: string;
    targetLanguage: string;
    pronunciation?: string;
    notes?: string;
  };
}

export default function TranslationWidget({ data }: TranslationWidgetProps) {
  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    }
  };

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Languages size={16} color="#4F46E5" />
          </div>
          <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#4B5563' }}>
            {data.sourceLanguage} → {data.targetLanguage}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '12px' }}>
          <div style={{ fontSize: '0.74rem', color: '#6B7280', marginBottom: 4 }}>{data.sourceLanguage}</div>
          <div style={{ fontSize: '0.94rem', color: '#111827', fontWeight: 500 }}>{data.originalText}</div>
        </div>

        <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '10px', padding: '12px', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: '0.74rem', color: '#4338CA' }}>{data.targetLanguage}</span>
            <button
              type="button"
              onClick={() => speak(data.translatedText)}
              title="Listen pronunciation"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4F46E5', padding: 2 }}
            >
              <Volume2 size={15} />
            </button>
          </div>
          <div style={{ fontSize: '0.98rem', color: '#1E1B4B', fontWeight: 600 }}>{data.translatedText}</div>
          {data.pronunciation && (
            <div style={{ fontSize: '0.76rem', color: '#6366F1', marginTop: 4, fontStyle: 'italic' }}>
              /{data.pronunciation}/
            </div>
          )}
        </div>
      </div>

      {data.notes && (
        <div style={{ fontSize: '0.78rem', color: '#6B7280', lineHeight: 1.4 }}>
          💡 <strong>Usage note:</strong> {data.notes}
        </div>
      )}
    </div>
  );
}
