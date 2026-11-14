# Tavvi v2 — base de transposição

**Data do levantamento:** 2026-10-28  
**Estado:** descoberta e desenho inicial; infraestrutura e páginas de autenticação inicial do Admin implementadas; migration aplicada no Supabase local, com validação end-to-end de autenticação ainda pendente.
**Destino da nova aplicação:** `C:\Users\Eduardo Zamai\Documents\tavvi-app`  
**Arquivo de base:** movido para a raiz do projeto de destino `C:\Users\Eduardo Zamai\Documents\tavvi-app` para registrar a transposição.

## 1. Objetivo e escopo inicial

Construir uma nova aplicação para as superfícies Admin da plataforma e Painel de gestão do restaurante, iniciando pelo Admin, pelo fluxo mínimo de entrada/setup do Painel e pelo domínio do cardápio:

- Login de administradores da plataforma.
- O cadastro inicial do Admin da plataforma acontece pela aplicação enquanto não existir uma associação de Admin no projeto Supabase; após o primeiro cadastro, a página informa que ele já foi criado e não permite outro. Se a conta Auth associada for removida, o cadastro reabre.
- Criar, consultar, editar/renovar e revogar convites de entrada.
- Consultar restaurantes e administrar seus estados.
- Login e acesso à conta de gestão do restaurante.
- Resgate de convite, criação da conta e do restaurante, e configuração inicial de identidade e contato.
- Gestão do cardápio no Painel e acesso público pelo slug do restaurante ou pelo identificador opaco de mesa.
- Gestão de membros e convites de acesso por restaurante, além da leitura de feedbacks públicos no Painel.
- Gestão de identificadores de mesa e preparação de tags NFC com link estável para o cardápio.
- Gestão da fila de chamados e registro de pedidos associados à mesa/comanda.
- Operação de comandas e caixa, com pagamentos/correções, gorjeta opcional e análise financeira por período.

A nova aplicação deve preservar as regras de negócio e segurança do produto, sem importar a identidade visual antiga ou seus arquivos CSS. Este parágrafo registra o escopo original de descoberta; pedidos atuais do usuário e planos aprovados podem autorizar novas telas e ações.

## 2. Restrições e decisões já informadas

- Continuar com Next.js; o boilerplate atual usa Next 16.4.2, React 19 e App Router.
- Usar os componentes do preset shadcn e Tailwind. Não criar folhas de estilo próprias nem regras CSS específicas por página/componente.
- Manter apenas o CSS base exigido pelo preset: imports, tokens/variáveis e estilos globais essenciais. Layout e identidade visual devem ser compostos com componentes shadcn e utilitários Tailwind.
- Web Push está fora do escopo inicial. Para a nova versão, não manter Express apenas para Push.
- Supabase atual, em Oregon, é de desenvolvimento e não é produção.
- Para o app novo, usar Supabase local no desenvolvimento e o projeto remoto novo/vazio em São Paulo para demo/staging; produção terá um projeto Supabase separado. O schema novo será criado do zero. O Oregon permanece como ambiente de desenvolvimento do legado, não como base a migrar.
- Vercel é a plataforma pretendida. O repositório privado GitHub ZamaiZ/tavvi-app já existe e o checkout atual usa a branch preview, que recebe o ambiente Preview/demo. O alias estável observado para essa branch é `tavvi-app-git-preview-zamai-ez.vercel.app`; URLs que identificam deploys individuais são snapshots e não devem ser reutilizadas como link estável do Preview. A branch master não será criada agora; será criada somente quando Production for provisionada. O projeto Supabase de produção, variáveis Production e domínios de produção ficam fora desta etapa. Quando houver domínio próprio, Admin/Painel podem voltar a subdomínios separados no mesmo projeto Vercel. O plano adequado para operação comercial será considerado antes do lançamento.
- A confirmação de e-mail do Supabase permanece desligada neste fluxo.
- Uma conta pode participar de mais de um restaurante; a gestão de pessoas por restaurante entra no Painel.
- Até a implementação futura de IAM por função, todos os membros autenticados do restaurante têm as mesmas ações; a autorização continua exigindo associação ao restaurante e respeitando o estado/invariantes dos registros.
- Os cargos da equipe permanecem como informação organizacional, editável pelos membros, mas não restringem ações nem páginas nesta fase.
- O Painel terá um restaurante ativo por navegador, mantido em cookie e compartilhado entre abas; essa experiência foi aceita.
- A chave `APP_SERVER_KEY` não é requisito das telas de Admin. O fluxo novo de Feedbacks anônimos a exige server-side e configura no Supabase apenas o hash; os fluxos legados de avaliação/chamado mantêm suas próprias regras até migração explícita.
- No workspace tavvi-app, as instruções atuais do usuário proíbem Git, typecheck, build, lint e testes. Fazer revisão estática sem executar esses comandos; não estender essa regra automaticamente a outros workspaces.

## 3. O que existe hoje em `tavvi`

### 3.1 Login e bootstrap do administrador

- A tela de login do território Admin autentica e-mail/senha pelo Supabase Auth.
- Não há um fluxo de cadastro público para obter o papel de administrador da plataforma.
- A tabela `platform_admins` não tem políticas de inserção/alteração pela aplicação. A promoção é deliberadamente manual.
- `supabase/seed/bootstrap-admin.sql` concede o papel a um usuário que **já existe** em `auth.users`, localizado pelo e-mail. Portanto, o SQL não cria a conta Auth: primeiro é necessário criar o usuário por um processo administrativo confiável (por exemplo, o painel Auth do Supabase); depois executar o bootstrap SQL.
- Autorização usa `is_platform_admin()`, com RLS no banco. A proteção precisa permanecer tanto nas páginas quanto em cada Server Action; esconder a interface ou proteger apenas por Proxy não basta.
- Sessões de Admin e Painel usam territórios/cookies distintos no app atual. Preservar essa separação se os dois territórios passarem a compartilhar a nova aplicação.

### 3.2 Convites

O nome “convite da plataforma” no legado é importante: **ele convida um cliente a começar a usar Tavvi e criar um restaurante; não cria outro administrador interno da Tavvi.**

- E-mail é opcional. Quando informado, fica associado ao convite.
- Prazo configurável de 1 a 30 dias; padrão de 7 dias.
- O token tem alta entropia; somente seu hash é salvo no banco. O valor em claro aparece no link devolvido uma única vez.
- A aplicação cria o convite, lista e filtra por situação (pendente, resgatado, vencido, revogado), permite revogar convites pendentes e gerar outro link/convite por rotação.
- O link é produzido para o território Painel. O resgate conduz a pessoa a entrar ou criar conta e, para um convite da plataforma, criar um restaurante e tornar-se administrador dele.
- Não foi encontrado envio de e-mail pelo sistema atual: a interface entrega um link para copiar/compartilhar.
- Não há edição direta do e-mail ou prazo de um convite existente. A renovação atual gira o link; revogação desativa o convite. Se “editar” for necessário na nova versão, definir se a edição também revoga o token antigo e emite outro.
- O resgate vive no Painel. No escopo atual, Admin e fluxo mínimo do Painel entram na nova aplicação; convites emitidos pelo Admin novo devem poder ser resgatados no Painel novo antes do corte.

### 3.3 Restaurantes

- A lista de plataforma lê `id`, `slug`, nome, estado, segmento, criação e exclusão lógica.
- Há detalhe de restaurante e leitura de membros.
- Estados atuais do banco: `draft`, `active` e `suspended`.
- O administrador da plataforma pode alterar estado; o banco também restringe essa alteração e a ação registra auditoria.
- O Admin atual também altera slug e oferece exclusão lógica (`deleted_at`). Não há exclusão física pelo fluxo descrito. Esses recursos existem no legado, mas não foram incluídos explicitamente no escopo inicial novo.
- O fluxo de plataforma atual não cria o restaurante diretamente no Admin: o cliente nasce ao resgatar um convite da plataforma.
- A consulta atual carrega a lista sem paginação no banco e filtra/ordena principalmente na interface. Para uma plataforma com muitos restaurantes, o novo Admin deve prever paginação e filtros no servidor.

### 3.4 Padrões úteis do sistema existente

O legado já separa rotas, componentes de domínio, Server Actions, DAL, schemas Zod e tipos DTO. Essa separação vale preservar conceitualmente; os componentes visuais e folhas CSS do legado não devem ser transplantados.

- Server Actions são pontos de entrada não confiáveis: autenticar, autorizar e validar novamente os dados recebidos em cada mutação.
- DAL server-only concentra acesso a Supabase e devolve DTOs mínimos, não linhas cruas.
- RLS e funções SQL continuam sendo a segunda barreira de autorização.
- Convites e mudanças de estado de restaurante registram eventos de auditoria.
- Sessão de Admin é distinta da sessão do Painel.

## 4. Estado do boilerplate em `tavvi-app`

- Projeto standalone, um único pacote pnpm, Next 16.4.2 e React 19.
- O preset escolhido gerou os componentes shadcn, Tailwind 4 e configuração do boilerplate. A raiz da aplicação ainda mantém o placeholder “Project ready!”; o fluxo Admin inicial já tem rotas próprias e destino protegido em app/admin.
- package.json inclui @supabase/ssr, @supabase/supabase-js, Zod e Motion. lib/supabase mantém cookies e clientes SSR separados; features/admin/auth implementa login, cadastro inicial, recuperação de claim e navegação segura.
- O boilerplate está usando `app/` na raiz, o alias `@/*` aponta para a raiz e `components.json` aponta o CSS para `app/globals.css`; essa configuração corresponde ao arquivo existente. Não criar uma segunda árvore `src/app`.
- O `globals.css` existente é a base do preset. Não adicionar CSS de identidade ou estilos por tela.
- app/layout.tsx define lang="pt-BR", mantém as fontes/tokens atuais e monta o Toaster existente. Não importar fontes ou CSS do legado.
- A migration versionada supabase/migrations/20261029000000_platform_admin_identity.sql fornece a base de perfil e Admin único. As páginas de login/cadastro foram implementadas e a migration foi confirmada como aplicada no Supabase local. A primeira conta ainda deve ser criada pelo responsável antes de expor o cadastro em Preview; o fluxo de autenticação não foi submetido durante a implementação.

## 5. Arquitetura recomendada para Admin e Painel novos

Começar como **monólito modular Next.js + Supabase**, sem Express para Admin, Painel, onboarding e CRUD síncrono:

- **Next App Router:** layouts, páginas e Server Components para carregar listas/detalhes; Server Actions para login/mutações que pertencem ao Admin.
- **Supabase Auth:** login por senha e sessão server-side; cadastro inicial do Admin da plataforma pela aplicação, uma única associação por projeto Supabase e reabertura do cadastro se a conta Auth for removida.
- **Postgres/Supabase:** criar o schema do app novo do zero no projeto novo e vazio. Usar o banco legado como referência de regras/semântica, não aplicar sua baseline nem copiar dados automaticamente. O projeto novo passa a ser a fonte de verdade do produto novo após o corte.
- **Segurança:** verificar usuário e papel de plataforma em cada página e ação; validar entradas no servidor com Zod; manter RLS, funções de banco e restrições; não colocar `service_role`, `APP_SERVER_KEY` ou segredos no bundle do navegador.
- **Organização:** manter a árvore de rotas em `app/` como o boilerplate está hoje; agrupar domínio em módulos separados, por exemplo `features/admin/auth`, `features/admin/invites`, `features/admin/restaurants`, e concentrar autenticação/DAL em módulos server-only. Server Actions finas delegam à DAL.
- **UI:** compor navegação, tabelas, formulários, diálogos e estados vazios com componentes shadcn; Tailwind para layout/spacing/responsividade; tokens do preset para cor/radius. Sem CSS de feature. Não copiar as classes `tv-*` ou os arquivos CSS do app antigo.
- **Listas:** paginação e busca/filtros no servidor, retornando somente campos usados pela interface. Isso evita carregar todo o histórico de convites/restaurantes para filtrar no cliente.
- **Banco por ambiente:** manter uma única sequência de migrações do app novo e aplicá-la em Supabase local, no projeto remoto de demo/staging em São Paulo e em um projeto Supabase de produção separado. O projeto novo de São Paulo está vazio e será usado para demo/staging; produção não compartilhará esse banco. A baseline `supabase/migrations/0001_web_baseline.sql` pertence ao legado, não é a baseline do app novo e nunca deve ser aplicada sobre projetos com dados.
- **Região:** o Supabase local não tem região remota. Para o projeto novo em São Paulo, configurar as funções Vercel em `gru1`. O Supabase legado em Oregon continua separado e suas funções antigas devem ficar próximas do banco (`pdx1`). Não espalhar funções do app novo por regiões distantes da base primária sem réplica/estratégia de leitura.

