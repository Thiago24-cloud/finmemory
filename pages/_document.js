import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="pt-BR">
      <Head>
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        {/* Google Analytics é carregado via _app.js (GoogleAnalytics do @next/third-parties) */}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
