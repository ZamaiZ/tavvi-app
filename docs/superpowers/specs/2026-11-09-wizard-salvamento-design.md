# Correção de salvamento e diagnóstico do onboarding

O onboarding deve salvar rascunhos, ativar perfis válidos e apresentar as imagens privadas já enviadas. As falhas identificadas são a expressão regular `{10,300}`, acima do limite suportado pelo PostgreSQL, e políticas de leitura que usam o nome do restaurante no lugar do caminho do objeto.

Corrigir a validação sem reduzir o limite de 300 caracteres do identificador; corrigir as políticas para usar `storage.objects.name`, mantendo a autorização de membro e a leitura anônima apenas de restaurantes ativos. Preservar dados e arquivos existentes.

Erros do cliente, validação, sessão, contexto, banco, resposta inesperada, rede, upload, prévia, Google e CEP devem chegar com um código e mensagem apropriados. Informações técnicas úteis devem ser registradas no servidor sem dados do perfil, tokens ou URLs completas. Quando a origem não puder ser determinada, informar erro inesperado sem atribuir causa falsa. Preservar o rascunho e permitir nova tentativa da operação que falhou.

Não executar git, testes, build, lint ou typecheck; não criar testes.