### Login e cadastro inicial do Admin

- Spec e plan das páginas: docs/superpowers/specs/2026-10-29-platform-admin-auth-pages-design.md e docs/superpowers/plans/2026-10-29-platform-admin-auth-pages.md.
- Admin terá rotas separadas de entrar e criar-conta. Local usa admin.localhost:3000/entrar e /criar-conta; a raiz do host Admin abre a área Admin e caminhos /admin explícitos são redirecionados às rotas curtas. Preview Vercel usa /admin/entrar e /admin/criar-conta, e a raiz do alias estável da branch redireciona temporariamente a /admin. Produção futura usa admin.<domínio>/entrar e /criar-conta com rewrite host-aware; a raiz de produção fica reservada para sua experiência própria.
- Criar conta mostra formulário somente enquanto admin_registration_open() indicar vaga. O formulário cria nome/email/senha sem confirmação de email e chama claim_platform_admin(); o banco é a autoridade para desempate de concorrência. Após ocupar a vaga, cadastro mostra estado fechado sem identidade do Admin.
- Se signup Auth concluir mas o claim falhar transitoriamente, manter sessão Admin e permitir repetir apenas o claim idempotente; não recriar a identidade. Se outro usuário vencer, encerrar a sessão perdedora e mostrar cadastro fechado.
- Login verifica signInWithPassword e is_platform_admin(); uma conta Auth sem papel Admin recebe mensagem genérica e sessão Admin encerrada. next aceita apenas destino local do território Admin. Fallback: raiz Admin em subdomínio e /admin em Preview.
- Usar createSupabaseServerClient("admin") e tavvi-admin-auth-token. Não misturar cookie do Painel, não guardar tokens/papéis em localStorage e não tratar Proxy ou UI como autorização.
- Compor os componentes de components/ui sem editar seus arquivos; usar InputGroup, ícones/reveal de senha, FieldError, Toast, validação com Zod e mensagens pt-BR. Sem CSS personalizado e sem alterar globals.css/preset.
- Motion deve ser discreto e respeitar movimento reduzido. Reutilizar apenas lockups de marca do legado, sem importar seu CSS.
- O responsável cria a primeira conta em cada ambiente antes de divulgar o endereço; proteção de Preview é operacional e não usa segredo de bootstrap no app.

### Direção de rotas e contexto do Painel

- O fluxo do Painel pertence à nova aplicação: convite, login/cadastro, criação do restaurante e setup inicial. Não deixar o resgate depender do app antigo.
- As rotas de gestão não incluem `/restaurantes/{id}` no caminho. Direção proposta: `/entrar`, `/convite`, `/identidade`, `/contato` e `/cardapio`.
- O restaurante ativo é selecionado por `active_restaurant_id`, em cookie `HttpOnly`, `Secure` em produção, `SameSite=Lax` e `Path=/`, lido apenas pelo servidor. A troca de restaurante valida o vínculo do usuário e atualiza o cookie por Server Action; o mesmo navegador compartilha a seleção entre abas.
- O cookie contém somente o identificador do restaurante, não papel, permissão, status nem dados de perfil. Ele é um seletor de contexto, não uma credencial. Toda leitura e mutação continua usando sessão do usuário e RLS; um ID alterado ou obsoleto deve resultar em acesso negado/seleção de restaurante, nunca em acesso cruzado. Cada mutação também deve comparar o restaurante esperado pela tela com o contexto atual do servidor; se outra aba tiver trocado o cookie, recusar a ação e pedir atualização, sem gravar no restaurante errado.
- Não consultar a lista completa de restaurantes em cada navegação. Consultar uma vez no login/seleção inicial; depois usar o ID selecionado e buscar apenas os dados necessários à tela. Se o cookie estiver ausente ou não corresponder a um restaurante acessível pela conta atual, consultar os vínculos e pedir/definir uma seleção válida.
- O cookie de restaurante ativo é independente dos cookies de sessão do Supabase. Não guardar tokens, papéis ou autorização em `localStorage`.
- Como a conta pode ter vários restaurantes, o cookie compartilhado entre abas significa que a troca em uma aba afeta as próximas requisições das outras. Esse comportamento foi aceito. Se futuramente for necessário manter restaurantes diferentes simultaneamente em abas distintas, revisar para contexto por URL/subdomínio.
- Admin e Painel terão subdomínios próprios na mesma aplicação Next. Manter sessões/cookies isolados por superfície conforme a regra do repositório.

### Fluxo de conta e setup inicial

1. Admin da plataforma cria um convite de entrada para cliente/restaurante.
2. O convidado abre o link e entra ou cria conta com nome, e-mail e senha. Uma conta autenticada também pode aceitar outro convite para criar/associar mais um restaurante. Não há cadastro público e a confirmação de e-mail do Supabase fica desligada.
3. O convite continua vinculado ao e-mail informado, com token aleatório de uso único armazenado apenas como hash e validação transacional no resgate.
4. Com convite válido, a pessoa informa somente o nome do restaurante. O servidor gera o slug sem etapa de consulta enquanto digita; a restrição de unicidade do banco resolve concorrência. Proposta inicial: gerar sufixo quando houver colisão, sem pedir slug no primeiro formulário.
5. O banco cria o restaurante em `draft`, associa o usuário como primeiro membro e consome o convite na mesma transação. `draft` significa que o setup ainda não foi concluído.
6. O restaurante passa a ser o contexto selecionado no cookie e o usuário segue para `/identidade`: logo, capa, formato do cardápio (imersivo ou clássico), tipo de restaurante e tema.
7. Segue para `/contato`: nome e descrição do restaurante, telefone, WhatsApp, Instagram, endereço preenchido por CEP, URL do perfil/localização no Maps e link direto de avaliação do Google, em campos separados.
8. Ao salvar Contato, o status operacional passa de `draft` para `active` e o usuário segue para `/cardapio`. O estado/etapa incompleta deve persistir no banco para o login retomar o setup; não usar `localStorage` como fonte da verdade. A ativação do restaurante não publica o cardápio: essa publicação é uma ação independente.

**Implicação de segurança da confirmação de e-mail desligada:** e-mail informado não prova controle da caixa postal. Para convite com e-mail restrito, o link de alta entropia é a credencial de resgate e a conta precisa usar o mesmo e-mail, comparado após normalização. Se a pessoa já estiver autenticada com outro e-mail, bloquear o resgate sem consumir o convite. Manter token de uso único/hash, prazo curto, não registrar o token em logs, remover o token da URL após o resgate e não carregar recursos de terceiros na página do convite.

### Estratégia de latência para leituras e gravações

- Uma leitura de tela deve carregar dados no servidor em Server Components, selecionar apenas os campos usados e evitar cascatas sequenciais. Uma consulta bem composta é preferível a várias consultas em série; leituras independentes podem ser iniciadas em paralelo.
- Uma submissão deve fazer um Server Action, validação server-side e uma chamada ao Supabase para a gravação. Retornar os dados atualizados na própria resposta quando possível; evitar `SELECT` antes do `UPDATE` apenas para confirmar existência/permissão, `SELECT` depois para reconstruir o resultado, além de refresh/revalidação duplicados.
- Operações multi-tabela críticas (consumir convite + criar restaurante + membership + auditoria) devem ser uma função transacional no Postgres/RPC. RLS continua sendo a autoridade para acesso; integrar a verificação ao comando de leitura/escrita reduz round-trips sem remover autorização.
- Usar `getClaims()` para verificar JWT quando a chave assimétrica permitir validação local; confirmar a configuração de assinatura do Supabase antes de assumir que não haverá chamada de rede. Usar `getUser()` quando for necessária confirmação atualizada pelo Auth. Proxy faz refresh/redirect otimista, não consultas de autorização ou carregamento de dados.
- Deduplicar acessos repetidos dentro de uma renderização/request com `React.cache()`. Não compartilhar cache de dados privados entre usuários. Separar cache público do perfil e do cardápio por restaurante; após gravação bem-sucedida, invalidar o cache correspondente para a próxima leitura refletir a alteração imediatamente. Contexto/token de mesa nunca integra o cache compartilhado.
- Não bloquear gravação com chamadas externas opcionais (por exemplo, enriquecer link do Maps). Persistir primeiro; trabalho externo pode ser separado e informar estado posterior. Consultar CEP serve para preencher formulário, sem impedir edição manual nem salvar.
- Supabase JS usa a Data API HTTPS, que possui pooler integrado para carga serverless; não introduzir Express ou conexão Postgres direta só para ganhar pooling. Se no futuro um workload usar driver Postgres direto em função serverless, seguir pooler transacional e suas limitações.
- Antes de otimizar às cegas, instrumentar tempos separados para verificação de sessão, consulta/mutação, chamada externa e renderização. Acompanhar p50/p95/p99 e plano das queries; identificar o gargalo real.
- A região da função deve ficar junto do banco primário: desenvolvimento atual em Oregon (`pdx1` próximo); para produção com público brasileiro, considerar projeto Supabase em São Paulo e funções Vercel em `gru1`. Não habilitar compute multi-região distante da base sem réplica/estratégia de leitura.

### Estado do escopo visual

- Admin e Painel usam componentes do preset shadcn e Tailwind. Sem CSS personalizado por página/componente; manter apenas o CSS base e os tokens necessários ao preset.
- A interface de gestão do cardápio no Painel segue shadcn + Tailwind, como Admin e demais telas do Painel.
- O cardápio público é uma superfície distinta e poderá aplicar a identidade de cada restaurante (fontes, cores e apresentação). Não importar as folhas CSS do legado; a implementação visual pública permanece uma decisão técnica separada. A proibição de CSS personalizado para Admin/Painel permanece.

### Direção inicial de rotas

Admin e Painel usarão subdomínios próprios na mesma aplicação Next, então cada superfície pode ter rotas curtas começando na raiz do host. O Admin pode usar `/entrar`, `/convites`, `/restaurantes` e `/restaurantes/[id]`, enquanto o Painel usa `/entrar`, `/convite?token=...`, `/identidade`, `/contato` e `/cardapio`. O slug/ID do restaurante não será segmento obrigatório do caminho do Painel: o servidor usa o cookie de restaurante ativo. Preservar cookies/sessões separados por superfície.

## 6. Direção para o domínio Cardápio

Esta seção registra o mapeamento do legado e as regras já acordadas para a nova aplicação. Não inicia a implementação.

### 6.1 O que existe hoje

- O workspace de gestão tem modos básicos de lista/índice/grade, busca por nome e descrição, filtros (todos, sem mídia, indisponíveis e ocultos) e ordenação/reordenação. Busca e filtros são aplicados no cliente depois da leitura dos dados do restaurante.
- Também existem cinco modos de trabalho avançados — `studio`, `board`, `spreadsheet`, `sequence` e `service`. Eles não são necessários no primeiro corte; priorizar os modos básicos, CRUD e publicação, deixando esses cinco para uma etapa posterior.
- O cardápio público tem apresentação imersiva e catálogos clássico em lista/grade. O carregamento público hoje combina perfil/contato/tema e categorias/itens em uma consulta aninhada. Retorna itens publicados visíveis e com mídia; itens indisponíveis continuam visíveis com seu estado. `React.cache()` elimina a duplicação entre layout e página na mesma requisição, mas não é cache entre requisições.
- Preferência de modo de visualização do workspace é salva em `localStorage` com chave por restaurante. É uma preferência de interface, não dado de sessão, autorização ou contexto de segurança.
- Categorias têm nome, descrição, visibilidade e posição. Itens têm categoria, nome, descrição, visibilidade/disponibilidade, preço único ou variações, destaques/restrições em texto, até seis mídias e ordenação. O legado limita variações a 30 por item e tags livres a 10 por item, com até 30 caracteres cada.
- Hoje “destaques e restrições” é uma lista de texto livre, com sugestões como vegetariano, vegano, sem glúten, sem lactose, picante e contém castanhas; não existe modelo estruturado de alergênicos.
- A mídia é preparada no navegador e enviada diretamente ao Supabase Storage com URL de upload assinada; bytes de fotos/vídeos não passam por Server Action. O legado aceita imagem e vídeo curto, aplica limites de tamanho/formato e limita seis mídias por item.
- A criação em massa é uma tela manual, sem importação CSV identificada. Aceita até 50 itens e 20 categorias novas por lote, reutiliza os campos/validações do item individual e persiste o lote por RPC transacional. Uploads são limitados em concorrência; falhas de mídia ou de banco acionam limpeza de arquivos preparados. Os rascunhos locais do lote ainda não têm recuperação após recarga.
- Excluir categoria hoje pode excluir seus itens por `ON DELETE CASCADE`. Isso é risco de perda acidental e não deve ser reproduzido.
- A publicação hoje exige ao menos um item visível e mídia em todos os itens visíveis, mesmo em apresentações clássicas. Publicar também altera `restaurants.status` de `draft` para `active`, misturando estado operacional da plataforma com publicação do cardápio.

