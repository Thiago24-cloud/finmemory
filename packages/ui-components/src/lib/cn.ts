import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge class names (Tailwind-style). */
export function cn(...classes: ClassValue[]): string {
  return twMerge(clsx(classes));
}
