/**
 * Health Check Endpoint
 * 
 * Útil para:
 * - Verificar se a aplicação está rodando
 * - Diagnóstico de problemas em produção
 * - Health checks do Cloud Run
 * 
 * GET /api/health
 */

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    /** Cloud Run injeta K_SERVICE / K_REVISION — útil para confirmar que vês o deploy novo. */
    deploy:
      process.env.K_REVISION || process.env.K_SERVICE
        ? {
            service: process.env.K_SERVICE || null,
            revision: process.env.K_REVISION || null,
          }
        : undefined,
    checks: {
      server: 'ok',
      nextjs: 'ok',
    }
  };

  // Verificar variáveis críticas (sem expor valores)
  const criticalEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ];

  const missingEnvVars = criticalEnvVars.filter(
    varName => !process.env[varName]
  );

  if (missingEnvVars.length > 0) {
    health.status = 'degraded';
    health.checks.config = 'missing_variables';
    health.missingEnvVars = missingEnvVars;
  } else {
    health.checks.config = 'ok';
  }

  // Diagnóstico de auth no Cloud Run (sem expor segredos — só true/false)
  if (process.env.K_SERVICE) {
    const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
    health.checks.authEnv = {
      nextauthSecret: Boolean(process.env.NEXTAUTH_SECRET),
      supabaseServiceRole: hasServiceRole,
      googleOAuth: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      nextauthSessionMode: hasServiceRole ? 'database+adapter' : 'jwt_fallback',
    };
    const authOk =
      health.checks.authEnv.nextauthSecret &&
      health.checks.authEnv.googleOAuth;
    if (!authOk) {
      health.status = 'degraded';
      health.checks.authEnv.hint =
        'Defina NEXTAUTH_SECRET, GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no serviço Cloud Run. Opcional: SUPABASE_SERVICE_ROLE_KEY para sessão em banco.';
    }
  }

  // Status code baseado no health
  const statusCode = health.status === 'ok' ? 200 : 503;

  // Adicionar headers de cache
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  return res.status(statusCode).json(health);
}
