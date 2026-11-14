# Feedback público e painel — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Receber feedback anônimo com até três imagens/vídeos no cardápio público e permitir que a equipe leia, organize e gerencie os envios no painel.

**Architecture:** Adicionar domínio e persistência próprios para feedbacks, com RPCs protegidas pela chave privada APP_SERVER_KEY, uploads assinados para buckets privados e limites de envio. Separar a interface pública do envio das rotas autenticadas de leitura do painel; integrar a tela ao shell existente em desktop e mobile.

**Tech Stack:** Next.js 16.4.2 App Router, React, Supabase Postgres e Storage, Zod, componentes shadcn existentes, Motion e React Icons Lucide já instalados.

**Spec:** docs/superpowers/specs/2026-11-13-feedback-publico-painel-design.md

## Global Constraints

- Imagens JPEG/PNG/WebP/AVIF: até 5 MiB. Vídeos MP4/WebM: até 10 MiB e 15 segundos.
- Cada feedback recebe até três anexos combinados.
- APP_SERVER_KEY tem pelo menos 32 caracteres, fica server-only e o Supabase armazena apenas o hash.
- Buckets de feedback são privados; o envio público usa apenas URLs assinadas reservadas para rascunhos recentes.
- Novas URLs de upload podem ser emitidas nos primeiros 15 minutos, cada uma vale até duas horas e a publicação permanece aberta por 2 horas e 15 minutos; a limpeza lazy da reserva aguarda 2 horas e 16 minutos, com um minuto de margem. Ela executa ao carregar a caixa; sem visitas, registros e objetos privados podem permanecer por mais tempo.
- Listagem e contagem do painel usam restaurante ativo e autorização por membro ativo, mantendo escopo por restaurante.
- O visual segue tokens e componentes existentes, animação sequencial e suporte a movimento reduzido. Não adicionar dependências.
- Não executar Git, testes, build, lint ou typecheck. Não alterar .env.local nem aplicar migrações em ambiente remoto.

## Review Focus

1. Texto, MIME e tamanho inválidos não chegam a um feedback publicado; o navegador lê dimensões e duração reais, enquanto server/banco validam os limites numéricos declarados. Binários enviados diretamente ao Storage não passam por decodificação server-side, então uma chamada forjada pode mentir sobre dimensões/duração; a falha de envio preserva os arquivos locais para nova tentativa.
2. Upload parcial, rascunho vencido, link assinado expirado e mídia ausente têm recuperação clara e não deixam o formulário preso. Rever nas tarefas 1–3 e no visualizador da tarefa 5.
3. Uma pessoa não lê nem altera dados ou mídias de outro restaurante, e o envio público não cria sessão autenticada. Rever nas políticas da tarefa 1, serviços das tarefas 2 e 4 e rota de mídia da tarefa 4.
4. APP_SERVER_KEY ausente ou incorreta bloqueia apenas o envio público de feedback; a chave nunca chega ao navegador. Rever .env.example, configuração server-only e chamadas RPC da tarefa 2.
5. Filtros, estados vazios, loading, skeleton, erros, diálogos e controles funcionam em telas pequenas e com movimento reduzido. Rever os componentes e a navegação na tarefa 5.

---

### Task 1: Esquema privado, limites e upload reservado

**Files:**
- Create: supabase/migrations/20261113100000_public_feedback.sql
- Modify: .env.example

**Interfaces:**
- Cria restaurant_feedback com texto de 3–1000 caracteres, estados rascunho/publicado/excluído, datas de criação/publicação/leitura/exclusão.
- Cria restaurant_feedback_media com tipo, caminho, posição, dimensões e duração; limita três posições por feedback.
- Cria buckets privados feedback-images e feedback-videos, com MIME e tamanho por bucket.
- Expõe RPCs server-only set_app_server_key, check_app_server_key, begin_feedback, publish_feedback e check_feedback_rate_limit; funções protegidas recebem p_key. RPCs autenticadas fazem exclusão lógica segura e limpeza de rascunhos/tombstones, sem DELETE direto pelas tabelas.
- check_feedback_rate_limit recebe bucket, HMAC da identidade, limite e janela; início 5 vezes/10 min por identidade+restaurante; publicação 10 vezes/10 min por identidade; teto atômico por restaurante 30 feedbacks/hora e 200/24 horas.

