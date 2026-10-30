# Convites da plataforma — funcionalidade ponta a ponta

## Estado

Especificação aprovada para implementação em 29/10/2026. Implementação executada neste workspace; revisão estática final registrada no ledger do plano.

## Intenção

Substituir os dados de demonstração da página Admin Convites por convites reais da plataforma Tavvi. Um convite permite que um cliente crie uma conta e inicie o cadastro de um restaurante. O link precisa ser seguro, de uso único e resgatável na nova aplicação.

## Objetivos

- Criar e listar convites de plataforma com e-mail opcional e validade configurável de 1 a 30 dias, padrão 7.
- Pesquisar por e-mail, filtrar por situação e paginar no servidor.
- Mostrar contagens reais para todos, pendentes, resgatados, vencidos e revogados; nunca calcular contagem a partir da página atual.
- Exibir detalhes de um convite real, revogar convites pendentes, rotacionar um link e substituir e-mail/validade invalidando o link anterior.
- Gerar uma URL do território Painel configurada para o ambiente atual e mostrar o token em claro uma única vez para copiar/compartilhar. Não enviar e-mail.
- Resgatar o convite no Painel: visualizar sem consumir, autenticar/criar conta usando o e-mail vinculado quando definido, informar o nome do restaurante e aceitar explicitamente.
- No aceite, criar o restaurante nomeado em `draft`, gerar seu slug no servidor, criar a primeira membership como administrador do restaurante, consumir o convite e gravar auditoria em uma transação.
- Após o commit, encerrar o fluxo em uma confirmação factual do acesso e do restaurante `draft` criado. Não redirecionar para `/identidade` nem implementar o onboarding de identidade nesta entrega.
- Manter somente dados do banco. Sem fixtures, links aleatórios de demonstração, contagens fixas ou registros de exemplo. Quando não houver registros reais, exibir estado vazio com ação de criar convite.
- Preservar a interface atual: Motion sequencial e reduzido quando solicitado, estados de carregamento, vazio, erro e sucesso, foco acessível, tabela animada e atualização pontual após mutações.

## Fora de escopo

- Envio de e-mail, convites de equipe, gestão de restaurantes no Admin, configuração completa de identidade/contato/cardápio, auditoria administrativa genérica e mudança do fluxo de autenticação do Admin.
- Importar dados ou aplicar o schema do app original ao Supabase novo.
- Armazenar tokens em claro, usar `Math.random`, colocar `service_role` no navegador ou depender somente da validação visual do formulário.

## Contexto inicial da especificação

- `tavvi-app` tem uma migration de identidade que cria `profiles`, `platform_admins` e funções de autorização. Ainda não tem tabelas de convites, restaurantes, memberships ou auditoria, nem rota do Painel.
- `features/admin/invites/data.ts` e `admin-invites-page.tsx` ainda usam convites de demonstração; o Sheet gera uma URL fixa com `Math.random`.
- `__BASE.MD` é a fonte das regras de negócio. O app antigo é referência de semântica e fluxo, não um schema ou uma base de dados para copiar.
- A base define a rota do Painel como `/convite?token=...`, separa cookies Admin/Painel e prevê que a criação do restaurante continue em `draft` até concluir configuração.

## Decisões de produto

- Convite de plataforma convida clientes a iniciar um restaurante; não cria um `platform_admin`.
- E-mail vazio permite qualquer e-mail no aceite. E-mail preenchido deve coincidir com o e-mail da conta após normalização por trim e caixa baixa. Isso não comprova posse da caixa postal porque a confirmação de e-mail do Supabase permanece desligada; o link de alta entropia é a credencial de resgate.
- Token válido não é consumido ao abrir/visualizar a página. O aceite explícito verifica usuário, validade, revogação, uso anterior, e-mail e estado do restaurante, e só então consome o convite.
- Criar/rotacionar link não envia mensagem. O resultado contém a URL uma única vez e a interface mantém a confirmação/cópia em memória. Reabrir detalhes nunca revela o token anterior.
- Alterar e-mail ou validade cria uma substituição: revoga o convite antigo e cria outro token em uma transação, preservando histórico.
- Situação é derivada: revogado, resgatado, vencido ou pendente a partir dos timestamps. Não criar coluna/status que dependa de job para expirar.
- Restaurar ou excluir a conta Admin deve continuar obedecendo a regra da vaga única; convites e auditoria não podem bloquear a exclusão do ator nem apagar o histórico.
- Nenhuma tela deve fingir que o convite ou o restaurante já existem. O pós-resgate precisa exibir somente o estado persistido real.

## Arquitetura proposta

### Camadas Next.js

- Server Component protegido carrega uma página de resultados, contagens globais e detalhes somente quando solicitados.
- Módulo `server-only` de convites concentra autorização, leitura DAL, geração/hash do token, origem do Painel e mapeamento de erros seguros.
- Server Actions finas validam entradas com Zod, revalidam a autorização de Admin em cada mutação, delegam à DAL e retornam DTOs estreitos.
- Componentes existentes continuam responsáveis por tabela, Tabs, Sheets, animação, feedback, empty/loading/error state e atualizações locais pontuais.
- A sessão do Painel usa o cookie `tavvi-panel-auth-token`, separado do cookie de Admin.
- Não adicionar uma biblioteca de consulta/cache se a resposta das Actions e o refresh limitado da rota já resolverem a atualização.

### Leituras

