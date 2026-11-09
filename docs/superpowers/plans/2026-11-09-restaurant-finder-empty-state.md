# Empty state da busca de restaurantes — Plano de implementação

> **Para agentes implementadores:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` e implemente a tarefa neste checkout. O projeto proíbe testes automatizados e os comandos `git`, `typecheck`, `build` e `lint`; não adicionar nem executar nenhum deles.

**Objetivo:** Dar contexto e uma orientação útil para buscas sem correspondência, com uma composição animada compacta que preserve o título da home em janelas baixas.

**Arquitetura:** Atualizar o estado `ComboboxEmpty` dentro de `RestaurantFinder`; manter mensagens específicas para consulta sem resultado e lista sem restaurantes ativos. Usar uma folha CSS local para a entrada pontual dos ícones, sem adicionar dependências ou mudar a Combobox compartilhada.

**Stack:** Next.js 16 App Router, React, Base UI Combobox, `react-icons/lu`, Tailwind CSS 4 e CSS Modules.

**Spec:** `docs/superpowers/specs/2026-11-09-restaurant-finder-empty-state-design.md`

## Restrições globais

- Não alterar busca, endpoint, paginação, resultados, erro, loading ou navegação.
- Não introduzir botões dentro da região `role=status`; usar o botão Limpar já presente no campo.
- Não usar novas dependências, cores fixas ou animação contínua.
- Respeitar `prefers-reduced-motion` e manter os ícones decorativos fora da árvore acessível.
- Não adicionar nem executar testes, `git`, `typecheck`, `build` ou `lint`.

## Review Focus

- Uma busca curta sem correspondência deve incluir o termo e continuar cabendo em uma linha de título.
- Consulta em branco com zero restaurantes deve ter mensagem distinta e não sugerir publicação de cardápio.
- A região de status não deve anunciar simultaneamente a mensagem e a contagem zero.
- O ícone e os detalhes decorativos devem ficar estáticos quando movimento reduzido estiver ativo.
- O painel deve permanecer compacto e desobstruir o título no viewport baixo mostrado na captura.

---

### Tarefa 1: Empty state compacto, contextual e animado

**Arquivos:**
- Modificar: `features/public-profile/components/restaurant-finder.tsx`
- Criar: `features/public-profile/components/restaurant-finder-empty-state.module.css`

**Interface produzida:** O estado Base UI mantém `role=status`; consulta sem resultado mostra título com termo e orientação; lista inicial vazia mostra título próprio. Ícones `LuSearchX`, `LuUtensils` e `LuMapPin` são visuais e decorativos. A composição ocupa aproximadamente 56–64 px dentro do painel.

- [x] Substituir a frase simples por uma composição horizontal alinhada à esquerda, com ícone principal e dois detalhes discretos; manter as duas variantes de conteúdo definidas na spec.
- [x] Manter `ComboboxEmpty` montado durante loading, erro e resultado, atualizar apenas seus filhos e usar `sr-only` enquanto não deve ser visualizado.
- [x] Usar o botão Limpar já existente no campo; ajustar `liveMessage` para não anunciar uma contagem zero em paralelo à região de status do empty state.
- [x] Implementar em CSS local uma entrada breve de opacidade/escala e sequência curta dos ícones; desativar o movimento via `prefers-reduced-motion` sem ocultar o estado final.
- [x] Reduzir a altura e padding do empty state para que o popover caiba abaixo do campo na captura; alterar posicionamento local somente se a composição compacta ainda cobrir o título.
- [x] Fazer revisão estática dos dois estados, animação, reduced motion, semântica de anúncio e limites de layout. Não executar os comandos proibidos nem iniciar servidor.

## Self-review do plano

- Toda a mudança pertence a uma tarefa: estado vazio e animação dependem do mesmo ponto de renderização e da mesma geometria do popover.
- Nenhuma interface pública, API ou esquema de dados muda.
- A folha CSS fica restrita a `RestaurantFinder`; não altera animações ou estilos globais.
- A verificação é estática por instrução do projeto; testes e comandos proibidos não fazem parte da entrega.
