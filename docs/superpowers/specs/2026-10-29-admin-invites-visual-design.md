# Admin — página visual de Convites

## Objetivo

Substituir o placeholder protegido da área Admin por uma página de Convites com hierarquia visual clara, pronta para receber a lógica de negócio numa etapa posterior. Alinhar o movimento das páginas de entrar, criar conta e Convites, com animação de entrada sequencial e transições consistentes. Depois de entrar ou concluir o cadastro do Admin, o destino atual deve exibir essa página.

## Contexto existente

- app/admin/page.tsx já valida a sessão e o papel de Admin no servidor, mas hoje mostra apenas um estado de preparação. Essa verificação e os cookies da superfície Admin permanecem intactos.
- getAdminHomePath já resolve a raiz no host Admin e /admin no ambiente com prefixo. A página de Convites ocupará esse destino padrão sem introduzir outra rota.
- A raiz pública define o título Tavvi — Cardápio digital. A área /admin precisa de seu próprio template de metadados.
- O preset local fornece Table, Tabs, ContextMenu, Sheet, Card, InputGroup, Badge, Empty e outros componentes shadcn. @tanstack/react-table está na versão 9.3.1 e usa useTable.
- A spec e o plano anteriores da autenticação já definem Motion 14 para a superfície Admin. O pacote 14.7.1 está no ambiente local, mas precisa estar declarado diretamente no package.json para uso sustentável.
- O legado define os estados de convite como pendente, resgatado, vencido e revogado; permite e-mail opcional, prazo de 1 a 30 dias e prazo inicial de 7 dias. O CSS tv-* do legado não deve ser transplantado.

## Escopo visual

### Título e destino

- Usar o template %s · Tavvi — Gestão dentro do segmento Admin.
- Definir os títulos de página Entrar, Criar conta e Convites, resultando em Entrar · Tavvi — Gestão, Criar conta · Tavvi — Gestão e Convites · Tavvi — Gestão.
- Preservar o título e a página públicos da raiz.
- Manter a navegação do Admin no destino atual. Esta entrega não cria sidebar.

### Página de Convites

- Manter o cabeçalho superior e a ação de sair já existentes; atualizar a identificação do território para Tavvi — Gestão.
- Exibir um cabeçalho de conteúdo com ícone decorativo, título Convites, descrição curta e uma única ação primária Novo convite.
- Abaixo do cabeçalho, apresentar quatro cartões de resumo: Pendentes, Resgatados, Vencidos e Revogados. Pendentes recebem ênfase visual moderada; os demais usam superfícies neutras. Os cartões filtram a listagem pela situação correspondente.
- Usar os tokens e a fonte Outfit existentes, espaçamento responsivo, texto legível e componentes do preset. Não adicionar CSS global nem CSS próprio para a página.
- Manter uma hierarquia espaçosa: cabeçalho, resumo e lista ficam em blocos distintos, sem empilhar labels e controles de forma densa.

### Toolbar, tabs e tabela

- Criar um DataTableToolbar dentro da feature de Convites; o app novo ainda não tem esse componente pronto.
- A toolbar contém busca por e-mail e o componente shadcn Tabs, com Todos, Pendentes, Resgatados, Vencidos e Revogados. Todos é a seleção inicial. Cada tab apresenta sua contagem.
- Usar a tabela semântica shadcn e TanStack Table v9 para cabeçalhos, linhas e células. Colunas: destinatário, situação, criado em e válido até; a última coluna contém ações de linha.
- Permitir quebra/empilhamento da toolbar em telas estreitas e manter o eventual overflow da tabela dentro de seu contêiner, sem overflow horizontal da página.
- Usar estados explícitos para lista vazia e busca/filtro sem resultados.
- Em clique com o botão direito numa linha, abrir ContextMenu com Abrir e Gerar novo convite/link; Abrir mostra o detalhe em um Sheet. O contexto não depende de hover.

### Criação de convite

