import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { Constellation } from '@/components/Constellation';
import { StarField } from '@/components/StarField';
import { GlassCard } from '@/components/GlassCard';

/* ─── Animation primitives ─── */
const SPRING = { type: 'spring' as const, stiffness: 380, damping: 30, mass: 0.65 };
const EASE   = [0.16, 1, 0.3, 1] as const;

/* ─── Haptics ─── */
function haptic(pattern: number | number[] = 10) {
  try { navigator.vibrate?.(pattern); } catch (_) {}
}

/* ─── iOS DeviceOrientation permission ─── */
let orientationPermissionRequested = false;
async function requestOrientationPermission() {
  if (orientationPermissionRequested) return;
  orientationPermissionRequested = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const DOE = DeviceOrientationEvent as any;
  if (typeof DOE.requestPermission === 'function') {
    try { await DOE.requestPermission(); } catch (_) {}
  }
}

const containerVariants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.028, delayChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  show:   { opacity: 1, y: 0,  scale: 1,
    transition: { type: 'spring' as const, stiffness: 240, damping: 22, mass: 0.9 } },
};

const Shell = ({ children }: { children: React.ReactNode }) => (
  <motion.div variants={containerVariants} initial="hidden" animate="show">
    {children}
  </motion.div>
);

const A = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <motion.div variants={itemVariants} style={style}>
    {children}
  </motion.div>
);

