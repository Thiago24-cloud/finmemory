# FinMemory – App nativo com Capacitor

O FinMemory está configurado com **Capacitor** para gerar apps nativos **Android** e **iPhone**. O app abre em um WebView apontando para a **URL de produção** (Cloud Run), então o site continua sendo o mesmo; a “casca” nativa permite usar geofencing, notificações em background e outras APIs do sistema depois.

## Estrutura

- **Web (como hoje):** acesse pela URL no navegador (desktop ou mobile). Deploy no Cloud Run.
- **App Android/iPhone:** projeto Capacitor em `android/` e `ios/`; o WebView carrega a mesma URL de produção.
- **`www/`:** pasta mínima usada como `webDir` pelo Capacitor (quando `server.url` está definido, o app abre direto a URL remota).

## Pré-requisitos

- **Android:** [Android Studio](https://developer.android.com/studio) e SDK Android
- **iOS:** Mac com [Xcode](https://developer.apple.com/xcode/) (só em macOS)

## Comandos

```bash
# Sincronizar web assets e config nos projetos nativos
npm run cap:sync

# Abrir projeto Android no Android Studio
npm run cap:android

# Abrir projeto iOS no Xcode (apenas no Mac)
npm run cap:ios
```

## Fluxo para build

1. **Deploy web em produção** (como você já faz: `.\deploy-cloud-run.ps1`). O app nativo usa essa URL.
2. **Sincronizar:** `npm run cap:sync`
3. **Android:** `npm run cap:android` → no Android Studio: Build → Build Bundle(s) / APK(s) → Build APK(s). O APK pode ser instalado em dispositivo ou distribuído.
4. **iOS:** `npm run cap:ios` → no Xcode: escolher dispositivo/simulador e Run. Para publicar na App Store, configurar signing e archive.

## URL de produção

Em `capacitor.config.json` está:

```json
"server": {
  "url": "https://finmemory-836908221936.southamerica-east1.run.app"
}
```

Se a URL do app mudar, atualize aqui e rode `npm run cap:sync` de novo.

## Próximos passos (geofencing)

Com a casca nativa pronta, você pode instalar o plugin de **Background Geolocation** ou **Geofencing** (ex.: `@capacitor-community/background-geolocation` ou equivalente) e implementar as regras de entrada/saída de região no código do app (por exemplo em um serviço ou no `App` do Capacitor).

## Desktop

Capacitor gera apenas **Android** e **iOS**. No computador, o uso continua pelo **navegador** na mesma URL (sem build desktop).
