# Acesso automático quando há um único restaurante

## Intenção

Ao abrir `/painel/restaurantes`, o usuário autenticado deve entrar diretamente no único restaurante ao qual tem acesso. A tela de escolha serve apenas quando há mais de um restaurante disponível.

## Comportamento

- A quantidade considerada é a lista já fornecida por `getPanelRestaurantsForCurrentUser()`: restaurantes associados ao usuário por membership ativa, com IDs únicos.
- Com **um restaurante**, iniciar a seleção automaticamente e navegar para o destino correspondente ao status atual: onboarding, cardápio ou suspenso.
- Com **mais de um**, manter a seleção explícita atual.
- Com **zero**, manter o estado vazio e a orientação de convite atual.
- Se a seleção automática falhar, informar a falha e permitir recuperação usando o acesso manual já disponível.

## Abordagem

Reutilizar `selectPanelRestaurantAction` no componente cliente `PanelRestaurantPicker`. A ação continua responsável por reconsultar a membership, gravar o cookie HttpOnly do restaurante ativo e devolver o destino confiável. O componente mostra um estado breve de abertura quando há um único item, dispara a ação uma vez e usa o tratamento de falha existente com recuperação manual.

O cookie não será gravado durante a renderização da página: no Next.js do projeto, a alteração de cookies deve ocorrer em Server Function ou Route Handler.

## Objetivos

- Eliminar o clique de seleção quando o usuário tem exatamente um restaurante disponível.
- Preservar validação de membership no servidor e roteamento por status.
- Deixar escolha manual somente para usuários com mais de um restaurante, salvo recuperação de falha.

## Fora de escopo

- Alterar login, convites, autenticação, memberships, banco de dados ou formato do cookie.
- Alterar a lista ou os destinos por status.
- Adicionar dependências ou cobertura automatizada.

## Restrições

- Alteração de produto limitada ao componente de seleção existente.
- Não adicionar nem executar testes, lint, typecheck ou build.
- Verificar os cenários por inspeção da implementação; execução manual fica para quando o ambiente estiver disponível.

## Decisões deixadas à implementação

- Usar o estado de transição existente para comunicar que o restaurante está abrindo.
- Evitar disparos duplicados durante a montagem do componente.
- Se a Server Action lançar erro de transporte, mostrar o mesmo feedback de falha e liberar a opção manual.
