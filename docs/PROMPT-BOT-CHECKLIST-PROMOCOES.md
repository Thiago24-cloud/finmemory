# Prompt para colar no Cursor (bot)

Copia o bloco aberto abaixo para o chat do Cursor quando quiseres que o assistente **execute o checklist de promoções** (SQL + agente + validação), em vez de explicares passo a passo.

---

**Prompt:**

```text
No projeto Finmemory, executa o checklist de promoções do mapa conforme docs/CHECKLIST-PROMOCOES-POR-REDE.md.

1) Abre docs/SQL-PRIORIZAR-REDES-PROMOCOES.sql — dá-me os blocos SQL para eu colar no Supabase (ou guia-me se tiveres outra forma). Quando tiver resultados, ajuda a escolher P1 vs P2 vs P3.

2) Na raiz do repositório, com .env com SUPABASE_SERVICE_ROLE_KEY: corre npm run promo:agent:dry e depois npm run promo:p1 (se fizer sentido pelos resultados SQL). Reporta erros.

3) Diz-me como validar no /mapa com “Só promo” ligado.
```

---

Podes encurtar só com: *“Segue o checklist de promoções do mapa (docs/CHECKLIST-PROMOCOES-POR-REDE.md) e a regra promo-map-checklist.”*
