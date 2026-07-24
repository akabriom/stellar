import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const VB_W = 160;
const VB_H = 90;

const NODES = [
  { id: 'name',    x: 80,  y: 6.5, r: 1.7,  label: 'Om Akabri',       starName: 'α Aql'    },
  { id: 'about',   x: 84,  y: 18,  r: 1.1,  label: 'About',           starName: 'λ Aql'    },
  { id: 'dev',     x: 88,  y: 35,  r: 1.1,  label: 'Projects',        starName: 'Alshain'  },
  { id: 'flow',    x: 80,  y: 40,  r: 1.2,  label: 'Flow',            starName: 'Altair'   },
  { id: 'skills',  x: 70,  y: 46,  r: 1.0,  label: 'Skills',          starName: 'Tarazed'  },
  { id: 'cyber',   x: 100, y: 50,  r: 1.0,  label: 'Cybersecurity',   starName: 'δ Aql'    },
  { id: 'linux',   x: 70,  y: 56,  r: 1.0,  label: 'Linux',           starName: 'θ Aql'    },
  { id: 'photo',   x: 114, y: 62,  r: 0.9,  label: 'Photography',     starName: 'ζ Aql'    },
  { id: 'contact', x: 56,  y: 70,  r: 1.0,  label: 'Contact',         starName: 'η Aql'    },
];

const LINES: [string, string][] = [
  ['name',    'about'],
  ['flow',    'about'],
  ['flow',    'dev'],
  ['flow',    'skills'],
  ['skills',  'linux'],
  ['linux',   'contact'],
  ['dev',     'cyber'],
  ['cyber',   'photo'],
  ['linux',   'cyber'],
];

const getNode   = (id: string) => NODES.find(n => n.id === id)!;
const linesFor  = (id: string) => LINES.filter(([a, b]) => a === id || b === id);

/*
  Subtle traveling glow ripple — a narrow band of soft light that flows
  along a constellation path. Thin, quiet, like starlight moving.
*/
const GlowRipple = ({
  x1, y1, x2, y2, uid, peakOpacity = 0.38,
}: {
  x1: number; y1: number; x2: number; y2: number;
  uid: string; peakOpacity?: number;
}) => {
  const dur  = '0.52s';
  const ease = '0;0;0.42;1';
  const halo = peakOpacity * 0.38;

  return (
    <>
      <defs>
        <filter id={`${uid}-f`} x="-600%" y="-600%" width="1300%" height="1300%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.32" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id={uid} gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2} y2={y2}>
          <stop offset="-0.22" stopColor="white" stopOpacity="0">
            <animate attributeName="offset" from="-0.22" to="0.78" dur={dur} begin="0s" fill="freeze"
              calcMode="spline" keyTimes="0;1" keySplines={ease} />
          </stop>
          <stop offset="-0.11" stopColor="white" stopOpacity={halo}>
            <animate attributeName="offset" from="-0.11" to="0.89" dur={dur} begin="0s" fill="freeze"
              calcMode="spline" keyTimes="0;1" keySplines={ease} />
          </stop>
          <stop offset="0" stopColor="white" stopOpacity={peakOpacity}>
            <animate attributeName="offset" from="0" to="1.0" dur={dur} begin="0s" fill="freeze"
              calcMode="spline" keyTimes="0;1" keySplines={ease} />
          </stop>
          <stop offset="0.11" stopColor="white" stopOpacity={halo}>
            <animate attributeName="offset" from="0.11" to="1.11" dur={dur} begin="0s" fill="freeze"
              calcMode="spline" keyTimes="0;1" keySplines={ease} />
          </stop>
          <stop offset="0.22" stopColor="white" stopOpacity="0">
            <animate attributeName="offset" from="0.22" to="1.22" dur={dur} begin="0s" fill="freeze"
              calcMode="spline" keyTimes="0;1" keySplines={ease} />
          </stop>
        </linearGradient>
      </defs>
      <motion.line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={`url(#${uid})`}
        strokeWidth={0.42}
        strokeLinecap="round"
        filter={`url(#${uid}-f)`}
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ delay: 0.48, duration: 0.25, ease: 'easeOut' }}
        style={{ pointerEvents: 'none' }}
      />
    </>
  );
};