### 6.2 Regras e decisões de produto acordadas

- Separar o estado operacional do restaurante (`draft`, `active`, `suspended`, exclusão lógica) do estado do cardápio (`draft`/`published`). `draft` operacional representa setup incompleto; após salvar Identidade e Contato, o restaurante passa a `active`. Suspensão/exclusão bloqueia a página pública; publicação do cardápio não altera nem reativa o estado operacional.
- Depois da primeira publicação, alterações salvas em categoria/item entram no ar imediatamente. O comando “Publicar cardápio” controla se o menu está disponível ao público; não há fluxo de revisão/rascunho de alterações em uma cópia separada.
- Enquanto publicado, o cardápio precisa manter ao menos um item visível. Impedir ocultar/remover o último item visível até despublicar; itens indisponíveis podem continuar visíveis e identificados como indisponíveis.
- Mídia obrigatória para todos os itens publicáveis e encomendáveis, em qualquer modo de apresentação (imersivo ou clássico).
- Preservar no cardápio o padrão atual de fotos e vídeos curtos, com múltiplas mídias por item e os limites de formato/tamanho do legado; feedback aceita até três fotos/vídeos combinados conforme a especificação de 2026-11-13.
- Substituir tags de alergênicos/restrições exclusivamente livres por atributos estruturados apropriados, mantendo destaques livres separados. O vocabulário e a apresentação final dos atributos devem ser definidos no desenho de dados do cardápio.
- Bloquear exclusão de categoria enquanto houver itens nela; a pessoa deve mover ou remover os itens antes.
- Primeiro corte do workspace: modos básicos de lista/índice/grade, busca, filtros, CRUD de categorias/itens, ordenação, publicação e criação em massa. Adiar `studio`, `board`, `spreadsheet`, `sequence` e `service`.
- No cardápio público, categorias funcionam como régua de navegação entre grupos de pratos. Não incluir busca/filtros independentes para clientes no primeiro corte; busca e filtros pertencem à gestão do menu no Painel.
- A página pública por slug pode ser aberta sem cardápio publicado. Para restaurante ativo, mostrar perfil/contato e permitir envio de feedback; na área do menu, mostrar estado “em construção”, sem expor itens em rascunho.
- A URL da slug é a navegação pública normal, sem ação de chamar equipe. O acesso por identificador de mesa conserva o contexto da mesa e, com cardápio publicado, pode oferecer chamada de equipe. Se o menu não estiver publicado, a página de construção não oferece chamada.
- O cardápio público é de consulta neste corte: não há carrinho, pedido direto nem pagamento pelo cliente; o pedido é lançado pela equipe após o chamado ou pela operação do Caixa.
- Contato público mostra telefone, WhatsApp, Instagram, endereço/localização e, se configurado, uma ação externa com o link direto para solicitar avaliação no perfil do Google. Feedback Tavvi continua separado, anônimo, com texto e até três fotos/vídeos; não é uma avaliação Google nem uma nota de estrelas.
- O link de avaliação do Google deve ser salvo separadamente do link do Maps e ser o destino direto para escrever uma avaliação. O restaurante informa o perfil no Maps e o Tavvi gera o link de avaliação; se não conseguir gerá-lo, não conclui o onboarding com esse perfil. Exibir a ação somente com link válido e igualmente para todos os visitantes, sem condicionar à nota/conteúdo do feedback nem oferecer incentivo.
- A regra de chamada deve ser imposta também pelo servidor/banco; esconder o botão no cliente não é autorização. Restaurantes suspensos/removidos e identificadores de mesa inválidos devem falhar sem revelar qual condição ocorreu.
- O feedback público é anônimo e independe da publicação do cardápio, mas exige página de restaurante ativa. Não cria sessão Auth. Preservar limites, validação de texto/mídia, proteção contra spam e rate limits no novo fluxo.

### 6.3 URLs, leitura pública e cache

- Rota da slug: `/{slug}` no host público. Perfil, contato, links e feedback continuam acessíveis quando o restaurante está ativo e o cardápio não foi publicado; o menu retorna apenas o estado vazio/de construção.
- No contato, `mapsUrl` abre localização/direções e `googleReviewUrl` abre o fluxo direto de avaliação do Google; são campos persistidos separadamente. O servidor tenta gerar o link de avaliação a partir do perfil informado. O formato interno empregado pelo resolvedor pode mudar; a falha deve ser informada e impedir a conclusão quando houver Maps.
- A capa exibe “Avaliar no Google” somente se houver `googleReviewUrl` válido. Esse link sai do Tavvi e abre o fluxo Google em nova navegação; não importar nem armazenar avaliações, texto, nota ou estado do Google no Tavvi.
- Link de mesa: manter identificador aleatório e opaco (token de alta entropia), não usar número de mesa nem UUID do restaurante como credencial. A rota resolve o restaurante e preserva o token de mesa como contexto somente daquela navegação. Slug isolada nunca concede permissão para criar chamada.
- No legado, `/t/{token}` resolve e redireciona para `/{slug}?tag={token}`; o botão aparece apenas quando há token válido com mesa numerada. A forma exata da URL da nova aplicação fica para o plano técnico, mas o token não deve ser tratado como dado de analytics nem incluído no HTML/cache compartilhado.
- Separar leitura pública do perfil e do cardápio: consulta de perfil pode servir a página de construção; conteúdo de categorias/itens só é consultado/devolvido se o cardápio estiver publicado. A checagem deve existir no servidor e no banco, não apenas em filtros visuais.
- Cache público deve ser segmentado por restaurante e por domínio de dados (perfil vs. cardápio), sem partilhar sessão ou conteúdo privado. Gravações de identidade/contato invalidam perfil; gravações de categoria/item/mídia/publicação invalidam o cardápio daquele restaurante. A invalidação ocorre depois do commit e antes de considerar a mutação concluída para que a próxima leitura reflita o salvamento imediatamente.
- Token/mesa, estado de chamado e submissão de feedback ficam fora do cache público do perfil/cardápio. Não cachear HTML com token ou botão contextual como resposta pública reutilizável.
- Com acesso por slug e por mesa, o canonical público é sempre a URL limpa da slug. A rota com token não deve ser indexada nem expor detalhes da mesa em log/analytics/referrer.

### 6.4 Recomendações para a implementação

- Manter ações do Painel autenticadas por sessão Supabase, autorização por membership em cada chamada e RLS no banco; nesta fase, papel da equipe não restringe ações. Não passar `restaurant_id` da URL para decidir o contexto; usar o restaurante selecionado em cookie validado no servidor, conforme a direção do Painel acima.
- Para itens/categorias, validar uma vez no servidor e gravar com o mínimo de round-trips. Operações de várias tabelas (item + variações + mídias) e lotes devem ser atômicas no Postgres. Retornar DTO da mutação para atualizar a tela sem recarregar todo o workspace.
- Usar upload assinado para arquivos grandes, com MIME/tamanho/quantidade validados antes da assinatura e ao confirmar o registro; limpar uploads órfãos após falha. O upload nunca deve atravessar o servidor Next se o cliente puder enviar com segurança direto ao Storage.
- Na criação em massa, manter o mesmo schema e regra do fluxo individual. Validar o lote inteiro e mostrar erros por linha antes do commit; gravar em uma transação e limitar concorrência de uploads. O limite inicial de 50 itens do legado pode ser preservado como teto, sujeito a ajuste após medir payload, tempo e experiência.
- Preservar a regra de não publicar um cardápio sem nenhum item visível e exigir mídia em cada item publicável/encomendável, independentemente da apresentação.
- Aplicar a invariável de cardápio não vazio também após publicar: mutações que ocultariam/removeriam o último item visível devem falhar de forma clara até que o cardápio seja despublicado. Disponibilidade é estado separado de visibilidade.
- Criar feedback e chamada de equipe por operações públicas estreitas/RPCs restritas, sem sessão Auth nem Express. Feedbacks anônimos usam `APP_SERVER_KEY` server-only, configurada também no Supabase apenas como hash; chamados seguem as credenciais e RPCs específicas do fluxo de chamados. Validar as operações e impor cotas e rate limits no servidor/banco; nunca expor `service_role` no navegador. Credenciais privilegiadas para assinatura de uploads privados permanecem exclusivamente server-side.
- Não carregar feedback/call status junto ao cache do menu. Atualizações do Painel devem invalidar somente o cache da entidade tocada, sem reconsultar todos os dados após cada gravação.
- Manter chamadas internas em banco e Realtime/atualização da interface apenas quando o Painel estiver aberto, conforme a decisão de não usar Web Push. Não manter Express apenas para esse fluxo. Detalhar na etapa de banco os grants mínimos das RPCs públicas, controles de abuso e autorização de uploads; não expor credencial privilegiada no navegador.

### 6.5 Pontos técnicos ainda para o plano

- Definir o conjunto estruturado de alergênicos e restrições e como representar risco de contaminação cruzada. Não declarar “sem X” automaticamente por ausência do atributo.
- Definir UX de recuperação de rascunho da criação em massa após fechar/recarregar a página; não gravar rascunhos em `localStorage` sem uma decisão explícita de retenção/sensibilidade.
- Limites e controles de abuso para Feedbacks anônimos estão implementados na especificação `docs/superpowers/specs/2026-11-13-feedback-publico-painel-design.md`: identidade derivada de IP sem persistir o IP em claro, rate limits compartilhados e cotas por restaurante. Chamados mantêm seu fluxo e suas credenciais próprios.

## 7. Direção para Identificadores e NFC

Esta seção mapeia a página de identificadores atual e a separação entre registro lógico da mesa e programação física da tag. O painel novo continua usando shadcn + Tailwind; o componente que acessa NFC é cliente por depender da API do navegador. Esta documentação não inicia a implementação.

### 7.1 O que existe hoje

- A página atual lista identificadores por restaurante, com filtros de todos/ativos/precisam de atenção/desativados, resumo de contagens, último acesso e ações de detalhes, copiar link, editar mesa e ativar/desativar.
- Criar identificador exige número inteiro positivo de mesa e gera no servidor um token aleatório de 16 caracteres Base32 sem caracteres ambíguos (80 bits). A restrição do banco permite apenas um identificador ativo para o mesmo número no mesmo restaurante. O link fica pronto para copiar/usar em QR assim que o registro lógico existe.
- A tabela `menu_tags` mantém `id`, `restaurant_id`, `public_token`, `table_number`, `is_active` e `last_seen_at`, além do vínculo NFC. O token fica em texto claro no banco porque é parte de uma URL pública que precisa poder ser reimpressa; não é senha nem prova de autenticação. O token e o restaurante de origem são imutáveis por trigger; número e disponibilidade são alteráveis.
- O link é `/t/{token}`. O servidor resolve o token para o restaurante e redireciona para a URL da slug, preservando o token como contexto de mesa quando há número de mesa. A URL não codifica slug nem ID do restaurante; alterar slug ou realocar a mesa não exige reprogramar QR/NFC.
- Ativar/desativar controla se o link resolve. O conteúdo gravado na tag não muda; a resolução pode voltar a funcionar se o registro for reativado. Trocar o número da mesa altera para qual mesa os chamados são registrados, mantendo o mesmo token/link. Com o vínculo NFC registrado, alterações de número/disponibilidade também ficam no histórico de auditoria.
- A interface de gestão não oferece exclusão física. O DAL legado tem uma ação de delete exclusiva de platform admin, mas chamadas existentes têm FK `ON DELETE RESTRICT`; por isso a operação não é equivalente a desligar um link e não deve ser o caminho normal de substituição de hardware.
- Cadastro físico NFC atual: o navegador lê o serial do chip e o NDEF existente; registra início; grava um único registro NDEF de URL com o link do identificador; lê novamente para conferir serial e URL; grava a confirmação no banco; oferece confirmação explícita para bloqueio físico permanente; após o navegador confirmar o bloqueio, sincroniza o resultado ao banco.
- O serial de 14 caracteres hexadecimais fica único no banco, vinculando uma tag física a um identificador. RPC autenticada valida restaurante/ator, serial, sequência e prazo da operação; triggers impedem mudança direta dos campos do vínculo NFC. Há histórico de eventos de início, falha, conferência, bloqueio e mudança posterior de mesa/disponibilidade.
- O bloqueio físico é uma operação irreversível de `NDEFReader.makeReadOnly()`. Como a chamada ao chip e a gravação no banco não formam uma transação distribuída, o cliente grava recibo de recuperação em `localStorage` antes do comando e pode retomar conferência/sincronização após falha ou fechamento. Esse recibo local não é sessão nem autorização.
- O componente atual é Web NFC: a própria tela orienta o cadastro em Chrome no Android com NFC ativado; precisa de contexto seguro (HTTPS). A capacidade `makeReadOnly()` é detectada separadamente. Se não for suportada, o vínculo pode ficar conferido, mas a proteção permanente permanece pendente. O código também verifica o limite estimado de capacidade para NTAG213 antes de gravar o link.
- O route resolver aplica rate limit legado de 60 resoluções por minuto por IP e atualiza `last_seen_at` em toda leitura válida com `UPDATE ... RETURNING`. Esses dois comportamentos podem criar bloqueio para clientes atrás do mesmo NAT e escrita concorrente na linha de uma mesa muito acessada.
- Há consultas e verificações sequenciais em algumas mutações: criação faz autorização, insert, auditoria e obtenção do alvo de revalidação; atualização e eventos NFC buscam primeiro o restaurante, validam permissão e só então gravam/chamam RPC.

