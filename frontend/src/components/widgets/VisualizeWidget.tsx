import { useState } from 'react';
import { Workflow, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export interface VisualizeWidgetProps {
  data: {
    title: string;
    description: string;
    svgContent?: string;
    diagramType?: string;
  };
}

export default function VisualizeWidget({ data }: VisualizeWidgetProps) {
  const [copied, setCopied] = useState(false);

  const handleCopySvg = async () => {
    if (!data.svgContent) return;
    try {
      await navigator.clipboard.writeText(data.svgContent);
      setCopied(true);
      toast.success('SVG code copied to clipboard!');
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
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F3F4F6', paddingBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Workflow size={18} color="#7C3AED" />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#111827' }}>{data.title}</h4>
            <span style={{ fontSize: '0.80rem', color: '#6B7280' }}>{data.description}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {data.diagramType && (
            <span style={{ fontSize: '0.72rem', fontWeight: 600, background: '#EDE9FE', color: '#6D28D9', padding: '3px 9px', borderRadius: 9999, textTransform: 'capitalize' }}>
              {data.diagramType}
            </span>
          )}

          {data.svgContent && (
            <button
              type="button"
              onClick={handleCopySvg}
              style={{
                background: copied ? '#ECFDF5' : '#F3F4F6',
                color: copied ? '#065F46' : '#374151',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                padding: '5px 10px',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              <span>{copied ? 'Copied' : 'Copy SVG'}</span>
            </button>
          )}
        </div>
      </div>

      {/* SVG Canvas */}
      {data.svgContent ? (
        <div
          style={{
            background: '#FAFAFA',
            border: '1px solid #F3F4F6',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overflowX: 'auto',
          }}
          dangerouslySetInnerHTML={{ __html: data.svgContent }}
        />
      ) : (
        <div
          style={{
            background: '#FAFAFA',
            border: '1px dashed #E5E7EB',
            borderRadius: '12px',
            padding: '24px',
            textAlign: 'center',
            color: '#6B7280',
            fontSize: '0.86rem',
          }}
        >
          Diagram: {data.title}
        </div>
      )}
    </div>
  );
}
