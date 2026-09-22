import { Table, Check, Sparkles } from 'lucide-react';
import InlineMathText from '../InlineMathText';

export interface ComparisonWidgetProps {
  data: {
    title: string;
    columns: string[];
    rows: Array<{
      feature: string;
      values: string[];
      highlight?: boolean;
    }>;
    recommendation?: string;
  };
}

export default function ComparisonWidget({ data }: ComparisonWidgetProps) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '16px',
        padding: '20px',
        margin: '16px 0',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
        overflowX: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Table size={18} color="#4F46E5" />
        </div>
        <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600, color: '#111827' }}>{data.title}</h4>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #E5E7EB' }}>
            {data.columns?.map((col, idx) => (
              <th
                key={idx}
                style={{
                  padding: '10px 12px',
                  textAlign: idx === 0 ? 'left' : 'center',
                  fontWeight: 600,
                  color: '#111827',
                  background: '#F9FAFB',
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows?.map((row, rIdx) => (
            <tr
              key={rIdx}
              style={{
                borderBottom: '1px solid #F3F4F6',
                background: row.highlight ? '#F0FDF4' : 'transparent',
              }}
            >
              <td style={{ padding: '10px 12px', fontWeight: 600, color: '#374151' }}>
                <InlineMathText content={row.feature} />
              </td>
              {row.values?.map((val, vIdx) => (
                <td key={vIdx} style={{ padding: '10px 12px', textAlign: 'center', color: '#4B5563' }}>
                  {val === 'true' || val === 'yes' ? (
                    <Check size={16} color="#10B981" style={{ margin: 'auto' }} />
                  ) : (
                    <InlineMathText content={val} />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {data.recommendation && (
        <div
          style={{
            marginTop: 16,
            padding: '12px 14px',
            background: '#EEF2FF',
            borderRadius: '10px',
            border: '1px solid #C7D2FE',
            fontSize: '0.86rem',
            color: '#312E81',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            lineHeight: 1.55,
          }}
        >
          <Sparkles size={16} color="#4F46E5" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Recommendation:</strong> <InlineMathText content={data.recommendation} />
          </div>
        </div>
      )}
    </div>
  );
}
