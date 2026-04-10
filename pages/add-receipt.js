import { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { BottomNav } from '../components/BottomNav';
import { NFCeScanner } from '../components/NFCeScanner';
import { createClient } from '@supabase/supabase-js';
import Head from 'next/head';
import Image from 'next/image';
import { cn } from '../lib/utils';

/**
 * Página de captura e processamento de nota fiscal via OCR.
 * Mobile-first design.
 */

// Supabase client (apenas para buscar user_id)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// Comprimir imagem para max 2MB
async function compressImage(file, maxSizeMB = 1.5) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        
        // Redimensionar se muito grande
        const maxDimension = 2000;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        // Tentar diferentes qualidades até ficar abaixo do limite
        let quality = 0.8;
        let base64 = canvas.toDataURL('image/jpeg', quality);
        
        while (base64.length > maxSizeMB * 1024 * 1024 * 1.37 && quality > 0.1) {
          quality -= 0.1;
          base64 = canvas.toDataURL('image/jpeg', quality);
        }
        
        resolve(base64);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Estados do fluxo
const STEPS = {
  CAPTURE: 'capture',
  PREVIEW: 'preview',
  PROCESSING: 'processing',
  EDIT: 'edit',
  SAVING: 'saving',
  SUCCESS: 'success'
};

// Converte data URL (base64) em File para o scanner de QR
function dataURLtoFile(dataUrl, filename = 'receipt.jpg') {
  const arr = dataUrl.split(',');
  const mime = (arr[0].match(/:(.*?);/) || [])[1] || 'image/jpeg';
  const bstr = atob(arr[1] || '');
  const n = bstr.length;
  const u8 = new Uint8Array(n);
  for (let i = 0; i < n; i++) u8[i] = bstr.charCodeAt(i);
  return new File([u8], filename, { type: mime });
}

// Indica se o conteúdo do QR pode ser NFC-e (URL SEFAZ, chave 44 dígitos, ou parâmetro p=)
function looksLikeNfceQr(text) {
  const t = (text || '').trim().replace(/\s+/g, ' ');
  if (t.length < 10) return false;
  if (/^https?:\/\//i.test(t)) return true;
  if (/^[pP]=/.test(t)) return true;
  if (t.replace(/\D/g, '').length >= 44) return true;
  if (/nfce|fazenda|sefaz|gov\.br/i.test(t)) return true;
  return false;
}

// Mapeia resposta do /api/consultar-nfce para o formato do formulário (applyNfceData)
function dataFromConsultarNfce(res) {
  const estabelecimento = res.estabelecimento;
  const merchant_name = typeof estabelecimento === 'object' && estabelecimento?.nome
    ? estabelecimento.nome
    : (estabelecimento || '');
  return {
    date: res.data || '',
    merchant_name: merchant_name || '',
    merchant_cnpj: res.cnpj || '',
    total_amount: res.total != null ? String(Number(res.total).toFixed(2)) : '',
    items: Array.isArray(res.itens)
      ? res.itens.map((i) => {
          const row = { name: i.name || '', price: Number(i.price) || 0 };
          if (i.gtin) row.gtin = String(i.gtin);
          return row;
        })
      : [],
    receipt_image_url: res.nfce_url || '',
    nfce_url: res.nfce_url || ''
  };
}

export default function AddReceipt() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // Estados
  const [step, setStep] = useState(STEPS.CAPTURE);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [remainingRequests, setRemainingRequests] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    date: '',
    merchant_name: '',
    merchant_cnpj: '',
    merchant_address: '',
    total_amount: '',
    items: [],
    category: '',
    payment_method: '',
    receipt_image_url: ''
  });
  // Toggle: false = só nos meus registros; true = divulgar preços da nota no mapa
  const [shareOnMap, setShareOnMap] = useState(false);
  // Lojas próximas ao compartilhar no mapa (quando usuário pede sugestão)
  const [receiptLocating, setReceiptLocating] = useState(false);
  const [nearbyStoresReceipt, setNearbyStoresReceipt] = useState([]);
  // Feedback após salvar com "Divulgar no mapa"
  const [mapFeedback, setMapFeedback] = useState(null);

  /** 'foto' = OCR / foto; 'nfce' = câmera ao vivo no QR da NFC-e */
  const [scanTab, setScanTab] = useState('foto');
  const [nfceCameraOpen, setNfceCameraOpen] = useState(false);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Buscar user_id
  useEffect(() => {
    async function fetchUserId() {
      if (session?.user?.email && supabase) {
        try {
          const { data } = await supabase
            .from('users')
            .select('id')
            .eq('email', session.user.email)
            .single();
          
          if (data) {
            setUserId(data.id);
          }
        } catch (err) {
          console.error('Erro ao buscar user_id:', err);
        }
      }
    }
    fetchUserId();
  }, [session]);

  useEffect(() => {
    if (!router.isReady) return;
    const t = router.query.tab;
    if (t === 'nfce' || t === 'qr') setScanTab('nfce');
  }, [router.isReady, router.query.tab]);

  const setTab = (tab) => {
    setScanTab(tab);
    if (tab === 'foto') {
      setNfceCameraOpen(false);
      if (router.isReady) {
        router.replace({ pathname: '/add-receipt' }, undefined, { shallow: true });
      }
    } else if (router.isReady) {
      router.replace({ pathname: '/add-receipt', query: { tab: 'nfce' } }, undefined, { shallow: true });
    }
  };

  // Redirect se não autenticado
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Prefill vindo do fluxo NFC-e (sessionStorage): aplicar e ir direto para EDIT na aba Foto
  useEffect(() => {
    if (typeof window === 'undefined' || step !== STEPS.CAPTURE) return;
    try {
      const raw = sessionStorage.getItem('finmemory_nfce_prefill');
      if (!raw) return;
      sessionStorage.removeItem('finmemory_nfce_prefill');
      const prefill = JSON.parse(raw);
      if (prefill && (prefill.merchant_name || prefill.total_amount)) {
        setFormData({
          date: prefill.date || '',
          merchant_name: prefill.merchant_name || '',
          merchant_cnpj: prefill.merchant_cnpj || '',
          merchant_address: prefill.merchant_address || '',
          total_amount: prefill.total_amount != null ? String(prefill.total_amount) : '',
          items: Array.isArray(prefill.items) ? prefill.items.map((i) => ({ name: i.name || '', price: Number(i.price) || 0 })) : [],
          category: prefill.category || '',
          payment_method: prefill.payment_method || '',
          receipt_image_url: prefill.receipt_image_url || ''
        });
        setScanTab('foto');
        setStep(STEPS.EDIT);
      }
    } catch (_) {}
  }, [step]);

  // Processar arquivo selecionado
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Arquivo vazio (alguns dispositivos retornam isso)
    if (file.size === 0) {
      setError('A foto veio vazia. Tente de novo ou use "Escolher da Galeria".');
      e.target.value = '';
      return;
    }

    // Validar tipo (inclui HEIC para iOS – mas HEIC será rejeitado na compressão)
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/heic'];
    if (!validTypes.includes(file.type)) {
      setError('Formato não suportado. Use JPG, PNG ou WebP.');
      e.target.value = '';
      return;
    }

    // Validar tamanho inicial (antes de comprimir)
    if (file.size > 10 * 1024 * 1024) { // 10MB limite inicial
      setError('Imagem muito grande. Máximo 10MB.');
      e.target.value = '';
      return;
    }

    try {
      // Comprimir imagem (HEIC no iPhone falha aqui – navegador não converte para canvas)
      const compressed = await compressImage(file);
      setImageBase64(compressed);
      setImagePreview(compressed);
      setStep(STEPS.PREVIEW);
    } catch (err) {
      console.error('Erro ao processar imagem:', err);
      setError(
        file.type === 'image/heic'
          ? 'iPhone gravou em HEIC. Use "Escolher da Galeria" e selecione a foto, ou em Ajustes > Câmera > Formatos escolha "Mais compatível" (JPG).'
          : 'Erro ao processar imagem. Tente outra ou use "Escolher da Galeria".'
      );
    } finally {
      e.target.value = '';
    }
  };

  // Aplicar dados da NFC-e no formulário (após ler QR da foto ou da câmera)
  const applyNfceData = (data) => {
    setFormData({
      date: data.date || '',
      merchant_name: data.merchant_name || '',
      merchant_cnpj: data.merchant_cnpj || '',
      merchant_address: data.merchant_address || '',
      total_amount: data.total_amount ? String(data.total_amount) : '',
      items: Array.isArray(data.items) && data.items.length > 0
        ? data.items.map((i) => ({ name: i.name || '', price: Number(i.price) || 0 }))
        : [],
      category: '',
      payment_method: '',
      receipt_image_url: data.receipt_image_url || data.nfce_url || ''
    });
    setStep(STEPS.EDIT);
  };

  // Processar nota: tenta ler QR da foto (NFC-e); se não achar ou der erro, usa OCR (visão)
  const processImage = async () => {
    if (!imageBase64) {
      setError('Imagem não carregada. Tente novamente.');
      return;
    }
    if (!userId) {
      setError('Usuário não identificado. Faça login novamente ou conecte o Gmail no dashboard primeiro.');
      return;
    }

    setStep(STEPS.PROCESSING);
    setError(null);

    // 1) Opcional: tentar QR da foto (não bloqueia o OCR em caso de falha)
    if (typeof window !== 'undefined') {
      try {
        const file = dataURLtoFile(imageBase64, 'receipt.jpg');
        if (!file || !(file instanceof File)) throw new Error('invalid file');
        const { Html5Qrcode } = await import('html5-qrcode');
        const el = document.getElementById('finmemory-qr-file-scan');
        if (el) {
          const qr = new Html5Qrcode('finmemory-qr-file-scan');
          try {
            const decodedText = await Promise.race([
              qr.scanFile(file, false),
              new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))
            ]);
            if (decodedText && looksLikeNfceQr(decodedText)) {
              const res = await fetch('/api/consultar-nfce', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: decodedText })
              });
              const json = await res.json();
              if (res.ok) {
                applyNfceData(dataFromConsultarNfce(json));
                return;
              }
            }
          } finally {
            try { qr.clear(); } catch (_) {}
          }
        }
      } catch (_) {
        // Qualquer falha no QR → segue para OCR (não bloqueia)
      }
    }

    // 2) OCR por visão (GPT) na mesma foto
    try {
      const response = await fetch('/api/ocr/process-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imageBase64,
          userId: userId
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || result.details || 'Erro ao processar nota fiscal');
      }

      setExtractedData(result.data);
      setRemainingRequests(result.remaining_requests);
      setFormData({
        date: result.data.date || '',
        merchant_name: result.data.merchant_name || '',
        merchant_cnpj: result.data.merchant_cnpj || '',
        merchant_address: result.data.merchant_address || '',
        total_amount: result.data.total_amount?.toString() || '',
        items: result.data.items || [],
        category: result.data.category || '',
        payment_method: result.data.payment_method || '',
        receipt_image_url: result.data.receipt_image_url || ''
      });
      setStep(STEPS.EDIT);
    } catch (err) {
      console.error('Erro no OCR:', err);
      let msg = err.message || 'Erro ao processar. Verifique sua conexão e tente novamente.';
      if (msg.includes('OpenAI') || msg.includes('configuração do servidor') || msg.includes('API key')) {
        msg = 'Serviço de leitura da nota não configurado. Configure OPENAI_API_KEY no Cloud Run (veja a dica abaixo) ou use Sincronizar Gmail / Gasto manual.';
      }
      setError(msg);
      setStep(STEPS.PREVIEW);
    }
  };

  // Salvar transação
  const saveTransaction = async () => {
    if (!userId) {
      setError('Usuário não identificado');
      return;
    }

    setStep(STEPS.SAVING);
    setError(null);

    try {
      let lat = null;
      let lng = null;
      if (shareOnMap && typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000, enableHighAccuracy: true });
          });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } catch (_) {
          // Geolocalização negada ou falhou – API usa geocoding como fallback
        }
      }

      const payload = {
        userId,
        date: formData.date || '',
        merchant_name: formData.merchant_name || '',
        merchant_cnpj: formData.merchant_cnpj || '',
        merchant_address: formData.merchant_address || '',
        total_amount: parseFloat(formData.total_amount) || 0,
        items: Array.isArray(formData.items) ? formData.items : [],
        category: formData.category || '',
        payment_method: formData.payment_method || '',
        receipt_image_url: formData.receipt_image_url || '',
        shareOnMap,
        ...(lat != null && lng != null && { lat, lng })
      };
      const response = await fetch('/api/ocr/save-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erro ao salvar transação');
      }

      setStep(STEPS.SUCCESS);
      setMapFeedback(shareOnMap ? { mapPointsAdded: result.mapPointsAdded ?? 0, mapError: result.mapError ?? null } : null);

      // Redirecionar após 2 segundos
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);

    } catch (err) {
      console.error('Erro ao salvar:', err);
      setError(err.message);
      setStep(STEPS.EDIT);
    }
  };

  // Atualizar campo do formulário
  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Atualizar item
  const updateItem = (index, field, value) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, items: newItems };
    });
  };

  // Adicionar item
  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { name: '', price: 0 }]
    }));
  };

  // Remover item
  const removeItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  // Reiniciar
  const reset = () => {
    setStep(STEPS.CAPTURE);
    setImagePreview(null);
    setImageBase64(null);
    setExtractedData(null);
    setError(null);
    setFormData({
      date: '',
      merchant_name: '',
      merchant_cnpj: '',
      merchant_address: '',
      total_amount: '',
      items: [],
      category: '',
      payment_method: '',
      receipt_image_url: ''
    });
    setShareOnMap(false);
    setMapFeedback(null);
  };

  // Loading de sessão
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-primary p-5 font-sans">
        <div className="text-white text-center py-10">Carregando...</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>
          {scanTab === 'nfce' ? 'QR Code NFC-e | FinMemory' : 'Foto da nota | FinMemory'}
        </title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>

      <div className="min-h-screen bg-gradient-primary font-sans">
        {/* Header fixo – Voltar sempre visível (não some ao rolar) */}
        <div className="sticky top-0 z-20 flex items-center gap-3 p-5 pb-4 bg-gradient-primary">
          <Link
            href="/dashboard"
            className="min-h-[44px] inline-flex items-center gap-2 bg-white/20 text-white py-2.5 px-4 rounded-xl text-sm font-medium hover:bg-white/30 active:bg-white/40 transition-colors no-underline"
          >
            <span aria-hidden>←</span> Voltar
          </Link>
          <Image src="/logo.png" alt="" width={36} height={36} className="object-contain shrink-0 rounded-lg" />
          <h1 className="text-white text-xl sm:text-2xl m-0 flex-1">Escanear nota</h1>
        </div>

        <div className="px-5 pb-8">
        <div className="flex p-1 rounded-2xl bg-white/15 mb-4 max-w-md mx-auto ring-1 ring-white/20">
          <button
            type="button"
            onClick={() => setTab('foto')}
            className={cn(
              'flex-1 py-2.5 px-2 rounded-xl text-sm font-semibold transition-colors',
              scanTab === 'foto'
                ? 'bg-white text-[#1a7f37] shadow-md'
                : 'text-white/90 hover:bg-white/10'
            )}
          >
            Foto da nota
          </button>
          <button
            type="button"
            onClick={() => setTab('nfce')}
            className={cn(
              'flex-1 py-2.5 px-2 rounded-xl text-sm font-semibold transition-colors',
              scanTab === 'nfce'
                ? 'bg-white text-[#1a7f37] shadow-md'
                : 'text-white/90 hover:bg-white/10'
            )}
          >
            QR NFC-e
          </button>
        </div>

        {/* Erro global */}
        {error && scanTab === 'foto' && (
          <div className="bg-[#fee2e2] border border-[#fecaca] text-[#dc2626] py-3 px-4 rounded-xl mb-5 text-sm">
            <p className="font-medium mb-1">⚠️ {error}</p>
            {(error.includes('OpenAI') || error.toLowerCase().includes('configuração do servidor')) && (
              <p className="mt-2 text-[#b91c1c] text-xs leading-relaxed">
                Para escanear notas pelo app em produção, o administrador precisa adicionar a variável <strong>OPENAI_API_KEY</strong> no serviço Cloud Run (Variáveis e segredos). Enquanto isso, você pode usar <strong>Gastos → Sincronizar</strong> para puxar notas do Gmail ou lançar um <strong>Gasto manual</strong>.
              </p>
            )}
          </div>
        )}

        {scanTab === 'nfce' && (
          <div className="bg-white rounded-[24px] p-6 shadow-lg card-lovable">
            <p className="text-[#666] text-sm mb-4">
              Aponte a câmera para o <strong>QR Code</strong> impresso na NFC-e. A nota será consultada na SEFAZ, categorizada e salva no FinMemory.
            </p>
            {!nfceCameraOpen ? (
              <>
                <button
                  type="button"
                  onClick={() => setNfceCameraOpen(true)}
                  className="w-full py-4 px-6 bg-[#e0f2fe] text-[#0369a1] rounded-xl text-base font-medium border-none cursor-pointer hover:bg-[#bae6fd]"
                >
                  Escanear QR da NFC-e
                </button>
                <p className="text-xs text-[#6b7280] mt-3 m-0">
                  No telefone, use <strong>tirar foto do QR</strong> (câmera nativa). No computador, pode usar câmera ao vivo ou enviar uma foto do QR.
                </p>
              </>
            ) : (
              <NFCeScanner
                userId={session?.user?.supabaseId || userId}
                onSuccess={() => router.push('/dashboard')}
                onClose={() => {
                  setNfceCameraOpen(false);
                  router.push('/dashboard');
                }}
              />
            )}
          </div>
        )}

        {/* STEP: CAPTURE - Fotografar nota (QR lido da imagem; funciona 100% no iOS) */}
        {scanTab === 'foto' && step === STEPS.CAPTURE && (
          <div className="bg-white rounded-[24px] py-10 px-6 text-center card-lovable">
            <div className="text-6xl mb-4">📸</div>
            <h2 className="text-xl text-[#333] m-0 mb-2">Fotografe a nota fiscal</h2>
            <p className="text-sm text-[#666] m-0 mb-6">
              Tire uma foto do QR Code no rodapé da nota. O app lê o QR, consulta a SEFAZ e salva automaticamente no FinMemory.
            </p>

            <div className="flex flex-col gap-3">
              {/* Label nativo: no iOS o toque abre a câmera nativa - funciona 100% */}
              <label
                htmlFor="add-receipt-camera"
                className="bg-gradient-primary text-white border-none py-4 px-6 rounded-xl text-base font-semibold cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98] text-center block"
              >
                📷 Tirar Foto
              </label>
              <input
                id="add-receipt-camera"
                ref={cameraInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
                aria-label="Tirar foto da nota fiscal"
              />

              <label
                htmlFor="add-receipt-gallery"
                className="bg-[#f3f4f6] text-[#374151] border-none py-4 px-6 rounded-xl text-base cursor-pointer hover:bg-[#e5e7eb] transition-colors text-center block"
              >
                🖼️ Escolher da Galeria
              </label>
              <input
                id="add-receipt-gallery"
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleFileSelect}
                className="hidden"
                aria-label="Escolher imagem da galeria"
              />
            </div>

            <p className="text-xs text-[#9ca3af] mt-4">
              Foto → QR Code lido → SEFAZ → produtos salvos. JPG, PNG ou WebP. Compatível com iPhone.
            </p>
          </div>
        )}

        {/* Container para o scanner de QR da foto (off-screen; lib exige elemento no DOM) */}
        <div id="finmemory-qr-file-scan" className="absolute w-[1px] h-[1px] opacity-0 pointer-events-none left-[-9999px] top-0" aria-hidden="true" />

        {/* STEP: PREVIEW */}
        {scanTab === 'foto' && step === STEPS.PREVIEW && imagePreview && (
          <div className="bg-white rounded-[24px] p-6 text-center card-lovable">
            <img
              src={imagePreview}
              alt="Preview"
              className="max-w-full max-h-[400px] rounded-xl mb-6 shadow-card-lovable"
            />
            {!userId && (
              <p className="text-amber-600 text-sm mb-3">
                Aguardando identificação... Se demorar, faça login novamente ou conecte o Gmail no dashboard.
              </p>
            )}
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={processImage}
                disabled={!userId}
                className={`py-4 px-6 rounded-xl text-base font-semibold cursor-pointer border-none ${
                  userId 
                    ? 'bg-gradient-primary text-white hover:opacity-90' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                ✅ Processar Nota
              </button>
              <button
                type="button"
                onClick={reset}
                className="bg-[#f3f4f6] text-[#374151] border-none py-4 px-6 rounded-xl text-base cursor-pointer"
              >
                🔄 Tirar Outra Foto
              </button>
            </div>
          </div>
        )}

        {/* STEP: PROCESSING */}
        {scanTab === 'foto' && step === STEPS.PROCESSING && (
          <div className="bg-white rounded-[24px] py-16 px-6 text-center card-lovable">
            <div className="w-12 h-12 border-4 border-[#e5e7eb] border-t-[#2ECC49] rounded-full animate-spin mx-auto mb-6" />
            <h2 className="text-xl text-[#333] m-0 mb-2">Lendo sua nota fiscal...</h2>
            <p className="text-sm text-[#666] m-0">
              Isso pode levar alguns segundos
            </p>
          </div>
        )}

        {/* STEP: EDIT */}
        {scanTab === 'foto' && step === STEPS.EDIT && (
          <div className="bg-white rounded-[24px] p-6 card-lovable">
            <h2 className="text-xl text-[#333] m-0 mb-1">Confira os dados</h2>
            <p className="text-sm text-[#666] m-0 mb-4">
              Corrija se necessário antes de salvar
            </p>

            {imagePreview && (
              <img
                src={imagePreview}
                alt="Nota"
                className="w-full max-h-[150px] object-cover rounded-xl mb-5"
              />
            )}

            <div className="mb-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Estabelecimento *</label>
                <input
                  type="text"
                  value={formData.merchant_name}
                  onChange={(e) => updateField('merchant_name', e.target.value)}
                  list="nearby-stores-receipt-list"
                  className="w-full py-3 px-3 border border-[#e5e7eb] rounded-lg text-base box-border"
                  placeholder="Nome da loja"
                />
                <datalist id="nearby-stores-receipt-list">
                  {nearbyStoresReceipt.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.neighborhood ? `${s.name} — ${s.neighborhood}` : s.name}
                    </option>
                  ))}
                </datalist>
                {shareOnMap && (
                  <button
                    type="button"
                    onClick={() => {
                      setReceiptLocating(true);
                      if (typeof navigator !== 'undefined' && navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                          (pos) => {
                            const lat = pos.coords.latitude;
                            const lng = pos.coords.longitude;
                            fetch(`/api/map/stores?lat=${lat}&lng=${lng}&radius=2000`)
                              .then((res) => (res.ok ? res.json() : { stores: [] }))
                              .then((data) => {
                                if (Array.isArray(data.stores)) setNearbyStoresReceipt(data.stores);
                              })
                              .finally(() => setReceiptLocating(false));
                          },
                          () => setReceiptLocating(false),
                          { timeout: 5000 }
                        );
                      } else setReceiptLocating(false);
                    }}
                    disabled={receiptLocating}
                    className="mt-2 text-sm text-[#2ECC49] hover:underline disabled:opacity-60"
                  >
                    {receiptLocating ? 'Buscando...' : '📍 Sugerir lojas próximas'}
                  </button>
                )}
                {nearbyStoresReceipt.length > 0 && (
                  <p className="text-xs text-[#2ECC49] mt-1">
                    {nearbyStoresReceipt.length} loja(s) próxima(s). Comece a digitar ou escolha na lista.
                  </p>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-[#374151] mb-1.5">CNPJ</label>
                <input
                  type="text"
                  value={formData.merchant_cnpj || ''}
                  onChange={(e) => updateField('merchant_cnpj', e.target.value)}
                  className="w-full py-3 px-3 border border-[#e5e7eb] rounded-lg text-base box-border"
                  placeholder="00.000.000/0000-00"
                />
              </div>

              <div className="flex gap-3 mb-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">Data</label>
                  <input
                    type="date"
                    value={formData.date || ''}
                    onChange={(e) => updateField('date', e.target.value)}
                    className="w-full py-3 px-3 border border-[#e5e7eb] rounded-lg text-base box-border"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">Valor Total *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.total_amount}
                    onChange={(e) => updateField('total_amount', e.target.value)}
                    className="w-full py-3 px-3 border border-[#e5e7eb] rounded-lg text-base box-border"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex gap-3 mb-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">Categoria</label>
                  <select
                    value={formData.category || ''}
                    onChange={(e) => updateField('category', e.target.value)}
                    className="w-full py-3 px-3 border border-[#e5e7eb] rounded-lg text-base box-border"
                  >
                    <option value="">Selecione</option>
                    <option value="Supermercado">Supermercado</option>
                    <option value="Restaurante">Restaurante</option>
                    <option value="Farmácia">Farmácia</option>
                    <option value="Combustível">Combustível</option>
                    <option value="Eletrônicos">Eletrônicos</option>
                    <option value="Vestuário">Vestuário</option>
                    <option value="Serviços">Serviços</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">Pagamento</label>
                  <select
                    value={formData.payment_method || ''}
                    onChange={(e) => updateField('payment_method', e.target.value)}
                    className="w-full py-3 px-3 border border-[#e5e7eb] rounded-lg text-base box-border"
                  >
                    <option value="">Selecione</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Débito">Débito</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="PIX">PIX</option>
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-[#374151] mb-1.5">
                  Itens ({formData.items?.length || 0})
                </label>
                {formData.items?.map((item, index) => (
                  <div key={index} className="flex gap-2 mb-2 items-center">
                    <input
                      type="text"
                      value={item.name || ''}
                      onChange={(e) => updateItem(index, 'name', e.target.value)}
                      className="flex-[2] py-3 px-3 border border-[#e5e7eb] rounded-lg text-base box-border"
                      placeholder="Nome do item"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={item.price || ''}
                      onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                      className="flex-1 min-w-[80px] py-3 px-3 border border-[#e5e7eb] rounded-lg text-base box-border"
                      placeholder="0.00"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="bg-[#fee2e2] text-[#dc2626] border-none w-9 h-9 rounded-lg cursor-pointer text-sm hover:bg-[#fecaca]"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addItem}
                  className="bg-[#f3f4f6] text-[#2ECC49] border-none py-2.5 px-4 rounded-lg text-sm cursor-pointer w-full hover:bg-[#e5e7eb]"
                >
                  + Adicionar Item
                </button>
              </div>

              {shareOnMap && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">Endereço (opcional, melhora a localização no mapa)</label>
                  <input
                    type="text"
                    value={formData.merchant_address || ''}
                    onChange={(e) => updateField('merchant_address', e.target.value)}
                    className="w-full py-3 px-3 border border-[#e5e7eb] rounded-lg text-base box-border"
                    placeholder="Ex: Rua X, 123 - Bairro, Cidade"
                  />
                </div>
              )}

              {/* Toggle: divulgar preços da nota no mapa ou só nos registros */}
              <div className="mb-6">
                <p className="text-xs text-[#6b7280] mb-2">
                  Divulgar no mapa: ative e permita a localização ao salvar para que os produtos apareçam no mapa. À esquerda = só nos seus registros.
                </p>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-[#374151]">
                    {shareOnMap ? '🗺️ Divulgar no mapa' : '📋 Só meus registros'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={shareOnMap}
                    aria-label={shareOnMap ? 'Preços serão divulgados no mapa' : 'Preços só nos seus registros'}
                    onClick={() => setShareOnMap((v) => !v)}
                    className="relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#2ECC49] focus:ring-offset-2"
                    style={{ backgroundColor: shareOnMap ? '#2ECC49' : '#e5e7eb' }}
                  >
                    <span
                      className="absolute top-1 inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200"
                      style={{ left: shareOnMap ? 'calc(100% - 22px)' : '4px' }}
                    />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={saveTransaction}
                className="bg-gradient-primary text-white border-none py-4 px-6 rounded-xl text-base font-semibold cursor-pointer"
              >
                💾 Salvar Transação
              </button>
              <button
                type="button"
                onClick={reset}
                className="bg-[#f3f4f6] text-[#374151] border-none py-4 px-6 rounded-xl text-base cursor-pointer"
              >
                🔄 Escanear Outra
              </button>
            </div>

            {remainingRequests !== null && (
              <p className="text-xs text-[#9ca3af] mt-4">
                {remainingRequests} leituras restantes nesta hora
              </p>
            )}
          </div>
        )}

        {/* STEP: SAVING */}
        {scanTab === 'foto' && step === STEPS.SAVING && (
          <div className="bg-white rounded-[24px] py-16 px-6 text-center card-lovable">
            <div className="w-12 h-12 border-4 border-[#e5e7eb] border-t-[#2ECC49] rounded-full animate-spin mx-auto mb-6" />
            <h2 className="text-xl text-[#333] m-0">Salvando transação...</h2>
          </div>
        )}

        {/* STEP: SUCCESS */}
        {scanTab === 'foto' && step === STEPS.SUCCESS && (
          <div className="bg-white rounded-[24px] py-16 px-6 text-center card-lovable">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl text-[#059669] m-0 mb-2">Nota fiscal salva!</h2>
            {mapFeedback != null && (
              <div className="mt-3 mb-3 text-sm">
                {mapFeedback.mapPointsAdded > 0 ? (
                  <p className="text-[#059669] m-0">
                    🗺️ Seus preços foram divulgados no mapa ({mapFeedback.mapPointsAdded} {mapFeedback.mapPointsAdded === 1 ? 'ponto' : 'pontos'}).
                  </p>
                ) : mapFeedback.mapError ? (
                  <p className="text-amber-700 bg-amber-50 rounded-lg py-2 px-3 m-0">
                    Mapa: {mapFeedback.mapError} Na próxima vez, ative a localização ao salvar ou preencha o endereço.
                  </p>
                ) : null}
              </div>
            )}
            <p className="text-sm text-[#666] m-0">
              Redirecionando para o dashboard...
            </p>
          </div>
        )}
        </div>
        <BottomNav />
      </div>
    </>
  );
}
