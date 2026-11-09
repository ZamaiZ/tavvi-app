# Busca pública de restaurantes — Especificação de design

## Objetivo

Adicionar à home `/` uma busca de restaurantes que ajude visitantes a encontrar e abrir a apresentação pública já existente em `/{slug}`. A lista inclui todo restaurante cadastrado com `status = active`, mesmo que o cardápio continue em construção.

## Público e contexto

O visitante pode chegar sem QR Code ou NFC e encontrar o restaurante pelo nome, pelo segmento/cozinha ou pela localização. Ao abrir o campo, ele deve ver restaurantes ativos; ao digitar, a lista deve filtrar sem recarregar a página. A busca atende pessoas com mouse, toque e teclado.

## Regras de elegibilidade e navegação

- A elegibilidade é exclusivamente `restaurants.status = 'active'`; não verificar publicação de cardápio.
- Restaurantes `draft`, `suspended` ou removidos nunca aparecem na busca.
- Slugs reservados `admin` e `painel` não aparecem: a rota pública existente os rejeita e as rotas estáticas têm precedência.
- Selecionar um resultado navega para `/{slug}` usando a página pública já existente. Ela continua sendo responsável por validar o estado atual do restaurante e mostrar “Cardápio em construção” quando aplicável.
- A busca fica isolada na home. O perfil público, onboarding, Admin, Painel, slugs e conteúdo de cardápio permanecem fora de escopo.

## Dados e consulta

- O modelo existente oferece `slug`, `name`, `segment`, `logo_path` e endereço em `contact.address`. Segmento, logo e endereço podem estar ausentes.
- `segment` contém cozinhas e outros segmentos comerciais; mostrar o valor salvo sem reclassificação ou texto inventado.
- Criar uma RPC pública estreita, executada por `anon`, que filtre apenas restaurantes ativos e retorne somente `slug`, `name`, `segment`, um indicador booleano de logo e o endereço permitido. Não retornar telefone, descrição, contatos, tema, capa ou o caminho do Storage.
- Não conceder `SELECT` anônimo na tabela `restaurants`, não reutilizar a RPC de Admin e não usar service role.
- A RPC aceita texto de pesquisa com no máximo 120 caracteres, normaliza caixa e acentos e faz correspondência parcial em nome, segmento e campos de endereço (rua, número, complemento, bairro, cidade, UF e CEP). Caracteres de pesquisa não podem ser interpretados como curingas SQL.
- Ordenar resultados por nome normalizado e slug. Usar lotes de 20 resultados e informar se há próxima página.
- Um Route Handler GET `/api/public/restaurants` valida `q` e `page`, consulta a RPC com o cliente Supabase público server-only e retorna DTO validado. Respostas são dinâmicas e não persistidas em cache. Erros não expõem mensagens do Supabase.
- O caminho de imagem nunca é enviado ao navegador. Quando houver logo, usar a rota de mídia existente `/{slug}/media/logo`; imagens carregam sob demanda e falhas usam uma inicial do nome.

## Interação

- A home continua Server Component. A busca é um Client Component isolado, carregado dentro da composição atual, sem levar a página toda para o cliente.
- Clique ou foco no campo abre a lista inicial de restaurantes ativos.
- Digitação agenda uma consulta após debounce de 250 ms; mudanças de busca descartam respostas antigas e não permitem escolher resultados de uma consulta anterior.
- Se houver mais resultados, um controle acessível “Ver mais restaurantes” busca o próximo lote.
- `Enter` escolhe o item ativo, setas movem a seleção e `Escape` fecha a lista. O campo e as opções preservam foco visível e nomes acessíveis.
- Estados: fechado, carregando lista inicial, lista inicial, filtrando, resultados, nenhuma correspondência, lista sem restaurantes, erro com tentativa novamente e navegação após seleção.
- Selecionar fecha a lista e navega para a slug escolhida. A navegação preserva o comportamento normal de voltar do navegador.

## Conteúdo dos resultados

Cada opção mostra somente:

1. Logo do restaurante (ou inicial de fallback).
2. Nome.
3. Segmento/cozinha, se preenchido.
4. Endereço compacto, se preenchido: rua/número e complemento quando disponíveis, bairro e cidade/UF; omitir CEP da linha visual.

Não mostrar selo de status, descrição, telefone, redes sociais, distância, avaliação, horários, número de pratos ou estado de publicação.

## Direção visual e movimento

- Manter palavra-marca, alternância de tema e atmosfera já existentes. O campo passa a ser a ação principal da home, logo abaixo do texto introdutório.
- Campo largo, com ícone de busca, alvo de toque de pelo menos 44 px e texto de apoio que menciona restaurante, cozinha e endereço.
- Usar popover alinhado à largura do campo, responsivo, com superfície e borda coerentes com os tokens claro/escuro existentes; o popover usa portal para não ser cortado pelo contêiner da home.
- Cada resultado é uma linha horizontal com logo quadrado de 48 px, nome com hierarquia principal e duas linhas secundárias com ícones sutis de utensílios e localização. A linha inteira é selecionável, tem realce de hover/foco e altura confortável para toque.
- A lista tem altura limitada e rolagem interna; o endereço comprido é truncado visualmente sem ser removido do nome acessível da opção.
- Abertura da lista e realce de linha usam transições curtas; resultados atualizados não pulam de altura. `prefers-reduced-motion` remove movimento não essencial.
- A busca permanece usável em tema claro/escuro e em larguras móveis, sem rolagem horizontal.
- Não adicionar dependências.

## Fora de escopo

- Publicar, editar ou consultar pratos, categorias, preços ou disponibilidade de cardápio.
- Alterar a apresentação de `/{slug}` ou permitir acesso a restaurantes não ativos.
- Filtros avançados, localização geográfica, distância, mapas, avaliação, favoritos e recomendações.
- Modificar modelo de onboarding para tornar logo, segmento ou endereço obrigatórios.
- Novas dependências ou testes automatizados.

## Critérios de aceite

- Focar ou clicar no campo carrega restaurantes ativos mesmo sem cardápio publicado.
- A busca encontra correspondências parciais sem diferenciar caixa ou acentos em nome, segmento e endereço.
- `draft`, `suspended`, registros removidos e slugs reservados não são retornados; o contrato do endpoint contém apenas os dados públicos especificados.
- O visitante pode percorrer todas as páginas de resultados e selecionar uma opção por toque, mouse ou teclado.
- Uma seleção navega para a slug pública correspondente; perfis não ativos continuam recebendo a 404 já definida pela rota.
- Logo ausente ou com falha usa inicial; segmento e endereço ausentes não quebram nem poluem a linha.
- Estados de carregamento, vazio, sem correspondência, erro e navegação são claros e não expõem dados técnicos.
- A busca preserva o tema, layout e conteúdo não relacionado da home, funciona em mobile/desktop e respeita movimento reduzido.
- Nenhuma leitura anônima da tabela, chave de serviço ou caminho arbitrário de Storage é introduzido.

## Restrição de execução

As instruções do projeto proíbem `git`, `typecheck`, `build`, `lint` e `test`, e não permitem adicionar testes. A implementação será revisada estaticamente sem executar esses comandos.
