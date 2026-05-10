import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Head from 'next/head';
import { getServerSession } from 'next-auth/next';
import { BottomNav } from '../components/BottomNav';
import { ProductBarcodeScanner } from '../components/ProductBarcodeScanner';
import { authOptions } from './api/auth/[...nextauth]';
import { canAccess } from '../lib/access-server';
import { canUseRestrictedFeatures } from '../lib/restrictedFeatureAccess';
import { getOpenFoodFactsImageUrl } from '../lib/productImageUrl';
import { cn } from '../lib/utils';
import { digitsOnly, isValidRetailBarcode } from '../lib/validateGtin';

export async function getServerSideProps(ctx) {
  try {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    if (!session?.user?.email) {
      return { redirect: { destination: '/login?callbackUrl=/scan-product', permanent: false } };
    }
    const allowed = await canAccess(session.user.email);
    if (!allowed) {
      return { redirect: { destination: '/?msg=nao-cadastrado', permanent: false } };
    }
    if (!canUseRestrictedFeatures(session.user.email)) {
      return { redirect: { destination: '/em-breve', permanent: false } };
    }
    return { props: {} };
  } catch (err) {
    console.error('[scan-product getServerSideProps]', err);
    return { redirect: { destination: '/login?callbackUrl=/scan-product', permanent: false } };
  }
}

function formatBRL(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n));
}

