import "server-only"

import { createServerClient, type CookieOptions } from "@supabase/ssr"
import type { NextRequest } from "next/server"

import { getSupabaseCookieOptions, getSupabasePublicEnv, type AuthSurface } from "./config"

type RefreshedCookie = {
  name: string
  value: string
  options: CookieOptions
}

type SessionRefresh = {
  cookies: RefreshedCookie[]
  headers: Record<string, string>
}

export async function refreshSupabaseSession(
  request: NextRequest,
  surface: AuthSurface,
): Promise<SessionRefresh> {
  const cookieName = getSupabaseCookieOptions(surface).name
  const hasSessionCookie = request.cookies
    .getAll()
    .some(({ name }) => name === cookieName || name.startsWith(cookieName + "."))

  if (!hasSessionCookie) {
    return { cookies: [], headers: {} }
  }

  const { url, publishableKey } = getSupabasePublicEnv()
  let refreshedCookies: RefreshedCookie[] = []
  let responseHeaders: Record<string, string> = {}

  const supabase = createServerClient(url, publishableKey, {
    cookieOptions: getSupabaseCookieOptions(surface),
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })
        refreshedCookies = cookiesToSet
        responseHeaders = { ...headers }
      },
    },
  })

  await supabase.auth.getClaims()

  return { cookies: refreshedCookies, headers: responseHeaders }
}