import { cn } from '../../../lib/skip/cn';

export function SkipCard({ className, children, ...props }) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card text-card-foreground shadow-sm',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SkipCardContent({ className, children, ...props }) {
  return (
    <div className={cn('p-4 sm:p-6', className)} {...props}>
      {children}
    </div>
  );
}
