/**
 * POST /api/ocr/import-nfce-xml
 *
 * Importa produtos e totais de um arquivo XML de NFC-e / NF-e (modelo 65).
 * Body: { xml: string }
 */

import { looksLikeNfceXml, parseNfceXml } from '../../../lib/parseNfceXml';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '2mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { xml } = req.body || {};
    const raw = String(xml || '').trim();

    if (!raw) {
      return res.status(400).json({
        success: false,
        error: 'Envie o conteúdo do arquivo XML da nota.',
      });
    }

    if (!looksLikeNfceXml(raw)) {
      return res.status(400).json({
        success: false,
        error: 'Arquivo não parece ser uma NFC-e válida (XML com infNFe / nfeProc).',
      });
    }

    const parsed = parseNfceXml(raw);
    if (!parsed) {
      return res.status(400).json({
        success: false,
        error: 'Não foi possível ler os dados do XML. Verifique se o arquivo está completo.',
      });
    }

    const hasItems = Array.isArray(parsed.itens) && parsed.itens.length > 0;
    const hasTotal = parsed.total != null && Number(parsed.total) > 0;
    if (!hasItems && !hasTotal) {
      return res.status(400).json({
        success: false,
        error: 'O XML não contém produtos nem valor total.',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        estabelecimento: parsed.estabelecimento || '',
        endereco: parsed.endereco || '',
        data: parsed.data || '',
        cnpj: parsed.cnpj || '',
        total: parsed.total,
        itens: parsed.itens || [],
        forma_pagamento: parsed.forma_pagamento || '',
        chave_nfe: parsed.chave_nfe || null,
        nfce_url: parsed.chave_nfe
          ? `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${parsed.chave_nfe}`
          : '',
      },
    });
  } catch (err) {
    console.error('import-nfce-xml error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Erro ao importar XML da nota',
    });
  }
}
