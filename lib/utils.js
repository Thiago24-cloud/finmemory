import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names (Tailwind-style). Pass strings; falsy values are ignored.
 * @param {...(string|undefined|null|false)} classes
 * @returns {string}
 */
export function cn(...classes) {
  return twMerge(clsx(classes));
}