### 7.2 Regras de produto acordadas

- Preservar o padrão NFC atual: depois de gravado e conferido, o conteúdo da tag não pode ser reescrito; pode ser lido por qualquer aparelho compatível com NDEF.
- O token e o vínculo do identificador com seu restaurante ficam imutáveis. O número de mesa e a disponibilidade do identificador podem ser atualizados no Painel. Realocar uma tag para outra mesa do mesmo restaurante não muda a URL nem requer nova gravação física.
- Para trocar a tag física ou corrigir conteúdo depois do bloqueio, criar outro identificador/token e registrar a nova tag; desativar o anterior. Uma tag bloqueada não pode ser reaproveitada para outro identificador.
- Link/QR/NFC é a mesma URL e leva ao mesmo token. A resolução do token escolhe restaurante e mesa; não gravar a slug diretamente no chip, para preservar o link quando a slug mudar.
- Desativar deve cortar a resolução pública e chamadas imediatamente. Não tratar “tag somente leitura” como autorização: a URL pode ser copiada ou reproduzida. Chamadas públicas mantêm validação, deduplicação e rate limits próprios no servidor/banco.
- A página do Painel novo será `/identificadores`, usando o restaurante ativo do cookie server-side, sem `restaurant_id` na URL. Lista, criação, atualização, ativação e NFC passam por ações/handlers do Next e políticas RLS/RPC; não manter Express para isso.
- A lista e os formulários novos usam componentes shadcn e Tailwind, sem importar `identificadores.css` ou classes `tv-*` do legado.

### 7.3 Arquitetura e recomendações

- Gerar tokens com fonte criptograficamente segura no servidor; manter unicidade por constraint. O número de mesa é um campo de roteamento, não um segredo. Acesso à gestão depende de sessão e associação/role validadas no servidor e no banco.
- Derivar `restaurant_id` do restaurante ativo em cookie validado no servidor, não do formulário/segmento de URL. Criar com o número positivo e devolver o DTO com token/link pronto. Constraint única de mesa ativa resolve corridas entre duas sessões.
- Fazer atualização de número/estado como uma escrita autorizada por RLS/RPC com `RETURNING`; auditar alterações NFC/roteamento na mesma transação. Evitar SELECT de propriedade e autorização redundantes antes de cada mutação quando a política/RPC pode impor isso no mesmo comando.
- Manter estados explícitos para tag não cadastrada, conferida, protegida, proteção pendente e estado físico incerto. Só exibir “protegida” depois de confirmar a operação; se o navegador bloquear e a sincronização falhar, permitir retomada pelo recibo local sem regravar a tag.
- O cadastro físico depende de uma ação direta do usuário, permissão NFC, tela visível, aparelho e tag compatíveis. Executar em HTTPS com dispositivo de cadastro suportado (Chrome Android no fluxo Web NFC atual). Não prometer cadastro físico universal via desktop/iPhone; esses dispositivos podem consumir a URL do NDEF pelo leitor do sistema, mas o provisionamento deve ser validado nos aparelhos e tags realmente usados.
- Confirmar o bloqueio permanente somente depois de conferir o mesmo serial e a URL final. Exibir de forma clara que é irreversível, que tag bloqueada exige substituição física para alterar o conteúdo e que realocação de mesa é feita no Painel pelo mapeamento lógico.
- O token é público e reproduzível; NFC somente leitura protege integridade contra regravação do chip, não prova proximidade nem identidade da pessoa. Proteger operações de chamado/pedido por regras específicas, nunca pela suposição de que a URL só pode vir de uma mesa.
- Não gravar `last_seen_at` em todo toque. Atualizar no máximo em intervalos (métrica aproximada) ou separar telemetria de resolução; evitar hot-row writes em mesas movimentadas. Rever o rate limit de leitura por IP para não limitar visitas legítimas atrás de Wi-Fi/NAT compartilhado; aplicar limites mais estritos às mutações que geram efeito (por exemplo, chamados), não à simples abertura de cardápio.
- Quando limites por IP forem mantidos na Vercel, obter o IP de um cabeçalho confiável da plataforma (`x-vercel-forwarded-for`), não de `x-forwarded-for` controlável pelo cliente.
- Para baixa latência, a leitura da página deve ser um lookup indexado do token e redirecionamento; considerar cache de resolução somente com invalidação por identificador para que desativação/realocação reflita prontamente. Não incluir serial NFC, recibos ou histórico em cache público.
- NFC Web exige HTTPS e gesto explícito do usuário; usar o host HTTPS de demo/staging para cadastrar tags físicas, mantendo dados e tokens do ambiente de teste. A base local continua adequada para desenvolvimento de banco e UI sem chip físico.

### 7.4 Direção antiga para feedback (substituída)

O feedback público e o Painel de Feedbacks foram implementados nesta aplicação conforme `docs/superpowers/specs/2026-11-13-feedback-publico-painel-design.md`. As regras abaixo descrevem a proposta anterior e não devem orientar novas alterações; a implementação aceita até três fotos/vídeos e usa APP_SERVER_KEY server-only.

- Preservar a janela de validade da operação NFC e a ordem exata dos eventos que autorizam conferência/bloqueio, ajustando o RPC novo para validar tudo dentro de uma transação e reduzir as chamadas de autorização duplicadas.
- Todo identificador ativo deve estar associado a um número de mesa. A criação exige o número e a edição pode realocá-lo; não manter identificadores ativos “sem mesa”. O token/URL continua imutável e a realocação é feita no mapeamento lógico do Painel.
- Confirmar o lote de tags físicas a ser comprado contra a capacidade NDEF do host público final e o bloqueio permanente suportado. O legado calcula capacidade para NTAG213; evitar mudar domínio/URL depois de imprimir ou bloquear tags.
- Definir granularidade da métrica “último acesso” e o período mínimo entre atualizações.

## 8. Direção para Chamados e integração com pedidos/comandas

Esta seção separa o atendimento da equipe do ciclo financeiro da comanda e registra o comportamento de deduplicação por mesa. Chamados e pedidos podem compartilhar o restaurante/mesa, mas permanecem entidades e responsabilidades diferentes.

### 8.1 O que existe hoje

- A fila tem três estados: `pending` (aguardando), `in_progress` (assumido/em atendimento) e `resolved` (concluído). A página apresenta contadores, busca por mesa, filas com paginação, tempo de espera/atendimento, responsável, transferência e histórico de eventos.
- O banco impede mais de um chamado `pending` ou `in_progress` para o mesmo restaurante e número de mesa. Repetir a solicitação enquanto há um ativo retorna o chamado existente sem criar outro nem notificar de novo. Depois da conclusão, uma nova solicitação pode gerar outro chamado.
- Há ainda limites contra abuso: rate limit por IP para iniciar chamados e cota de novos chamados por token de mesa por hora. O token público é validado no banco com o identificador ativo, número de mesa e restaurante público.
- Assumir é uma transição atômica protegida por lock de linha: a primeira pessoa elegível passa a responsável e o chamado sai da fila pendente. Qualquer membro da equipe pode assumir no fluxo atual. A transferência é hoje restrita a admin; o pedido e a conclusão ficam disponíveis para a pessoa atualmente atribuída. Eventos de claim/transfer/resolve formam o histórico.
- O chamado pode ser concluído sem pedido. Quando assumido, a página oferece uma aba “Mesa e pedido” com o catálogo de itens, variações, quantidades e observações. Cada confirmação idempotente (`request_id`) cria um registro de pedido associado ao chamado e à comanda.
- Um chamado pode ter mais de um pedido confirmado; a tabela de pedidos não limita a um pedido por chamado. Vários chamados sequenciais da mesma visita também podem contribuir com pedidos para a mesma comanda.
- A comanda é uma entidade distinta, ligada ao restaurante e à mesa. O primeiro pedido registrado abre uma comanda `open`, usando as configurações do caixa; pedidos posteriores da mesa reutilizam a comanda ativa. A constraint permite apenas uma comanda em `open`/`settling` por restaurante e mesa. Pedidos feitos diretamente no Caixa também podem entrar nessa conta.
- O Caixa administra recebimentos, correções, gorjeta, liquidação, encerramento e histórico financeiro. Encerrar a comanda fecha a visita; um chamado posterior pode iniciar nova comanda. Uma chamada criada antes de uma comanda ser encerrada não pode registrar pedido nela depois do fechamento.
- A notificação do chamado é gravada na central interna para todos os membros ativos do restaurante; o banco também transmite atualizações Realtime. O painel de Chamados mantém um canal Realtime próprio para a fila. O som é opt-in por navegador e toca quando o Painel está aberto/conectado e o navegador permite áudio. O envio Web Push é feito depois da Server Action atual e será removido.
- O primeiro carregamento do dashboard consulta várias listas, contagens, equipe e detalhes em paralelo; atualizações Realtime tendem a reler o dashboard. A lista histórica usa paginação de 100 itens por estado.

### 8.2 Regras de produto acordadas

- Manter no máximo um chamado ativo por mesa. Enquanto houver chamado aguardando ou em atendimento, novas tentativas da mesa retornam o existente; concluído o atendimento, a mesa pode abrir um chamado novo. Preservar limites contra abuso para novas solicitações.
- A assunção atribui o chamado a uma pessoa e abre o espaço para lançar pedidos, mas não cria uma comanda vazia. A comanda nasce no primeiro pedido confirmado. Chamado pode ser concluído sem pedido.
- Todos os pedidos de uma mesma mesa/visita somam na comanda ativa, sejam lançados a partir de chamados diferentes ou diretamente no Caixa. O Caixa continua sendo responsável por pagamentos e encerramento.
- Os papéis da equipe (por exemplo, admin, caixa, atendente e garçom) não são níveis de autorização nesta fase. Todo membro autenticado do restaurante pode acessar as páginas e executar as funcionalidades do Painel; a associação ao restaurante continua obrigatória. Gestão de equipe permanece em etapa posterior e servirá para estrutura/registro, sem permissões granulares por papel.
- Web Push está fora do produto novo. Notificação interna, atualização Realtime da fila e som em navegador aberto permanecem. O Express não é necessário para Chamados, fila ou pedidos síncronos.

### 8.3 Encaixe na nova arquitetura

- Rota curta `/chamados` no subdomínio Painel, usando o restaurante ativo do cookie server-side; não incluir `/restaurantes/{id}` no caminho.
- Next Server Components carregam o resumo inicial; Server Actions/Route Handlers delegam a operações de banco. RPCs transacionais continuam sendo adequadas para claim concorrente, transferência, conclusão, pedido/comanda e deduplicação pública. Manter RLS, verificação de membership, validação dos dados e restrições únicas no banco.
- A solicitação do cliente continua anônima e vinculada ao token de mesa, sem sessão Auth no domínio público. A operação pública precisa aceitar somente a ação estreita “criar ou devolver o chamado ativo desta mesa”, verificando tag ativa, restaurante ativo, cardápio publicado, cota e idempotência. Nenhuma chave privilegiada fica no navegador. Isso pode ser feito dentro de Next + RPC segura, sem Express.
- A transação de pedido deve validar a atribuição/estado do chamado, preços e variações atuais, gravar pedido/itens, obter ou criar a conta ativa e retornar o resumo atualizado. Repetição após resposta de rede incerta usa `request_id` para não duplicar pedido.
- Chamados ativos e contadores são dados em tempo real, não cacheados como conteúdo público. Receber INSERT/UPDATE pelo Realtime e atualizar a entidade afetada; buscar eventos do chamado selecionado e histórico concluído sob demanda. No reconnect/volta da aba, fazer resync. Evitar reler todas as filas, contagens e equipe a cada evento.
- A notificação interna permanece no banco para a central e o Realtime. Remover fila de entrega Push, subscriptions/VAPID e chamada de entrega após a action. Com Push removido, o som e o aviso imediato dependem do Painel conectado; isso não promete alerta quando a página está fechada.
- A gestão de pedidos originados no chamado deve reutilizar os mesmos comandos de pedido/comanda do Caixa. Não duplicar regras de preço, total, estado de fechamento ou pagamentos dentro do domínio Chamados.
- Admin/Painel desta tela usa componentes shadcn e Tailwind, sem CSS legado.

