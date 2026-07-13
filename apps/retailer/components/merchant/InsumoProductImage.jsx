'use client';

import {
  Beer,
  Bean,
  Croissant,
  CupSoda,
  Droplets,
  Milk,
  Package,
  SprayCan,
  Sparkles,
  Wheat,
} from 'lucide-react';
import { getCategoryLabel } from '../../lib/merchant/insumos/productCategories';

const ICONS = {
  cerveja: Beer,
  refrigerante: CupSoda,
  agua: Droplets,
  leite: Milk,
  arroz: Wheat,
  feijao: Bean,
  pao: Croissant,
  limpeza: SprayCan,
  higiene: Sparkles,
  generico: Package,
};

const COLORS = {
  cerveja: 'text-amber-600 bg-amber-50',
  refrigerante: 'text-red-600 bg-red-50',
  agua: 'text-sky-600 bg-sky-50',
  leite: 'text-blue-600 bg-blue-50',
  arroz: 'text-yellow-700 bg-yellow-50',
  feijao: 'text-orange-700 bg-orange-50',
  pao: 'text-amber-700 bg-amber-50',
  limpeza: 'text-teal-600 bg-teal-50',
  higiene: 'text-purple-600 bg-purple-50',
  generico: 'text-slate-600 bg-slate-100',
};

function resolveImageUrl(insumo) {
  const url = insumo?.imagem_url || insumo?.image_url;
  const source = String(insumo?.imagem_source || '').toLowerCase();

  if (url && source !== 'generic') return url;
  if (url && !source) return url;
  return null;
}

/**
 * Foto do insumo: URL real (Cosmos / Open Food Facts / custom) ou ícone por categoria.
 */
export function InsumoProductImage({
  insumo,
  className = 'h-full w-full',
  iconClassName = 'h-7 w-7',
  roundedClassName = 'rounded-xl',
}) {
  const remoteUrl = resolveImageUrl(insumo);
  const category = insumo?.categoria || 'generico';
  const Icon = ICONS[category] || ICONS.generico;
  const colorClass = COLORS[category] || COLORS.generico;

  if (remoteUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={remoteUrl}
        alt={insumo?.nome || 'Produto'}
        className={`object-contain ${className}`}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center ${roundedClassName} ${colorClass} ${className}`}
      title={getCategoryLabel(category)}
      aria-hidden
    >
      <Icon className={`${iconClassName} opacity-80`} strokeWidth={1.5} />
    </div>
  );
}
