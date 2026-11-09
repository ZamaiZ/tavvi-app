# Navegação do Painel — especificação

## Intenção

Dar ao Painel do restaurante a mesma qualidade de navegação do Admin, usando a identidade do restaurante e mantendo a página atual de Cardápio intacta. A solução segue os componentes, tokens, rotas e ações já existentes no app atual, com o shell limitado ao restaurante ativo.

## Objetivos

- Criar sidebar recolhível para desktop e dock fixo inferior para mobile, sem drawer lateral acessível no mobile.
- Exibir logo e nome do restaurante no topo da sidebar; usar iniciais como fallback quando não houver imagem.
- Oferecer troca de restaurante quando a conta tiver mais de um, sem alterar a validação e o fluxo de seleção existentes.
- Fixar Cardápio no centro do dock e apresentar Cardápio como destino no painel de navegação à direita.
- Colocar Aparência e Sair no menu de conta; no mobile, também oferecer Trocar restaurante quando aplicável.
- Adicionar entrada e transições discretas, estados ativos e feedback de navegação, respeitando movimento reduzido e teclado.

## Escopo e rotas

O shell aparece somente em `/cardapio` quando a sessão, o restaurante ativo e o status já passaram pelas verificações existentes. Login/cadastro, escolha inicial de restaurante, onboarding e estado suspenso permanecem fora do shell.

O login continua decidindo o destino como hoje: abre Cardápio quando há um restaurante ativo válido ou somente um restaurante disponível; abre a seleção quando há mais de um sem seleção válida. Ao trocar de restaurante, usar `selectPanelRestaurantAction` e `getPanelEntryPath`, preservando o destino correspondente ao status de cada restaurante.

Os links usam `getPanelPublicBasePath`: `/cardapio` e `/restaurantes` em hostname dedicado ao Painel, ou as mesmas rotas prefixadas por `/painel` no host compartilhado.

## Navegação e interação

- **Sidebar desktop:** topo com a marca do restaurante e somente o nome ao lado. Se houver mais de um restaurante, esse bloco abre um seletor acessível com a opção atual marcada; com um só, fica como identidade do shell. A lista pode usar iniciais e nome/status, sem depender de imagens privadas de outros restaurantes. A navegação contém apenas Cardápio. Conta fica no rodapé. O cabeçalho existente da página oferece um `SidebarTrigger` visível só no desktop para recolher/expandir a sidebar. Compartilhar com o Admin a largura recolhida, os tamanhos e o espaçamento dos controles desktop.
- **Dock mobile:** três posições: Conta à esquerda, Cardápio ao centro e Navegar à direita. O centro volta para a rota Cardápio do Painel. Navegar abre um `Sheet` inferior com o destino Cardápio e estado atual. Conta contém tema, saída e, quando houver mais de um restaurante, um link para a página de seleção existente.
- Só um menu do dock fica aberto por vez. Selecionar um destino fecha o painel; Escape e clique/toque fora fecham overlays; devolver foco ao acionador quando fizer sentido.
- A troca de restaurante usa a Server Action existente, que valida membership, salva o restaurante ativo e calcula o destino. O componente mostra estado pendente e erro sem expor detalhes internos.
- Sair usa `signOutPanelAction`, que encerra a sessão e limpa o cookie do restaurante ativo.
- Aparência oferece Sistema, Claro e Escuro via `next-themes`.

## Identidade do restaurante

- O shell recebe os dados mínimos do restaurante ativo: id, nome, slug e presença de logo.
- Para a logo ativa, usar a rota pública existente `/{slug}/media/logo` e o componente `BrandImage`, com fallback de iniciais. Não tratar `logoPath` como URL nem usar o preview restrito a rascunhos.
- Em hostname dedicado do Painel, manter as rotas públicas de mídia `/{slug}/media/{logo|cover}` fora do rewrite do host, para que o handler público existente continue servindo as marcas.
- O seletor de outros restaurantes usa monograma, nome e status. Não introduzir leitura adicional de mídia privada para rascunhos ou restaurantes suspensos.
- O nome do restaurante permanece disponível como texto acessível mesmo quando a sidebar está recolhida; o botão de troca informa seu propósito e estado.

## Direção visual, responsividade e movimento

