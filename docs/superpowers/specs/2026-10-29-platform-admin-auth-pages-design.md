# Tavvi Admin — autenticação inicial

**Estado:** implementado em tavvi-app; validação end-to-end local pendente  
**Data:** 2026-10-29  
**Projeto:** tavvi-app  
**Abrange:** login da conta Admin única e criação inicial dessa conta

## Intenção

Entregar a entrada do território Admin da plataforma, com login e criação inicial em rotas separadas. O cadastro fica disponível enquanto não existir associação em platform_admins; depois disso, a rota permanece acessível, informa que a conta Admin já foi criada e não oferece outro formulário.

O fluxo usa Next.js e Supabase Auth, mantendo a sessão do Admin separada da sessão do Painel. Não inclui o cadastro de clientes/restaurantes, que seguirá pelo convite do Painel.

## Objetivos

- Permitir que o responsável crie a primeira conta Admin no projeto Supabase de cada ambiente.
- Permitir que essa conta entre com email e senha.
- Impedir que uma conta Auth sem associação de Admin acesse o território Admin.
- Apresentar o fluxo em português brasileiro, com validação acessível e estados de carregamento e erro claros.
- Reaproveitar a marca Tavvi do legado sem trazer CSS ou configuração visual antiga.
- Compor os componentes shadcn existentes sem modificar os arquivos de componentes.

## Fora de escopo

- Login/cadastro do Painel, resgate de convite, equipe, convites, gestão de restaurantes ou dashboard funcional.
- Recuperação de senha por email, confirmação de email, MFA, autenticação social ou Web Push.
- Criar ou alterar componentes em components/ui, tokens em app/globals.css, preset shadcn ou CSS personalizado.
- Alterar as políticas globais de criação de usuário do Supabase Auth, criar segredo de bootstrap ou usar service_role.
- Aplicar migration ou configurar projetos Supabase.

A rota após autenticar será apenas uma página protegida com estado “área Admin em preparação”, para que o fluxo tenha destino sem antecipar o dashboard.

## Rotas e navegação

As páginas são entrar e criar-conta. Os caminhos externos variam conforme o ambiente, enquanto os arquivos internos ficam em app/admin:

| Ambiente | Login | Cadastro |
|---|---|---|
| Local | admin.localhost:3000/entrar | admin.localhost:3000/criar-conta |
| Preview Vercel | <deployment>/admin/entrar | <deployment>/admin/criar-conta |
| Produção futura | admin.<domínio>/entrar | admin.<domínio>/criar-conta |

Local usa o rewrite de host já existente para acrescentar /admin; Preview usa o prefixo /admin. A entrada em produção pelo subdomínio Admin requer uma regra host-aware no Proxy antes de ligar o domínio. Essa regra não pode misturar Admin e Painel nem suas sessões.

Links entre login e cadastro devem preservar o formato externo corrente: caminhos curtos em subdomínio Admin e prefixo /admin em Preview. O parâmetro next, se fornecido, aceita somente caminho local permitido no território Admin; URLs absolutas, protocol-relative e destinos do Painel são recusados.

Após login ou criação, respeitar next quando válido. Sem next, redirecionar à raiz do território Admin: / em subdomínio Admin e /admin em Preview.

## Telas

### Entrar

- Email e senha, com rótulos visíveis, ícones nos grupos de entrada e controle acessível para revelar/ocultar senha.
- Validação no cliente para resposta imediata e revalidação no servidor.
- Estado pendente que impede submissão duplicada e comunica que o acesso está sendo verificado.
- Erros de campo junto ao respectivo controle; erros de autenticação ou serviço em mensagem global amigável.
- Link para o primeiro cadastro Admin. Com a vaga ocupada, a rota de cadastro mostra o estado encerrado, sem identificar a conta existente.
- Sem link de recuperação de senha nesta etapa.

### Criar conta

