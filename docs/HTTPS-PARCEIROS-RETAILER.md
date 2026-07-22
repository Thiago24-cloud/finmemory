# HTTPS — parceiros.finmemory.com.br

O app lojista **já responde em HTTPS** no Cloud Run:

```text
https://finmemorycomerciantes-836908221936.southamerica-east1.run.app
```

O subdomínio `parceiros.finmemory.com.br` hoje devolve **404** porque o DNS (Cloudflare) aponta para o **consumer**, não para o serviço `finmemorycomerciantes`.

## Opção A — Firebase Hosting (certificado gerenciado Google)

1. Criar site (uma vez):

```bash
npx firebase-tools hosting:sites:create finmemory-parceiros --project exalted-entry-480904-s9
npx firebase-tools target:apply hosting retailer finmemory-parceiros --project exalted-entry-480904-s9
```

2. Publicar rewrite para Cloud Run retailer:

```bash
npm run deploy:firebase-hosting:retailer
```

3. No [Firebase Console → Hosting → finmemory-parceiros](https://console.firebase.google.com/project/exalted-entry-480904-s9/hosting/sites), adicionar domínio customizado `parceiros.finmemory.com.br` e aplicar os registros DNS indicados.

4. No **Cloudflare**, registro `parceiros`:
   - Tipo: `CNAME`
   - Destino: o host que o Firebase mostrar (ex. `finmemory-parceiros.web.app` ou `ghs.googlehosted.com`)
   - SSL/TLS: **Full (strict)** (nunca “Flexible” — origem deve ser HTTPS)

5. Atualizar env do retailer:

```powershell
gcloud run services update finmemorycomerciantes --region southamerica-east1 --project exalted-entry-480904-s9 --update-env-vars "NEXTAUTH_URL=https://parceiros.finmemory.com.br,NEXT_PUBLIC_APP_URL=https://parceiros.finmemory.com.br,NEXT_PUBLIC_RETAILER_APP_URL=https://parceiros.finmemory.com.br,GOOGLE_REDIRECT_URI=https://parceiros.finmemory.com.br/api/auth/callback/google"
```

6. Google OAuth: origins + redirect com `https://parceiros.finmemory.com.br`.

## Opção B — Cloud Run domain mapping (sem Firebase)

```bash
gcloud beta run domain-mappings create --service=finmemorycomerciantes --domain=parceiros.finmemory.com.br --region=southamerica-east1 --project=exalted-entry-480904-s9
```

Aplique os registros DNS que o GCP retornar. Cloudflare: proxy **desligado** no primeiro teste.

## Stone / Android

Whitelist e `FINMEMORY_API_BASE_URL` devem usar **somente HTTPS**:

- `https://parceiros.finmemory.com.br` (após DNS OK), ou
- `https://finmemorycomerciantes-836908221936.southamerica-east1.run.app` (já funciona)

## Verificação

```bash
curl -I https://parceiros.finmemory.com.br/api/health
# Esperado: HTTP/2 200
```
