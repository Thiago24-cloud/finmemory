'use client';

import { useEffect, useState } from 'react';
import { QrScanner } from './QrScanner';
import { useNFCe } from '../hooks/useNFCe';

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
  const [lastQrDebug, setLastQrDebug] = useState(null);
  const [pasteValue, setPasteValue] = useState('');
  const { status, error, notice, consultar, reset, isSuccess, isError, isConsulting } = useNFCe();

  const shouldAcceptScan = (trimmed) => {
    if (!trimmed) return false;
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length === 44) return true;
    if (/^https?:\/\//i.test(trimmed)) return true;
    if (/consultaqrcode|nfce|sefaz|fazenda\.gov/i.test(trimmed)) return true;
    if (/^[pP]=/.test(trimmed)) return true;
    return trimmed.length >= 12;
  };

  const handleScan = async (text) => {
    const trimmed = String(text).trim();
    setLastQrDebug(trimmed || '(vazio)');
    if (!shouldAcceptScan(trimmed)) return;
    setDecodedUrl(trimmed);
    await consultar(trimmed, userId || undefined);
  };

  const handleManualConsult = async () => {
    const trimmed = pasteValue.trim();
    if (!trimmed) return;
    setLastQrDebug(trimmed.length > 120 ? `${trimmed.slice(0, 120)}…` : trimmed);
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
    setLastQrDebug(null);
    setPasteValue('');
    onClose?.();
  };

  const statusMessage =
    status === 'consulting' ? 'Consultando nota...' :
    status === 'categorizing' ? 'Categorizando...' :
    status === 'saving' ? 'Salvando...' :
    status === 'success' ? 'Salvo!' : '';

  return (
    <div className="space-y-4">
      <QrScanner
        onScan={handleScan}
        onClose={handleClose}
      />
      <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-3 space-y-2">
        <p className="text-sm text-gray-700 font-medium">Não leu? Cole o link da nota ou a chave (44 dígitos)</p>
        <textarea
          value={pasteValue}
          onChange={(e) => setPasteValue(e.target.value)}
          rows={3}
          placeholder="https://… ou só os 44 números da chave"
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 resize-y min-h-[4.5rem]"
          disabled={isConsulting}
        />
        <button
          type="button"
          onClick={handleManualConsult}
          disabled={isConsulting || !pasteValue.trim()}
          className="w-full py-2.5 px-4 rounded-xl font-medium text-white bg-[#16a34a] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isConsulting ? 'Consultando…' : 'Consultar'}
        </button>
      </div>
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
      {!isError && notice && (
        <p className="text-amber-700 text-sm bg-amber-50 py-2 px-3 rounded-xl">{notice}</p>
      )}
      <p className="text-xs text-gray-500 font-mono break-all" aria-live="polite">
        {lastQrDebug != null ? `Debug: QR lido: ${lastQrDebug.length > 80 ? lastQrDebug.slice(0, 80) + '…' : lastQrDebug}` : 'Debug: aguardando leitura...'}
      </p>
    </div>
  );
}
