# Feedback público e painel — design

## Intenção

Permitir que uma pessoa envie, anonimamente, o que achou do restaurante pelo cardápio público, com até três imagens e/ou vídeos. A equipe do restaurante deve encontrar esses relatos no painel, abrir as mídias, marcar leitura e excluir um feedback quando necessário.

O resultado deve parecer nativo ao Tavvi: mesmas páginas, espaçamentos, componentes shadcn, ícones, hierarquia visual e animações sequenciais já usadas no painel, com suporte a movimento reduzido.

## Estado atual e referência

- O app de referência já tem o fluxo anônimo de texto, até três fotos, upload em duas etapas para bucket privado, lista de feedbacks, filtro de não lidos, detalhe, marcação de leitura e exclusão.
- O app atual não tem entidades, rotas ou navegação de feedback.
- O perfil público atual já concentra as ações do restaurante e apresenta o acesso ao cardápio. O formulário pode seguir o padrão de folha/modal temática usado pelo app de referência, adaptado aos componentes do app atual.
- O shell atual define a navegação desktop e mobile em dois componentes e usa Motion para entradas sequenciais com respeito a movimento reduzido.
- O app atual já valida e armazena mídia privada do cardápio: imagens JPEG/PNG/WebP/AVIF até 5 MiB; vídeos MP4/WebM até 10 MiB e 15 segundos. O limite por mídia é útil para o feedback também.
- O app atual não contém APP_SERVER_KEY. A referência usa essa chave para proteger as RPCs anônimas e mantém somente o hash no banco.

## Abordagens consideradas

1. **Envio mediado por chave privada — escolhida.** O servidor Next valida cada etapa e chama RPCs que exigem APP_SERVER_KEY. O banco mantém somente o hash da chave, os objetos ficam em buckets privados e cada arquivo tem um caminho reservado por um rascunho recente. É o padrão mais próximo do app de referência e protege as tabelas de gravações diretas por clientes anônimos. Exige cadastrar a mesma chave no ambiente do servidor e no Supabase.
2. **RPC pública com escrita anônima limitada pelo banco.** Evita a nova configuração de segredo, mas qualquer cliente pode chamar as funções de envio; os limites no banco restringem volume, porém a barreira contra abuso automatizado fica mais fraca.
3. **Portar apenas o fluxo original de fotos.** Seria o menor escopo, mas não atende ao pedido explícito de vídeos.

## Decisões

- Usar a abordagem 1.
- Manter o feedback anônimo: não solicitar nem associar nome, telefone, e-mail ou conta.
- Limitar cada feedback a três anexos combinados, em qualquer mistura de foto e vídeo. Aplicar os limites já usados pelo cardápio: imagens JPEG/PNG/WebP/AVIF até 5 MiB; vídeos MP4/WebM até 10 MiB e 15 segundos.
- Mostrar a ação Deixar feedback anônimo nas ações do perfil público, junto às demais ações do restaurante. Ela abre um formulário com o tema e as fontes do perfil. O formulário pode ser usado mesmo quando o restaurante ativo ainda não publicou itens no cardápio.
- Na lista do painel, mostrar os feedbacks mais recentes primeiro e oferecer Todos e Não lidos, paginação, prévias de mídia e abertura do detalhe.
- Abrir o detalhe como diálogo em telas largas e folha em telas pequenas, seguindo os componentes já presentes no app. O detalhe permite ler o texto, navegar pelas imagens e reproduzir vídeos, marcar como não lido e iniciar a exclusão confirmada.
- Exibir a contagem de não lidos na nova entrada de navegação e nos filtros. Se a consulta da contagem falhar, a navegação continua funcionando e apresenta zero.
- Usar uma chave server-only APP_SERVER_KEY com pelo menos 32 caracteres. O banco guarda somente o hash; uma configuração única do valor correspondente no Supabase será necessária. A ausência ou divergência da chave deve falhar fechada nas ações públicas de envio, sem impedir que o Painel liste e gerencie feedbacks ou que outras áreas carreguem.
- Limitar envios no servidor por identidade do visitante e no banco por restaurante. Contadores devem falhar fechados quando o banco não puder confirmar o limite; não persistir o endereço IP em texto simples.

## Fluxo público

1. A pessoa abre Deixar feedback anônimo no perfil do restaurante.
2. Uma folha/modal responsiva explica que o envio é anônimo e oferece um campo de texto com contador e até três arquivos no total. As mídias são pré-visualizadas localmente e podem ser removidas antes do envio.
3. O botão Enviar fica desabilitado durante preparação e upload. Erros aparecem junto ao campo ou mídia correspondente, preservando texto e arquivos para nova tentativa. Fechar um formulário com conteúdo pede confirmação de descarte.
4. O servidor valida restaurante, texto, MIME, tamanho, dimensões/duração declaradas e limites de envio. O navegador lê dimensões e duração reais; o Storage impõe MIME e tamanho reais. Como o navegador envia os arquivos direto ao Storage, uma chamada forjada pode mentir sobre dimensões/duração sem análise binária server-side. Uma primeira RPC cria um rascunho e reserva os caminhos de mídia; o servidor emite URLs assinadas; uma segunda RPC publica somente após confirmar que todos os objetos chegaram.
5. A confirmação de envio mantém a pessoa no cardápio e informa que o restaurante recebeu o feedback.

