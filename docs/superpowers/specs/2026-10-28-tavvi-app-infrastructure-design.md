# Tavvi-app — base de infraestrutura e ambientes

**Estado:** rascunho atualizado para revisão do usuário  
**Data:** 2026-10-28  
**Aplicação-alvo:** `C:\Users\Eduardo Zamai\Documents\tavvi-app`  
**Referência de decisões e legado:** `C:\Users\Eduardo Zamai\Documents\tavvi-app\__BASE.MD`

## Intenção

Preparar a base de código e publicação do Tavvi-app antes de portar páginas, componentes ou funcionalidades. O repositório privado GitHub já existe em https://github.com/ZamaiZ/tavvi-app.git e a branch local ativa é preview; o projeto Vercel ainda não existe. A primeira etapa configura Local e Preview/demo. Production fica sem branch master, projeto Supabase, variáveis ou domínio até a etapa de produção.

## Objetivos

- Manter uma aplicação Next.js standalone, organizada como monólito modular e implantada em um único projeto Vercel.
- Usar o repositório privado existente do projeto novo e manter preview como branch ativa de demonstração. Não criar master agora; criar essa branch somente quando o trabalho de produção começar e houver uma configuração Production aprovada.
- Usar Supabase local por Docker no desenvolvimento, o projeto remoto vazio de São Paulo para Preview/demo e um projeto remoto separado de São Paulo para produção.
- Versionar a configuração local e as migrações do projeto Supabase novo dentro de `tavvi-app`; criar o schema novo do zero.
- Preparar uma fronteira server-side no Next para sessão, roteamento por host, acesso ao Supabase e validação de ambiente.
- Preservar o limite visual já definido: componentes do preset shadcn e Tailwind, sem CSS personalizado de página ou funcionalidade.
- Preparar os hosts separados de Admin, Painel e superfície pública para produção. Como não há domínio próprio nesta etapa, o Preview usa um host Vercel único com prefixos `/admin` e `/painel`; o cardápio público usa a raiz `/{slug}`.
- Manter sessões/cookies de Admin e Painel isolados; o domínio público não cria nem recebe sessão Auth dessas superfícies.
- Preparar variáveis específicas por ambiente, domínios e redirects Auth sem colocar segredos no repositório ou bundle do navegador.
- Fixar as regiões de execução remota em `gru1` enquanto Preview e produção usarem bancos primários em São Paulo.
- Preservar suporte PWA como capacidade web; Web Push, Express, VAPID e `APP_SERVER_KEY` não fazem parte da nova base.

## Fora de escopo

- Páginas, fluxos de usuário, componentes visuais, funcionalidades e schema de domínio.
- Portar código, CSS, baseline SQL, dados ou configuração de produção do Tavvi legado.
- Criar um backend Express, worker, fila ou conexão Postgres TCP para o runtime Next.
- Provisionar ou ativar o ambiente de produção nesta primeira etapa.
- Prometer uma capacidade numérica de tráfego antes de conhecer picos de requisições, conexões Realtime e egress de mídia.
- Não adicionar nem executar testes. O usuário autorizou comandos de Git, typecheck e build para este workspace; lint permanece fora desta etapa.

## Contexto verificado

- `tavvi-app` é atualmente um único pacote Next.js 16.4.2/React 19, usa `app/` na raiz e contém o preset shadcn/Tailwind. Ainda não possui configuração Supabase, migrações, clientes Auth ou variáveis de ambiente do Tavvi.
- O `components.json` real usa `base-mira`, ícones Lucide e `app/globals.css`; a descrição anterior desses valores no `__BASE.MD` está desatualizada e deve ser corrigida antes de servir como inventário do boilerplate.
- O Tavvi legado é um monorepo separado. Seu Express atende health check e Web Push, e suas variáveis obrigatórias incluem valores que não devem ser copiados para o app novo.
- O projeto remoto novo de São Paulo está vazio e é destinado a demo/staging. O projeto de produção será separado. O Supabase Oregon pertence ao legado e não é alvo desta base.
O repositório GitHub privado já existe em https://github.com/ZamaiZ/tavvi-app.git; o projeto Vercel ainda não foi criado. O checkout local está na branch preview; master não deve existir nesta etapa.
O usuário autorizou comandos de Git, typecheck e build em tavvi-app. Testes continuam proibidos para este projeto; a validação permitida inclui inspeção estática, typecheck e build.

