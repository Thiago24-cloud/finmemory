import Head from 'next/head';
import Link from 'next/link';
import { getServerSession } from 'next-auth/next';
import { ArrowLeft, Bell, Calendar, Target, Receipt } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import { authOptions } from './api/auth/[...nextauth]';
import { canAccess } from '../lib/access-server';

export async function getServerSideProps(ctx) {
  try {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    if (!session?.user?.email) {
      return { redirect: { destination: '/login?callbackUrl=/notifications', permanent: false } };
    }
    const allowed = await canAccess(session.user.email);
    if (!allowed) {
      return { redirect: { destination: '/?msg=nao-cadastrado', permanent: false } };
    }
    return { props: {} };
  } catch (err) {
    return { redirect: { destination: '/login', permanent: false } };
  }
}

export default function NotificationsPage() {
  return (
    <>
      <Head>
        <title>Lembretes – Fin Memory</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="min-h-screen bg-[#f5f5f5] text-[#333]">
        <div className="max-w-md mx-auto px-5 py-6 pb-24">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-[#666] hover:text-[#333] text-sm mb-6"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-[#2ECC49]/10 flex items-center justify-center text-[#2ECC49]">
              <Bell className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-[#333]">Lembretes</h1>
              <p className="text-sm text-[#666]">Contas, metas e avisos</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-card-lovable p-6 text-center">
            <p className="text-[#666] mb-4">
              Em breve você poderá criar lembretes para:
            </p>
            <ul className="text-left space-y-3 text-sm text-[#555] mb-6">
              <li className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-[#2ECC49] shrink-0" />
                Contas e vencimentos
              </li>
              <li className="flex items-center gap-3">
                <Target className="h-5 w-5 text-[#2ECC49] shrink-0" />
                Metas de gastos do mês
              </li>
              <li className="flex items-center gap-3">
                <Receipt className="h-5 w-5 text-[#2ECC49] shrink-0" />
                Resumo semanal de compras
              </li>
            </ul>
            <p className="text-xs text-[#888]">
              O ícone do sino no dashboard traz você até aqui. Em uma próxima versão, os lembretes poderão ser configurados e enviados por e-mail ou notificação no celular.
            </p>
          </div>
        </div>
        <BottomNav />
      </div>
    </>
  );
}
