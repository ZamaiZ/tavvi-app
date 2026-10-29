import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { getSupabaseCookieOptions, getSupabasePublicEnv, type AuthSurface } from "./config"

export async function createSupabaseServerClient(surface: AuthSurface) {
  const { url, publishableKey } = getSupabasePublicEnv()
  const cookieStore = await cookies()

  return createServerClient(url, publishableKey, {
    cookieOptions: getSupabaseCookieOptions(surface),
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Components cannot mutate cookies; Proxy refreshes them before rendering.
        }
      },
    },
  })
}