## Arquitetura

### Aplicação e limites de runtime

O Next é o único runtime de aplicação nesta etapa. A árvore atual `app/` permanece na raiz. O diretório `app/` contém as rotas e layouts; `features/<dominio>/` recebe módulos verticais à medida que domínios forem aprovados; `components/ui/` mantém os componentes gerados pelo preset; `server/` contém utilitários server-only transversais; `lib/supabase/` contém factories de cliente Supabase específicas para servidor, Proxy e, somente quando necessário, navegador.

`proxy.ts` na raiz interpreta o host, aplica o roteamento interno de cada superfície e participa da renovação de sessão conforme a convenção do Next 16. A documentação local do Next 16.4.2 define Proxy como camada de rewrite/redirect e verificação otimista, não como lugar para fetch lento, autorização completa ou carregamento de domínio. Leituras e mutações futuras serão autorizadas no servidor e protegidas por RLS. Evitar um cliente Supabase global que compartilhe cookies ou sessão entre requisições.

O runtime Next usa os clientes Supabase SSR/Data API com a sessão do usuário. Server Actions atendem mutações internas de interface; Route Handlers serão acrescentados apenas para contratos HTTP externos que precisem deles, não como cópia de toda a camada de dados. Não usar Express ou conexão Postgres direta para obter concorrência ou pooling.

### Sessão, cookies e hosts

- Em produção, Admin e Painel ficam em hosts distintos no mesmo deployment. No Preview sem domínio, ambos usam o host Vercel com prefixos de caminho `/admin` e `/painel`; a raiz pública continua sem sessão Auth.
- Admin e Painel usam cookies de sessão Supabase distintos. Em produção são host-only, `Secure`, `SameSite=Lax` e `Path=/`; no Preview os nomes continuam distintos no mesmo host. Não forçar `HttpOnly` nas cookies Supabase SSR: a sessão partilhada com o cliente do navegador precisa permitir a manutenção/renovação pelo SDK, inclusive para uso futuro de Realtime. Não copiar tokens Auth para `localStorage`.
- O atributo `Domain` não é compartilhado entre os subdomínios de produção. Prefixos de caminho no Preview são conveniência de roteamento e não constituem isolamento por origem.
- O host público não cria sessão Auth para menu, chamadas ou feedback.
- Para o desenvolvimento local, a configuração permite testar a raiz pública em `localhost:3000`, Admin em `admin.localhost:3000` e Painel em `painel.localhost:3000`.
- Em produção, os subdomínios Admin/Painel e o domínio público serão ligados ao mesmo projeto Vercel quando houver domínio. Na branch `preview`, um único host gerado pela Vercel serve os prefixos de Admin/Painel e a raiz pública. Previews efêmeros por PR não recebem conexão Supabase.
- O cookie `active_restaurant_id`, se usado, é separado das sessões Auth e permanece `HttpOnly`; ele é apenas um seletor de contexto, nunca autorização. A autorização permanece vinculada à sessão e ao banco.

### Supabase e dados

- Criar `supabase/config.toml` e iniciar o diretório de migrações no Tavvi-app. `.temp/` e estado local da CLI não são artefatos versionados. Não criar seed vazio: seeds só entram junto de tabelas e dados de desenvolvimento definidos por uma feature.
- A cadeia de migrações nova é a fonte de verdade do schema novo. Nenhuma baseline ou migração do legado será aplicada ao projeto novo.
- O desenvolvimento começa e valida sua cadeia em Supabase local; o projeto vazio de demo recebe a mesma sequência por um fluxo deliberado; produção recebe as migrações aprovadas em etapa separada.
- Migrações de banco não executam no build nem no boot do Next.
- A confirmação de e-mail fica desligada conforme a decisão existente. `site_url` e redirects permitidos são definidos por ambiente e limitados aos hosts válidos daquele ambiente.
- Usar chave pública/publishable do Supabase com RLS. Não adicionar chave privilegiada, `APP_SERVER_KEY`, `VAPID_PRIVATE_KEY` ou chave similar sem um caso necessário explicitamente avaliado; qualquer segredo fica somente server-side.
- O primeiro Admin será cadastrado pela aplicação enquanto a vaga única estiver livre. Não criar usuário nem associação de Admin por seed, reset ou bootstrap SQL; detalhes de schema ficam na spec de identidade Admin.