- Seguir o padrão de `AdminAppShell` e `AdminMobileDock`: mesmos tokens semânticos, superfície translúcida contida, borda e sombra sutis, cantos generosos e botão central levemente elevado. Não importar CSS/variáveis `tv-*` do Tavvi original.
- Usar o corte de 768 px: sidebar visível a partir desse tamanho; dock visível abaixo dele. A geometria desktop da sidebar e dos controles segue os padrões já usados pelo Admin; o dock mobile mantém seus alvos de toque de pelo menos 44 × 44 px.
- Desativar a abertura mobile da sidebar, inclusive pelo atalho Ctrl/Cmd+B. Não exibir `SidebarTrigger` no mobile.
- Reservar espaço inferior no conteúdo para o dock e `env(safe-area-inset-bottom)`; o painel de navegação também respeita safe area e rola em viewports baixos.
- Entrada do dock e dos elementos da sidebar em sequência curta, com deslocamentos pequenos e sem ressalto exagerado. O painel inferior entra com uma subida curta e seus destinos aparecem em cascata discreta. Feedback de rota pendente não bloqueia a navegação.
- Com `prefers-reduced-motion`, eliminar deslocamento, escala e cascata; no máximo manter fade curto. Neutralizar também as transições CSS de largura/posição da sidebar. Não animar propriedades que alterem layout.
- Controles do dock mobile têm alvos de pelo menos 44 × 44 px. Controles desktop usam as dimensões do Admin; todos mantêm rótulos acessíveis, foco visível e estados ativo/pendente.

## Integração

- Criar componentes próprios do Painel para shell, dock, conta e seletor; reutilizar Sidebar, Sheet, DropdownMenu, Motion, ícones e tema já instalados. Não reutilizar diretamente os componentes do Admin que importam o logout e rótulos do Admin.
- Integrar a shell depois dos guards existentes em `app/painel/cardapio/page.tsx`, aproveitando o restaurante já carregado e buscando a lista para o seletor somente nessa rota. Se essa consulta secundária falhar ou não incluir o restaurante ativo, manter o Cardápio acessível com a identidade atual e sem opções de troca. O template inclui o acionador de sidebar apenas a partir de 768 px.
- Retirar do template o botão de tema do cabeçalho, pois tema passa a pertencer ao menu de conta. Preservar todo o conteúdo visual e a lógica de Cardápio; trocar apenas o wrapper raiz de `<main>` para `<div>`, pois `SidebarInset` já fornece o landmark principal.
- Alinhar o frame desktop de Cardápio aos containers e gutters do Admin (`max-w-[1440px]` / `max-w-[1240px]`) e usar o mesmo breadcrumb e acionador de sidebar. Preservar o card atual e os espaçamentos mobile já aprovados.
- Não adicionar dependências, endpoints, persistência ou fluxo de autenticação novos.

## Fora de escopo

- Alterar a página, dados ou lógica de Cardápio.
- Alterar o destino de login, o onboarding, a seleção inicial, as permissões, as memberships ou a regra de logout.
- Exibir a shell em `/restaurantes`, `/suspenso`, login/cadastro ou onboarding.
- Adicionar outras áreas ao menu além de Cardápio.
- Criar ou executar testes, build, lint, typecheck ou comandos Git.

## Critérios de aceite

1. Desktop mostra sidebar recolhível com logo/nome do restaurante, Cardápio ativo, acionador e dimensões iguais às do Admin, troca disponível somente para contas com múltiplos restaurantes e menu de conta.
2. Mobile mostra dock Conta / Cardápio / Navegar; não há acionador nem atalho que abra a sidebar.
3. Navegar mostra Cardápio como destino atual; Conta permite Sistema, Claro, Escuro, Sair e Trocar restaurante quando a conta tiver mais de um.
4. A troca passa pela ação existente, atualiza o restaurante ativo, reinicia a tentativa de logo para a identidade nova e leva para a rota coerente com o status escolhido.
5. A logo ativa usa a rota pública de mídia existente e cai para iniciais quando ausente ou indisponível.
6. A página atual mantém seu conteúdo visual; o controle de tema sai do cabeçalho e passa para a conta, e o template não cria um landmark `<main>` aninhado à `SidebarInset`.
7. Guardas e redirecionamentos existentes continuam cobrindo login, seleção inicial, rascunho e suspenso.
8. Claro/escuro, safe area, viewport baixo, teclado, foco e movimento reduzido são tratados; o dock não cobre o fim do conteúdo e overlays mobile fecham ao cruzar para desktop.
9. Uma falha na consulta opcional da lista de restaurantes não derruba a página atual; nesse caso, a troca fica oculta até a lista estar disponível.

## Restrições do projeto

- Não executar `git`, `typecheck`, `build`, `lint` ou `test`.
- Não criar nem executar testes.
- Consultar a documentação Next 16 instalada antes de editar componentes client ou rotas.