- Nome, email, senha de pelo menos 8 caracteres e confirmação de senha. Nome alimenta profiles.display_name pela metadata Auth, conforme o trigger da migration.
- Antes de renderizar o formulário, consultar admin_registration_open(). Se retornar false, apresentar estado encerrado e link para entrar; a resposta não revela email, ID ou dados do Admin. Se a verificação falhar, não renderizar o formulário e mostrar estado de indisponibilidade com opção de tentar novamente.
- No envio, validar campos no servidor, criar identidade Auth sem confirmação de email e executar claim_platform_admin() em sessão autenticada.
- Se o claim retornar false por concorrência, encerrar a sessão Admin recém-criada e apresentar cadastro encerrado. A identidade Auth perdedora não recebe papel Admin.
- Se o signup Auth funcionar, mas a RPC falhar por erro transitório, preservar a sessão e oferecer ação para repetir somente o claim. A RPC é idempotente para o mesmo usuário; não reenviar o signup. Se a pessoa recarregar com essa sessão, mostrar estado de retomada enquanto a vaga estiver aberta.
- Se Auth não devolver uma sessão — por exemplo, porque confirmação de email foi ligada por engano — não tentar o claim e mostrar orientação compreensível.
- A resposta da leitura pode ficar obsoleta entre renderização e envio; a RPC e a restrição singleton são a decisão final.

## Identidade visual e interação

- Estrutura inspirada na autenticação do Tavvi legado: área de marca e formulário em telas largas; composição empilhada em telas estreitas.
- Copiar somente os lockups necessários do legado para public/brand. As variantes gold-on-dark e gold-on-light são aceitas provisoriamente. Não copiar folhas CSS, fontes ou configuração de tema do legado.
- Usar os componentes disponíveis em components/ui — incluindo Card, Field, Input, InputGroup, Button, Alert, Spinner e Toast — de acordo com suas APIs atuais. Não editar a implementação desses componentes.
- Usar ícones de react-icons/lu, já existente no projeto; não adicionar dependência.
- Preservar tokens e temas atuais. Compor layout com os componentes existentes e utilities Tailwind, sem CSS personalizado.
- Usar Motion em transições discretas de entrada e estado; não atrasar o uso do formulário nem animar individualmente cada campo. Respeitar a preferência de movimento reduzido.
- Definir idioma do documento como pt-BR. Rótulos e mensagens permanecem legíveis e associados aos campos em telas móveis.

## Validação e mensagens

- Zod define regras de formato e comprimento. Validar no cliente e repetir a validação na Server Action.
- Erros de campo aparecem com FieldError e estado inválido associado ao controle.
- Erros globais usam o Toast existente e também mensagem persistente na página quando exigem ação; toast nunca é a única comunicação do erro.

| Estado | Mensagem proposta |
|---|---|
| Credenciais inválidas ou usuário sem papel Admin | Email ou senha inválidos. Confira os dados e tente novamente. |
| Limite de tentativas | Muitas tentativas. Aguarde alguns minutos e tente novamente. |
| Cadastro já ocupado | O cadastro inicial do Admin já foi concluído. |
| Email não disponível para cadastro | Não foi possível criar a conta com esses dados. Se você já possui acesso, tente entrar. |
| Claim temporariamente indisponível | Sua conta foi criada, mas a ativação não terminou. Tente concluir novamente. |
| Auth não iniciou sessão | Não foi possível concluir o acesso agora. Verifique a configuração do ambiente ou fale com o responsável. |
| Falha de rede/serviço | Não conseguimos conectar ao serviço agora. Verifique sua conexão e tente novamente. |
| Falha inesperada | Não foi possível processar sua solicitação. Tente novamente. |

- Credenciais inválidas e conta sem papel Admin recebem mensagem genérica, sem confirmar se um email possui conta.
- Limite de tentativas, indisponibilidade/rede, cadastro encerrado e falha inesperada recebem mensagens distintas, sem expor mensagem técnica ou segredo Supabase.
- Não registrar senha, token ou cookies em logs.

## Segurança, sessão e latência

- Criar o cliente Supabase server-side com createSupabaseServerClient("admin"), usando tavvi-admin-auth-token. Nunca ler, sobrescrever ou compartilhar tavvi-panel-auth-token.
- Autenticar com Supabase Auth. Após signInWithPassword, verificar a associação com is_platform_admin(); se retornar false, encerrar a sessão Admin e retornar erro genérico. Se a RPC falhar, não autorizar nem redirecionar; retornar erro de serviço para nova tentativa.
- Após cadastro, chamar claim_platform_admin() sem aceitar identificador ou papel do cliente. A RPC usa auth.uid() e o banco impõe unicidade.
- Proxy pode renovar sessão via getClaims(), mas não decide autorização Admin. Página/ação protegida deve verificar autorização no servidor ou contar com RLS; não confiar em interface, metadata Auth, cookie de contexto ou Proxy como autorização.
- Não persistir tokens, email ou papel em localStorage. Não usar cliente privilegiado, Express ou service_role.
- Consultar admin_registration_open() somente no fluxo de cadastro: ao renderizar e novamente antes do signup; o login não consulta esse estado.
- Não introduzir consultas de restaurante ou membership. O cadastro exige Auth signup mais RPC de claim; o login exige Auth sign-in mais verificação da associação.
- A migration de identidade deve estar aplicada no banco antes do uso das páginas. Confirmação de email permanece desligada.

