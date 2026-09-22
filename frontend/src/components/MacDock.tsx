import React, { useRef, useState, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

interface DockItem {
  id: string;
  label: string;
  to: string;
  iconSrc: string;
  accentColor: string;
  badge?: string;
}

const DOCK_ITEMS: DockItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    to: '/dashboard',
    iconSrc: '/icons/dashboard.png',
    accentColor: '#2563EB',
  },
  {
    id: 'calendar',
    label: 'Calendar',
    to: '/calendar',
    iconSrc: '/icons/calendar.png',
    accentColor: '#0284C7',
  },
  {
    id: 'courses',
    label: 'Courses',
    to: '/courses',
    iconSrc: '/icons/courses.png',
    accentColor: '#2563EB',
  },
  {
    id: 'chatbot',
    label: 'AI Chatbot',
    to: '/chatbot',
    iconSrc: '/icons/chatbot.png',
    accentColor: '#3B82F6',
    badge: 'AI',
  },
  {
    id: 'settings',
    label: 'Settings',
    to: '/settings',
    iconSrc: '/icons/settings.png',
    accentColor: '#64748B',
  },
];

export default function MacDock() {
  const location = useLocation();
  const dockRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [mousePos, setMousePos] = useState<{ x: number } | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [clickedId, setClickedId] = useState<string | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!dockRef.current) return;
    const rect = dockRef.current.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setMousePos(null);
    setHoveredIndex(null);
  }, []);

  // Compute organic Mac dock curve magnification wave + drop animation
  const getItemTransform = (index: number) => {
    if (!mousePos || !dockRef.current) {
      return { scale: 1, translateY: 0 };
    }

    const itemEl = itemRefs.current[index];
    if (!itemEl) {
      // Fallback coordinate math if ref not ready
      const stride = 145; // average width of wide tab with gap
      const itemCenter = index * stride + stride / 2;
      const dist = Math.abs(mousePos.x - itemCenter);
      const maxDist = 160;
      if (dist > maxDist) return { scale: 1, translateY: 0 };
      const norm = (1 + Math.cos((dist / maxDist) * Math.PI)) / 2;
      return { scale: 1 + norm * 0.16, translateY: norm * 6 };
    }

    const dockRect = dockRef.current.getBoundingClientRect();
    const itemRect = itemEl.getBoundingClientRect();
    const itemCenter = itemRect.left - dockRect.left + itemRect.width / 2;
    const dist = Math.abs(mousePos.x - itemCenter);
    const maxDist = 170; // Influence radius for smooth wave across neighbors

    if (dist > maxDist) {
      return { scale: 1, translateY: 0 };
    }

    // Parabolic cosine curve
    const norm = (1 + Math.cos((dist / maxDist) * Math.PI)) / 2;
    const scale = 1 + norm * 0.18; // Smooth 1.18x maximum magnification
    const translateY = norm * 7;   // Smooth downward "drop animation" from top header

    return { scale, translateY };
  };

  const handleItemClick = (id: string) => {
    setClickedId(id);
    setTimeout(() => setClickedId(null), 380);
  };

  return (
    <nav
      ref={dockRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      aria-label="Main Navigation"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px', // Wide width-wise separation
        padding: '6px 12px',
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
        userSelect: 'none',
        perspective: '1000px',
      }}
      className="top-header-dock"
    >
      {DOCK_ITEMS.map((item, idx) => {
        const isActive = location.pathname.startsWith(item.to);
        const { scale, translateY } = getItemTransform(idx);
        const isHovered = hoveredIndex === idx;
        const isClicked = clickedId === item.id;

        return (
          <div
            key={item.id}
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
            onMouseEnter={() => setHoveredIndex(idx)}
          >
            {/* Big, Wide Tab with Organic Mac Dock Curve + Drop Animation */}
            <NavLink
              ref={(el) => {
                itemRefs.current[idx] = el;
              }}
              to={item.to}
              onClick={() => handleItemClick(item.id)}
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '12px', // Comfortable spacing between icon and label
                padding: '10px 22px', // Wide width-wise button
                height: '48px', // Bigger button height
                borderRadius: '13px', // Clean squircle — strictly less than half circle!
                textDecoration: 'none',
                fontSize: '0.97rem',
                fontWeight: isActive ? 700 : 550,
                color: isActive ? item.accentColor : isHovered ? '#0F172A' : '#475569',
                background: isActive
                  ? '#FFFFFF'
                  : isHovered
                  ? 'rgba(241, 245, 249, 0.95)'
                  : 'transparent',
                border: isActive
                  ? '1px solid rgba(226, 232, 240, 0.95)'
                  : isHovered
                  ? '1px solid rgba(226, 232, 240, 0.6)'
                  : '1px solid transparent',
                boxShadow: isActive
                  ? '0 6px 18px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04)'
                  : isHovered
                  ? '0 4px 12px rgba(0, 0, 0, 0.04)'
                  : 'none',
                transform: isClicked
                  ? 'translateY(12px) scale(0.94)' // Drop-spring click animation
                  : `translateY(${translateY}px) scale(${scale})`, // Real-time curve wave + drop
                transition: isClicked
                  ? 'transform 0.18s cubic-bezier(0.16, 1.4, 0.3, 1)'
                  : 'transform 0.12s cubic-bezier(0.2, 0.8, 0.2, 1), background 0.15s ease, box-shadow 0.15s ease, color 0.15s ease',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxSizing: 'border-box',
              }}
              className={`top-dock-item ${isActive ? 'active' : ''}`}
            >
              {/* 3D Custom Logo Icon */}
              <div
                style={{
                  position: 'relative',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <img
                  src={item.iconSrc}
                  alt={item.label}
                  style={{
                    width: '32px',
                    height: '32px',
                    objectFit: 'contain',
                    filter: isActive
                      ? 'drop-shadow(0 4px 10px rgba(37, 99, 235, 0.35)) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.12))'
                      : isHovered
                      ? 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.20))'
                      : 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.10))',
                    transform: isHovered ? 'scale(1.18) rotate(-3deg)' : 'scale(1)',
                    transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.2s ease',
                    userSelect: 'none',
                    pointerEvents: 'none',
                  }}
                />
              </div>

              {/* Typography Label */}
              <span style={{ letterSpacing: '-0.015em' }}>{item.label}</span>

              {/* Small Badge (e.g. AI) */}
              {item.badge && (
                <span
                  style={{
                    fontSize: '0.66rem',
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: '6px',
                    background: 'linear-gradient(135deg, #EC4899, #F43F5E)',
                    color: '#FFFFFF',
                    letterSpacing: '0.04em',
                    marginLeft: '2px',
                    lineHeight: 1.1,
                    boxShadow: '0 2px 5px rgba(236, 72, 153, 0.35)',
                  }}
                >
                  {item.badge}
                </span>
              )}

              {/* Active Indicator Line */}
              {isActive && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: '3px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '24px',
                    height: '3px',
                    borderRadius: '2px',
                    background: item.accentColor,
                    boxShadow: `0 1px 4px ${item.accentColor}44`,
                  }}
                />
              )}
            </NavLink>

            {/* Smooth Drop Tooltip under item */}
            {isHovered && !isActive && (
              <div
                style={{
                  position: 'absolute',
                  top: '56px',
                  padding: '4px 10px',
                  background: 'rgba(15, 23, 42, 0.94)',
                  backdropFilter: 'blur(12px)',
                  color: '#FFFFFF',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  borderRadius: '7px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 8px 20px rgba(0, 0, 0, 0.22)',
                  pointerEvents: 'none',
                  zIndex: 1100,
                  animation: 'dockDropTooltip 0.16s cubic-bezier(0.16, 1.3, 0.3, 1)',
                }}
              >
                Go to {item.label}
                <div
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 0,
                    height: 0,
                    borderLeft: '4px solid transparent',
                    borderRight: '4px solid transparent',
                    borderBottom: '4px solid rgba(15, 23, 42, 0.94)',
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
