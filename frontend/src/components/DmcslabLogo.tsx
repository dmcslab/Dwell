import React from 'react';

export function DmcslabLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const scale = size === 'sm' ? 0.7 : size === 'lg' ? 1.4 : 1;
  const h = Math.round(36 * scale);
  const tagSize = Math.round(9 * scale);

  return (
    <div className="flex items-center gap-2.5 select-none">
      {/* Hex shield icon */}
      <svg width={Math.round(32 * scale)} height={Math.round(36 * scale)} viewBox="0 0 32 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="ig" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="rgb(var(--g900))"/>
            <stop offset="100%" stop-color="rgb(var(--accent))"/>
          </linearGradient>
          <radialGradient id="bgr" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stop-color="rgb(var(--background-start))"/>
            <stop offset="100%" stop-color="rgb(var(--background-end))"/>
          </radialGradient>
        </defs>

        {/* Hex background */}
        <polygon points="481.0,256.0 368.5,450.9 143.5,450.9 31.0,256.0 143.5,61.1 368.5,61.1" fill="url(#bgr)" 
          stroke="url(#ig)" stroke-width="12.8" stroke-linejoin="round" />
        {/* Inner hex glow ring (subtle) */}
        <polygon points="481.0,256.0 368.5,450.9 143.5,450.9 31.0,256.0 143.5,61.1 368.5,61.1" fill="none" 
          stroke="rgb(var(--g900))" stroke-width="4.1" stroke-linejoin="round" opacity="0.25"
          transform="scale(0.85) translate(38 38)"/>

        {/* d letterform */}
        <rect x="199.7" y="148.5" width="25.6" height="215.0" 
          rx="12.8" fill="url(#ig)"/>
        <path d="M225.3 148.5 Q348.2 148.5 348.2 256.0 Q348.2 363.5 225.3 363.5" 
          fill="none" stroke="url(#ig)" stroke-width="25.6" stroke-linecap="round"/>
      </svg>

      {/* Wordmark */}
      <div style={{ lineHeight: 1 }}>
        <div className="flex items-baseline gap-0.5" style={{ fontSize: `${Math.round(18 * scale)}px` }}>
          <span className="font-ui font-semibold" style={{ color: 'rgb(var(--accent))' }}>d</span>
          <span className="font-display font-bold text-white" style={{ letterSpacing: '-0.02em' }}>MCS</span>
          <span className="font-ui font-light" style={{ color: 'rgb(var(--g500))', fontSize: `${Math.round(14 * scale)}px` }}>lab</span>
        </div>
        {size !== 'sm' && (
          <div className="font-mono text-[11px] mt-0.5" style={{ color: 'rgb(var(--g600))', letterSpacing: '0.18em', fontSize: `${tagSize}px` }}>
            CYBER SECURITY LAB
          </div>
        )}
      </div>
    </div>
  );
}