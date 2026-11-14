# Filtros e histórico de chamados

**Data:** 2026-11-13  
**Status:** implementado; validação estática

## Intenção

Corrigir o filtro de chamados para que as três opções caibam em telas estreitas e permitir consultar chamados concluídos sem carregar todo o histórico.

## Objetivos

- Exibir “Aguardando”, “Em atendimento” e “Finalizados” em um controle responsivo sem rolagem horizontal escondida.
- Carregar finalizados ao abrir essa aba, em páginas de 25 com cursor estável por `resolved_at` e `id`.
- Mostrar chamados concluídos em cartões somente leitura, incluindo o horário da conclusão e um controle “Carregar mais” quando houver registros seguintes.
- Revalidar o restaurante ativo nas consultas da equipe e manter a leitura sob as políticas existentes.

## Fora de escopo e restrições

- Não alterar as regras de assumir/concluir, realtime, esquema Supabase ou navegação.
- Não carregar todo o histórico na primeira renderização.
- Não executar nem adicionar testes, `git`, `typecheck`, `build` ou `lint`, conforme as instruções do projeto.
- A validação desta mudança será uma revisão estática dos filtros, do cursor, da autorização e dos estados de carregamento/erro.

## Abordagens

1. **Manter rolagem horizontal e adicionar a terceira aba:** descartada porque conserva a causa do recorte em telas estreitas.
2. **Grid responsivo com os 50 finalizados mais recentes:** menor alteração de dados, mas torna registros anteriores inacessíveis.
3. **Grid responsivo e histórico paginado sob demanda:** escolhida. Corrige o espaço das abas, mantém o carregamento inicial leve e permite acessar registros antigos em páginas limitadas.

## Decisões de implementação

- No celular, as três abas usarão largura equilibrada e rótulos compactos; os detalhes redundantes (ícones e contagens) podem ser ocultados nesse breakpoint. Em telas maiores, preservam-se os detalhes visuais atuais.
- A aba “Finalizados” consultará apenas registros `resolved`, ordenados do mais recente ao mais antigo. Cada página buscará até 25 itens; o cursor será formado por `resolved_at` e `id` para não repetir nem pular itens quando novas conclusões ocorrerem.
- A tela inicial continuará carregando somente chamados ativos. A primeira página do histórico será buscada ao selecionar “Finalizados”.
- Se a conexão Realtime cair e voltar enquanto “Finalizados” estiver aberta, a primeira página será recarregada para cobrir eventos ocorridos durante a desconexão.
- O cartão finalizado não terá ação de mutação; exibirá a mesa, os horários disponíveis e estado de conclusão.

## Arquivos previstos

- `features/panel/calls/components/calls-workspace.tsx`
- `features/panel/calls/model.ts`
- `features/panel/calls/schema.ts`
- `features/panel/calls/actions.ts`
- `features/panel/calls/server/read.ts`
- `features/panel/calls/server/write.ts`

Não é prevista alteração de migration ou pacote.

## Implementação e validação

- A consulta sob demanda usa o restaurante ativo do painel, o cliente Supabase autenticado e RLS existente.
- A paginação busca 26 linhas, exibe até 25 e usa o par `resolved_at`/`id` como cursor de continuação.
- O cursor mantém a precisão original de `timestamptz`; novas tentativas repetem o mesmo cursor da solicitação que falhou.
- Os cartões finalizados são somente leitura; o histórico é recarregado quando a lista ativa muda ou quando Realtime reconecta enquanto a aba está aberta.
- A validação foi estática. Testes, `git`, `typecheck`, `build` e `lint` não foram executados conforme as instruções do projeto.
