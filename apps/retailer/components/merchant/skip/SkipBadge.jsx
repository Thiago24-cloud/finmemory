import { cn } from '../../../lib/skip/cn';

export function SkipBadge({ className, children, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
