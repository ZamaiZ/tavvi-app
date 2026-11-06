import { getRequestHostname, isAdminHostname, isPanelHostname } from "./host"

type HeaderReader = Pick<Headers, "get">
type Surface = "admin" | "panel"

function getSurfaceOrigin(headers: HeaderReader) {
  const hostname = getRequestHostname(headers)
  if (!isAdminHostname(hostname) && !isPanelHostname(hostname)) return null

  const forwardedHost = headers.get("x-forwarded-host")?.split(",")[0].trim()
  const requestHost = headers.get("host")?.split(",")[0].trim()
  const candidate = forwardedHost || requestHost

  if (!candidate || /[\s/?#\\@]/.test(candidate)) return null

  try {
    const parsed = new URL(`http://${candidate}`)
    const forwardedProtocol = headers
      .get("x-forwarded-proto")
      ?.split(",")[0]
      .trim()
      .toLowerCase()
    const protocol =
      forwardedProtocol === "https" || forwardedProtocol === "http"
        ? forwardedProtocol
        : process.env.NODE_ENV === "production"
          ? "https"
          : "http"

    return {
      protocol,
      hostname: parsed.hostname.replace(/^(admin|painel)\./i, ""),
      port: parsed.port,
    }
  } catch {
    return null
  }
}

function getSurfaceHref(
  headers: HeaderReader,
  surface: Surface,
  currentHostSurface: Surface | null
) {
  const route = surface === "admin" ? "/admin/entrar" : "/painel/entrar"

  if (!currentHostSurface) return route
  if (currentHostSurface === surface) return "/entrar"

  const origin = getSurfaceOrigin(headers)
  if (!origin) return "/entrar"

  const hostname = `${surface}.${origin.hostname}`
  return `${origin.protocol}://${hostname}${origin.port ? `:${origin.port}` : ""}/entrar`
}

export function getNotFoundLinks(headers: HeaderReader) {
  const hostname = getRequestHostname(headers)
  const currentHostSurface: Surface | null = isAdminHostname(hostname)
    ? "admin"
    : isPanelHostname(hostname)
      ? "panel"
      : null
  const origin = getSurfaceOrigin(headers)
  const homeHref = currentHostSurface && origin
    ? `${origin.protocol}://${origin.hostname}${origin.port ? `:${origin.port}` : ""}/`
    : "/"

  return {
    homeHref,
    adminSignInHref: getSurfaceHref(headers, "admin", currentHostSurface),
    panelSignInHref: getSurfaceHref(headers, "panel", currentHostSurface),
  }
}