### 8.4 Decisão de fluxo por pessoa

- A autorização deve ser indiferente ao papel: qualquer membro autenticado pode acessar o Chamado e, conforme o estado, assumir, registrar pedido e concluir. A assunção continua definindo um responsável individual para impedir que pedidos e conclusão concorram sem coordenação.
- A transferência não deve exigir o papel `admin`, pois papéis não têm permissão diferenciada nesta fase; ainda precisa ser uma operação autenticada e gravada no histórico. O destino deve ser um membro do mesmo restaurante.
- Manter somente o responsável atual autorizado a lançar pedidos e concluir aquele chamado até que o transfira. Qualquer membro, sem distinção de cargo, pode assumir um chamado pendente ou receber a transferência; essa regra de atribuição coordena o atendimento e não é IAM por papel.

### 8.5 Pontos técnicos para o plano

- O primeiro painel novo pode funcionar com o administrador/owner como único membro. Notificações e atribuição multiusuário ganham uso real quando o fluxo de convites/membros estiver disponível.
- Definir retenção e paginação do histórico de chamados/eventos; a lista resolvida não deve ser carregada inteira.
- Revisar rate limit por IP para chamadas legítimas em Wi-Fi/NAT compartilhado. Manter deduplicação por mesa e cotas por token/mesa no banco; usar o cabeçalho confiável da Vercel caso a política também dependa de IP.
- Encerramento da comanda define a fronteira da visita. Novos pedidos de uma chamada antiga devem falhar após o fechamento; um novo chamado criado depois pode abrir nova comanda.

## 9. Direção para Financeiro

Esta seção separa análise financeira de operação do caixa físico e registra o desenho proposto após revisar as telas e os dados do legado. Não inicia implementação.

### 9.1 Responsabilidade da página

- Financeiro é painel de análise do restaurante. O resumo deve apresentar, lado a lado e sem misturar conceitos, vendas lançadas no período e valores efetivamente recebidos no período. Estornos devem aparecer identificados, sem serem confundidos com venda negativa.
- A análise é por intervalo de calendário no fuso horário do restaurante, com o dia atual como padrão, e inclui dados de períodos com caixa aberto ou fechado. Ela não deve depender da existência de um caixa aberto.
- A aba legada “Receitas sem caixa” não deve permanecer como conceito principal. Vendas e recebimentos entram no resumo geral pela própria data/hora; o dia de caixa é uma dimensão operacional distinta.
- Configurações do caixa podem ficar em Financeiro, em área secundária própria (por exemplo, `/financeiro/configuracoes`). Não colocar abertura, movimentações, recebimentos ou fechamento do caixa físico dentro do painel analítico.
- Organização acordada: análise e configurações do caixa em Financeiro; comandas, recebimentos, histórico detalhado dos períodos e operação do caixa físico em Caixa. No relatório, atribuir vendas ao horário de registro do pedido, recebimentos ao horário do pagamento e estornos ao período em que forem realizados; apresentar estornos separados e gorjeta aceita como composição do total recebido, sem somá-la duas vezes.

### 9.2 O que existe hoje e por que demora

- A rota de Financeiro carrega `getFinanceDashboard` e `getLegacyFinanceReport` já na renderização inicial. O painel também carrega dia ativo, histórico, contas abertas, contas pendentes, movimentos e fuso horário.
- Para calcular o dia ativo, `loadDayFigures` busca pagamentos, pedidos, itens, gorjetas e formas de pagamento. Pagamentos são filtrados por data na aplicação; pedidos e itens passam por leituras e lotes adicionais, alguns sequenciais.
- Abrir um detalhe histórico repete os cálculos do período e consulta movimentos, pendências e contas. Fechar e reabrir o detalhe não conserva o resultado no cliente.
- Abertura, movimentação e fechamento do caixa retornam o painel financeiro completo. Eventos Realtime também provocam atualização ampla, mesmo quando só uma conta ou uma sessão foi alterada.
- A tela Caixa carrega contas, pendências, configurações, o painel financeiro, catálogo de pedidos e detalhes da conta selecionada. Atualizações Realtime repetem leituras de listas, configurações, painel e detalhe.
- Essas consultas e round-trips são causas arquiteturais plausíveis para a lentidão observada no legado; a revisão foi estática e não mediu tempos em execução.

### 9.3 Direção técnica para a análise

- Criar um modelo de leitura agregado no Postgres para resumo por restaurante e intervalo, sem transferir grandes listas de pedidos/pagamentos para somar na aplicação. Usar limites de data consistentes com o fuso horário do restaurante e índices adequados às consultas.
- Separar o resumo Financeiro do estado operacional necessário ao Caixa. O Caixa deve buscar apenas o status da sessão aberta e os dados necessários à ação atual; não deve carregar o relatório de Financeiro.
- Detalhes históricos permanecem sob demanda e paginados. No cliente, conservar o detalhe consultado durante a sessão e invalidá-lo quando houver alteração relevante, evitando refetch ao recolher/abrir o mesmo período.
- Realtime atualiza apenas entidades afetadas, com ressincronização ao reconectar/retornar à aba. Evitar invalidar o relatório inteiro a cada evento de conta.
- Não compartilhar cache de dados financeiros entre restaurantes ou usuários. A análise deve permanecer autenticada e respeitar RLS/associação ao restaurante; qualquer cache de leitura precisa ser segmentado por contexto e invalidado após gravação.
- A gorjeta aceita integra o total recebido; pode ser mostrada como composição/subindicador sem ser somada novamente ao total.

## 10. Direção para Caixa e integração com Financeiro

Caixa concentra a operação das comandas e do caixa físico. Pedido vindo de chamado e pedido lançado diretamente no Caixa convergem para a mesma comanda, os mesmos totais e as mesmas operações de recebimento.

### 10.1 Comandas e pedidos

- A página lista comandas ativas, em liquidação, pendentes e fechadas recentes; ao selecionar uma, mostra saldo pendente, total e total recebido.
- Pedido sem chamado usa o mesmo catálogo, seleção de variações, quantidades, observações, validação de preço e registro transacional do pedido originado em chamado. Na nova versão, o nome da pessoa/comanda é obrigatório e a mesa é opcional.
- Se for informada uma mesa que já tenha comanda ativa, anexar o pedido àquela comanda. Sem mesa, criar comanda independente com identificador sequencial. A identidade de uma comanda já aberta não deve ser sobrescrita por outro pedido.
- Mídia é obrigatória em todo item publicável/encomendável, inclusive no modo clássico. A gravação valida disponibilidade, categoria/item visíveis, mídia, variação obrigatória e preço vigente no servidor/banco.
- Um pedido pode conter vários itens e uma comanda pode receber vários pedidos. Chamados diferentes e pedidos diretos do Caixa contribuem para a mesma conta ativa da mesa.

### 10.2 Abas da comanda e pagamentos

- **Conta:** consumo, pedidos, subtotal, gorjeta, total e saldo.
- **Recebimentos:** histórico imutável de pagamentos/estornos e registro de pagamentos integrais ou parciais, inclusive combinando meios. Pagamento em dinheiro registra valor aplicado, valor entregue e troco. O sistema registra o pagamento escolhido; não processa a transação na maquininha/provedor.
- **Correções:** cancelar item com motivo; estornar total ou parte de um recebimento, vinculado ao pagamento original e com motivo. Não permitir que cancelamento de item deixe pagamentos líquidos acima do subtotal restante; efetuar o estorno necessário antes do cancelamento. Estorno de conta encerrada reabre a liquidação para recompor o saldo.
- **Finalização:** encerrar o consumo bloqueia novos pedidos. Se houver saldo, a conta passa para liquidação; o pagamento do saldo restante encerra a comanda. Saldo zero, sozinho, não encerra uma conta que ainda pode receber pedidos.
- Recebimentos exigem uma sessão de caixa aberta. O Caixa deve explicar e oferecer abertura da sessão no próprio fluxo, sem encaminhar a pessoa à análise Financeira.
- Operações financeiras e correções mantêm transações atômicas, lock da comanda quando necessário, idempotência por `request_id`, justificativas e trilha de auditoria. Uma falha de rede não deve duplicar pedido, pagamento, estorno ou gorjeta.

### 10.3 Gorjeta: decisão única e opcional por comanda

- Gorjeta não é forma de pagamento nem uma segunda liquidação. Quando aceita, entra no total/saldo da comanda e é paga pelos mesmos meios e regras de pagamento; quando recusada, o valor é zero.
- O cliente pode aceitar ou recusar explicitamente. A recusa é válida, não deve ser inferida por silêncio nem aplicada automaticamente pelo fechamento do caixa. Registrar a decisão, o ator/horário e o valor calculado em auditoria.
- A decisão é única por comanda e ocorre ao encerrar o consumo. Se o fechamento excepcional transportar uma comanda ainda sem decisão, a escolha será oferecida no primeiro recebimento posterior. Se a comanda já tiver decisão, preservá-la no transporte.
- Se a escolha ocorre junto ao primeiro recebimento posterior, gravar decisão e pagamento na mesma transação. Calcular a gorjeta e atualizar o saldo antes de validar o valor da cobrança; se a pessoa recusar e não restar saldo, fechar sem gerar pagamento de valor zero.
- Pagamento parcial anterior ao encerramento pode acontecer sem decidir gorjeta enquanto a comanda continuar aberta a novos pedidos. A decisão de gorjeta bloqueia novas inclusões de consumo.
- Alterar a regra de gorjeta deve atualizar a regra disponível para comandas cujo cliente ainda não decidiu, inclusive saldo transportado ainda sem decisão. Após decisão, preservar o valor e a escolha históricos; comandas fechadas não são recalculadas.
- O estado atual do legado não permite `tip_decision` pendente em uma comanda `pending`: a constraint exige decisão e o fechamento excepcional transforma ausência de decisão em recusa. O novo modelo deve permitir transportar conta sem decisão e resolver esse estado no recebimento posterior.
- Se uma conta sem saldo antes da gorjeta for transportada com decisão ainda pendente, ela precisa permanecer disponível para a escolha posterior: aceitar pode criar saldo a pagar; recusar pode fechá-la sem pagamento. Não encerrá-la antecipadamente apenas porque o saldo pré-gorjeta é zero.

### 10.4 Operação do caixa físico

- Caixa permite abrir sessão com valor total ou contagem de notas/moedas; registrar reforço e sangria com valor e motivo; consultar o dinheiro esperado e fechar por contagem ou valor total.
- Se a diferença entre valor esperado e contado for diferente de zero, exigir justificativa e registrá-la na sessão.
- Fechamento normal é bloqueado enquanto houver comandas em consumo ou liquidação. Fechamento excepcional exige justificativa e confirmação explícita, sem restrição por papel da equipe.
- No fechamento excepcional, transportar o saldo devido para uma comanda pendente que não ocupa a mesa, bloquear novos pedidos nela e permitir recebimento na próxima sessão aberta. Chamados seguem seu próprio ciclo normal; não criar pagamento separado nem resolver um chamado só porque o caixa fechou.
- Histórico e detalhe da sessão são registros operacionais e permanecem imutáveis após o fechamento. Financeiro pode apresentar agregados por período sem duplicar os comandos de operação.

### 10.5 Configurações e acesso

- Configurações em Financeiro incluem regra de gorjeta, ativação/desativação e inclusão de meios personalizados. Meios já usados continuam no histórico com a identificação registrada no recebimento; manter ao menos um meio ativo.
- Nenhum papel da equipe diferencia acesso a páginas ou ações nesta fase, inclusive configuração, correções, estornos, reabertura e fechamento excepcional. Validar autenticação e associação ativa ao restaurante; IAM por função fica para etapa posterior.
- Remover as restrições antigas por `admin`/`cashier` do UI, DAL, ações, RPCs e políticas do banco, sem remover a verificação de membership e as invariantes de estado/concorrência.

### 10.6 Direção de carregamento

- A entrada de Caixa deve carregar lista resumida de comandas, sessão aberta e configurações necessárias; buscar detalhes completos apenas da comanda selecionada. Carregar o catálogo quando o fluxo de pedido for aberto ou reutilizar cache versionado por restaurante.
- Resumos de conta devem vir de agregações no banco, não da leitura de todos os pedidos, itens e pagamentos de todas as comandas ativas. Eventos de auditoria carregam sob demanda.
- Depois de uma mutação, atualizar o DTO da comanda/sessão afetada e invalidar apenas esse recurso. Evitar reler lista, Financeiro, configurações e detalhes completos após cada operação.

