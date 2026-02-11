<<<<<<< HEAD
# 🚀 FinMemory

**Automação Financeira Inteligente via Email**

O **FinMemory** é um assistente financeiro que automaticamente detecta, processa e organiza suas notas fiscais diretamente do seu Gmail usando Inteligência Artificial.

## ✨ Funcionalidades

- 🔐 **Login com Google** - Autenticação segura via OAuth
- 📧 **Sincronização automática** de emails com notas fiscais
- 🤖 **Processamento por IA** - Extração inteligente de dados (GPT-4)
- 💾 **Armazenamento organizado** - Banco de dados estruturado
- 📊 **Dashboard interativo** - Visualize todas as suas transações
- 🔄 **Atualização em tempo real** - Sincronize quando quiser

## 🛠️ Tecnologias

- **Frontend:** Next.js 14 + React 18
- **Banco de Dados:** Supabase (PostgreSQL)
- **Inteligência Artificial:** OpenAI GPT-4o-mini
- **Autenticação:** Google OAuth 2.0
- **API de Email:** Gmail API
- **Deploy:** Vercel

## 🚀 Quick Start

### 1. Clone o Repositório
```bash
git clone https://github.com/Thiago24-cloud/finmemory.git
cd finmemory
```

### 2. Instale Dependências
```bash
npm install
```

### 3. Configure Variáveis de Ambiente
```bash
cp .env.example .env.local
```

Edite `.env.local` com suas credenciais. Veja [CONFIGURAR-VERCEL.md](CONFIGURAR-VERCEL.md) para detalhes.

### 4. Valide Configuração
```bash
npm run validate-env
```

### 5. Inicie o Servidor de Desenvolvimento
```bash
npm run dev
```

Acesse: http://localhost:3000

## 📋 Configuração Completa

### Passo 1: Supabase
Crie conta e projeto em https://supabase.com

**Variáveis necessárias:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Passo 2: Google OAuth
Configure em https://console.cloud.google.com

**Variáveis necessárias:**
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` (pode ser múltiplas, separadas por vírgula):
   - http://localhost:3000/api/auth/callback/google
   - https://www.finmemory.com.br/api/auth/callback/google
   - https://finmemory.com.br/api/auth/callback/google

### Passo 3: OpenAI
Crie API key em https://platform.openai.com

**Variável necessária:**
- `OPENAI_API_KEY`

**📖 Guia completo:** [CONFIGURAR-VERCEL.md](CONFIGURAR-VERCEL.md)
**✅ Checklist rápido:** [CHECKLIST-DEPLOY.md](CHECKLIST-DEPLOY.md)

## 📁 Estrutura do Projeto

```
finmemory/
├── pages/                    # Páginas Next.js
│   ├── index.js             # Landing page
│   ├── dashboard.js         # Dashboard principal
│   └── api/                 # API routes
│       ├── auth/           # Autenticação Google
│       │   ├── google.js
│       │   └── callback.js
│       └── gmail/
│           └── sync.js      # Sincronização de emails
├── lib/                     # Utilitários
│   └── env-validator.js    # Validação de variáveis
├── scripts/                 # Scripts auxiliares
│   └── validate-env.js     # Script de validação
├── public/                  # Arquivos estáticos
├── .env.example            # Exemplo de variáveis
├── package.json
├── next.config.js
├── vercel.json
├── CONFIGURAR-VERCEL.md    # Guia de configuração
├── CHECKLIST-DEPLOY.md     # Checklist de deploy
├── MELHORIAS-IMPLEMENTADAS.md  # Relatório de melhorias
├── RESUMO-MELHORIAS.md     # Resumo executivo
└── README.md
```

## 🔧 Scripts NPM

```bash
npm run dev          # Inicia servidor de desenvolvimento
npm run build        # Build para produção (com validação)
npm run start        # Inicia servidor de produção
npm run lint         # Executa ESLint
npm run validate-env # Valida variáveis de ambiente
```

## 🎯 Como Funciona

1. **Usuário faz login** com Google OAuth
2. **Aplicação acessa Gmail** do usuário (somente leitura)
3. **Busca emails** com notas fiscais (NF-e, cupons, etc.)
4. **IA processa** cada nota fiscal extraindo:
   - Data e hora da compra
   - Nome do estabelecimento
   - Valor total
   - Lista de produtos com preços
5. **Salva no banco** de forma estruturada
6. **Exibe no dashboard** para o usuário visualizar

## 🔐 Segurança

- ✅ Autenticação OAuth 2.0 do Google
- ✅ Tokens armazenados de forma segura no Supabase
- ✅ Chaves secretas apenas no servidor (nunca no cliente)
- ✅ Acesso Gmail somente leitura (`gmail.readonly`)
- ✅ HTTPS obrigatório em produção
- ✅ Validação de variáveis de ambiente

## 📊 Banco de Dados (Supabase)

### Tabela: `users`
```sql
- id (uuid, primary key)
- email (text, unique)
- name (text)
- google_id (text)
- access_token (text)
- refresh_token (text)
- token_expiry (timestamp)
- last_sync (timestamp)
```

### Tabela: `transacoes`
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key)
- data (date)
- hora (time)
- estabelecimento (text)
- total (decimal)
- raw_email_body (text)
```

