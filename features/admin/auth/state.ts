export type AdminAuthField =
  | "name"
  | "email"
  | "password"
  | "passwordConfirmation"

export type AdminAuthFeedbackCode =
  | "invalid_credentials"
  | "rate_limited"
  | "registration_closed"
  | "email_unavailable"
  | "registration_incomplete"
  | "claim_retryable"
  | "service_unavailable"
  | "unexpected"

export type AdminAuthFormState =
  | { status: "idle" }
  | {
      status: "invalid"
      fieldErrors: Partial<Record<AdminAuthField, string[]>>
    }
  | { status: "feedback"; code: AdminAuthFeedbackCode }
  | {
      status: "success"
      kind: "login" | "registration"
      destination: string
    }

export type AdminAuthOperationResult =
  | { status: "success" }
  | { status: "feedback"; code: AdminAuthFeedbackCode }

export const initialAdminAuthFormState: AdminAuthFormState = {
  status: "idle",
}

export function getAdminAuthFeedback(code: AdminAuthFeedbackCode) {
  switch (code) {
    case "invalid_credentials":
      return {
        title: "Não foi possível entrar",
        description: "Email ou senha inválidos. Confira os dados e tente novamente.",
      }
    case "rate_limited":
      return {
        title: "Muitas tentativas",
        description: "Aguarde alguns minutos e tente novamente.",
      }
    case "registration_closed":
      return {
        title: "Cadastro concluído",
        description: "O cadastro inicial do Admin já foi concluído.",
      }
    case "email_unavailable":
      return {
        title: "Não foi possível criar a conta",
        description:
          "Não foi possível criar a conta com esses dados. Se você já possui acesso, tente entrar.",
      }
    case "registration_incomplete":
      return {
        title: "Não foi possível concluir o acesso",
        description:
          "Verifique a configuração do ambiente ou fale com o responsável.",
      }
    case "claim_retryable":
      return {
        title: "Ativação pendente",
        description:
          "Sua conta foi criada, mas a ativação não terminou. Tente concluir novamente.",
      }
    case "service_unavailable":
      return {
        title: "Serviço indisponível",
        description:
          "Não conseguimos conectar ao serviço agora. Verifique sua conexão e tente novamente.",
      }
    case "unexpected":
      return {
        title: "Não foi possível processar",
        description: "Tente novamente.",
      }
  }
}
