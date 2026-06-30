/** Ambiente Cielo eCommerce (REST). */
export type CieloEnvironment = 'sandbox' | 'production';

export type CieloPaymentMethodType = 'Pix' | 'CreditCard';

/** Status numérico retornado em `Payment.Status` pela Cielo. */
export type CieloPaymentStatusCode = 0 | 1 | 2 | 3 | 10 | 11 | 12 | 13 | 20;

/** Estado canónico do FinMemory para auditoria e UI. */
export type FinMemoryPaymentState =
  | 'pending'
  | 'authorized'
  | 'paid'
  | 'denied'
  | 'cancelled'
  | 'refunded'
  | 'aborted'
  | 'unknown';

export interface CieloConfig {
  merchantId: string;
  merchantKey: string;
  environment: CieloEnvironment;
  transactionBaseUrl: string;
  queryBaseUrl: string;
}

export interface CreateCieloPaymentInput {
  merchantOrderId: string;
  amountCents: number;
  description: string;
  customerName: string;
  softDescriptor?: string;
  paymentMethod: 'pix' | 'credit_card';
  installments?: number;
  creditCard?: {
    cardNumber: string;
    holder: string;
    expirationDate: string;
    securityCode: string;
    brand: string;
    saveCard?: boolean;
  };
}

export interface CieloPaymentPayload {
  PaymentId?: string;
  Status?: number;
  ReturnCode?: string;
  ReturnMessage?: string;
  Type?: string;
  Amount?: number;
  QrCodeBase64?: string;
  QrCodeString?: string;
  ProofOfSale?: string;
  Tid?: string;
  AuthorizationCode?: string;
}

export interface CieloSaleResponse {
  MerchantOrderId?: string;
  Customer?: { Name?: string };
  Payment?: CieloPaymentPayload;
}

export interface CieloQueryPaymentResponse {
  MerchantOrderId?: string;
  Payment?: CieloPaymentPayload;
}

export interface CieloCreatePaymentResult {
  merchantOrderId: string;
  paymentId: string | null;
  status: CieloPaymentStatusCode | null;
  returnCode: string | null;
  returnMessage: string | null;
  finmemoryState: FinMemoryPaymentState;
  isConfirmed: boolean;
  paymentMethod: CieloPaymentMethodType;
  amountCents: number;
  pix?: {
    qrCodeBase64: string | null;
    qrCodeString: string | null;
  };
  raw: CieloSaleResponse;
}

export interface CieloPaymentStatusResult {
  paymentId: string;
  status: CieloPaymentStatusCode | null;
  returnCode: string | null;
  returnMessage: string | null;
  finmemoryState: FinMemoryPaymentState;
  isConfirmed: boolean;
  raw: CieloQueryPaymentResponse;
}

export class CieloApiError extends Error {
  readonly httpStatus: number;
  readonly body: unknown;

  constructor(message: string, httpStatus: number, body: unknown) {
    super(message);
    this.name = 'CieloApiError';
    this.httpStatus = httpStatus;
    this.body = body;
  }
}