- A listagem lê somente convites de plataforma e retorna campos usados pela tabela/detalhe; `token_hash` nunca aparece em DTO, resposta de listagem ou log.
- Busca por e-mail, situação e paginação são aplicadas no servidor. Ordenação determinística por `created_at DESC, id DESC`.
- Contagens de status são agregadas sobre todo o conjunto de convites de plataforma, independentemente de busca, filtro e página.
- Tamanho de página deve ter um limite superior no servidor; a UI reinicia na primeira página ao alterar busca/filtro e ajusta a página depois de uma remoção.
- Mutações retornam dados suficientes para atualizar a linha, contagens afetadas e lista local sem reler a aplicação inteira; revalidar somente a rota/recursos de Admin ou Painel afetados.

### Banco e segurança

- Criar migrations novas e versionadas no `tavvi-app`; não reescrever a migration de Admin já aplicada e não executar a baseline do legado.
- Modelar convites de forma que a distinção plataforma/equipe futura seja explícita. A operação desta fatia aceita apenas convites de plataforma. Integridade de `restaurant_id`, role e estado precisa ser garantida por constraints quando os registros de restaurante/membership forem criados.
- Habilitar RLS; cada leitura/mutação verifica `is_platform_admin()` ou a identidade autenticada apropriada. RPCs de privilégio elevado são `SECURITY DEFINER`, `search_path` vazio, nomes qualificados, validação estrita e sem parâmetros de ator informados pelo browser.
- Revoke, rotação/edição e resgate usam transações no Postgres. Inserção/atualização do convite, gravação de auditoria e operações multi-tabela do resgate confirmam ou falham juntas.
- Ator de auditoria e criador/resgatador do convite podem ser anulados com `ON DELETE SET NULL`; excluir um usuário Auth não remove convites/histórico e não pode ser bloqueado por referências obrigatórias.
- Aplicação usa o client Supabase autenticado da superfície correta. Nenhuma chave privilegiada entra no bundle do browser.
- Aplicar rate limits transacionais no banco: 60 previews válidos por convite em 5 minutos, 5 tentativas de aceite por conta em 5 minutos e 20 criações/substituições/revogações por Admin em 5 minutos. Login e cadastro também permanecem sujeitos aos limites configurados no Supabase Auth. Tokens desconhecidos recebem só lookup indexado e resposta genérica, sem gravar uma linha por token aleatório.

### Token e link

- Gerar no servidor com CSPRNG (32 bytes; Base64URL de 43 caracteres), hash SHA-256 e salvar somente o digest `bytea` único.
- Calcular validade usando o relógio do banco; validar 1–30 dias no servidor e também no banco.
- O link vem de configuração validada do host/origem do Painel por ambiente e usa `/convite?token=...`; não é hardcoded nem formado a partir de `Origin` não confiável.
- Nunca registrar token em logs/analytics/referrer. A página de resgate não carrega recursos de terceiros e remove o token da barra de endereço depois da validação inicial.
- A criação recebe uma chave de idempotência única persistida com o convite. Se a resposta se perder depois do commit, a repetição não cria outra linha nem afirma que o link foi entregue; informa que o link não pode ser recuperado e oferece rotação explícita, que invalida o token anterior e revela o novo uma única vez.

## Estados de interface

- **Loading inicial:** skeleton da tabela e contagens, mantendo a hierarquia e animação leve compatível com `prefers-reduced-motion`.
- **Busca/filtro/página:** indicador discreto de atualização e linhas anteriores estáveis até a nova resposta; não substituir por mock.
- **Empty global:** orientação real para criar o primeiro convite.
- **Empty filtrado:** mostrar que nenhum resultado corresponde aos critérios e ação para limpar filtros.
- **Create/rotate:** progresso, validação server-side, erro seguro, link recém-gerado e feedback de cópia; se o link ainda não foi copiado, confirmar antes de fechar/descartar.
- **Revogação:** confirmar a ação e refletir o status/contagem após sucesso.
- **Erro de leitura:** estado recuperável com tentar novamente; não converter erro em lista vazia.
- **Resgate:** preview não consome; mismatch de e-mail bloqueia sem consumir; antes do aceite, exigir apenas o nome do restaurante; sucesso aparece somente após transação concluída e confirma apenas os dados persistidos. A tela não sugere que identidade, contato ou cardápio foram configurados.

## Critérios de aceite

1. Admin autorizado cria convite com validade e e-mail opcionais; inválido é rejeitado em Action e banco.
2. Link contém token criptográfico, usa a origem/rota real do Painel, só o hash persiste, e a tela nunca reconstrói um token anterior.
3. Busca, Tabs, contagens e paginação usam dados reais e funcionam sem carregar todo o histórico no browser.
4. Revogação, rotação/alteração e auditoria são atômicas e têm atualizações pontuais de UI.
5. Preview não consome; conta com e-mail divergente não consegue aceitar convite restrito; aceite exige nome do restaurante e só consome o convite junto da criação do restaurante draft, slug e membership; o sucesso termina em confirmação factual, sem navegar para rota inexistente.
6. Repetições e falhas de rede não produzem múltiplos convites ativos nem feedback enganoso.
7. Estados loading/empty/error/success são animados com movimento reduzido respeitado; nenhuma fixture, link fictício ou métrica fixa permanece no fluxo.
8. Admin e Painel mantêm sessões separadas, e cada Server Action/RPC protege a operação sem confiar na interface.

## Decisão final de fluxo

Após aceitar o convite, o Painel mostra uma confirmação factual do convite resgatado e do restaurante criado em `draft`. A configuração de Identidade, Contato e Cardápio pertence à próxima fase; não há redirecionamento para uma rota que ainda não existe.

