# Admin mobile record cards — design

## Intenção

Tornar as listas de Convites e Restaurantes confortáveis no celular: filtros sem scrollbar visível, registros apresentados em cards objetivos, abertura dos detalhes ao tocar e ações contextuais acessíveis. A experiência deve seguir a linguagem shadcn, os ícones Lucide já usados pelo produto e as animações existentes.

## Objetivos

- Ocultar a barra visual das tabs de filtro em Convites e Restaurantes sem retirar a rolagem horizontal por toque.
- Exibir convites em cards abaixo do breakpoint `md`, preservando a tabela em telas `md` ou maiores.
- Refinar os cards mobile já existentes em Restaurantes, mantendo a tabela em telas `md` ou maiores.
- Abrir o painel de detalhes ao tocar no conteúdo do card.
- Manter as ações de Convites no menu contextual e no menu de ações acessível por botão.
- Disponibilizar menu contextual nos cards de Restaurantes sem mover mutações para a lista.
- Fazer o skeleton inicial refletir cards no mobile e tabela no desktop.
- Preservar estados de erro, vazio global, busca sem resultados, paginação, filtros, contagens e sincronização com a URL.
- Manter entradas e transições discretas, com suporte a `prefers-reduced-motion`, foco visível e navegação por teclado.

## Fora de escopo

- Alterações em consultas, Server Actions, schemas, banco, autorização, paginação remota ou dados dos DTOs.
- Alterações na aparência ou no comportamento das tabelas em desktop.
- Alterações nos painéis de detalhes, criação de convite, edição de slug, suspensão ou restauração.
- Novas ações de produto, dependências, estilos globais ou mudanças nos componentes compartilhados de `components/ui`.
- Testes automatizados ou execução de comandos proibidos pelo `AGENTS.md`.

## Restrições e comportamento

- Os toolbars atuais usam um contêiner `overflow-x-auto` com tabs `w-max`; a implementação deve manter esse contêiner rolável e ocultar a barra nativa com estilos Tailwind escopados (`scrollbar-width: none` e `::-webkit-scrollbar`).
- O breakpoint de apresentação permanece `md`: tabela em `md` e acima; cards abaixo de `md`.
- Os cards usam uma coluna em telas estreitas e podem usar duas colunas a partir de `sm`, se a hierarquia e os controles continuarem legíveis.
- Convites mostram destinatário (`getInviteRecipient`), situação, data de criação e validade. Convites sem e-mail continuam identificados como “Qualquer e-mail”.
- Restaurantes mostram nome/iniciais, situação, endereço (`slug`) e data de criação em hierarquia secundária.
- O card abre o painel de detalhes. Um controle separado abre as ações; nenhum botão interativo pode ficar aninhado dentro de outro botão.
- O menu contextual de Convites mantém “Abrir detalhes” e “Gerar novo convite”. O menu contextual de Restaurantes oferece “Abrir detalhes”; editar endereço e suspender/restaurar continuam dentro do painel existente.
- Menus de toque devem ter um gatilho visível de ações. A interação com o gatilho não pode propagar e abrir o card por engano.
- Os filtros permanecem tabs acessíveis e controlados pelo estado/URL atual; a solução não deve cortar conteúdo nem impedir o gesto horizontal.
- Busca, contagens, paginação e alteração de página continuam usando os fluxos atuais.
- Skeletons mantêm a estrutura de cabeçalho, cartões de resumo e painel; dentro do painel simulam cards no mobile e linhas de tabela no desktop.
- Usar `MotionConfig reducedMotion="user"` e `useReducedMotion` conforme o padrão existente. Evitar animações de layout, escalas fortes ou mudanças de altura durante a troca de página/filtro.

## Estados e acessibilidade

- Preservar os estados atuais de carregamento, erro recuperável, lista global vazia e busca/filtro sem resultados.
- Expor carregamento com `aria-busy`, manter os totais em região `aria-live` e garantir foco visível nos cards e gatilhos de ações.
- O card deve ser ativável por teclado e ter nome acessível ligado ao destinatário/nome do restaurante e à situação.
- Ícones decorativos usam `aria-hidden`; o status mantém texto além da cor.
- A paginação e os controles dos menus permanecem operáveis por toque e teclado.

## Decisões de implementação

- Reutilizar os modelos, badges, formatadores, actions, componentes `ContextMenu`/`DropdownMenu`, tokens e padrões de Motion já presentes.
- Manter a apresentação responsiva dentro das features administrativas. Não alterar `components/ui/table.tsx`, `components/ui/tabs.tsx`, `components/ui/context-menu.tsx`, CSS global ou comportamento de outras rotas.
- Extrair a apresentação dos cards para componentes locais focados se isso evitar concentrar renderização desktop, menus e conteúdo mobile nos componentes de tabela já extensos.

## Critérios de aceite

1. As tabs de ambas as páginas não exibem scrollbar e continuam deslizando horizontalmente no toque.
2. Convites apresenta cards abaixo de `md` e tabela em `md` ou acima; Restaurantes mantém tabela/card nos mesmos breakpoints.
3. Os cards apresentam as informações definidas e abrem os respectivos detalhes ao toque, Enter ou Espaço.
4. Ações contextuais de Convites permanecem disponíveis; Restaurantes oferece acesso contextual aos detalhes sem alterar o fluxo das mutações.
5. Abrir menu ou selecionar uma ação não abre acidentalmente o detalhe do card.
6. Skeletons correspondem ao formato responsivo final; erro, vazio, busca sem resultado e paginação continuam funcionais.
7. Movimento reduzido, foco visível e status textual permanecem respeitados.
8. Nenhuma consulta, DTO, regra de autorização ou mutation é alterada.

## Base existente

- Convites: `features/admin/invites/components/invites-data-table.tsx` e `invites-table-toolbar.tsx`.
- Restaurantes: `features/admin/restaurants/components/restaurants-data-table.tsx` e `restaurants-table-toolbar.tsx`.
- Skeletons: `admin-invites-page-skeleton.tsx` e `admin-restaurants-page-skeleton.tsx`.
- Detalhes e regras dos dados: modelos e painéis de detalhes existentes em cada feature.
- Referências visuais anteriores: `2026-10-29-admin-invites-visual-design.md` e `2026-11-05-admin-restaurants-design.md`; esta spec substitui apenas a decisão de apresentação mobile das listas e tabs.