## 11. Direção para Feedbacks

Feedback é um canal público e anônimo para comentários de clientes, com leitura no Painel. Não há resposta, reação ou publicação pública dos feedbacks. O conteúdo e as mídias devem permanecer privados e imutáveis depois de publicados; o estado de leitura é separado do conteúdo.

### 11.1 Criação no acesso público

- Exibir a ação na capa/perfil público nos formatos clássico e imersivo, inclusive quando o restaurante está ativo mas ainda não publicou o cardápio, conforme a regra do perfil em construção.
- Envio sem login, sem criar sessão Supabase e sem associar o feedback ao identificador/token da mesa, pedido ou comanda. A pessoa pode ter chegado pelo link da mesa, mas o feedback continua sem esse vínculo.
- Primeiro corte aceita texto obrigatório (3 a 1.000 caracteres) e até três fotos opcionais. Feedback não aceita vídeo nesta versão. Esta regra é independente da mídia obrigatória nos itens do cardápio.
- Fotos aceitas: JPEG, PNG, WebP e AVIF; até 1.920 px por lado e 5 MB depois da preparação no navegador. A compressão no cliente melhora a experiência, mas validação de formato, tamanho e presença do objeto também deve existir no servidor/Storage.
- Criar rascunho e reservar caminhos no servidor; enviar fotos diretamente do navegador ao bucket privado com URLs temporárias, sem encaminhar os binários pelo Next. Gerar assinaturas e fazer até três uploads em paralelo com limite controlado; publicar somente depois de confirmar os uploads.
- Validar slug/restaurante ativo, conteúdo, formato e limites no servidor/banco. Rate limit deve ser compartilhado entre instâncias, por IP e restaurante, com teto adicional por restaurante no banco. Em produção, obter IP do cabeçalho confiável do proxy/plataforma, nunca confiar cegamente em `x-forwarded-for` enviado pelo cliente.
- O IP usado para limitar abuso não faz parte do feedback visível ao restaurante. Minimizar retenção/identificabilidade desse dado técnico e não apresentá-lo como identidade do cliente.
- A proposta antiga previa feedback append-only e sem exclusão pelo Painel; ela foi substituída pela especificação de 2026-11-13. O Painel permite exclusão confirmada: o texto é redigido e o relato ocultado imediatamente, enquanto o tombstone mantém os caminhos privados até expirarem os tokens de upload; uma limpeza lazy remove objetos e linhas depois.

### 11.2 Leitura no Painel

- Rota curta `/feedbacks` no subdomínio Painel, usando o restaurante ativo do contexto autenticado. Validar associação ativa ao restaurante em toda leitura e mutation; nenhum papel terá privilégio funcional diferente nesta fase.
- Listar os feedbacks do restaurante por publicação mais recente, com paginação por cursor. Abrir o detalhe sob demanda; usar Storage privado e URLs assinadas curtas. Carregar miniaturas na lista e mídia completa no detalhe; não compartilhar cache entre restaurantes/usuários.
- O estado lido/não lido é compartilhado no restaurante, no próprio feedback. Um membro que abre o detalhe marca o mesmo feedback como lido para os demais.
- Não emitir notificação ou push para feedback; não há infraestrutura de notificações do Painel a reutilizar nesta tela.
- Construir a interface do Painel com os componentes shadcn/Tailwind do boilerplate. A identidade visual independente do cardápio público não se aplica a esta tela.

### 11.3 O que existe hoje e transposição técnica

- O formulário público está na capa do cardápio e aparece nos modos clássico/imersivo. Exige texto, permite até três fotos e não envia o identificador da mesa.
- O legado usa rascunho com expiração, URLs de upload assinadas, bucket privado, rate limit por IP e limite adicional por restaurante. A nova versão mantém rascunho e bucket privado, aplica limites compartilhados e exige APP_SERVER_KEY server-only nas operações públicas de feedback. Credenciais privilegiadas permanecem server-side e nunca são expostas no navegador.
- O novo fluxo assina e carrega até três mídias em paralelo, e publica uma única vez após confirmar todos os objetos. O navegador lê dimensões e duração reais para orientar o envio; servidor, banco e Storage validam limites declarados, MIME e tamanho. Como a mídia vai direto do navegador ao Storage, uma chamada forjada pode mentir sobre dimensões/duração sem análise binária server-side.
- A lista legada pagina 20 itens e cria URLs assinadas para as fotos da página. Preservar paginação e carregamento preguiçoso, evitar downloads de imagem em resolução cheia na lista e não refazer a consulta completa em eventos Realtime.
- O `read_at` compartilhado por restaurante é mantido nesta implementação. Todos os membros ativos podem ler e gerenciar feedbacks publicados; exclusão exige confirmação e não há edição direta do conteúdo.
- O novo Painel de Feedbacks não gera notificação interna nem Web Push.

## 12. Direção para Equipe e acessos

Equipe é a gestão de quem tem associação ao restaurante. Cargo continua visível e editável para organização, mas não participa da autorização. A permissão vem da associação ativa; IAM por função fica para depois.

### 12.1 Membros e cargos

- Listar membros com nome, e-mail, cargo e data de entrada. Manter os cargos atuais como informação organizacional; qualquer membro pode alterar cargo, sem diferença de permissões entre os valores. No schema novo, separar o campo de cargo (por exemplo, `position`) de qualquer futuro campo de autorização chamado `role` ou `permission`.
- Todos os membros autenticados têm acesso às páginas e ações da equipe: convidar, revogar convite, alterar cargos e remover outros membros. O servidor e o banco validam associação ativa, não o cargo informado.
- Uma pessoa pode pertencer a vários restaurantes pela mesma conta. Remover da equipe apaga somente a associação daquele restaurante; não apaga a conta global nem as outras associações.
- Impedir o auto-removimento e manter ao menos uma associação no restaurante. Esta é uma invariável de continuidade, não uma função exclusiva de algum cargo. A verificação deve usar lock transacional por restaurante para continuar correta se houver remoções simultâneas.
- Remoção de associação deve surtir efeito nas próximas leituras/mutações por RLS. Se o restaurante removido for o contexto ativo do cookie, limpar/trocar esse contexto e encaminhar a pessoa a um restaurante ao qual ainda tenha acesso. Cookie seleciona contexto, mas não concede autorização.
- Restaurante suspenso ou removido logicamente bloqueia acesso ao Painel e resgate de convites. Preservar associações e convites enquanto suspenso, para que uma reativação restaure o acesso; restaurante em rascunho continua gerenciável durante configuração, salvo regra posterior diferente.
- Construir a tela com componentes shadcn/Tailwind, sem CSS específico. A tela deve comunicar que cargos não são níveis de acesso.

### 12.2 Convites de equipe e entrada na conta

- Convite de equipe concede associação a um restaurante existente; convite de plataforma continua sendo o fluxo distinto que cria restaurante e primeira associação.
- Manter link copiado/compartilhado manualmente, sem envio de e-mail. O convite pode ter e-mail opcional e prazo de 1 a 30 dias, padrão de 7; o cargo inicial pode ser escolhido no convite e alterado depois por qualquer membro.
- O token é credencial de portador, aleatória, de uso único e exibida uma vez; persistir apenas o hash. Preview não consome o link. Aceitação explícita verifica autenticação, prazo, revogação, uso anterior, correspondência exata do e-mail da conta após normalização quando o convite restringe e-mail, e estado do restaurante; a transação consome o convite e cria a associação atomicamente.
- A confirmação de e-mail permanece desligada. E-mail associado ao convite é uma verificação de consistência com o e-mail da conta, não prova de controle da caixa postal; o próprio link continua sendo a credencial de autorização.
- Cadastro de conta só pode ocorrer no contexto de convite válido. A ação de cadastro precisa receber e validar o token no servidor; não basta exibir o formulário apenas na página de convite. Depois do cadastro/login, manter a pessoa na mesma página e exigir clique explícito em “Aceitar”.
- Após aceitar, selecionar o restaurante recém-adicionado no contexto do Painel e encaminhar para a rota curta, sem incluir `/restaurantes/{id}` no endereço. Se a conta já pertencer a esse restaurante, responder como “já tem acesso” sem duplicar associação nem mudar cargo silenciosamente.
- Convites de equipe podem ser revogados. Não revelar nem recuperar um token já emitido. Ao mudar e-mail/prazo ou recuperar link perdido, rotacionar o convite, revogar o token anterior e mostrar o novo uma única vez. Se a resposta de criação ou do aceite se perder após falha de conexão, tratar a repetição de forma idempotente para evitar convites órfãos ou erro enganoso após sucesso.
- Listar na página apenas convites realmente pendentes, com filtro de prazo/revogação/uso no banco e paginação se necessário. Hoje a lista carrega o histórico completo e filtra os pendentes na aplicação.
- Registrar criação, revogação, aceite, alteração de cargo e remoção no log de auditoria; nunca registrar token em claro. Criar o convite e sua auditoria na mesma transação para não deixar link ativo sem retorno à pessoa que o gerou.

### 12.3 Notificações, segurança e o que existe hoje

- Não enviar notificação de entrada de novo membro aos demais membros. Remover o aviso legado de `team_member_joined` e a entrega Web Push associada. A notificação de criação de novo restaurante para administradores da plataforma é um evento separado.
- A tela atual é restrita a `admin`, apresenta contagem e explicações de permissão por cargo, permite editar cargo e remover membros; no celular usa folhas de detalhe. A nova regra remove as restrições de acesso por papel, mas mantém edição de cargo e gestão de associação.
- As ações atuais `createTeamInvite`, `revokeInvite`, `changeMemberRole` e `removeMember` chamam `requireRestaurantAdmin`. Para a nova regra, trocar as autorizações no DAL, ações, RPCs e RLS para associação ativa (`is_member`); não basta liberar os botões na interface.
- A listagem de membros lê e-mails de `auth.users` por RPC `SECURITY DEFINER` com verificação explícita de associação. Preservar essa fronteira estreita; não conceder leitura direta ampla de `auth.users` nem usar `service_role` no navegador.
- O aceite usa transação no banco e índice único `(restaurant_id, user_id)`. Tratar aceite repetido pelo mesmo usuário como sucesso já concluído; convite enviado a quem já é membro não deve sobrescrever seu cargo silenciosamente.
- Carregar membros e convites pendentes numa leitura do contexto autenticado (ou em consultas paralelas e limitadas), evitando repetir autorização e buscar convites vencidos/revogados em toda abertura da tela. Depois de mutações, atualizar apenas a lista/linha afetada.

## 13. Direção para Configurações e preferências da conta

### 13.1 O que existe hoje

- A página genérica atual combina preferência de tema, controles de Web Push por aparelho/teste e, no Admin da plataforma, encerramento global de sessões.
- O tema claro/escuro já está disponível no menu/sheet da conta e é salvo localmente no navegador (`localStorage`); não é configuração do restaurante nem precisa de consulta ao banco. A nova aplicação usará o seletor padrão baseado em shadcn/Tailwind, sem página própria para tema.
- Perfil já tem rota própria com dados da conta e alteração de senha. O encerramento global de sessões é segurança da conta, não uma preferência visual.
- A central interna de notificações, badge de não lidas, atualizações ao vivo e som quando o Painel estiver aberto são funcionalidades operacionais já previstas; não devem ser confundidas com Web Push.
- A rota genérica do restaurante no legado redireciona ao Cardápio. A tela móvel `SettingsMobile` aparece sem referências ativas e não deve ser tratada como fluxo obrigatório para a nova versão.

### 13.2 Direção acordada para a nova versão

- Não criar uma página genérica de Configurações vazia ou duplicada. Remover a entrada correspondente dos menus e da busca de navegação; manter uma rota de redirecionamento apenas se for necessária para compatibilidade com URLs antigas.
- Manter o seletor de tema no shell/menu da conta com o comportamento padrão da UI shadcn. A escolha é local ao navegador/dispositivo, sem tabela de preferências, chamada de leitura nem mutação remota.
- Manter a central interna de notificações, contagem de não lidas, atualização Realtime e som durante uma sessão aberta/conectada. Remover apenas controles, diagnóstico e envio de teste de Web Push.
- Manter a escolha de som como preferência local por navegador. O Painel usará o preset “ding duplo ascendente”: duas notas médias e claras em cerca de 300 ms, perceptíveis sem caráter de alarme.
- Manter a PWA funcional como hoje, incluindo a instalação e o comportamento offline existente do service worker. PWA é independente de Web Push e não implica notificação em segundo plano.
- Preservar Perfil como área de dados e segurança da conta. Manter alteração de senha e disponibilizar ali a ação explícita de encerrar todas as sessões; saída local continua no menu da conta. A sessão Admin e a sessão Painel mantêm cookies separados, e o logout global deve revogar as sessões da conta sem confundir-se com saída local.
- Tema, fontes e cores do cardápio público continuam em Identidade do restaurante. Configurações de gorjeta e meios de pagamento continuam em Financeiro. Nenhuma dessas opções deve migrar para preferências globais da conta.
- Remover da nova versão inscrição/remoção de Push, listeners de Push no service worker, chaves VAPID, entrega e testes de Push. Manter o service worker e os recursos necessários à PWA (instalação e comportamento offline). Não criar configuração de Push nem dependência de Express para esse fim.

