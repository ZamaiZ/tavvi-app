import { NextResponse, type NextRequest } from "next/server"

import { refreshSupabaseSession } from "@/lib/supabase/proxy"
import type { AuthSurface } from "@/lib/supabase/config"
import { getRequestHostname, isAdminHostname } from "@/lib/routing/host"

function isStaticAsset(pathname: string) {
  if (pathname.startsWith("/_next/") || pathname === "/_next") {
    return true
  }

  const finalSegment = pathname.substring(pathname.lastIndexOf("/") + 1)
  return finalSegment.includes(".")
}

function getSurface(hostname: string, pathname: string): AuthSurface | null {
  if (isAdminHostname(hostname)) {
    return "admin"
  }

  if (hostname === "painel.localhost") {
    return "panel"
  }

  const firstSegment = pathname.split("/")[1]

  if (firstSegment === "admin") {
    return "admin"
  }

  if (firstSegment === "painel") {
    return "panel"
  }

  return null
}

function getHostRewritePrefix(hostname: string) {
  if (isAdminHostname(hostname)) {
    return "/admin"
  }

  if (hostname === "painel.localhost") {
    return "/painel"
  }

  return null
}

function getHostRewrite(request: NextRequest, hostname: string): URL | null {
  const pathname = request.nextUrl.pathname
  const prefix = getHostRewritePrefix(hostname)

  if (!prefix || pathname === prefix || pathname.startsWith(prefix + "/")) {
    return null
  }

  const rewrittenUrl = request.nextUrl.clone()
  rewrittenUrl.pathname = prefix + (pathname === "/" ? "" : pathname)
  return rewrittenUrl
}

function getAdminCanonicalRedirect(
  request: NextRequest,
  hostname: string
): URL | null {
  if (!isAdminHostname(hostname)) {
    return null
  }

  const pathname = request.nextUrl.pathname

  if (pathname !== "/admin" && !pathname.startsWith("/admin/")) {
    return null
  }

  const canonicalUrl = request.nextUrl.clone()
  canonicalUrl.pathname = pathname.slice("/admin".length) || "/"
  return canonicalUrl
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (isStaticAsset(pathname)) {
    return NextResponse.next()
  }

  const hostname = getRequestHostname(request.headers, request.nextUrl.hostname)
  const canonicalUrl = getAdminCanonicalRedirect(request, hostname)

  if (canonicalUrl) {
    return NextResponse.redirect(canonicalUrl, 308)
  }

  const scope = getSurface(hostname, pathname)
  const refresh = scope
    ? await refreshSupabaseSession(request, scope)
    : { cookies: [], headers: {} }
  const rewrittenUrl = getHostRewrite(request, hostname)
  const hasRequestUpdates = refresh.cookies.length > 0
  const requestInit = hasRequestUpdates
    ? { request: { headers: request.headers } }
    : undefined
  const response = rewrittenUrl
    ? NextResponse.rewrite(rewrittenUrl, requestInit)
    : NextResponse.next(requestInit)

  refresh.cookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options)
  })

  Object.entries(refresh.headers).forEach(([name, value]) => {
    response.headers.set(name, value)
  })

  return response
}

export const config = {
  matcher: ["/:path*"],
}
