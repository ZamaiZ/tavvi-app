# Financeiro e Caixa Diário Implementation Plan

> Status: escopo confirmado implementado e revisado estaticamente. Gorjetas, estornos e correções de consumo continuam fora desta entrega, conforme a especificação.

> **Para quem implementar:** siga as tarefas na ordem. As etapas usam caixas para acompanhar o progresso. Não crie nem execute testes, build, lint, typecheck ou comandos Git: o AGENTS.md do repositório proíbe esses comandos.

**Goal:** Implementar o dashboard financeiro por período, as sessões físicas diárias, as despesas categorizadas e a integração de pagamentos/fechamento descritas na especificação.

**Architecture:** O Financeiro terá um modelo de leitura agregado no Postgres e uma página de consulta separada. Uma nova camada de caixa físico guarda sessões e movimentações imutáveis; RPCs autenticadas vinculam pagamentos à sessão aberta e recalculam conciliação. A rota Caixa integra esse estado às comandas existentes; configurações mantêm as formas fixas e personalizadas.

**Tech Stack:** Next.js 16.4.6 App Router, React Server/Client Components, Server Actions, Supabase/Postgres RPCs com RLS, Zod, shadcn local, react-day-picker/date-fns, Recharts e Motion.

**Spec:** `docs/superpowers/specs/2026-11-17-financeiro-caixa-design.md`

## Global Constraints

- `AGENTS.md`: não executar `git`, `typecheck`, `build`, `lint` nem `test`; não trabalhar com testes.
- Preservar `__BASE.MD` como referência de produto e os contratos de pedidos/chamados já existentes.
- Valores monetários permanecem em centavos inteiros; operações concorrentes e idempotentes são validadas no banco.
- Resumos financeiros são agregados no Postgres e segmentados por restaurante; Caixa carrega somente os 12 eventos recentes da sessão.
- Antes de alterações no App Router, seguir os guias locais do Next 16.4.6 sobre páginas, componentes servidor/cliente, data fetching, mutações e erro.
- Usar componentes e dependências existentes. Respeitar `prefers-reduced-motion`, acessibilidade e layout desktop/celular.

## Review Focus

- Concorrência na abertura/pagamento/fechamento: locks e request IDs preservam uma única sessão e evitam lançamento duplicado.
- Pagamento em dinheiro, PIX e meios personalizados: somente dinheiro muda o valor esperado; rótulos de meios usados ficam congelados no histórico.
- Sessão atravessando meia-noite: continua atribuída à data operacional de abertura, enquanto relatórios usam datas de calendário locais.
- Diferença de caixa e saldo em comanda: fechamento exige justificativa e não mistura conta pendente com dinheiro recebido.
- Despesa em dinheiro: deve reduzir a gaveta e contar uma única vez como despesa, sem duplicação por uma retirada separada.

---

### Task 1: Registrar o contrato financeiro e a persistência — concluída

**Files:**
- Create: `docs/superpowers/specs/2026-11-17-financeiro-caixa-design.md`
- Create: `supabase/migrations/20261117100000_panel_finance_and_cash_sessions.sql`
- Modify: `__BASE.MD`

- [x] Atualizar a base com as decisões confirmadas: sessão até fechamento explícito, fuso padrão, despesas categorizadas, PIX e métodos personalizados.
- [x] Criar schema de sessões, movimentos financeiros/despesas e métodos personalizados; adicionar vínculo sessão-pagamento, snapshots de rótulos e índices por restaurante/data.
- [x] Criar RLS de leitura por membership e revogar escritas diretas; criar RPCs SECURITY DEFINER para configuração, abertura, movimentação, fechamento e leitura agregada.
- [x] Preservar o tratamento histórico das linhas já existentes e validar invariantes/ids de requisição dentro das transações.

### Task 2: Tipos, validação e ações do servidor — concluída

**Files:**
- Create: `features/panel/cash/model.ts`, `schema.ts`, `actions.ts`, `server/read.ts`, `server/write.ts`
- Create: `features/panel/finance/model.ts`, `schema.ts`, `server/read.ts`
- Modify: `features/panel/orders/model.ts`, `schema.ts`, `server/payment-write.ts`, `actions.ts`
- Modify: `features/panel/settings/model.ts`, `schema.ts`, `server/read.ts`, `server/write.ts`, `actions.ts`

