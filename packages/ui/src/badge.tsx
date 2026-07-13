import type { HTMLAttributes } from 'react';
import { cn } from './cn.js';

export type BadgeTone = 'neutral' | 'info' | 'warn' | 'success' | 'error';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-info text-info-foreground',
  warn: 'bg-warn text-warn-foreground',
  success: 'bg-success text-success-foreground',
  error: 'bg-error text-error-foreground',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-label text-[10px] font-semibold uppercase tracking-wider',
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