### Ambientes e publicação

| Ambiente | Next/Vercel | Supabase | Domínios e credenciais |
|---|---|---|---|
| Local | Next em desenvolvimento; `admin.localhost:3000`, `painel.localhost:3000` e `localhost:3000` público | Supabase CLI + Docker local | `.env.local` ignorado, apontando somente para localhost |
| Preview/demo | Um host Vercel da branch `preview`; `/admin`, `/painel` e `/{slug}` | Projeto novo remoto atual de São Paulo | Variáveis Preview restritas à branch `preview`; nenhum segredo de produção |
| Produção (futuro) | Branch master, a criar somente quando o escopo de Production começar | Projeto Supabase separado em São Paulo, ainda a criar | Sem variáveis Supabase nem domínio ativo nesta etapa; nunca apontar para o banco de Preview |

#### Criação do repositório e projeto Vercel

- O repositório privado GitHub ZamaiZ/tavvi-app já existe. Manter o checkout ativo em preview, publicar essa branch no remoto quando a configuração estiver pronta e não criar master agora. Não é necessário criar outro repositório nem alterar o boilerplate.
- Criar um único projeto Vercel conectado ao repositório existente, com diretório raiz na raiz do repositório, framework Next.js e deploy por branch. Definir o branch de Production como master somente se o dashboard aceitar essa referência sem que a branch exista; se exigir uma branch presente, não criar master como atalho e deixar a integração/implantação pendente até a etapa Production.
- A branch `preview` gera o deployment de demonstração. Configurar as variáveis de acesso Supabase somente como variáveis Preview associadas especificamente à branch `preview`. Não criar variáveis Preview genéricas que também sejam herdadas por branches de PR.
- Sem domínio próprio, a demonstração usa o hostname de Preview gerado pela Vercel e caminhos `/admin`, `/painel` e `/{slug}`. Esse hostname é uma origem compartilhada; nomes distintos de cookies não equivalem a isolamento por domínio.
- Ao importar o repositório, a Vercel pode tratar preview (branch default inicial) como Production antes da configuração manual. Considerar qualquer deployment inicial um placeholder sem Supabase/sem domínio, configurar master como Production Branch assim que o dashboard permitir, proteger deployments e não compartilhar a URL. Se não for possível selecionar master sem criá-la, não promover preview a Production; pausar a integração e reportar esse limite.
- Não conectar a Vercel ao Supabase Oregon nem expor chaves privilegiadas. O vínculo remoto de Demo/Preview usa somente URL e chave publicável do projeto novo de São Paulo.

O schema remoto acompanha a branch preview. A branch master não existe nesta etapa e será criada quando a configuração de Production começar; até lá, não configurar ou ativar ambiente Production.

Sem domínio próprio, a branch `preview` mantém um único hostname `*.vercel.app` e usa prefixos de caminho para identificar Admin e Painel. Criar três projetos Vercel no mesmo repositório poderia gerar três URLs `vercel.app`, mas replicaria builds e configuração e não faz parte do primeiro corte. Quando houver domínio próprio, produção poderá usar subdomínios separados no mesmo projeto Vercel, sem mudar o Supabase por ambiente.

Configurar `gru1` para as Vercel Functions que acessam os bancos remotos em São Paulo. Manter uma região de compute enquanto houver um único banco primário. O CDN pode entregar conteúdo estático globalmente; isso não implica que operações dinâmicas devam executar longe do banco. Multi-região só será considerada junto de uma estratégia de dados/replicação que suporte leituras e escritas corretamente.