- [x] Definir DTOs e códigos de falha para sessões, movimentos, relatórios e formas de pagamento.
- [x] Validar entradas com Zod; ações revalidam membership/restaurante ativo e enviam apenas referências e campos alteráveis às RPCs.
- [x] Vincular pagamento à sessão aberta no banco; adaptar leituras para incluir métodos personalizados e snapshots históricos.
- [x] Retornar erros esperados como valores e não expor linhas brutas do banco ao cliente.

### Task 3: Configurações de pagamento — concluída

**Files:**
- Modify: `features/panel/payments/model.ts`
- Modify: `features/panel/settings/components/payment-settings-page.tsx`
- Modify: `features/panel/orders/components/comanda-payment-dialog.tsx`
- Modify: `app/painel/(workspace)/configuracoes/page.tsx`
- Create: `app/painel/(workspace)/financeiro/configuracoes/page.tsx`

- [x] Adicionar PIX às opções padrão e deixá-lo configurável.
- [x] Permitir incluir, editar rótulo e desativar meios personalizados; manter pelo menos uma forma ativa. Rótulos usados são preservados por snapshot.
- [x] Atualizar seletor de pagamento para carregar rótulos configurados e persistir identificadores de meios.
- [x] Encaminhar a rota antiga de configurações para a nova área financeira.

### Task 4: Operação da sessão física dentro de Caixa — concluída

**Files:**
- Create: `features/panel/cash/components/cash-session-panel.tsx`
- Modify: `features/panel/orders/components/cash-workspace.tsx`
- Modify: `app/painel/(workspace)/caixa/page.tsx`, `loading.tsx`, `error.tsx`

- [x] Exibir estado de caixa fechado/aberto e formulário de abertura por valor total.
- [x] Permitir reforço, retirada e despesa categorizada; despesa em dinheiro vinculada à sessão reduz o saldo esperado uma vez.
- [x] Exibir esperado, contado e diferença ao fechar; exigir motivo para divergência.
- [x] Bloquear fechamento normal com comandas em atendimento; oferecer fechamento excepcional justificado e transporte de saldo pendente.
- [x] Manter skeleton, retry, estados vazios e atualização da página Caixa após mutações/eventos.

### Task 5: Relatório agregado e dashboard Financeiro — concluída

**Files:**
- Create: `features/panel/finance/components/finance-dashboard.tsx`
- Create: `features/panel/finance/components/finance-dashboard-skeleton.tsx`
- Create: `features/panel/finance/components/finance-date-filter.tsx`
- Create: `app/painel/(workspace)/financeiro/page.tsx`, `loading.tsx`, `error.tsx`
- Modify: `supabase/migrations/20261117100000_panel_finance_and_cash_sessions.sql`

- [x] Agregar vendas, recebimentos, despesas e saldo pendente por intervalo no fuso do restaurante.
- [x] Implementar filtro de data com hoje como padrão, presets úteis e intervalo customizado serializado em `YYYY-MM-DD`.
- [x] Apresentar cards separados, gráfico de vendas/recebimentos, composição de recebimentos/despesas por forma e categoria e conciliação dos caixas encerrados; valores pendentes não entram em recebido.
- [x] Manter skeleton, erro com retry, empty state e animação sequencial com suporte a movimento reduzido.

### Task 6: Navegação e entrada inicial — concluída

**Files:**
- Modify: `features/panel/auth/navigation.ts`
- Modify: `features/panel/shell/components/panel-app-shell.tsx`
- Modify: `features/panel/shell/components/panel-mobile-dock.tsx`

- [x] Tornar `/financeiro` o destino padrão do restaurante ativo.
- [x] Adicionar Financeiro à navegação desktop e móvel, com seção ativa, ícone e links de configurações.
- [x] Preservar os fluxos de onboarding, restaurante suspenso e seleção de restaurante.

### Task 7: Revisão final permitida — concluída

**Files:** todos os arquivos das tarefas anteriores.

- [x] Revisar estaticamente SQL, RPCs, referências TypeScript, estados e caminhos alterados; não executar comandos proibidos pelo AGENTS.md.
- [x] Registrar no resumo que não foram executados testes, build, lint, typecheck ou comandos Git, conforme o AGENTS.md.
