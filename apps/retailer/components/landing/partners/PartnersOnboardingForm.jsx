'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { PARTNERS_FORM } from '../../../lib/partners/landingCopy';
import { SocialLoginButtons } from '../../auth/SocialLoginButtons';

const INITIAL = {
  responsibleName: '',
  businessName: '',
  documentTaxId: '',
  address: '',
  addressComplement: '',
  email: '',
  password: '',
  passwordConfirm: '',
};

export function PartnersOnboardingForm({ socialProviders = [] }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const loggedIn = status === 'authenticated' && Boolean(session?.user?.email);
  const [form, setForm] = useState(INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    const email = session?.user?.email;
    if (loggedIn && email) {
      setForm((prev) => ({ ...prev, email }));
    }
  }, [loggedIn, session?.user?.email]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!loggedIn) {
      if (form.password !== form.passwordConfirm) {
        setError('As senhas não coincidem.');
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        responsibleName: form.responsibleName,
        businessName: form.businessName,
        documentTaxId: form.documentTaxId,
        address: form.address,
        addressComplement: form.addressComplement,
      };

      const res = await fetch(loggedIn ? '/api/partners/complete-store' : '/api/partners/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          loggedIn
            ? payload
            : {
                ...payload,
                email: form.email,
                password: form.password,
              }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Não foi possível concluir o cadastro.');
        return;
      }
      if (loggedIn && data.redirectUrl) {
        await router.push(data.redirectUrl);
        return;
      }
      setSuccess({ loginUrl: data.loginUrl || '/login?callbackUrl=%2Fparceiros%2Fpainel' });
    } catch {
      setError('Erro de rede. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <section id="cadastro" className="px-4 sm:px-6 py-20 scroll-mt-20">
        <div className="max-w-lg mx-auto text-center rounded-3xl border border-[#39FF14]/30 bg-[#39FF14]/10 p-10">
          <CheckCircle2 className="h-14 w-14 text-[#39FF14] mx-auto mb-4" aria-hidden />
          <h2 className="text-2xl font-bold m-0">{PARTNERS_FORM.successTitle}</h2>
          <p className="mt-3 text-white/70 m-0">{PARTNERS_FORM.successBody}</p>
          <Link
            href={success.loginUrl}
            className="mt-8 inline-flex items-center justify-center rounded-xl bg-[#39FF14] px-8 py-3.5 font-bold text-[#050508] hover:bg-[#5dff3a] transition-colors"
          >
            Entrar no painel
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section id="cadastro" className="px-4 sm:px-6 py-16 sm:py-24 scroll-mt-20">
      <div className="max-w-xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold text-center m-0">{PARTNERS_FORM.title}</h2>
        <p className="text-center text-white/55 mt-3 m-0">
          {loggedIn
            ? 'Você já está logado. Preencha os dados da loja para vincular à sua conta e publicar ofertas.'
            : PARTNERS_FORM.subtitle}
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-10 space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8 backdrop-blur-sm"
        >
          <Field label="Nome do responsável" name="responsibleName" value={form.responsibleName} onChange={onChange} required placeholder="Maria Silva" />
          <Field label="Nome comercial da loja" name="businessName" value={form.businessName} onChange={onChange} required placeholder="Burger da Esquina" />
          <Field label="CPF ou CNPJ" name="documentTaxId" value={form.documentTaxId} onChange={onChange} required placeholder="00.000.000/0001-00" inputMode="numeric" />
          <Field label="Endereço completo" name="address" value={form.address} onChange={onChange} required placeholder="Rua, número, bairro, cidade — SP" />
          <Field label="Complemento (opcional)" name="addressComplement" value={form.addressComplement} onChange={onChange} placeholder="Sala, loja, referência" />
          {loggedIn ? (
            <p className="text-sm text-white/50 m-0 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
              Conta: <strong className="text-white">{session?.user?.email}</strong>
            </p>
          ) : (
            <>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-4">
                <p className="text-xs text-white/60 m-0 mb-3 text-center">Entre ou crie conta em um clique</p>
                <SocialLoginButtons
                  providers={socialProviders}
                  callbackUrl="/parceiros#cadastro"
                  disabled={loading}
                  variant="dark"
                />
              </div>
              <Field label="E-mail" name="email" type="email" value={form.email} onChange={onChange} required placeholder="contato@sualoja.com.br" autoComplete="email" />
              <Field label="Senha" name="password" type="password" value={form.password} onChange={onChange} required autoComplete="new-password" />
              <Field label="Confirmar senha" name="passwordConfirm" type="password" value={form.passwordConfirm} onChange={onChange} required autoComplete="new-password" />
            </>
          )}

          {error ? (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 m-0" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#39FF14] py-4 text-base font-bold text-[#050508] shadow-[0_0_28px_rgba(57,255,20,0.35)] hover:bg-[#5dff3a] disabled:opacity-60 transition-all active:scale-[0.98]"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
            {loggedIn ? 'Vincular loja e ir ao painel' : PARTNERS_FORM.submit}
          </button>

          <p className="text-[11px] text-white/40 text-center m-0 leading-relaxed">
            Ao cadastrar, você concorda com nossos{' '}
            <Link href="/termos" className="text-[#39FF14] hover:underline">
              Termos
            </Link>{' '}
            e{' '}
            <Link href="/privacidade" className="text-[#39FF14] hover:underline">
              Privacidade
            </Link>
            . Sua loja passará por revisão rápida antes de aparecer no mapa público.
          </p>
        </form>
      </div>
    </section>
  );
}

function Field({ label, name, value, onChange, type = 'text', required, placeholder, inputMode, autoComplete }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-white/70 mb-1.5 block">{label}</span>
      <input
        name={name}
        value={value}
        onChange={onChange}
        type={type}
        required={required}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        className="w-full rounded-xl border border-white/15 bg-[#0a0a10] px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#39FF14]/50 focus:border-[#39FF14]/50 transition-shadow"
      />
    </label>
  );
}
