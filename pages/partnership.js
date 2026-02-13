import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ArrowLeft, Loader2, Users, Copy, Check } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import { getSupabase } from '../lib/supabase';

export default function PartnershipPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [partnership, setPartnership] = useState(null);
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  const userId = session?.user?.supabaseId || (typeof window !== 'undefined' && localStorage.getItem('user_id'));

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    fetchPartnership();
  }, [userId]);

  const fetchPartnership = async () => {
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('partnerships')
      .select('*')
      .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setPartnership(data || null);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!userId) return;
    setError(null);
    setCreating(true);
    try {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Configuração indisponível.');
      const code = Math.random().toString(36).slice(2, 10).toUpperCase();
      const { data, error: err } = await supabase
        .from('partnerships')
        .insert({ user_id_1: userId, invite_code: code, status: 'pending' })
        .select()
        .single();
      if (err) throw err;
      setPartnership(data);
    } catch (e) {
      setError(e.message || 'Erro ao criar parceria.');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    const code = inviteCode.trim().toUpperCase();
    if (!code || !userId) return;
    setError(null);
    setJoining(true);
    try {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Configuração indisponível.');
      const { data: row } = await supabase
        .from('partnerships')
        .select('id, user_id_1')
        .eq('invite_code', code)
        .eq('status', 'pending')
        .single();
      if (!row) {
        setError('Código inválido ou já utilizado.');
        setJoining(false);
        return;
      }
      if (row.user_id_1 === userId) {
        setError('Você não pode usar seu próprio código.');
        setJoining(false);
        return;
      }
      const { error: err } = await supabase
        .from('partnerships')
        .update({ user_id_2: userId, status: 'active' })
        .eq('id', row.id);
      if (err) throw err;
      await fetchPartnership();
    } catch (e) {
      setError(e.message || 'Erro ao entrar na parceria.');
    } finally {
      setJoining(false);
    }
  };

  const copyCode = () => {
    if (partnership?.invite_code) {
      navigator.clipboard.writeText(partnership.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#667eea]" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.replace('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-5 pb-24">
      <div className="max-w-md mx-auto">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-[#666] hover:text-[#333] text-sm mb-6">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <h1 className="text-xl font-bold text-[#333] mb-2 flex items-center gap-2">
          <Users className="h-6 w-6 text-[#667eea]" />
          Parceria
        </h1>
        <p className="text-sm text-[#666] mb-6">Compartilhe lista de compras com seu parceiro(a).</p>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-800 text-sm mb-4">{error}</div>
        )}

        {partnership ? (
          <div className="bg-white rounded-xl p-6 shadow-card-lovable space-y-4">
            <p className="text-sm text-[#666]">Status: <strong>{partnership.status}</strong></p>
            {partnership.status === 'pending' && (
              <>
                <p className="text-sm text-[#333]">Compartilhe este código com seu parceiro(a):</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-mono font-bold tracking-wider bg-[#f0f0f0] px-4 py-2 rounded-lg">
                    {partnership.invite_code}
                  </span>
                  <button
                    type="button"
                    onClick={copyCode}
                    className="p-2 rounded-lg hover:bg-[#f0f0f0]"
                    title="Copiar"
                  >
                    {copied ? <Check className="h-5 w-5 text-green-600" /> : <Copy className="h-5 w-5 text-[#666]" />}
                  </button>
                </div>
                <Link href="/shopping-list" className="block text-center py-2 text-[#667eea] font-medium">
                  Ir para Lista de compras
                </Link>
              </>
            )}
            {partnership.status === 'active' && (
              <Link href="/shopping-list" className="block w-full py-3 text-center bg-[#667eea] text-white font-semibold rounded-xl hover:bg-[#5a6fd6]">
                Abrir lista de compras
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl p-6 shadow-card-lovable mb-4">
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="w-full py-3 px-4 bg-[#667eea] text-white font-semibold rounded-xl hover:bg-[#5a6fd6] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creating ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                Criar parceria e gerar código
              </button>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-card-lovable">
              <p className="text-sm font-medium text-[#333] mb-2">Ou entre com um código:</p>
              <form onSubmit={handleJoin} className="flex gap-2">
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="Código"
                  maxLength={10}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#667eea] uppercase"
                />
                <button
                  type="submit"
                  disabled={joining || !inviteCode.trim()}
                  className="py-2 px-4 bg-[#28a745] text-white font-semibold rounded-lg hover:bg-[#218838] disabled:opacity-50 flex items-center gap-1"
                >
                  {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Entrar'}
                </button>
              </form>
            </div>
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