### 13.3 Composição da área da conta

- **Menu da conta:** Perfil, tema, central interna de notificações, instalação PWA quando disponível e saída local.
- **Perfil/Segurança:** dados da conta, alteração de senha e encerramento global de sessões com confirmação explícita.
- **Configurações do restaurante:** continuam nas páginas de Identidade, Financeiro e demais áreas funcionais correspondentes.

## 14. Direção para Perfil e segurança da conta

### 14.1 O que existe hoje

- A página de Perfil apresenta nome, e-mail, restaurantes/cargos associados, data de criação e último acesso. Nome e e-mail são somente para consulta; o nome veio do fluxo de convite/cadastro.
- A seção Segurança permite trocar a senha com senha atual, nova senha e confirmação. Não há recuperação de senha por e-mail.
- A Server Action delega ao DAL, que exige usuário autenticado, valida os campos e aplica rate limit. A implementação atual verifica a senha com `signInWithPassword` e depois chama `updateUser`, fazendo duas chamadas Auth.
- A tela apresenta `user.updated_at` como data da última alteração de senha. Esse valor é atualização geral do usuário Auth e não um registro específico de troca de senha; a nova versão não deve rotulá-lo como tal sem manter um timestamp próprio.
- O Perfil do Painel carrega `listMyRestaurants()`, cuja projeção atual retorna muitos campos de restaurante que o Perfil não exibe. O Perfil deve usar uma leitura pequena e específica.
- A validação da aplicação pede ao menos oito caracteres, mas `supabase/config.toml` do legado permite seis. A política do app e do Supabase precisa ser unificada na nova configuração.

### 14.2 Direção acordada para a nova versão

- Manter Perfil como página de consulta da identidade e dos acessos da própria conta, com alteração de senha na seção Segurança. Nome e e-mail não são editáveis no primeiro corte; mudanças de identidade ficam fora deste fluxo.
- Não implementar recuperação self-service por e-mail neste corte. A conta que esquece a senha ou informa um e-mail incorreto solicita suporte pelo território Admin associado ao convite de entrada. O procedimento deve verificar a identidade, operar credenciais somente no servidor e registrar auditoria; definir antes da produção se o Admin emitirá link de recuperação de uso único ou encaminhará a pessoa a outro procedimento assistido. Nunca expor `service_role` ao navegador.
- Implementar a troca como Server Action autenticada e limitada por taxa. Validar senha atual, nova senha e confirmação no servidor; chamar `auth.updateUser` com `current_password` e a nova senha, usando o cliente Supabase da sessão da pessoa. A API `current_password` existe em `supabase-js` v2.102+; a versão encontrada no legado é v2.116.0. Não fazer login paralelo só para conferir a senha, nem registrar qualquer senha em log.
- Alinhar a política de senha entre UI, Zod e as configurações locais/remotas do Supabase. Manter mínimo de oito caracteres e máximo de 200 no primeiro corte; mapear erros como senha atual incorreta, senha nova igual à anterior e política de senha fraca sem revelar detalhes internos.
- Após troca bem-sucedida, manter a sessão atual e encerrar as outras sessões Auth, conforme `scope: 'others'`. A sessão separada do outro subdomínio pode continuar com cookie/access token em memória até renovação/expiração; a UI e o tratamento de sessão devem reconhecer a falha ao renovar. Tokens de acesso já emitidos não são revogados instantaneamente; uma proteção imediata exigiria validação extra do `session_id` em operações sensíveis ou outra política de expiração.
- Preservar a ação explícita de encerramento de todas as sessões, distinta da troca de senha; ela também encerra a sessão atual e exige novo login. Saída local permanece somente no navegador/território atual.
- Não mostrar “última troca de senha” usando `auth.users.updated_at`. O primeiro corte pode omitir essa data; se auditoria de mudanças de senha se tornar requisito, registrar evento/timestamp próprio no servidor sem armazenar segredos.
- Carregar os dados do Perfil somente quando a rota autenticada for aberta. Consultar nome, e-mail e datas da própria conta, além de uma projeção mínima das associações (restaurante e cargo informativo); não carregar campos de menu/contato/identidade nem armazenar perfil privado em cache compartilhado entre contas.
- Construir a página com componentes shadcn/Tailwind, sem CSS específico. Não transformar cargo de restaurante em autorização: cargos continuam informativos até a fase de IAM.

## 15. Dependências e trabalho que vêm depois da aprovação

Nada abaixo foi feito nesta fase; são itens para um plano posterior:

1. Revisar se as decisões Admin, Painel, Cardápio, Identificadores, Chamados, Feedbacks, Equipe, Financeiro, Caixa e Conta registradas nesta base representam o escopo pretendido.
2. Aprovar esta base de escopo/arquitetura.
3. Criar plano de implementação das fatias Admin, onboarding do Painel, Cardápio, Identificadores, Chamados, Feedbacks, Equipe, Financeiro, Caixa e Conta/Segurança; ler os guias locais do Next 16.4.2 pertinentes antes de alterar código.
4. Criar o projeto Supabase de produção separado; recomendação inicial é São Paulo também, para ficar perto do público e das funções Vercel `gru1`.
5. Ajustar o caminho de CSS no preset e idioma do layout.
6. Adicionar os pacotes Supabase necessários com pnpm e manter o lockfile da nova aplicação sincronizado.
7. Configurar as variáveis por ambiente sem copiar valores secretos entre projetos.
8. Implementar login/bootstrap documentado, convites, gestão de restaurantes, onboarding inicial do Painel, Cardápio, Identificadores, Chamados, Feedbacks, Equipe, Financeiro, Caixa e Conta/Segurança como fatias; portar regras de negócio, não as folhas CSS do legado.
9. Manter o produto antigo disponível durante a migração e só retirar seus fluxos depois de validar o corte planejado.
10. Fazer revisão estática conforme as instruções; nenhum teste/build/lint/typecheck será executado neste workspace.

## 16. Perguntas respondidas e decisões registradas

1. **[Resolvida] O convite é para novos clientes/restaurantes ou operadores internos?** É para clientes: resgatar cria um restaurante e associa a conta como primeiro membro com acesso de gestão por membership. Não misturar com `platform_admins` nem tratar cargo de equipe como permissão.
2. **[Resolvida] Qual Supabase o app novo usará?** Supabase local para desenvolvimento, projeto remoto novo/vazio em São Paulo para demo/staging e um projeto separado para produção. O schema é criado do zero; não haverá migração de dados do Oregon.
3. **[Resolvida] Onde o convidado resgata?** O fluxo de convite, criação da conta/restaurante e setup inicial do Painel entra na nova aplicação junto do Admin.
4. **[Resolvida] Quais hosts/domínios Admin e Painel usarão?** Subdomínios próprios na mesma aplicação Next, com sessões/cookies separados.
5. **[Resolvida por requisito + regra técnica] O que significa editar convite?** E-mail e prazo podem ser alterados; qualquer edição que afete a validade revoga o token anterior e emite um novo link, mostrado uma única vez. A rotação continua disponível.
6. **[Resolvida para o primeiro corte] O sistema enviará convite por e-mail?** Não; Admin gera link para copiar/compartilhar. A confirmação de e-mail do Supabase permanece desligada; o link funciona como credencial de resgate, e o campo de e-mail não comprova controle da caixa postal.
7. **[Resolvida para o primeiro corte] Quais ações de restaurante entram no Admin?** Listagem/detalhe e mudança de estado. Troca de slug e exclusão lógica ficam para uma etapa posterior.
8. **[Resolvida] Como se relacionam setup, ativação e publicação do cardápio?** O restaurante começa em `draft` somente enquanto Identidade e Contato estão incompletos. Ao salvar Contato, passa a `active`; o menu continua em `draft` até publicação explícita. A slug de um restaurante ativo exibe perfil/contato e feedback mesmo sem cardápio publicado, com mensagem de construção e sem chamar equipe.
9. **[Resolvida] Como fica a chamada da equipe?** A URL da slug não chama equipe. Só o link com identificador opaco de mesa carrega contexto; a chamada é permitida quando o menu está publicado e deve ser recusada também no servidor/banco se não estiver.
10. **[Resolvida] Como ficam alterações depois da primeira publicação?** Salvamentos de categorias/itens tornam-se públicos imediatamente; o comando de publicar controla disponibilidade, sem etapa de republicação por alteração.
11. **[Resolvida para o primeiro corte] Quais modos de gestão do menu entram primeiro?** Básicos de lista/índice/grade, busca, filtros, CRUD e bulk. Os modos `studio`, `board`, `spreadsheet`, `sequence` e `service` ficam para depois.
12. **[Resolvida] Quando exigir mídia?** Em todos os itens publicáveis/encomendáveis, tanto na apresentação imersiva quanto na clássica.
13. **[Direção acordada] O que fazer ao excluir categoria com itens?** Bloquear até mover/remover os itens; não reproduzir o cascade destrutivo do legado.
14. **[Direção acordada] Como representar destaques e restrições?** Separar destaques livres de atributos estruturados de dieta/alergênicos; vocabulário e contaminação cruzada ficam para o plano técnico.
15. **[Resolvida] O conteúdo NFC é editável?** Não. O NDEF deve ser gravado, conferido e depois bloqueado permanentemente; o bloqueio físico é irreversível.
16. **[Resolvida] A tag/identificador pode ser realocada?** Sim, para outra mesa no mesmo restaurante. O token, URL e restaurante associados ficam imutáveis; o número de mesa e o estado ativo podem ser alterados no Painel.
17. **[Resolvida] Como trocar ou corrigir uma tag bloqueada?** Criar outro identificador/token, registrar outra tag e desativar o identificador anterior. A tag bloqueada não é reaproveitada.
18. **[Direção acordada] Como evitar gargalos no acesso NFC/QR?** Rever o rate limit por IP da simples resolução do link e evitar escrita de `last_seen_at` a cada toque; manter controles fortes nas operações com efeito, como chamados.
19. **[Resolvida] Pode haver vários chamados ativos na mesma mesa?** Não. Há no máximo um pendente/em atendimento por mesa; repetições retornam o mesmo chamado. Um novo pode ser criado depois da conclusão, respeitando limites antiabuso.
20. **[Resolvida] Quando abre a comanda e como agrega pedidos?** No primeiro pedido confirmado. Pedidos de chamados subsequentes e do Caixa são anexados à conta ativa da mesa; o Caixa faz recebimentos e encerramento.
21. **[Resolvida] Papéis limitam acesso às páginas e ações do Painel?** Não nesta fase. Todos os membros do restaurante têm o mesmo acesso por funcionalidade; a associação autenticada ao restaurante continua obrigatória. Em chamados, qualquer membro pode assumir ou receber transferência; somente a pessoa responsável pode lançar pedidos/concluir até transferir.
22. **[Resolvida] Como ficam Web Push, Express e PWA?** Web Push e o worker Express saem. Notificações internas/Realtime permanecem para todos os membros ativos; som opt-in é local ao navegador. A PWA e seu service worker continuam para instalação e comportamento offline, sem listeners nem inscrição de Push.
23. **[Resolvida] Qual é a responsabilidade de Financeiro?** Análise por intervalo de vendas lançadas e valores recebidos, mostrados separadamente. O padrão é o dia atual no fuso horário do restaurante; a análise inclui períodos de caixa abertos e fechados.
24. **[Resolvida] Onde ficam as configurações do caixa e as operações?** Configurações podem ficar em área própria de Financeiro. Abertura, movimentações, recebimentos, correções, fechamento e sessão pertencem a Caixa.
25. **[Resolvida] Como tratar a gorjeta?** Decisão opcional e única por comanda; cliente pode aceitar ou recusar. Normalmente decide ao encerrar o consumo; se uma comanda for transportada sem decisão, decide junto ao primeiro recebimento posterior. Gorjeta aceita integra o total e usa os meios comuns de pagamento.
26. **[Resolvida] Como tratar o fechamento excepcional com saldo aberto?** Transportar o saldo para uma comanda pendente sem novos pedidos, disponível para recebimento na próxima sessão. Chamados mantêm o próprio ciclo e não são encerrados pelo fechamento do caixa. Gorjeta já decidida é preservada; se não decidida, fica para o recebimento posterior.
27. **[Resolvida] Como tratar mídia nos itens?** Mídia é obrigatória em todo item publicável/encomendável, independentemente do formato. Manter fotos e vídeos curtos, seguindo o padrão do legado. Feedback aceita até três fotos/vídeos combinados, com validação server/database dos limites declarados e upload privado direto do navegador.
28. **[Direção acordada] Como remover a lentidão financeira e do Caixa?** Separar agregados analíticos de leituras operacionais; não somar grandes listas na aplicação; carregar detalhes sob demanda; após gravações e eventos Realtime, atualizar somente os recursos afetados.
29. **[Resolvida] Que mídia entra em feedback?** Texto e até três fotos/vídeos opcionais; a exigência de mídia obrigatória dos itens do cardápio não se aplica a feedback.
30. **[Resolvida] Quais ações o Painel oferece sobre feedback?** Visualizar conteúdo/mídia, manter lido/não lido e excluir com confirmação. Não permitir resposta, reação nem edição do conteúdo.
31. **[Resolvida] Quem recebe notificação de novo feedback?** Não há notificação ou push para feedback nesta entrega.
32. **[Resolvida] O estado lido/não lido é compartilhado ou individual?** Compartilhado por restaurante; uma pessoa marcar como lido altera o estado para as demais.
33. **[Resolvida] Como remover um feedback pelo Painel?** Ocultar e redigir imediatamente, reter tombstone/caminhos privados até expirarem os tokens de upload e limpar mídias/linhas por RPC; não conceder DELETE direto nas tabelas.
34. **[Resolvida] Os cargos da equipe limitam o que cada pessoa pode fazer?** Não. Cargo fica como informação organizacional, visível e editável; todos os membros têm as mesmas ações por associação.
35. **[Resolvida] Quem recebe aviso quando alguém entra na equipe?** Não há notificação de entrada para o restaurante. A notificação de novo restaurante para Admin é separada.
36. **[Resolvida] O que ocorre ao suspender um restaurante?** Bloquear Painel e resgate de convites; manter associações e convites para reativação. Restaurante em configuração/rascunho continua gerenciável.
37. **[Resolvida] Como evitar que a equipe fique sem acesso?** Não permitir auto-removimento nem remover a última associação; validar a invariável com lock transacional, independentemente do cargo.
38. **[Resolvida] Como editar ou recuperar um convite de equipe?** Rotacionar o convite e invalidar o token antigo; mostrar o novo link uma única vez.
39. **[Resolvida] A nova versão terá uma página genérica de Configurações?** Não. Tema fica no menu da conta; notificações internas continuam como central funcional; Web Push e seus controles/testes são removidos; PWA e service worker para instalação/offline permanecem; saída global fica em Perfil/Segurança e saída local permanece no menu da conta.
40. **[Direção acordada; procedimento pendente] Como tratar perda de senha sem recuperação por e-mail?** A pessoa solicita suporte pelo território Admin associado ao convite de entrada. Não há recuperação self-service por e-mail. Definir antes da produção a verificação de identidade e se o Admin emitirá link de uso único ou usará outro procedimento assistido, com auditoria e sem expor `service_role` ao navegador.
41. **[Resolvida] O que ocorre com as sessões ao trocar a senha?** Manter a sessão que fez a troca e encerrar as demais sessões Auth. A revogação de refresh tokens não invalida instantaneamente access tokens já emitidos; distinguir isso da ação explícita “encerrar todas as sessões”.
42. **[Resolvida] Como clientes navegam pelo cardápio público?** Pela régua de categorias existente; busca e filtros de gestão continuam no Painel. Busca pública independente fica fora do primeiro corte.
43. **[Resolvida] Como evitar cardápio publicado vazio?** Impedir ocultar/remover o último item visível enquanto publicado; primeiro despublicar. Itens indisponíveis podem continuar visíveis com o estado correspondente.
44. **[Resolvida] Como funciona a avaliação no Google?** O Contato recebe o perfil no Maps e gera um link direto de avaliação, persistido separadamente. Se a geração falhar, o onboarding não é concluído com o link do Maps.
45. **[Resolvida] Qual som usar para novos chamados?** Som opt-in, salvo localmente por navegador: “ding duplo ascendente”, duas notas médias e claras em cerca de 300 ms, perceptíveis sem caráter de alarme. O toque atual do legado é um seno descendente curto (740→520 Hz, cerca de 230 ms) e foi considerado baixo demais.

