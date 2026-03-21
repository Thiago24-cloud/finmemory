import { useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ArrowLeft, Settings, LogOut, FileText, Shield } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/dashboard');
  }, [status, router]);

  const handleDisconnect = async () => {
    if (confirm('Deseja realmente sair? Suas transações não serão perdidas.')) {
      if (typeof window !== 'undefined') localStorage.removeItem('user_id');
      await signOut({ callbackUrl: '/dashboard' });
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="max-w-md mx-auto px-5 py-6 pb-24">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 text-sm mb-6">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
            <Settings className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Ajustes</h1>
            <p className="text-sm text-gray-500">Privacidade e conta</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <Link href="/privacidade" className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors border-b border-gray-200 text-gray-900">
            <Shield className="h-5 w-5 text-gray-500" />
            <span className="font-medium">Política de Privacidade</span>
          </Link>
          <Link href="/termos" className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors border-b border-gray-200 text-gray-900">
            <FileText className="h-5 w-5 text-gray-500" />
            <span className="font-medium">Termos de Uso</span>
          </Link>
          {status === 'authenticated' && session && (
            <button
              type="button"
              onClick={handleDisconnect}
              className="w-full flex items-center gap-4 p-4 hover:bg-red-50 transition-colors text-left text-red-600 font-semibold"
            >
              <LogOut className="h-5 w-5" />
              <span>Sair da conta</span>
            </button>
          )}
        </div>

        {session?.user && (
          <p className="text-center text-gray-500 text-sm mt-6">
            Conectado como {session.user.email}
          </p>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
