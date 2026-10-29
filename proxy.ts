import { NextResponse, type NextRequest } from "next/server"

import { refreshSupabaseSession } from "@/lib/supabase/proxy"
import type { AuthSurface } from "@/lib/supabase/config"

function isStaticAsset(pathname: string) {
  if (pathname.startsWith("/_next/") || pathname === "/_next") {
    return true
  }

  const finalSegment = pathname.substring(pathname.lastIndexOf("/") + 1)
  return finalSegment.includes(".")
}

function getSurface(hostname: string, pathname: string): AuthSurface | null {
  if (hostname === "admin.localhost") {
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

function getLocalRewrite(request: NextRequest): URL | null {
  const hostname = request.nextUrl.hostname.toLowerCase()
  const pathname = request.nextUrl.pathname
  let prefix: string | null = null

  if (hostname === "admin.localhost") {
    prefix = "/admin"
  } else if (hostname === "painel.localhost") {
    prefix = "/painel"
  }

  if (!prefix || pathname === prefix || pathname.startsWith(prefix + "/")) {
    return null
  }

  const rewrittenUrl = request.nextUrl.clone()
  rewrittenUrl.pathname = prefix + (pathname === "/" ? "" : pathname)
  return rewrittenUrl
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (isStaticAsset(pathname)) {
    return NextResponse.next()
  }

  const scope = getSurface(request.nextUrl.hostname.toLowerCase(), pathname)
  const refresh = scope ? await refreshSupabaseSession(request, scope) : { cookies: [], headers: {} }
  const rewrittenUrl = getLocalRewrite(request)
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