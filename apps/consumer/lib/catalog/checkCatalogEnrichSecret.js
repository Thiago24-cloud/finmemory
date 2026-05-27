/**
 * @param {import('next').NextApiRequest} req
 */
export function checkCatalogEnrichSecret(req) {
  const secret =
    process.env.CATALOG_ENRICH_SECRET ||
    process.env.CATALOG_REGISTER_SECRET ||
    process.env.CRON_SECRET ||
    process.env.DIA_IMPORT_SECRET;
  if (!secret) return true;
  const provided =
    req.headers['x-cron-secret'] ||
    req.headers['X-Cron-Secret'] ||
    req.query?.secret;
  return provided === secret;
}
