import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { INSTALL_GUIDE_ASSETS } from '../lib/pwa-install';
import { trackEvent } from '../lib/analytics';

/**
 * @param {object} props
 * @param {import('../lib/pwa-install').InstallContext} props.context
 * @param {() => Promise<'accepted' | 'dismissed' | 'unavailable'>} props.onTriggerNative
 * @param {(permanent?: boolean) => void} props.onDismiss
 * @param {() => void} [props.onConfirmManual]
 */
export default function PWAInstallAssistant({
  context,
  onTriggerNative,
  onDismiss,
  onConfirmManual,
}) {
  /** @type {['sheet' | 'guide' | 'verify' | 'celebrate' | 'ios-chrome-block', number]} */
  const [phase, setPhase] = useState(
    /** @type {['sheet' | 'guide' | 'verify' | 'celebrate' | 'ios-chrome-block', number]} */ ([
      'sheet',
      0,
    ])
  );
  const [nativeLoading, setNativeLoading] = useState(false);
  const [imgBroken, setImgBroken] = useState(/** @type {Record<string, boolean>} */ ({}));

  const mode = phase[0];
  const stepIndex = phase[1];

  useEffect(() => {
    trackEvent('pwa_install_prompt_shown', { platform: context.platform });
  }, [context.platform]);

  const steps = getGuideSteps(context.platform);
  const totalSteps = steps.length;

  const goInstall = useCallback(async () => {
    trackEvent('pwa_install_started', { platform: context.platform });

    if (context.platform === 'ios-chrome') {
      setPhase(['ios-chrome-block', 0]);
      return;
    }

    if (
      (context.platform === 'android-chrome' || context.platform === 'samsung') &&
      context.canUseNativePrompt
    ) {
      setNativeLoading(true);
      const out = await onTriggerNative();
      setNativeLoading(false);
      if (out === 'accepted') {
        setPhase(['celebrate', 0]);
        return;
      }
      if (out === 'dismissed') {
        setPhase(['guide', 0]);
        return;
      }
    }

    setPhase(['guide', 0]);
  }, [context, onTriggerNative]);

  const markImgBroken = (src) => {
    setImgBroken((prev) => ({ ...prev, [src]: true }));
  };

  const copyUrl = () => {
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/`
        : 'https://finmemory.com.br/';
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  };

  const handleConfirmInstalled = () => {
    try {
      localStorage.setItem('fm_install_done', '1');
    } catch (_) {}
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('fm-pwa-install-done'));
    }
    trackEvent('pwa_install_confirmed_manual');
    onConfirmManual?.();
    onDismiss(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center p-0 sm:p-4">
      <button
        type="button"
        aria-label="Fechar fundo"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={() => onDismiss(false)}
      />

      <div
        className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col fm-pwa-sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwa-install-title"
      >

        {mode === 'sheet' && (
          <SheetBody
            onInstall={goInstall}
            onDismissTemp={() => onDismiss(false)}
            onDismissPermanent={() => onDismiss(true)}
            nativeLoading={nativeLoading}
          />
        )}

        {mode === 'ios-chrome-block' && (
          <IosChromeBlock
            onBack={() => setPhase(['sheet', 0])}
            onCopy={copyUrl}
          />
        )}

        {mode === 'guide' && totalSteps > 0 && (
          <GuideBody
            steps={steps}
            stepIndex={stepIndex}
            setStepIndex={(i) => setPhase(['guide', i])}
            imgBroken={imgBroken}
            markImgBroken={markImgBroken}
            onDone={() => setPhase(['verify', 0])}
            onClose={() => onDismiss(false)}
            platform={context.platform}
          />
        )}

        {mode === 'verify' && (
          <VerifyBody
            onYes={handleConfirmInstalled}
            onNotYet={() => setPhase(['guide', Math.max(0, totalSteps - 1)])}
            onClose={() => onDismiss(false)}
          />
        )}

        {mode === 'celebrate' && (
          <CelebrateBody onClose={() => onDismiss(false)} />
        )}
      </div>
    </div>
  );
}

function SheetBody({ onInstall, onDismissTemp, onDismissPermanent, nativeLoading }) {
  return (
    <>
      <div className="flex justify-end p-2">
        <button
          type="button"
          className="p-2 rounded-full text-gray-500 hover:bg-gray-100"
          aria-label="Fechar"
          onClick={onDismissTemp}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="px-6 pb-6 pt-0 text-center">
        <div className="text-5xl mb-3" aria-hidden>
          📲
        </div>
        <h2 id="pwa-install-title" className="text-lg font-semibold text-gray-900 leading-snug">
          Instale o FinMemory na sua tela inicial
        </h2>
        <p className="text-sm text-gray-600 mt-3 leading-relaxed">
          Abre em um toque e fica mais fácil de usar no dia a dia — como um app normal.
        </p>
        <button
          type="button"
          disabled={nativeLoading}
          onClick={onInstall}
          className="mt-6 w-full rounded-xl py-3.5 bg-[#2ECC49] text-white font-semibold text-base disabled:opacity-60"
        >
          {nativeLoading ? 'Abrindo instalação…' : 'Instalar agora'}
        </button>
        <div className="mt-4 flex flex-col gap-2 text-sm">
          <button type="button" className="text-gray-500 hover:text-gray-800" onClick={onDismissTemp}>
            Agora não
          </button>
          <button
            type="button"
            className="text-gray-400 hover:text-gray-600 text-xs"
            onClick={onDismissPermanent}
          >
            Não mostrar mais
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * @param {object} p
 * @param {{ title: string; body: string; asset: string }[]} p.steps
 */
function GuideBody({
  steps,
  stepIndex,
  setStepIndex,
  imgBroken,
  markImgBroken,
  onDone,
  onClose,
  platform,
}) {
  const s = steps[stepIndex];
  const last = stepIndex >= steps.length - 1;

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-medium text-gray-500">
          Passo {stepIndex + 1} de {steps.length}
        </span>
        <button type="button" className="p-2 text-gray-500" aria-label="Fechar" onClick={onClose}>
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="px-5 py-4 overflow-y-auto flex-1">
        <h3 className="text-base font-semibold text-gray-900">{s.title}</h3>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">{s.body}</p>
        <div className="mt-4 rounded-2xl bg-gradient-to-b from-gray-50 to-gray-100 border border-gray-200 min-h-[160px] flex items-center justify-center overflow-hidden">
          {!imgBroken[s.asset] ? (
            <img
              src={s.asset}
              alt=""
              className="w-full max-h-48 object-contain"
              onError={() => markImgBroken(s.asset)}
            />
          ) : (
            <PlaceholderVisual platform={platform} step={stepIndex} />
          )}
        </div>
      </div>
      <div className="p-4 border-t border-gray-100 flex gap-2">
        {stepIndex > 0 ? (
          <button
            type="button"
            className="flex-1 rounded-xl py-3 border border-gray-300 text-gray-800 font-medium"
            onClick={() => setStepIndex(stepIndex - 1)}
          >
            Voltar
          </button>
        ) : null}
        <button
          type="button"
          className="flex-1 rounded-xl py-3 bg-[#2ECC49] text-white font-semibold"
          onClick={() => (last ? onDone() : setStepIndex(stepIndex + 1))}
        >
          {last ? 'Pronto' : 'Próximo'}
        </button>
      </div>
    </>
  );
}

function PlaceholderVisual({ platform, step }) {
  const hints = {
    'android-chrome': ['⋮ menu', '＋ Adicionar', '✓ Confirmar'],
    'android-other': ['⋮ menu', '＋ Adicionar', '✓ Confirmar'],
    samsung: ['≡ ou ⋮', '＋ Adicionar', '✓ Confirmar'],
    'ios-safari': ['□↑ Compartilhar', '📱 Tela inicial', '✓ Adicionar'],
    unknown: ['⋮ menu', '＋ Atalho', '✓ Confirmar'],
  };
  const list = hints[platform] || hints['android-chrome'];
  const emoji = list[step] || '📱';
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <span className="text-6xl leading-none">{emoji}</span>
      <p className="text-xs text-gray-500 mt-3">Ilustração: adicione GIFs em /public/install-guide/</p>
    </div>
  );
}

function VerifyBody({ onYes, onNotYet, onClose }) {
  return (
    <>
      <div className="flex justify-end p-2">
        <button type="button" className="p-2 text-gray-500" aria-label="Fechar" onClick={onClose}>
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="px-6 pb-8 text-center">
        <p className="text-4xl mb-3">🟢</p>
        <h3 className="text-lg font-semibold text-gray-900">Já adicionou?</h3>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          Feche o navegador e procure o ícone do FinMemory na tela inicial.
        </p>
        <button
          type="button"
          onClick={onYes}
          className="mt-6 w-full rounded-xl py-3.5 bg-[#2ECC49] text-white font-semibold"
        >
          Sim, instalei
        </button>
        <button
          type="button"
          onClick={onNotYet}
          className="mt-3 w-full rounded-xl py-3 border border-gray-200 text-gray-800 font-medium"
        >
          Ainda não
        </button>
      </div>
    </>
  );
}

function CelebrateBody({ onClose }) {
  return (
    <div className="px-6 py-10 text-center">
      <p className="text-5xl mb-2">🎉</p>
      <h3 className="text-lg font-semibold text-gray-900">Instalado</h3>
      <p className="text-sm text-gray-600 mt-2">Abra pelo ícone na tela inicial da próxima vez.</p>
      <button
        type="button"
        onClick={onClose}
        className="mt-8 w-full rounded-xl py-3.5 bg-[#2ECC49] text-white font-semibold"
      >
        Ok
      </button>
    </div>
  );
}

function IosChromeBlock({ onBack, onCopy }) {
  return (
    <>
      <div className="flex items-center gap-2 px-2 py-2 border-b border-gray-100">
        <button type="button" className="p-2 text-sm text-[#2ECC49] font-medium" onClick={onBack}>
          ← Voltar
        </button>
      </div>
      <div className="px-6 py-6">
        <p className="text-4xl mb-3">ℹ️</p>
        <h3 className="text-lg font-semibold text-gray-900">Use o Safari</h3>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          O Chrome no iPhone não permite instalar o app na tela inicial. Abra o mesmo endereço no{' '}
          <strong>Safari</strong> e siga o guia de instalação.
        </p>
        <button
          type="button"
          onClick={onCopy}
          className="mt-6 w-full rounded-xl py-3.5 border-2 border-[#2ECC49] text-[#2ECC49] font-semibold"
        >
          Copiar link
        </button>
      </div>
    </>
  );
}

/**
 * @param {import('../lib/pwa-install').InstallContext['platform']} platform
 */
function getGuideSteps(platform) {
  const androidLike =
    platform === 'android-chrome' ||
    platform === 'android-other' ||
    platform === 'samsung';

  if (androidLike) {
    const menuHint =
      platform === 'samsung'
        ? 'Toque no menu (três linhas ≡ ou três pontos ⋮) no canto superior direito.'
        : 'Toque nos três pontinhos (⋮) no canto superior direito do Chrome.';

    return [
      {
        title: 'Abra o menu do navegador',
        body: menuHint,
        asset: INSTALL_GUIDE_ASSETS.androidMenu,
      },
      {
        title: 'Adicionar à tela inicial',
        body: 'Procure a opção “Adicionar à tela inicial” ou “Instalar app” e toque nela.',
        asset: INSTALL_GUIDE_ASSETS.androidAdd,
      },
      {
        title: 'Confirme',
        body: 'Toque em “Adicionar” ou “Instalar” na janela de confirmação.',
        asset: INSTALL_GUIDE_ASSETS.androidAdd,
      },
    ];
  }

  if (platform === 'ios-safari') {
    return [
      {
        title: 'Toque em Compartilhar',
        body: 'Na barra inferior do Safari, toque no botão de compartilhar (quadrado com seta para cima).',
        asset: INSTALL_GUIDE_ASSETS.iosShare,
      },
      {
        title: 'Adicionar à Tela de Início',
        body: 'Role o menu para baixo e escolha “Adicionar à Tela de Início”.',
        asset: INSTALL_GUIDE_ASSETS.iosAddHomescreen,
      },
      {
        title: 'Confirmar',
        body: 'Toque em “Adicionar” no canto superior direito.',
        asset: INSTALL_GUIDE_ASSETS.iosConfirm,
      },
    ];
  }

  return [
    {
      title: 'Menu do navegador',
      body: 'Abra o menu do navegador (⋮ ou ≡) e procure “Adicionar à tela inicial” ou “Instalar app”.',
      asset: INSTALL_GUIDE_ASSETS.androidMenu,
    },
    {
      title: 'Confirme a instalação',
      body: 'Confirme na janela que aparecer. O ícone do FinMemory ficará na sua tela inicial.',
      asset: INSTALL_GUIDE_ASSETS.androidAdd,
    },
  ];
}
