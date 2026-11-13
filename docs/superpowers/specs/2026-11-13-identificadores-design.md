# Identificadores — especificação de produto e interface

**Status:** aprovada pelo usuário em 2026-11-13 para preparação do plano e execução nativa.  
**Escopo:** cadastro e gestão de identificadores de mesa, gravação NFC e bloqueio permanente da etiqueta, integrados ao Painel e ao cardápio público da nova arquitetura.

## Intenção

Permitir que um restaurante crie um identificador para cada mesa, grave o link público do restaurante em uma etiqueta NFC usando Android e bloqueie a etiqueta depois de uma confirmação explícita. O fluxo deve reduzir as aproximações do processo legado para uma leitura inicial e uma confirmação, sem esconder que o bloqueio é irreversível.

## Decisões de produto

- Esta entrega trata somente de identificadores. Chamados de atendimento, pedidos, contas, pagamentos e ações de cliente por mesa ficam para fases posteriores.
- Cada identificador pertence a uma mesa numerada. O número da mesa é obrigatório e positivo.
- Um identificador novo começa ativo e recebe um token público estável de 32 caracteres hexadecimais, gerado no banco a partir de UUID aleatório. A etiqueta grava uma URL pública no caminho `/t/{token}`. O link pode ser copiado e acessado mesmo enquanto o estado NFC está pendente.
- A rota pública resolve um identificador ativo e redireciona para a página pública do restaurante (`/{slug}`). O número da mesa não é enviado como contexto ao cardápio nesta entrega.
- Uma mesa pode ter somente um identificador ativo por restaurante. Um identificador NFC protegido não pode ser apagado nem ter o serial substituído; para trocar a etiqueta, desativa-se o identificador antigo e cria-se outro para a mesma mesa.
- Um identificador pode ser desativado e reativado. Desativado, seu link público deixa de redirecionar. Reativado, o token volta a funcionar.
- O Painel é a aplicação web responsiva já existente, não um aplicativo Android nativo. A leitura, gravação e proteção NFC são oferecidas no Chrome para Android em HTTPS; os demais recursos de gestão permanecem disponíveis no desktop.

## Experiência do Painel

### Lista

- Adicionar “Identificadores” à navegação de Operação da sidebar desktop e ao destino Operação do menu mobile do Painel.
- Criar a rota de workspace `identificadores`, respeitando o prefixo do host compartilhado já usado pelo Painel.
- Cabeçalho com o título “Identificadores” e ação “Nova mesa”, sem introduzir um banner ou resumo editorial.
- Busca simples pelo número da mesa e filtros: Todos, NFC pendente, Protegidas e Desativadas. Contagens acompanham os filtros.
- No desktop, usar linhas compactas com mesa, estado NFC e ações. No mobile, usar cartões com alvos de toque maiores e ação NFC em destaque nos detalhes.
- Ações disponíveis: criar mesa, alterar número da mesa, abrir detalhes, copiar link e ativar/desativar. Mudanças de mesa mantêm o token e o conteúdo físico da etiqueta; conflitos de mesa são rejeitados.
- Não oferecer exclusão permanente para administradores do restaurante. Manter o registro inativo preserva o token e o histórico operacional.

### Estados visuais

- **NFC pendente:** identificador criado, sem confirmação de proteção permanente.
- **Protegida:** navegador confirmou o bloqueio e o servidor registrou o serial e a data.
- **Desativada:** link público suspenso, independentemente do estado físico da etiqueta.
- **Proteção incerta:** o navegador iniciou o bloqueio, mas não há confirmação confiável. Manter o identificador pendente, reservar o serial, impedir nova gravação e oferecer retomada por leitura da mesma etiqueta.
- Criar skeleton responsivo que corresponda às linhas desktop e cartões mobile; vazio inicial com ação de criar; vazio de busca com ação para limpar; erros de carregamento e operação com recuperação clara.
- Entradas do título, filtros e registros em cascata curta usando `motion/react`, respeitando movimento reduzido. Mudanças de filtro e estado usam transições breves, sem animar layout de forma excessiva.

## Registro NFC

