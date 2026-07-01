'use client';

/**
 * Mesmo mapa do app consumidor (finmemory.com.br/mapa?from=parceiros), embutido no app Parceiros.
 */
export function ParceirosMapFrame({ mapUrl, title = 'Mapa de preços FinMemory' }) {
  if (!mapUrl) return null;

  return (
    <iframe
      src={mapUrl}
      title={title}
      className="h-full w-full flex-1 border-0 bg-[#e8e4de]"
      allow="geolocation"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}
