# Toggle de tema — especificação

## Intenção

Disponibilizar uma ação clara para alternar entre os temas claro e escuro nas telas independentes da Tavvi. Hoje o tema global já existe, mas quase todas essas telas dependem da preferência do sistema, da configuração feita em outra área ou do atalho `Ctrl+Alt+T`.

## Objetivos

- Oferecer o mesmo botão compacto e acessível nas telas sem controle manual.
- Reaproveitar o `ThemeProvider` e os tokens de tema existentes.
- Colocar o botão em posições próprias de cada layout para que não cubra conteúdo nem ações.
- Manter a opção Sistema na área Admin e preservar o tema escolhido durante navegação entre rotas.
- Usar microanimação curta no ícone sem animar globalmente todos os componentes da tela.

## Fora de escopo

- Alterar cores, presets ou densidade do cardápio do restaurante.
- Alterar o comportamento padrão do tema Sistema, a persistência de `next-themes`, o atalho global ou o menu de aparência Admin.
- Criar um botão flutuante global, redesenhar os shells existentes ou adicionar dependências.
- Criar ou executar testes, build, lint, typecheck ou comandos Git.

## Estado atual

- `components/theme-provider.tsx` configura `next-themes` com `attribute="class"`, `defaultTheme="system"`, `enableSystem` e `disableTransitionOnChange`.
- As cores semânticas claro/escuro já estão definidas em `app/globals.css`; vários componentes também alternam wordmarks por tema.
- O shell autenticado do Admin oferece Claro, Escuro e Sistema no menu de Perfil → Preferências → Aparência.
- O campo `theme` do onboarding salva a identidade visual do cardápio do restaurante e não deve ser ligado ao tema global da aplicação.

## Superfícies cobertas

Adicionar o botão nas seguintes superfícies:

- `/`: mensagem de cardápio na mesa, no canto superior direito.
- 404: dentro do cabeçalho, junto ao indicador de navegação.
- `/painel/entrar`, `/painel/criar-conta`, `/admin/entrar` e `/admin/criar-conta`: no `AdminAuthShell`; manter o controle visível tanto no cabeçalho móvel quanto na composição desktop.
- `/painel/identidade` e `/painel/contato`: no cabeçalho do `OnboardingWizard`, junto ao indicador de salvamento.
- `/painel/convite` e seu estado `loading`: no canto superior direito, mantendo o mesmo alinhamento entre o conteúdo e o skeleton.
- `/painel/restaurantes`: junto ao cabeçalho da escolha de restaurante.
- `/painel/suspenso`: disponível sem deslocar ou cobrir o cartão central.
- `/painel/cardapio`: ao lado do estado do restaurante no cabeçalho.

Não criar controle em `/painel`, que apenas redireciona, nem nos handlers de rota, que não exibem interface. A área Admin autenticada e seu skeleton já herdam o menu de aparência existente e não precisam de outro botão.

## Comportamento e interação

- Criar `components/theme-toggle.tsx` como componente client reutilizável, usando `useTheme()` de `next-themes`, `Button` do projeto, ícones `react-icons/lu` e `motion/react`, já instalados.
- Alternar diretamente entre `light` e `dark` com base em `resolvedTheme`. Antes da hidratação, renderizar estado inicial determinístico e manter a geometria do controle estável; atualizar ícone e rótulo quando o tema resolvido estiver disponível.
- Dar um nome acessível que indique a ação, como “Mudar para tema escuro” ou “Mudar para tema claro”; incluir `type="button"`, feedback de foco visível e alvo de toque de pelo menos 44 × 44 px.
- Animar somente a troca do ícone, com movimento e duração sutis. Respeitar `prefers-reduced-motion`; não alterar o tamanho ou a posição do botão durante a troca.
- Usar tokens de cor existentes, mantendo contraste e foco legíveis nos dois temas. O tema continua global e deve sobreviver a navegação entre as telas cobertas.
- Preservar `disableTransitionOnChange` no provider para evitar transições globais inesperadas; o movimento intencional fica restrito ao ícone.

## Critérios de aceitação

- Todas as superfícies listadas, inclusive o skeleton do convite, oferecem uma ação manual visível para mudar o tema.
- O botão alterna claro/escuro sem recarregar a rota e a preferência aplicada permanece ao navegar entre telas.
- O controle não se sobrepõe ao conteúdo em layouts móvel e desktop e não muda de tamanho durante a hidratação ou a animação.
- Leitores de tela recebem o nome da ação; teclado alcança o botão e mostra foco visível.
- Movimento reduzido elimina ou reduz a animação do ícone.
- O menu Admin continua podendo selecionar Sistema, Claro e Escuro.
- As cores configuradas no onboarding do restaurante permanecem independentes do tema Tavvi.

## Restrições do projeto

- Não executar `git`, `typecheck`, `build`, `lint` ou `test`.
- Não criar testes.
- Consultar a documentação Next 16 instalada localmente antes de editar componentes client ou de rota.
