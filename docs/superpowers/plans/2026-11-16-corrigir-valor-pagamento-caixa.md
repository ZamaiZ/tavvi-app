# Corrigir a entrada de valor no Caixa Implementation Plan

> **For agentic workers:** Se a implementação for solicitada, execute a tarefa diretamente com `superpowers:executing-plans`, respeitando as restrições locais. Não delegue.

**Goal:** Fazer a digitação sequencial no campo de pagamento preservar todos os dígitos e manter `5026` como `50,26`.

**Architecture:** Manter a máscara atual de centavos e corrigir somente o cálculo de posição do cursor em `PaymentAmountInput`. Usar como referência a contagem de zeros introduzidos pela máscara já aplicada em `MenuPriceInput`. Não alterar parsing, estado do formulário, cálculo do pagamento ou servidor.

**Tech Stack:** React, TypeScript, `Intl.NumberFormat` existente e componentes locais de input.

**Spec:** `docs/superpowers/specs/2026-11-16-pagamentos-fechamento-comanda-design.md`, que determina entrada de pagamento em centavos e alinhada visualmente ao Cardápio.

## Global Constraints

- Não executar `git`, `typecheck`, `build`, `lint` ou `test`.
- Não adicionar nem executar testes.
- Antes de escrever código, ler o guia Next.js relevante em `node_modules/next/dist/docs/`, conforme `AGENTS.md`.
- Manter a mudança restrita à máscara/cursor do campo de pagamento.

## Review Focus

- Digitação sequencial de `5026` resulta em `50,26` e 5026 centavos.
- Edição no meio do valor e backspace mantêm o cursor junto aos dígitos esperados.
- Colagem de `5026` segue resultando em `50,26`.
- A máscara continua limitando a entrada a 16 dígitos.

---

## Causa identificada

`maskPaymentAmountInput("5")` formata o valor como `0,05`, que contém mais dígitos que a entrada bruta. O campo do Caixa restaura o cursor usando somente a contagem original de dígitos; após o primeiro caractere, ele fica antes do separador e os caracteres seguintes são inseridos na posição errada. A sequência `5026` termina com os dígitos interpretados como `0256`, exibidos como `2,56`.

`MenuPriceInput` já contabiliza os zeros que a formatação introduz, preservando o cursor no fim durante a digitação. Seu comportamento deve ser espelhado no componente do Caixa.

## Task 1: Ajustar a contagem de cursor do valor de pagamento

**Files:**
- Modify: `features/panel/payments/lib/currency.ts`
- Modify: `features/panel/payments/components/payment-amount-input.tsx`

- [x] Exportar `PAYMENT_AMOUNT_INPUT_DIGIT_LIMIT = 16` no utilitário de moeda e usá-lo dentro de `maskPaymentAmountInput`, mantendo o limite atual.
- [x] Em `PaymentAmountInput.handleChange`, seguir a lógica de `MenuPriceInput`: calcular `rawDigitCount`, `nextDigitCount`, `addedLeadingZeros` e `targetDigitCount`; usar o alvo ajustado ao restaurar a seleção.
- [x] Fazer revisão estática para confirmar que `maxLength` continua cobrindo o valor formatado e que os demais estados e cálculos do diálogo permanecem intocados.
- [ ] Se a página local já estiver disponível, conferir manualmente digitação sequencial, edição no meio, backspace, colagem e limpeza do campo. O resultado esperado de `5026` é `50,26`, interpretado como 5026 centavos.

## Revisão

- Valores acima do limite de 16 dígitos continuam sendo truncados pela máscara.
- Nenhuma regra de validação ou persistência de pagamentos muda.
- Fazer somente revisão estática e inspeção visual manual se o ambiente local permitir; os comandos proibidos não fazem parte da validação.
