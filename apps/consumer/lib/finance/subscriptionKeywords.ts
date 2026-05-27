/**
 * Serviços recorrentes conhecidos — correspondência por substring na descrição normalizada.
 */
export type SubscriptionKeywordRule = {
  /** Substring ou regex (flags i) aplicada à descrição normalizada */
  match: string | RegExp;
  nome_amigavel: string;
  categoria?: string;
};

export const SUBSCRIPTION_KEYWORD_RULES: SubscriptionKeywordRule[] = [
  { match: 'NETFLIX', nome_amigavel: 'Netflix', categoria: 'Streaming' },
  { match: 'SPOTIFY', nome_amigavel: 'Spotify', categoria: 'Streaming' },
  { match: /AMZN|AMAZON\s*PRIME|AMAZONPRIME|AMAZON\s*MUSIC/i, nome_amigavel: 'Amazon Prime', categoria: 'Streaming' },
  { match: 'DISNEY', nome_amigavel: 'Disney+', categoria: 'Streaming' },
  { match: /APPLE\.COM|APPLE COM|ICLOUD|ITUNES|APPLE MUSIC/i, nome_amigavel: 'Apple / iCloud', categoria: 'Streaming' },
  { match: /GOOGLE\s*ONE|GOOGLE\s*STORAGE|GOOGLE\s*PLAY|YOUTUBE\s*PREMIUM|YT\s*PREMIUM/i, nome_amigavel: 'Google / YouTube', categoria: 'Streaming' },
  { match: 'CRUNCHYROLL', nome_amigavel: 'Crunchyroll', categoria: 'Streaming' },
  { match: 'GYMPASS', nome_amigavel: 'Gympass', categoria: 'Assinatura' },
  { match: /HBO\s*MAX|\bHBO\b|\bMAX\s*STREAM/i, nome_amigavel: 'HBO Max', categoria: 'Streaming' },
  { match: 'GLOBOPLAY', nome_amigavel: 'Globoplay', categoria: 'Streaming' },
  { match: 'DEEZER', nome_amigavel: 'Deezer', categoria: 'Streaming' },
  { match: 'PARAMOUNT', nome_amigavel: 'Paramount+', categoria: 'Streaming' },
  { match: /STAR\s*\+|STARPLUS/i, nome_amigavel: 'Star+', categoria: 'Streaming' },
  { match: /MICROSOFT|XBOX|OFFICE\s*365|MSFT/i, nome_amigavel: 'Microsoft', categoria: 'Assinatura' },
  { match: /CLARO\s*TV|CLARO\s*CONTROLE|VIVO\s*FIBRA|TIM\s*CONTROLE|OI\s*FIBRA/i, nome_amigavel: 'Telecom', categoria: 'Servicos' },
  { match: 'ADOBE', nome_amigavel: 'Adobe', categoria: 'Assinatura' },
  { match: 'NOTION', nome_amigavel: 'Notion', categoria: 'Assinatura' },
  { match: 'DROPBOX', nome_amigavel: 'Dropbox', categoria: 'Assinatura' },
  { match: 'OPENAI|CHATGPT', nome_amigavel: 'ChatGPT', categoria: 'Assinatura' },
  { match: 'CANVA', nome_amigavel: 'Canva', categoria: 'Assinatura' },
  { match: 'LINKEDIN', nome_amigavel: 'LinkedIn', categoria: 'Assinatura' },
  { match: 'UBER\s*ONE|UBERONE', nome_amigavel: 'Uber One', categoria: 'Assinatura' },
  { match: 'RAPPI\s*PRIME|RAPPIPRIME', nome_amigavel: 'Rappi Prime', categoria: 'Assinatura' },
  { match: 'IFOOD\s*CLUB', nome_amigavel: 'iFood Club', categoria: 'Assinatura' },
];
