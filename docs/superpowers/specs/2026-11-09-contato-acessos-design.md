# Acessos e configuração de contato

A página inicial leva ao painel do restaurante; o login deste leva ao login administrativo, respeitando os hosts e caminhos existentes.

No onboarding, telefone e WhatsApp usam máscara brasileira e WhatsApp é obrigatório. CEP possui máscara e consulta ViaCEP com espera após digitação, sem impedir preenchimento manual; CEP, rua, número, bairro, cidade e UF são obrigatórios, complemento é opcional. Rascunhos incompletos permanecem salváveis.

O restaurante informa apenas o perfil do Google Maps. Um link de avaliação é gerado no servidor seguindo a implementação do projeto tavvi; falha impede finalizar quando existe link do Maps. Mudança do Maps invalida a avaliação anterior. Os dois links continuam armazenados separadamente. O formato interno do Google usado pelo projeto de referência pode mudar; erros devem ser visíveis e permitir nova tentativa.

As prévias de imagens salvas devem continuar acessíveis ao navegar entre etapas e após recarregar, com bucket privado e autorização por restaurante. A falha relatada deve ser investigada sem presumir sua causa; erros de imagem devem ser visíveis.

Restrições: não executar git, typecheck, build, lint ou testes. Não adicionar testes.
