import { useId } from 'react';

import { cn } from '@/utils/cn';

export function LogoMark({ className }) {
  const gradientId = useId();
  return (
    <svg viewBox="0 0 32 32" fill="none" className={cn('size-8', className)} aria-hidden="true">
      <defs>
        <linearGradient
          id={gradientId}
          x1="0"
          y1="0"
          x2="32"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#6366f1" />
          <stop offset="1" stopColor="#14b8a6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${gradientId})`} />
      <path
        d="M10 8.5v15h12"
        stroke="#fff"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="21.5" cy="10.5" r="2.6" fill="#fff" />
    </svg>
  );
}

export function Logo({ className, markClassName, inverted = false }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className={markClassName} />
      <span
        className={cn(
          'font-display text-lg font-extrabold tracking-tight',
          inverted ? 'text-white' : 'text-foreground'
        )}
      >
        LEEN<span className={inverted ? 'text-white/70' : 'text-gradient'}> AI</span>
      </span>
    </span>
  );
}