- O botão Novo convite abre o Sheet lateral já disponível no preset.
- O formulário mostra e-mail opcional e validade entre 1 e 30 dias, começando em 7. Inclui labels, texto auxiliar, erros próximos ao campo e CTAs claros.
- A interface inclui um estado de sucesso para visualizar o link e a ação de copiar, conforme o fluxo legado. O link produzido nesta etapa é demonstrativo e local; nenhum convite real é criado nem persistido.
- A opção de gerar um novo convite a partir de uma linha abre o mesmo formulário, preenchendo o e-mail quando disponível.

## Movimento nas telas de autenticação

- Aplicar Motion ao shell compartilhado, ao título e descrição, aos campos e às ações da página Entrar e da página Criar conta.
- Fazer a marca/área visual entrar primeiro; em seguida o título e a descrição; depois os campos e a ação principal. Usar intervalos curtos para a pessoa já poder interagir durante a sequência.
- Manter a validação, as Server Actions, os estados de sucesso/erro e os redirecionamentos sem alteração funcional.
- Adicionar transições leves de interação aos botões, links e estados de feedback, sem movimentar o layout durante digitação.

## Dados e interações desta etapa

- Usar registros e contagens demonstrativos, com endereços @exemplo.com e sem dados pessoais reais.
- Busca, tabs, cartões de resumo, menu contextual, abertura/fechamento do Sheet e estados do formulário funcionam apenas em memória para demonstrar a UI.
- Não implementar leitura/gravação no Supabase, Server Actions de convite, rotação real de token, auditoria, paginação remota, RLS ou mudanças de schema.
- Não mudar o fluxo de autenticação nem enfraquecer a verificação de Admin existente.

## Movimento e acessibilidade

- Usar Motion 14 via motion/react na autenticação e em Convites. Configurar reduced motion do usuário e variantes de movimento reduzido.
- Fazer a entrada do conteúdo em sequência curta: nas telas de autenticação, marca, título/descrição, campos e ações; em Convites, cabeçalho, resumo, toolbar e tabela. Usar deslocamento e opacity discretos com intervalos pequenos.
- Dar feedback leve a hover, foco, clique/press, abertura de tabs, menu, detalhe e Sheet, sem deslocar o layout nem bloquear a ação.
- Respeitar prefers-reduced-motion; com movimento reduzido, mostrar o estado final sem animação de entrada.
- Usar ícones da família Lucide já instalada; ícones decorativos têm aria-hidden, botões somente com ícone têm nome acessível e Tabs permanecem operáveis por teclado.
- Preservar foco visível, labels associados aos campos, estados de status com texto além da cor e contraste dos tokens existentes.

## Fora de escopo

- Sidebar, tela de Restaurantes, detalhe roteável, lógica de convites no servidor, integração Supabase, migrations, e-mail, produção do link, envio, rotação persistida e revogação real.
- Alterações em app/globals.css, componentes gerados de components/ui ou identidade visual global. A única dependência acrescentada é Motion, previamente definida na spec de autenticação.
- Testes automatizados e os comandos git, build, lint e typecheck.

## Critérios de aceite visual

1. Os títulos das páginas Admin usam o nome da página, separador · e a marca Tavvi — Gestão; a raiz pública continua com seu metadado atual.
2. A entrada padrão de Admin mostra Convites e preserva a validação protegida existente.
3. A tela apresenta ícone e descrição no cabeçalho, ação de novo convite, quatro resumos, busca, tabs e tabela em ordem visual clara.
4. Busca, tabs e cartões filtram o conjunto demonstrativo; o menu contextual abre detalhes ou prepara um novo formulário.
5. O Sheet permite visualizar o formulário e o estado demonstrativo de link criado, sem executar operação real.
6. O layout permanece compreensível em desktop e mobile; foco, labels e movimento reduzido são tratados.
7. Entrar, criar conta e Convites apresentam entrada sequencial e transições de interação usando Motion; com movimento reduzido, o conteúdo aparece imediatamente.
