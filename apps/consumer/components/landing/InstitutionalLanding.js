'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  BarChart3,
  ChevronRight,
  MapPin,
  Menu,
  Shield,
  Store,
  Wallet,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { CONTACT_EMAIL, LANDING_NAV } from '../../lib/landingConstants';

/** Classes literais no ficheiro para o Tailwind incluir no CSS de produção. */
const L = {
  sectionDark: 'bg-[#0a0f1a] text-white',
  sectionLight: 'bg-[#f8fafc] text-[#0f172a]',
  cardOnLight:
    'rounded-2xl border border-[#e2e8f0] bg-white text-[#0f172a] shadow-md shadow-black/5',
  cardOnDark:
    'rounded-2xl border border-white/10 bg-[#141c2e] text-white shadow-lg shadow-black/25',
  eyebrow: 'text-xs font-bold uppercase tracking-[0.2em] text-[#2ECC49]',
  titleOnDark: 'text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight m-0',
  titleOnLight: 'text-2xl sm:text-3xl lg:text-4xl font-bold text-[#0f172a] leading-tight m-0',
  bodyOnDark: 'text-white/85 leading-relaxed',
  bodyOnLight: 'text-[#475569] leading-relaxed',
  /** Subtítulos dos cards — verde marca (legível em fundo escuro). */
  cardSubtitle: 'text-lg font-bold text-[#2ECC49] m-0',
  cardSubtitleLg: 'text-xl font-bold text-[#2ECC49] m-0',
  itemSubtitle: 'font-semibold text-[#2ECC49] text-sm m-0 mb-1',
  cardBodyLight: 'text-[#475569] text-sm leading-relaxed m-0',
  cardBodyDark: 'text-white/85 text-sm leading-relaxed m-0',
};

function NavLink({ href, children, onClick, className }) {
  return (
    <a
      href={href}
      onClick={onClick}
      className={cn(
        'text-sm font-medium text-white/80 hover:text-white transition-colors',
        className
      )}
    >
      {children}
    </a>
  );
}

function SectionTitle({ id, eyebrow, title, className, onDark = false }) {
  return (
    <div id={id} className={cn('scroll-mt-24', className)}>
      {eyebrow ? <p className={cn(L.eyebrow, 'mb-3')}>{eyebrow}</p> : null}
      <h2 className={onDark ? L.titleOnDark : L.titleOnLight}>{title}</h2>
    </div>
  );
}

function PainCard({ icon: Icon, title, children }) {
  return (
    <article className={cn(L.cardOnDark, 'p-6 hover:border-[#2ECC49]/35 transition-colors h-full')}>
      <div className="w-11 h-11 rounded-xl bg-[#2ECC49]/20 flex items-center justify-center mb-4">
        <Icon className="h-5 w-5 text-[#2ECC49]" aria-hidden />
      </div>
      <h3 className={cn(L.cardSubtitle, 'mb-2')}>{title}</h3>
      <p className={L.cardBodyDark}>{children}</p>
    </article>
  );
}

