'use client';

import { useState, useEffect, useId, useCallback, useRef, memo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { commitMoneyExpressionToDisplayString, commitIntegerString } from '../../lib/moneyExpressionCommit';

const KeypadButton = memo(function KeypadButton({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onPointerDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'py-3 rounded-xl text-sm font-semibold border border-border bg-muted text-foreground shadow-sm hover:bg-muted/80 active:bg-muted dark:active:bg-secondary/80 dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-secondary/90 dark:shadow-none touch-manipulation',
        className
      )}
    >
      {children}
    </button>
  );
});

export type ExpressionValueFieldMode = 'money' | 'integer';

export type ExpressionValueFieldProps = {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  mode?: ExpressionValueFieldMode;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  required?: boolean;
  integerMin?: number;
  integerMax?: number;
  hint?: string;
};

/**
 * Campo numérico com teclado próprio (+ − × ÷ no modo money) para evitar sair do app no telemóvel.
 */
export function ExpressionValueField({
  id: idProp,
  label,
  value,
  onChange,
  mode = 'money',
  placeholder,
  className,
  inputClassName,
  disabled = false,
  required = false,
  integerMin = 1,
  integerMax = 999,
  hint,
}: ExpressionValueFieldProps) {
  const reactId = useId();
  const fieldId = idProp || `expr-field-${reactId.replace(/:/g, '')}`;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [applyError, setApplyError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const openRef = useRef(false);
  openRef.current = open;

  /** Só inicializa draft ao abrir — evita piscar/reset ao tocar teclas (foco volta ao input). */
  const openPad = useCallback(() => {
    if (disabled) return;
    if (!openRef.current) {
      setDraft(String(value ?? ''));
      setApplyError('');
    }
    setOpen(true);
  }, [disabled, value]);

  const append = useCallback((ch: string) => {
    setDraft((prev) => `${prev}${ch}`);
    setApplyError('');
  }, []);

  const back = useCallback(() => {
    setDraft((prev) => prev.slice(0, -1));
    setApplyError('');
  }, []);

  const clearDraft = useCallback(() => {
    setDraft('');
    setApplyError('');
  }, []);

  const closePad = useCallback(() => {
    setOpen(false);
    setApplyError('');
  }, []);

  const apply = useCallback(() => {
    if (mode === 'integer') {
      const next = commitIntegerString(draft, { min: integerMin, max: integerMax });
      if (next === null) {
        setApplyError('Valor inválido.');
        return;
      }
      onChange(next ?? '');
      closePad();
      return;
    }
    const next = commitMoneyExpressionToDisplayString(draft);
    if (next === null && String(draft).trim() !== '') {
      setApplyError('Confira a expressão ou use números como 10,50.');
      return;
    }
    onChange(next ?? '');
    closePad();
  }, [mode, draft, integerMin, integerMax, onChange, closePad]);

  const keypad =
    mode === 'integer' ? (
      <div className="grid grid-cols-3 gap-2">
        {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map((k) => (
          <KeypadButton key={k} onClick={() => append(k)}>
            {k}
          </KeypadButton>
        ))}
        <KeypadButton onClick={() => append('0')} className="col-span-2">
          0
        </KeypadButton>
        <KeypadButton onClick={back}>Apagar</KeypadButton>
      </div>
    ) : (
      <div className="grid grid-cols-4 gap-2">
        {['7', '8', '9', '/'].map((k) => (
          <KeypadButton key={k} onClick={() => append(k)}>
            {k}
          </KeypadButton>
        ))}
        {['4', '5', '6', '*'].map((k) => (
          <KeypadButton key={k} onClick={() => append(k)}>
            {k}
          </KeypadButton>
        ))}
        {['1', '2', '3', '-'].map((k) => (
          <KeypadButton key={k} onClick={() => append(k)}>
            {k}
          </KeypadButton>
        ))}
        <KeypadButton onClick={() => append('0')}>0</KeypadButton>
        <KeypadButton onClick={() => append(',')}>,</KeypadButton>
        <KeypadButton onClick={() => append('.')}>.</KeypadButton>
        <KeypadButton onClick={() => append('+')}>+</KeypadButton>
        <KeypadButton onClick={() => append('(')}>(</KeypadButton>
        <KeypadButton onClick={() => append(')')}>)</KeypadButton>
        <KeypadButton onClick={back} className="col-span-2 text-xs">
          Apagar
        </KeypadButton>
      </div>
    );

  const overlay =
    open &&
    mounted &&
    createPortal(
      <div
        className="fixed inset-0 z-[80] flex flex-col justify-end bg-black/45 backdrop-blur-[1px]"
        role="presentation"
        onClick={(e) => {
          if (e.target === e.currentTarget) closePad();
        }}
      >
        <div
          className="mx-auto w-full max-w-md rounded-t-3xl bg-card text-card-foreground shadow-2xl border-t border-border px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] max-h-[min(72vh,520px)] flex flex-col gap-2"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${fieldId}-title`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2 shrink-0">
            <p id={`${fieldId}-title`} className="text-sm font-semibold m-0 truncate pr-2">
              {label || (mode === 'integer' ? 'Número' : 'Valor')}
            </p>
            <button
              type="button"
              onClick={closePad}
              className="p-2 rounded-xl text-muted-foreground hover:bg-muted"
              aria-label="Fechar teclado"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="rounded-xl bg-[#0b1220] text-white px-3 py-2 font-mono text-sm min-h-[2.75rem] break-all shrink-0">
            {draft || '0'}
          </div>
          {applyError ? (
            <p className="text-xs text-red-600 m-0 shrink-0" role="alert">
              {applyError}
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground m-0 shrink-0">
              {mode === 'integer'
                ? `Entre ${integerMin} e ${integerMax}.`
                : 'Use + − × ÷ e parênteses; vírgula ou ponto como decimal. “Aplicar” calcula e formata.'}
            </p>
          )}
          <div className="overflow-y-auto min-h-0 flex-1">{keypad}</div>
          <div className="grid grid-cols-2 gap-2 shrink-0 pt-1">
            <KeypadButton onClick={clearDraft} className="text-xs">
              Limpar
            </KeypadButton>
            <KeypadButton onClick={apply} className="bg-primary text-primary-foreground border-primary hover:bg-primary/90">
              Aplicar
            </KeypadButton>
          </div>
        </div>
      </div>,
      document.body
    );

  return (
    <div className={className}>
      {label ? (
        <label htmlFor={fieldId} className="block text-sm font-medium text-[#333] mb-1">
          {label}
          {required ? <span className="text-red-500"> *</span> : null}
        </label>
      ) : null}
      <input
        id={fieldId}
        type="text"
        readOnly
        inputMode="none"
        autoComplete="off"
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={() => {}}
        onClick={openPad}
        onFocus={(e) => {
          e.preventDefault();
          if (!openRef.current) openPad();
        }}
        className={cn(
          'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2ECC49] focus:border-transparent cursor-pointer bg-white',
          disabled && 'opacity-50 cursor-not-allowed',
          inputClassName
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
      />
      {hint ? <p className="text-[11px] text-[#666] mt-1 m-0">{hint}</p> : null}
      {overlay}
    </div>
  );
}
