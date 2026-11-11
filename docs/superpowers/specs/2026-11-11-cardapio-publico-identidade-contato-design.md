# Cardápio público, identidade e contato — Design

## Intenção

Levar ao `tavvi-app` o fluxo de entrada e navegação lateral visto no Tav original, preservando a identidade visual e as convenções do app atual. O restaurante terá duas apresentações públicas, escolhidas na Identidade tanto durante a criação quanto na edição: **Imersivo** e **Padrão**. As páginas de Identidade e Contato também serão acessíveis como áreas permanentes do painel.

## Por que

Hoje o perfil do restaurante e o cardápio aparecem em uma única página vertical. Os valores persistidos ainda são `immersive`, `catalog-list` e `catalog-grid`; o modo chamado de imersivo ainda usa cartões em uma página de catálogo. O painel, por sua vez, só oferece Cardápio depois da conclusão do onboarding. Os formulários de identidade e contato existentes pertencem ao fluxo de rascunho e suas gravações recusam restaurantes ativos.

O Tav original demonstra o fluxo de boas-vindas seguido por uma segunda área de catálogo e também tem um feed imersivo de pratos. O `tavvi-app` usa outra base visual; reaproveitaremos os comportamentos e adaptaremos a implementação aos tokens, componentes shadcn/Base UI, Lucide, CSS Modules e Motion já presentes no app.

## Objetivos

- Oferecer somente **Imersivo** e **Padrão**, com esses nomes visíveis na criação e na edição.
- Abrir o menu público em uma apresentação sequencial de boas-vindas, seguida por navegação lateral para o cardápio.
- Em **Padrão**, manter as categorias em sequência vertical e mostrar os produtos de cada categoria em um trilho horizontal, com um cartão grande por vez e todos os dados do item.
- Em **Imersivo**, mostrar a capa e depois um item por tela, com a imagem ocupando a tela e os dados do prato integrados à composição.
- No Imersivo, itens sem mídia continuam no feed com uma composição de fundo baseada na identidade visual e os dados do item; nenhum item publicado é omitido.
- Se o conteúdo de um item Imersivo ultrapassar a altura disponível, o próprio slide permite rolagem vertical enquanto a navegação entre slides continua horizontal.
- Manter as animações sequenciais já usadas na apresentação do restaurante e criar uma sequência coerente para categorias e itens, sem atrasar interação e respeitando `prefers-reduced-motion`.
- Criar páginas permanentes de Identidade e Contato dentro do shell atual do painel, em desktop e celular.
- Permitir que vínculos ativos do restaurante alterem os dados, com validação no servidor e nas funções SQL.
- Migrar os valores antigos de catálogo para o novo valor `standard`, sem mudar restaurantes que já usam `immersive`.

## Fora de escopo

- Alterar os dados, operações ou interface de edição das categorias e produtos no painel.
- Adicionar novos campos de contato ou identidade além dos que já existem no modelo do `tavvi-app`.
- Criar papéis ou permissões por cargo. Hoje `memberships.position` é informativo; a autorização continua baseada em sessão e vínculo ativo.
- Trocar o valor padrão atual (`immersive`) para novos restaurantes.
- Adicionar dependências para navegação, animação ou componentes visuais.
- Alterar o fluxo de edição de categorias e itens. A edição continua exigindo mídia; o fallback público mantém compatibilidade para itens visíveis já salvos sem mídia.

## Experiência pública

### Estrutura comum

O conteúdo atual de apresentação do restaurante — capa, logo, nome, segmento, descrição, canais, endereço e avaliação no Google — vira a primeira tela de entrada. Quando há cardápio publicado, a tela oferece um botão **Ver cardápio** e uma indicação discreta de que há conteúdo ao lado. O gesto lateral continua sendo nativo, com `scroll-snap`; a barra de rolagem não aparece.

Sem cardápio publicado, a página mantém a apresentação atual e o estado de cardápio em construção. A navegação pública continua usando as consultas públicas existentes e não cria sessão autenticada.

