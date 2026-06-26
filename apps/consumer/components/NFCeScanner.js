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
 * Scanner de NFC-e: lê QR ou cola link, consulta SEFAZ.
 * previewMode=true → onData(dados) para revisão; senão categoriza e salva (onSuccess).
 */
export function NFCeScanner({ userId, previewMode = false, onData, onSuccess, onClose }) {
  const [decodedUrl, setDecodedUrl] = useState(null);
  const [lastQrDebug, setLastQrDebug] = useState(null);
  const [pasteValue, setPasteValue] = useState('');
  const {
    status,
    error,
    notice,
    consultar,
    consultarApenas,
    reset,
    isSuccess,
    isError,
    isConsulting,
  } = useNFCe();

  const shouldAcceptScan = (trimmed) => {
    if (!trimmed) return false;
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length >= 44) return true;
    if (/^https?:\/\//i.test(trimmed)) return true;
    if (/consultaqrcode|nfce|sefaz|fazenda\.gov/i.test(trimmed)) return true;
    if (/^[pP]=/.test(trimmed)) return true;
    return trimmed.length >= 12;
  };

  const runConsult = async (text) => {
    const trimmed = String(text).trim();
    setLastQrDebug(trimmed || '(vazio)');
    if (!shouldAcceptScan(trimmed)) return;
    setDecodedUrl(trimmed);

    if (previewMode) {
      const data = await consultarApenas(trimmed);
      if (data && onData) onData(data);
      return;
    }

    await consultar(trimmed, userId || undefined);
  };

  const handleScan = async (text) => {
    await runConsult(text);
  };

  const handleManualConsult = async () => {
    const trimmed = pasteValue.trim();
    if (!trimmed) return;
    await runConsult(trimmed);
  };

  useEffect(() => {
    if (!previewMode && isSuccess && onSuccess) {
      onSuccess();
    }
  }, [previewMode, isSuccess, onSuccess]);

  const handleClose = () => {
    reset();
    setDecodedUrl(null);
    setLastQrDebug(null);
    setPasteValue('');
    onClose?.();
  };

  const statusMessage =
    status === 'consulting' ? 'Consultando nota na SEFAZ...' :
    status === 'categorizing' ? 'Categorizando...' :
    status === 'saving' ? 'Salvando...' :
    status === 'success' ? 'Salvo!' : '';

  return (
    <div className="space-y-4">
      <QrScanner onScan={handleScan} onClose={handleClose} />
      <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-3 space-y-2">
        <p className="text-sm text-gray-700 font-medium">
          Leu o QR com a câmera do celular? Cole o link que abriu no site da Fazenda
        </p>
        <textarea
          value={pasteValue}
          onChange={(e) => setPasteValue(e.target.value)}
          rows={3}
          placeholder="https://www.nfce.fazenda.sp.gov.br/qrcode?p=…"
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 resize-y min-h-[4.5rem]"
          disabled={isConsulting}
        />
        <button
          type="button"
          onClick={handleManualConsult}
          disabled={isConsulting || !pasteValue.trim()}
          className="w-full py-2.5 px-4 rounded-xl font-medium text-white bg-[#16a34a] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isConsulting ? 'Consultando…' : 'Consultar nota'}
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
    </div>
  );
}
