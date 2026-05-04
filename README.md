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
- **Deploy:** Google Cloud Run (Docker + Cloud Build)

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

Edite `.env.local` com suas credenciais. Os **nomes** das variáveis são os mesmos usados no Cloud Run em produção; detalhes em [CONFIGURAR-VERCEL.md](CONFIGURAR-VERCEL.md) (guia legado de painel) e deploy em [docs/DEPLOY-GOOGLE-CLOUD-RUN.md](docs/DEPLOY-GOOGLE-CLOUD-RUN.md).

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
├── next.config.ts
├── Dockerfile              # Imagem Cloud Run (Next standalone)
├── cloudbuild.yaml         # Build + push + deploy no Run
├── CONFIGURAR-VERCEL.md    # Referência de variáveis (legado)
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

## 🚀 Deploy no Google Cloud Run

Produção usa **Container Registry** + **Cloud Build** + **Cloud Run** (região `southamerica-east1`, serviço `finmemory`).

### Do zero (resumo)

1. `gcloud config set project SEU_PROJECT_ID` e ativar APIs (`run`, `cloudbuild`, `containerregistry`) — ver guia.
2. Definir `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` e rodar na raiz:
   ```bash
   npm run deploy:cloud-run
   ```
   (equivale a `gcloud builds submit` com `cloudbuild.yaml`.)
3. Configurar **variáveis e segredos** do runtime no **Console do Cloud Run** (OpenAI, Supabase service role, NextAuth, Google OAuth, etc.).

**Guia completo:** [docs/DEPLOY-GOOGLE-CLOUD-RUN.md](docs/DEPLOY-GOOGLE-CLOUD-RUN.md)

> Não utilizamos Vercel para deploy desta app; ignore `CONFIGURAR-VERCEL.md` como “painel de hosting” e use-o só como lista de variáveis se fizer sentido.

## 🐛 Troubleshooting

### Erro: "supabaseUrl é obrigatório"
**Solução:** Confirme `NEXT_PUBLIC_SUPABASE_URL` no build (Dockerfile) e/ou variáveis do serviço Cloud Run.

### Erro: "Variáveis do Google OAuth não configuradas"
**Solução:** Configure as variáveis no **Cloud Run** e o Redirect URI no Google Console com a URL HTTPS do Run (ou domínio customizado).

### Erro: "OPENAI_API_KEY não configurada"
**Solução:** Crie uma API key na OpenAI e defina no **Cloud Run** (segredo ou variável).

**Guia completo de troubleshooting:** [CONFIGURAR-VERCEL.md](CONFIGURAR-VERCEL.md#-troubleshooting-resolução-de-problemas)

## 📚 Documentação

| Arquivo | Descrição |
|---------|-----------|
| [docs/DEPLOY-GOOGLE-CLOUD-RUN.md](docs/DEPLOY-GOOGLE-CLOUD-RUN.md) | Deploy produção (Cloud Run) |
| [CONFIGURAR-VERCEL.md](CONFIGURAR-VERCEL.md) | Lista de variáveis (referência; hosting legado) |
| [CHECKLIST-DEPLOY.md](CHECKLIST-DEPLOY.md) | Checklist (ajustar URLs para Cloud Run) |
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
- [Google Cloud Run](https://cloud.google.com/run) - Hospedagem da API e do Next.js em produção

## 📞 Suporte

Para problemas ou dúvidas:
1. Consulte a [documentação](#-documentação)
2. Execute `npm run validate-env`
3. Abra uma [issue](https://github.com/Thiago24-cloud/finmemory/issues)

---

**⭐ Se este projeto foi útil, considere dar uma estrela no GitHub!**
