export const PANEL_ONBOARDING_ERROR_CODES = [
  "invalid_input", "invalid_request", "image_invalid", "context_changed", "session_expired", "restaurant_unavailable",
  "storage_policy_denied", "storage_unavailable", "database_error", "database_response",
  "network_error", "unexpected_response", "review_invalid", "review_unavailable", "unavailable",
] as const

export type PanelOnboardingErrorCode = typeof PANEL_ONBOARDING_ERROR_CODES[number]

const messages: Record<PanelOnboardingErrorCode, string> = {
  invalid_input: "Alguns dados não foram aceitos. Revise os campos e tente novamente.",
  invalid_request: "A solicitação de salvamento não foi aceita. Atualize a página e tente novamente.",
  image_invalid: "A imagem enviada é inválida ou ultrapassa 5 MB. Escolha um arquivo JPG, PNG ou WebP válido.",
  context_changed: "O restaurante ativo mudou ou não está mais em configuração. Atualize a página antes de continuar.",
  session_expired: "Sua sessão expirou. Entre novamente para continuar.",
  restaurant_unavailable: "Não foi possível consultar o restaurante. Tente novamente em instantes.",
  storage_policy_denied: "Você não tem permissão para salvar a imagem. Confira seu acesso ao restaurante.",
  storage_unavailable: "Não foi possível salvar a imagem. Ela permanece na tela; tente novamente.",
  database_error: "O banco de dados não conseguiu concluir a operação. Tente novamente ou informe o código ao suporte.",
  database_response: "O banco retornou uma resposta inesperada. Informe o código ao suporte.",
  network_error: "Não foi possível conectar ao servidor. Confira sua conexão e tente novamente.",
  unexpected_response: "O servidor retornou uma resposta inesperada. Informe o código ao suporte.",
  review_invalid: "Não foi possível identificar um restaurante nesse link do Google Maps. Confira o perfil informado.",
  review_unavailable: "Não foi possível consultar o Google agora. Tente finalizar novamente em instantes.",
  unavailable: "Ocorreu uma falha inesperada. Tente novamente ou informe o código ao suporte.",
}

export function panelOnboardingErrorMessage(code: PanelOnboardingErrorCode) {
  return `${messages[code]} (Código: ${code})`
}
