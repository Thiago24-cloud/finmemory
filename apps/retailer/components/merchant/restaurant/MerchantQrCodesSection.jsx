'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Download, Loader2, Printer, QrCode } from 'lucide-react';
import { painelApi } from '../../../lib/merchant/painelApiPaths';
import { buildMesaQrUrl } from '../../../lib/merchant/mesas/mapMesaRow';
import { buildQrImageUrl } from '../../../lib/merchant/storePublicQr';
import { PlanLockedNotice } from '../PlanLockedNotice';
import { SkipPageHeader } from '../skip/SkipPageHeader';
import { SkipCard, SkipCardContent } from '../skip/SkipCard';
import { SkipButton } from '../skip/SkipButton';

async function downloadQrPng(imageUrl, filename) {
  const res = await fetch(imageUrl);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename || 'qr-loja-finmemory.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

export function MerchantQrCodesSection({ storeId }) {
  const [mesas, setMesas] = useState([]);
  const [storeQr, setStoreQr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [featureLocked, setFeatureLocked] = useState(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setFeatureLocked(null);
    try {
      const [qrRes, mesasRes] = await Promise.all([
        fetch(painelApi.qrCode),
        fetch(painelApi.mesas),
      ]);
      const qrJson = await qrRes.json().catch(() => ({}));
      const mesasJson = await mesasRes.json().catch(() => ({}));

      if (qrRes.status === 403 && qrJson.code === 'FEATURE_LOCKED') {
        setFeatureLocked(qrJson);
        setStoreQr(null);
      } else if (!qrRes.ok) {
        setError(qrJson.error || 'Erro ao gerar QR da loja.');
        setStoreQr(null);
      } else {
        setStoreQr(qrJson);
      }

      if (mesasRes.ok) {
        setMesas(mesasJson.mesas || []);
      } else if (mesasRes.status !== 403) {
        /* mesas opcional se feature lock parcial */
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const copyLink = async () => {
    if (!storeQr?.public_url) return;
    try {
      await navigator.clipboard.writeText(storeQr.public_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Não foi possível copiar. Selecione o link manualmente.');
    }
  };

  const onDownload = async () => {
    if (!storeQr?.qr_image_url) return;
    setDownloading(true);
    try {
      const slug = storeQr.store?.slug || 'loja';
      await downloadQrPng(storeQr.qr_image_url, `qr-${slug}-finmemory.png`);
    } catch {
      setError('Falha ao baixar a imagem do QR.');
    } finally {
      setDownloading(false);
    }
  };

  const onPrint = () => {
    window.print();
  };

  if (featureLocked) {
    return (
      <div className="animate-fade-in-up">
        <SkipPageHeader
          icon={QrCode}
          title="Códigos"
          description="QR da loja e das mesas para o cliente escanear."
        />
        <PlanLockedNotice
          featureLabel="QR Code da loja"
          requiredPlanName={featureLocked.required_plan_name || 'Presença Digital'}
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <SkipPageHeader
        icon={QrCode}
        title="Códigos"
        description="QR da loja (página pública) e QR por mesa (cardápio no balcão)."
      />

      {error ? <p className="text-sm text-destructive m-0 mb-4">{error}</p> : null}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground mb-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Preparando QR…
        </div>
      ) : null}

      {storeQr ? (
        <SkipCard className="border-primary/20 bg-primary/5 shadow-subtle mb-6 print:border print:bg-white">
          <SkipCardContent className="p-5">
            <h3 className="text-sm font-bold m-0 mb-1">QR da loja (página pública)</h3>
            <p className="text-xs text-muted-foreground m-0 mb-4">
              {storeQr.print_hint || 'Escaneie para ver o cardápio no FinMemory.'}
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={storeQr.qr_image_url}
                alt="QR Code da loja"
                className="w-44 h-44 rounded-lg border border-border bg-white p-2"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm font-bold m-0">{storeQr.store?.name}</p>
                {storeQr.store?.address ? (
                  <p className="text-xs text-muted-foreground m-0">{storeQr.store.address}</p>
                ) : null}
                <p className="text-xs text-muted-foreground m-0">Link:</p>
                <code className="text-[10px] text-foreground/70 break-all block">
                  {storeQr.public_url}
                </code>
                <div className="flex flex-wrap gap-2 pt-2 print:hidden">
                  <SkipButton variant="outline" size="sm" onClick={copyLink}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Copiado' : 'Copiar link'}
                  </SkipButton>
                  <SkipButton variant="outline" size="sm" onClick={onDownload} disabled={downloading}>
                    <Download className="h-4 w-4" />
                    {downloading ? 'Baixando…' : 'Baixar PNG'}
                  </SkipButton>
                  <SkipButton variant="outline" size="sm" onClick={onPrint}>
                    <Printer className="h-4 w-4" />
                    Imprimir
                  </SkipButton>
                </div>
              </div>
            </div>

            <div className="hidden print:block mt-6 text-center border-t pt-6">
              <p className="text-xl font-bold m-0">{storeQr.store?.name}</p>
              <p className="text-sm m-0 mt-2">Escaneie o QR para ver o cardápio</p>
              <p className="text-xs text-muted-foreground m-0 mt-1">FinMemory</p>
            </div>
          </SkipCardContent>
        </SkipCard>
      ) : null}

      <h3 className="text-sm font-bold m-0 mb-3 print:hidden">QR por mesa</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:hidden">
        {mesas.map((mesa) => {
          const url = buildMesaQrUrl({ storeId, mesaNumero: mesa.numero, baseUrl });
          return (
            <SkipCard key={mesa.id} className="shadow-subtle">
              <SkipCardContent className="p-4 flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={buildQrImageUrl(url, 120)}
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

      {!loading && mesas.length === 0 ? (
        <p className="text-xs text-muted-foreground m-0 mt-4 print:hidden">
          Cadastre mesas na aba Mesas para gerar QR por mesa.
        </p>
      ) : null}
    </div>
  );
}
