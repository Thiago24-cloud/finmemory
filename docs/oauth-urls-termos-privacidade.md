# Configurar URLs de Termos e Privacidade no OAuth (Google Cloud)

Use as URLs do Cloud Run na tela de consentimento OAuth para que os links "Termos de Serviço" e "Política de Privacidade" funcionem.

## Onde fica "Editar app" e as Informações do app

1. **Abra o Console e o projeto**
   - Acesse: https://console.cloud.google.com/
   - No topo da página, no seletor de projeto, escolha o **projeto do FinMemory** (o que está no Cloud Run).

2. **Vá para a Tela de consentimento OAuth**
   - No **menu lateral esquerdo** (☰), clique em **APIs e Serviços**.
   - Depois clique em **Tela de consentimento OAuth** (em inglês: **OAuth consent screen**).
   - Link direto (troque `SEU_PROJECT_ID` pelo ID do projeto, se preferir):  
     `https://console.cloud.google.com/apis/credentials/consent?project=SEU_PROJECT_ID`

3. **Editar o app**
   - Nessa página você vê o resumo da tela de consentimento (tipo de usuário, escopos, etc.).
   - No **topo da página** ou no **card "Informações do app"** deve aparecer um botão:
     - **EDITAR APP** (português) ou **EDIT APP** (inglês).
   - Clique nesse botão.

4. **Onde ficam as URLs (Termos e Privacidade)**
   - Depois de clicar em Editar app, você passa por **várias etapas** (App information → Escopos → Usuários de teste → Resumo).
   - As URLs ficam na **primeira etapa: "Informações do app"** (ou **App information**).
   - Nessa etapa, role a página até a seção **"Domínio do app"** / **"App domain"**. Lá estão:
     - **Página inicial do aplicativo** (Application home page) — opcional.
     - **Política de Privacidade** (Application privacy policy link) — cole a URL da privacidade.
     - **Termos de Serviço** (Application terms of service link) — cole a URL dos termos.
   - Se a interface for a nova **Google Auth Platform**, as mesmas opções ficam em:  
     https://console.developers.google.com/auth/branding (página **Branding** → **App domain**).

## URLs para usar

| Campo | URL |
|-------|-----|
| **Termos de Serviço** | `https://finmemory-836908221936.southamerica-east1.run.app/termos` |
| **Política de Privacidade** | `https://finmemory-836908221936.southamerica-east1.run.app/privacidade` |

## Passo a passo resumido

1. Console → **APIs e Serviços** → **Tela de consentimento OAuth**.
2. Clique em **EDITAR APP** (ou **EDIT APP**).
3. Na etapa **Informações do app**, na seção **Domínio do app**, preencha:
   - **URL da Política de Privacidade:**  
     `https://finmemory-836908221936.southamerica-east1.run.app/privacidade`
   - **URL dos Termos de Serviço:**  
     `https://finmemory-836908221936.southamerica-east1.run.app/termos`
4. Clique em **SALVAR E CONTINUAR** até o fim e, se aparecer, em **Publicar** / **Publish**.

Depois disso, ao fazer login com Google, os links "Termos de Serviço" e "Política de Privacidade" abrirão essas páginas e não darão mais 404.
