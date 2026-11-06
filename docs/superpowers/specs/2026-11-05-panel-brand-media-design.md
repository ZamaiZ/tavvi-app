# Mídia de marca do onboarding do Painel — Design

## Objetivo

Corrigir a falha de RLS ao adicionar logo/capa e tornar a seleção de imagens local, com prévia imediata e upload somente durante o salvamento do rascunho ou a ativação.

## Evidência e causa provável

O wizard chama o upload do Supabase Storage assim que o usuário seleciona uma imagem. A policy `panel_brand_insert_draft_member` permite inserir somente quando a requisição está autenticada, o bucket e o caminho correspondem ao padrão esperado, existe membership ativa para o usuário e o restaurante está em `draft`. O erro `new row violates row-level security policy` indica que o `WITH CHECK` da policy de insert foi falso. A mensagem isolada não distingue entre policy ausente/desatualizada no banco, JWT de painel ausente na chamada do browser ou uma das condições de caminho, membership e status não atendida.

O Route Handler verificará sessão, membership, restaurante ativo e estado `draft` antes da gravação, e a policy Storage será endurecida com uma função `SECURITY DEFINER` pequena, sem leitura recursiva sujeita às RLS de `restaurants` e `memberships`. O upload continuará usando o cliente Supabase autenticado do servidor e as policies do Storage; não será usado service role para contornar a autorização.

## Experiência

- Ao escolher ou soltar uma imagem, mantê-la como `File` no estado do wizard e mostrar uma prévia `blob:` local. A seleção não cria objeto no Storage nem altera o caminho persistido.
- Aplicar as validações existentes: JPEG, PNG ou WebP, até 5 MB. Logo e capa são opcionais.
- Uma alteração de mídia participa do autosave de 2.500 ms já acordado. Navegar entre etapas salva imediatamente o snapshot local; finalizar envia as mídias pendentes junto ao perfil final.
- Manter os arquivos pendentes e suas prévias se o envio/salvamento falhar. Só trocar o caminho do perfil depois do sucesso do RPC; remoção de objetos anteriores ocorre depois do commit do perfil.
- Exibir estados por campo: repouso, arrastando, imagem selecionada/pendente, enviando, salva e erro com opção para tentar salvar novamente. O input de arquivo continua acessível por teclado e leitor de tela.
- A logo usa prévia contida e a capa usa recorte de cobertura; exibir nome/tamanho e ações de substituir/remover.
- Animar em sequência a entrada do shell do wizard, etapa, grupos de campos e dropzones usando as variantes de movimento existentes. Stagger curto, movimento vertical sutil, saída mais rápida que entrada; respeitar `prefers-reduced-motion`.

## Persistência e autorização

- Adicionar `POST /painel/onboarding/save` como Route Handler multipart para suportar os arquivos de até 5 MB sem aumentar o limite global de Server Actions do Next (1 MB por padrão).
- O payload inclui `restaurantId`, `expectedRestaurantId`, `step`, `intent` (`draft` ou `complete`), `profile` JSON e arquivos opcionais `logo`/`cover`.
- O servidor valida `Origin`, sessão Panel, ID ativo do cookie, membership ativa, status draft, profile Zod, MIME, tamanho e apenas o nome de arquivo gerado no servidor. O ID esperado precisa ser igual ao contexto do cookie.
- O servidor envia os bytes ao bucket privado com o JWT autenticado da sessão Panel. O RPC existente continua a validar a membership e a gravar o rascunho ou ativar atomicamente; nenhum status vem de campo livre do cliente.
- Se o upload parcial ou RPC falhar, tentar remover os novos objetos daquela operação e não atualizar os caminhos no restaurante. Não remover os caminhos antigos antes do sucesso do RPC.
- A policy de insert/delete chama helper de acesso que valida o caminho canônico, `auth.uid()`, membership ativa e status draft com `search_path` vazio. Não enfraquecer RLS nem usar service role.
- O Route Handler devolve códigos limitados e os caminhos novos salvos pelo RPC; a prévia permanece no Blob local até a próxima renderização do wizard. Não devolve mensagem bruta do Supabase.

## Animação

- Usar `authStaggerVariants`/`authItemVariants` de `features/admin/auth/components/auth-motion.ts` no shell e em cada etapa.
- O conteúdo das etapas usa wrappers de motion por seção/campo e por dropzone, com delays de aproximadamente 40–70 ms para evitar uma entrada longa em formulário extenso.
- Os estados de drag-over e upload usam transições de cor/borda/opacity; feedback de clique é curto e não atrasa a interação.
- `MotionConfig reducedMotion="user"` permanece ativo. Para movimento reduzido, remover deslocamento e manter somente transições discretas de opacity/cor.

## Fora de escopo

- Não construir a página pública `/{slug}`.
- Não aumentar limite de upload, adicionar formatos ou dependências.
- Não armazenar imagens em Base64, localStorage ou sessionStorage.
- Não desativar RLS nem usar chave privilegiada no browser.

## Restrições do projeto

- Respeitar `AGENTS.md`: não executar `git`, `typecheck`, `build`, `lint` ou `test`; não adicionar testes. Fazer revisão estática.
- Usar a documentação Next 16 local para Route Handlers e considerar o limite padrão de 1 MB de Server Actions.
- Implementar no checkout nativo existente, sem worktree, pois o projeto proíbe comandos Git.
