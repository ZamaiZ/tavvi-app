# Navegação nas bordas do cardápio padrão — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Encaminhar gestos que chegam ao limite de mídia ou de cards para o item adjacente no cardápio público padrão e voltar ao welcome ao retroceder antes do primeiro item.

**Architecture:** Preservar os trilhos atuais por categoria e mídia. `PublicMenu` cria a ordem global dos itens e fornece uma função direcional comum aos cards, mídias e retorno ao welcome; a apresentação imersiva não muda.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS Modules, `motion/react`.

**Spec:** `docs/superpowers/specs/2026-11-13-public-menu-standard-edge-navigation-design.md`

## Global Constraints

- Aplicar somente à apresentação normalizada como `standard`; não alterar `immersive`.
- Manter categorias, cards, mídia, ordem, conteúdo e apresentação atuais.
- Incluir itens indisponíveis na navegação, na ordem pública existente.
- Respeitar `prefers-reduced-motion` para transições programáticas.
- Não adicionar nem executar testes, typecheck, build, lint ou Git.

## Review Focus

- Imagem dentro de card: a borda da mídia muda item sem disparar também o gesto do card.
- Borda de categoria: o alvo correto é o item da categoria vizinha e o observer atualiza a categoria ativa.
- Item sem mídia: fallback continua detectando navegação de card.
- Primeiro item: voltar retorna ao welcome e não deixa o snap em posição intermediária.
- Controles interativos: setas, teclado e vídeo não geram navegação duplicada.

---

### Task 1: Navegação global de itens

**Files:**
- Modify: `features/public-profile/components/public-menu.tsx`

**Interfaces:**
- `PublicMenu` deriva a lista achatada apenas para navegação, sem alterar a árvore visual das categorias.
- Cada `ProductRail` e `ItemMedia` recebe o identificador do item atual e um callback direcional.

- [ ] Criar `menuItems` na ordem categoria/item e uma função que, dado `itemId` e direção `-1 | 1`, faça scroll até o card adjacente; chamar o retorno ao welcome somente se a direção for `-1` antes do primeiro item; não fazer loop no fim.
- [ ] Tornar as bordas de mídia direcionais: movimento interno troca a imagem; movimento além do início/fim encaminha ao item global adjacente. Aplicar também aos controles e teclas de mídia, habilitando o controle de borda apenas quando houver destino.
- [ ] Ligar o limite do trilho de cards ao mesmo callback global sem alterar o comportamento de swipe entre cards da categoria; ignorar gestos iniciados em imagens, vídeo, botões e demais controles.
- [ ] Tratar fallback de mídia vazia e mídia única como superfícies navegáveis para o item adjacente; manter o trilho com várias mídias prioritário até chegar à borda.
- [ ] Manter texto acessível coerente com a navegação entre imagens, itens e categorias.

**Review manual:** conferir itens com zero, uma e várias mídias; mudança entre categorias; primeiro/último item; gesto no card fora da mídia; setas e teclado.

---

### Task 2: Retorno ao welcome

**Files:**
- Modify: `features/public-profile/components/restaurant-public-profile.tsx`
- Modify: `features/public-profile/components/public-menu.tsx`

**Interfaces:**
- Passar a `PublicMenu` um callback `onReturnToWelcome` que movimenta o contêiner `publicExperience` para a tela `restaurant-welcome`.

- [ ] Adicionar uma ref ao `publicExperience` e conectar o callback de retorno ao comportamento direcional no limite anterior ao primeiro item.
- [ ] Aplicar movimento suave quando permitido e movimento imediato com redução de movimento; manter o snap na primeira tela.
- [ ] Inspecionar a integração para garantir que links do menu, navegação por categoria e a apresentação imersiva mantêm o comportamento atual.

**Review manual:** partir do primeiro item pela imagem e pelo card, voltar ao welcome e reabrir pelo link “Ver cardápio”.

---

## Verificação final

- Reler os dois arquivos alterados e revisar todos os critérios da spec.
- Não executar testes, typecheck, build, lint ou Git conforme `AGENTS.md`.
- Registrar que validação em navegador/dispositivo não foi executada, salvo se o usuário liberar explicitamente um método permitido.
