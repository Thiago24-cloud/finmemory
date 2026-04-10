-- Loja de teste: "Mercadinho Vila Mada" — Rua Harmonia, 420, Vila Madalena
-- Colar no Supabase → SQL Editor (confirma com o SELECT antes de apagar).

-- 1) Ver linhas que serão removidas
SELECT id, name, type, address, neighborhood, lat, lng, active
FROM public.stores
WHERE name ILIKE '%Mercadinho Vila Mada%'
   OR (
     address ILIKE '%Harmonia%'
     AND address ILIKE '%420%'
     AND name ILIKE '%Vila Mada%'
   );

-- 2) Apagar (só depois de conferir o resultado acima)
DELETE FROM public.stores
WHERE name ILIKE '%Mercadinho Vila Mada%'
   OR (
     address ILIKE '%Harmonia%'
     AND address ILIKE '%420%'
     AND name ILIKE '%Vila Mada%'
   )
RETURNING id, name, address;
