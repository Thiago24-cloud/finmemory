# Contexto para o Cursor — Open Finance (Pluggy)

Cole o bloco abaixo no início da conversa ao implementar integração Pluggy / Open Finance.

---

## Bloco principal

```
Projeto: FinMemory — finanças pessoais.
Stack: Next.js 15 com Pages Router (pasta pages/), Supabase, Cloud Run.
APIs: pages/api/*.js — seguir o mesmo estilo das rotas existentes.
Auth: NextAuth em pages/api/auth/[...nextauth].js (Google + adapter Supabase).
Open Finance via Pluggy (middleware).
Implementar em pages/api/pluggy/... e componentes em components/ — NÃO usar app/api/ nem App Router para isso.
Não alterar arquivos fora do escopo sem eu pedir.
```

---

## Detalhes do padrão de API neste repo

- Export default: `async function handler(req, res)` com checagem de `req.method`.
- Rotas expostas como `/api/...` (ex.: `pages/api/pluggy/connect-token.js` → `POST /api/pluggy/connect-token`).
- Para rotas que exigem usuário logado: usar `getServerSession` com `authOptions` importado de `./auth/[...nextauth]` (ajustar caminho relativo conforme a pasta).

## Variáveis de ambiente (exemplo)

Definir no `.env.local` e no Cloud Run quando existir integração:

- `PLUGGY_CLIENT_ID`
- `PLUGGY_CLIENT_SECRET`

(Documentação oficial: [Pluggy](https://docs.pluggy.ai).)
