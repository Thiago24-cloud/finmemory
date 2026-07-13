'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Printer, QrCode } from 'lucide-react';
import { painelApi } from '../../../lib/merchant/painelApiPaths';
import { buildMesaQrUrl } from '../../../lib/merchant/mesas/mapMesaRow';
import { SkipPageHeader } from '../skip/SkipPageHeader';
import { SkipCard, SkipCardContent } from '../skip/SkipCard';
import { SkipButton } from '../skip/SkipButton';

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
    <div className="animate-fade-in-up">
      <SkipPageHeader
        icon={QrCode}
        title="Códigos"
        description="Imprima e coloque nas mesas. O cliente escaneia e abre o cardápio para pedir."
      />

      <SkipCard className="border-primary/20 bg-primary/5 shadow-subtle mb-6">
        <SkipCardContent className="p-5">
          <h3 className="text-sm font-bold m-0 mb-2">QR geral do restaurante</h3>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(accessUrl)}`}
              alt="QR Code de acesso"
              className="w-36 h-36 rounded-lg border border-border bg-white p-2"
            />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground m-0 mb-1">Link:</p>
              <code className="text-[10px] text-foreground/70 break-all">{accessUrl}</code>
            </div>
          </div>
          <SkipButton variant="outline" size="sm" onClick={() => window.print()} className="mt-4">
            <Printer className="h-4 w-4" />
            Imprimir
          </SkipButton>
        </SkipCardContent>
      </SkipCard>

      {error ? <p className="text-sm text-destructive m-0 mb-4">{error}</p> : null}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Carregando mesas…
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {mesas.map((mesa) => {
            const url = buildMesaQrUrl({ storeId, mesaNumero: mesa.numero, baseUrl });
            return (
              <SkipCard key={mesa.id} className="shadow-subtle">
                <SkipCardContent className="p-4 flex items-center gap-4">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(url)}`}
                    alt={`QR Mesa ${mesa.numero}`}
                    className="w-24 h-24 rounded-lg bg-white p-1 shrink-0 border border-border"
                  />
                  <div className="min-w-0">
                    <p className="text-base font-bold m-0">Mesa {mesa.numero}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 m-0 break-all">{url}</p>
                  </div>
                </SkipCardContent>
              </SkipCard>
            );
          })}
        </div>
      )}

      {!loading && mesas.length === 0 ? (
        <p className="text-xs text-muted-foreground m-0 mt-4">Cadastre mesas na aba Mesas para gerar QR por mesa.</p>
      ) : null}
    </div>
  );
}