/* ─── Home ─── */
export default function Home() {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [clickOrigin,   setClickOrigin]   = useState<{ x: number; y: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const glowRef  = useRef<HTMLDivElement>(null);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const springX = useSpring(rawX, { stiffness: 60, damping: 20, mass: 0.8 });
  const springY = useSpring(rawY, { stiffness: 60, damping: 20, mass: 0.8 });

  const handleSelect = (id: string, origin?: { x: number; y: number }) => {
    if (origin) setClickOrigin(origin);
    requestOrientationPermission();
    haptic([12, 40, 6]);
    setActiveSection(prev => (prev === id ? null : id));
  };

  const closePanel = () => {
    haptic(8);
    setActiveSection(null);
  };

  const panelOriginOffset = useMemo(() => {
    if (!clickOrigin) return { x: 0, y: 0 };
    return {
      x: clickOrigin.x - window.innerWidth  / 2,
      y: clickOrigin.y - window.innerHeight / 2,
    };
  }, [clickOrigin]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setActiveSection(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Desktop: mouse drives constellation parallax (only while card is open)
  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    const onMove = (e: MouseEvent) => {
      if (!activeSection) return;
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      rawX.set(((e.clientX - cx) / cx) * 10);
      rawY.set(((e.clientY - cy) / cy) * 8);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [activeSection, rawX, rawY]);

  useEffect(() => {
    if (!activeSection) { rawX.set(0); rawY.set(0); }
  }, [activeSection, rawX, rawY]);

  // Mobile: device orientation drives constellation parallax (always active)
  useEffect(() => {
    if (!window.matchMedia('(pointer: coarse)').matches) return;
    const onOrientation = (e: DeviceOrientationEvent) => {
      const gamma = e.gamma ?? 0;
      const beta  = e.beta  ?? 0;
      rawX.set((Math.max(-35, Math.min(35, gamma)) / 35) * 15);
      rawY.set((Math.max(-35, Math.min(35, beta - 45)) / 35) * 12);
    };
    window.addEventListener('deviceorientation', onOrientation, true);
    return () => window.removeEventListener('deviceorientation', onOrientation, true);
  }, [rawX, rawY]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!panelRef.current || !glowRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    glowRef.current.style.background =
      `radial-gradient(380px circle at ${e.clientX - rect.left}px ${e.clientY - rect.top}px, rgba(255,255,255,0.04) 0%, transparent 68%)`;
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (glowRef.current) glowRef.current.style.background = 'transparent';
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: '#080808' }}>
      <StarField />

      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        style={{ zIndex: 5, x: springX, y: springY }}
      >
        <div className="w-full h-full" style={{ padding: '0.5vh 0.5vw' }}>
          <Constellation onSelect={handleSelect} activeSection={activeSection} />
        </div>
      </motion.div>

      {/* Backdrop — own AnimatePresence so it can exit independently */}
      <AnimatePresence>
        {activeSection && (
          <motion.div
            key="backdrop"
            className="fixed inset-0"
            style={{ zIndex: 15, background: 'rgba(4,4,4,0.26)', cursor: 'pointer' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.32, ease: EASE } }}
            transition={{ duration: 0.24, ease: EASE }}
            onClick={closePanel}
          />
        )}
      </AnimatePresence>

      {/* Panel — own AnimatePresence so exit plays fully before unmount */}
      <AnimatePresence>
        {activeSection && (
          <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 20, pointerEvents: 'none' }}>
            <motion.div
              key="panel"
              ref={panelRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              style={{
                width: 'min(95vw, 820px)',
                maxHeight: 'min(88vh, 680px)',
                pointerEvents: 'auto',
                position: 'relative',
                background: 'rgba(8,8,8,0.40)',
                backdropFilter: 'blur(20px) saturate(120%)',
                WebkitBackdropFilter: 'blur(20px) saturate(120%)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderTopColor: 'rgba(255,255,255,0.20)',
                borderRadius: 18,
                boxShadow: [
                  '0 0 0 1px rgba(0,0,0,0.4)',
                  '0 32px 80px rgba(0,0,0,0.58)',
                  '0 0 60px rgba(80,100,200,0.07)',
                  'inset 0 1px 0 rgba(255,255,255,0.13)',
                  'inset 1px 0 0 rgba(255,255,255,0.05)',
                  'inset -1px 0 0 rgba(255,255,255,0.03)',
                  'inset 0 -1px 0 rgba(255,255,255,0.02)',
                ].join(', '),
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                willChange: 'transform, opacity, filter',
              }}
              initial={{
                opacity: 0,
                scale: 0.05,
                x: panelOriginOffset.x,
                y: panelOriginOffset.y,
                filter: 'blur(8px)',
              }}
              animate={{
                opacity: 1, scale: 1, x: 0, y: 0, filter: 'blur(0px)',
                transition: {
                  type: 'spring', stiffness: 260, damping: 24, mass: 0.85,
                  opacity: { duration: 0.32, ease: EASE },
                  filter:  { duration: 0.30, ease: EASE },
                },
              }}
              exit={{
                opacity: 0,
                scale: 0.05,
                x: panelOriginOffset.x,
                y: panelOriginOffset.y,
                filter: 'blur(8px)',
                transition: {
                  duration: 0.38, ease: [0.4, 0, 1, 1],
                  opacity: { duration: 0.20, ease: [0.4, 0, 1, 1] },
                  filter:  { duration: 0.28 },
                },
              }}
            >
                {/* Cursor glow */}
                <div ref={glowRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, borderRadius: 18, transition: 'background 0.06s linear' }} />

                {/* Glass reflection — diagonal sheen in top-left quadrant */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '42%',
                  borderRadius: '18px 18px 0 0',
                  background: 'linear-gradient(160deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.012) 50%, transparent 100%)',
                  pointerEvents: 'none', zIndex: 0,
                }} />

                {/* Corner glow — top-left catch light */}
                <div style={{
                  position: 'absolute', top: 0, left: 0,
                  width: 120, height: 80,
                  background: 'radial-gradient(ellipse at 0% 0%, rgba(255,255,255,0.10) 0%, transparent 72%)',
                  borderRadius: '18px 0 0 0',
                  pointerEvents: 'none', zIndex: 0,
                }} />

                {/* Top edge highlight line — full width, transparent ends fade into corners */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 1,
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.38) 18%, rgba(255,255,255,0.78) 50%, rgba(255,255,255,0.38) 82%, transparent 100%)',
                  filter: 'blur(0.3px)',
                  zIndex: 2, pointerEvents: 'none',
                }} />

                {/* Left edge micro-glow — full height, transparent ends fade into corners */}
                <div style={{
                  position: 'absolute', top: 0, bottom: 0, left: 0, width: 1,
                  background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.16) 12%, rgba(255,255,255,0.07) 55%, transparent 100%)',
                  pointerEvents: 'none', zIndex: 2,
                }} />

                {/* Header — label cross-fades on section switch */}
                <div className="flex items-center justify-between px-7 pt-5 pb-4" style={{ flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.07)', position: 'relative', zIndex: 1, overflow: 'hidden' }}>
                  <div style={{ position: 'relative', height: 16, flex: 1, overflow: 'hidden' }}>
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={activeSection}
                        style={{ position: 'absolute', fontSize: '0.65rem', fontFamily: 'Menlo, monospace', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{    opacity: 0, y: -8 }}
                        transition={{ duration: 0.22, ease: EASE }}
                      >
                        {getSectionMeta(activeSection).constellation}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="hidden sm:inline" style={{ fontSize: '0.6rem', fontFamily: 'Menlo, monospace', color: 'rgba(255,255,255,0.15)', letterSpacing: '0.1em' }}>esc</span>
                    <button
                      onClick={closePanel}
                      style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', transition: 'all 0.18s ease', touchAction: 'manipulation' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.8)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)'; }}
                      data-testid="close-panel"
                    >
                      <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
                        <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Content — slides on section switch */}
                <div className="overflow-y-auto" style={{ flex: 1, scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.12) transparent', position: 'relative', zIndex: 1 }}>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeSection}
                      style={{ padding: '24px 28px 40px' }}
                      initial={{ opacity: 0, x: 18, filter: 'blur(5px)' }}
                      animate={{ opacity: 1, x: 0,  filter: 'blur(0px)' }}
                      exit={{   opacity: 0, x: -14, filter: 'blur(5px)' }}
                      transition={{ type: 'spring', stiffness: 340, damping: 28, mass: 0.6, opacity: { duration: 0.16 }, filter: { duration: 0.2 } }}
                    >
                      {activeSection === 'name'    && <NameSection />}
                      {activeSection === 'about'   && <AboutSection />}
                      {activeSection === 'photo'   && <PhotoSection />}
                      {activeSection === 'dev'     && <DevSection onNavigate={setActiveSection} />}
                      {activeSection === 'cyber'   && <CyberSection />}
                      {activeSection === 'skills'  && <SkillsSection />}
                      {activeSection === 'linux'   && <LinuxSection />}
                      {activeSection === 'flow'    && <FlowSection />}
                      {activeSection === 'contact' && <ContactSection />}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
    </div>
  );
}

