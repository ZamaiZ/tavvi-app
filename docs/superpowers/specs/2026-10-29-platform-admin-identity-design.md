# Tavvi — Migration 0001: identidade e Admin único

**Estado:** proposta para revisão; ainda não implementada nem aplicada  
**Data:** 2026-10-29  
**Projeto:** tavvi-app  
**Arquivo previsto:** supabase/migrations/20261029000000_platform_admin_identity.sql

## Intenção

Criar a fundação de identidade necessária para que a aplicação Tavvi tenha uma única conta de administrador da plataforma por ambiente Supabase. O Admin inicial será cadastrado pela aplicação, sem confirmação de e-mail, e o banco será responsável por permitir no máximo uma associação ao papel de Admin.

Esta proposta substitui a decisão anterior de conceder o primeiro papel Admin manualmente por SQL. A conta será criada pelo Supabase Auth; a migration cria somente o perfil e a associação/controle de Admin.

## Decisões e invariantes

- Cada projeto Supabase — Local, Preview/Staging e, futuramente, Produção — tem no máximo um Admin da plataforma. Contas e associações não são compartilhadas entre ambientes.
- O cadastro inicial pela aplicação fica disponível enquanto não existir associação de Admin.
- Depois do cadastro, a página de criação informa que o Admin já foi criado e não mostra um formulário que permita cadastrar outro. O login continua disponível.
- O cadastro volta a ficar disponível se o usuário Auth que ocupa a vaga for removido. A remoção considerada é a exclusão do usuário no Supabase Auth, que remove a associação por cascata.
- A unicidade é do papel de Admin da plataforma, não da tabela global de usuários Auth. Fluxos futuros do Painel continuam podendo criar usuários, desde que a associação ao restaurante seja controlada pelo fluxo de convite.
- A confirmação de e-mail permanece desligada, conforme a decisão do produto.
- A primeira conta será criada pelo responsável antes de divulgar o endereço do ambiente. Sem confirmação de e-mail ou segredo de bootstrap, o banco não consegue provar que o primeiro solicitante é o responsável.
- Uma chamada concorrente não pode criar dois Admins. O banco aceita no máximo uma associação e informa ao perdedor que o cadastro já foi realizado.
- Nenhuma migration ou seed cria automaticamente um usuário Auth ou concede o papel de Admin.
- Migrations são a única fonte versionada de schema. Não criar schema.sql nem reaproveitar migrations do Tavvi legado.

## Escopo desta migration

### Perfil de Auth

Criar public.profiles com uma linha por usuário Auth:

- user_id como chave primária e referência a auth.users(id), com ON DELETE CASCADE.
- display_name para o nome de apresentação; o formulário futuro exige e valida o valor. A coluna pode permanecer nula para usuários criados por outros fluxos que ainda não tenham concluído seu perfil.
- created_at e updated_at em timestamptz, com valores padrão definidos no banco.

Criar trigger de auth.users para inserir o perfil ao criar usuário, lendo display_name da metadata de Auth. A metadata serve apenas para exibição; não concede papel nem autorização. A operação deve ser idempotente para não falhar se o perfil já existir. Criar também um trigger BEFORE UPDATE em profiles que atualiza updated_at pelo relógio do banco, sem aceitar que o cliente defina o timestamp.

### Associação única de Admin

Criar public.platform_admins com uma única vaga estrutural:

- Chave singleton booleana com valor verdadeiro e restrição que não permite outra vaga.
- user_id único e referenciando auth.users(id) com ON DELETE CASCADE.
- created_at em timestamptz.
- RLS habilitada.
- SELECT limitado ao próprio usuário autenticado.
- Nenhuma política de INSERT, UPDATE ou DELETE para anon/authenticated. A associação só muda pela função controlada ou por operação administrativa no Supabase.

A chave singleton mais a unicidade de user_id são a barreira final contra dois Admins, inclusive quando dois cadastros concorrem.

### Funções

Criar funções públicas com nomes e contratos definidos para esta etapa:

- is_platform_admin() retorna boolean para o usuário da sessão atual. É usada futuramente por políticas e autorização no banco.
- admin_registration_open() retorna somente se a vaga está livre. Pode ser executada por anon e authenticated para a página mostrar o formulário ou a mensagem de cadastro concluído. Não revela e-mail, ID ou dados do Admin.
- claim_platform_admin() não recebe parâmetros e usa auth.uid(). Só pode ser executada por authenticated. Retorna true quando o usuário da sessão ocupa a vaga; retorna false quando outro usuário já a ocupou. Repetir a chamada pela mesma conta é idempotente.

As funções que usam SECURITY DEFINER devem definir search_path vazio, qualificar os nomes de schema e tabelas e receber EXECUTE somente dos papéis necessários. A função de claim não aceita user_id informado pelo cliente.

## Segurança e limites de Auth

- RLS e grants são aplicados explicitamente; não depender da exposição automática de tabelas públicas.
- Leitura do perfil é restrita ao próprio usuário. Escrita fica restrita ao próprio display_name, sem permitir alteração do user_id ou dos timestamps pelo cliente.
- A tabela platform_admins não aceita gravação direta via Data API. A função de claim é o único caminho da aplicação para ocupar a vaga.
- Nenhum APP_SERVER_KEY, segredo VAPID ou chave service_role é necessário para esta migration. A conta Auth e o claim são operações distintas: a Auth cria o usuário e a RPC atribui o papel.
- O cadastro inicial deve ocorrer antes de disponibilizar o ambiente. Enquanto a vaga estiver livre, um usuário que consiga criar uma identidade Auth e chamar a RPC pode tentar reivindicá-la. Isso é uma limitação deliberada do fluxo sem confirmação de e-mail/segredo de bootstrap e é mitigada operacionalmente criando primeiro a conta responsável.
- Auth e Postgres não compartilham uma transação distribuída. Se o Admin for reivindicado entre a criação da identidade Auth e o claim, a segunda conta Auth fica sem papel Admin. Isso não concede acesso administrativo; a aplicação futura deve encerrar essa sessão e mostrar o estado de cadastro concluído.
- O estado da página pode ficar desatualizado entre leitura e submissão; claim_platform_admin() e a restrição singleton são a decisão autoritativa.

## Fora de escopo

- Páginas, layouts, Server Actions, login e formulário de criação.
- Convites, restaurantes, memberships, auditoria de ações administrativas e gestão de equipe; esses domínios entram em migrations posteriores.
- Desabilitar globalmente o signup do Supabase Auth. O fluxo futuro de convite do Painel também depende de Auth; controle de acesso ao restaurante não será inferido da existência de usuário Auth.
- Exclusão de Admin pela interface, troca de credenciais, recuperação de senha, MFA e transferência de Admin.
- Seeds e bootstrap SQL de uma pessoa específica.
- Execução de migration no remoto de Produção.
- Testes automatizados.

## Sequência de ambientes

1. Criar e revisar a migration no repositório.
2. Aplicar a cadeia em Supabase local e inspecionar tabelas, restrições, funções, grants e políticas.
3. Depois da revisão local, aplicar a mesma migration ao projeto vazio de Preview/Staging em São Paulo, conferindo o project ref antes da operação.
4. Produção terá um projeto separado e receberá a mesma cadeia somente quando esse ambiente for iniciado.

## Referências técnicas

- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions) — privilégios, SECURITY DEFINER e search_path.
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — RLS e grants.
- A migration pertence ao tavvi-app; a baseline e o bootstrap SQL do Tavvi legado não são fonte de schema para este projeto.