### Tabela: `produtos`
```sql
- id (uuid, primary key)
- transaction_id (uuid, foreign key)
- nome (text)
- quantidade (decimal)
- valor_unitario (decimal)
- valor_total (decimal)
```

## 🚀 Deploy na Vercel

### 1. Conecte o Repositório
1. Acesse https://vercel.com
2. Clique em "Import Project"
3. Conecte com GitHub
4. Selecione o repositório `finmemory`

### 2. Configure Variáveis de Ambiente
Adicione as 7 variáveis obrigatórias em **Settings → Environment Variables**

**Guia completo:** [CONFIGURAR-VERCEL.md](CONFIGURAR-VERCEL.md)

### 3. Deploy
A Vercel faz deploy automático a cada push na branch `main`.

**Script de validação roda automaticamente antes do build!**

## 🐛 Troubleshooting

### Erro: "supabaseUrl é obrigatório"
**Solução:** Configure `NEXT_PUBLIC_SUPABASE_URL` na Vercel

### Erro: "Variáveis do Google OAuth não configuradas"
**Solução:** Configure as 3 variáveis do Google e adicione o Redirect URI no Google Console

### Erro: "OPENAI_API_KEY não configurada"
**Solução:** Crie uma API key na OpenAI e configure na Vercel

**Guia completo de troubleshooting:** [CONFIGURAR-VERCEL.md](CONFIGURAR-VERCEL.md#-troubleshooting-resolução-de-problemas)

## 📚 Documentação

| Arquivo | Descrição |
|---------|-----------|
| [CONFIGURAR-VERCEL.md](CONFIGURAR-VERCEL.md) | Guia completo de configuração |
| [CHECKLIST-DEPLOY.md](CHECKLIST-DEPLOY.md) | Checklist rápido para deploy |
| [SETUP-ENV.md](SETUP-ENV.md) | Configuração de ambiente |
| [MELHORIAS-IMPLEMENTADAS.md](MELHORIAS-IMPLEMENTADAS.md) | Relatório de melhorias |
| [RESUMO-MELHORIAS.md](RESUMO-MELHORIAS.md) | Resumo executivo |
| [lib/README.md](lib/README.md) | Documentação dos utilitários |

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/NovaFuncionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/NovaFuncionalidade`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT.

## 👤 Autor

**Thiago24-cloud**
- GitHub: [@Thiago24-cloud](https://github.com/Thiago24-cloud)
- Projeto: [finmemory](https://github.com/Thiago24-cloud/finmemory)

## 🙏 Agradecimentos

- [Next.js](https://nextjs.org/) - Framework React
- [Supabase](https://supabase.com/) - Backend as a Service
- [OpenAI](https://openai.com/) - API de Inteligência Artificial
- [Google](https://developers.google.com/) - Gmail API e OAuth
- [Vercel](https://vercel.com/) - Plataforma de deploy

## 📞 Suporte

Para problemas ou dúvidas:
1. Consulte a [documentação](#-documentação)
2. Execute `npm run validate-env`
3. Abra uma [issue](https://github.com/Thiago24-cloud/finmemory/issues)

---

**⭐ Se este projeto foi útil, considere dar uma estrela no GitHub!**
=======
# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
>>>>>>> smart/main