/* ─── Helpers ─── */
function getSectionMeta(id: string | null) {
  const map: Record<string, { constellation: string }> = {
    name:    { constellation: 'α Aquilae · Om Akabri' },
    about:   { constellation: 'α Aquilae · About' },
    photo:   { constellation: 'γ Aquilae · Photography' },
    dev:     { constellation: 'β Aquilae · Projects' },
    cyber:   { constellation: 'η Aquilae · Cybersecurity' },
    skills:  { constellation: 'θ Aquilae · Skills & Tools' },
    linux:   { constellation: 'δ Aquilae · Linux & Ricing' },
    flow:    { constellation: 'ζ Aquilae · Flow' },
    contact: { constellation: 'λ Aquilae · Contact' },
  };
  return id ? (map[id] ?? { constellation: '' }) : { constellation: '' };
}

const H = ({ title, sub }: { title: string; sub: string }) => (
  <div style={{ marginBottom: 24 }}>
    <h2 style={{ fontSize: '1.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.02em', marginBottom: 6, fontFamily: "'Space Grotesk', sans-serif" }}>
      {title}
    </h2>
    <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.42)', fontWeight: 300, lineHeight: 1.6 }}>{sub}</p>
  </div>
);

const Tag = ({ label, color }: { label: string; color?: string }) => (
  <span
    style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 99, background: color ? `${color}12` : 'rgba(255,255,255,0.06)', border: `1px solid ${color ? `${color}25` : 'rgba(255,255,255,0.1)'}`, fontSize: '0.7rem', fontFamily: 'Menlo, monospace', color: color ? `${color}cc` : 'rgba(255,255,255,0.55)', marginRight: 6, marginBottom: 6, transition: 'color 0.18s ease, text-shadow 0.18s ease', cursor: 'default', userSelect: 'none' }}
    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = color ?? 'rgba(255,255,255,0.82)'; el.style.textShadow = color ? `0 0 8px ${color}80` : '0 0 8px rgba(255,255,255,0.4)'; }}
    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = color ? `${color}cc` : 'rgba(255,255,255,0.55)'; el.style.textShadow = 'none'; }}
  >{label}</span>
);