46. **[Resolvida] Como é criado o primeiro Admin da plataforma?** Pela aplicação, enquanto a vaga única estiver livre; depois, a página informa que já foi criado e bloqueia outro cadastro. O banco impõe a unicidade e o cadastro reabre quando o usuário Auth associado é removido. A primeira conta é criada pelo responsável antes de divulgar o endereço do ambiente; a confirmação de e-mail continua desligada. Cada projeto Supabase de Local, Preview/Staging e Produção terá sua própria conta Admin.

## 17. Referências internas consultadas

- Admin legado: `apps/web/src/app/admin/(platform)`
- Ações e DAL: `apps/web/src/server/actions/invites.ts`, `apps/web/src/server/actions/restaurants.ts`, `apps/web/src/server/dal/invites.ts`, `apps/web/src/server/dal/restaurant-read.ts`, `apps/web/src/server/dal/restaurant-write.ts`, `apps/web/src/server/dal/auth.ts`
- Cardápio: `apps/web/src/app/(site)/[slug]/page.tsx`, `apps/web/src/app/(site)/t/[token]/page.tsx`, `apps/web/src/server/dal/menu-read.ts`, `apps/web/src/server/dal/menu-write.ts`, `apps/web/src/server/dal/feedback-public.ts`, `apps/web/src/server/dal/service-calls-public.ts`, `apps/web/src/features/workspace/components/menu-workspace.tsx`
- Identificadores/NFC: `apps/web/src/app/admin/workspace/restaurants/[id]/identificadores/page.tsx`, `apps/web/src/features/workspace/components/identificadores-screen.tsx`, `apps/web/src/features/workspace/components/identifiers-panel.tsx`, `apps/web/src/features/workspace/components/nfc-identifiers.tsx`, `apps/web/src/features/workspace/components/identifiers-utils.ts`, `apps/web/src/server/dal/tags.ts`, `apps/web/src/server/actions/tags.ts`, `apps/web/src/domain/tag.ts`, `apps/web/src/server/security/tokens.ts`
- Chamados, pedidos e Caixa: `apps/web/src/app/admin/workspace/restaurants/[id]/service-calls/page.tsx`, `apps/web/src/features/calls/components/calls-screen.tsx`, `apps/web/src/features/calls/use-service-calls-realtime.ts`, `apps/web/src/features/notifications/effects.ts`, `apps/web/src/server/dal/service-calls.ts`, `apps/web/src/server/dal/service-calls-public.ts`, `apps/web/src/server/dal/orders.ts`, `apps/web/src/server/dal/table-accounts.ts`, `apps/web/src/features/cash/components/cash-screen.tsx`, `apps/web/src/domain/service-call.ts`, `apps/web/src/domain/orders.ts`, `apps/web/src/domain/table-account.ts`
- Financeiro e Caixa: `apps/web/src/app/admin/workspace/restaurants/[id]/financeiro/page.tsx`, `apps/web/src/server/dal/finance.ts`, `apps/web/src/features/finance/components/finance-screen.tsx`, `apps/web/src/features/finance/components/cash-day-history.tsx`, `apps/web/src/features/finance/components/legacy-finance-report.tsx`, `apps/web/src/features/finance/components/cash-day-opening.tsx`, `apps/web/src/features/finance/components/cash-day-movements.tsx`, `apps/web/src/features/finance/components/cash-day-closing.tsx`, `apps/web/src/features/cash/components/cash-screen.tsx`, `apps/web/src/features/cash/components/cash-settings.tsx`, `apps/web/src/features/cash/components/cash-order-dialog.tsx`, `apps/web/src/features/cash/components/cash-account-tabs.tsx`, `apps/web/src/features/cash/components/account-finalization.tsx`, `apps/web/src/features/cash/components/account-corrections.tsx`, `apps/web/src/server/dal/table-accounts.ts`, `apps/web/src/server/dal/orders.ts`, `supabase/migrations/0011_finance_operating_day.sql`
- Feedbacks: `apps/web/src/features/public-menu/components/feedback-sheet.tsx`, `apps/web/src/server/actions/feedback.ts`, `apps/web/src/server/dal/feedback-public.ts`, `apps/web/src/app/admin/workspace/restaurants/[id]/feedbacks/page.tsx`, `apps/web/src/features/feedback/components/feedbacks-screen.tsx`, `apps/web/src/server/dal/feedback.ts`, `supabase/migrations/0001_web_baseline.sql` (seção 0030)
- Equipe e convites: `apps/web/src/app/admin/workspace/restaurants/[id]/team/page.tsx`, `apps/web/src/features/workspace/components/member-row.tsx`, `apps/web/src/features/invitations/components/invite-dialog.tsx`, `apps/web/src/features/invitations/components/invite-list.tsx`, `apps/web/src/features/auth/components/invite-auth-tabs.tsx`, `apps/web/src/features/auth/components/sign-up-form.tsx`, `apps/web/src/features/workspace/components/accept-invite-button.tsx`, `apps/web/src/server/actions/members.ts`, `apps/web/src/server/actions/invites.ts`, `apps/web/src/server/dal/members.ts`, `apps/web/src/server/dal/invites.ts`, `apps/web/src/server/dal/auth.ts`, `supabase/migrations/0001_web_baseline.sql` (membros, convites, `redeem_invite`, `memberships_guard_last_admin`, `memberships_notify`)
- Conta/configurações, tema e notificações: `apps/web/src/features/account/components/settings-page.tsx`, `apps/web/src/features/account/components/profile-page.tsx`, `apps/web/src/app/admin/(platform)/settings/page.tsx`, `apps/web/src/app/admin/workspace/restaurants/[id]/account/settings/page.tsx`, `apps/web/src/components/shell/account-popover.tsx`, `apps/web/src/components/shell/account-panel.tsx`, `apps/web/src/features/platform/components/account/account-sheet.tsx`, `apps/web/src/features/notifications/components/notification-center-sheet.tsx`, `apps/web/src/components/pwa/pwa-install-action.tsx`
- Perfil e senha: `apps/web/src/features/account/components/profile-page.tsx`, `apps/web/src/server/actions/profile.ts`, `apps/web/src/server/dal/profile.ts`, `apps/web/src/server/dal/auth.ts`, `apps/web/src/server/dal/_client.ts`, `apps/web/src/server/dal/restaurant-read.ts`, `apps/web/src/domain/profile.ts`, `supabase/config.toml`
- Perfil público/Contato e link Google: `apps/web/src/features/workspace/components/profile-form.tsx`, `apps/web/src/domain/restaurant.ts`, `apps/web/src/domain/google-review.ts`, `apps/web/src/server/dal/restaurant-write.ts`, `apps/web/src/features/public-menu/components/menu-cover.tsx`; [link de avaliação do Google Business Profile](https://support.google.com/business/answer/16816815?hl=en-11)
- Schemas de domínio: `apps/web/src/domain/invite.ts`, `apps/web/src/domain/restaurant.ts`
- Banco/Bootstrap: `supabase/migrations/0001_web_baseline.sql`, `supabase/seed/bootstrap-admin.sql`
- Boilerplate: `tavvi-app/app`, `tavvi-app/components/ui`, `tavvi-app/components.json`
- Next 16 local docs consultadas: Authentication, Server Actions and Mutations, Proxy — em `tavvi-app/node_modules/next/dist/docs/01-app`.
- Supabase: [SSR Auth e cookies](https://supabase.com/docs/guides/auth/server-side/advanced-guide), [`getClaims`](https://supabase.com/docs/reference/javascript/auth-getclaims), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [conexões serverless](https://supabase.com/docs/guides/database/connecting-to-postgres/serverless-drivers).
- Next.js: [Server Actions e cookies](https://nextjs.org/docs/app/getting-started/mutating-data).
- Vercel/Supabase: [regiões de Functions](https://vercel.com/docs/functions/configuring-functions/region), [regiões Supabase](https://supabase.com/docs/guides/platform/regions).
- NFC: [Web NFC, Chrome for Developers](https://developer.chrome.com/docs/capabilities/nfc).
- Google Business Profile: [criar link ou QR code para solicitar avaliações](https://support.google.com/business/answer/16816815?hl=en-11).



