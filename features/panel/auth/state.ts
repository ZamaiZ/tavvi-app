export type PanelAuthField = "email" | "password"

export type PanelAuthFeedbackCode =
  | "invalid_credentials"
  | "rate_limited"
  | "membership_required"
  | "service_unavailable"

export type PanelAuthFormState =
  | { status: "idle" }
  | { status: "invalid"; fieldErrors: Partial<Record<PanelAuthField, string[]>> }
  | { status: "feedback"; code: PanelAuthFeedbackCode }
  | { status: "success"; destination: string }

export const initialPanelAuthFormState: PanelAuthFormState = { status: "idle" }

export function getPanelAuthFeedback(code: PanelAuthFeedbackCode) {
  switch (code) {
    case "invalid_credentials":
      return {
        title: "Não foi possível entrar",
        description: "Confira seu email e senha e tente novamente.",
      }
    case "rate_limited":
      return {
        title: "Muitas tentativas",
        description: "Aguarde um pouco antes de tentar novamente.",
      }
    case "membership_required":
      return {
        title: "Acesso não encontrado",
        description: "Esta conta ainda não está associada a um restaurante Tavvi.",
      }
    case "service_unavailable":
      return {
        title: "Serviço temporariamente indisponível",
        description: "Não foi possível verificar o acesso agora. Tente novamente em instantes.",
      }
  }
}
