# Erros de OAuth no login com Google

## Erro 400: redirect_uri_mismatch

**"Acesso bloqueado: a solicitação desse app é inválida"** — a URL de retorno que o app envia ao Google **não está** na lista de "URIs de redirecionamento autorizados" do cliente OAuth.

**O que fazer:**

1. Abra **[Credenciais](https://console.cloud.google.com/apis/credentials?project=finmemory-667c3)** (projeto onde está o cliente OAuth).
2. Clique no **cliente OAuth 2.0** usado pelo app (tipo "Aplicativo da Web").
3. Em **"URIs de redirecionamento autorizados"**, adicione **todas** as URLs abaixo (e a URL que você usa para acessar o app, se for diferente):

   - `https://finmemory-667c3.web.app/api/auth/callback/google`
   - `https://finmemory.com.br/api/auth/callback/google`
   - `https://www.finmemory.com.br/api/auth/callback/google`
   - `https://finmemory-clos3kpinq-rj.a.run.app/api/auth/callback/google` *(se o app abrir por essa URL)*
   - `https://finmemory-836908221936.southamerica-east1.run.app/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google` *(dev)*

4. Em **"Origens JavaScript autorizadas"**, adicione as origens correspondentes (sem `/api/...`):

   - `https://finmemory-667c3.web.app`
   - `https://finmemory.com.br`
   - `https://www.finmemory.com.br`
   - `https://finmemory-clos3kpinq-rj.a.run.app`
   - `https://finmemory-836908221936.southamerica-east1.run.app`
   - `http://localhost:3000`

5. Clique em **SALVAR**. Pode levar alguns minutos para propagar. Depois, tente o login de novo.

---

## Erro: "The OAuth client was deleted" (401 deleted_client)

Quando o Google mostra **"The OAuth client was deleted"**, o **Client ID** (e o Client Secret) que o app usa para "Fazer login com o Google" foram excluídos no Google Cloud. É preciso criar um **novo** cliente OAuth e atualizar o app.

---

## 1. Criar novo cliente OAuth no projeto finmemory-667c3

1. Abra: **[APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials?project=finmemory-667c3)**  
   (confirme que o projeto no topo da página é **finmemory-667c3**).

2. Clique em **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**.

3. Se pedir **"Configure the OAuth consent screen"**:
   - Tipo de usuário: **External** (para qualquer conta Google).
   - Preencha Nome do app, E-mail de suporte, etc. e salve.

4. Em **"Application type"**, escolha **"Web application"**.

5. **Name:** por exemplo `Finmemory Web`.

6. Em **"Authorized JavaScript origins"**, adicione:
   - `https://finmemory-667c3.web.app`
   - `https://finmemory.com.br`
   - `https://www.finmemory.com.br`
   - `http://localhost:3000` (para desenvolvimento)

7. Em **"Authorized redirect URIs"**, adicione:
   - `https://finmemory-667c3.web.app/api/auth/callback/google`
   - `https://finmemory.com.br/api/auth/callback/google`
   - `https://www.finmemory.com.br/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google`

8. Clique em **CREATE**.  
   Anote o **Client ID** (termina em `.apps.googleusercontent.com`) e o **Client secret** (clique em "DOWNLOAD JSON" ou mostre o secret na tela).

---

## 2. Atualizar variáveis no seu ambiente

### No `.env.local` (para desenvolvimento)

Edite ou crie as linhas:

```env
GOOGLE_CLIENT_ID=SEU_NOVO_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-seu_novo_client_secret
```

### No Cloud Run (produção)

Opção A – usar o script (lê do `.env.local` e envia para o Cloud Run):

1. Atualize o **.env.local** com o novo `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`.
2. No PowerShell, na pasta do projeto:
   ```powershell
   gcloud config set project finmemory-667c3
   .\scripts\set-cloud-run-env.ps1
   ```

Opção B – manual no Console:

1. [Cloud Run](https://console.cloud.google.com/run?project=finmemory-667c3) → serviço **finmemory** → **EDIT & DEPLOY NEW REVISION**.
2. Aba **Variables & Secrets** → edite ou adicione:
   - `GOOGLE_CLIENT_ID` = novo Client ID
   - `GOOGLE_CLIENT_SECRET` = novo Client secret
3. **DEPLOY**.

---

## 3. Testar

- Limpe os cookies do site (ou use aba anônima).
- Acesse **https://finmemory-667c3.web.app** ou **https://finmemory.com.br** e tente **"Fazer login com o Google"** de novo.

Se o cliente OAuth estiver criado no projeto certo e as variáveis (e redirect URIs) estiverem corretas, o erro **deleted_client** desaparece.
