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

// Estado de São Paulo — bairros da capital + cidades da região metropolitana e interior
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
