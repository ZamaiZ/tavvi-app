# Painel de restaurante: acesso e ativação — Design

## Objetivo

Levar o restaurante recém-criado pelo convite de `draft` até `active` com o mínimo de etapas. A conta criada no aceite do convite também autentica o dono no painel; depois de confirmar o convite, ele segue direto para o wizard, sem uma segunda tela de login.

## Por que

O `tavvi-app` já cria contas e restaurantes a partir de convites, mas a aceitação termina num aviso de sucesso. O restaurante só armazena nome, slug e status, e ainda não existe uma área de painel do restaurante. O projeto `tavvi` existente define os dados de identidade e contato que a futura página pública em `/{slug}` precisará.

## Experiência

### Acesso

- Criar `/painel/entrar` com o mesmo layout, composição, animação, marca, campos com ícones e hierarquia visual de `/admin/entrar`.
- Reusar a estrutura visual de autenticação compartilhada, sem reutilizar a autorização de plataforma: o login do painel autentica com a superfície/cookie `panel` e valida uma membership de restaurante.
- Após aceitar o convite e criar a conta com email e senha, aproveitar a sessão criada e navegar direto para o wizard do restaurante recém-criado. O usuário não redigita as credenciais.
- Em sessão existente, aceitar o convite e abrir o wizard do novo restaurante `draft`.
- `/painel/criar-conta` não registra uma conta sem convite. Mostra uma mensagem curta, premium e animada com ícone, explica que o acesso é por convite e orienta a pessoa a contatar o comercial para receber um. Não exibe número de telefone nem inventa um canal/endereço de contato.
- Login após autenticação: restaurante `draft` segue para o wizard; `active` segue para o template vazio de Cardápio; `suspended` recebe uma mensagem de acesso indisponível.

### Wizard de restaurante em `draft`

- O painel mostra somente um wizard com os steps **Identidade** e **Contato**. Não exibe a navegação das demais áreas enquanto o restaurante estiver em `draft`.
- O stepper tem hierarquia visual clara e transição animada entre passos; respeita `prefers-reduced-motion`/a configuração de movimento reduzido já usada no app.
- **Identidade:** nome e slug criados pelo convite (slug é só leitura), tipo/segmento do restaurante em combobox, apresentação de cardápio (`immersive`, `catalog-list`, `catalog-grid`), tema entre os oito presets de Tavvi (`brasa`, `forno`, `grao`, `sal`, `horta`, `neon`, `nori`, `confeito`), cores de fundo/destaque e densidade (`confortavel`, `compacto`). Permitir logo e capa opcionais para preparar a identidade pública.
- **Contato:** nome público, descrição, telefone do restaurante, WhatsApp, Instagram, endereço estruturado (CEP, rua, número, complemento, bairro, cidade e UF) e link do Google Maps opcionais. Telefone comercial da Tavvi não aparece nesta tela.
- Inputs usam os componentes existentes do app, ícones contextuais, rótulos e estados de erro acessíveis. Segmento e UF usam os comboboxes existentes. A identidade segue os presets, tokens e padrões visuais já presentes em `tavvi-app`.
- Cada mudança de campo/configuração agenda salvamento automático do rascunho após 2.500 ms sem novas mudanças. Mostrar estado acessível e discreto de salvamento/salvo/erro. Navegar de passo, atualizar ou tentar finalizar não pode descartar uma gravação pendente; a conclusão sempre envia o estado mais recente.
- Os dados de rascunho podem estar incompletos. Só o servidor decide se o rascunho continua válido para edição.
- **Finalizar** valida no cliente para feedback rápido e valida de novo no servidor; grava os últimos valores e muda `draft` para `active` na mesma operação atômica. Falhas não ativam o restaurante e preservam o rascunho.
- O nome/slug criados pelo convite e os valores padrão válidos de identidade bastam para ativar. Dados de contato, logo, capa e personalizações permanecem opcionais, seguindo o modelo atual de `tavvi`; campos preenchidos devem ser validados. Um restaurante recém-aceito abre direto, mesmo que a conta já tenha outras memberships.
- Ao finalizar, abrir `/painel/restaurantes/{id}/cardapio`: uma página interna vazia, somente com o template visual e a identificação do restaurante, preparada para a próxima etapa do produto.
- No login, uma membership leva direto ao destino daquele restaurante. Se houver mais de uma membership, mostrar uma lista simples para a pessoa escolher, sem abrir por conta própria um restaurante ativo enquanto outro `draft` aguarda configuração.

## Dados para o futuro cardápio público

Persistir os campos necessários para apresentar uma página inicial pública em `/{slug}`: slug/endereço, nome, descrição, segmento, logo/capa quando enviados, preset e cores do tema, densidade e apresentação, canais de contato e endereço/Maps. A montagem da página pública e do catálogo não pertence a esta entrega. Produtos, categorias e preços podem continuar pendentes; não bloquearão a ativação.

## Persistência e autorização

- Criar migration aditiva sobre o schema de `tavvi-app`; não importar a baseline legada de `tavvi` nem alterar dados fora do schema deste app.
- Estender o registro de restaurante com campos de identidade/contato e defaults compatíveis com os dados existentes. Manter `status` como `draft` ao resgatar convite.
- Usar RPCs transacionais autorizadas pelo `auth.uid()` e membership ativa no restaurante. A gravação de rascunho só pode alterar campos de onboarding enquanto status for `draft`; o navegador não pode elevar status. A operação de conclusão deve verificar os dados e trocar o status para `active` atomicamente.
- Proteger o upload de logo/capa por membership do restaurante, caminhos limitados ao ID do restaurante, validação de tipo/tamanho e URLs adequadas para futura exibição pública. Erros de upload não podem fingir que a imagem foi salva.
- Ler o restaurante do usuário sob sessão `panel`, validar os retornos da RPC e tratar indisponibilidade sem conceder acesso.
- As sessões `admin` e `panel` continuam separadas.

## Fora de escopo

- Construir ou estilizar a página pública `/{slug}` nesta entrega.
- Criar, editar ou publicar categorias, produtos, preços e catálogo.
- Criar pedido, pagamentos, relatórios, equipe, convites de equipe ou qualquer outro módulo do painel.
- Permitir cadastro livre sem convite.
- Adicionar telefone ou contato Tavvi/comercial não fornecido.

## Restrições

- Manter os componentes e o padrão visual existente de `tavvi-app`; evitar instalar dependências.
- Respeitar Next.js 16 e consultar a documentação local aplicável antes de implementar código Next.
- Não executar Git, `typecheck`, `build`, `lint` ou `test`; não adicionar testes. Revisar as alterações por inspeção estática.
- Não implementar a página inicial pública do cardápio.

## Decisões deixadas à implementação

- A organização exata de rotas do wizard e do template vazio, desde que preservem as rotas citadas no fluxo e protejam os restaurantes por ID/membership.
- O formato interno de armazenamento de tema, contato e referências de mídia, desde que retenha os campos e valores definidos acima e permita uma leitura futura para `/{slug}`.
- A forma de compartilhar a casca visual de autenticação, sem compartilhar a decisão de autorização Admin/Panel.
