import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { getServerSession } from 'next-auth/next';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { NFCeScanner } from '../components/NFCeScanner';
import { authOptions } from './api/auth/[...nextauth]';
import { canAccess } from '../lib/access-server';

export async function getServerSideProps(ctx) {
  try {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    if (!session?.user?.email) {
      return { redirect: { destination: '/login?callbackUrl=/scanner', permanent: false } };
    }
    const allowed = await canAccess(session.user.email);
    if (!allowed) {
      return { redirect: { destination: '/?msg=nao-cadastrado', permanent: false } };
    }
    return { props: {} };
  } catch (err) {
    console.error('[scanner getServerSideProps]', err);
    return { redirect: { destination: '/login?callbackUrl=/scanner', permanent: false } };
  }
}

export default function ScannerPage() {
  const [cameraOpen, setCameraOpen] = useState(false);
  const { data: session, status } = useSession();
  const router = useRouter();
  const userId = session?.user?.supabaseId || (typeof window !== 'undefined' ? localStorage.getItem('user_id') : null);

  const handleSuccess = () => {
    router.push('/dashboard');
  };

  const handleClose = () => {
    router.push('/dashboard');
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-primary p-5 font-sans flex items-center justify-center">
        <div className="text-white text-center">Carregando...</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Escanear NFC-e | FinMemory</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>
      <div className="min-h-screen bg-gradient-primary font-sans">
        <div className="sticky top-0 z-20 flex items-center gap-3 p-5 pb-4 bg-gradient-primary">
          <Link
            href="/dashboard"
            className="min-h-[44px] inline-flex items-center gap-2 bg-white/20 text-white py-2.5 px-4 rounded-xl text-sm font-medium hover:bg-white/30 no-underline"
          >
            <span aria-hidden>←</span> Voltar
          </Link>
          <Image src="/logo.png" alt="" width={36} height={36} className="object-contain shrink-0 rounded-lg" />
          <h1 className="text-white text-xl sm:text-2xl m-0 flex-1">Escanear Nota Fiscal</h1>
        </div>
        <div className="px-5 pb-8">
          <div className="bg-white rounded-[24px] p-6 shadow-lg">
            <p className="text-[#666] text-sm mb-4">
              Aponte a câmera para o QR Code da NFC-e. A nota será consultada, categorizada e salva automaticamente.
            </p>
            {!cameraOpen ? (
              <>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                      stream.getTracks().forEach((t) => t.stop());
                    } catch (_) {}
                    setCameraOpen(true);
                  }}
                  className="w-full py-4 px-6 bg-[#e0f2fe] text-[#0369a1] rounded-xl text-base font-medium border-none cursor-pointer hover:bg-[#bae6fd]"
                >
                  📷 Abrir câmera para escanear
                </button>
                <p className="text-xs text-[#6b7280] mt-3 m-0">
                  Toque acima para abrir a câmera (o navegador pode pedir permissão). Use a câmera traseira.
                </p>
              </>
            ) : (
              <NFCeScanner
                userId={userId}
                onSuccess={handleSuccess}
                onClose={handleClose}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