1. No detalhe de uma mesa, o operador inicia “Vincular NFC”. A interface detecta contexto seguro, `NDEFReader`, disponibilidade de serial e suporte a `makeReadOnly`; se faltar requisito, explica o motivo e mantém o cadastro NFC pendente.
2. Uma aproximação lê o serial e o conteúdo NDEF atual. A aplicação inicia no servidor uma operação identificada por `operation_id`; o servidor recusa serial já associado a outro identificador antes de permitir qualquer gravação. A leitura permanece aberta na mesma sessão para perceber quando outra etiqueta entrar em alcance.
3. A confirmação apresenta a mesa, o link Tavvi que será usado e se o conteúdo atual será substituído. O texto deixa explícito que a etiqueta ficará permanentemente somente leitura.
4. Ao confirmar, mantendo a etiqueta junto ao aparelho, a aplicação primeiro confirma no servidor a reserva exclusiva para aquela tentativa e depois grava a URL quando necessário e chama `makeReadOnly()` em sequência. Se a URL já estiver correta, não a regrava; solicita a proteção. A mesma tentativa pode repetir a confirmação do servidor com um identificador idempotente, sem abrir uma segunda gravação concorrente.
5. Só após sucesso do navegador e confirmação do servidor o estado muda para Protegida. Se a operação NFC falhar antes de solicitar o bloqueio, a tela permite tentar de novo. Se falhar depois de o bloqueio poder ter sido aplicado, guarda um recibo local de recuperação e nunca tenta regravar automaticamente.
6. A retomada lê o mesmo serial e URL e mostra uma confirmação explícita antes de chamar somente `makeReadOnly()`; nunca regrava o conteúdo. Uma reserva ainda `ready` só reivindica o bloqueio depois que a leitura e o link conferem. Só marca Protegida se a chamada retornar sucesso e o servidor confirmar o registro.

Uma aproximação física contínua é o objetivo: depois da leitura, a pessoa confirma na tela mantendo o aparelho sobre a mesma etiqueta até a conclusão. A leitura ativa observa uma nova etiqueta e cancela gravação ou bloqueio se o serial divergir. A Web NFC não fornece um identificador de dispositivo NFC ao qual vincular atomicamente chamadas consecutivas; se a etiqueta sair de alcance no limite exato entre operações de rádio, o navegador pode aguardar outra aproximação. Por isso cada gravação e proteção tem timeout com cancelamento e a interface pede para manter a mesma etiqueta em contato. O bloqueio é unidirecional e não pode ser revertido.

### Tentativas e recuperação

- Cada tentativa tem um `operation_id` e estado persistido no servidor. O início reserva o serial para aquele identificador; tentativas concorrentes com o mesmo serial são recusadas.
- A reivindicação do servidor entra em `authorizing` e só depois, imediatamente antes da primeira chamada NFC física, passa para `writing`. Cancelar uma reivindicação só é permitido enquanto ela permanece em `authorizing`; cancelamento e início físico são serializados pela mesma linha do banco. Assim, outra aba não consegue liberar o serial depois de a operação física começar. O identificador da tentativa fica em memória e não é gravado no recibo local.
- Uma reivindicação `authorizing` abandonada pode ser substituída após 45 segundos, pois nenhuma chamada NFC física começou nessa etapa. Uma reivindicação de retomada retorna a operação incerta; uma reivindicação inicial retorna à reserva sem efeito físico.
- Uma operação `writing` sem resposta pode ser retomada depois de 90 segundos somente após reler o mesmo serial e confirmar que o link esperado está presente. A retomada troca o identificador da tentativa e chama apenas o bloqueio; RPCs de conclusão e incerteza validam esse identificador para ignorar respostas atrasadas de tentativas antigas.
- Depois que `write()` é chamado, qualquer falha, fechamento de página ou perda de resposta é tratado como resultado incerto, pois a etiqueta pode ter sido alterada. A reserva fica presa ao mesmo identificador e não expira automaticamente. Só se libera a tentativa automaticamente quando é possível afirmar que nenhuma escrita foi iniciada.
- Uma divergência de serial detectada durante a sessão NFC interrompe a operação e impede `makeReadOnly()`; a etiqueta divergente nunca pode ser bloqueada por essa tentativa.
- Se a escrita for confirmada e o bloqueio não, mostrar que o link pode estar gravado, mas a proteção está pendente. A recuperação só relê e tenta proteger; nunca escreve de novo.
- A retomada pode ocorrer por um membro autorizado do mesmo restaurante em outro aparelho. Ela lê serial e URL e tenta somente concluir `makeReadOnly()`; nunca chama `write()`.
- Marcar Protegida exige que `makeReadOnly()` retorne sucesso e que a atualização no banco seja confirmada. Se continuar incerto, o identificador permanece pendente; o operador pode desativá-lo e criar outro para a mesa. O serial incerto permanece reservado e não pode ser associado a outro identificador.
- Persistir recibo local melhora a retomada no mesmo navegador, mas não é a única fonte do estado; o registro servidor permite a recuperação entre aparelhos.

