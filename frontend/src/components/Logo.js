import React from 'react';

/**
 * Phillip Capital Invest logo - premium finance brand mark
 * Dark navy blue body with a gold accent pillar + wordmark.
 * Adapts to light/dark backgrounds via `variant`.
 */
export function Logo({
  variant = 'dark',          // 'dark' (for light bg) | 'light' (for dark bg)
  showWordmark = true,
  size = 40,                 // icon height in px
  className = '',
  wordmarkClassName = '',
  testId = 'brand-logo'
}) {
  const navy = '#0B1E3F';
  const gold = '#C9A24B';
  const white = '#FFFFFF';

  const markBg = variant === 'light' ? white : navy;
  const markFg = variant === 'light' ? navy : white;

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`} data-testid={testId}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Phillip Capital Invest"
        role="img"
      >
        <rect width="64" height="64" rx="10" fill={markBg} />
        {/* Columns forming a stylised "P" + pillar */}
        <rect x="14" y="14" width="7" height="36" fill={markFg} />
        <path
          d="M21 14 H36 a10 10 0 0 1 0 20 H21 Z"
          fill={markFg}
        />
        {/* Gold accent pillar */}
        <rect x="43" y="20" width="5" height="30" fill={gold} />
        <rect x="41" y="18" width="9" height="3" fill={gold} />
        <rect x="41" y="49" width="9" height="3" fill={gold} />
      </svg>
      {showWordmark && (
        <span className={`flex flex-col leading-tight ${wordmarkClassName}`}>
          <span
            className="font-heading font-semibold tracking-tight"
            style={{
              color: variant === 'light' ? white : navy,
              fontSize: size >= 40 ? '1.05rem' : '0.95rem',
              letterSpacing: '0.01em'
            }}
          >
            Phillip Capital
          </span>
          <span
            className="font-medium uppercase"
            style={{
              color: gold,
              fontSize: size >= 40 ? '0.68rem' : '0.6rem',
              letterSpacing: '0.22em'
            }}
          >
            Invest
          </span>
        </span>
      )}
    </span>
  );
}

export default Logo;