export const Constellation = ({
  onSelect,
  activeSection,
}: {
  onSelect: (id: string, origin: { x: number; y: number }) => void;
  activeSection: string | null;
}) => {
  const [hovered,      setHovered]      = useState<string | null>(null);
  const [hoverKey,     setHoverKey]     = useState(0);
  const [periodicKey,  setPeriodicKey]  = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Responsive viewBox: tight crop for mobile portrait, full canvas for desktop
  const [viewBox, setViewBox] = useState(`0 0 ${VB_W} ${VB_H}`);
  useEffect(() => {
    const update = () => {
      const mobile = window.innerWidth < 640;
      // Nodes span x:56–114, y:6.5–70 (+ label padding).
      // Tight portrait crop centres the constellation and fills the screen.
      setViewBox(mobile ? '40 -5 94 100' : `0 0 ${VB_W} ${VB_H}`);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    const schedule = () => {
      timerRef.current = setTimeout(() => {
        setPeriodicKey(k => k + 1);
        schedule();
      }, 11000 + Math.random() * 12000);
    };
    schedule();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const handleEnter = (id: string) => { setHovered(id); setHoverKey(k => k + 1); };
  const handleLeave = () => setHovered(null);

  const hoveredLines     = hovered ? linesFor(hovered) : [];
  const hoverRipplePaths = hovered ? linesFor(hovered) : [];
  const periodicPaths    = linesFor('name');

  return (
    <svg viewBox={viewBox} className="w-full h-full" style={{ overflow: 'visible' }}>
      <defs>
        {NODES.map(node => (
          <radialGradient key={`rg-${node.id}`} id={`rg-${node.id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="white" stopOpacity="0.22" />
            <stop offset="55%"  stopColor="white" stopOpacity="0.05" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
        ))}
        {NODES.map(node => (
          <radialGradient key={`ig-${node.id}`} id={`ig-${node.id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="white" stopOpacity="0.7" />
            <stop offset="40%"  stopColor="white" stopOpacity="0.18" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
        ))}
        {hoveredLines.map(([a, b]) => {
          const fromId = a === hovered ? a : b;
          const toId   = a === hovered ? b : a;
          const from   = getNode(fromId);
          const to     = getNode(toId);
          return (
            <linearGradient
              key={`lg-${a}-${b}`}
              id={`lg-${a}-${b}`}
              gradientUnits="userSpaceOnUse"
              x1={from.x} y1={from.y}
              x2={to.x}   y2={to.y}
            >
              <stop offset="0%"  stopColor="white" stopOpacity="0.82" />
              <stop offset="40%" stopColor="white" stopOpacity="0.22" />
              <stop offset="68%" stopColor="white" stopOpacity="0" />
            </linearGradient>
          );
        })}
      </defs>

      {/* Base constellation lines */}
      {LINES.map(([a, b], i) => {
        const n1 = getNode(a);
        const n2 = getNode(b);
        const isActive = hovered !== null && (hovered === a || hovered === b);
        const isDimmed = hovered !== null && !isActive;
        return (
          <motion.line
            key={`base-${i}`}
            x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y}
            stroke="rgba(255,255,255,1)"
            strokeLinecap="round" strokeWidth={0.18}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1, strokeOpacity: isDimmed ? 0.06 : 0.18 }}
            transition={{
              pathLength:    { duration: 2,   ease: 'easeInOut', delay: 0.8 + i * 0.12 },
              opacity:       { duration: 2,   ease: 'easeInOut', delay: 0.8 + i * 0.12 },
              strokeOpacity: { duration: 0.3, ease: [0.25, 0.1, 0.4, 1] },
            }}
            style={{ pointerEvents: 'none' }}
          />
        );
      })}

      {/* Instant soft-glow overlays on hovered lines */}
      <AnimatePresence>
        {hoveredLines.map(([a, b]) => {
          const n1 = getNode(a);
          const n2 = getNode(b);
          return (
            <motion.line
              key={`glow-${a}-${b}`}
              x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y}
              stroke={`url(#lg-${a}-${b})`}
              strokeWidth={0.55} strokeLinecap="round"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              style={{ pointerEvents: 'none' }}
            />
          );
        })}
      </AnimatePresence>

      {/* Hover ripple — subtle traveling pulse along each connected path */}
      <AnimatePresence>
        {hoverRipplePaths.map(([a, b]) => {
          const fromId = a === hovered ? a : b;
          const toId   = a === hovered ? b : a;
          const from   = getNode(fromId);
          const to     = getNode(toId);
          const uid    = `hr-${a}-${b}-${hoverKey}`;
          return (
            <GlowRipple
              key={uid} uid={uid}
              x1={from.x} y1={from.y}
              x2={to.x}   y2={to.y}
              peakOpacity={0.38}
            />
          );
        })}
      </AnimatePresence>

      {/* Periodic pulses from Om Akabri */}
      {periodicPaths.map(([a, b]) => {
        const fromId = a === 'name' ? a : b;
        const toId   = a === 'name' ? b : a;
        const from   = getNode(fromId);
        const to     = getNode(toId);
        const uid    = `pk-${a}-${b}-${periodicKey}`;
        return (
          <GlowRipple
            key={uid} uid={uid}
            x1={from.x} y1={from.y}
            x2={to.x}   y2={to.y}
            peakOpacity={0.22}
          />
        );
      })}

      {/* Stars */}
      {NODES.map((node, i) => {
        const isHov = hovered === node.id;
        const isAct = activeSection === node.id;
        const lit   = isHov || isAct;
        const haloR   = node.r * (lit ? 9 : 7);
        const innerR  = node.r * (lit ? 3.5 : 2.5);
        const coreR   = node.r * (lit ? 0.85 : 0.65);
        const spikeL  = node.r * (lit ? 9 : 7);
        const spikeOp = lit ? 0.25 : 0.12;

        return (
          <motion.g
            key={node.id}
            style={{ cursor: 'pointer', transformOrigin: `${node.x}px ${node.y}px` }}
            whileHover={{ scale: 1.04 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            onClick={(e) => {
              const svg = (e.currentTarget as SVGGElement).ownerSVGElement!;
              const pt  = svg.createSVGPoint();
              pt.x = node.x; pt.y = node.y;
              const sc  = pt.matrixTransform(svg.getScreenCTM()!);
              onSelect(node.id, { x: sc.x, y: sc.y });
            }}
            onMouseEnter={() => handleEnter(node.id)}
            onMouseLeave={handleLeave}
          >
            <circle cx={node.x} cy={node.y} r={node.r * 6} fill="transparent" />
            <motion.circle cx={node.x} cy={node.y} r={haloR}
              fill={`url(#rg-${node.id})`}
              animate={{ opacity: lit ? 1 : 0.7 }} transition={{ duration: 0.3 }}
              style={{ pointerEvents: 'none' }} />
            <motion.circle cx={node.x} cy={node.y} r={innerR}
              fill={`url(#ig-${node.id})`}
              animate={{ opacity: lit ? 1 : 0.65 }} transition={{ duration: 0.3 }}
              style={{ pointerEvents: 'none' }} />
            <line x1={node.x - spikeL} y1={node.y} x2={node.x + spikeL} y2={node.y}
              stroke="white" strokeOpacity={spikeOp} strokeWidth={0.12}
              style={{ pointerEvents: 'none' }} />
            <line x1={node.x} y1={node.y - spikeL * 0.75} x2={node.x} y2={node.y + spikeL * 0.75}
              stroke="white" strokeOpacity={spikeOp} strokeWidth={0.12}
              style={{ pointerEvents: 'none' }} />
            <motion.g
              style={{ pointerEvents: 'none', transformOrigin: `${node.x}px ${node.y}px` }}
              animate={{ scale: [1, 1.9, 1], opacity: [0.18, 0, 0.18] }}
              transition={{ duration: 3.8 + i * 0.35, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
            >
              <circle cx={node.x} cy={node.y} r={node.r * 2.8}
                fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={0.25} />
            </motion.g>
            <motion.circle cx={node.x} cy={node.y} r={coreR} fill="white"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: lit ? 1 : 0.88 }}
              transition={{ delay: 0.6 + i * 0.08, duration: 0.7, ease: 'easeOut' }}
              style={{ transformOrigin: `${node.x}px ${node.y}px`, pointerEvents: 'none' }} />
            {node.id === 'name' ? (
              <motion.text x={node.x} y={node.y + node.r + 3.6}
                textAnchor="middle" fontSize="4.4"
                fontFamily="'EB Garamond', Georgia, serif"
                fontWeight="500" letterSpacing="0.05em"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, fill: lit ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.82)' }}
                transition={{ delay: 0.6, duration: 0.8, fill: { duration: 0.2 } }}
                style={{ pointerEvents: 'none', userSelect: 'none' }}>
                Om Akabri
              </motion.text>
            ) : (
              <motion.text x={node.x} y={node.y + node.r + 4.8}
                textAnchor="middle" fontSize="2.7"
                fontFamily="'Inter', sans-serif"
                fontWeight="400" letterSpacing="0.04em"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, fill: lit ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.38)' }}
                transition={{ delay: 1 + i * 0.08, duration: 0.6, fill: { duration: 0.2 } }}
                style={{ pointerEvents: 'none', userSelect: 'none' }}>
                {node.label}
              </motion.text>
            )}
          </motion.g>
        );
      })}
    </svg>
  );
};
