# Acessos e contato — plano de implementação

**Objetivo:** completar a navegação, o contato do onboarding e a recuperação das prévias.

**Arquitetura:** usar rotas conscientes do host já existentes; manter rascunhos flexíveis e validar conclusão no cliente, servidor e banco; resolver Maps no servidor com redirecionamentos restritos; acessar as imagens privadas por rota autenticada da mesma origem.

**Tecnologia:** Next.js 16, React, Zod, Supabase e ViaCEP. Especificação: `docs/superpowers/specs/2026-11-09-contato-acessos-design.md`.

1. Adaptar os links da página inicial e login, considerando subdomínios e caminhos locais.
2. Adicionar máscaras e consulta de CEP cancelável, preservar alterações manuais, exibir mensagens e validar campos individualmente.
3. Adaptar o resolvedor do projeto tavvi com restrição de hosts; invalidar o resultado quando o Maps mudar e resolver novamente na conclusão.
4. Atualizar validação de conclusão no banco por migração, mantendo rascunhos e dados existentes.
5. Investigar prévias e usar recuperação autenticada das imagens salvas, incluindo erro de carregamento.
6. Revisar os caminhos e a consistência das alterações por leitura; não executar comandos proibidos nem criar testes.