## Dados, segurança e consistência

- Adicionar uma migração incremental para uma tabela de identificadores vinculada ao restaurante ativo, com token público, número da mesa, estado ativo, serial NFC e data/ator da proteção. Não usar um campo chamado `verified_at` para sugerir uma releitura pós-gravação que este fluxo não faz.
- Gerar tokens aleatórios no banco, sem aceitar tokens informados pelo cliente, e impor unicidade global. Impor unicidade de mesa ativa por restaurante, de serial NFC global e de operação ativa por identificador.
- Manter o token e o restaurante imutáveis. Serial, vínculo e proteção só mudam por RPCs estreitas de registro NFC, com validação de membership, operação iniciada, identificador e serial.
- Registrar estados da operação (`ready`, `authorizing`, `writing`, `failed`, `uncertain`, `protected`) para que falhas após efeito físico sejam recuperáveis e para reservar seriais sob resultado incerto. O registro de proteção e o evento de auditoria devem ser atômicos no banco.
- Resolver links públicos por RPC que retorna somente o slug do restaurante para identificador ativo. Não expor token enumeration, serial NFC, número de mesa ou dados de auditoria ao visitante.
- Server Actions validam payload com Zod e derivam restaurante e usuário da sessão/cookie do Painel; não confiam em `restaurant_id` enviado pelo navegador. RLS e RPCs preservam o isolamento por restaurante.
- Alterar número da mesa e ativar/desativar usam mutações separadas para que uma tela antiga não sobrescreva a mudança concorrente do outro campo.
- O serial da etiqueta é evidência operacional, não autenticação criptográfica nem prova da localização física da tag.

## Fora de escopo

- Chamados, pedidos, contas, pagamentos e regras de operação por mesa.
- Contexto de mesa no cardápio público ou apresentação do número da mesa ao cliente.
- Aplicativo nativo Android, gravação de NFC em iOS, geração de QR code e impressão de etiquetas.
- Histórico detalhado de auditoria na interface; eventos necessários para integridade e recuperação continuam registrados no servidor.
- Importar CSS, componentes ou tokens visuais do aplicativo original.
- Criar ou executar testes, build, lint, typecheck ou comandos Git, conforme as instruções do projeto.

## Critérios de aceite

1. O Painel lista identificadores do restaurante ativo, pesquisa por mesa, filtra pelos quatro estados e oferece vazios e estados de carregamento coerentes em desktop e mobile.
2. Um membro autorizado cria um identificador para mesa válida; duplicidade ativa de mesa é recusada com mensagem legível.
3. A sidebar desktop e a navegação mobile indicam “Identificadores” como destino ativo na rota correspondente.
4. O link copiado e a URL gravada usam token estável; identificadores ativos redirecionam para o slug público do restaurante e identificadores desativados não redirecionam.
5. Em Chrome para Android com HTTPS e NFC compatível, o cadastro lê o serial uma vez, solicita confirmação clara e tenta gravar/proteger na mesma sessão física, sem leitura pós-gravação obrigatória.
6. O serial duplicado é recusado antes da gravação. Um identificador só aparece como Protegida após sucesso de `makeReadOnly()` e confirmação persistida.
7. Falhas de permissão, NFC desligado, tag incompatível, gravação e proteção têm estados distintos; resultado incerto depois do início da gravação impede regravação e oferece recuperação.
8. Alterar a mesa mantém o token; desativar interrompe o link; reativar restaura o link quando a mesa não conflita.
9. Animações são curtas, sequenciais e desativadas ou reduzidas quando o usuário prefere movimento reduzido. Os controles permanecem acessíveis por toque e teclado.

## Referências da implementação existente

- Legado: `C:\Users\Eduardo Zamai\Documents\tavvi\apps\web\src\features\workspace\components\identificadores-screen.tsx`, `nfc-identifiers.tsx`, `server\dal\tags.ts`, `domain\tag.ts`, além das migrações NFC 0003 e 0004.
- Nova arquitetura: `features/panel/shell/components/panel-app-shell.tsx`, `features/panel/shell/components/panel-mobile-dock.tsx`, `features/panel/menu/components/menu-workspace.tsx`, `features/panel/menu/components/menu-workspace-skeleton.tsx`, `app/[slug]/page.tsx` e `features/public-profile/server/public-menu.ts`.
- Web NFC: Chrome para Android requer contexto seguro e interação do usuário; `makeReadOnly()` é irreversível. Usar detecção de capacidade em runtime e não presumir suporte apenas pelo tamanho da tela.
