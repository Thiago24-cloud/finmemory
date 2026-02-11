import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ success: false, error: "No image provided" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a receipt/invoice OCR assistant. Extract data from the receipt image and return ONLY valid JSON with this structure:
{
  "merchant_name": "store name",
  "cnpj": "XX.XXX.XXX/XXXX-XX or null",
  "date": "YYYY-MM-DD",
  "total_amount": 123.45,
  "payment_method": "Cartão de Crédito|Cartão de Débito|PIX|Dinheiro",
  "categoria": "Alimentação|Saúde|Transporte|Lazer|Educação|Outros",
  "items": [
    {"descricao": "item name", "quantidade": 1, "valor_total": 12.50}
  ]
}
Return ONLY valid JSON, no markdown or explanation.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              },
              {
                type: 'text',
                text: 'Extract all data from this receipt. Return JSON only.'
              }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API error: ${response.status} - ${errorText}`);
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || '';
    
    // Parse the JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse AI response as JSON");
    }

    const receiptData = JSON.parse(jsonMatch[0]);

    return new Response(
      JSON.stringify({ success: true, data: receiptData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