## Dados e acesso

- Criar uma tabela de feedback por restaurante com texto, estados de rascunho/publicado/excluído, criação, publicação, leitura e exclusão. Rascunhos e feedbacks excluídos são invisíveis ao Painel; exclusão remove o conteúdo textual imediatamente e deixa uma reserva sem conteúdo até os tokens de upload expirarem. Novas URLs podem ser emitidas apenas nos primeiros 15 minutos; cada URL assinada dura até duas horas, então a publicação permanece aberta por 2 horas e 15 minutos. A limpeza lazy da reserva espera 2 horas e 16 minutos para cobrir emissão, validade e um minuto de margem. Assim, uma URL antiga não consegue recriar um arquivo órfão depois da limpeza. O cleanup executa ao carregar a caixa de feedback; sem novas visitas, reservas e eventuais arquivos privados podem permanecer por mais tempo.
- Criar uma tabela de anexos com restaurante, feedback, tipo, posição, caminho privado e metadados de imagem ou vídeo. Três posições no máximo por feedback.
- Criar buckets privados separados para imagens e vídeos, com tipos e limites de arquivo correspondentes. A escrita anônima só pode usar um caminho que uma RPC protegida reservou para um rascunho recente. Leitura e exclusão ficam limitadas a membros ativos do restaurante.
- Reutilizar o padrão de membro ativo que o domínio do cardápio já usa para RLS. A listagem do painel também exige restaurante ativo selecionado no contexto do painel; RLS mostra somente feedbacks publicados e não concede exclusão direta das linhas.
- A leitura do painel deve criar URLs temporárias para as mídias; nunca expor o bucket como público. A falha ou expiração da URL deixa uma recuperação explícita, sem travar a lista.
- As ações de início e publicação exigem a chave privada. O navegador lê dimensões e duração reais; o servidor e o banco validam os limites declarados, e o Storage impõe MIME e tamanho reais. Como o binário é enviado direto ao Storage e não é decodificado no servidor, uma chamada forjada pode mentir sobre dimensões/duração.

## Painel

- Adicionar Feedbacks à navegação lateral e à navegação mobile.
- Criar a rota do workspace de feedback, usando o restaurante ativo e o mesmo cabeçalho, largura, superfícies, tipografia e tokens das páginas atuais.
- Listar em ordem decrescente por publicação, com cursor estável e páginas de 20. Cada cartão mostra data, estado de leitura, trecho do texto, número de anexos e miniaturas com indicação de vídeo.
- Abrir detalhes marca como lido. Oferecer também marcar como não lido e excluir com confirmação. Atualizar a interface imediatamente em ações que possam ser revertidas; apresentar erro e recuperar o estado se a gravação falhar.
- Diferenciar vazio geral (ainda sem feedbacks) de filtro vazio (tudo lido). A rota tem skeleton próprio e estado de erro com ação para tentar novamente. Filtros e carregamento de mais resultados mostram progresso e desabilitam ações concorrentes.
- Aplicar animação de entrada sequencial ao cabeçalho e à lista, sem animar grandes áreas ou mudanças de tamanho; reduzir a animação quando o sistema pedir movimento reduzido. Todos os controles devem ter foco visível, nome acessível e área de toque confortável.
- Não adicionar notificações ou push: não há infraestrutura de notificações do painel atual a reutilizar para esta tela.

## Não objetivos e antiobjetivos

- Não publicar feedbacks no perfil público nem permitir respostas do restaurante nesta entrega.
- Não adicionar nota em estrelas, formulário de dados pessoais ou integração com avaliações externas.
- Não tornar buckets públicos, expor caminhos de storage ao cliente ou permitir gravação direta nas tabelas.
- Não migrar feedbacks do banco do app de referência; o caminho informado serve como referência de implementação.
- Não adicionar dependências, mudar o design system do produto ou introduzir uma linguagem visual separada.

## Restrições de implementação e revisão

- O alvo é Next.js 16.4.2, App Router, React, Supabase, Zod, shadcn e Motion; antes de alterar código Next, ler os guias locais correspondentes para Server Actions, Route Handlers, loading e error boundaries.
- Seguir a estrutura por feature já usada no painel e no perfil público.
- As instruções do repositório proíbem executar Git, testes, build, lint e typecheck. A revisão final será estática e deve informar esse limite sem alegar validação em navegador.
- A busca visual consultada retornou padrões genéricos de documentação/operações, incompatíveis com o perfil e o shell existentes. Não usar a paleta ou a composição sugeridas; manter os tokens e componentes que o app já define.
