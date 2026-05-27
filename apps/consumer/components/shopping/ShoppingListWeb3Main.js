'use client';

import { Mic, MicOff, Trash2, Check, Navigation, Minus, Plus } from 'lucide-react';
import Link from 'next/link';
import { cn } from '../../lib/utils';
import { emojiForShoppingItemName } from '../../lib/shoppingListEmoji';
import { CONSUMER_QUANTITY_PRESETS } from '../../lib/shoppingListQuantity';

/** Lista de compras — tema gamificado FinMemory (consumidor). */
export function ShoppingListWeb3Main({
  title = 'O que você precisa?',
  newName,
  setNewName,
  newQuantity = 1,
  setNewQuantity,
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
      <div className="flex items-start justify-between gap-2">
        <h1 className="text-xl font-bold tracking-tight text-foreground m-0">{title}</h1>
      </div>

      <form
        onSubmit={onSubmit}
        className={cn(
          'rounded-2xl border border-border bg-card p-2 shadow-inner space-y-2',
          'ring-1 ring-primary/10 shadow-[0_0_28px_-12px_hsl(var(--primary)/0.45)]'
        )}
      >
        <div className="flex items-stretch gap-2">
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
              'hover:brightness-110 active:scale-[0.97] disabled:opacity-40'
            )}
            aria-label="Adicionar por voz"
          >
            {voiceListening ? <MicOff className="h-5 w-5" strokeWidth={2.5} /> : <Mic className="h-5 w-5" strokeWidth={2.5} />}
          </button>
        </div>

        <ConsumerQuantityRow quantity={newQuantity} setQuantity={setNewQuantity} />

        <button
          type="submit"
          disabled={adding || !newName.trim()}
          className={cn(
            'w-full rounded-xl py-3 text-sm font-black text-primary-foreground',
            'gradient-primary shadow-[0_4px_22px_hsl(var(--primary)/0.45)]',
            'hover:brightness-110 active:scale-[0.98] disabled:opacity-40'
          )}
        >
          {adding ? 'Adicionando…' : 'Adicionar à lista'}
        </button>
      </form>

      {voiceHint ? <p className="text-[11px] text-muted-foreground m-0">{voiceHint}</p> : null}

      {voiceSupported ? (
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={voiceContinuous}
            onChange={(e) => onVoiceContinuousToggle?.(e.target.checked)}
            className="rounded border-border"
          />
          Modo contínuo (vários itens seguidos)
        </label>
      ) : null}

      {noteItems?.length ? (
        <>
          <ul className="space-y-2">
            {noteItems.map((item) => (
              <li
                key={item.id}
                className={cn(
                  'flex items-center gap-3 px-3 py-3 rounded-2xl border border-border bg-card/80',
                  item.checked && 'opacity-60'
                )}
              >
                <button
                  type="button"
                  onClick={() => onToggleChecked?.(item.id)}
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition',
                    item.checked
                      ? 'border-primary bg-primary/20 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/40'
                  )}
                  aria-label={item.checked ? 'Desmarcar' : 'Marcar'}
                >
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                </button>
                <span className="text-lg shrink-0" aria-hidden>
                  {emojiForShoppingItemName(item.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'font-semibold text-foreground m-0 truncate text-sm uppercase',
                      item.checked && 'line-through'
                    )}
                  >
                    {item.name}
                  </p>
                  {item.quantity > 1 ? (
                    <p className="text-[11px] text-muted-foreground m-0">Qtd: {item.quantity}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => onDelete?.(item.id)}
                  className="p-2 rounded-lg text-red-400 hover:bg-red-500/10"
                  aria-label="Remover"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>

          {mapaListaHref && listCount > 0 ? (
            <Link
              href={mapaListaHref}
              className={cn(
                'flex items-center justify-center gap-2 w-full rounded-2xl py-3.5 text-sm font-black',
                'border border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 transition'
              )}
            >
              <Navigation className="h-4 w-4" />
              Localizar no Mapa de Preços
              {listCount ? ` (${listCount})` : ''}
            </Link>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8 m-0">
          Sua lista está vazia. Adicione itens acima ou use o microfone.
        </p>
      )}
    </div>
  );
}

function ConsumerQuantityRow({ quantity, setQuantity }) {
  return (
    <div className="flex flex-wrap gap-1.5 px-1">
      <span className="text-[10px] font-bold uppercase text-muted-foreground w-full">Quantidade</span>
      {CONSUMER_QUANTITY_PRESETS.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => setQuantity(n)}
          className={cn(
            'min-w-[2.25rem] rounded-lg border px-2 py-1 text-xs font-bold transition',
            quantity === n
              ? 'border-primary bg-primary/20 text-primary'
              : 'border-border text-muted-foreground hover:border-primary/40'
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
