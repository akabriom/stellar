import { useEffect, useRef } from 'react';

interface Star {
  x: number; y: number; r: number;
  opacity: number; twinkleSpeed: number; twinkleOffset: number;
}

interface ShootingStar {
  x: number; y: number;
  dx: number; dy: number;
  len: number; speed: number;
  progress: number;
  opacity: number;
}

// Lerped parallax offset — smoothed in the draw loop
const PAD = 30; // extra star generation padding beyond canvas edges

export const StarField = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const shootingRef = useRef<ShootingStar | null>(null);
  const nextShootRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const targetOffset = useRef({ x: 0, y: 0 });
  const currentOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scheduleNext = () => {
      nextShootRef.current = Date.now() + 10000 + Math.random() * 5000;
    };
    scheduleNext();

    const spawnShooting = () => {
      const side = Math.random();
      let sx: number, sy: number;
      if (side < 0.5) {
        sx = Math.random() * canvas.width * 0.6;
        sy = Math.random() * canvas.height * 0.4;
      } else {
        sx = canvas.width * 0.1 + Math.random() * canvas.width * 0.5;
        sy = Math.random() * canvas.height * 0.3;
      }
      const angle = (Math.PI / 5) + Math.random() * (Math.PI / 8);
      const speed = 320 + Math.random() * 180;
      const len = 80 + Math.random() * 70;
      shootingRef.current = {
        x: sx, y: sy,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        len, speed,
        progress: 0,
        opacity: 0.55 + Math.random() * 0.3,
      };
    };

    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;

    const handleMouseMove = (e: MouseEvent) => {
      if (isTouchDevice) return;
      const cx = window.innerWidth  / 2;
      const cy = window.innerHeight / 2;
      targetOffset.current.x = ((e.clientX - cx) / cx) * 18;
      targetOffset.current.y = ((e.clientY - cy) / cy) * 12;
    };

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (!isTouchDevice) return;
      const gamma = e.gamma ?? 0; // left/right tilt: –90 to +90
      const beta  = e.beta  ?? 0; // fwd/back tilt:  –180 to +180
      // Clamp to ±35° then map to pixel offset
      targetOffset.current.x = (Math.max(-35, Math.min(35, gamma)) / 35) * 36;
      targetOffset.current.y = (Math.max(-35, Math.min(35, beta - 45)) / 35) * 26;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('deviceorientation', handleOrientation, true);

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      // generate stars with PAD buffer so parallax edges stay filled
      const density = isTouchDevice ? 5500 : 3200;
      const count = Math.floor(((canvas.width + PAD * 2) * (canvas.height + PAD * 2)) / density);
      starsRef.current = Array.from({ length: count }, () => ({
        x: -PAD + Math.random() * (canvas.width  + PAD * 2),
        y: -PAD + Math.random() * (canvas.height + PAD * 2),
        r: Math.random() < 0.82 ? Math.random() * 0.7 + 0.15 : Math.random() * 1.2 + 0.7,
        opacity: Math.random() * 0.45 + 0.08,
        twinkleSpeed: Math.random() * 0.007 + 0.002,
        twinkleOffset: Math.random() * Math.PI * 2,
      }));
    };

    let lastTime = 0;
    const draw = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      // Smooth lerp toward target offset
      const lerpFactor = 1 - Math.pow(0.04, dt);
      currentOffset.current.x += (targetOffset.current.x - currentOffset.current.x) * lerpFactor;
      currentOffset.current.y += (targetOffset.current.y - currentOffset.current.y) * lerpFactor;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Apply parallax translate to stars only
      ctx.save();
      ctx.translate(currentOffset.current.x, currentOffset.current.y);

      for (const star of starsRef.current) {
        const tw = Math.sin(time * 0.001 * star.twinkleSpeed * 1000 + star.twinkleOffset);
        const alpha = Math.max(0.04, Math.min(0.65, star.opacity + tw * 0.1));
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245,245,248,${alpha})`;
        ctx.fill();
      }

      ctx.restore();

      if (Date.now() > nextShootRef.current && !shootingRef.current) {
        spawnShooting();
        scheduleNext();
      }

      const ss = shootingRef.current;
      if (ss) {
        ss.progress += dt * (ss.speed / 600);
        if (ss.progress >= 1) {
          shootingRef.current = null;
        } else {
          const headX = ss.x + ss.dx * ss.progress;
          const headY = ss.y + ss.dy * ss.progress;
          const tailFrac = Math.max(0, ss.progress - ss.len / 600);
          const tailX = ss.x + ss.dx * tailFrac;
          const tailY = ss.y + ss.dy * tailFrac;

          const fade = ss.progress < 0.15
            ? ss.progress / 0.15
            : ss.progress > 0.8
            ? (1 - ss.progress) / 0.2
            : 1;

          const grad = ctx.createLinearGradient(tailX, tailY, headX, headY);
          grad.addColorStop(0, `rgba(245,245,248,0)`);
          grad.addColorStop(0.6, `rgba(245,245,248,${(ss.opacity * fade * 0.4).toFixed(3)})`);
          grad.addColorStop(1, `rgba(245,245,248,${(ss.opacity * fade).toFixed(3)})`);

          ctx.beginPath();
          ctx.strokeStyle = grad;
          ctx.lineWidth = 0.9;
          ctx.lineCap = 'round';
          ctx.moveTo(tailX, tailY);
          ctx.lineTo(headX, headY);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(headX, headY, 0.9, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${(ss.opacity * fade * 0.9).toFixed(3)})`;
          ctx.fill();
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('deviceorientation', handleOrientation, true);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
};
