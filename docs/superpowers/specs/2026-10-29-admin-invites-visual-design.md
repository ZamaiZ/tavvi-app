# Admin — Convites e shell autenticado

## Intenção

Entregar uma área visual de administração centrada em Convites, coerente com a qualidade das páginas de entrar e criar conta. A tela autenticada deve ter hierarquia enxuta, interações visíveis e movimento consistente, sem ligar nesta etapa o gerenciamento de convites ao backend.

## Objetivos

- Preservar os títulos `Entrar · Tavvi — Gestão`, `Criar conta · Tavvi — Gestão` e `Convites · Tavvi — Gestão`, mantendo os metadados públicos da raiz.
- Depois da autorização de Admin no servidor, mostrar Convites dentro do shell de administração com o Sidebar do shadcn já disponível.
- Manter login e cadastro fora desse shell: sem sidebar, navegação ou controles de administração nessas telas.
- Exibir navegação para Convites e Restaurantes; Convites é o destino ativo, e Restaurantes aparece desabilitado até existir uma tela própria.
- Usar o brandmark quando o sidebar estiver recolhido e o lockup horizontal quando estiver expandido, com os assets corretos para os temas claro e escuro.
- No drawer mobile aberto, usar o lockup horizontal independentemente do estado de recolhimento salvo para desktop.
- Permitir abrir/recolher o sidebar pelo controle visível e pelo atalho `Ctrl+B` (também aceitar `Cmd+B`, como o componente já oferece).
- Colocar no menu do perfil as escolhas Claro, Escuro e Sistema e a ação de sair já existente.
- Corrigir o estado persistente do card Pendentes: apenas o card correspondente ao filtro atual recebe destaque; o estado inicial `Todos` não seleciona um card.
- Abrir o Sheet de detalhes ao clicar em qualquer área da linha da tabela, preservando menu de contexto e menu de ações; oferecer ativação por teclado.
- Reduzir a densidade vertical e as escalas do título, eyebrow, cards e números para deixar a tabela visível mais cedo no viewport, considerando o espaço ocupado pelo sidebar.
- Usar como escala base do polimento: título `text-2xl sm:text-3xl`, números `text-2xl`, eyebrow próximo de 9px, cards com `p-3 sm:p-4` e distância vertical entre blocos de 24–28px.
- Remover do produto os textos e badges sobre prévia, demonstração, próxima etapa e dados ilustrativos.
- Preservar as entradas sequenciais e transições do Motion em entrar, criar conta, Convites e nos painéis de convite, respeitando movimento reduzido.

## Escopo visual de Convites

- Cabeçalho com controle do sidebar, ícone, eyebrow curto, título Convites, descrição e botão Novo convite.
- Quatro cartões de resumo: Pendentes, Resgatados, Vencidos e Revogados. A seleção é exclusiva e compartilhada com as Tabs. As contagens derivam dos registros apresentados nesta interface.
- Bloco da lista com título e descrição curta, busca por e-mail, Tabs Todos/Pendentes/Resgatados/Vencidos/Revogados e tabela de destinatário, situação, criado em, válido até e ações.
- Tabela com overflow horizontal contido em seu próprio painel, estados vazios úteis e uma linha inteira acionável para abrir detalhes.
- Sheet de detalhes e Sheet existente para criar convite, com campos rotulados, validação local, confirmação/link local e feedback de cópia. Remover qualquer texto que descreva a interface como demonstração.
- Usar toda a largura disponível em viewports estreitos e limitar os Sheets a 32rem em telas maiores.
- Restaurantes no sidebar não navega para uma rota inexistente.

## Shell autenticado

- Montar `SidebarProvider`, `Sidebar` e `SidebarInset` somente depois que `app/admin/page.tsx` confirmar a autorização. O layout do segmento Admin continua compartilhado com autenticação e, por isso, não deve montar o sidebar.
- `SidebarInset` é o único elemento semântico `<main>` da área autenticada. A página de Convites usa contêineres de seção/div com Motion, sem criar um `<main>` aninhado.
- O topo do sidebar contém os assets existentes em `public/brand`: `tavvi-brandmark-light.png`, `tavvi-brandmark-dark.png`, `tavvi-lockup-horizontal-light.png` e `tavvi-lockup-horizontal-dark.png`.
- O rodapé do sidebar contém um gatilho de perfil com menu de tema e formulário de logout que aponta para `logoutAdminAction`.
- A ação de sair e toda a validação de autorização no servidor permanecem intactas.

## Conteúdo e dados

- Os convites continuam em dados locais e a criação continua sem Supabase, persistência, envio de e-mail ou rotação de token. O fluxo local existente só sustenta a apresentação do formulário, do estado de link e do feedback de cópia.
- Não exibir aviso de demonstração ou texto de implementação futura. Os registros e a criação permanecem locais nesta etapa.
- Derivar os indicadores e as contagens das Tabs dos registros exibidos para manter os números consistentes com a tabela.
- Não alterar o schema, RLS, Server Actions de convite ou fluxos de autenticação.

## Movimento e acessibilidade

- Manter Motion via `motion/react` nos fluxos de autenticação e na interface de Convites, com entrada sequencial breve, feedback leve de interação e respeito a `prefers-reduced-motion`.
- Não remover nem simplificar a animação existente em login, cadastro, cabeçalho, cards, tabela, Sheets ou feedbacks.
- O botão de card expõe `aria-pressed`; Tabs mantêm a navegação acessível por teclado.
- A linha acionável responde a clique, Enter e Espaço, sem que os controles de ação abram o detalhe acidentalmente.
- Manter foco visível, labels associados, status acompanhados de texto e ícones decorativos com `aria-hidden`.
- Evitar animação de layout ou escala excessiva; preferir transições curtas de opacity/transform.

## Fora de escopo

- Listagem real do servidor, paginação remota, criação/revogação persistidas, auditoria, integração Supabase, envio de e-mail, mudança de schema/RLS e tela de Restaurantes.
- Sidebar nas telas Entrar/Criar conta.
- Alterações em `app/globals.css` ou nos componentes gerados de `components/ui`.
- Testes automatizados e execução de `git`, `build`, `lint` ou `typecheck`, conforme instruções do projeto.

## Critérios de aceite

1. Entrar, criar conta e Convites mantêm os títulos de metadados com `· Tavvi — Gestão`; a raiz pública não muda.
2. Só a página autenticada usa o sidebar e ela preserva o gate de autorização no servidor.
3. O sidebar expande/recolhe, responde a Ctrl+B/Cmd+B, usa brandmark recolhido, lockup expandido, tema correto e inclui Convites, Restaurantes desabilitado, tema e sair.
4. No estado inicial `Todos`, nenhum card de situação aparece selecionado; selecionar outro card desloca o destaque para o novo filtro.
5. Clicar ou ativar com Enter/Espaço uma linha abre o Sheet de detalhes; menu contextual e menu de ações continuam operáveis.
6. O conteúdo ocupa menos altura antes da tabela e continua responsivo sem overflow horizontal na página.
7. Não há textos visíveis de prévia, demonstração, etapa futura ou registros ilustrativos.
8. A experiência de Motion existente continua presente e respeita movimento reduzido.
