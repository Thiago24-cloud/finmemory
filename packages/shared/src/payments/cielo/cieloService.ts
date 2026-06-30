import { getCieloConfigFromEnv } from './config';
import { evaluateCieloPaymentConfirmation } from './paymentStatus';
import type {
  CieloConfig,
  CieloCreatePaymentResult,
  CieloPaymentStatusResult,
  CieloQueryPaymentResponse,
  CieloSaleResponse,
  CreateCieloPaymentInput,
} from './types';
import { CieloApiError } from './types';

function randomRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `fm-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** MerchantOrderId Cielo: apenas a-z, A-Z, 0-9 (máx. 50). */
export function buildCieloMerchantOrderId(prefix: string, userId: string): string {
  const safeUser = String(userId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
  const safePrefix = String(prefix).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'FM';
  const stamp = Date.now().toString(36).toUpperCase();
  return `${safePrefix}${safeUser}${stamp}`.slice(0, 50);
}

function softDescriptorFromDescription(description: string): string {
  const cleaned = description
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .slice(0, 13);
  return cleaned || 'FinMemory';
}

function buildSaleBody(input: CreateCieloPaymentInput) {
  const base = {
    MerchantOrderId: input.merchantOrderId,
    Customer: { Name: input.customerName.slice(0, 255) },
    Payment: {
      Type: input.paymentMethod === 'pix' ? 'Pix' : 'CreditCard',
      Amount: input.amountCents,
      Description: input.description.slice(0, 255),
      Installments: input.installments ?? 1,
      SoftDescriptor: input.softDescriptor || softDescriptorFromDescription(input.description),
    } as Record<string, unknown>,
  };

  if (input.paymentMethod === 'credit_card') {
    if (!input.creditCard) {
      throw new Error('credit_card exige objeto creditCard no payload.');
    }
    base.Payment.CreditCard = {
      CardNumber: input.creditCard.cardNumber.replace(/\s/g, ''),
      Holder: input.creditCard.holder,
      ExpirationDate: input.creditCard.expirationDate,
      SecurityCode: input.creditCard.securityCode,
      Brand: input.creditCard.brand,
      SaveCard: input.creditCard.saveCard ?? false,
    };
  }

  return base;
}

function mapSaleResponse(
  raw: CieloSaleResponse,
  input: CreateCieloPaymentInput,
): CieloCreatePaymentResult {
  const payment = raw.Payment || {};
  const status = payment.Status ?? null;
  const evaluation = evaluateCieloPaymentConfirmation({
    status,
    returnCode: payment.ReturnCode ?? null,
  });

  return {
    merchantOrderId: raw.MerchantOrderId || input.merchantOrderId,
    paymentId: payment.PaymentId ? String(payment.PaymentId) : null,
    status: status as CieloCreatePaymentResult['status'],
    returnCode: payment.ReturnCode ?? null,
    returnMessage: payment.ReturnMessage ?? null,
    finmemoryState: evaluation.finmemoryState,
    isConfirmed: evaluation.isConfirmed,
    paymentMethod: input.paymentMethod === 'pix' ? 'Pix' : 'CreditCard',
    amountCents: input.amountCents,
    pix:
      input.paymentMethod === 'pix'
        ? {
            qrCodeBase64: payment.QrCodeBase64 ?? null,
            qrCodeString: payment.QrCodeString ?? null,
          }
        : undefined,
    raw,
  };
}

function mapQueryResponse(
  paymentId: string,
  raw: CieloQueryPaymentResponse,
): CieloPaymentStatusResult {
  const payment = raw.Payment || {};
  const status = payment.Status ?? null;
  const evaluation = evaluateCieloPaymentConfirmation({
    status,
    returnCode: payment.ReturnCode ?? null,
  });

  return {
    paymentId,
    status: status as CieloPaymentStatusResult['status'],
    returnCode: payment.ReturnCode ?? null,
    returnMessage: payment.ReturnMessage ?? null,
    finmemoryState: evaluation.finmemoryState,
    isConfirmed: evaluation.isConfirmed,
    raw,
  };
}

export class CieloService {
  constructor(private readonly config: CieloConfig) {}

  private async request<T>(
    baseUrl: string,
    path: string,
    init: RequestInit,
  ): Promise<T> {
    const url = `${baseUrl.replace(/\/$/, '')}${path}`;
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json');
    headers.set('MerchantId', this.config.merchantId);
    headers.set('MerchantKey', this.config.merchantKey);
    if (!headers.has('RequestId')) {
      headers.set('RequestId', randomRequestId());
    }

    const response = await fetch(url, { ...init, headers });
    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }

    if (!response.ok) {
      throw new CieloApiError(
        `Cielo API ${response.status}: ${typeof body === 'object' && body && 'Message' in (body as object) ? String((body as { Message?: string }).Message) : response.statusText}`,
        response.status,
        body,
      );
    }

    return body as T;
  }

  async createPayment(
    input: CreateCieloPaymentInput,
  ): Promise<CieloCreatePaymentResult> {
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
      throw new Error('amountCents deve ser inteiro positivo (centavos).');
    }

    const body = buildSaleBody(input);
    const raw = await this.request<CieloSaleResponse>(
      this.config.transactionBaseUrl,
      '/1/sales/',
      { method: 'POST', body: JSON.stringify(body) },
    );

    return mapSaleResponse(raw, input);
  }

  async getPaymentStatus(paymentId: string): Promise<CieloPaymentStatusResult> {
    const id = String(paymentId || '').trim();
    if (!id) throw new Error('paymentId é obrigatório.');

    const raw = await this.request<CieloQueryPaymentResponse>(
      this.config.queryBaseUrl,
      `/1/sales/${encodeURIComponent(id)}`,
      { method: 'GET' },
    );

    return mapQueryResponse(id, raw);
  }
}

export function getCieloService(
  env: NodeJS.ProcessEnv = process.env,
): CieloService | null {
  const config = getCieloConfigFromEnv(env);
  if (!config) return null;
  return new CieloService(config);
}
