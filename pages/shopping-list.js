import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ArrowLeft, Loader2, Plus, Trash2, Check } from 'lucide-react';
import { getSupabase } from '../lib/supabase';

export default function ShoppingListPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [partnership, setPartnership] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const userId = session?.user?.supabaseId || (typeof window !== 'undefined' && localStorage.getItem('user_id'));

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    fetchPartnershipAndItems();
  }, [userId]);

  const fetchPartnershipAndItems = async () => {
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }
    const { data: p } = await supabase
      .from('partnerships')
      .select('id')
      .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    setPartnership(p || null);
    if (p) {
      const { data: list } = await supabase
        .from('shopping_list_items')
        .select('*')
        .eq('partnership_id', p.id)
        .order('created_at', { ascending: true });
      setItems(list || []);
    } else {
      setItems([]);
    }
    setLoading(false);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name || !partnership || !userId) return;
    setAdding(true);
    try {
      const supabase = getSupabase();
      if (!supabase) return;
      await supabase.from('shopping_list_items').insert({
        partnership_id: partnership.id,
        name,
        added_by: userId,
      });
      setNewName('');
      await fetchPartnershipAndItems();
    } finally {
      setAdding(false);
    }
  };

  const toggleChecked = async (item) => {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase
      .from('shopping_list_items')
      .update({
        checked: !item.checked,
        checked_by: !item.checked ? userId : null,
        checked_at: !item.checked ? new Date().toISOString() : null,
      })
      .eq('id', item.id);
    fetchPartnershipAndItems();
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover este item?')) return;
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.from('shopping_list_items').delete().eq('id', id);
    fetchPartnershipAndItems();
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

  if (!partnership) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] p-5">
        <div className="max-w-md mx-auto">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-[#666] hover:text-[#333] text-sm mb-6">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <div className="bg-white rounded-xl p-6 shadow-card-lovable text-center">
            <p className="text-[#666] mb-4">Você precisa de uma parceria ativa para usar a lista de compras.</p>
            <Link href="/partnership" className="inline-block py-3 px-4 bg-[#667eea] text-white font-semibold rounded-xl hover:bg-[#5a6fd6]">
              Ir para Parceria
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] p-5 pb-24">
      <div className="max-w-md mx-auto">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-[#666] hover:text-[#333] text-sm mb-6">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <h1 className="text-xl font-bold text-[#333] mb-4">Lista de compras</h1>

        <form onSubmit={handleAdd} className="flex gap-2 mb-6">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Novo item"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#667eea]"
          />
          <button
            type="submit"
            disabled={adding || !newName.trim()}
            className="p-2 bg-[#667eea] text-white rounded-lg hover:bg-[#5a6fd6] disabled:opacity-50"
          >
            <Plus className="h-5 w-5" />
          </button>
        </form>

        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 bg-white rounded-xl p-3 shadow-card-lovable"
            >
              <button
                type="button"
                onClick={() => toggleChecked(item)}
                className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center ${item.checked ? 'bg-[#28a745] border-[#28a745] text-white' : 'border-gray-300'}`}
              >
                {item.checked ? <Check className="h-4 w-4" /> : null}
              </button>
              <span className={`flex-1 ${item.checked ? 'line-through text-[#666]' : 'text-[#333]'}`}>
                {item.name}
                {item.quantity > 1 && ` (${item.quantity}${item.unit || ''})`}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(item.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        {items.length === 0 && (
          <p className="text-center text-[#666] py-8">Nenhum item. Adicione acima.</p>
        )}
      </div>
    </div>
  );
}