function ProfileColumn({ emoji, title, items }) {
  return (
    <div className={cn(L.cardOnDark, 'p-6 lg:p-8 h-full')}>
      <p className="text-2xl mb-2" aria-hidden>
        {emoji}
      </p>
      <h3 className={cn(L.cardSubtitleLg, 'mb-5')}>{title}</h3>
      <ul className="space-y-4 m-0 p-0 list-none">
        {items.map((item) => (
          <li key={item.title} className="flex gap-3">
            <span className="mt-1.5 w-2 h-2 rounded-full bg-[#2ECC49] shrink-0" aria-hidden />
            <div>
              <p className={L.itemSubtitle}>{item.title}</p>
              <p className={L.cardBodyDark}>{item.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PillarCard({ title, body, href, cta }) {
  return (
    <article className={cn(L.cardOnDark, 'p-6 h-full flex flex-col')}>
      <h3 className={cn(L.cardSubtitle, 'mb-3')}>{title}</h3>
      <p className={cn(L.cardBodyDark, 'flex-1')}>{body}</p>
      {href ? (
        <a
          href={href}
          className="mt-5 inline-flex items-center justify-center gap-1 rounded-xl bg-[#2ECC49] text-[#0a0f1a] text-sm font-bold px-4 py-2.5 hover:bg-[#22a83a] transition-colors"
        >
          {cta || 'Testar este plano'}
          <ChevronRight className="h-4 w-4" />
        </a>
      ) : null}
    </article>
  );
}

function MetricItem({ label, onDark = true }) {
  return (
    <li
      className={cn(
        'flex gap-3 items-start text-sm',
        onDark ? 'text-white/85' : 'text-[#334155]'
      )}
    >
      <ChevronRight className="h-4 w-4 text-[#2ECC49] shrink-0 mt-0.5" aria-hidden />
      <span>{label}</span>
    </li>
  );
}

function CtaButton({ href, children, variant = 'primary', className, onClick }) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-sm sm:text-base transition-all active:scale-[0.98]';
  const variants = {
    /** Ação principal: usar o app (login web/PWA). */
    primaryOutline:
      'border-2 border-[#2ECC49] text-[#2ECC49] bg-transparent hover:bg-[#2ECC49]/15 shadow-lg shadow-[#2ECC49]/20 px-6 py-3.5',
    primary: 'bg-[#2ECC49] text-white hover:bg-[#22a83a] shadow-lg shadow-[#2ECC49]/25 px-6 py-3.5',
    outline:
      'border-2 border-white/40 text-white hover:bg-white/10 px-6 py-3.5 backdrop-blur-sm',
    ghost: 'text-[#2ECC49] hover:bg-[#2ECC49]/10 px-4 py-2',
    muted: 'text-white/55 hover:text-white/80 text-sm font-medium px-2 py-2',
  };
  const isExternal = href.startsWith('http');
  const cls = cn(base, variants[variant], className);

  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <a href={href} className={cls} onClick={onClick}>
      {children}
    </a>
  );
}

export default function InstitutionalLanding({ accessNotice = null }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  const consumerItems = [
    {
      title: 'Open Finance Automatizado',
      body: 'Integração homologada via Pluggy. Conecta com todos os seus bancos e registra seus gastos de forma 100% automática.',
    },
    {
      title: 'Scanner NF-e por IA',
      body: 'Basta apontar a câmera para o QR Code de qualquer nota fiscal (com suporte para todas as SEFAZ do Brasil). Captura instantânea e zero digitação.',
    },
    {
      title: 'Mapa de Preços Real',
      body: 'Encontre onde está o produto que você quer, pelo menor preço, perto de você agora.',
    },
  ];

  return (
    <div className="finmemory-light-shell min-h-screen bg-[#fafbfc] text-[#0f172a] scroll-smooth">
      {accessNotice ? (
        <div
          role="alert"
          className="fixed top-16 inset-x-0 z-[60] border-b border-amber-500/40 bg-amber-950/95 px-4 py-3 text-center text-sm text-amber-100"
        >
          {accessNotice}{' '}
          <Link href="/login" className="font-semibold text-[#2ECC49] underline-offset-2 hover:underline">
            Entrar novamente
          </Link>
        </div>
      ) : null}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-white/10 bg-[#0a0f1a]/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <a href="#" className="flex items-center gap-2.5 shrink-0">
            <Image src="/logo.png" alt="FinMemory" width={36} height={36} className="rounded-lg" />
            <span className="font-bold text-white text-lg tracking-tight">FinMemory</span>
          </a>

          <nav className="hidden lg:flex items-center gap-8" aria-label="Menu principal">
            {LANDING_NAV.map((item) => (
              <NavLink key={item.href} href={item.href}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <Link
              href="/download"
              className="text-sm font-medium text-white/50 hover:text-white/75 transition-colors"
              title="Publicação na Google Play em breve"
            >
              Play Store em breve
            </Link>
            <CtaButton href="/login?callbackUrl=%2Finicio" variant="primaryOutline">
              Entrar
            </CtaButton>
          </div>

          <button
            type="button"
            className="lg:hidden p-2 text-white"
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {menuOpen ? (
          <nav
            className="lg:hidden border-t border-white/10 bg-[#0a0f1a] px-4 py-4 flex flex-col gap-3"
            aria-label="Menu mobile"
          >
            {LANDING_NAV.map((item) => (
              <NavLink key={item.href} href={item.href} onClick={closeMenu} className="py-2">
                {item.label}
              </NavLink>
            ))}
            <Link
              href="/download"
              onClick={closeMenu}
              className="py-2 text-sm font-medium text-white/50"
            >
              Play Store em breve
            </Link>
            <CtaButton href="/login?callbackUrl=%2Finicio" variant="primaryOutline" className="w-full mt-1" onClick={closeMenu}>
              Entrar
            </CtaButton>
          </nav>
        ) : null}
      </header>

      <main>
        <section className="relative pt-28 pb-20 sm:pt-32 sm:pb-28 overflow-hidden bg-[#0a0f1a]">
          <div
            className="absolute inset-0 opacity-40"
            style={{
              background:
                'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(46,204,73,0.35), transparent 60%)',
            }}
            aria-hidden
          />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#2ECC49] mb-4">
              GPS do consumo inteligente
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-[3.25rem] font-bold text-white leading-[1.1] max-w-4xl m-0 mb-6">
              O GPS do Consumo Inteligente e da Gestão Comercial.
            </h1>
            <p className="text-lg sm:text-xl text-white/75 max-w-3xl leading-relaxed m-0 mb-10">
              O primeiro ecossistema que une automação financeira e mapa de preços em tempo real,
              conectando as necessidades do consumidor ao estoque do pequeno varejista. O
              e-commerce resolve a sua semana que vem; o FinMemory resolve os seus próximos 15
              minutos.
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-start">
              <CtaButton href="/login?callbackUrl=%2Finicio" variant="primaryOutline">
                Entrar no FinMemory
              </CtaButton>
              <CtaButton href="#investimento" variant="outline">
                Área do Investidor / Pitch Deck
              </CtaButton>
            </div>
            <p className="mt-4 text-sm text-white/55 max-w-xl m-0">
              Use o app pelo navegador (Entrar). Publicação na Google Play em breve —{' '}
              <Link href="/download" className="text-[#2ECC49] hover:underline font-medium">
                saiba mais
              </Link>
              .
            </p>
          </div>
        </section>

        <section className={cn('py-20 sm:py-28', L.sectionDark)}>
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <SectionTitle
              id="historia"
              onDark
              eyebrow="A Nossa História"
              title="Do Balcão na Oscar Freire à Infraestrutura de Inteligência do Varejo Brasileiro."
            />
            <div className={cn('mt-10 space-y-5 text-base sm:text-lg', L.bodyOnDark)}>
              <p className="m-0">
                O FinMemory não nasceu em uma sala de reuniões isolada ou através de suposições de
                mercado. Ele nasceu na linha de frente do varejo físico.
              </p>
              <p className="m-0">
                Trabalhando no atendimento de uma farmácia na icônica Rua Oscar Freire, em São
                Paulo, eu testemunhava diariamente o mesmo paradoxo: o produto existia, o cliente
                tinha urgência, mas eles simplesmente não se encontravam. Vi mães de recém-nascidos
                entrarem desesperadas atrás de fraldas em tamanhos muito específicos (XG ou XXG) e
                saírem de mãos vazias. Vi estrangeiros tentando localizar de forma urgente
                medicamentos equivalentes aos de seus países de origem sem sucesso. O Google sabia
                onde ficava a farmácia, mas ninguém sabia o que estava, de fato, na prateleira
                naquele exato minuto.
              </p>
              <p className="m-0">
                A dor era clara: as pessoas precisavam de produtos com urgência, mas estavam
                completamente cegas quanto à disponibilidade local.
              </p>
              <p className="m-0">
                A ideia inicial parecia simples: criar um Mapa de Preços colaborativo. Porém, ao
                levar a tecnologia para as ruas e conversar diretamente com quem faz o comércio
                girar, descobri um gargalo ainda maior. O verdadeiro ponto cego não estava apenas no
                consumidor final, mas no pequeno varejista e comerciante de bairro.
              </p>
              <p className="m-0">
                O pequeno comerciante faz tudo sozinho: atende, vende e repõe estoque. Ele compra do
                fornecedor &quot;no olho&quot;, sem dados, e muitas vezes fecha as portas ou acorda de
                madrugada para rodar três ou quatro atacados em busca de preço. Quando volta, perde
                horas digitando notas fiscais ou alimentando planilhas manuais.
              </p>
              <p className="m-0 font-medium text-white">
                Percebendo isso, nós pivotamos a nossa tecnologia. O FinMemory evoluiu de um
                aplicativo de finanças para se tornar a infraestrutura de inteligência de compra,
                abastecimento e gestão do pequeno varejo brasileiro.
              </p>
            </div>
          </div>
        </section>

        <section id="ecossistema" className={cn('scroll-mt-24 py-20 sm:py-28', L.sectionLight)}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <SectionTitle
              eyebrow="O Ponto Cego do Mercado"
              title="O mercado físico ainda opera no escuro."
              className="text-center max-w-2xl mx-auto mb-12"
            />
            <div className="grid md:grid-cols-3 gap-6 mb-24">
              <PainCard icon={MapPin} title="Viagem Perdida (Consumidor)">
                O cliente busca um item de urgência à noite, roda a região e não encontra. O Google
                diz onde está a loja, mas não sabe o que tem na prateleira.
              </PainCard>
              <PainCard icon={Wallet} title="Preço no Escuro (Consumidor)">
                Sem comparação regional em tempo real, o consumidor paga mais caro sem saber. As
                grandes redes escondem os preços atrás de seus próprios ecossistemas fechados.
              </PainCard>
              <PainCard icon={Store} title="O Varejo Invisível (Comerciante)">
                Só em São Paulo, surgem 30 mil novos CNPJs de varejo por mês (SEBRAE/JUCESP). Donos
                de pequenos negócios compram seus estoques sem nenhum poder de comparação de dados ou
                rotas otimizadas.
              </PainCard>
            </div>

            <SectionTitle
              eyebrow="A Solução"
              title="Tecnologia inteligente que se molda a quem você é."
              className="text-center max-w-2xl mx-auto mb-12"
            />
            <div className="max-w-xl mx-auto">
              <ProfileColumn
                emoji="👤"
                title="Para o Consumidor Final"
                items={consumerItems}
              />
            </div>
          </div>
        </section>

        <section id="negocios" className={cn('scroll-mt-24 py-20 sm:py-28', L.sectionDark)}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <SectionTitle
              onDark
              eyebrow="Modelo de Negócios"
              title="Como o FinMemory gera valor e receita recorrente."
              className="text-center max-w-3xl mx-auto mb-12"
            />
            <div className="grid md:grid-cols-3 gap-6">
              <PillarCard
                title="B2C Assinaturas (Freemium)"
                body="Planos recorrentes para o consumidor final (Gratuito | Plus por R$ 9,90 | Pro por R$ 19,90 | Família por R$ 29,90). Libera recursos avançados de Open Finance, gerenciamento de limites e inteligência artificial preditiva."
                href="/login?callbackUrl=%2Finicio"
                cta="Testar planos consumidor"
              />
              <PillarCard
                title="B2B SaaS Varejo (O Motor de Inicialização)"
                body="Planos do lojista: Presença Digital, Pedidos Diretos, Estoque e Margem, e Gestão Completa (a partir de R$ 50,00/mês no pacote completo). Estoque por código de barras, pedidos e vitrine no mapa."
                href="/login?callbackUrl=%2Finicio"
                cta="Testar planos lojista"
              />
              <PillarCard
                title="B2B Canal & DaaS (Data as a Service)"
                body="Parcerias estratégicas com escritórios de contabilidade integrados (R$ 12,90/mês por cliente) e venda de relatórios de inteligência de mercado e Demanda Reprimida (o que as pessoas buscaram localmente e não encontraram) para grandes indústrias de bens de consumo (FMCG)."
              />
            </div>
          </div>
        </section>

        <section className="py-20 sm:py-24 bg-[#0a0f1a]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2ECC49] mb-4">
              O Nosso Fosso Competitivo
            </p>
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#2ECC49]/15 mb-6">
              <Shield className="h-7 w-7 text-[#2ECC49]" aria-hidden />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white m-0 mb-6">
              Proteção de Dados e Blindagem do Varejo.
            </h2>
            <p className="text-white/75 text-base sm:text-lg leading-relaxed m-0">
              Os lojistas têm receio de expor seus preços na internet com medo da concorrência
              agressiva ou de robôs que raspam dados. O FinMemory resolveu isso criando um algoritmo
              inteligente de blindagem contra arbitragem (Scraping). Apenas usuários reais, engajados
              e montando listas de consumo legítimas ganham acesso à visualização do mapa. Nós
              protegemos a margem e a segurança do lojista, criando uma relação de confiança mútua
              que nenhum concorrente tradicional consegue replicar.
            </p>
          </div>
        </section>

        <section id="investimento" className="scroll-mt-24 py-20 sm:py-28 bg-[#f0fdf4] text-[#0f172a]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <SectionTitle
              eyebrow="Tração & Tecnologia"
              title="Engenharia Robusta Pronta para Escalar."
              className="mb-12"
            />

            <div className="grid lg:grid-cols-2 gap-10">
              <div className={cn(L.cardOnDark, 'p-6 sm:p-8')}>
                <div className="flex items-center gap-2 mb-5">
                  <BarChart3 className="h-5 w-5 text-[#2ECC49]" aria-hidden />
                  <h3 className={L.cardSubtitle}>Métricas & Stack</h3>
                </div>
                <ul className="space-y-3 m-0 p-0 list-none">
                  <MetricItem label="Aplicativo publicado e funcional na Google Play (Next.js 15, Supabase, Google Cloud Run e IA)." />
                  <MetricItem label="Contrato e integração ativa em produção com Open Finance (Pluggy) e robôs de leitura em tempo real dos maiores players do mercado (Dia, Assaí, Atacadão, Sonda, etc.)." />
                </ul>
              </div>

              <div className={cn(L.cardOnDark, 'p-6 sm:p-8')}>
                <h3 className={cn(L.cardSubtitle, 'mb-4')}>A Oportunidade de Investimento</h3>
                <p className={cn(L.cardBodyDark, 'm-0 mb-4')}>
                  Estamos abrindo nossa rodada <strong className="text-white">Seed de R$ 500.000</strong>{' '}
                  (para 8% a 10% de equity), sob um Valuation Pré-money de{' '}
                  <strong className="text-white">R$ 5.000.000</strong>.
                </p>
                <p className="text-white/70 text-sm leading-relaxed m-0 mb-4">
                  <strong className="text-white/90">Destinação estratégica do capital:</strong> 40%
                  Engenharia & IA, 30% Marketing de Aquisição (SP + Canais de Contabilidade), 20%
                  Time Comercial B2B e 10% Reserva Técnica.
                </p>
                <p className="text-[#2ECC49] text-sm font-semibold m-0">
                  Objetivo: conquistar os primeiros 500 usuários pagantes e consolidar a
                  infraestrutura em São Paulo para expansão nacional.
                </p>
                <a
                  href={`mailto:${CONTACT_EMAIL}?subject=FinMemory%20-%20Pitch%20Deck`}
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white bg-[#2ECC49] hover:bg-[#22a83a] px-5 py-3 rounded-xl transition-colors"
                >
                  Solicitar Pitch Deck
                  <ChevronRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#0a0f1a] text-white py-14 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <blockquote className="text-lg sm:text-xl font-medium text-white/90 leading-relaxed m-0 mb-10 border-l-4 border-[#2ECC49] pl-5 text-left sm:text-center sm:border-l-0 sm:pl-0 sm:italic">
            &ldquo;Nós não estamos apenas criando um app. Estamos dando visão a quem estava cego no
            varejo físico.&rdquo;
          </blockquote>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-sm text-white/70 mb-6">
            <CtaButton href="/login?callbackUrl=%2Finicio" variant="primaryOutline" className="text-sm">
              Entrar no app
            </CtaButton>
            <Link href="/download" className="text-white/50 hover:text-white/80 transition-colors">
              Google Play (em breve)
            </Link>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="hover:text-white transition-colors"
            >
              {CONTACT_EMAIL}
            </a>
            <span>São Paulo — SP</span>
          </div>
          <p className="text-xs text-white/40 m-0">
            © {new Date().getFullYear()} FinMemory ·{' '}
            <Link href="/privacidade" className="underline hover:text-white/60">
              Privacidade
            </Link>
            {' · '}
            <Link href="/termos" className="underline hover:text-white/60">
              Termos
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
