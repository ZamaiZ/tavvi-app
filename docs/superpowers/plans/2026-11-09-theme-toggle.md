# Toggle de tema — plano de implementação

> **Execução:** implementar nativamente nesta sessão, seguindo os shells atuais do projeto.

**Objetivo:** disponibilizar a troca manual entre tema claro e escuro nas superfícies Tavvi que hoje não têm um controle visível.

**Arquitetura:** criar um botão client reutilizável que usa o `ThemeProvider` existente e montá-lo nos cabeçalhos e shells próprios de cada superfície. Manter o seletor Claro/Escuro/Sistema da área Admin e não alterar os dados de identidade visual do restaurante.

**Stack:** Next.js 16 App Router, React 19, `next-themes`, `motion/react`, `react-icons/lu`, `components/ui/button` e tokens Tailwind existentes.

**Spec:** `docs/superpowers/specs/2026-11-09-theme-toggle-design.md`.

## Restrições globais

- Não executar `git`, `typecheck`, `build`, `lint` ou `test`.
- Não criar testes.
- Não adicionar dependências nem mexer no provider, na persistência global ou no comportamento Sistema.
- Todo estado visual dependente de `resolvedTheme` deve começar de forma determinística para evitar diferença entre SSR e hidratação.
- Respeitar movimento reduzido, foco por teclado e alvo de toque de 44 × 44 px.

## Foco de revisão

- Hidratação inicial: ícone e nome acessível têm saída inicial estável e não deslocam o layout.
- Responsividade do auth: um botão aparece em cada breakpoint sem ficar sobre a marca ou o badge.
- Controles externos ao auth: botão não cobre o conteúdo central ou ações nas telas compactas.
- Preferências: cada clique alterna a partir de `resolvedTheme`; menu Admin continua oferecendo Sistema.
- Acessibilidade e movimento: label de ação, foco visível, alvo mínimo e animação desativada/reduzida para quem preferir.

## Tarefas

### Tarefa 1: Criar o botão global reutilizável

**Arquivos:**
- Criar `components/theme-toggle.tsx`.

**Interface:**
- Exportar `ThemeToggle` com `className?: string` opcional.
- Usar `useTheme()`; alternar para `light` quando `resolvedTheme` for `dark`, e para `dark` nos demais casos após a hidratação.
- Renderizar `Button` com variante discreta, alvo mínimo 44 × 44 px, ícone Sun/Moon, `type="button"`, `title` e `aria-label` que anunciem o tema de destino.
- Animar apenas a troca do ícone via `motion/react`; respeitar movimento reduzido e preservar tamanho/posição.
- Manter o primeiro render igual no servidor e cliente; reservar o espaço do ícone antes da montagem.

- [x] Implementar o componente e sua interface.
- [x] Fazer revisão estática do nome acessível, hidratação e classes do botão.

### Tarefa 2: Integrar nos shells e páginas institucionais

**Arquivos:**
- Modificar `app/page.tsx`.
- Modificar `components/not-found/not-found-experience.tsx` e `components/not-found/not-found-experience.module.css`.
- Modificar `features/admin/auth/components/admin-auth-shell.tsx`.
- Modificar `features/panel/onboarding/components/onboarding-wizard.tsx`.

**Interface consumida:** `ThemeToggle` criado na Tarefa 1.

- [x] Página raiz: posicionar o botão no canto superior direito sem alterar o alinhamento central da mensagem.
- [x] 404: agrupar o botão com o status no cabeçalho e manter a marca alinhada.
- [x] Shell de autenticação: colocar o botão junto aos controles de marca/badge no móvel e junto à marca no hero desktop; mostrar somente a instância do breakpoint ativo.
- [x] Wizard: colocar o botão ao lado do status de salvamento nos passos identidade e contato.
- [x] Conferir por leitura que os temas/presets do restaurante no wizard continuam sem relação com o tema Tavvi.

### Tarefa 3: Integrar nas superfícies do Painel

**Arquivos:**
- Modificar `features/panel/invites/components/invite-redemption-page.tsx`.
- Modificar `app/painel/convite/loading.tsx`.
- Modificar `features/panel/workspace/components/panel-restaurant-picker.tsx`.
- Modificar `features/panel/workspace/components/panel-suspended-state.tsx`.
- Modificar `features/panel/workspace/components/panel-menu-template.tsx`.

**Interface consumida:** `ThemeToggle` criado na Tarefa 1.

- [x] Convite: colocar botão no canto superior direito da página de aceite.
- [x] Carregamento do convite: incluir o mesmo botão no skeleton, alinhado ao estado final.
- [x] Escolha de restaurante e suspensão: disponibilizar ação sem sobrepor cabeçalho ou cartão.
- [x] Cardápio do Painel: agrupar o botão com o badge de status no cabeçalho responsivo.

### Tarefa 4: Revisão final estática

**Arquivos:** todos os arquivos listados acima.

- [x] Conferir os pontos de integração para cada superfície enumerada na spec e confirmar que não há controle duplicado na área Admin.
- [x] Conferir imports, estado inicial determinístico, labels, foco, tokens e respeito a movimento reduzido por leitura dos arquivos alterados.
- [x] Manter os comandos proibidos sem execução; não criar nem rodar testes.
