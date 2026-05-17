import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

import { PLAY_STORE_URL } from '../lib/landingConstants';
const APP_STORE_URL = 'https://finmemory.com.br';

function detectOS() {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  return 'desktop';
}

export default function DownloadPage() {
  const [os, setOs] = useState(null);

  useEffect(() => {
    const detected = detectOS();
    setOs(detected);
    if (detected === 'android') {
      window.location.href = PLAY_STORE_URL;
    } else if (detected === 'ios') {
      window.location.href = APP_STORE_URL;
    }
  }, []);

  const isRedirecting = os === 'android' || os === 'ios';

  return (
    <>
      <Head>
        <title>Baixar FinMemory</title>
        <meta name="description" content="Baixe o FinMemory no seu celular e controle seus gastos com supermercado." />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-[#f0fdf4] to-[#dcfce7] flex flex-col items-center justify-center p-6">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[22px] bg-[#2ECC49] shadow-lg mb-4">
            <span className="text-white text-4xl font-bold select-none">F</span>
          </div>
          <h1 className="text-3xl font-bold text-[#1a1a1a]">FinMemory</h1>
          <p className="text-[#555] mt-1 text-sm">Seu assistente de compras inteligente</p>
        </div>

        {isRedirecting ? (
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-4 border-[#2ECC49] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-[#555] text-sm">Redirecionando para a loja...</p>
          </div>
        ) : (
          <div className="w-full max-w-sm">
            {/* Card principal */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-4">
              <h2 className="text-lg font-semibold text-[#1a1a1a] text-center mb-1">
                Disponível para celular
              </h2>
              <p className="text-[#777] text-sm text-center mb-6">
                Escaneie o QR Code ou escolha sua plataforma
              </p>

              {/* QR Code */}
              <div className="flex justify-center mb-6">
                <div className="p-3 bg-white border-2 border-[#e0e0e0] rounded-xl">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent('https://finmemory.com.br/download')}&color=1a1a1a&bgcolor=ffffff&margin=2`}
                    alt="QR Code para baixar o FinMemory"
                    width={160}
                    height={160}
                    className="rounded-lg"
                  />
                </div>
              </div>

              {/* Botões de loja */}
              <div className="flex flex-col gap-3">
                <a
                  href={PLAY_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-[#1a1a1a] hover:bg-[#333] text-white rounded-xl px-4 py-3 transition-colors no-underline"
                >
                  <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0 fill-white" aria-hidden>
                    <path d="M3.18 23.76c.37.2.8.22 1.19.04l12.12-6.97-2.54-2.54-10.77 9.47zm-1.5-20.3A1.77 1.77 0 0 0 1.5 4.5v15a1.77 1.77 0 0 0 .18 1.04l.08.08 8.41-8.41v-.2L1.76 3.38l-.08.08zM20.1 10.5l-2.28-1.31-2.84 2.84 2.84 2.84 2.3-1.32a1.78 1.78 0 0 0 0-3.05zm-17.43 12.7 10.77-9.47-2.54-2.54-10.77 9.47 2.54 2.54z" />
                  </svg>
                  <div>
                    <p className="text-[10px] text-gray-300 leading-none">Disponível no</p>
                    <p className="text-sm font-semibold leading-tight">Google Play</p>
                  </div>
                </a>

                <a
                  href={APP_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-[#1a1a1a] hover:bg-[#333] text-white rounded-xl px-4 py-3 transition-colors no-underline"
                >
                  <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0 fill-white" aria-hidden>
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98l-.09.06c-.22.15-2.19 1.28-2.17 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.36 2.77M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  <div>
                    <p className="text-[10px] text-gray-300 leading-none">Em breve na</p>
                    <p className="text-sm font-semibold leading-tight">App Store</p>
                  </div>
                </a>
              </div>
            </div>

            {/* Link de volta */}
            <p className="text-center text-sm text-[#777]">
              Prefere usar no navegador?{' '}
              <Link href="/mapa" className="text-[#2ECC49] font-medium underline-offset-2 hover:underline">
                Abrir web app
              </Link>
            </p>
          </div>
        )}
      </div>
    </>
  );
}
