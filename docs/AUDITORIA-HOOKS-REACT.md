# Auditoria de Hooks React – FinMemory

Objetivo: evitar o erro **React #310** (“Rendered more hooks than during the previous render”) e outros problemas de regras de hooks.

---

## Regra de ouro

- **Sempre chamar todos os hooks no topo do componente**, antes de qualquer `return` condicional.
- **Nunca** colocar `useState`, `useEffect`, `useCallback`, `useMemo` (ou hooks customizados) depois de um `if (...) return ...` ou dentro de `if/else` que possa mudar o número de chamadas entre renders.

---

## Problema encontrado e correção (único caso)

### Arquivo: `pages/transaction/[id].js`

**Problema:** Dois `useState` (`removingPhoto`, `receiptImageUrl`) estavam **depois** dos returns de loading e erro. No primeiro render (loading), o componente retornava antes de chamar esses hooks; quando a transação carregava, passava a chamar mais dois hooks → React #310.

**Correção:** Os dois `useState` foram movidos para o **início** do componente, junto com os demais. O valor de `receiptImageUrl` passou a ser definido no `useEffect` quando os dados da transação chegam (`setReceiptImageUrl(data?.receipt_image_url || null)`).

---

## Páginas e componentes revisados (sem problemas)

| Arquivo | Observação |
|---------|------------|
| `pages/index.js` | Hooks no topo; return condicional só após todos os hooks. |
| `pages/login.js` | Apenas `useEffect`; return único no final. |
| `pages/mapa.js` | Todos os `useState` e `useEffect` no topo. |
| `pages/dashboard.js` | Todos os hooks no topo; returns condicionais depois. |
| `pages/add-receipt.js` | Todos os hooks no topo; return de loading no final. |
| `pages/transaction/[id]/edit.js` | Todos os hooks no topo. |
| `pages/reports.js` | Hooks no topo; returns depois. |
| `pages/categories.js` | Hooks no topo; return de loading depois. |
| `pages/settings.js` | Hooks no topo. |
| `pages/share-price.js` | Hooks no topo. |
| `pages/manual-entry.js` | Hooks no topo. |
| `pages/shopping-list.js` | Hooks no topo; returns condicionais depois. |
| `pages/partnership.js` | Hooks no topo. |
| `components/BottomNav.js` | `useRouter` e `useState` no topo. |
| `components/AddActionSheet.js` | Apenas `useRouter` no topo. |
| `components/dashboard/TransactionList.js` | Apenas `useState` no topo. |

Nenhum outro arquivo apresentou hooks após returns condicionais.

---

## Checklist para novos componentes/páginas

Ao criar ou editar um componente funcional que use hooks:

1. [ ] Todos os `useState`, `useEffect`, `useCallback`, `useMemo` (e hooks customizados) estão no **topo** da função, antes de qualquer `return`?
2. [ ] Não há `useState` ou outros hooks dentro de `if`, `else`, `for` ou após `return`?
3. [ ] Se precisar de um valor que só existe depois de carregar dados, o estado é inicializado no topo (ex.: `null` ou `[]`) e atualizado dentro de `useEffect` ou em handler (ex.: `setReceiptImageUrl(data?.receipt_image_url)`)?

Se todas as respostas forem sim, o risco de React #310 nesse componente fica eliminado.
