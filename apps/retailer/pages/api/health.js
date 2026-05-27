/**
 * Health check simples do app retailer.
 * GET /api/health
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const criticalEnvVars = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  const missingEnvVars = criticalEnvVars.filter((name) => !process.env[name]);

  const payload = {
    status: missingEnvVars.length > 0 ? 'degraded' : 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    deploy:
      process.env.K_SERVICE || process.env.K_REVISION
        ? {
            service: process.env.K_SERVICE || null,
            revision: process.env.K_REVISION || null,
          }
        : undefined,
    checks: {
      server: 'ok',
      nextjs: 'ok',
      config: missingEnvVars.length > 0 ? 'missing_variables' : 'ok',
    },
    missingEnvVars: missingEnvVars.length > 0 ? missingEnvVars : undefined,
  };

  const statusCode = missingEnvVars.length > 0 ? 503 : 200;
  res.setHeader('Cache-Control', 'no-store');
  return res.status(statusCode).json(payload);
}
