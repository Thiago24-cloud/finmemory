import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

/** App lojista — entrada padrão na landing Parceiros. */
export default function RetailerHome() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/parceiros');
  }, [router]);

  return (
    <>
      <Head>
        <title>FinMemory Comerciantes</title>
      </Head>
      <p className="text-center text-muted-foreground py-16">Redirecionando…</p>
    </>
  );
}
