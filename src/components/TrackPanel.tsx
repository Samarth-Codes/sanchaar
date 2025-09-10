import { useEffect, useRef, useState } from 'react';

type TrainDatum = {
  name: string;
  paused: boolean;
  delayMin: number;
  progress: number; // 0..1 within current segment for X mapping when needed
  fromIndex?: number;
  toIndex?: number;
  totalSegments?: number;
  waitReason?: string;
};

type Props = {
  getSimSnapshot: () => { clock: number; speed: number; states: TrainDatum[] } | null;
};

const ROWS: Record<'express'|'local'|'freight', { y: number; color: string }> = {
  express: { y: 46, color: '#2563eb' },
  local: { y: 126, color: '#16a34a' },
  freight: { y: 206, color: '#d97706' }
};

function getLane(name: string): keyof typeof ROWS {
  const lower = name.toLowerCase();
  if (lower.includes('express')) return 'express';
  if (lower.includes('local')) return 'local';
  return 'freight';
}

export default function TrackPanel({ getSimSnapshot }: Props) {
  const [frame, setFrame] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const loop = () => { setFrame(f => f + 1); rafRef.current = requestAnimationFrame(loop); };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const snap = getSimSnapshot?.() || null;
  const width = 900; // internal logical width for viewBox
  const laneWidth = width - 120; // leave margin for labels
  const height = 250; // a touch taller for better readability

  // Map sim clock to X; simple scrolling window of 60 sim minutes width
  const windowMin = 60; // 1-hour window
  const clock = snap?.clock ?? 0;
  const windowStart = Math.max(0, clock - windowMin * 0.25); // keep some left context
  const windowEnd = windowStart + windowMin;
  const xForTime = (tMin: number) => 40 + ((tMin - windowStart) / (windowEnd - windowStart)) * laneWidth;
  const xForProgress = (st: TrainDatum) => {
    // Map overall journey progress to X for a more interesting movement: (segment index + segment progress) / totalSegments
    const segCount = Math.max(1, st.totalSegments || 1);
    const idx = Math.max(0, st.fromIndex || 0);
    const overall = Math.min(1, (idx + (st.progress || 0)) / segCount);
    const t = windowStart + overall * (windowEnd - windowStart);
    return xForTime(t);
  };

  const tBob = Math.sin(frame / 18) * 2; // gentle bobbing
  const pulseScale = 1 + Math.sin(frame / 14) * 0.06; // subtle pulsing
  
  const markers = (snap?.states || []).map((st) => {
    const lane = getLane(st.name);
    const base = ROWS[lane];
    // Keep markers on their lane even when paused; add badges to indicate waiting
    const y = base.y + (st.paused ? 0 : tBob);
    const x = xForProgress(st);
    const color = base.color;
    const label = st.paused && st.waitReason ? `Waiting: ${st.waitReason} (+${Math.round(st.delayMin)}m)` : `${st.name} (+${Math.round(st.delayMin)}m)`;
    const emoji = lane === 'express' ? '🚄' : lane === 'local' ? '🚈' : '🚛';
    return { 
      x, 
      y, 
      color, 
      name: st.name, 
      label, 
      paused: st.paused, 
      emoji,
      pulseScale: st.paused ? 1 : pulseScale,
      progress: st.progress || 0
    };
  });

  return (
    <div style={{ width: '100%', height: '100%', background: '#ffffff' }}>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
        {/* Lanes */}
        {(['express','local','freight'] as const).map(key => (
          <g key={key}>
            <line x1={40} x2={width-40} y1={ROWS[key].y} y2={ROWS[key].y} stroke={ROWS[key].color} strokeWidth={3} opacity={0.15} />
            <line x1={40} x2={width-40} y1={ROWS[key].y} y2={ROWS[key].y} stroke={ROWS[key].color} strokeWidth={2} opacity={0.6} />
            <text x={10} y={ROWS[key].y+4} fill="#0f172a" fontSize={12} dominantBaseline="middle" textAnchor="start" fontWeight="700" stroke="#ffffff" strokeWidth={3} paintOrder="stroke fill">
              {key.charAt(0).toUpperCase()+key.slice(1)}
            </text>
          </g>
        ))}

        {/* Waiting lane */}
        <g>
          <rect x={35} y={222} width={width-70} height={8} fill="rgba(148,163,184,0.18)" rx={4} />
          <line x1={40} x2={width-40} y1={226} y2={226} stroke="#94a3b8" strokeDasharray="6,4" strokeWidth={2} />
          <text x={10} y={232} fill="#b91c1c" fontSize={12} dominantBaseline="middle" fontWeight="700" stroke="#ffffff" strokeWidth={3} paintOrder="stroke fill">Waiting</text>
        </g>

        {/* Time ticks */}
        {Array.from({ length: 6 }).map((_, i) => {
          const t = windowStart + (i/5) * (windowEnd - windowStart);
          const x = xForTime(t);
          return (
            <g key={`tick-${i}`}>
              <line x1={x} x2={x} y1={16} y2={height-30} stroke="#e5e7eb" strokeDasharray="4,8" />
            </g>
          );
        })}

        {/* Markers */}
        {markers.map(m => (
          <g key={m.name}>
            <text 
              x={m.x} 
              y={m.y - 10} 
              fontSize={15} 
              textAnchor="middle" 
              dominantBaseline="central"
              style={{ 
                filter: m.paused ? 'grayscale(0.5)' : 'none',
                transform: `scale(${m.pulseScale})`,
                fill: '#0f172a'
              }}
            >
              {m.emoji}
            </text>

            {!m.paused && (
              <circle 
                cx={m.x} 
                cy={m.y} 
                r={10} 
                fill={m.color} 
                opacity={0.15}
                style={{ filter: 'blur(4px)', transform: `scale(${m.pulseScale})` }}
              />
            )}

            <circle 
              cx={m.x} 
              cy={m.y} 
              r={m.paused ? 5 : 8} 
              fill={m.paused ? '#94a3b8' : m.color} 
              stroke="#ffffff" 
              strokeWidth={1.5}
              style={{ transform: `scale(${m.pulseScale})` }}
            />

            {!m.paused && (
              <circle cx={m.x} cy={m.y} r={3} fill="#ffffff" opacity={0.9} style={{ transform: `scale(${m.pulseScale})` }} />
            )}

            {m.paused && (
              <circle cx={m.x - 7} cy={m.y - 7} r={3} fill="#ef4444" stroke="#ffffff" strokeWidth={1} />
            )}

            {/* Label */}
            <text 
              x={m.x + 14} 
              y={m.y + 4} 
              fill="#0f172a" 
              fontSize={12}
              fontWeight={500}
            >
              {m.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}


