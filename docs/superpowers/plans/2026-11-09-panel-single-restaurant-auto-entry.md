# Acesso automático ao restaurante único — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ao abrir `/painel/restaurantes`, acessar automaticamente o restaurante quando houver exatamente um disponível para o usuário autenticado.

**Architecture:** O componente cliente existente detecta a lista unitária e chama uma vez a Server Action de seleção já existente. Ela revalida membership, persiste o cookie HttpOnly e fornece o destino calculado pelo status; listas vazias e múltiplas conservam o fluxo atual.

**Tech Stack:** Next.js 16.4.2 App Router, React 19, TypeScript, Server Actions.

**Spec:** `docs/superpowers/specs/2026-11-09-panel-single-restaurant-auto-entry-design.md`

## Global Constraints

- Considerar apenas os restaurantes retornados por `getPanelRestaurantsForCurrentUser()`.
- Preservar revalidação da membership e persistência do cookie em `selectPanelRestaurantAction`.
- Não alterar login, consulta, banco, cookie ou destinos por status.
- Não adicionar nem executar testes, lint, typecheck ou build; não executar `git`.
- Limitar mudanças de produto a `features/panel/workspace/components/panel-restaurant-picker.tsx`.

## Review Focus

- Lista vazia continua apresentando o estado e orientação de convite existentes.
- Um restaurante `active`, `draft` ou `suspended` abre o destino definido pelo status e etapa de onboarding.
- Mais de um restaurante continua exigindo escolha explícita.
- Falha retornada ou rejeitada pela Server Action encerra o estado pendente, mostra erro e permite nova tentativa manual.
- Remontagem/reexecução de efeitos em desenvolvimento não dispara seleção automática repetida.

---

### Task 1: Entrada automática quando a lista contém um restaurante

**Files:**
- Modify: `features/panel/workspace/components/panel-restaurant-picker.tsx`

**Interfaces:**
- Consumes: `selectPanelRestaurantAction(id)`, que valida o restaurante contra a membership ativa, grava o cookie e retorna `{ ok, destination }`.
- Produces: comportamento de entrada automática para lista unitária; os fluxos de lista vazia, múltipla e recuperação de erro permanecem no mesmo componente.

- [x] **Step 1: Tornar a seleção recuperável** — capturar rejeição da Server Action em `choose`, limpar `pendingId` e mostrar a mensagem de erro existente, sem mudar o resultado de sucesso.
- [x] **Step 2: Disparar seleção automática uma vez** — adicionar efeito de montagem protegido por `useRef`; quando houver exatamente um restaurante, chamar `choose` para seu ID. Não chamar a ação com zero ou mais de um restaurante.
- [x] **Step 3: Remover a seleção manual durante o fluxo automático** — enquanto a lista for unitária e ainda não houver falha, exibir estado breve de abertura em vez do cabeçalho e botão de escolha. Em caso de falha, exibir o cartão existente para permitir nova tentativa.
- [x] **Step 4: Revisar os casos em Review Focus por inspeção estática** — confirmar que a ação continua sendo a única responsável por validar membership, gravar cookie e definir destino; conferir estado vazio, lista múltipla, status e recuperação. Não executar comandos automatizados conforme as restrições do projeto.
