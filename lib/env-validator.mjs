/**
 * Utilitário centralizado para validação de variáveis de ambiente
 * Evita duplicação de código e garante consistência
 * @module env-validator
 */

// Configuração das variáveis de ambiente esperadas
export const ENV_VARS = {
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: {
    required: true,
    public: true,
    description: 'URL do projeto Supabase',
    example: 'https://xxxxx.supabase.co'
  },
  NEXT_PUBLIC_SUPABASE_ANON_KEY: {
    required: true,
    public: true,
    description: 'Chave pública (anon) do Supabase',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    required: true,
    public: false,
    description: 'Chave de serviço (service_role) do Supabase - SECRETA',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  },
  
  // NextAuth
  NEXTAUTH_URL: {
    required: true,
    public: false,
    description: 'URL base do aplicativo',
    example: 'https://finmemory.vercel.app'
  },
  NEXTAUTH_SECRET: {
    required: true,
    public: false,
    description: 'Chave secreta para criptografia de sessão - SECRETA',
    example: 'gere-com-openssl-rand-base64-32'
  },
  
  // Google OAuth
  GOOGLE_CLIENT_ID: {
    required: true,
    public: false,
    description: 'Client ID do Google OAuth',
    example: '123456789-xxxxx.apps.googleusercontent.com'
  },
  GOOGLE_CLIENT_SECRET: {
    required: true,
    public: false,
    description: 'Client Secret do Google OAuth - SECRETO',
    example: 'GOCSPX-xxxxxxxxxxxxxx'
  },
  
  // OpenAI
  OPENAI_API_KEY: {
    required: true,
    public: false,
    description: 'API Key da OpenAI - SECRETA',
    example: 'sk-proj-xxxxxxxxxxxxxxxx'
  }
};

/**
 * Valida se uma variável de ambiente específica está configurada
 * @param {string} name - Nome da variável de ambiente
 * @returns {object} Resultado da validação
 */
export function validateEnvVar(name) {
  const value = process.env[name];
  const config = ENV_VARS[name];
  
  if (!config) {
    return { valid: true, message: 'Variável não monitorada' };
  }
  
  if (config.required && !value) {
    return {
      valid: false,
      message: `❌ ${name} não está configurada`,
      description: config.description,
      example: config.example
    };
  }
  
  return { valid: true, message: `✅ ${name} configurada` };
}

/**
 * Valida um grupo de variáveis de ambiente
 * @param {string[]} varNames - Array com nomes das variáveis
 * @returns {object} Resultado da validação do grupo
 */
export function validateEnvGroup(varNames) {
  const results = [];
  let allValid = true;
  
  for (const name of varNames) {
    const result = validateEnvVar(name);
    results.push({ name, ...result });
    if (!result.valid) {
      allValid = false;
    }
  }
  
  return { allValid, results };
}

/**
 * Valida todas as variáveis necessárias para o Supabase
 * @returns {object} Resultado da validação
 */
export function validateSupabase() {
  return validateEnvGroup([
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ]);
}

/**
 * Valida todas as variáveis necessárias para o NextAuth
 * @returns {object} Resultado da validação
 */
export function validateNextAuth() {
  return validateEnvGroup([
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET'
  ]);
}

/**
 * Valida todas as variáveis necessárias para o Google OAuth
 * @returns {object} Resultado da validação
 */
export function validateGoogleOAuth() {
  return validateEnvGroup([
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET'
  ]);
}

/**
 * Valida todas as variáveis necessárias para o OpenAI
 * @returns {object} Resultado da validação
 */
export function validateOpenAI() {
  return validateEnvGroup(['OPENAI_API_KEY']);
}

/**
 * Valida TODAS as variáveis de ambiente obrigatórias
 * @returns {object} Resultado da validação completa
 */
export function validateAllEnv() {
  const allVarNames = Object.keys(ENV_VARS).filter(
    name => ENV_VARS[name].required
  );
  return validateEnvGroup(allVarNames);
}

/**
 * Gera relatório detalhado de validação
 * @returns {object} Relatório completo de validação
 */
export function generateValidationReport() {
  const report = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    supabase: validateSupabase(),
    nextAuth: validateNextAuth(),
    googleOAuth: validateGoogleOAuth(),
    openai: validateOpenAI(),
    overall: validateAllEnv()
  };
  
  return report;
}

/**
 * Exibe relatório de validação no console
 * @returns {object} Relatório gerado
 */
export function logValidationReport() {
  console.log('\n========================================');
  console.log('🔍 VALIDAÇÃO DE VARIÁVEIS DE AMBIENTE');
  console.log('========================================\n');
  
  const report = generateValidationReport();
  
  console.log(`📅 Data: ${report.timestamp}`);
  console.log(`🌍 Ambiente: ${report.environment}\n`);
  
  // Supabase
  console.log('📦 SUPABASE:');
  report.supabase.results.forEach(r => {
    console.log(`  ${r.message}`);
    if (!r.valid) {
      console.log(`     → ${r.description}`);
      console.log(`     → Exemplo: ${r.example}`);
    }
  });
  
  // NextAuth
  console.log('\n🔐 NEXTAUTH:');
  report.nextAuth.results.forEach(r => {
    console.log(`  ${r.message}`);
    if (!r.valid) {
      console.log(`     → ${r.description}`);
      console.log(`     → Exemplo: ${r.example}`);
    }
  });
  
  // Google OAuth
  console.log('\n🔑 GOOGLE OAUTH:');
  report.googleOAuth.results.forEach(r => {
    console.log(`  ${r.message}`);
    if (!r.valid) {
      console.log(`     → ${r.description}`);
      console.log(`     → Exemplo: ${r.example}`);
    }
  });
  
  // OpenAI
  console.log('\n🤖 OPENAI:');
  report.openai.results.forEach(r => {
    console.log(`  ${r.message}`);
    if (!r.valid) {
      console.log(`     → ${r.description}`);
      console.log(`     → Exemplo: ${r.example}`);
    }
  });
  
  // Resumo
  console.log('\n========================================');
  if (report.overall.allValid) {
    console.log('✅ TODAS AS VARIÁVEIS ESTÃO CONFIGURADAS!');
  } else {
    console.log('❌ ALGUMAS VARIÁVEIS ESTÃO FALTANDO!');
    console.log('\n📋 Variáveis faltando:');
    report.overall.results
      .filter(r => !r.valid)
      .forEach(r => console.log(`  - ${r.name}`));
  }
  console.log('========================================\n');
  
  return report;
}

/**
 * Middleware Express/Next.js para validar env vars antes de processar request
 * @param {string[]} requiredVars - Variáveis requeridas
 * @returns {Function} Middleware function
 */
export function createValidationMiddleware(requiredVars) {
  return function(req, res, next) {
    const validation = validateEnvGroup(requiredVars);
    
    if (!validation.allValid) {
      const missing = validation.results
        .filter(r => !r.valid)
        .map(r => r.name);
      
      console.error('❌ Variáveis de ambiente faltando:', missing);
      
      if (res.redirect) {
        return res.redirect('/dashboard?error=config_error');
      }
      
      return res.status(500).json({
        success: false,
        error: 'Configuração do servidor incompleta',
        missing: missing
      });
    }
    
    if (next) next();
  };
}

// Export default para compatibilidade
export default {
  ENV_VARS,
  validateEnvVar,
  validateEnvGroup,
  validateSupabase,
  validateNextAuth,
  validateGoogleOAuth,
  validateOpenAI,
  validateAllEnv,
  generateValidationReport,
  logValidationReport,
  createValidationMiddleware
};
