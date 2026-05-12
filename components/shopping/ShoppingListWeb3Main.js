'use client';

import { Mic, MicOff, Trash2, Check, Navigation } from 'lucide-react';
import Link from 'next/link';
import { cn } from '../../lib/utils';
import { emojiForShoppingItemName } from '../../lib/shoppingListEmoji';

/**
 * Lista de compras — tema gamificado FinMemory (dark + primary neon + gradiente do DS).
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
      <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>

      <form
        onSubmit={onSubmit}
        className={cn(
          'flex items-stretch gap-2 rounded-2xl border border-border bg-card p-2 shadow-inner',
          'ring-1 ring-primary/10 shadow-[0_0_28px_-12px_hsl(var(--primary)/0.45)]'
        )}
      >
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'min-w-0 flex-1 rounded-xl border border-border/80 bg-background/80 px-3 py-3 text-sm text-foreground',
            'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50'
          )}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={onVoiceClick}
          disabled={!voiceSupported || voiceListening || adding || voiceContinuous}
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-primary-foreground',
            'gradient-primary shadow-[0_4px_22px_hsl(var(--primary)/0.45)] transition',
            'hover:brightness-110 active:scale-[0.97] disabled:opacity-40 disabled:hover:brightness-100 disabled:active:scale-100'
          )}
          aria-label="Adicionar por voz"
          title={voiceSupported ? 'Voz' : 'Voz indisponível neste navegador'}
        >
          {voiceListening ? (
            <MicOff className="h-5 w-5" strokeWidth={2.5} />
          ) : (
            <Mic className="h-5 w-5" strokeWidth={2.5} />
          )}
        </button>
      </form>

      {voiceContinuous ? (
        <button
          type="button"
          onClick={onVoiceContinuousToggle}
          className="w-full rounded-xl border border-destructive/40 bg-destructive/10 py-2 text-xs font-bold text-red-300"
        >
          Parar escuta contínua
        </button>
      ) : (
        <button
          type="button"
          onClick={onVoiceContinuousToggle}
          disabled={!voiceSupported || adding}
          className={cn(
            'w-full rounded-xl border border-primary/30 bg-primary/10 py-2 text-xs font-semibold text-primary',
            'shadow-[0_0_20px_-10px_hsl(var(--primary)/0.35)] disabled:opacity-40'
          )}
        >
          Modo voz contínua
        </button>
      )}

      {voiceHint ? <p className="text-xs font-medium text-primary/90">{voiceHint}</p> : null}

      <ul className="space-y-3">
        {noteItems.map((item, index) => {
          const emoji = emojiForShoppingItemName(item.name);
          const label = String(item.name || '').toUpperCase();
          return (
            <li
              key={item.id}
              style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
              className={cn(
                'flex animate-fade-in items-center gap-3 rounded-2xl border border-border bg-card px-3 py-3',
                'shadow-sm ring-1 ring-white/[0.03] transition-[box-shadow,border-color,transform] duration-200',
                'hover:border-primary/25 hover:shadow-[0_0_24px_-8px_hsl(var(--primary)/0.2)]'
              )}
            >
              <button
                type="button"
                onClick={() => onToggleChecked(item)}
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  item.checked
                    ? 'border-primary bg-primary text-primary-foreground shadow-[0_0_14px_hsl(var(--primary)/0.55)]'
                    : 'border-muted-foreground/50 bg-transparent text-transparent hover:border-primary/50'
                )}
                aria-label={item.checked ? 'Desmarcar' : 'Marcar'}
              >
                {item.checked ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
              </button>
              <span
                className={cn(
                  'min-w-0 flex-1 text-left text-sm font-bold uppercase tracking-wide',
                  item.checked ? 'text-muted-foreground line-through' : 'text-foreground'
                )}
              >
                <span className="mr-2" aria-hidden>
                  {emoji}
                </span>
                {label}
                {item.quantity > 1 ? (
                  <span className="ml-1 text-[11px] font-semibold normal-case text-muted-foreground">
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

      <p className="text-sm font-bold text-foreground">
        Sua Lista ({listCount} {listCount === 1 ? 'item' : 'itens'})
      </p>

      <Link
        href={mapaListaHref}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold no-underline',
          'gradient-primary text-white shadow-[0_10px_36px_-6px_hsl(var(--primary)/0.55)]',
          'transition hover:brightness-105 active:scale-[0.99]'
        )}
      >
        <Navigation className="h-5 w-5 shrink-0 text-white" strokeWidth={2.25} />
        Localizar no Mapa de Preços
      </Link>
    </div>
  );
}
