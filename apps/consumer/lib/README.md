# 🔧 Utilitários - Biblioteca

Esta pasta contém utilitários reutilizáveis para o projeto FinMemory.

## 📁 Conteúdo

### `env-validator.js` - Validação de Variáveis de Ambiente

Utilitário centralizado para validar variáveis de ambiente, evitando duplicação de código e garantindo mensagens consistentes.

#### 🎯 Propósito

- Validar se todas as variáveis obrigatórias estão configuradas
- Fornecer mensagens de erro descritivas
- Facilitar debugging de problemas de configuração
- Centralizar lógica de validação

#### 📖 Uso

##### Importar Funções

```javascript
const { 
  validateSupabase,
  validateGoogleOAuth,
  validateOpenAI,
  validateAllEnv,
  logValidationReport 
} = require('../lib/env-validator');
```

##### Validar Grupo Específico

```javascript
// Validar apenas Supabase
const supabaseValidation = validateSupabase();

if (!supabaseValidation.allValid) {
  console.error('Variáveis do Supabase não configuradas!');
  supabaseValidation.results.forEach(r => {
    if (!r.valid) {
      console.error(`- ${r.name}: ${r.description}`);
    }
  });
}
```

##### Validar Tudo

```javascript
// Validar todas as variáveis obrigatórias
const validation = validateAllEnv();

if (!validation.allValid) {
  const missing = validation.results
    .filter(r => !r.valid)
    .map(r => r.name);
  
  console.error('Variáveis faltando:', missing);
}
```

##### Gerar Relatório Completo

```javascript
// Exibe relatório detalhado no console
const report = logValidationReport();

// report contém:
// - timestamp
// - environment (dev/prod)
// - supabase: { allValid, results }
// - googleOAuth: { allValid, results }
// - openai: { allValid, results }
// - overall: { allValid, results }
```

#### 🔍 Estrutura de Resultado

Cada validação retorna:

```javascript
{
  allValid: boolean,  // true se todas estão OK
  results: [
    {
      name: string,         // Nome da variável
      valid: boolean,       // Se está configurada
      message: string,      // Mensagem de status
      description: string,  // Descrição do propósito (se inválida)
      example: string      // Exemplo de formato (se inválida)
    }
  ]
}
```

#### 📋 Variáveis Monitoradas

##### Supabase (3 variáveis)
- `NEXT_PUBLIC_SUPABASE_URL` - URL do projeto
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Chave pública
- `SUPABASE_SERVICE_ROLE_KEY` - Chave de serviço (secreta)

##### Google OAuth (3 variáveis)
- `GOOGLE_CLIENT_ID` - Client ID
- `GOOGLE_CLIENT_SECRET` - Client Secret (secreto)
- `GOOGLE_REDIRECT_URI` - URLs de redirecionamento autorizadas, separadas por vírgula:
  - http://localhost:3000/api/auth/callback/google
  - https://www.finmemory.com.br/api/auth/callback/google
  - https://finmemory.com.br/api/auth/callback/google

##### OpenAI (1 variável)
- `OPENAI_API_KEY` - API Key (secreta)

**Total: 7 variáveis obrigatórias**

#### 🎨 Exemplos de Uso Real

##### No arquivo de API

```javascript
import { validateSupabase, validateGoogleOAuth } from '../../lib/env-validator';

export default async function handler(req, res) {
  // Validar antes de processar request
  const googleValidation = validateGoogleOAuth();
  if (!googleValidation.allValid) {
    console.error('❌ Google OAuth não configurado!');
    return res.status(500).json({
      error: 'Configuração incompleta',
      missing: googleValidation.results
        .filter(r => !r.valid)
        .map(r => r.name)
    });
  }
  
  // Processar request normalmente...
}
```

##### No script de validação

```javascript
const { logValidationReport, validateAllEnv } = require('../lib/env-validator');

// Exibir relatório
const report = logValidationReport();

// Falhar se houver problemas
if (!report.overall.allValid) {
  console.error('Validação falhou!');
  process.exit(1);
}

console.log('✅ Todas as variáveis configuradas!');
```

##### No middleware

```javascript
const { createValidationMiddleware } = require('../lib/env-validator');

// Criar middleware que valida variáveis específicas
const validateEnv = createValidationMiddleware([
  'NEXT_PUBLIC_SUPABASE_URL',
  'GOOGLE_CLIENT_ID',
  'OPENAI_API_KEY'
]);

// Usar em rota Express/Next.js
app.use('/api/protected', validateEnv, (req, res) => {
  // Só executa se variáveis estiverem OK
});
```

#### ⚙️ Configuração

Para adicionar nova variável ao monitoramento:

1. Abra `lib/env-validator.js`
2. Adicione entrada no objeto `ENV_VARS`:

```javascript
const ENV_VARS = {
  // ... variáveis existentes
  
  NOVA_VARIAVEL: {
    required: true,           // Se é obrigatória
    public: false,            // Se é exposta no cliente
    description: 'Descrição', // Para que serve
    example: 'exemplo-valor'  // Formato esperado
  }
};
```

3. Crie função de validação específica (opcional):

```javascript
function validateNovoServico() {
  return validateEnvGroup(['NOVA_VARIAVEL']);
}
```

#### 🧪 Testes

Para testar o validador:

```bash
# Executar script de validação
npm run validate-env

# Ou diretamente
node scripts/validate-env.js
```

#### 📊 Benefícios

✅ **Código limpo:** Elimina duplicação de validações
✅ **Mensagens claras:** Erros descritivos e acionáveis
✅ **Fácil manutenção:** Mudanças em um só lugar
✅ **Documentação integrada:** Descrições e exemplos inclusos
✅ **Debugging rápido:** Relatórios detalhados
✅ **Prevenção:** Detecta problemas antes do deploy

#### 🔗 Arquivos Relacionados

- [`scripts/validate-env.js`](../scripts/validate-env.js) - Script que usa o validador
- [`CONFIGURAR-VERCEL.md`](../CONFIGURAR-VERCEL.md) - Guia de configuração
- [`.env.example`](../.env.example) - Exemplo de variáveis
- [`CHECKLIST-DEPLOY.md`](../CHECKLIST-DEPLOY.md) - Checklist de deploy

---

## 🚀 Próximos Utilitários Planejados

- `logger.js` - Sistema de logs estruturados
- `rate-limiter.js` - Controle de taxa de requisições
- `error-handler.js` - Tratamento centralizado de erros
- `cache.js` - Sistema de cache para respostas
- `health-check.js` - Verificação de saúde dos serviços

---

**Última atualização:** 17/01/2026
