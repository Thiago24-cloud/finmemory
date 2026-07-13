'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Printer, QrCode } from 'lucide-react';
import { painelApi } from '../../../lib/merchant/painelApiPaths';
import { buildMesaQrUrl } from '../../../lib/merchant/mesas/mapMesaRow';

export function MerchantQrCodesSection({ storeId }) {
  const [mesas, setMesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(painelApi.mesas);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Erro ao carregar mesas.');
        return;
      }
      setMesas(json.mesas || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const accessUrl = storeId ? `${baseUrl}/parceiros/pedir?loja=${storeId}` : `${baseUrl}/parceiros`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold m-0 text-white flex items-center gap-2">
          <QrCode className="h-5 w-5 text-[#39FF14]" />
          Códigos QR
        </h2>
        <p className="text-xs text-white/50 mt-2 m-0">
          Imprima e coloque nas mesas. O cliente escaneia e abre o cardápio para pedir.
        </p>
      </div>

      <div className="rounded-2xl border border-[#39FF14]/30 bg-[#39FF14]/5 p-5">
        <h3 className="text-sm font-bold text-white m-0 mb-2">QR geral do restaurante</h3>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(accessUrl)}`}
            alt="QR Code de acesso"
            className="w-36 h-36 rounded-lg border border-white/10 bg-white p-2"
          />
          <div className="min-w-0">
            <p className="text-xs text-white/50 m-0 mb-1">Link:</p>
            <code className="text-[10px] text-white/70 break-all">{accessUrl}</code>
          </div>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-xs text-white/80"
        >
          <Printer className="h-4 w-4" />
          Imprimir
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-400 m-0">{error}</p>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-white/60">
          <Loader2 className="h-5 w-5 animate-spin text-[#39FF14]" />
          Carregando mesas…
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {mesas.map((mesa) => {
            const url = buildMesaQrUrl({ storeId, mesaNumero: mesa.numero, baseUrl });
            return (
              <div
                key={mesa.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex items-center gap-4"
              >
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(url)}`}
                  alt={`QR Mesa ${mesa.numero}`}
                  className="w-24 h-24 rounded-lg bg-white p-1 shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-base font-bold text-white m-0">Mesa {mesa.numero}</p>
                  <p className="text-[10px] text-white/40 mt-1 m-0 break-all">{url}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && mesas.length === 0 ? (
        <p className="text-xs text-white/40 m-0">Cadastre mesas na aba Mesas para gerar QR por mesa.</p>
      ) : null}
    </div>
  );
}