- [x] Adicionar o verificador de chave que guarda hash SHA-256 em app_server_keys, revogar acesso direto à tabela e documentar no comentário da migração a configuração única da chave correspondente.
- [x] Criar tabelas, FKs, restrições, índices de publicação/leitura/rascunho e políticas RLS para leitura apenas de feedback publicado; impedir exclusão direta das linhas.
- [x] Criar buckets privados separados com lista de MIME e limite de 5 MiB para imagens e 10 MiB para vídeos.
- [x] Criar política de upload que só aceita caminho previamente reservado por begin_feedback, vinculado ao restaurante e ao rascunho dentro da janela de 15 minutos; não conceder gravação direta nas tabelas a anon.
- [x] Implementar begin_feedback com validação, limite atômico do restaurante, criação do rascunho e reserva ordenada dos caminhos.
- [x] Implementar publish_feedback para aceitar apenas rascunho recente, confirmar a presença de todos os objetos reservados e publicar atomicamente.
- [x] Atualizar .env.example com APP_SERVER_KEY sem valor. Não ler nem alterar .env.local.
- [x] Reler toda a migração e conferir grants, search_path, políticas e limites sem aplicar SQL a um banco.

### Task 2: Contratos e ações públicas server-only

**Files:**
- Create: features/feedback/model.ts
- Create: features/feedback/schema.ts
- Create: features/feedback/server/config.ts
- Create: features/feedback/server/public-write.ts
- Create: features/feedback/server/rate-limit.ts
- Create: features/feedback/actions.ts

**Interfaces:**
- FeedbackMediaKind = "image" | "video".
- FeedbackMediaInput = { kind, mime, byteSize, width, height, durationMs }.
- StartedFeedback = { feedbackId, uploads: { position, bucket, signedUrl }[] }.
- FeedbackMediaDTO = { id, kind, url, width, height, durationMs, position }.
- FeedbackDTO = { id, body, publishedAt, readAt, media: FeedbackMediaDTO[] }.
- FeedbackFilter = "all" | "unread"; FeedbackCursor = { publishedAt, id }; FeedbackPage = { items, nextCursor }.
- startFeedbackAction(rawInput: unknown) valida slug, texto, até três mídias e honeypot; retorna um resultado tipado sem expor mensagens internas do banco.
- publishFeedbackAction(rawInput: unknown) publica somente o rascunho recebido e mantém uma falha recuperável.

- [x] Declarar tipos e schemas compartilhados, incluindo texto 3–1000 caracteres, arquivos aceitos por tipo, dimensões de imagem até 1920 px, vídeo até 15 segundos e até três posições.
- [x] Criar getFeedbackServerKey() para validar APP_SERVER_KEY com pelo menos 32 caracteres somente quando uma ação de feedback é chamada; não validar no carregamento global do app.
- [x] Implementar identidade de visitante como HMAC do endereço obtido de um header confiável da hospedagem; não persistir IP em texto simples. Se o header não existir, usar um identificador compartilhado que aperta o limite.
- [x] Implementar início: se o honeypot estiver preenchido, devolver sucesso fictício sem RPC; caso contrário validar entrada, impor limites por identidade, chamar begin_feedback com chave, criar uma URL assinada para cada caminho reservado e devolver somente IDs, posições e URLs de upload.
- [x] Implementar publicação: impor limite, chamar publish_feedback com chave e mapear recusas esperadas para mensagens claras; nunca registrar o texto do feedback em logs.
- [x] Conferir imports: este módulo usa createSupabasePublicClient, não cria cliente de painel no fluxo público e não serializa APP_SERVER_KEY na resposta ou nos módulos client.

### Task 3: Formulário público de texto e mídia

**Files:**
- Create: features/feedback/components/public-feedback-form.tsx
- Create: features/feedback/lib/public-media.ts
- Create: features/feedback/lib/upload-to-signed-url.ts
- Create: features/public-profile/components/public-feedback-action.tsx
- Create: features/feedback/styles/public-feedback.module.css
- Modify: features/public-profile/components/restaurant-public-profile.tsx

