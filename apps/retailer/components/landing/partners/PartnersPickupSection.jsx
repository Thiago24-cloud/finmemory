'use client';

import { Camera, MapPinned, ShoppingCart } from 'lucide-react';

export function PartnersPickupSection() {
  return (
    <section id="compras" className="px-4 sm:px-6 py-16 sm:py-20 scroll-mt-20">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#39FF14] mb-3">
            Compra inteligente de insumos
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold m-0">
            Quando o fornecedor não compensa, o mapa mostra o melhor caminho.
          </h2>
          <p className="mt-4 text-white/60 leading-relaxed m-0">
            Restaurantes, lanchonetes e conveniências muitas vezes completam o estoque em mercados por causa de
            pedido mínimo, urgência ou variação de preço. O FinMemory transforma essa rotina em decisão com dados:
            preço perto da loja, lista por insumo e entrada automatizada no estoque.
          </p>
          <ul className="mt-6 space-y-3 list-none p-0 m-0">
            {[
              { Icon: ShoppingCart, text: 'Lista de compras com total estimado por mercado' },
              { Icon: MapPinned, text: 'Comparação por localização para escolher a melhor opção' },
              { Icon: Camera, text: 'Foto da nota ou papel para registrar entrada de estoque' },
            ].map(({ Icon, text }) => (
              <li key={text} className="flex gap-3 text-sm text-white/75">
                <Icon className="h-5 w-5 text-[#39FF14] shrink-0" aria-hidden />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl border border-[#39FF14]/25 bg-gradient-to-br from-[#39FF14]/10 to-transparent p-8">
          <p className="text-sm font-semibold text-[#39FF14] m-0">Fluxo típico</p>
          <div className="mt-6 space-y-4 text-sm">
            {['Estoque baixo', 'Preço monitorado', 'Melhor mercado encontrado', 'Compra registrada no estoque'].map(
              (label, i) => (
                <div key={label} className="flex items-center gap-3">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[#39FF14] text-[#050508] text-xs font-bold"
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <span className={i === 3 ? 'font-bold text-white' : 'text-white/70'}>{label}</span>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
