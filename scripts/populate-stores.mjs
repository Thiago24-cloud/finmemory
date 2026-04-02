// scripts/populate-stores.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Carrega .env e .env.local da raiz do projeto (não commita chaves)
const __dirname = dirname(fileURLToPath(import.meta.url))
const roots = [resolve(__dirname, '..'), process.cwd()]
function loadEnv(file) {
  for (const root of roots) {
    const p = resolve(root, file)
    if (existsSync(p)) {
      const content = readFileSync(p, 'utf8')
      for (const line of content.split('\n')) {
        const m = line.match(/^([^#=]+)=(.*)$/)
        if (m) process.env[m[1].trim()] = (m[2].trim() || '').replace(/^["']|["']$/g, '')
      }
      return
    }
  }
}
loadEnv('.env')
loadEnv('.env.local')  // sobrescreve .env se existir

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null

// Tipos de estabelecimentos que você quer buscar
const STORE_TYPES = [
  { googleType: 'supermarket', appType: 'supermarket' },
  { googleType: 'pharmacy',    appType: 'pharmacy'    },
  { googleType: 'bakery',      appType: 'bakery'      },
]

// Raio em metros ao redor do centro de cada área (amostra da região)
const CITY_RADIUS_M = 2500

// Delay entre requisições (ms) para respeitar rate limit da Google Places API
const API_DELAY_MS = 600

// Estado de São Paulo — capital, litoral, interior e RMB (amostragem Google Places por hub)
const AREAS = [
  { name: 'Vila Madalena', city: 'São Paulo', lat: -23.5505, lng: -46.6907, radius: 1500 },
  { name: 'Pinheiros', city: 'São Paulo', lat: -23.5629, lng: -46.6836, radius: 1500 },
  { name: 'Centro', city: 'São Paulo', lat: -23.5505, lng: -46.6333, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Guarulhos', lat: -23.4628, lng: -46.5322, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Campinas', lat: -22.9099, lng: -47.0626, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'São Bernardo do Campo', lat: -23.6919, lng: -46.5644, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Santo André', lat: -23.6639, lng: -46.5383, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Osasco', lat: -23.5325, lng: -46.7917, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Santos', lat: -23.9608, lng: -46.3336, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'São José dos Campos', lat: -23.1896, lng: -45.8841, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Ribeirão Preto', lat: -21.1693, lng: -47.8099, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Sorocaba', lat: -23.5015, lng: -47.4581, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Piracicaba', lat: -22.7256, lng: -47.6493, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Bauru', lat: -22.3147, lng: -49.0606, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Jundiaí', lat: -23.1857, lng: -46.8834, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'São José do Rio Preto', lat: -20.8197, lng: -49.3794, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Americana', lat: -22.7392, lng: -47.3314, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Presidente Prudente', lat: -22.1256, lng: -51.3889, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Marília', lat: -22.2176, lng: -49.9502, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Mogi das Cruzes', lat: -23.5228, lng: -46.1887, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Diadema', lat: -23.6868, lng: -46.6228, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Mauá', lat: -23.6677, lng: -46.4613, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Carapicuíba', lat: -23.5233, lng: -46.8408, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Barueri', lat: -23.5112, lng: -46.8766, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Itu', lat: -23.2642, lng: -47.2991, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Paulínia', lat: -22.7542, lng: -47.1482, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Limeira', lat: -22.5667, lng: -47.4011, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Araraquara', lat: -21.7948, lng: -48.1761, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'São Carlos', lat: -22.0175, lng: -47.8908, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Botucatu', lat: -22.8858, lng: -48.4450, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Jaú', lat: -22.2961, lng: -48.5578, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Franca', lat: -20.5350, lng: -47.4039, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Rio Claro', lat: -22.4110, lng: -47.5614, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Pindamonhangaba', lat: -22.9238, lng: -45.4617, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Taubaté', lat: -23.0264, lng: -45.5552, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Jacareí', lat: -23.3053, lng: -45.9657, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Praia Grande', lat: -24.0061, lng: -46.4028, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Guarujá', lat: -23.9933, lng: -46.2564, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'São Vicente', lat: -23.9603, lng: -46.3942, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Cubatão', lat: -23.8910, lng: -46.4244, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Bragança Paulista', lat: -22.9519, lng: -46.5419, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Itapetininga', lat: -23.5918, lng: -48.0485, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Araçatuba', lat: -21.2089, lng: -50.4328, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Catanduva', lat: -21.1378, lng: -48.9720, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Votuporanga', lat: -20.4225, lng: -49.9787, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Lins', lat: -21.6734, lng: -49.7431, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Assis', lat: -22.6617, lng: -50.4122, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Ourinhos', lat: -22.9792, lng: -49.8706, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Andradina', lat: -20.8961, lng: -51.3714, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Itapeva', lat: -23.9828, lng: -48.8754, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Registro', lat: -24.4871, lng: -47.8449, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Fernandópolis', lat: -20.2846, lng: -50.2464, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Cruzeiro', lat: -22.5732, lng: -44.9697, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Guaratinguetá', lat: -22.8164, lng: -45.2275, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Sertãozinho', lat: -21.1378, lng: -47.9903, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Indaiatuba', lat: -23.0906, lng: -47.2180, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Sumaré', lat: -22.8204, lng: -47.2728, radius: CITY_RADIUS_M },
  { name: 'Centro', city: 'Hortolândia', lat: -22.8583, lng: -47.2200, radius: CITY_RADIUS_M },
]

async function searchPlaces(lat, lng, radius, type) {
  const url = 'https://places.googleapis.com/v1/places:searchNearby'

  const body = {
    includedTypes: [type],
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: radius
      }
    }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types'
    },
    body: JSON.stringify(body)
  })

  const data = await response.json()
  return data.places || []
}

async function saveStore(place, appType, neighborhood, city) {
  const store = {
    name: place.displayName?.text || 'Sem nome',
    type: appType,
    address: place.formattedAddress || null,
    lat: place.location.latitude,
    lng: place.location.longitude,
    radius_meters: 100,
    place_id: place.id,
    neighborhood: neighborhood,
    city: city || 'Brasil',
    active: true
  }

  // upsert evita duplicatas pelo place_id
  const { error } = await supabase
    .from('stores')
    .upsert(store, { onConflict: 'place_id' })

  if (error) {
    console.error(`❌ Erro ao salvar ${store.name}:`, error.message)
  } else {
    console.log(`✅ Salvo: ${store.name} (${appType}) — ${neighborhood}`)
  }
}

async function main() {
  const missing = []
  if (!GOOGLE_PLACES_API_KEY) missing.push('GOOGLE_PLACES_API_KEY')
  if (!SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (missing.length) {
    console.error('❌ Configure no .env.local (ou .env):')
    missing.forEach((m) => console.error('   ', m))
    console.error('\n   Depois rode: node scripts/populate-stores.mjs')
    process.exit(1)
  }

  console.log('🚀 Iniciando busca de estabelecimentos...\n')

  for (const area of AREAS) {
    const cityLabel = area.city || area.name
    console.log(`📍 ${cityLabel} (${area.name})`)

    for (const storeType of STORE_TYPES) {
      console.log(`  🔍 Tipo: ${storeType.googleType}`)

      const places = await searchPlaces(
        area.lat,
        area.lng,
        area.radius,
        storeType.googleType
      )

      console.log(`  → ${places.length} lugares encontrados`)

      for (const place of places) {
        await saveStore(place, storeType.appType, area.name, cityLabel)
      }

      await new Promise(r => setTimeout(r, API_DELAY_MS))
    }

    console.log('')
  }

  console.log('✅ Concluído!')
}

main()
