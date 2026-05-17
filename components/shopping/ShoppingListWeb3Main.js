'use client';

import { Mic, MicOff, Trash2, Check, Navigation, Minus, Plus } from 'lucide-react';
import Link from 'next/link';
import { cn } from '../../lib/utils';
import { emojiForShoppingItemName } from '../../lib/shoppingListEmoji';
import {
  RETAILER_QUICK_QUANTITIES,
  RETAILER_PACK_UNITS,
  CONSUMER_QUANTITY_PRESETS,
} from '../../lib/shoppingListQuantity';
import { USER_ROLE_RETAILER } from '../../lib/userType';

/**
 * Lista de compras — tema gamificado FinMemory (dark + primary neon + gradiente do DS).
 * `userRole`: 'consumer' | 'retailer' — altera controles de quantidade.
 */
export function ShoppingListWeb3Main({
  title = 'O que você precisa?',
  userRole = 'consumer',
  newName,
  setNewName,
  newQuantity = 1,
  setNewQuantity,
  newUnit = 'un',
  setNewUnit,
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
  const isRetailer = userRole === USER_ROLE_RETAILER;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <h1 className="text-xl font-bold tracking-tight text-foreground m-0">{title}</h1>
        {isRetailer ? (
          <span className="shrink-0 rounded-lg border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-400">
            Modo atacado
          </span>
        ) : null}
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
            placeholder={isRetailer ? 'Produto para reposição…' : placeholder}
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

        {isRetailer ? (
          <RetailerQuantityRow
            quantity={newQuantity}
            setQuantity={setNewQuantity}
            unit={newUnit}
            setUnit={setNewUnit}
          />
        ) : (
          <ConsumerQuantityRow quantity={newQuantity} setQuantity={setNewQuantity} />
        )}

        <button
          type="submit"
          disabled={adding || !String(newName || '').trim()}
          className="w-full rounded-xl py-2.5 text-sm font-black text-[#0A0E1A] bg-primary disabled:opacity-40"
        >
          {adding ? 'Adicionando…' : 'Adicionar à lista'}
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

      <ul className={cn('space-y-2', isRetailer && 'space-y-1.5')}>
        {noteItems.map((item, index) => {
          const emoji = emojiForShoppingItemName(item.name);
          const label = String(item.name || '').toUpperCase();
          const qty =
            isRetailer && (item.quantity > 1 || (item.unit && item.unit !== 'un'))
              ? item.quantity || 1
              : item.quantity > 1
                ? item.quantity
                : null;
          return (
            <li
              key={item.id}
              style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
              className={cn(
                'flex animate-fade-in items-center gap-2 rounded-xl border border-border bg-card',
                isRetailer ? 'px-2.5 py-2' : 'gap-3 px-3 py-3 rounded-2xl',
                'shadow-sm ring-1 ring-white/[0.03] transition-[box-shadow,border-color] duration-200',
                'hover:border-primary/25 hover:shadow-[0_0_24px_-8px_hsl(var(--primary)/0.2)]'
              )}
            >
              <button
                type="button"
                onClick={() => onToggleChecked(item)}
                className={cn(
                  'flex shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  isRetailer ? 'h-8 w-8' : 'h-9 w-9',
                  item.checked
                    ? 'border-primary bg-primary text-primary-foreground shadow-[0_0_14px_hsl(var(--primary)/0.55)]'
                    : 'border-muted-foreground/50 bg-transparent text-transparent hover:border-primary/50'
                )}
                aria-label={item.checked ? 'Desmarcar' : 'Marcar'}
              >
                {item.checked ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
              </button>
              <span
                className={cn(
                  'min-w-0 flex-1 text-left font-bold tracking-wide',
                  isRetailer ? 'text-[12px] leading-snug' : 'text-sm uppercase',
                  item.checked ? 'text-muted-foreground line-through' : 'text-foreground'
                )}
              >
                <span className="mr-1.5" aria-hidden>
                  {emoji}
                </span>
                {label}
                {qty ? (
                  <span
                    className={cn(
                      'ml-1 font-semibold normal-case',
                      isRetailer ? 'text-amber-500 text-[11px]' : 'text-[11px] text-muted-foreground'
                    )}
                  >
                    · {qty}
                    {item.unit ? ` ${item.unit}` : ''}
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                className="shrink-0 rounded-lg p-1.5 text-rose-400/90 transition hover:bg-rose-500/10"
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
        {isRetailer ? 'Comparar preços no mapa' : 'Localizar no Mapa de Preços'}
      </Link>
    </div>
  );
}

function ConsumerQuantityRow({ quantity, setQuantity }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-1">
      <span className="text-[10px] font-bold uppercase text-muted-foreground w-full">Qtd.</span>
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

function RetailerQuantityRow({ quantity, setQuantity, unit, setUnit }) {
  const bump = (delta) => {
    const next = Math.max(1, Math.min(99999, (Number(quantity) || 1) + delta));
    setQuantity(next);
  };

  return (
    <div className="space-y-2 px-1">
      <div className="flex flex-wrap gap-1.5">
        <span className="text-[10px] font-bold uppercase text-amber-500/90 w-full">Volume rápido</span>
        {RETAILER_QUICK_QUANTITIES.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setQuantity(n)}
            className={cn(
              'rounded-lg border px-2.5 py-1 text-xs font-black transition',
              quantity === n
                ? 'border-amber-500/50 bg-amber-500/15 text-amber-400'
                : 'border-border text-muted-foreground hover:border-amber-500/30'
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex gap-2 items-center">
        <div className="flex items-center rounded-xl border border-border bg-background/80 overflow-hidden">
          <button type="button" onClick={() => bump(-10)} className="p-2 text-muted-foreground hover:text-foreground" aria-label="-10">
            <Minus className="h-4 w-4" />
          </button>
          <input
            type="number"
            min={1}
            max={99999}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="w-16 bg-transparent text-center text-sm font-black text-foreground focus:outline-none tabular-nums"
            inputMode="numeric"
          />
          <button type="button" onClick={() => bump(10)} className="p-2 text-muted-foreground hover:text-foreground" aria-label="+10">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="flex-1 rounded-xl border border-border bg-background/80 px-2 py-2 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/40"
        >
          {RETAILER_PACK_UNITS.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
