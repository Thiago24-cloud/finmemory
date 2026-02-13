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
    <div className="min-h-screen bg-background text-foreground dark">
      <div className="max-w-md mx-auto px-5 py-6 pb-24">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-6">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <Settings className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Ajustes</h1>
            <p className="text-sm text-muted-foreground">Privacidade e conta</p>
          </div>
        </div>

        <div className="card-nubank overflow-hidden">
          <Link href="/privacidade" className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors border-b border-border">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <span className="text-foreground font-medium">Política de Privacidade</span>
          </Link>
          <Link href="/termos" className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors border-b border-border">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <span className="text-foreground font-medium">Termos de Uso</span>
          </Link>
          {status === 'authenticated' && session && (
            <button
              type="button"
              onClick={handleDisconnect}
              className="w-full flex items-center gap-4 p-4 hover:bg-destructive/10 transition-colors text-left text-destructive font-semibold"
            >
              <LogOut className="h-5 w-5" />
              <span>Sair da conta</span>
            </button>
          )}
        </div>

        {session?.user && (
          <p className="text-center text-muted-foreground text-sm mt-6">
            Conectado como {session.user.email}
          </p>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
