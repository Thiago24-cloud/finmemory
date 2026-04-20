import Document, { Html, Head, Main, NextScript } from 'next/document';

/**
 * Manifest PWA: em /admin usa manifest-admin.webmanifest (start_url /admin) para
 * "Adicionar à Tela Início" abrir o painel; resto do site mantém manifest.webmanifest (/).
 */
export default class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const initialProps = await Document.getInitialProps(ctx);
    const pathname = ctx.pathname || '';
    const isAdminPwa = pathname.startsWith('/admin');
    return { ...initialProps, isAdminPwa };
  }

  render() {
    const isAdminPwa = this.props.isAdminPwa;
    const manifestHref = isAdminPwa ? '/manifest-admin.webmanifest' : '/manifest.webmanifest';
    const appleTitle = isAdminPwa ? 'FinMemory Painel' : 'FinMemory';

    return (
      <Html lang="pt-BR">
        <Head>
          <link rel="icon" href="/logo.png" type="image/png" />
          <link rel="apple-touch-icon" href="/logo.png" />
          <link rel="manifest" href={manifestHref} />
          <meta name="theme-color" content="#2ECC49" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content={appleTitle} />
          {/* Google Analytics é carregado via _app.js (GoogleAnalytics do @next/third-parties) */}
        </Head>
        <body>
          <Main />
          {/* Antes dos chunks do Next: prefetch pode pedir /_next/data/{buildIdAntigo}/*.json → 404 após deploy */}
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){
  try {
    var chunkK='finmemory_chunk_reload_ts';
    var dataK='finmemory_nextdata_404_ts';
    function reloadAfter(ms,key){
      var now=Date.now(),last=parseInt(sessionStorage.getItem(key)||'0',10);
      if(now-last<ms)return;
      sessionStorage.setItem(key,String(now));
      location.reload();
    }
    var orig=window.fetch.bind(window);
    window.fetch=function(){
      var args=Array.prototype.slice.call(arguments);
      return orig.apply(null,args).then(function(res){
        try{
          var u=args[0],url=typeof u==='string'?u:(u&&u.url)?String(u.url):'';
          if(res.status===404&&url.indexOf('/_next/data/')!==-1&&url.indexOf('.json')!==-1)reloadAfter(2000,dataK);
        }catch(e){}
        return res;
      });
    };
    window.__finmemoryReloadOnChunkError=function(){reloadAfter(8000,chunkK);};
  }catch(e){}
})();`,
            }}
          />
          <NextScript />
        </body>
      </Html>
    );
  }
}