export default function ScanProductPage() {
  const { status } = useSession();
  const [phase, setPhase] = useState('intro');
  const [err, setErr] = useState(null);
  const [payload, setPayload] = useState(null);
  const [scannedGtin, setScannedGtin] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [manualErr, setManualErr] = useState(null);

  const runLookup = useCallback(async (gtin) => {
    setPhase('loading');
    setErr(null);
    setPayload(null);
    try {
      const res = await fetch(`/api/product/barcode-lookup?gtin=${encodeURIComponent(gtin)}`);
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || 'Não foi possível consultar o código.');
        setPhase('result');
        return;
      }
      setPayload(data);
      setPhase('result');
    } catch (e) {
      setErr(e.message || 'Erro de rede.');
      setPhase('result');
    }
  }, []);

  const onBarcode = useCallback(
    (digits) => {
      setScannedGtin(digits);
      runLookup(digits);
    },
    [runLookup]
  );

  const reset = () => {
    setPhase('intro');
    setPayload(null);
    setErr(null);
    setScannedGtin(null);
    setManualCode('');
    setManualErr(null);
  };

  const submitManualCode = useCallback(() => {
    const d = digitsOnly(manualCode);
    if (!isValidRetailBarcode(d)) {
      setManualErr('Use 8, 12 ou 13 dígitos (EAN/UPC) com dígito verificador válido.');
      return;
    }
    setManualErr(null);
    setScannedGtin(d);
    runLookup(d);
  }, [manualCode, runLookup]);

  const displayGtin = payload?.gtin || scannedGtin;
  const off = payload?.openFoodFacts;
  const fallbackImg = displayGtin ? getOpenFoodFactsImageUrl(displayGtin) : null;
  const imgSrc = off?.imageUrl || fallbackImg;

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Código de barras | FinMemory</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>

      <div className="min-h-screen bg-background text-foreground font-sans pb-28">
        {/* Header */}
        <div className="sticky top-0 z-20 flex items-center gap-3 px-5 py-4 bg-card border-b border-[#1E2A3A]">
          <Link href="/dashboard"
            className="min-h-[44px] inline-flex items-center gap-2 bg-card border border-[#1E2A3A] text-foreground py-2 px-4 rounded-xl text-sm font-medium hover:bg-[#1E2A3A] transition-colors no-underline">
            ← Voltar
          </Link>
          <h1 className="text-foreground text-[18px] font-black m-0 flex-1">Escanear Produto</h1>
        </div>

        <div className="px-5 pt-5 pb-8 max-w-lg mx-auto space-y-4">
          {phase === 'intro' && (
            <div className="bg-card border border-[#1E2A3A] rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-2xl">
                  📦
                </div>
                <div>
                  <p className="font-bold text-foreground">Identificar produto</p>
                  <p className="text-xs text-muted-foreground">Leia o código de barras EAN/UPC</p>
                </div>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                O app identifica o item pela base aberta e, se você já registrou NFC-e com este código, mostra o que{' '}
                <strong className="text-foreground">você já pagou</strong> antes.
              </p>
              <button type="button" onClick={() => setPhase('scan')}
                className="w-full py-4 px-6 bg-primary text-[#0A0E1A] rounded-xl text-base font-black hover:bg-primary/90 active:scale-[0.98] transition-all">
                📷 Abrir câmera
              </button>

              <div className="relative py-2 text-center text-xs text-muted-foreground">
                <span className="bg-card px-2 relative z-[1]">ou digite o código</span>
                <span className="absolute left-0 right-0 top-1/2 h-px bg-[#1E2A3A] z-0" aria-hidden />
              </div>

              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="ex.: 7891234567890"
                value={manualCode}
                onChange={(e) => { setManualCode(e.target.value); setManualErr(null); }}
                className="w-full px-4 py-3 rounded-xl border border-[#1E2A3A] bg-background text-foreground font-mono text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
              {manualErr && <p className="text-red-400 text-xs">{manualErr}</p>}
              <button type="button" onClick={submitManualCode}
                className="w-full py-3 px-4 bg-card text-foreground rounded-xl font-semibold border border-[#1E2A3A] hover:bg-[#1E2A3A] transition-colors">
                Buscar pelo número
              </button>
            </div>
          )}

          {phase === 'scan' && (
            <div className="bg-card border border-[#1E2A3A] rounded-2xl p-5 space-y-4">
              <ProductBarcodeScanner onScan={onBarcode} onClose={() => reset()} />
              <div className="pt-3 border-t border-[#1E2A3A]">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Ou digitar código (EAN / UPC)</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="EAN / UPC"
                    value={manualCode}
                    onChange={(e) => { setManualCode(e.target.value); setManualErr(null); }}
                    className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-[#1E2A3A] bg-background text-foreground font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button type="button" onClick={submitManualCode}
                    className="shrink-0 py-2.5 px-4 rounded-xl bg-primary text-[#0A0E1A] font-bold text-sm">
                    Buscar
                  </button>
                </div>
                {manualErr && <p className="text-red-400 text-xs mt-1.5">{manualErr}</p>}
              </div>
            </div>
          )}

          {phase === 'loading' && (
            <div className="bg-card border border-[#1E2A3A] rounded-2xl p-10 flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-muted-foreground text-sm">Consultando código…</p>
            </div>
          )}

          {phase === 'result' && (
            <>
              <div className="bg-card border border-[#1E2A3A] rounded-2xl p-5 space-y-4">
                {displayGtin && (
                  <p className="text-xs text-muted-foreground">
                    Código: <span className="font-mono text-foreground">{displayGtin}</span>
                  </p>
                )}
                {err ? (
                  <p className="text-red-400 text-sm">{err}</p>
                ) : (
                  <>
                    <div className="flex gap-4 items-start">
                      {imgSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imgSrc} alt="" className="w-20 h-20 object-contain rounded-xl bg-background border border-[#1E2A3A] shrink-0"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      ) : (
                        <div className="w-20 h-20 rounded-xl bg-background border border-[#1E2A3A] shrink-0 flex items-center justify-center text-2xl">📦</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h2 className="text-[17px] font-black text-foreground leading-snug">
                          {off?.name || 'Produto identificado'}
                        </h2>
                        {off?.brands && <p className="text-sm text-muted-foreground mt-1">{off.brands}</p>}
                        {off?.source === 'cosmos' && <p className="text-xs text-muted-foreground mt-1">Fonte: Cosmos Bluesoft</p>}
                        {!off?.name && (
                          <p className="text-sm text-muted-foreground mt-2">
                            Nome não encontrado na base aberta. O código é válido para o histórico de notas.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-[#1E2A3A] pt-4">
                      <h3 className="text-sm font-bold text-foreground mb-2">Suas compras com este código</h3>
                      {payload?.yourPurchases?.length ? (
                        <ul className="list-none m-0 p-0 space-y-2">
                          {payload.yourPurchases.map((p, i) => (
                            <li key={`${p.data}-${p.estabelecimento}-${i}`}
                              className="flex justify-between gap-2 border-b border-[#1E2A3A] pb-2 last:border-0">
                              <span className="min-w-0">
                                <span className="font-medium text-foreground text-sm block truncate">{p.estabelecimento || 'Loja'}</span>
                                <span className="text-xs text-muted-foreground">{p.data}</span>
                              </span>
                              <span className="font-bold text-primary shrink-0">{formatBRL(p.price)}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Nenhuma nota com este código ainda. Quando a NFC-e trouxer o código no item (XML), aparece aqui automaticamente.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="rounded-2xl p-5 border border-blue-500/20 bg-blue-500/5 text-sm text-blue-400 leading-relaxed">
                <p className="font-bold mb-2 text-blue-300">Para redes e lojas (demo)</p>
                <p>
                  Com <strong className="text-blue-300">preços e ofertas</strong> enviados ao FinMemory, a mesma leitura vira
                  consulta de preço no corredor — sem custo de hardware extra.
                </p>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={reset}
                  className="flex-1 py-3 px-4 bg-card text-primary rounded-xl font-bold border border-primary/40 hover:bg-primary/10 transition-colors">
                  Ler outro
                </button>
                <Link href="/partnership"
                  className="flex-1 py-3 px-4 bg-primary text-[#0A0E1A] rounded-xl font-bold text-center no-underline inline-flex items-center justify-center">
                  Parceria
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      <BottomNav />
    </>
  );
}
