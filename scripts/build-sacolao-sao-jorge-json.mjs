/**
 * Gera data/curadoria/sacolao-sao-jorge-operacao-abre-mes-2026-04.json
 * Rode: node scripts/build-sacolao-sao-jorge-json.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, '../data/curadoria/sacolao-sao-jorge-operacao-abre-mes-2026-04.json');

function row(nome, preco, cat, vf, vu, note) {
  const o = { nome_produto: nome, preco, categoria: cat, valid_from: vf, valid_until: vu };
  if (note) o.validity_note = note;
  return o;
}

const NH = 'Seg e sex: 06 e 10/04/2026';
const hortifruti = [
  ['Laranja Pera (kg)', 3.98],
  ['Maracujá Azedo (kg)', 7.98],
  ['Caqui Fuyu (kg)', 13.98],
  ['Maçã Gala (kg)', 9.98],
  ['Abacaxi Pérola (un)', 9.98],
  ['Manga Palmer (kg)', 9.98],
  ['Melancia (kg)', 2.98],
  ['Limão Taiti (kg)', 4.98],
  ['Mexerica Ponkan (kg)', 8.98],
  ['Pêra Williams (kg)', 9.98],
  ['Caqui Rama Bandeja 500 g', 7.98],
  ['Banana Nanica (kg)', 5.98],
  ['Mandioca Desc. à vácuo 1 kg', 7.98],
  ['Batata Doce Rosada (kg)', 6.98],
  ['Milho Verde Bandeja 600 g', 4.98],
  ['Berinjela (kg)', 6.98],
  ['Batata Lavada 300 g', 2.98],
  ['Abobrinha Italiana (kg)', 5.98],
  ['Alface Crespa Hidrop. (un)', 2.98],
  ['Pepino Comum (kg)', 3.98],
  ['Alho Roxo 100 g', 2.98],
  ['Cebola (kg)', 2.98],
  ['Abóbora Cabotian (kg)', 4.98],
  ['Chuchu Verde (kg)', 3.98],
  ['Mandioquinha (kg)', 7.98],
].map(([n, p]) => row(n, p, 'Hortifruti', '2026-04-06', '2026-04-10', NH));

const N1 = 'Somente segunda 06/04/2026';
const seg = [
  ['Feijão Carioca Camil 1 kg', 5.98, 'Mercearia'],
  ["Maionese Hellmann's 500 g", 7.98, 'Mercearia'],
  ['Bisnaguinhas Panco 300 g', 5.98, 'Mercearia'],
  ['Presunto Seara (100 g)', 2.98, 'Carnes'],
  ['Requeijão Vigor Tradicional 200 g', 6.98, 'Laticínios'],
].map(([n, p, c]) => row(n, p, c, '2026-04-06', '2026-04-06', N1));

const N2 = 'Somente terça 07/04/2026';
const ter = [
  ['Frango à Passarinha (kg)', 13.98, 'Carnes'],
  ['Asa de Frango (kg)', 17.98, 'Carnes'],
  ['Espetinho de Frango Emp. (kg)', 37.98, 'Carnes'],
  ['Filé de Frango Empanado (kg)', 29.98, 'Carnes'],
  ['Coxa c/ Sobrecoxa de Frango (kg)', 8.98, 'Carnes'],
  ['Margarina Qualy c/ Sal 500 g', 6.98, 'Mercearia'],
  ['Feijão Preto Camil 1 kg', 6.58, 'Mercearia'],
  ['Óleo de Soja Soya 900 ml', 7.48, 'Mercearia'],
  ['Café 3 Corações Forte 500 g', 23.98, 'Mercearia'],
  ['Batata Palito Sadia 500 g', 24.98, 'Mercearia'],
  ['Lava Roupas Omo 900 ml', 9.98, 'Limpeza'],
  ['Cerveja Petra Lata 269 ml', 2.18, 'Bebidas'],
].map(([n, p, c]) => row(n, p, c, '2026-04-07', '2026-04-07', N2));

const N3 = 'Somente quarta 08/04/2026';
const qua = [
  ['Miolo de Acém (kg)', 41.98, 'Carnes'],
  ['Açúcar Refinado União 1 kg', 3.58, 'Mercearia'],
  ['Pão de Forma Panco 500 g', 6.98, 'Mercearia'],
  ['Acém c/ Osso (kg)', 29.98, 'Carnes'],
  ['Salsicha Hot Dog Sadia', 10.98, 'Mercearia'],
  ['Costela Gaúcha (kg)', 31.98, 'Carnes'],
  ['Coxão Duro (kg)', 44.98, 'Carnes'],
  ['Queijo Minas Frescal Quatá (kg)', 49.98, 'Laticínios'],
  ['Lava Louças Ypê Neutro 500 ml', 1.78, 'Limpeza'],
  ['Chuleta Paulista (kg)', 31.98, 'Carnes'],
  ['Cerveja Eisenbahn Lata 269 ml', 2.38, 'Bebidas'],
].map(([n, p, c]) => row(n, p, c, '2026-04-08', '2026-04-08', N3));

const N4 = 'Somente quinta 09/04/2026';
const qui = [
  ['Pernil Fatiado c/ Osso (kg)', 12.98, 'Carnes'],
  ['Picadão Suíno c/ Osso (kg)', 11.98, 'Carnes'],
  ['Bisteca Copa (kg)', 15.98, 'Carnes'],
  ['Bisteca Lombo (kg)', 16.98, 'Carnes'],
  ['Panceta Suína (kg)', 31.98, 'Carnes'],
  ['Joelho Suíno (kg)', 11.98, 'Carnes'],
  ['Pé Suíno (kg)', 11.98, 'Carnes'],
  ['Castela Suína Calpira (kg)', 31.98, 'Carnes'],
  ['Queijo Mussarela Tirolat 100 g (a partir de 3 un.)', 5.68, 'Laticínios'],
  ['Linguiça Toscana Seara (kg)', 19.98, 'Carnes'],
  ['Arroz Nene T1 5 kg', 13.98, 'Mercearia'],
  ['Macarrão c/ Ovos Adria 500 g', 2.78, 'Mercearia'],
  ['Molho de Tomate Quero 240 g', 1.28, 'Mercearia'],
  ['Café 3 Corações Forte 500 g', 26.98, 'Mercearia'],
].map(([n, p, c]) => row(n, p, c, '2026-04-09', '2026-04-09', N4));

const N56 = 'Sábado e domingo: 11 e 12/04/2026';
const vacuo = [
  ['Picanha Estância 92 (kg)', 122.98],
  ['Baby Beef Estância 92 (kg)', 69.98],
  ['Bife de Chorizo Estância 92 (kg)', 68.98],
  ['Picanha Bassi (kg)', 122.98],
  ['Bife Ancho Bassi (kg)', 64.98],
  ['Contra Filé Friboi (kg)', 49.98],
  ['Ponta de Peito Friboi (kg)', 33.98],
  ['Bife Ancho Pul Selection (kg)', 57.98],
  ['Coração de Alcatra Montana (kg)', 49.98],
  ['Bife de Chorizo Steakhouse (kg)', 58.98],
  ['Picanha Montana (kg)', 69.98],
  ['Bife Ancho Maturatta Friboi (kg)', 53.98],
  ['Filé Mignon Steakhouse (kg)', 86.98],
  ['Fraldinho Montana (kg)', 45.98],
].map(([n, p]) => row(n, p, 'Carnes', '2026-04-11', '2026-04-12', N56));

const topo = [
  ['Azeite Andorinha Extra Virgem 500 ml', 25.98, 'Mercearia'],
  ['Leite UHT Piracanjuba Desnatado 1 L', 4.98, 'Laticínios'],
  ['Leite Condensado Italac 395 g', 5.38, 'Laticínios'],
  ['Sorvete Kibon 1,5 L', 19.98, 'Outros'],
  ['Queijo Parmesão Faixa Azul 150 g', 29.98, 'Laticínios'],
  ['Lasanha Seara Bolonhesa 600 g', 12.98, 'Mercearia'],
  ['Cerveja Original Lata 269 ml', 2.98, 'Bebidas'],
].map(([n, p, c]) => row(n, p, c, '2026-04-11', '2026-04-12', N56));

const NW = 'De 06 a 12/04/2026 (encarte semanal)';
const frios = [
  ['Iogurte Natural Vigor 150 g', 2.98, 'Laticínios'],
  ['Cream Cheese Scala 150 g', 8.98, 'Laticínios'],
  ['Queijo Brie Quatá (kg)', 99.98, 'Laticínios'],
  ['Creme de Queijo Quatá 180 g', 6.98, 'Laticínios'],
  ['Queijo Prato Quatá 100 g', 5.48, 'Laticínios'],
  ['Mortadela Seara 100 g', 2.98, 'Carnes'],
  ['Manteiga Président c/ Sal 200 g', 10.98, 'Laticínios'],
  ['Pão de Alho Zinho 300 g', 1.98, 'Mercearia'],
  ['Queijo Gouda Supremo (kg)', 84.98, 'Laticínios'],
  ['Hambúrguer Maturatta 180 g', 5.98, 'Carnes'],
  ['Petisco Frango Copacol 1 kg', 14.98, 'Carnes'],
  ['Coxinha da Asa Copacol 800 g', 9.98, 'Carnes'],
  ['Kit Feijoada (kg)', 34.98, 'Carnes'],
].map(([n, p, c]) => row(n, p, c, '2026-04-06', '2026-04-12', NW));

const hig = [
  ['Papel Higiênico Neve c/ 12', 14.98, 'Limpeza'],
  ['Creme Dental Sensodyne 90 g', 12.98, 'Higiene'],
  ['Ração Whiskas/Pedigree 85–100 g', 1.98, 'Outros'],
  ['Sabão em Pó Ace 800 g', 5.98, 'Limpeza'],
  ['Lava Louças Ypê/Clear 500 ml', 2.28, 'Limpeza'],
  ['Lava Roupas Omo Refil 900 ml', 12.98, 'Limpeza'],
  ['Desinfetante Búfalo 2 L', 4.98, 'Limpeza'],
  ['Removedor Suprema 500 ml', 5.98, 'Limpeza'],
].map(([n, p, c]) => row(n, p, c, '2026-04-06', '2026-04-12', NW));

const merc = [
  ['Arroz Branco Nene 5 kg', 15.98, 'Mercearia'],
  ['Feijão Preto Camil 1 kg', 6.98, 'Mercearia'],
  ['Feijão Carioca Camil 1 kg', 7.98, 'Mercearia'],
  ["Maionese Hellmann's 500 g", 9.98, 'Mercearia'],
  ['Macarrão c/ Ovos Adria 500 g', 2.78, 'Mercearia'],
  ['Farofa Pronta Yoki 400 g', 4.58, 'Mercearia'],
  ['Flocos de Milho Dona Clara 500 g', 1.88, 'Mercearia'],
  ['Óleo de Soja Soya 900 ml', 7.78, 'Mercearia'],
  ['Azeite Andorinha 500 ml', 26.98, 'Mercearia'],
  ['Molho de Tomate Quero 240 g', 1.58, 'Mercearia'],
  ['Bisnaguinhas Panco 300 g', 6.98, 'Mercearia'],
  ["Cereal Sucrilhos Kellogg's 700 g", 15.98, 'Mercearia'],
  ['Leite UHT Piracanjuba 1 L', 5.48, 'Laticínios'],
  ['Café 3 Corações Forte 500 g', 26.98, 'Mercearia'],
  ['Tapioca De Terinha 500 g', 3.98, 'Mercearia'],
  ['Açúcar Refinado União 1 kg', 3.78, 'Mercearia'],
  ['Leite Condensado Italac 395 g', 5.88, 'Laticínios'],
  ['Pão de Forma Panco 300 g', 7.98, 'Mercearia'],
  ['Biscoito Recheado Negresco 90 g', 2.58, 'Mercearia'],
  ['Chocolate Kit Kat 41,5 g', 2.98, 'Mercearia'],
  ['Chocolate Nestlé Crunch 80 g', 7.98, 'Mercearia'],
].map(([n, p, c]) => row(n, p, c, '2026-04-06', '2026-04-12', NW));

const beb = [
  ['Água Mineral Minalba 1,5 L', 2.48, 'Bebidas'],
  ['Aperitivo Campari 748 ml', 44.98, 'Bebidas'],
  ['Energético Baly 2 L', 7.98, 'Bebidas'],
  ['Licor 43 Barcelona 700 ml', 129.98, 'Bebidas'],
  ['Suco Uva Aurora 1,5 L', 15.98, 'Bebidas'],
  ['Cerveja Amstel Ultra 355 ml', 4.28, 'Bebidas'],
  ['Vinho Português Mateus Branco 750 ml', 39.98, 'Bebidas'],
  ['Vinho Chileno Santa Carolina 750 ml', 21.98, 'Bebidas'],
  ['Vinho Argentino Toro Centenário 750 ml', 19.98, 'Bebidas'],
  ['Vinho Português EA Tinto 750 ml', 54.98, 'Bebidas'],
  ['Cerveja Petra Lata 269 ml', 2.38, 'Bebidas'],
  ['Cerveja Eisenbahn 500 ml', 2.58, 'Bebidas'],
  ['Cerveja Original 269 ml', 3.38, 'Bebidas'],
].map(([n, p, c]) => row(n, p, c, '2026-04-06', '2026-04-12', NW));

const produtos = [
  ...hortifruti,
  ...seg,
  ...ter,
  ...qua,
  ...qui,
  ...vacuo,
  ...topo,
  ...frios,
  ...hig,
  ...merc,
  ...beb,
];

const doc = {
  meta: {
    loja: 'Sacolão São Jorge — Operação Abre Mês (3 unidades SP)',
    supermercado_slug: 'saojorge',
    unidades: [
      {
        nome: 'Vila Madalena — Rua Isabel de Castela, 33',
        lat: -23.5505,
        lng: -46.6833,
      },
      {
        nome: 'Vila Alexandria — Av. Santa Catarina, 482',
        lat: -23.6331,
        lng: -46.6384,
      },
      {
        nome: 'Cidade Dutra — Rua Cambuci do Vale, 694',
        lat: -23.7282,
        lng: -46.7019,
      },
    ],
    validade_encarte_ate: '2026-04-12',
    expira_em: '2026-04-12T23:59:59-03:00',
    atualizado_em: '2026-04-08T12:00:00-03:00',
    run_id: 'curadoria-sacolao-sao-jorge-abre-mes-2026-04',
    ingest_source: 'curadoria_json:sacolao_sao_jorge_abre_mes:2026-04-08',
    notas:
      'Coordenadas aproximadas — alinhe com public.stores. Folheto com ofertas por dia: validity_note + valid_from/until por linha.',
  },
  produtos,
};

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(doc, null, 2), 'utf8');
console.log('Wrote', out, 'produtos:', produtos.length, '× 3 unidades →', produtos.length * 3, 'linhas SQL');