## Risco do primeiro cadastro

Enquanto a vaga Admin estiver aberta, qualquer pessoa que consiga criar usuário Auth e chamar a RPC pode tentar reivindicá-la. O fluxo não prova a identidade do responsável. Criar a conta responsável em cada ambiente antes de divulgar ou liberar a URL; proteger Preview até esse passo. A proteção é operacional, sem gate ou segredo adicional no app. Não adicionar uma credencial secreta de bootstrap nesta etapa.

## Estrutura proposta

- app/admin/(auth)/layout.tsx: shell compartilhado de autenticação.
- app/admin/(auth)/entrar/page.tsx: login e redirecionamento de sessão existente.
- app/admin/(auth)/criar-conta/page.tsx: disponibilidade da vaga e estado aberto/encerrado.
- app/admin/(auth)/actions.ts: Server Actions, validação e conversão de erros em estados de interface.
- features/admin/auth/components/admin-auth-shell.tsx: composição visual responsiva e wrappers Motion.
- features/admin/auth/components/admin-login-form.tsx: formulário de login e feedback.
- features/admin/auth/components/admin-registration-form.tsx: formulário de cadastro inicial.
- features/admin/auth/components/password-input.tsx: composição local de InputGroup para ícone e revelação, sem alterar o componente shadcn.
- app/admin/page.tsx: destino protegido provisório, sem dashboard.
- features/admin/auth/*: schemas, resultados tipados e helpers server-only, seguindo a convenção de domínio da arquitetura recomendada.
- app/layout.tsx: idioma pt-BR e montagem do Toaster existente, se ainda não estiver montado.
- proxy.ts: regra host-aware para produção futura se o domínio Admin for encaminhado por subdomínio nesta etapa.
- public/brand/*: cópia apenas dos lockups usados.
- __BASE.MD: resumo canônico das decisões e links para spec e plan.

Os nomes de arquivo são a direção desta proposta. Uma adaptação de diretório é aceitável se houver convenção existente no app, sem alterar o comportamento.

## Pré-condições e critérios de aceitação

- Migration de identidade aplicada ao banco Local/Preview utilizado.
- Confirmação de email desligada.
- Com vaga aberta, cadastro válido cria usuário, perfil, associação Admin única e sessão Admin.
- Com vaga ocupada, criar-conta mostra estado encerrado sem formulário; login permanece disponível.
- Login Admin funciona; conta Auth sem papel Admin não entra no território.
- Links e destinos funcionam no host local e no caminho Preview sem incluir ID de restaurante.
- Teclado e leitores de tela conseguem identificar campos, erros e controles de senha; erros globais têm texto além do Toast.
- A interface compõe os componentes shadcn existentes, Motion e Tailwind, sem mudanças em componentes, tokens ou CSS.
- Nenhuma página de convite, restaurante ou dashboard funcional entra nesta etapa.

## Referências

- Migration: supabase/migrations/20261029000000_platform_admin_identity.sql.
- Spec da migration: docs/superpowers/specs/2026-10-29-platform-admin-identity-design.md.
- Regras canônicas: __BASE.MD.
- Next.js Authentication: https://nextjs.org/docs/app/guides/authentication.
- Next.js Server Actions: https://nextjs.org/docs/app/guides/server-actions.
- Supabase SSR Auth: https://supabase.com/docs/guides/auth/server-side/advanced-guide.
- Motion: https://motion.dev/docs/react; AnimatePresence: https://motion.dev/docs/react-animate-presence; movimento reduzido: https://motion.dev/docs/react-accessibility.
- shadcn Field: https://ui.shadcn.com/docs/components/aria/field.
