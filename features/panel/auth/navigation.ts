const PANEL_PREFIX = "/painel"

export function getPanelPublicBasePath(hostname: string): "" | "/painel" {
  const normalized = hostname.toLowerCase().replace(/\.$/, "")
  if (normalized === "painel.localhost" || normalized.startsWith("painel.")) return ""
  return PANEL_PREFIX
}

export function getPanelEntryPath(
  status: "draft" | "active" | "suspended",
  onboardingStep: "identity" | "contact",
  publicBasePath: "" | "/painel",
) {
  const path = status === "draft"
    ? `/onboarding/${onboardingStep === "contact" ? "contato" : "identidade"}`
    : status === "suspended" ? "/suspenso" : "/cardapio"
  return publicBasePath + path
}

export function getPanelSignInPath(publicBasePath: "" | "/painel") {
  return publicBasePath + "/entrar"
}

export function getPanelRestaurantsPath(publicBasePath: "" | "/painel") {
  return publicBasePath + "/restaurantes"
}
