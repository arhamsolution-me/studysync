import { useState } from 'react';
import { BarChart3, TrendingUp, PieChart } from 'lucide-react';

export interface ChartWidgetProps {
  data: {
    title: string;
    chartType: 'bar' | 'line' | 'pie';
    labels: string[];
    values: number[];
    unit?: string;
  };
}

export default function ChartWidget({ data }: ChartWidgetProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const labels = data.labels || [];
  const values = data.values || [];
  const unit = data.unit || '';
  const maxVal = Math.max(...values, 1);

  // SVG dimensions
  const width = 560;
  const height = 240;
  const padding = { top: 20, right: 30, bottom: 40, left: 45 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const barWidth = Math.max(16, Math.min(48, (chartWidth / (labels.length || 1)) * 0.6));

  const colors = ['#6366F1', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'];

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '16px',
        padding: '20px',
        margin: '16px 0',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {data.chartType === 'line' ? <TrendingUp size={18} color="#4F46E5" /> : data.chartType === 'pie' ? <PieChart size={18} color="#4F46E5" /> : <BarChart3 size={18} color="#4F46E5" />}
          </div>
          <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600, color: '#111827' }}>{data.title}</h4>
        </div>
        {hoveredIdx !== null && (
          <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#4F46E5' }}>
            {labels[hoveredIdx]}: {values[hoveredIdx]} {unit}
          </span>
        )}
      </div>

      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', minWidth: 320 }}>
          {/* Y Axis Grid Lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const y = padding.top + chartHeight * (1 - ratio);
            const valLabel = Math.round(maxVal * ratio);
            return (
              <g key={idx}>
                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#F3F4F6" strokeDasharray="3 3" />
                <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#9CA3AF">
                  {valLabel}
                </text>
              </g>
            );
          })}

          {/* Bar Chart Mode */}
          {data.chartType !== 'line' &&
            values.map((val, idx) => {
              const xCenter = padding.left + (idx + 0.5) * (chartWidth / values.length);
              const x = xCenter - barWidth / 2;
              const barHeight = (val / maxVal) * chartHeight;
              const y = padding.top + chartHeight - barHeight;
              const color = colors[idx % colors.length];
              const isHovered = hoveredIdx === idx;

              return (
                <g key={idx} onMouseEnter={() => setHoveredIdx(idx)} onMouseLeave={() => setHoveredIdx(null)} style={{ cursor: 'pointer' }}>
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx={6}
                    fill={color}
                    opacity={hoveredIdx === null || isHovered ? 1 : 0.4}
                    style={{ transition: 'all 0.2s ease' }}
                  />
                  <text
                    x={xCenter}
                    y={padding.top + chartHeight + 20}
                    textAnchor="middle"
                    fontSize="11"
                    fill={isHovered ? '#111827' : '#6B7280'}
                    fontWeight={isHovered ? 600 : 400}
                  >
                    {labels[idx]}
                  </text>
                </g>
              );
            })}

          {/* Line Chart Mode */}
          {data.chartType === 'line' && (
            <>
              <path
                d={values
                  .map((val, idx) => {
                    const x = padding.left + (idx + 0.5) * (chartWidth / values.length);
                    const y = padding.top + chartHeight - (val / maxVal) * chartHeight;
                    return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                  })
                  .join(' ')}
                fill="none"
                stroke="#6366F1"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {values.map((val, idx) => {
                const x = padding.left + (idx + 0.5) * (chartWidth / values.length);
                const y = padding.top + chartHeight - (val / maxVal) * chartHeight;
                const isHovered = hoveredIdx === idx;
                return (
                  <g key={idx} onMouseEnter={() => setHoveredIdx(idx)} onMouseLeave={() => setHoveredIdx(null)} style={{ cursor: 'pointer' }}>
                    <circle cx={x} cy={y} r={isHovered ? 7 : 5} fill="#6366F1" stroke="#FFFFFF" strokeWidth="2" />
                    <text
                      x={x}
                      y={padding.top + chartHeight + 20}
                      textAnchor="middle"
                      fontSize="11"
                      fill={isHovered ? '#111827' : '#6B7280'}
                      fontWeight={isHovered ? 600 : 400}
                    >
                      {labels[idx]}
                    </text>
                  </g>
                );
              })}
            </>
          )}
        </svg>
      </div>
    </div>
  );
}
