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
      <div style={styles.container}>
        <div style={styles.loading}>Carregando...</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Adicionar Nota Fiscal | FinMemory</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>

      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <button onClick={() => router.push('/dashboard')} style={styles.backButton}>
            ← Voltar
          </button>
          <h1 style={styles.title}>📸 Escanear Nota</h1>
        </div>

        {/* Erro global */}
        {error && (
          <div style={styles.errorBox}>
            ⚠️ {error}
          </div>
        )}

        {/* STEP: CAPTURE */}
        {step === STEPS.CAPTURE && (
          <div style={styles.captureContainer}>
            <div style={styles.captureIcon}>📄</div>
            <h2 style={styles.captureTitle}>Tire uma foto da nota fiscal</h2>
            <p style={styles.captureSubtitle}>
              Posicione a nota em uma superfície plana com boa iluminação
            </p>

            <div style={styles.buttonGroup}>
              {/* Botão Câmera */}
              <button
                onClick={() => cameraInputRef.current?.click()}
                style={styles.primaryButton}
              >
                📷 Tirar Foto
              </button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />

              {/* Botão Galeria */}
              <button
                onClick={() => fileInputRef.current?.click()}
                style={styles.secondaryButton}
              >
                🖼️ Escolher da Galeria
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </div>

            <p style={styles.hint}>
              Formatos aceitos: JPG, PNG, WebP (máx. 2MB)
            </p>
          </div>
        )}

        {/* STEP: PREVIEW */}
        {step === STEPS.PREVIEW && imagePreview && (
          <div style={styles.previewContainer}>
            <img src={imagePreview} alt="Preview" style={styles.previewImage} />
            
            <div style={styles.buttonGroup}>
              <button onClick={processImage} style={styles.primaryButton}>
                ✅ Processar Nota
              </button>
              <button onClick={reset} style={styles.secondaryButton}>
                🔄 Tirar Outra Foto
              </button>
            </div>
          </div>
        )}

        {/* STEP: PROCESSING */}
        {step === STEPS.PROCESSING && (
          <div style={styles.processingContainer}>
            <div style={styles.spinner}></div>
            <h2 style={styles.processingTitle}>Lendo sua nota fiscal...</h2>
            <p style={styles.processingSubtitle}>
              Isso pode levar alguns segundos
            </p>
          </div>
        )}

        {/* STEP: EDIT */}
        {step === STEPS.EDIT && (
          <div style={styles.editContainer}>
            <h2 style={styles.editTitle}>Confira os dados</h2>
            <p style={styles.editSubtitle}>
              Corrija se necessário antes de salvar
            </p>

            {/* Preview da imagem pequeno */}
            {imagePreview && (
              <img src={imagePreview} alt="Nota" style={styles.thumbnailImage} />
            )}

            {/* Formulário */}
            <div style={styles.form}>
              {/* Estabelecimento */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Estabelecimento *</label>
                <input
                  type="text"
                  value={formData.merchant_name}
                  onChange={(e) => updateField('merchant_name', e.target.value)}
                  style={styles.input}
                  placeholder="Nome da loja"
                />
              </div>

              {/* CNPJ */}
              <div style={styles.formGroup}>
                <label style={styles.label}>CNPJ</label>
                <input
                  type="text"
                  value={formData.merchant_cnpj || ''}
                  onChange={(e) => updateField('merchant_cnpj', e.target.value)}
                  style={styles.input}
                  placeholder="00.000.000/0000-00"
                />
              </div>

              {/* Data e Valor */}
              <div style={styles.formRow}>
                <div style={{ ...styles.formGroup, flex: 1 }}>
                  <label style={styles.label}>Data</label>
                  <input
                    type="date"
                    value={formData.date || ''}
                    onChange={(e) => updateField('date', e.target.value)}
                    style={styles.input}
                  />
                </div>
                <div style={{ ...styles.formGroup, flex: 1 }}>
                  <label style={styles.label}>Valor Total *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.total_amount}
                    onChange={(e) => updateField('total_amount', e.target.value)}
                    style={styles.input}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Categoria e Pagamento */}
              <div style={styles.formRow}>
                <div style={{ ...styles.formGroup, flex: 1 }}>
                  <label style={styles.label}>Categoria</label>
                  <select
                    value={formData.category || ''}
                    onChange={(e) => updateField('category', e.target.value)}
                    style={styles.input}
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
                <div style={{ ...styles.formGroup, flex: 1 }}>
                  <label style={styles.label}>Pagamento</label>
                  <select
                    value={formData.payment_method || ''}
                    onChange={(e) => updateField('payment_method', e.target.value)}
                    style={styles.input}
                  >
                    <option value="">Selecione</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Débito">Débito</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="PIX">PIX</option>
                  </select>
                </div>
              </div>

              {/* Itens */}
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  Itens ({formData.items?.length || 0})
                </label>
                
                {formData.items?.map((item, index) => (
                  <div key={index} style={styles.itemRow}>
                    <input
                      type="text"
                      value={item.name || ''}
                      onChange={(e) => updateItem(index, 'name', e.target.value)}
                      style={{ ...styles.input, flex: 2 }}
                      placeholder="Nome do item"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={item.price || ''}
                      onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                      style={{ ...styles.input, flex: 1, minWidth: '80px' }}
                      placeholder="0.00"
                    />
                    <button
                      onClick={() => removeItem(index)}
                      style={styles.removeItemButton}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                
                <button onClick={addItem} style={styles.addItemButton}>
                  + Adicionar Item
                </button>
              </div>
            </div>

            {/* Botões de ação */}
            <div style={styles.buttonGroup}>
              <button onClick={saveTransaction} style={styles.primaryButton}>
                💾 Salvar Transação
              </button>
              <button onClick={reset} style={styles.secondaryButton}>
                🔄 Escanear Outra
              </button>
            </div>

            {remainingRequests !== null && (
              <p style={styles.hint}>
                {remainingRequests} leituras restantes nesta hora
              </p>
            )}
          </div>
        )}

        {/* STEP: SAVING */}
        {step === STEPS.SAVING && (
          <div style={styles.processingContainer}>
            <div style={styles.spinner}></div>
            <h2 style={styles.processingTitle}>Salvando transação...</h2>
          </div>
        )}

        {/* STEP: SUCCESS */}
        {step === STEPS.SUCCESS && (
          <div style={styles.successContainer}>
            <div style={styles.successIcon}>✅</div>
            <h2 style={styles.successTitle}>Nota fiscal salva!</h2>
            <p style={styles.successSubtitle}>
              Redirecionando para o dashboard...
            </p>
          </div>
        )}
      </div>

      {/* CSS para spinner */}
      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}

// Estilos
const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '24px'
  },
  backButton: {
    background: 'rgba(255,255,255,0.2)',
    border: 'none',
    color: 'white',
    padding: '8px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  title: {
    color: 'white',
    fontSize: '24px',
    margin: 0
  },
  errorBox: {
    background: '#fee2e2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    padding: '12px 16px',
    borderRadius: '12px',
    marginBottom: '20px',
    fontSize: '14px'
  },
  loading: {
    color: 'white',
    textAlign: 'center',
    padding: '40px'
  },

  // Capture step
  captureContainer: {
    background: 'white',
    borderRadius: '24px',
    padding: '40px 24px',
    textAlign: 'center'
  },
  captureIcon: {
    fontSize: '64px',
    marginBottom: '16px'
  },
  captureTitle: {
    fontSize: '20px',
    color: '#333',
    margin: '0 0 8px 0'
  },
  captureSubtitle: {
    fontSize: '14px',
    color: '#666',
    margin: '0 0 32px 0'
  },
  buttonGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  primaryButton: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: 'white',
    border: 'none',
    padding: '16px 24px',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'transform 0.2s'
  },
  secondaryButton: {
    background: '#f3f4f6',
    color: '#374151',
    border: 'none',
    padding: '16px 24px',
    borderRadius: '12px',
    fontSize: '16px',
    cursor: 'pointer'
  },
  hint: {
    fontSize: '12px',
    color: '#9ca3af',
    marginTop: '16px'
  },

  // Preview step
  previewContainer: {
    background: 'white',
    borderRadius: '24px',
    padding: '24px',
    textAlign: 'center'
  },
  previewImage: {
    maxWidth: '100%',
    maxHeight: '400px',
    borderRadius: '12px',
    marginBottom: '24px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
  },

  // Processing step
  processingContainer: {
    background: 'white',
    borderRadius: '24px',
    padding: '60px 24px',
    textAlign: 'center'
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '4px solid #e5e7eb',
    borderTop: '4px solid #667eea',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 24px'
  },
  processingTitle: {
    fontSize: '20px',
    color: '#333',
    margin: '0 0 8px 0'
  },
  processingSubtitle: {
    fontSize: '14px',
    color: '#666',
    margin: 0
  },

  // Edit step
  editContainer: {
    background: 'white',
    borderRadius: '24px',
    padding: '24px'
  },
  editTitle: {
    fontSize: '20px',
    color: '#333',
    margin: '0 0 4px 0'
  },
  editSubtitle: {
    fontSize: '14px',
    color: '#666',
    margin: '0 0 16px 0'
  },
  thumbnailImage: {
    width: '100%',
    maxHeight: '150px',
    objectFit: 'cover',
    borderRadius: '12px',
    marginBottom: '20px'
  },
  form: {
    marginBottom: '24px'
  },
  formGroup: {
    marginBottom: '16px'
  },
  formRow: {
    display: 'flex',
    gap: '12px'
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
    marginBottom: '6px'
  },
  input: {
    width: '100%',
    padding: '12px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '16px',
    boxSizing: 'border-box'
  },
  itemRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '8px',
    alignItems: 'center'
  },
  removeItemButton: {
    background: '#fee2e2',
    color: '#dc2626',
    border: 'none',
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  addItemButton: {
    background: '#f3f4f6',
    color: '#667eea',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    width: '100%'
  },

  // Success step
  successContainer: {
    background: 'white',
    borderRadius: '24px',
    padding: '60px 24px',
    textAlign: 'center'
  },
  successIcon: {
    fontSize: '64px',
    marginBottom: '16px'
  },
  successTitle: {
    fontSize: '24px',
    color: '#059669',
    margin: '0 0 8px 0'
  },
  successSubtitle: {
    fontSize: '14px',
    color: '#666',
    margin: 0
  }
};
