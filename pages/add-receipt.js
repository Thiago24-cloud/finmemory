import { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import Head from 'next/head';

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
      const img = new Image();
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
    total_amount: '',
    items: [],
    category: '',
    payment_method: '',
    receipt_image_url: ''
  });

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

  // Redirect se não autenticado
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Processar arquivo selecionado
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validar tipo
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setError('Formato não suportado. Use JPG, PNG ou WebP.');
      return;
    }

    // Validar tamanho inicial (antes de comprimir)
    if (file.size > 10 * 1024 * 1024) { // 10MB limite inicial
      setError('Imagem muito grande. Máximo 10MB.');
      return;
    }

    try {
      // Comprimir imagem
      const compressed = await compressImage(file);
      setImageBase64(compressed);
      setImagePreview(compressed);
      setStep(STEPS.PREVIEW);
    } catch (err) {
      console.error('Erro ao processar imagem:', err);
      setError('Erro ao processar imagem. Tente outra.');
    }
  };

  // Processar imagem via OCR
  const processImage = async () => {
    if (!imageBase64 || !userId) {
      setError('Dados incompletos para processar');
      return;
    }

    setStep(STEPS.PROCESSING);
    setError(null);

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
        throw new Error(result.error || 'Erro ao processar nota fiscal');
      }

      // Salvar dados extraídos
      setExtractedData(result.data);
      setRemainingRequests(result.remaining_requests);
      
      // Preencher formulário
      setFormData({
        date: result.data.date || '',
        merchant_name: result.data.merchant_name || '',
        merchant_cnpj: result.data.merchant_cnpj || '',
        total_amount: result.data.total_amount?.toString() || '',
        items: result.data.items || [],
        category: result.data.category || '',
        payment_method: result.data.payment_method || '',
        receipt_image_url: result.data.receipt_image_url || ''
      });

      setStep(STEPS.EDIT);

    } catch (err) {
      console.error('Erro no OCR:', err);
      setError(err.message);
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
      const response = await fetch('/api/ocr/save-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          ...formData,
          total_amount: parseFloat(formData.total_amount) || 0
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erro ao salvar transação');
      }

      setStep(STEPS.SUCCESS);
      
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
      total_amount: '',
      items: [],
      category: '',
      payment_method: '',
      receipt_image_url: ''
    });
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
        <title>Adicionar Nota Fiscal | FinMemory</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>

      <div className="min-h-screen bg-gradient-primary p-5 font-sans">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="bg-white/20 border-none text-white py-2 px-4 rounded-lg cursor-pointer text-sm hover:bg-white/30 transition-colors"
          >
            ← Voltar
          </button>
          <h1 className="text-white text-2xl m-0">📸 Escanear Nota</h1>
        </div>

        {/* Erro global */}
        {error && (
          <div className="bg-[#fee2e2] border border-[#fecaca] text-[#dc2626] py-3 px-4 rounded-xl mb-5 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* STEP: CAPTURE */}
        {step === STEPS.CAPTURE && (
          <div className="bg-white rounded-[24px] py-10 px-6 text-center card-lovable">
            <div className="text-6xl mb-4">📄</div>
            <h2 className="text-xl text-[#333] m-0 mb-2">Tire uma foto da nota fiscal</h2>
            <p className="text-sm text-[#666] m-0 mb-8">
              Posicione a nota em uma superfície plana com boa iluminação
            </p>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="bg-gradient-primary text-white border-none py-4 px-6 rounded-xl text-base font-semibold cursor-pointer transition-transform hover:scale-[1.02]"
              >
                📷 Tirar Foto
              </button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-[#f3f4f6] text-[#374151] border-none py-4 px-6 rounded-xl text-base cursor-pointer hover:bg-[#e5e7eb] transition-colors"
              >
                🖼️ Escolher da Galeria
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            <p className="text-xs text-[#9ca3af] mt-4">
              Formatos aceitos: JPG, PNG, WebP (máx. 2MB)
            </p>
          </div>
        )}

        {/* STEP: PREVIEW */}
        {step === STEPS.PREVIEW && imagePreview && (
          <div className="bg-white rounded-[24px] p-6 text-center card-lovable">
            <img
              src={imagePreview}
              alt="Preview"
              className="max-w-full max-h-[400px] rounded-xl mb-6 shadow-card-lovable"
            />
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={processImage}
                className="bg-gradient-primary text-white border-none py-4 px-6 rounded-xl text-base font-semibold cursor-pointer"
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
        {step === STEPS.PROCESSING && (
          <div className="bg-white rounded-[24px] py-16 px-6 text-center card-lovable">
            <div className="w-12 h-12 border-4 border-[#e5e7eb] border-t-[#667eea] rounded-full animate-spin mx-auto mb-6" />
            <h2 className="text-xl text-[#333] m-0 mb-2">Lendo sua nota fiscal...</h2>
            <p className="text-sm text-[#666] m-0">
              Isso pode levar alguns segundos
            </p>
          </div>
        )}

        {/* STEP: EDIT */}
        {step === STEPS.EDIT && (
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
                  className="w-full py-3 px-3 border border-[#e5e7eb] rounded-lg text-base box-border"
                  placeholder="Nome da loja"
                />
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
                  className="bg-[#f3f4f6] text-[#667eea] border-none py-2.5 px-4 rounded-lg text-sm cursor-pointer w-full hover:bg-[#e5e7eb]"
                >
                  + Adicionar Item
                </button>
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
        {step === STEPS.SAVING && (
          <div className="bg-white rounded-[24px] py-16 px-6 text-center card-lovable">
            <div className="w-12 h-12 border-4 border-[#e5e7eb] border-t-[#667eea] rounded-full animate-spin mx-auto mb-6" />
            <h2 className="text-xl text-[#333] m-0">Salvando transação...</h2>
          </div>
        )}

        {/* STEP: SUCCESS */}
        {step === STEPS.SUCCESS && (
          <div className="bg-white rounded-[24px] py-16 px-6 text-center card-lovable">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl text-[#059669] m-0 mb-2">Nota fiscal salva!</h2>
            <p className="text-sm text-[#666] m-0">
              Redirecionando para o dashboard...
            </p>
          </div>
        )}
      </div>
    </>
  );
}
