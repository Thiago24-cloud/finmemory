import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { resolveOwnerUserId } from '../../lib/botPromoOwner.js';

function makeSupabaseMock(userRows: { id: string; email?: string }[]) {
  return {
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, value: string) => ({
          maybeSingle: async () => {
            const row = userRows.find((r) => r.id === value || r.email === value);
            return { data: row ?? null, error: null };
          },
        }),
      }),
    }),
  };
}

describe('resolveOwnerUserId', () => {
  beforeEach(() => {
    delete process.env.BOT_PROMO_OWNER_USER_ID;
    delete process.env.MAP_QUICK_ADD_BOT_USER_ID;
    delete process.env.FINMEMORY_ADMIN_EMAILS;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retorna null sem lançar exceção quando nenhuma env var está configurada e reviewer email não existe', async () => {
    const supabase = makeSupabaseMock([]);
    const result = await resolveOwnerUserId(supabase as any, 'naoexiste@example.com');
    expect(result).toBeNull();
  });

  it('retorna null sem lançar exceção quando reviewer email não existe em users', async () => {
    const supabase = makeSupabaseMock([{ id: 'outro-uuid', email: 'outro@example.com' }]);
    const result = await resolveOwnerUserId(supabase as any, 'semcadastro@example.com');
    expect(result).toBeNull();
  });
});
