import Head from 'next/head';
import Link from 'next/link';

/**
 * Página exibida quando ocorre erro 500 no servidor.
 */
export default function Error500() {
  return (
    <>
      <Head>
        <title>Erro | FinMemory</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-foreground">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Algo deu errado</h1>
          <p className="text-muted-foreground mb-6">
            Ocorreu um erro no servidor. Tente novamente em instantes ou volte ao início.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center py-3 px-6 rounded-xl font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </>
  );
}
