import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';

export default function Custom404() {
  return (
    <>
      <Head>
        <title>Página não encontrada | FinMemory</title>
      </Head>
      <div className="min-h-screen flex flex-col items-center justify-center p-5 bg-gradient-primary font-sans">
        <div className="bg-white rounded-[20px] p-8 md:p-10 text-center shadow-[0_20px_60px_rgba(0,0,0,0.25)] max-w-[480px] w-full">
          <div className="flex justify-center mb-4">
            <Image src="/logo.png" alt="FinMemory" width={80} height={80} className="object-contain" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2 text-[#333]">
            404
          </h1>
          <p className="text-[#666] mb-6">
            Esta página não existe ou foi movida.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/"
              className="w-full inline-flex justify-center py-3.5 px-6 bg-gradient-primary text-white rounded-xl font-semibold hover:opacity-95 transition-opacity"
            >
              🏠 Voltar ao início
            </Link>
            <Link
              href="/dashboard"
              className="w-full inline-flex justify-center py-3.5 px-6 bg-transparent text-[#667eea] border-2 border-[#667eea] rounded-xl font-semibold hover:bg-[#667eea] hover:text-white transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/mapa"
              className="w-full inline-flex justify-center py-3.5 px-6 bg-transparent text-[#22c55e] border-2 border-[#22c55e] rounded-xl font-semibold hover:bg-[#22c55e] hover:text-white transition-colors"
            >
              🗺️ Mapa de Preços
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
