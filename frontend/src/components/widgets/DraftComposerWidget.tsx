import { useState } from 'react';
import { Mail, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export interface DraftComposerWidgetProps {
  data: {
    recipient?: string;
    subject: string;
    body: string;
    tone?: string;
  };
}

export default function DraftComposerWidget({ data }: DraftComposerWidgetProps) {
  const [copied, setCopied] = useState(false);

  const fullText = `Subject: ${data.subject}\n\n${data.body}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      toast.success('Draft copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

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
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Mail size={18} color="#4F46E5" />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600, color: '#111827' }}>Message / Email Draft</h4>
            {data.recipient && <span style={{ fontSize: '0.78rem', color: '#6B7280' }}>To: {data.recipient}</span>}
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          style={{
            background: copied ? '#ECFDF5' : '#F3F4F6',
            color: copied ? '#065F46' : '#374151',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '0.80rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.15s ease',
          }}
        >
          {copied ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
          <span>{copied ? 'Copied' : 'Copy Draft'}</span>
        </button>
      </div>

      <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '12px 14px' }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#4B5563', marginBottom: 4 }}>Subject:</div>
        <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#111827' }}>{data.subject}</div>
      </div>

      <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '14px', whiteSpace: 'pre-wrap', fontSize: '0.90rem', color: '#1F2937', lineHeight: 1.6 }}>
        {data.body}
      </div>
    </div>
  );
}