O plano Vercel Hobby pode ser usado apenas dentro de seu escopo pessoal/não comercial para a demonstração. Operação comercial de produção exige o plano adequado, previsto como Pro. Preview e produção continuam isolados por variáveis e por projeto Supabase, independentemente do plano.

### Organização-alvo

```text
tavvi-app/
├── app/                      # rotas e layouts; namespaces internos por host
├── components/
│   ├── ui/                   # preset shadcn existente
│   └── shared/               # adicionar quando houver componentes comuns
├── features/                 # módulos de domínio adicionados conforme aprovados
├── lib/
│   ├── supabase/             # factories SSR/proxy/browser e tipos gerados
│   └── utils.ts              # helpers puros, sem regras de domínio
├── server/                   # env, auth, contexto, segurança e observabilidade
├── public/                   # assets do app e PWA, sem Web Push
├── supabase/
│   ├── config.toml
│   ├── migrations/           # primeira migração entra com o schema de domínio aprovado
│   └── seed.sql              # opcional; criar só quando houver dados locais necessários
├── proxy.ts
├── instrumentation.ts        # integração de observabilidade quando escolhida
├── next.config.ts
├── vercel.json               # região/configuração versionável do projeto
├── .env.example              # nomes e placeholders, nunca valores reais
├── package.json
└── pnpm-lock.yaml
```

Não criar diretórios vazios de cada domínio, `apps/*`, um worker ou `packages/*` antes da necessidade. Fixar a versão do Node e o campo `packageManager` do pnpm para alinhar desenvolvimento, CI e Vercel.

## Etapas de configuração

1. **Repositório existente:** verificar ZamaiZ/tavvi-app, manter preview como branch ativa e publicar nela quando o código de infraestrutura estiver pronto. Não criar a branch master; ela só será criada na etapa de Production.
2. **Reprodutibilidade e proteção de segredos:** fixar Node/pnpm, criar `.env.example`, revisar `.gitignore` para `.env.local`, estado temporário do Supabase e artefatos Vercel; manter o pacote standalone e sincronizar o lockfile ao adicionar dependências.
3. **Supabase local/Docker:** versionar `supabase/config.toml`, preparar Auth local sem confirmação de e-mail e redirects locais restritos aos hosts de desenvolvimento. Instalar/usar Supabase CLI de forma reproduzível. Não criar schema de domínio, bootstrap-admin ou migração inicial sem decisões de feature.
4. **Fronteiras server-side do Next:** adicionar validação de ambiente que não quebre o build quando branches sem Supabase forem implantadas; factories Supabase por contexto de requisição, separação de cookies Admin/Painel, `proxy.ts` para roteamento de host/caminho e regras de segurança. Não adicionar páginas ou ações de produto.
5. **Vínculo remoto de Demo/Preview:** conectar somente o projeto Supabase vazio de São Paulo, mantendo o schema vazio até uma etapa de migrações aprovada. Não configurar ou linkar produção.
6. **Projeto Vercel:** criar o projeto conectado ao repositório existente, configurar Preview para preview, definir Function region gru1 e variáveis Supabase apenas para essa branch. Usar master como Production Branch sem criar a branch somente se Vercel aceitar essa referência; caso contrário, adiar integração/deploy para não converter preview em Production.
7. **Operação mínima e escala:** começar com logs e métricas nativas da Vercel e Supabase; definir request IDs, tempos e alertas quando houver rota funcional e volume medível. Não escolher nem adicionar provedor de observabilidade antes da necessidade e orçamento estarem claros.
8. **Preparação para Production futura:** não criar branch master nesta etapa; criá-la somente junto do projeto Supabase de produção e da configuração de deploy aprovados. Não preencher Production envs, associar domínio de produção nem tratar deploy placeholder como lançamento.

Cada etapa deve deixar os ambientes identificáveis e não deve promover credenciais ou dados de Preview para produção.

## Critérios de conclusão da base