const StatusTag = ({ status }: { status: string }) => {
  const colors: Record<string, string> = { Released: '#7dd896', Personal: '#7eb8f7', Ongoing: '#f7c97e', Planning: '#c07ef7' };
  const c = colors[status] ?? '#aaa';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, background: `${c}15`, border: `1px solid ${c}35`, fontSize: '0.65rem', fontFamily: 'Menlo, monospace', color: c, transition: 'all 0.22s ease', cursor: 'default' }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = `${c}28`; el.style.borderColor = `${c}65`; el.style.boxShadow = `0 0 12px ${c}35`; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = `${c}15`; el.style.borderColor = `${c}35`; el.style.boxShadow = 'none'; }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: c, display: 'inline-block' }} />
      {status}
    </span>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
    <span style={{ fontSize: '0.7rem', fontFamily: 'Menlo, monospace', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.12em', width: 80, flexShrink: 0, paddingTop: 2 }}>{label}</span>
    <span style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.68)', fontWeight: 300 }}>{value}</span>
  </div>
);

const Divider = () => <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '20px 0' }} />;

const GlassGitHubIcon = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24"
    style={{ filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.22)) drop-shadow(0 0 2px rgba(255,255,255,0.12))', transition: 'filter 0.2s ease' }}
    onMouseEnter={e => { (e.currentTarget as SVGElement).style.filter = 'drop-shadow(0 0 10px rgba(255,255,255,0.45)) drop-shadow(0 0 4px rgba(255,255,255,0.2))'; }}
    onMouseLeave={e => { (e.currentTarget as SVGElement).style.filter = 'drop-shadow(0 0 6px rgba(255,255,255,0.22)) drop-shadow(0 0 2px rgba(255,255,255,0.12))'; }}
  >
    <defs>
      <linearGradient id="glass-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
        <stop offset="100%" stopColor="rgba(255,255,255,0.2)" />
      </linearGradient>
    </defs>
    <path fill="url(#glass-fill)" d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
  </svg>
);

/* ─── Sections ─── */

const NameSection = () => (
  <Shell>
    <A><H title="Om Akabri" sub="α Aquilae — the brightest star in Aquila." /></A>
    <A>
      <p style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.58)', fontWeight: 300, lineHeight: 1.9, marginBottom: 24 }}>
        First-year student building at the intersection of AI, security, and things that look good.
        I learn by doing — home labs, shipped apps, midnight Linux ricing sessions.
      </p>
    </A>
    <A><Divider /></A>
    <A><Row label="Focus" value="AI / ML & Cybersecurity" /></A>
    <A><Row label="Year" value="First Year" /></A>
    <A><Row label="Also into" value="Photography · Vibe coding · Linux ricing" /></A>
    <A><Divider /></A>
    <A>
      <div>
        {['AI / ML', 'Cybersecurity', 'Photography', 'Linux Ricing', 'Vibe Coding'].map(t => <Tag key={t} label={t} color="#6fa3f7" />)}
      </div>
    </A>
  </Shell>
);

const AboutSection = () => (
  <Shell>
    <A><H title="Om Akabri" sub="First-year student. Building at the intersection of AI, security, and things that look good." /></A>
    <A><Row label="Track" value="AI / ML & Cybersecurity" /></A>
    <A><Row label="Year" value="First Year" /></A>
    <A><Row label="Based" value="India" /></A>
    <A><Divider /></A>
    <A>
      <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.5)', fontWeight: 300, lineHeight: 1.8 }}>
        I learn by doing — nmap scans on the home lab, shipping mobile apps, ricing Linux desktops at midnight.
        If it's hands-on and slightly obsessive, I'm into it. Currently deepening Python, exploring ML fundamentals,
        and building things that didn't exist before.
      </p>
    </A>
    <A><Divider /></A>
    <A>
      <div>
        {['Photography', 'Vibe Coding', 'Linux Ricing', 'Network Recon', 'Machine Learning', 'Mobile Apps'].map(t => <Tag key={t} label={t} color="#b09bf7" />)}
      </div>
    </A>
  </Shell>
);

const PHOTOS = [
  { src: '/photos/light-trails.jpg',  label: 'Light Trails',     sub: 'Long exposure · Highway',      span: 2, ratio: '3/2'  },
  { src: '/photos/dome.jpg',          label: 'The Dome',          sub: 'Architecture · Mumbai',         span: 1, ratio: '1/1'  },
  { src: '/photos/flowers.jpg',       label: 'Bloom',             sub: 'Nature · Close-up',             span: 1, ratio: '4/3'  },
  { src: '/photos/starry-night.jpg',  label: 'Starry Night',      sub: 'Astrophotography · Night',      span: 1, ratio: '4/3'  },
  { src: '/photos/city-sunset.jpg',   label: 'City at Dusk',      sub: 'Urban · Golden Hour',           span: 1, ratio: '4/3'  },
  { src: '/photos/mumbai-night.jpg',  label: 'Mumbai Waterfront',  sub: 'Street · Night · Panoramic',   span: 3, ratio: '16/5' },
];

