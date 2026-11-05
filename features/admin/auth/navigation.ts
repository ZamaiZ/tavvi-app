import { isAdminHostname } from "@/lib/routing/host"

const ADMIN_PREFIX = "/admin"
const PANEL_PREFIX = "/painel"
const SAFE_NEXT_ORIGIN = "https://admin.tavvi.invalid"

function isPathWithin(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(prefix + "/")
}

function safePathOnly(value: string): string | null {
  if (
    value.length > 2048 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u001f\u007f?#]/.test(value) ||
    /%(?:2f|5c|00|0[0-9a-f]|1[0-9a-f])/i.test(value)
  ) {
    return null
  }

  let parsed: URL

  try {
    parsed = new URL(value, SAFE_NEXT_ORIGIN)
  } catch {
    return null
  }

  if (
    parsed.origin !== SAFE_NEXT_ORIGIN ||
    parsed.pathname.includes("//") ||
    parsed.pathname.includes("\\")
  ) {
    return null
  }

  for (const segment of parsed.pathname.split("/")) {
    let decodedSegment: string

    try {
      decodedSegment = decodeURIComponent(segment)
    } catch {
      return null
    }

    if (
      decodedSegment === "." ||
      decodedSegment === ".." ||
      decodedSegment.includes("/") ||
      decodedSegment.includes("\\") ||
      /[\u0000-\u001f\u007f]/.test(decodedSegment)
    ) {
      return null
    }
  }

  return parsed.pathname
}

export function normalizeAdminNextPath(
  value: string | null | undefined,
  publicBasePath: "" | "/admin"
): string | null {
  if (!value) {
    return null
  }

  const pathname = safePathOnly(value)

  if (!pathname || isPathWithin(pathname, PANEL_PREFIX)) {
    return null
  }

  if (publicBasePath === ADMIN_PREFIX) {
    if (!isPathWithin(pathname, ADMIN_PREFIX)) {
      return null
    }

    return pathname
  }

  if (isPathWithin(pathname, ADMIN_PREFIX)) {
    return null
  }

  return pathname
}

export function getAdminPublicBasePath(hostname: string): "" | "/admin" {
  if (isAdminHostname(hostname)) {
    return ""
  }

  // These helpers are called only from Admin pages and actions. Any other host
  // is the path-prefixed local/Preview surface.
  return ADMIN_PREFIX
}

export function getAdminHomePath(publicBasePath: "" | "/admin") {
  return publicBasePath || "/"
}

export function getAdminRestaurantsPath(publicBasePath: "" | "/admin") {
  return publicBasePath + "/restaurantes"
}
