/** Resposta HTTP quando falta confirmação de reutilização de CPF/CNPJ. */
export function documentTaxIdReuseHttpResponse(res, policyResult) {
  return res.status(428).json({
    error: policyResult.message,
    code: 'confirm_document_reuse',
    needsDocumentConfirmation: true,
  });
}
