import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
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
      <div className="min-h-screen bg-gradient-primary p-5 font-sans">
        <div className="text-white text-center py-10">Carregando...</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Código de barras | FinMemory</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>

      <div className="min-h-screen bg-gradient-primary font-sans pb-24">
        <div className="sticky top-0 z-20 flex items-center gap-3 p-5 pb-4 bg-gradient-primary">
          <Link
            href="/dashboard"
            className="min-h-[44px] inline-flex items-center gap-2 bg-white/20 text-white py-2.5 px-4 rounded-xl text-sm font-medium hover:bg-white/30 no-underline"
          >
            <span aria-hidden>←</span> Voltar
          </Link>
          <Image src="/logo.png" alt="" width={36} height={36} className="object-contain shrink-0 rounded-lg" />
          <h1 className="text-white text-xl sm:text-2xl m-0 flex-1">Produto</h1>
        </div>

        <div className="px-5 pb-8 max-w-lg mx-auto">
          {phase === 'intro' && (
            <div className="bg-white rounded-[24px] p-6 shadow-lg space-y-4">
              <p className="text-[#444] text-sm leading-relaxed m-0">
                Leia o <strong>código de barras</strong> do produto. O app identifica o item (base aberta) e, se você já
                registrou NFC-e com código no item, mostra o que <strong>você já pagou</strong> antes.
              </p>
              <p className="text-xs text-[#6b7280] m-0">
                O preço na gôndola continua no sistema da loja. Com parceria, a mesma leitura pode mostrar o{' '}
                <strong>preço oficial da loja</strong> aqui — e reduzir fila nos funcionários.
              </p>
              <button
                type="button"
                onClick={() => setPhase('scan')}
                className="w-full py-4 px-6 bg-[#1a7f37] text-white rounded-xl text-base font-semibold border-none cursor-pointer hover:bg-[#166534]"
              >
                Abrir câmera e ler código
              </button>

              <div className="relative py-2 text-center text-xs text-[#9ca3af]">
                <span className="bg-white px-2 relative z-[1]">ou</span>
                <span className="absolute left-0 right-0 top-1/2 h-px bg-[#e5e7eb] z-0" aria-hidden />
              </div>

              <label className="block text-xs font-semibold text-[#374151] mb-1.5">Digitar código (EAN / UPC)</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="ex.: 7891234567890"
                value={manualCode}
                onChange={(e) => {
                  setManualCode(e.target.value);
                  setManualErr(null);
                }}
                className="w-full px-4 py-3 rounded-xl border border-[#e5e7eb] text-[#111] font-mono text-base mb-2"
              />
              {manualErr && <p className="text-red-600 text-xs mb-2 m-0">{manualErr}</p>}
              <button
                type="button"
                onClick={submitManualCode}
                className="w-full py-3 px-4 bg-[#f3f4f6] text-[#111] rounded-xl font-semibold border border-[#e5e7eb] hover:bg-[#e5e7eb]"
              >
                Buscar pelo número
              </button>
            </div>
          )}

          {phase === 'scan' && (
            <div className="bg-white rounded-[24px] p-6 shadow-lg space-y-5">
              <ProductBarcodeScanner
                onScan={onBarcode}
                onClose={() => {
                  reset();
                }}
              />
              <div className="pt-2 border-t border-[#eee]">
                <p className="text-xs font-semibold text-[#374151] m-0 mb-2">Digitar código (EAN / UPC)</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="EAN / UPC"
                    value={manualCode}
                    onChange={(e) => {
                      setManualCode(e.target.value);
                      setManualErr(null);
                    }}
                    className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-[#e5e7eb] font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={submitManualCode}
                    className="shrink-0 py-2.5 px-4 rounded-xl bg-[#1a7f37] text-white font-semibold text-sm"
                  >
                    Buscar
                  </button>
                </div>
                {manualErr && <p className="text-red-600 text-xs mt-1.5 m-0">{manualErr}</p>}
              </div>
            </div>
          )}

          {phase === 'loading' && (
            <div className="bg-white rounded-[24px] p-8 shadow-lg text-center text-[#444]">
              Consultando código…
            </div>
          )}

          {phase === 'result' && (
            <div className="space-y-4">
              <div className="bg-white rounded-[24px] p-6 shadow-lg space-y-4">
                {displayGtin && (
                  <p className="text-xs text-[#6b7280] m-0">
                    Código: <span className="font-mono">{displayGtin}</span>
                  </p>
                )}
                {err && (
                  <p className="text-red-600 text-sm m-0">{err}</p>
                )}
                {!err && (
                  <>
                    <div className="flex gap-4 items-start">
                      {imgSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={imgSrc}
                          alt=""
                          className="w-20 h-20 object-contain rounded-xl bg-[#f3f4f6] shrink-0"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-xl bg-[#f3f4f6] shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-bold text-[#111] m-0 leading-snug">
                          {off?.name || 'Produto identificado pelo código'}
                        </h2>
                        {off?.brands && (
                          <p className="text-sm text-[#666] mt-1 m-0">{off.brands}</p>
                        )}
                        {off?.source === 'cosmos' && (
                          <p className="text-xs text-[#9ca3af] mt-1.5 m-0">Fonte: Cosmos Bluesoft</p>
                        )}
                        {!off?.name && (
                          <p className="text-sm text-[#666] mt-2 m-0">
                            Nome não encontrado na base aberta. Ainda assim o código é válido para parceiros e para o
                            histórico de notas.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-[#eee] pt-4">
                      <h3 className="text-sm font-bold text-[#111] m-0 mb-2">Suas compras com este código</h3>
                      {payload?.yourPurchases?.length ? (
                        <ul className="list-none m-0 p-0 space-y-2">
                          {payload.yourPurchases.map((p, i) => (
                            <li
                              key={`${p.data}-${p.estabelecimento}-${i}`}
                              className="text-sm text-[#444] flex justify-between gap-2 border-b border-[#f3f4f6] pb-2 last:border-0"
                            >
                              <span className="min-w-0">
                                <span className="font-medium block truncate">{p.estabelecimento || 'Loja'}</span>
                                <span className="text-xs text-[#888]">{p.data}</span>
                              </span>
                              <span className="font-semibold text-[#1a7f37] shrink-0">{formatBRL(p.price)}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-[#666] m-0">
                          Nenhuma nota sua com este código ainda. Quando a NFC-e trouxer o código no item (XML), ele
                          aparece aqui automaticamente.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div
                className={cn(
                  'rounded-[24px] p-5 border border-[#bae6fd] bg-[#f0f9ff]',
                  'text-sm text-[#0c4a6e] leading-relaxed'
                )}
              >
                <p className="font-bold m-0 mb-2">Para redes e lojas (demo)</p>
                <p className="m-0">
                  Hoje o usuário vê o produto e o histórico das próprias notas. Com os <strong>preços e ofertas</strong>{' '}
                  que vocês enviarem ao FinMemory, a mesma leitura vira consulta de preço no corredor — sem custo de
                  hardware extra e com menos interrupção na equipe.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={reset}
                  className="flex-1 py-3 px-4 bg-white text-[#1a7f37] rounded-xl font-semibold border-2 border-[#1a7f37]"
                >
                  Ler outro código
                </button>
                <Link
                  href="/partnership"
                  className="flex-1 py-3 px-4 bg-[#1a7f37] text-white rounded-xl font-semibold text-center no-underline inline-flex items-center justify-center"
                >
                  Parceria
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </>
  );
}
