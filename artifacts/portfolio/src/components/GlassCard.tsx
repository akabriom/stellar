import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

export const GlassCard = ({ children, className = "", style }: { children: React.ReactNode, className?: string, style?: any }) => {
  return (
    <motion.div 
      className={`glass-panel rounded-2xl overflow-hidden relative group ${className}`}
      style={style}
    >
      {/* Subtle top glare */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
      {/* Subtle inner glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />
      {children}
    </motion.div>
  );
};

export const ParallaxWrapper = ({ 
  children, 
  offset = 50,
  speed = 1,
  className = ""
}: { 
  children: React.ReactNode, 
  offset?: number,
  speed?: number,
  className?: string
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], [offset * speed, -offset * speed]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);

  return (
    <motion.div ref={ref} style={{ y, opacity }} className={className}>
      {children}
    </motion.div>
  );
};