- O repositório e o runtime local têm versões fixas e configuração documentada.
- O repositório privado existente preserva o boilerplate atual; preview é a branch ativa e a única branch operacional nesta fase.
- Supabase local sobe independentemente do projeto remoto e usa sua própria URL/chaves locais.
- Variáveis são segregadas por ambiente; nenhum valor de produção está no `.env.example`, Preview, seed local ou bundle do navegador.
- O roteamento local mantém `admin.localhost`/`painel.localhost`; o Preview usa um hostname com prefixos; a futura produção pode usar subdomínios. Nenhuma dessas escolhas transforma Proxy/cookie em mecanismo de autorização.
- A branch `preview` usa somente o projeto de demo. `master` está reservada como Production Branch, sem projeto Supabase ou variáveis Production nesta etapa.
- Somente a branch `preview` recebe variáveis de conexão Supabase no ambiente Preview; outras branches não recebem valores Production nem do banco compartilhado de demo.
- Migrações não são executadas como efeito colateral de build/boot do Next.
- Functions remotas ficam em `gru1` enquanto os bancos primários estiverem em São Paulo.
- Express, Web Push e `APP_SERVER_KEY` não entram no Tavvi-app inicial.
- O inventário do preset no `__BASE.MD` foi corrigido para refletir os arquivos reais do boilerplate.
- O Preview demo usa o hostname/alias da branch `preview`; a URL Production gerada automaticamente, se existir como placeholder, não é compartilhada nem considerada lançamento.

## Riscos e limitações

- “Centenas/milhares simultâneos” ainda não define volume de leituras/escritas por segundo, conexões Realtime, tráfego de mídia ou SLOs. A base permite escalar, mas não representa uma garantia de capacidade. Registrar esses parâmetros antes de afirmar capacidade de produção.
- Um banco demo compartilhado por vários previews pode sofrer interferência de dados e schema; apenas a branch estável deve promover migrações para esse banco.
- `getUser()` adiciona round-trip ao Auth. A escolha de `getClaims()` depende da configuração de assinatura do projeto; Claims verificam identidade, mas não substituem RLS nem autorização por domínio.
- Vercel Hobby é voltado ao uso pessoal/não comercial; o limite de uso e o plano precisam ser reavaliados antes de qualquer operação comercial.
- A Vercel pode criar um deployment inicial Production a partir da branch default preview. Manter esse deployment protegido e sem variáveis de banco enquanto se configura master como branch Production. Se a Vercel exigir que master exista, interromper a integração Git sem criar a branch nesta fase.

## Pontos deixados para a decisão de implementação

- Escolher a ferramenta/provedor de observabilidade e seus limites de retenção quando o projeto Vercel/Supabase estiver conectado.
- Definir orçamento, alertas e metas p95/p99 para Preview e produção antes do primeiro lançamento comercial.
- Escolher o mecanismo de CI/approval para aplicar migrações remotas sem executar SQL destrutivo automaticamente.
- Configurar a allowlist de Auth para hosts de Preview efetivamente usados, sem wildcard amplo em produção.
O repositório GitHub privado e o nome ZamaiZ/tavvi-app já foram confirmados. A criação do projeto Vercel e a possibilidade de configurar master como Production Branch sem a branch existir ainda precisam ser verificadas no dashboard.
- Definir proteção de branch e revisão para master quando essa branch for criada na etapa Production.

## Referências operacionais

- Vercel Git integration, Production Branch e Preview branches: https://vercel.com/docs/git
- Variáveis de ambiente Preview específicas por branch: https://vercel.com/docs/environment-variables
- Supabase CLI e desenvolvimento local: https://supabase.com/docs/guides/local-development/cli/getting-started
- Supabase Auth local e redirects: https://supabase.com/docs/guides/local-development/cli/config
- Vercel Functions e regiões: https://vercel.com/docs/functions/configuring-functions/region
- Vercel Deployment Protection e exceções de acesso: https://vercel.com/docs/deployment-protection
- Proteção de todos os deployments no plano Hobby: https://vercel.com/changelog/protect-production-deployments-for-free-on-every-plan


