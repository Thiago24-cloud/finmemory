import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, Settings, LogOut, FileText, Shield } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';

const ConnectBank = dynamic(() => import('../components/ConnectBank'), { ssr: false });

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [totpSecret, setTotpSecret] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [totpMsg, setTotpMsg] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/dashboard');
  }, [status, router]);

  useEffect(() => {
    const load = async () => {
      if (status !== 'authenticated') return;
      const resp = await fetch('/api/auth/2fa/status');
      const data = await resp.json().catch(() => ({}));
      setTwoFaEnabled(Boolean(data.enabled));
    };
    load();
  }, [status]);

  const handleDisconnect = async () => {
    if (confirm('Deseja realmente sair? Suas transações não serão perdidas.')) {
      if (typeof window !== 'undefined') localStorage.removeItem('user_id');
      await signOut({ callbackUrl: '/dashboard' });
    }
  };

  const handleStart2fa = async () => {
    setTotpMsg('');
    const resp = await fetch('/api/auth/2fa/setup', { method: 'POST' });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      setTotpMsg(data.error || 'Falha ao iniciar 2FA');
      return;
    }
    setTotpSecret(data.secret || '');
    setTotpMsg('2FA iniciado. Adicione o segredo no seu app autenticador e confirme o código.');
  };

  const handleEnable2fa = async () => {
    setTotpMsg('');
    const resp = await fetch('/api/auth/2fa/enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: totpCode }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      setTotpMsg(data.error || 'Código inválido');
      return;
    }
    setTwoFaEnabled(true);
    setTotpSecret('');
    setTotpCode('');
    setTotpMsg('2FA ativado com sucesso.');
  };

  const handleDisable2fa = async () => {
    setTotpMsg('');
    const resp = await fetch('/api/auth/2fa/disable', { method: 'POST' });
    if (resp.ok) {
      setTwoFaEnabled(false);
      setTotpSecret('');
      setTotpCode('');
      setTotpMsg('2FA desativado.');
      return;
    }
    setTotpMsg('Falha ao desativar 2FA.');
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

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mt-6">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900">Segurança da conta</h2>
            <p className="text-sm text-gray-500 mt-1">Ative 2FA (TOTP) para proteger contas sensíveis.</p>
          </div>
          <div className="p-4 border-b border-gray-200">
            <p className="text-sm mb-3">Status 2FA: <span className="font-semibold">{twoFaEnabled ? 'Ativo' : 'Inativo'}</span></p>
            {!twoFaEnabled ? (
              <div className="space-y-2">
                <button type="button" onClick={handleStart2fa} className="w-full rounded-lg py-2 border border-gray-300 text-sm">Iniciar configuração 2FA</button>
                {totpSecret ? (
                  <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                    <p className="text-xs text-gray-600">Segredo TOTP (copie para Google Authenticator/Authy):</p>
                    <p className="font-mono text-xs break-all mt-1">{totpSecret}</p>
                    <input
                      type="text"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value)}
                      placeholder="Código de 6 dígitos"
                      className="w-full mt-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <button type="button" onClick={handleEnable2fa} className="w-full mt-2 rounded-lg py-2 bg-[#2ECC49] text-white text-sm font-semibold">Confirmar e ativar</button>
                  </div>
                ) : null}
              </div>
            ) : (
              <button type="button" onClick={handleDisable2fa} className="w-full rounded-lg py-2 border border-red-200 text-red-600 text-sm">Desativar 2FA</button>
            )}
            {totpMsg ? <p className="text-xs text-gray-600 mt-2">{totpMsg}</p> : null}
          </div>
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900">Open Finance (Pluggy)</h2>
            <p className="text-sm text-gray-500 mt-1">
              Conecte seu banco para importar seus dados financeiros. Em conta trial da Pluggy, o fluxo usa o conector
              sandbox <span className="text-gray-700 font-medium">Pluggy Bank</span> (evita erro ao escolher banco real).
            </p>
          </div>
          <div className="p-4">
            {status === 'authenticated' ? (
              <ConnectBank
                onSuccess={() => {
                  if (typeof window !== 'undefined') {
                    alert('Banco conectado com sucesso. Você pode começar a sincronizar seus dados.');
                  }
                }}
                onError={(e) => {
                  const msg = e?.message || 'Falha ao conectar banco.';
                  if (typeof window !== 'undefined') alert(msg);
                }}
              />
            ) : (
              <p className="text-sm text-gray-500">Faça login para conectar seu banco.</p>
            )}
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
