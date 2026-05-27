/**
 * Validação opcional (OpenAI vision): descarta URLs que são claramente suplemento / não-comida.
 * Ative com MAP_PRODUCT_IMAGE_VISION_VALIDATE=1 e OPENAI_API_KEY.
 */

const DEFAULT_MODEL = 'gpt-4o-mini';

function visionEnabled() {
  return (
    typeof process !== 'undefined' &&
    process.env?.MAP_PRODUCT_IMAGE_VISION_VALIDATE === '1' &&
    Boolean(process.env?.OPENAI_API_KEY?.trim())
  );
}

/**
 * @param {string} imageUrl
 * @param {string} productName
 * @returns {Promise<boolean>} true = aceitar imagem
 */
export async function validateMapProductImageUrl(imageUrl, productName) {
  if (!visionEnabled()) return true;
  const url = String(imageUrl || '').trim();
  const label = String(productName || '').trim().slice(0, 200);
  if (!url || !/^https?:\/\//i.test(url)) return false;

  let OpenAI;
  try {
    ({ default: OpenAI } = await import('openai'));
  } catch {
    return true;
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.MAP_PRODUCT_IMAGE_VISION_MODEL?.trim() || DEFAULT_MODEL;

  const sys =
    'You are a strict classifier for a grocery / restaurant price map. Given a product title and an image URL, decide if the image is appropriate: packaged food, fresh food, restaurant menu item, or drink. Reject protein supplements, whey, pharmacy-only products, gym products, cosmetics, or unrelated items. Reply with JSON only: {"ok":true} or {"ok":false}.';

  const user = `Product title: ${label || '(empty)'}\nImage URL: ${url}\nIs this image appropriate for this product in a supermarket or fast-food context?`;

  try {
    const res = await client.chat.completions.create({
      model,
      max_tokens: 80,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sys },
        {
          role: 'user',
          content: [
            { type: 'text', text: user },
            { type: 'image_url', image_url: { url, detail: 'low' } },
          ],
        },
      ],
    });
    const raw = res?.choices?.[0]?.message?.content?.trim();
    if (!raw) return true;
    const parsed = JSON.parse(raw);
    return Boolean(parsed?.ok);
  } catch (e) {
    console.warn('validateMapProductImageUrl:', e?.message || e);
    return true;
  }
}

export { visionEnabled };
