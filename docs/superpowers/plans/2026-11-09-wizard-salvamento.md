# Plano: salvamento e diagnóstico do onboarding

**Objetivo:** corrigir ativação e prévias e tornar falhas distinguíveis.

**Arquitetura:** migrações corrigem validação e políticas; Server Actions e rota multipart compartilham códigos tipados; a interface traduz os códigos e preserva o contexto; logs técnicos são restritos ao servidor.

**Especificação:** `docs/superpowers/specs/2026-11-09-wizard-salvamento-design.md`.

1. Corrigir a expressão na migração pendente e criar migração posterior para corrigir a função existente e políticas sem apagar dados.
2. Mapear validação, sessão, contexto, banco, resposta, rede, armazenamento e Google em códigos estáveis e registrar falhas no servidor sem dados sensíveis.
3. Exibir mensagens e tentativa apropriadas no wizard; identificar falha de prévia e preservar imagem enviada.
4. Aplicar as migrações ao banco local autorizado e revisar os resultados disponíveis sem executar comandos proibidos.
