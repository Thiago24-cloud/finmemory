import Image from 'next/image';
import Link from 'next/link';

/**
 * Logotipo FinMemory – uso consistente no app.
 * @param {Object} props
 * @param {'sm'|'md'|'lg'} [props.size='md'] - sm: 32px, md: 40px, lg: 120px (landing)
 * @param {boolean} [props.href] - se definido, envolve em Link para /
 * @param {string} [props.className]
 */
export function AppLogo({ size = 'md', href, className = '' }) {
  const sizes = { sm: 32, md: 40, lg: 120 };
  const w = sizes[size] || sizes.md;

  const img = (
    <Image
      src="/logo.png"
      alt="FinMemory"
      width={w}
      height={w}
      className={`object-contain ${className}`}
      priority={size === 'lg'}
    />
  );

  if (href !== undefined && href !== false) {
    return (
      <Link href={href || '/'} className={`inline-flex shrink-0 ${className}`} aria-label="FinMemory - Início">
        {img}
      </Link>
    );
  }
  return <span className={`inline-flex shrink-0 ${className}`}>{img}</span>;
}
