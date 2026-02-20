'use client';

import { useEffect, useState } from 'react';
import { QrScanner } from './QrScanner';
import { useNFCe } from '../hooks/useNFCe';

function looksLikeNfceQr(text) {
  const t = (text || '').trim();
  return t.length > 10 && (
    /^https?:\/\//i.test(t) ||
    /^\d{44}$/.test(t.replace(/\D/g, '')) ||
    /^[pP]=/.test(t)
  );
}

function getDisplayDomain(url) {
  if (!url || typeof url !== 'string') return '';
  const t = url.trim();
  try {
    if (/^https?:\/\//i.test(t)) {
      return new URL(t).hostname.replace(/^www\./, '') || t.slice(0, 35);
    }
    return t.length <= 40 ? t : t.slice(0, 37) + '...';
  } catch (_) {
    return t.length <= 40 ? t : t.slice(0, 37) + '...';
  }
}

/**
 * Scanner de NFC-e: lê QR, consulta API, categoriza e salva.
 * onSuccess() é chamado ao salvar com sucesso; onClose() para cancelar.
 */
export function NFCeScanner({ userId, onSuccess, onClose }) {
  const [decodedUrl, setDecodedUrl] = useState(null);
  const { status, error, consultar, reset, isSuccess, isError } = useNFCe();

  const handleScan = async (text) => {
    const trimmed = String(text).trim();
    if (!trimmed || !looksLikeNfceQr(trimmed)) return;
    setDecodedUrl(trimmed);
    await consultar(trimmed, userId || undefined);
  };

  useEffect(() => {
    if (isSuccess && onSuccess) {
      onSuccess();
    }
  }, [isSuccess, onSuccess]);

  const handleClose = () => {
    reset();
    setDecodedUrl(null);
    onClose?.();
  };

  const statusMessage =
    status === 'consulting' ? 'Consultando nota...' :
    status === 'categorizing' ? 'Categorizando...' :
    status === 'saving' ? 'Salvando...' :
    status === 'success' ? 'Salvo!' : '';

  return (
    <div className="space-y-4 [&_.qr-shaded-region]:border-dashed [&_.qr-shaded-region]:border-[#eab308]">
      <QrScanner
        onScan={handleScan}
        onClose={handleClose}
      />
      {decodedUrl && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 py-2 px-4 rounded-full bg-[#fef08a] text-[#854d0e] text-sm font-medium border border-[#eab308]/50">
            <span className="text-[#16a34a]" aria-hidden>✓</span>
            {getDisplayDomain(decodedUrl)}
          </span>
          {statusMessage && <span className="text-sm text-gray-600">{statusMessage}</span>}
        </div>
      )}
      {isError && error && (
        <p className="text-red-600 text-sm bg-red-50 py-2 px-3 rounded-xl">{error}</p>
      )}
    </div>
  );
}
