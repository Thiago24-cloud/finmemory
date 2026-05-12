'use client';

import { Mic, MicOff, Trash2, Check, Navigation } from 'lucide-react';
import Link from 'next/link';
import { emojiForShoppingItemName } from '../../lib/shoppingListEmoji';

/**
 * Bloco principal estilo Web 3.0 / Nubank dark — lista de notas + input + CTA mapa.
 */
export function ShoppingListWeb3Main({
  title = 'O que você precisa?',
  newName,
  setNewName,
  onSubmit,
  adding,
  voiceSupported,
  voiceListening,
  voiceContinuous,
  onVoiceClick,
  onVoiceContinuousToggle,
  noteItems,
  onToggleChecked,
  onDelete,
  mapaListaHref,
  listCount,
  voiceHint,
  placeholder = 'Digite aqui...',
}) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold tracking-tight text-white">{title}</h1>

      <form
        onSubmit={onSubmit}
        className="flex items-stretch gap-2 rounded-2xl border border-white/[0.08] bg-[#151b24] p-2 shadow-inner"
      >
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-xl border-0 bg-[#0d1117] px-3 py-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#27C86A]/40"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={onVoiceClick}
          disabled={!voiceSupported || voiceListening || adding || voiceContinuous}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#27C86A] to-[#12b34a] text-[#0a0e14] shadow-[0_4px_18px_rgba(39,200,106,0.35)] transition hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100"
          aria-label="Adicionar por voz"
          title={voiceSupported ? 'Voz' : 'Voz indisponível neste navegador'}
        >
          {voiceListening ? <MicOff className="h-5 w-5" strokeWidth={2.5} /> : <Mic className="h-5 w-5" strokeWidth={2.5} />}
        </button>
      </form>

      {voiceContinuous ? (
        <button
          type="button"
          onClick={onVoiceContinuousToggle}
          className="w-full rounded-xl border border-red-500/40 bg-red-500/10 py-2 text-xs font-bold text-red-300"
        >
          Parar escuta contínua
        </button>
      ) : (
        <button
          type="button"
          onClick={onVoiceContinuousToggle}
          disabled={!voiceSupported || adding}
          className="w-full rounded-xl border border-[#27C86A]/25 bg-[#27C86A]/10 py-2 text-xs font-semibold text-[#7bed9f] disabled:opacity-40"
        >
          Modo voz contínua
        </button>
      )}

      {voiceHint ? <p className="text-xs font-medium text-[#7bed9f]/90">{voiceHint}</p> : null}

      <ul className="space-y-3">
        {noteItems.map((item) => {
          const emoji = emojiForShoppingItemName(item.name);
          const label = String(item.name || '').toUpperCase();
          return (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#151b24] px-3 py-3 shadow-sm"
            >
              <button
                type="button"
                onClick={() => onToggleChecked(item)}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  item.checked
                    ? 'border-[#27C86A] bg-[#27C86A] text-[#0a0e14]'
                    : 'border-zinc-600 bg-transparent text-transparent hover:border-zinc-500'
                }`}
                aria-label={item.checked ? 'Desmarcar' : 'Marcar'}
              >
                {item.checked ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
              </button>
              <span
                className={`min-w-0 flex-1 text-left text-sm font-bold uppercase tracking-wide ${
                  item.checked ? 'text-zinc-500 line-through' : 'text-white'
                }`}
              >
                <span className="mr-2" aria-hidden>
                  {emoji}
                </span>
                {label}
                {item.quantity > 1 ? (
                  <span className="ml-1 text-[11px] font-semibold normal-case text-zinc-400">
                    ({item.quantity}
                    {item.unit ? ` ${item.unit}` : ''})
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                className="shrink-0 rounded-xl p-2 text-rose-400/90 transition hover:bg-rose-500/10 hover:text-rose-300"
                aria-label="Remover"
              >
                <Trash2 className="h-4 w-4" strokeWidth={2} />
              </button>
            </li>
          );
        })}
      </ul>

      <p className="text-sm font-bold text-white">
        Sua Lista ({listCount} {listCount === 1 ? 'item' : 'itens'})
      </p>

      <Link
        href={mapaListaHref}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#27C86A] to-[#1ed760] py-3.5 text-sm font-bold text-[#0a0e14] shadow-[0_10px_32px_rgba(39,200,106,0.28)] transition hover:brightness-105 active:scale-[0.99] no-underline"
      >
        <Navigation className="h-5 w-5 shrink-0" strokeWidth={2.25} />
        Localizar no Mapa de Preços
      </Link>
    </div>
  );
}
