/**
 * Presets para curadoria: print / Instagram / site → Vision API
 * (loja, slug, pin — você só envia a imagem).
 * Fonte: data/curadoria/*.json e docs de curadoria.
 */

export const CURADORIA_STORE_PRESETS = [
  {
    id: 'pomar-vila-madalena',
    label: 'Pomar da Vila — Vila Madalena',
    supermercado: 'pomardavilavilamadalena',
    storeName: 'Pomar da Vila — Vila Madalena',
    geocodeQuery: 'Rua Mourato Coelho, 1458, Vila Madalena, São Paulo, SP, Brasil',
    lat: -23.5547,
    lng: -46.6912,
  },
  {
    id: 'sacolao-sao-jorge-vila-madalena',
    label: 'Sacolão São Jorge — Vila Madalena',
    supermercado: 'saojorge',
    storeName: 'Sacolão São Jorge — Vila Madalena',
    geocodeQuery: 'Rua Isabel de Castela, 33, Vila Madalena, São Paulo, SP, Brasil',
    lat: -23.5505,
    lng: -46.6833,
  },
];
