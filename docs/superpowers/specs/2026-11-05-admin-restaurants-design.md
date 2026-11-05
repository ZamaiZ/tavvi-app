# Admin — Restaurantes

## Intenção

Criar uma página administrativa para consultar restaurantes e controlar sua suspensão, com a mesma linguagem de interface, componentes shadcn, movimento e tratamento de estados da página de Convites do `tavvi-app`. A página deve ser responsiva e segura, mantendo o fluxo do Painel como autoridade para completar a criação e ativar um restaurante.

## Objetivos

- Adicionar a rota de restaurantes ao shell autenticado e ativar o item correspondente no sidebar.
- Listar registros reais e permitir pesquisa e filtro por situação.
- Mostrar as situações persistidas `draft`, `active` e `suspended` com contagens derivadas dos dados.
- Permitir suspender um restaurante em rascunho ou ativo e restaurá-lo para a situação anterior.
- Permitir editar o slug com validação e tratamento de conflito.
- Reutilizar padrões shadcn, `motion/react`, acessibilidade e movimento reduzido já adotados pelos Convites.
- Manter listagem e detalhes utilizáveis em desktop e celular.

## Regras do produto

- Restaurante novo é criado pelo resgate de convite em situação `draft`.
- Ativação não é feita nesta página: acontece no fluxo de criação/configuração do Painel, que será tratado depois.
- A administração de restaurantes não oferece remoção.
- Suspender é permitido tanto para `draft` quanto para `active`.
- Ao restaurar um restaurante suspenso, ele volta à situação anterior à suspensão (`draft` ou `active`). Suspender um rascunho nunca o ativa.
- Suspensão controla a situação/publicação do restaurante; não remove integrantes nem revoga o acesso administrativo ao Painel. Quando o cardápio público for implementado, somente restaurantes `active` poderão ser exibidos.
- `draft` continua visível na lista e nas contagens, apesar de não ser uma ação de situação desta página.

## Escopo funcional

### Lista

- Rota local `/admin/restaurantes`, respeitando `publicBasePath` e os helpers de navegação existentes nos domínios de Admin.
- Resumo dos estados `active`, `draft` e `suspended`, baseado em dados reais.
- Pesquisa por nome e slug; não pesquisar por segmento, pois essa coluna não existe no schema atual do `tavvi-app`.
- Filtro `Todos`, `Ativos`, `Rascunhos` e `Suspensos`, sincronizado com a URL e com os cartões de resumo, no padrão dos Convites.
- Tabela acessível no desktop e cartões de restaurante no celular. Selecionar uma linha/cartão abre detalhes.
- Estado vazio global distinto de busca sem resultados, estado de falha recuperável e skeleton inicial; erro nunca aparece como lista vazia.

### Detalhes e ações

- Sheet shadcn compartilhado entre desktop e celular, com largura total no viewport estreito e largura limitada no desktop.
- Identidade por nome/iniciais, slug atual, badge da situação e datas de criação/atualização.
- Campo para editar slug. Validar no cliente e novamente no servidor/banco com 1–80 caracteres e o formato `^[a-z0-9]+(-[a-z0-9]+)*$`; preservar o valor atual em conflitos e retornar mensagem de erro segura.
- Ação de suspender para restaurantes `draft` e `active`, com confirmação e estado pendente.
- Restaurar sem confirmação extra, voltando ao estado preservado antes da suspensão; apresentar progresso e feedback de sucesso/erro.
- Nenhuma ação de ativar, criar, remover, abrir cardápio ou copiar link público nesta página.

## Movimento e estados visuais

- Aplicar `MotionConfig reducedMotion="user"` e `useReducedMotion`, seguindo a página de Convites.
- Entrada breve e escalonada de cabeçalho, resumo e conteúdo; hover e press sutis nos cartões, linhas e botões.
- Sheet com entrada/saída coerente com os outros painéis; transição curta de conteúdo entre leitura/edição e feedback de ação.
- Indicador discreto durante navegação/consulta, mantendo os dados anteriores estáveis quando aplicável.
- Ação pendente desabilita controles conflitantes. Atualizar a interface apenas após retorno confirmado do servidor.
- Evitar animação de layout, saltos de conteúdo e escalas fortes. Reduzir ou remover movimento para `prefers-reduced-motion`.
- Usar status textual além de cor/ícone, foco visível, labels e regiões `aria-live` para operações assíncronas.

## Arquitetura e segurança

- Server Component protegido carrega a consulta inicial. Como o detalhe usa os mesmos campos já presentes na linha da lista, o Sheet recebe o DTO da linha selecionada sem uma segunda consulta.
- Componentes Client isolados cuidam de busca/filtros, Sheet, animação e estado de interação; usar DTOs estreitos em vez de retornar linhas cruas do banco.
- Toda leitura e ação exige Admin no servidor. A sessão usa o client Supabase autenticado de Admin; nunca expor service-role nem confiar no estado da interface.
- Criar Server Actions finas com validação Zod e uma migração versionada para as operações que hoje não existem.
- RPCs de mutação verificam `is_platform_admin()` no banco, fazem a transição de situação de modo atômico, escrevem `audit_log` na mesma transação e retornam resultados discriminados seguros.
- Adicionar `status_before_suspension` restrito a `draft`/`active`, preenchido ao suspender e limpo ao restaurar. Se houver linha suspensa anterior sem esse valor, restaurá-la para `draft` como padrão seguro contra ativação acidental.
- Editar slug por operação protegida, validando formato e unicidade no banco e registrando auditoria.
- Revalidar somente os caminhos/recursos de Admin afetados após sucesso.

## Diferenças deliberadas da página legada

- Não copiar o CSS `tv-*`; compor com os componentes shadcn e tokens visuais do `tavvi-app`.
- O schema atual não tem `segment`, `deleted_at` nem consulta administrativa segura para exibir nome/e-mail de responsáveis; esses dados não entram na interface desta etapa.
- A rota de cardápio público e sua configuração de domínio não existem no app atual; não exibir links públicos que não possam funcionar.
- Não importar as ações de remoção da referência.

## Fora de escopo

- Fluxo do Painel para terminar o cadastro e mudar `draft` para `active`.
- Criação de restaurante por Admin, exclusão/remoção e restauração de removidos.
- Alterações em autenticação ou nas ações de Convites.
- Rota de cardápio público, links públicos e responsáveis/equipe.
- Testes e execução de `git`, `typecheck`, `build` ou `lint`, conforme `AGENTS.md`.

## Critérios de aceite

1. Admin autorizado acessa a lista no caminho correto em host Admin e em ambiente com prefixo `/admin`.
2. Pesquisa, filtro, resumo e paginação/consulta usam somente restaurantes persistidos; estados de carregamento, erro e vazio são distintos e úteis.
3. `draft`, `active` e `suspended` são exibidos com labels compreensíveis e contagens consistentes.
4. Esta página não pode ativar, criar ou remover um restaurante.
5. Suspender um restaurante em `draft` ou `active` preserva sua situação anterior; restaurá-lo recupera exatamente essa situação.
6. Slug duplicado ou inválido não altera o restaurante e produz feedback compreensível.
7. Suspensão não remove memberships nem bloqueia o login/acesso administrativo ao Painel.
8. Cada leitura e mutação é autorizada no servidor e no banco; mutações auditadas não deixam estado parcial.
9. Desktop e celular oferecem lista e detalhes operáveis por toque e teclado, com movimento reduzido respeitado.