### Padrão

- A primeira tela é a apresentação do restaurante.
- A segunda tela contém uma faixa de categorias e uma lista vertical de seções de categoria.
- Cada categoria apresenta título, descrição e um trilho horizontal de itens. Um único cartão amplo ocupa a faixa por vez; o gesto lateral mostra os demais itens da categoria.
- O cartão mantém disponibilidade, descrição, preços e variações, destaques e dietas/alergênicos. A mídia principal aparece no cartão; as mídias adicionais abrem em um visualizador acessível por um controle explícito, evitando competir com o gesto lateral do trilho de produtos.
- A navegação de categorias atualiza a categoria ativa e leva a seção correspondente para a área visível.

### Imersivo

- A primeira tela é a apresentação do restaurante.
- Depois dela, cada item publicado ocupa uma tela de um feed horizontal com encaixe por item. A imagem ou vídeo é o foco visual; nome, disponibilidade, descrição, preço, variações, destaques e atributos aparecem em uma área de leitura sobreposta à composição.
- Itens sem mídia usam a superfície e as cores do tema como composição visual, mantendo nome, preços e atributos no mesmo feed.
- Itens visíveis sem mídia também permanecem no DTO público do Padrão e recebem um fallback visual no cartão; não são filtrados pelo servidor.
- Cada slide tem uma área verticalmente rolável para descrições e atributos extensos. A navegação horizontal muda de item e não é bloqueada pelo conteúdo longo.
- Um seletor de categorias continua disponível para saltar ao primeiro item de cada categoria. A ordem do feed permanece estável: categorias e itens na ordem recebida do servidor.
- Mídias adicionais abrem no mesmo visualizador explícito usado pelo Padrão.

### Movimento e acessibilidade

- Manter a revelação sequencial da tela de boas-vindas.
- Ao entrar pela primeira vez na área visível, revelar em sequência o título da categoria, a mídia principal e os blocos de informação do item. Usar deslocamento pequeno, opacidade e escala discreta; `transform` e `opacity` são as propriedades animadas.
- Usar `motion/react`, que já é dependência do projeto, com `MotionConfig reducedMotion="user"` ou comportamento equivalente. Movimento reduzido elimina deslocamentos e rolagem suave; o conteúdo fica visível imediatamente.
- As animações não bloqueiam cliques, setas, controles, vídeo ou scroll. Itens fora de vista não iniciam animação. A entrada é executada uma vez por item para que voltar não pareça repetitivo.
- Trilhos têm foco visível, nomes acessíveis e controles anterior/próximo em telas com ponteiro. Chips de categoria e botões são operáveis por teclado. A ausência de barra não é a única indicação de navegação.

## Painel

### Navegação e rotas

- **Operação** contém Cardápio.
- **Perfil público** contém Identidade e Contato, nesta ordem.
- Desktop usa a sidebar atual. O celular conserva o dock com conta, atalho Cardápio e botão Navegar; a folha de navegação recebe as três áreas.
- As páginas ativas ficam em um route group comum com shell compartilhado: `/painel/cardapio`, `/painel/identidade` e `/painel/contato` (ou as mesmas rotas sem `/painel` no host configurado).
- As páginas de onboarding existentes são movidas para `/painel/onboarding/identidade` e `/painel/onboarding/contato`, mantendo separadas as rotas de salvamento e prévia. Redirecionamentos e links de rascunho passam a apontar para esses caminhos.
- O cabeçalho das três páginas segue a página Cardápio atual: toggle da sidebar no desktop, ícone e título; sem descrição ou ações adicionais. No celular, usa-se a navegação móvel atual.

### Identidade

Campos já existentes: segmento, logo, capa, tema/preset, densidade, cores de base e destaque e apresentação do cardápio. A apresentação aparece como duas opções visuais com **Imersivo** e **Padrão**, sem `<select>`. Os demais campos usam inputs com ícones e comboboxes.