const PhotoSection = () => {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const open  = (i: number) => setLightboxIdx(i);
  const close = ()          => setLightboxIdx(null);
  const prev  = (e: React.MouseEvent) => { e.stopPropagation(); setLightboxIdx(i => i === null ? null : (i - 1 + PHOTOS.length) % PHOTOS.length); };
  const next  = (e: React.MouseEvent) => { e.stopPropagation(); setLightboxIdx(i => i === null ? null : (i + 1) % PHOTOS.length); };

  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  setLightboxIdx(i => i === null ? null : (i - 1 + PHOTOS.length) % PHOTOS.length);
      if (e.key === 'ArrowRight') setLightboxIdx(i => i === null ? null : (i + 1) % PHOTOS.length);
      if (e.key === 'Escape')     close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIdx]);

  const current = lightboxIdx !== null ? PHOTOS[lightboxIdx] : null;

  return (
    <>
      <Shell>
        <A><H title="Photography" sub="Capturing geometry, light, and the in-between moments. Night skies, city edges, and close details." /></A>
        <A>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 4 }}>
            {PHOTOS.map((photo, i) => (
              <div key={i} style={{ gridColumn: `span ${photo.span}` }}>
                <div
                  onClick={() => open(i)}
                  style={{ position: 'relative', aspectRatio: photo.ratio, borderRadius: 10, overflow: 'hidden', cursor: 'zoom-in', border: '1px solid rgba(255,255,255,0.07)' }}
                  className="group"
                >
                  <img
                    src={photo.src}
                    alt={photo.label}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', display: 'block', background: '#0a0a0a', transition: 'transform 0.55s cubic-bezier(0.16,1,0.3,1)', willChange: 'transform' }}
                    className="group-hover:scale-105"
                  />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.62) 0%, transparent 55%)', opacity: 0, transition: 'opacity 0.28s ease' }} className="group-hover:opacity-100" />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 10px', opacity: 0, transition: 'opacity 0.28s ease', transform: 'translateY(4px)', transition2: 'transform 0.28s ease' } as React.CSSProperties} className="group-hover:opacity-100">
                    <div style={{ fontSize: '0.72rem', fontWeight: 500, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.01em', lineHeight: 1.3 }}>{photo.label}</div>
                    <div style={{ fontSize: '0.6rem', fontFamily: 'Menlo, monospace', color: 'rgba(255,255,255,0.45)', marginTop: 2, letterSpacing: '0.08em' }}>{photo.sub}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </A>
        <A>
          <p style={{ marginTop: 10, fontSize: '0.68rem', color: 'rgba(255,255,255,0.18)', fontFamily: 'Menlo, monospace', letterSpacing: '0.06em' }}>click any photo to expand · ← → to navigate</p>
        </A>
      </Shell>

      {createPortal(
        <AnimatePresence>
          {current && (
            <motion.div
              key="lightbox"
              onClick={close}
              style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)', cursor: 'zoom-out' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
            >
              <motion.div
                key={lightboxIdx}
                onClick={e => e.stopPropagation()}
                style={{ position: 'relative', maxWidth: '90vw', maxHeight: '88vh', cursor: 'default' }}
                initial={{ opacity: 0, scale: 0.92, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 340, damping: 28, mass: 0.7 }}
              >
                <img
                  src={current.src}
                  alt={current.label}
                  style={{ maxWidth: '90vw', maxHeight: '82vh', borderRadius: 12, display: 'block', objectFit: 'contain', boxShadow: '0 32px 80px rgba(0,0,0,0.7)' }}
                />
                <div style={{ marginTop: 14, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'rgba(255,255,255,0.82)', letterSpacing: '0.01em' }}>{current.label}</div>
                  <div style={{ fontSize: '0.65rem', fontFamily: 'Menlo, monospace', color: 'rgba(255,255,255,0.35)', marginTop: 4, letterSpacing: '0.1em' }}>{current.sub}</div>
                </div>
              </motion.div>

              {/* Nav arrows */}
              {([['prev', prev, 'left: 20px', '←'], ['next', next, 'right: 20px', '→']] as const).map(([key, handler, pos, arrow]) => (
                <button
                  key={key}
                  onClick={handler as (e: React.MouseEvent) => void}
                  style={{ position: 'fixed', top: '50%', [pos.split(':')[0]]: pos.split(': ')[1], transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.18s ease', zIndex: 101 }}
                  onMouseEnter={e => { const el = e.currentTarget; el.style.background = 'rgba(255,255,255,0.14)'; el.style.color = 'rgba(255,255,255,0.9)'; }}
                  onMouseLeave={e => { const el = e.currentTarget; el.style.background = 'rgba(255,255,255,0.07)'; el.style.color = 'rgba(255,255,255,0.6)'; }}
                >
                  {arrow}
                </button>
              ))}

              {/* Counter */}
              <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', fontSize: '0.65rem', fontFamily: 'Menlo, monospace', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.12em', zIndex: 101 }}>
                {(lightboxIdx ?? 0) + 1} / {PHOTOS.length}
              </div>

              {/* Close */}
              <button
                onClick={close}
                style={{ position: 'fixed', top: 20, right: 20, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 101 }}
              >✕</button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};

const DevSection = ({ onNavigate }: { onNavigate?: (id: string) => void }) => {
  const projects = [
    { name: 'Flow', desc: 'Mobile expense manager. Clean UI, offline-first, smart categorization. Built with React Native + Expo.', tech: ['React Native','Expo','SQLite'], color: '#6fd8d0', status: 'Released', github: 'https://github.com/omakabri', apk: true, linkTo: 'flow' },
    { name: 'Home Lab Recon Suite', desc: 'Python dashboard for nmap scans — visualizes open ports and services across the local network.', tech: ['Python','nmap','Flask'], color: '#f07878', status: 'Personal', github: null, apk: false, linkTo: null },
    { name: 'Planning Flow', desc: 'Working through classical ML algorithms in pure Python/NumPy — understanding the math before using libraries.', tech: ['Python','NumPy','Jupyter'], color: '#6fa3f7', status: 'Planning', github: null, apk: false, linkTo: null },
  ];
  return (
    <Shell>
      <A><H title="Projects" sub="Things I've actually shipped." /></A>
      {projects.map((p, i) => (
        <A key={i}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {p.name === 'Flow' && (
                  <img src="/photos/flow-icon.jpg" alt="Flow" style={{ width: 22, height: 22, borderRadius: 6, objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }} />
                )}
                <h3
                  onClick={() => p.linkTo && onNavigate?.(p.linkTo)}
                  style={{ fontSize: '1rem', fontWeight: 500, color: 'rgba(255,255,255,0.88)', cursor: p.linkTo ? 'pointer' : 'default', display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'color 0.18s ease' }}
                  onMouseEnter={e => { if (p.linkTo) (e.currentTarget as HTMLElement).style.color = '#6fd8d0'; }}
                  onMouseLeave={e => { if (p.linkTo) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.88)'; }}
                >
                  {p.name}
                  {p.linkTo && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.4, marginTop: 1 }}>
                      <path d="M2 8L8 2M8 2H4M8 2V6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </h3>
              </div>
              <StatusTag status={p.status} />
            </div>
            <p style={{ fontSize: '0.825rem', color: 'rgba(255,255,255,0.45)', fontWeight: 300, lineHeight: 1.7, marginBottom: 10 }}>{p.desc}</p>
            <div style={{ marginBottom: 8 }}>{p.tech.map(t => <Tag key={t} label={t} color={p.color} />)}</div>
            {p.apk && p.github && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <span style={{ fontSize: '0.7rem', fontFamily: 'Menlo, monospace', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em' }}>APK available on GitHub</span>
                <a href={p.github} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                  <GlassGitHubIcon size={18} />
                </a>
              </div>
            )}
            {i < 2 && <Divider />}
          </div>
        </A>
      ))}
    </Shell>
  );
};

const CyberSection = () => {
  const cats = [
    { title: 'Network Recon', items: ['nmap host discovery & port scanning', 'Service version detection', 'OS fingerprinting'] },
    { title: 'Wireless', items: ['WPA2 handshake capture', 'Aircrack-ng workflow', 'Monitor mode & packet injection'] },
    { title: 'Linux Hardening', items: ['Log monitoring & alerting', 'System audit basics'] },
    { title: 'Learning', items: ['TryHackMe (active)', 'CTF challenges', 'Working toward Security+'] },
  ];
  return (
    <Shell>
      <A><H title="Cybersecurity" sub="Home lab experiments. Learning offense to understand defense." /></A>
      {cats.map((cat, i) => (
        <A key={i}>
          <div>
            <div style={{ fontSize: '0.7rem', fontFamily: 'Menlo, monospace', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>{cat.title}</div>
            <ul style={{ marginBottom: 16 }}>
              {cat.items.map(item => (
                <li key={item} style={{ display: 'flex', gap: 8, marginBottom: 5, alignItems: 'flex-start' }}>
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.28)', flexShrink: 0, marginTop: 6 }} />
                  <span style={{ fontSize: '0.825rem', color: 'rgba(255,255,255,0.52)', fontWeight: 300 }}>{item}</span>
                </li>
              ))}
            </ul>
            {i < 3 && <Divider />}
          </div>
        </A>
      ))}
      <A>
        <p style={{ fontSize: '0.7rem', fontFamily: 'Menlo, monospace', color: 'rgba(255,255,255,0.22)', marginTop: 8 }}>
          {'>'} All experiments in isolated home lab. No unauthorized access.
        </p>
      </A>
    </Shell>
  );
};

const SkillsSection = () => {
  const cats = [
    { cat: 'Languages', color: '#6fa3f7', items: ['Python', 'Bash / Shell', 'HTML + CSS'] },
    { cat: 'Security',  color: '#f07878', items: ['nmap / Network Recon', 'Aircrack-ng', 'Linux Hardening', 'OSINT Basics'] },
    { cat: 'Dev Tools', color: '#6fd8d0', items: ['React Native / Expo', 'Git', 'VM (Virtual Machine)', 'Linux (Arch, Kali)'] },
  ];
  return (
    <Shell>
      <A><H title="Skills & Tools" sub="What I know, what I'm learning." /></A>
      {cats.map((cat, ci) => (
        <A key={ci}>
          <div>
            <div style={{ fontSize: '0.7rem', fontFamily: 'Menlo, monospace', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>{cat.cat}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: 6 }}>
              {cat.items.map(item => <Tag key={item} label={item} color={cat.color} />)}
            </div>
            {ci < 2 && <Divider />}
          </div>
        </A>
      ))}
    </Shell>
  );
};

const LinuxSection = () => (
  <Shell>
    <A><H title="Linux & Ricing" sub="Aesthetic, minimal, elegant. Arch + Hyprland — the desktop as an art form." /></A>
    <A>
      <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.45)', fontWeight: 300, lineHeight: 1.8, marginBottom: 20 }}>
        A cyberpunk-minimal Hyprland setup with sharp gaps, smooth animations, and a Catppuccin palette.
        Every pixel deliberate. Every keybind memorized. The kind of desktop you screenshot to flex on Reddit.
      </p>
    </A>
    <A>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        {[['Distro','Arch Linux'],['WM','Hyprland'],['Shell','zsh'],['Bar','Waybar'],['Theme','Catppuccin Mocha'],['VM','VirtualBox']].map(([k,v]) => (
          <Row key={k} label={k} value={v} />
        ))}
      </div>
    </A>
    <A><Divider /></A>
    <A>
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {['Arch Linux', 'Hyprland', 'Catppuccin', 'zsh', 'Waybar', 'VirtualBox'].map(t => <Tag key={t} label={t} color="#78d896" />)}
      </div>
    </A>
    <A>
      <div style={{ marginTop: 16, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', position: 'relative' }} className="group">
        <img
          src="/photos/linux-rice.png"
          alt="Hyprland desktop rice"
          style={{ width: '100%', display: 'block', objectFit: 'cover', transition: 'transform 0.55s cubic-bezier(0.16,1,0.3,1)' }}
          className="group-hover:scale-[1.02]"
        />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '18px 14px 10px', background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }}>
          <span style={{ fontSize: '0.6rem', fontFamily: 'Menlo, monospace', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em' }}>Hyprland · Arch Linux · Daily driver</span>
        </div>
      </div>
    </A>
  </Shell>
);

const FlowSection = () => (
  <Shell>
    <A>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <img src="/photos/flow-icon.jpg" alt="Flow" style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0, boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }} />
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.02em', marginBottom: 4, fontFamily: "'Space Grotesk', sans-serif" }}>Flow</h2>
          <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.42)', fontWeight: 300, lineHeight: 1.6 }}>Mobile expense manager. No account. No friction. Just tracking.</p>
        </div>
      </div>
    </A>
    <A>
      <div style={{ display: 'flex', gap: 24, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: '0.7rem', fontFamily: 'Menlo, monospace', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>What it does</div>
          {['Log expenses in under 3 taps','Auto-categorization','Monthly budget tracking','Visual spending breakdown','Offline-first — no account needed'].map(f => (
            <div key={f} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(150,210,150,0.6)', flexShrink: 0, marginTop: 6 }} />
              <span style={{ fontSize: '0.825rem', color: 'rgba(255,255,255,0.52)', fontWeight: 300 }}>{f}</span>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: '0.7rem', fontFamily: 'Menlo, monospace', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>Stack</div>
          {['React Native', 'Expo', 'SQLite (local)', 'React Navigation'].map(t => <Tag key={t} label={t} color="#6fd8d0" />)}
        </div>
      </div>
    </A>
    <A><Divider /></A>
    <A>
      {/* Screenshot strip */}
      <div style={{ overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 16, marginLeft: -4, marginRight: -4, paddingLeft: 4, paddingRight: 4 }}>
        <div style={{ display: 'flex', gap: 10, width: 'max-content', paddingBottom: 4 }}>
          {[
            { src: '/photos/flow-screens/overview.jpg',  label: 'Overview'  },
            { src: '/photos/flow-screens/expenses.jpg',  label: 'Expenses'  },
            { src: '/photos/flow-screens/analytics.jpg', label: 'Analytics' },
            { src: '/photos/flow-screens/calendar.jpg',  label: 'Calendar'  },
            { src: '/photos/flow-screens/settings.jpg',  label: 'Settings'  },
          ].map(s => (
            <div key={s.label} style={{ flexShrink: 0, textAlign: 'center' }}>
              <div style={{ width: 120, borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                <img src={s.src} alt={s.label} style={{ width: '100%', display: 'block' }} />
              </div>
              <div style={{ marginTop: 6, fontSize: '0.6rem', fontFamily: 'Menlo, monospace', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </A>
    <A><Divider /></A>
    <A>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: '0.7rem', fontFamily: 'Menlo, monospace', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em' }}>APK available on GitHub</span>
        <a href="https://github.com/omakabri" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
          <GlassGitHubIcon size={20} />
        </a>
      </div>
    </A>
  </Shell>
);

const ContactSection = () => (
  <Shell>
    <A><H title="Say Hello" sub="Open to internships, collaborations, CTF teams, and interesting conversations." /></A>
    <A>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
        {[
          { label: 'GitHub',   handle: '@omakabri',    hint: 'Code & experiments' },
          { label: 'Email',    handle: 'om@example.com', hint: 'For serious stuff' },
          { label: 'LinkedIn', handle: '/in/omakabri', hint: 'Professional' },
          { label: 'Telegram', handle: '@omakabri',    hint: 'Quickest reply' },
        ].map(l => (
          <GlassCard key={l.label} className="group cursor-pointer" style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: '0.65rem', fontFamily: 'Menlo, monospace', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>{l.label}</div>
            <div style={{ fontSize: '0.825rem', color: 'rgba(255,255,255,0.72)', fontWeight: 400, marginBottom: 2 }}>{l.handle}</div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)' }}>{l.hint}</div>
          </GlassCard>
        ))}
      </div>
    </A>
    <A><Divider /></A>
    <A>
      <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[{ id: 'name', label: 'Name', type: 'text', placeholder: 'Your name' }, { id: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' }].map(f => (
            <div key={f.id}>
              <div style={{ fontSize: '0.65rem', fontFamily: 'Menlo, monospace', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>{f.label}</div>
              <input type={f.type} placeholder={f.placeholder} data-testid={`input-${f.id}`}
                style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '6px 0', fontSize: '0.875rem', color: 'rgba(255,255,255,0.75)', outline: 'none', fontFamily: 'inherit' }} />
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: '0.65rem', fontFamily: 'Menlo, monospace', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>Message</div>
          <textarea rows={3} placeholder="What's on your mind?" data-testid="input-message"
            style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '6px 0', fontSize: '0.875rem', color: 'rgba(255,255,255,0.75)', outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" data-testid="button-submit-contact"
            style={{ padding: '8px 22px', borderRadius: 99, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.72)', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.04em' }}>
            Send
          </button>
        </div>
      </form>
    </A>
  </Shell>
);
