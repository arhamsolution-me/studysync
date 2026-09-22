import { useState } from 'react';
import { Compass, MapPin, Calendar, Navigation } from 'lucide-react';

export interface ItineraryDay {
  day: number;
  title: string;
  activities: string[];
}

export interface ItineraryWidgetProps {
  data: {
    title: string;
    location: string;
    days: ItineraryDay[];
  };
}

export default function ItineraryWidget({ data }: ItineraryWidgetProps) {
  const days = data.days || [];
  const [activeDayIdx, setActiveDayIdx] = useState(0);

  const currentDay = days[activeDayIdx] || days[0];

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
          <div style={{ width: 34, height: 34, borderRadius: 10, background: '#F0FDFA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Compass size={18} color="#0D9488" />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#111827' }}>{data.title}</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <MapPin size={12} color="#0D9488" />
              <span style={{ fontSize: '0.78rem', color: '#6B7280', fontWeight: 500 }}>{data.location}</span>
            </div>
          </div>
        </div>

        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#CCFBF1', color: '#115E59', padding: '3px 10px', borderRadius: 9999, fontSize: '0.74rem', fontWeight: 600 }}>
          <Calendar size={12} /> {days.length} Days Plan
        </span>
      </div>

      {/* Day Selector Tabs */}
      {days.length > 1 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {days.map((day, idx) => {
            const isActive = idx === activeDayIdx;

            return (
              <button
                key={day.day}
                type="button"
                onClick={() => setActiveDayIdx(idx)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 9999,
                  fontSize: '0.80rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                  background: isActive ? '#0D9488' : '#F3F4F6',
                  color: isActive ? '#FFFFFF' : '#4B5563',
                  border: `1px solid ${isActive ? '#0D9488' : '#E5E7EB'}`,
                }}
              >
                Day {day.day}: {day.title}
              </button>
            );
          })}
        </div>
      )}

      {/* Current Day Schedule */}
      {currentDay && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Navigation size={14} color="#0D9488" />
            <span>Day {currentDay.day} Schedule: {currentDay.title}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', paddingLeft: 12 }}>
            {/* Timeline vertical bar */}
            <div style={{ position: 'absolute', left: 19, top: 12, bottom: 12, width: 2, background: '#E5E7EB' }} />

            {currentDay.activities.map((act, actIdx) => (
              <div
                key={actIdx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  position: 'relative',
                  zIndex: 1,
                  background: '#FFFFFF',
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: '1px solid #F3F4F6',
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: '#0D9488',
                    border: '2px solid #FFFFFF',
                    boxShadow: '0 0 0 2px #99F6E4',
                    marginTop: 2,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: '0.84rem', color: '#374151', lineHeight: 1.5 }}>
                  {act}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
