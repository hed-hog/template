'use client';

import type { CSSProperties } from 'react';

interface BorderBeamProps {
  duration?: number;
  rx?: number;
  color?: string;
}

export function BorderBeam({
  duration = 2.5,
  rx = 12,
  color = 'color-mix(in oklch, var(--primary) 55%, oklch(0.75 0.2 265) 45%)',
}: BorderBeamProps) {
  const gradient = `conic-gradient(from var(--beam-angle), transparent 0deg, ${color} 60deg, transparent 120deg, transparent 210deg, ${color} 240deg, transparent 300deg, transparent 360deg)`;
  const mask = 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)';
  const anim = `beam-spin ${duration}s linear infinite`;

  return (
    <>
      {/* diffuse glow */}
      <div
        aria-hidden
        style={
          {
            position: 'absolute',
            inset: -6,
            borderRadius: rx + 6,
            padding: 6,
            background: gradient,
            WebkitMask: mask,
            mask,
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            animation: anim,
            filter: 'blur(8px)',
            opacity: 0.5,
            pointerEvents: 'none',
          } as CSSProperties
        }
      />
      {/* sharp beam */}
      <div
        aria-hidden
        style={
          {
            position: 'absolute',
            inset: -1.5,
            borderRadius: rx + 1.5,
            padding: 1.5,
            background: gradient,
            WebkitMask: mask,
            mask,
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            animation: anim,
            pointerEvents: 'none',
          } as CSSProperties
        }
      />
    </>
  );
}