A tela mantém cartões de formulário com estados de alterações pendentes, salvar e descartar. A prévia do menu acompanha as alterações no desktop; no celular abre sob demanda em uma folha, sem ocupar espaço permanente.

### Contato

Campos existentes: nome e descrição pública, telefone, WhatsApp, Instagram, CEP, rua, número, complemento, bairro, cidade, estado, link do Google Maps e estado do link de avaliação. Nome e descrição pertencem a Contato, como na página correspondente do Tav original e no onboarding atual.

WhatsApp e endereço completo permanecem obrigatórios de acordo com as regras atuais de ativação; telefone e Instagram são opcionais; complemento e link do Maps são opcionais. Quando o link do Maps muda, a gravação resolve o link de avaliação antes de salvar; se a resolução falhar, a operação informa o erro e preserva o valor já publicado. Ao remover o link do Maps, o link derivado de avaliação é removido.

Os inputs têm ícones, labels, mensagens de erro associadas e máscaras existentes. CEP continua preenchendo os campos que o usuário não alterou. Há prévia sincronizada do perfil no desktop e sob demanda no celular.

## Dados e segurança

- O tipo canônico passa a ser `"immersive" | "standard"`; na UI, os rótulos são **Imersivo** e **Padrão**.
- Uma migração converte `catalog-list` e `catalog-grid` para `standard`, altera a constraint e mantém o default atual `immersive`.
- A validação SQL do onboarding passa a aceitar somente os dois valores canônicos. O parser público pode aceitar temporariamente os valores antigos como aliases de `standard` durante a transição.
- A consulta pública inclui itens visíveis sem mídia para que o fallback seja alcançável. A migração remove a restrição por item e não falha por itens antigos sem mídia; a regra existente de publicação ainda exige ao menos um item visível com mídia.
- Identidade e contato são gravados em operações distintas para não sobrescrever campos da outra página com valores antigos do cliente.
- As funções de gravação exigem usuário autenticado, restaurante ativo e vínculo ativo. Não há autorização por `position`.
- A gravação de identidade valida formato, tema, apresentação e caminhos de mídia pertencentes ao restaurante. Arquivos novos são removidos se a gravação falhar; mídias substituídas só são removidas após sucesso.
- A gravação de contato valida o perfil completo e mantém as regras de telefone/endereço/Maps. Google Review é recalculado quando o Maps muda.
- Após salvar, invalidar a rota pública do restaurante e as rotas afetadas do painel.

## Critérios de aceite

1. Criação e edição mostram somente **Imersivo** e **Padrão**, e salvam os valores canônicos corretos.
2. Restaurantes com valor antigo de lista ou grade continuam exibindo um menu, agora em Padrão; os imersivos continuam imersivos.
3. Padrão abre a apresentação, permite avançar ao cardápio e deslizar um item por vez em cada categoria; nenhum item é renderizado em grade. Itens visíveis sem mídia continuam na categoria com fallback visual.
4. Imersivo mostra um item por tela, imagem em foco e todos os dados do produto, com acesso às mídias adicionais.
   Itens sem mídia permanecem no fluxo com fallback visual de identidade; conteúdo longo rola verticalmente dentro do slide.
5. Animações de apresentação, categorias e itens são sequenciais, não cobrem controles e respeitam movimento reduzido.
6. Identidade e Contato funcionam para restaurantes ativos na sidebar e na navegação móvel; os caminhos de onboarding continuam acessíveis para restaurantes em rascunho.
7. Alterações são salvas sem sobrescrever os campos da outra página, atualizam a página pública e recusam solicitações sem vínculo ativo.
8. Não existe `<select>` novo nas páginas; campos de seleção usam combobox ou opções em cartões/botões.

## Restrições de validação

O `AGENTS.md` proíbe testes, Git, typecheck, build e lint. A implementação será revisada estaticamente e por inspeção dos fluxos e arquivos; não serão adicionados nem executados testes ou os demais comandos proibidos.
