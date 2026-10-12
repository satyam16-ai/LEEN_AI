import { cn } from '@/utils/cn';

const PALETTE = [
  'bg-primary-soft text-primary-soft-foreground',
  'bg-accent-soft text-accent-soft-foreground',
  'bg-success-soft text-success',
  'bg-warning-soft text-foreground',
];

const SIZES = { sm: 'size-8 text-xs', md: 'size-9 text-sm', lg: 'size-12 text-base' };

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function paletteFor(name = '') {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function Avatar({ name, size = 'md', className }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        SIZES[size],
        paletteFor(name),
        className
      )}
    >
      {initials(name)}
    </span>
  );
}