**Interfaces:**
- PublicFeedbackAction recebe slug, nome, tema e classes da ação pública; mantém o perfil público como Server Component.
- prepareFeedbackMedia(file) prepara uma prévia local e valida os metadados de um anexo; o formulário limita a três itens mistos.
- uploadToSignedUrl(url, blob, mimeType) envia o corpo por fetch sem abrir sessão Supabase no navegador.

- [x] Adicionar Deixar feedback anônimo às ações existentes do perfil público, abrindo a folha de feedback para restaurantes ativos com ou sem itens publicados.
- [x] Implementar seleção, validação e prévia local de fotos/vídeos, remoção individual, formatos aceitos e mensagens para arquivo incompatível, acima do tamanho ou vídeo acima de 15 segundos.
- [x] Aplicar aos uploads os limites do cardápio; reutilizar somente funções de compressão seguras para cliente ou manter o processamento específico do feedback sem depender de ações de upload autenticadas do editor de cardápio.
- [x] Implementar folha/modal temática com rótulo visível, contador do texto, instrução de anonimato e limite de mídia; aplicar fontes e variáveis do perfil no portal.
- [x] Ao enviar, desabilitar edição e fechamento durante upload, manter texto e mídias em falha de rede, permitir nova tentativa e mostrar estado de sucesso com retorno ao cardápio.
- [x] Ao fechar um formulário preenchido, pedir confirmação de descarte; ao concluir ou descartar, revogar todas as URLs locais.
- [x] Revisar foco, rótulos, mensagens junto aos campos, área de toque, tema claro/escuro e caminho de envio sem sessão autenticada.

### Task 4: Leitura autenticada, exclusão e mídia do painel

**Files:**
- Create: features/panel/feedback/model.ts
- Create: features/panel/feedback/schema.ts
- Create: features/panel/feedback/actions.ts
- Create: features/panel/feedback/server/read.ts
- Create: features/panel/feedback/server/write.ts
- Create: app/painel/(workspace)/feedback/media/[mediaId]/route.ts

**Interfaces:**
- Usa FeedbackDTO, FeedbackFilter, FeedbackCursor e FeedbackPage definidos em features/feedback/model.ts.
- PanelFeedbackActionResult<T> representa sucesso com dados ou erro seguro de entrada, indisponibilidade ou item ausente.
- listFeedbackAction({ expectedRestaurantId, filter, cursor? }) lista 20 itens publicados do restaurante ativo por página.
- markFeedbackReadAction({ expectedRestaurantId, feedbackId, read }) e deleteFeedbackAction({ expectedRestaurantId, feedbackId }) exigem o restaurante ativo esperado.
- getUnreadFeedbackCount(restaurantId) retorna zero em falha de contagem sem impedir navegação.

- [x] Implementar leitura com cliente autenticado do painel, RLS, filtro todos/não lidos e cursor estável por published_at+id.
- [x] Criar URLs locais de mídia no DTO, sem incluir caminhos privados nem URLs de bucket público.
- [x] Implementar leitura e atualização com escopo por restaurante; abrir detalhes marcará como lido, enquanto ações do cartão poderão reverter para não lido.
- [x] Implementar exclusão lógica por RPC: esconder e redigir o feedback imediatamente, manter tombstone e caminhos até expirarem todos os tokens de upload, remover os objetos privados e limpar o tombstone depois; falhas de remoção são repetidas pela limpeza lazy.
- [x] Implementar RPCs de limpeza limitada de rascunhos/tombstones vencidos; remover os objetos antes das linhas e ignorar falha sem derrubar a lista. Leitura RLS comum mostra somente publicações.
- [x] Criar rota de mídia privada que valide UUID, restaurante ativo selecionado, associação do arquivo a feedback publicado e tipo/bucket; emitir redirect para URL assinada curta com private, no-store.
- [x] Reler as consultas e políticas para garantir que IDs de outros restaurantes nunca retornem dados nem links assinados.

### Task 5: Página de feedback, estados visuais e navegação

