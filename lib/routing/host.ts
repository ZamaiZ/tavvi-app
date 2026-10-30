type HeaderReader = Pick<Headers, "get">

function parseHostname(value: string | null | undefined): string | null {
  const candidate = value?.split(",")[0].trim()

  if (!candidate || /[\s/?#\\@]/.test(candidate)) {
    return null
  }

  try {
    return new URL(`http://${candidate}`).hostname.toLowerCase().replace(/\.$/, "")
  } catch {
    return null
  }
}

export function getRequestHostname(
  headers: HeaderReader,
  fallbackHostname?: string
) {
  return (
    parseHostname(headers.get("x-forwarded-host")) ??
    parseHostname(headers.get("host")) ??
    parseHostname(fallbackHostname) ??
    ""
  )
}

export function isAdminHostname(hostname: string) {
  const normalizedHostname = parseHostname(hostname) ?? hostname.toLowerCase()

  return (
    normalizedHostname === "admin.localhost" ||
    (normalizedHostname.startsWith("admin.") &&
      normalizedHostname.length > "admin.".length)
  )
}
