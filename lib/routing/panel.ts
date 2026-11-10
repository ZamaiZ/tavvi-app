import "server-only"

function getPanelBaseUrl() {
  const value = process.env.TAVVI_PANEL_BASE_URL?.trim()

  if (!value) {
    throw new Error("TAVVI_PANEL_BASE_URL is required to create invite links.")
  }

  let parsedUrl: URL

  try {
    parsedUrl = new URL(value)
  } catch {
    throw new Error("TAVVI_PANEL_BASE_URL must be a valid URL.")
  }

  if (
    (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") ||
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.search ||
    parsedUrl.hash ||
    !["", "/", "/painel"].includes(parsedUrl.pathname.replace(/\/$/, "")) ||
    (process.env.NODE_ENV === "production" && parsedUrl.protocol !== "https:")
  ) {
    throw new Error("TAVVI_PANEL_BASE_URL is not a valid Panel base URL.")
  }

  return parsedUrl
}

export function createPanelInviteUrl(token: string) {
  const panelUrl = getPanelBaseUrl()
  const panelPrefix = panelUrl.pathname.replace(/\/$/, "")

  panelUrl.pathname = `${panelPrefix}/convite`
  panelUrl.searchParams.set("token", token)

  return panelUrl.toString()
}

export function createPublicRestaurantUrl(slug: string) {
  const panelUrl = getPanelBaseUrl()
  const hostname = panelUrl.hostname.toLowerCase()
  if (hostname === "painel.localhost") {
    panelUrl.hostname = "localhost"
  } else if (hostname.startsWith("painel.")) {
    panelUrl.hostname = hostname.slice("painel.".length)
  } else if (panelUrl.pathname.replace(/\/$/, "") !== "/painel") {
    throw new Error("TAVVI_PANEL_BASE_URL must use the painel subdomain or /painel path to derive public restaurant links.")
  }

  panelUrl.pathname = `/${encodeURIComponent(slug)}`
  panelUrl.search = ""
  panelUrl.hash = ""
  return panelUrl.toString()
}