**Files:**
- Create: features/panel/feedback/components/feedback-workspace.tsx
- Create: features/panel/feedback/components/feedback-card.tsx
- Create: features/panel/feedback/components/feedback-detail.tsx
- Create: features/panel/feedback/components/feedback-media-viewer.tsx
- Create: features/panel/feedback/components/feedback-workspace-skeleton.tsx
- Create: app/painel/(workspace)/feedback/page.tsx
- Create: app/painel/(workspace)/feedback/loading.tsx
- Create: app/painel/(workspace)/feedback/error.tsx
- Modify: app/painel/(workspace)/layout.tsx
- Modify: features/panel/shell/components/panel-app-shell.tsx
- Modify: features/panel/shell/components/panel-mobile-dock.tsx

**Interfaces:**
- A página resolve o restaurante ativo, carrega a primeira página Todos e passa initialPage e restaurantId ao workspace client.
- O workspace recebe initialPage, restaurantId e unreadCount; mantém estado de filtro, cursor, item selecionado e mutações.
- O shell recebe unreadFeedbackCount e a nova seção ativa feedback.

- [x] Montar a rota server-side com cabeçalho, largura e superfícies das páginas atuais; criar skeleton dedicado e erro com ação tentar novamente.
- [x] Construir cartões recentes com data, trecho, estado não lido, quantidade e miniaturas; sinalizar vídeos sem depender só de cor.
- [x] Criar filtros Todos/Não lidos com contador, estados vazios distintos, ação Carregar mais, indicadores de progresso e controles desabilitados durante conflito.
- [x] Criar detalhe responsivo: Dialog em telas largas e Sheet em telas pequenas; mostrar texto, data e grade de mídia.
- [x] Criar visualizador de imagens/vídeos com navegação acessível, controles nativos de vídeo, tratamento de mídia ausente e refresh único após URL expirada.
- [x] Abrir detalhe marcando como lido; oferecer marcar como não lido e excluir com confirmação shadcn. Fazer atualização otimista apenas onde seja possível restaurar o estado em falha.
- [x] Aplicar Motion com entradas sequenciais moderadas, tokens/easing do app e redução de movimento respeitada; evitar animação de largura/altura e mudança de layout.
- [x] Adicionar o grupo Clientes com Feedbacks à barra lateral e à navegação mobile, usando ícone Lucide e badge de não lidos, preservando estado ativo e nomes acessíveis.
- [x] Carregar contagem de não lidos no layout do workspace, isolada por restaurante ativo, e manter navegação disponível se a consulta falhar.
- [x] Reler a matriz de estados: skeleton inicial, erro, lista preenchida, vazio geral, vazio de não lidos, filtro carregando, mais resultados carregando, leitura pendente, exclusão pendente, mídia sem URL e confirmação de envio.

### Task 6: Revisão estática final

**Files:**
- Review: todos os arquivos criados ou alterados nas tarefas 1–5

**Interfaces:**
- Não cria novas interfaces. Confere os contratos de ponta a ponta entre navegador, ações server-only, RPC, RLS, Storage, painel e shell.

- [x] Comparar o design com a implementação: não há notificação/realtime; leitura é compartilhada por restaurante; exclusão usa tombstone temporário para cobrir tokens de upload não revogáveis.
- [x] Conferir que APP_SERVER_KEY só é lida em código server-only e não está presente em props, DTOs, mensagens ou bundles client.
- [x] Conferir limites de mídia entre UI, Zod, buckets, tabelas e RPCs; até três itens, imagens de 5 MiB e vídeos de 10 MiB/15 s. Registrar que dimensões/duração reais são verificadas no navegador, mas podem ser forjadas por um cliente modificado porque o binário não é inspecionado server-side.
- [x] Conferir falha parcial, URLs locais revogadas, tombstone após exclusão, janela de emissão + validade de URLs assinadas, scoping por restaurante e movimento reduzido.
- [x] Reler a migração e interface sem aplicar SQL, iniciar testes, navegador ou servidor de desenvolvimento.
- [x] Registrar que nenhum teste, build, lint, typecheck ou comando Git foi executado e que o ambiente ainda precisa receber a mesma APP_SERVER_KEY no servidor e no Supabase para aceitar envios.
