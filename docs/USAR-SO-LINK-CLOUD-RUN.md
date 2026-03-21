# Entrar no app só pelo link do Cloud Run

Configuração para acessar o FinMemory apenas por:

**https://finmemory-836908221936.southamerica-east1.run.app**

(sem usar domínio customizado tipo finmemory.com.br)

---

## O que já foi ajustado no código

1. **Cookies do NextAuth**  
   Quando `NEXTAUTH_URL` é a URL do Cloud Run, os cookies **não** usam domínio fixo (ficam no host do Run). O login passa a funcionar pelo link do Cloud Run.

2. **Script de env**  
   O `set-cloud-run-env.ps1` usa por padrão a URL do Cloud Run quando `NEXTAUTH_URL` não está definida no `.env.local`.

---

## O que você precisa fazer

### 1. Definir NEXTAUTH_URL no Cloud Run

No Cloud Run, a variável **NEXTAUTH_URL** deve ser exatamente:

```text
https://finmemory-836908221936.southamerica-east1.run.app
```

**Opção A – Pelo script (recomendado)**  
No `.env.local` defina (ou deixe comentado para o script preencher):

```env
NEXTAUTH_URL=https://finmemory-836908221936.southamerica-east1.run.app
```

Depois rode:

```powershell
.\scripts\set-cloud-run-env.ps1
```

**Opção B – Manual no Console**  
Cloud Run → serviço **finmemory** → Edit & Deploy New Revision → Variables → adicione/edite **NEXTAUTH_URL** com o valor acima.

---

### 2. Redirect URI no Google OAuth

Para o login com Google funcionar nessa URL:

1. Abra [Google Cloud Console – Credentials](https://console.cloud.google.com/apis/credentials?project=exalted-entry-480904-s9).
2. No OAuth 2.0 Client ID (tipo “Web application”) usado pelo app, em **Authorized redirect URIs**:
   - Adicione:  
     **https://finmemory-836908221936.southamerica-east1.run.app/api/auth/callback/google**
   - Salve.

Se quiser usar **só** o Cloud Run por enquanto, pode deixar só esse redirect; pode adicionar o de finmemory.com.br de novo quando for usar o domínio.

---

### 3. Deploy

Depois de ajustar env e OAuth:

```powershell
.\deploy-cloud-run.ps1
```

Se já alterou só as variáveis no Console, não precisa fazer novo deploy; o que importa é **NEXTAUTH_URL** e o redirect URI no Google estarem corretos.

---

## Resumo

| Onde              | Valor / Ação |
|-------------------|--------------|
| **Cloud Run**     | `NEXTAUTH_URL` = `https://finmemory-836908221936.southamerica-east1.run.app` |
| **Google OAuth**  | Redirect URI = `https://finmemory-836908221936.southamerica-east1.run.app/api/auth/callback/google` |
| **Acesso**        | Abrir **https://finmemory-836908221936.southamerica-east1.run.app** e fazer login com Google |

Depois disso o app fica configurado para entrar só pelo link do Cloud Run.
