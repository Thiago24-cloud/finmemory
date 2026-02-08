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

  // Status code baseado no health
  const statusCode = health.status === 'ok' ? 200 : 503;

  // Adicionar headers de cache
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  return res.status(statusCode).json(health);
}
