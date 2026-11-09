# Navegação mobile do Admin — especificação

## Intenção

Dar às telas autenticadas do Admin uma navegação mobile fixa, elegante e rápida de usar, inspirada no dock do Tavvi original e construída com os componentes, tokens, rotas e ações já existentes no app atual.

## Objetivos

- Substituir a navegação em `Sheet` da sidebar por um dock inferior em telas menores que 768 px.
- Manter a sidebar recolhível atual em telas a partir de 768 px.
- Fixar Convites no botão central de início; abrir as áreas Convites e Restaurantes pelo controle à direita.
- Disponibilizar Aparência e Sair pelo controle de conta à esquerda, reaproveitando as opções de tema e a ação de logout atuais.
- Polir entrada, abertura do menu, feedback de toque e navegação com movimento curto, coerente e interrompível.
- Respeitar movimento reduzido, foco por teclado, leitores de tela, safe area e conteúdo rolável.

## Escopo

O dock aparece somente no shell autenticado do Admin, hoje usado por Convites e Restaurantes. Login, cadastro, `/painel`, página pública e demais superfícies não mudam.

## Fluxo e composição

- **Esquerda — Conta:** botão com ícone de conta e rótulo curto. Abre um menu ancorado acima do dock, com Aparência (Sistema, Claro, Escuro) e Sair. No dock, as três opções de tema ficam visíveis no próprio menu para evitar um submenu que ultrapasse a área útil; a sidebar desktop mantém o submenu atual. O tema continua usando `next-themes`; Sair continua submetendo `logoutAdminAction`.
- **Centro — Início:** botão elevado com ícone de casa que leva a Convites. Seu `href` vem de `getAdminHomePath(publicBasePath)` para respeitar o host Admin e a rota prefixada de Preview. Convites é marcado como atual somente quando `activeItem` é `invites`.
- **Direita — Navegação:** abre um painel inferior com os destinos Convites e Restaurantes, cada um com ícone, rótulo e estado atual. Selecionar uma área fecha o painel e navega com `next/link`.
- Só um painel pode ficar aberto por vez. Escape e toque fora fecham o painel de navegação; a implementação usa o `Sheet` Base UI do projeto para manter gerenciamento de foco e semântica de diálogo.

## Direção visual e movimento

- Três posições em barra flutuante com margens laterais, superfície translúcida, desfoque contido, borda sutil e sombra em camadas. O botão central fica ligeiramente elevado e usa a cor semântica primária quando Convites está ativo.
- Usar os tokens Tailwind atuais (`background`, `popover`, `border`, `primary`, `muted-foreground`) e não importar os nomes de classe nem as variáveis `tv-*` do Tavvi original.
- Na entrada do shell, o dock sobe poucos pixels e ganha opacidade com curva de saída curta (até 240 ms, sem ressalto forte). Pressionar um controle usa escala discreta. O painel sobe do limite inferior em até 220 ms; seus destinos entram com pequena cascata de 35–45 ms. Feedback de link pendente é sutil e não segura a navegação.
- Para `prefers-reduced-motion`, remover deslocamento, escala e cascata; manter no máximo um fade breve. Não animar propriedades que alterem layout.
- Os controles laterais têm alvos de toque de pelo menos 44 × 44 px, rótulos visíveis curtos e nomes acessíveis. O botão central anuncia “Início — Convites”.

## Responsividade e conteúdo

- O dock usa o mesmo corte visual da sidebar atual: aparece até 767 px e some a partir de 768 px.
- Esconder nesses tamanhos pequenos os botões `SidebarTrigger` dos cabeçalhos de Convites e Restaurantes; mantê-los no desktop para recolher a sidebar.
- Desativar o atalho Ctrl/Cmd+B para abrir a sidebar no mobile, sem alterar o atalho desktop.
- O bloqueio é local ao `SidebarProvider` usado no Admin; outros consumidores mantêm seu padrão atual.
- Reservar espaço inferior no conteúdo do shell para o dock não cobrir paginação nem ações. Somar a altura da barra, sua distância da borda e `env(safe-area-inset-bottom)`.
- O painel de navegação fica limitado à altura útil da tela, rola quando necessário e respeita safe area inferior. Não bloquear scroll do documento quando fechado.

## Integração

- Extrair o menu de conta atual para um componente compartilhado com variantes para sidebar desktop e botão do dock.
- Criar um componente de dock do Admin que receba `invitesHref`, `restaurantsHref` e `activeItem` e use os ícones `react-icons/lu` já instalados.
- Integrar o dock em `AdminAppShell`; manter o gate de autorização nos Server Components das rotas e não mover a shell para o layout de autenticação.
- Usar `<Link>` e a navegação cliente do App Router. A página de destino mantém a entrada Motion que já existe; o dock fecha imediatamente ao selecionar uma rota.
- Não adicionar dependências, novas rotas, novos fluxos de conta nem persistência de navegação.

## Fora de escopo

- Alterar a navegação desktop, tema global, autenticação, autorização ou redirecionamentos existentes.
- Alterar as páginas de dados além de esconder o acionador da sidebar em mobile.
- Estender o dock ao `/painel`, ao login/cadastro ou ao site público.
- Criar ou executar testes, build, lint, typecheck ou comandos Git.

## Critérios de aceite

1. Em largura mobile, não há acionador nem drawer de navegação lateral; o dock fixo tem Conta à esquerda, Início/Convites ao centro e Navegação à direita.
2. Conta oferece Sistema, Claro, Escuro e Sair; Sair preserva a Server Action e o destino de login atual.
3. O painel de navegação mostra Convites e Restaurantes, indica a rota atual e fecha antes/depois da navegação sem ficar preso aberto.
4. O link central resolve Convites corretamente tanto no hostname Admin quanto no Admin prefixado de Preview.
5. Em largura desktop, sidebar e acionadores de recolhimento permanecem como hoje, e o dock não aparece.
6. A composição funciona em tema claro/escuro, telas com safe area, viewport baixo e `prefers-reduced-motion`.
7. A barra não cobre o fim do conteúdo nem os controles de paginação.

## Restrições do projeto

- Não executar `git`, `typecheck`, `build`, `lint` ou `test`.
- Não criar nem executar testes.
- Consultar a documentação Next 16 instalada antes de editar componentes client ou rotas.
