import type {
  CieloPaymentStatusCode,
  FinMemoryPaymentState,
} from './types';

const STATUS_LABELS: Record<number, string> = {
  0: 'Não finalizado',
  1: 'Autorizado',
  2: 'Pago (capturado)',
  3: 'Negado',
  10: 'Cancelado',
  11: 'Estornado',
  12: 'Pendente',
  13: 'Abortado',
  20: 'Agendado',
};

/**
 * Mapeia `Payment.Status` da Cielo para o estado interno do FinMemory.
 *
 * Referência Cielo eCommerce:
 * 0 NotFinished · 1 Authorized · 2 PaymentConfirmed · 3 Denied
 * 10 Voided · 11 Refunded · 12 Pending · 13 Aborted · 20 Scheduled
 */
export function mapCieloStatusToFinMemory(
  status: number | null | undefined,
): FinMemoryPaymentState {
  if (status == null || Number.isNaN(Number(status))) return 'unknown';
  switch (Number(status) as CieloPaymentStatusCode) {
    case 1:
      return 'authorized';
    case 2:
      return 'paid';
    case 3:
      return 'denied';
    case 10:
      return 'cancelled';
    case 11:
      return 'refunded';
    case 13:
      return 'aborted';
    case 0:
    case 12:
    case 20:
      return 'pending';
    default:
      return 'unknown';
  }
}

/** Pagamento confirmado para liberar produto/serviço no FinMemory. */
export function isCieloPaymentConfirmed(
  status: number | null | undefined,
): boolean {
  const code = Number(status);
  return code === 1 || code === 2;
}

/** Pagamento em andamento (ex.: Pix aguardando QR). */
export function isCieloPaymentPending(
  status: number | null | undefined,
): boolean {
  const state = mapCieloStatusToFinMemory(status);
  return state === 'pending';
}

/** Pagamento recusado ou encerrado sem sucesso. */
export function isCieloPaymentFailed(
  status: number | null | undefined,
): boolean {
  const state = mapCieloStatusToFinMemory(status);
  return (
    state === 'denied' ||
    state === 'cancelled' ||
    state === 'refunded' ||
    state === 'aborted'
  );
}

export function getCieloStatusLabel(
  status: number | null | undefined,
): string {
  if (status == null) return 'Desconhecido';
  return STATUS_LABELS[Number(status)] || `Status ${status}`;
}

/**
 * ReturnCode da Cielo — "4" ou "00" costumam indicar sucesso na autorização;
 * para Pix, "0" na geração do QR é comum. Use junto com `Payment.Status`.
 */
export function isCieloReturnCodeSuccessful(
  returnCode: string | null | undefined,
): boolean {
  const code = String(returnCode ?? '').trim();
  if (!code) return false;
  return code === '4' || code === '00' || code === '0' || code === '6';
}

export function evaluateCieloPaymentConfirmation(input: {
  status: number | null | undefined;
  returnCode?: string | null;
}): {
  finmemoryState: FinMemoryPaymentState;
  isConfirmed: boolean;
  statusLabel: string;
} {
  const finmemoryState = mapCieloStatusToFinMemory(input.status);
  const statusLabel = getCieloStatusLabel(input.status);
  const isConfirmed = isCieloPaymentConfirmed(input.status);

  return { finmemoryState, isConfirmed, statusLabel };
}
