/**
 * Compartilha imagem da nota + texto via Web Share API (WhatsApp, e-mail, etc.).
 * No celular costuma abrir o WhatsApp com a foto anexada.
 */
export async function shareReceiptWithNativeSheet({ imageUrl, text, filename = 'nota-finmemory' }) {
  if (typeof window === 'undefined' || !imageUrl) {
    return { ok: false, reason: 'unsupported' };
  }
  try {
    const res = await fetch(imageUrl, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) return { ok: false, reason: 'fetch' };
    const blob = await res.blob();
    const ext = blob.type.includes('png') ? 'png' : 'jpg';
    const mime = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
    const file = new File([blob], `${filename}.${ext}`, { type: mime });
    const shortText = String(text || '').slice(0, 3500);
    const payload = { files: [file], title: 'Nota fiscal', text: shortText };
    if (typeof navigator.share !== 'function') return { ok: false, reason: 'no-share' };
    if (typeof navigator.canShare === 'function' && !navigator.canShare(payload)) {
      const imageOnly = { files: [file], title: 'Nota fiscal' };
      if (navigator.canShare(imageOnly)) {
        await navigator.share(imageOnly);
        return { ok: true };
      }
      return { ok: false, reason: 'cannot-share-files' };
    }
    await navigator.share(payload);
    return { ok: true };
  } catch (e) {
    if (e && String(e.name) === 'AbortError') return { ok: false, reason: 'cancelled' };
    console.error('[shareReceiptWithNativeSheet]', e);
    return { ok: false, reason: 'error' };
  }
}
