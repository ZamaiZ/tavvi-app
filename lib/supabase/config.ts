import type { CookieOptionsWithName } from "@supabase/ssr"

export type AuthSurface = "admin" | "panel"

const authCookieNames: Record<AuthSurface, string> = {
  admin: "tavvi-admin-auth-token",
  panel: "tavvi-panel-auth-token",
}

export function getSupabaseCookieOptions(surface: AuthSurface) {
  return {
    name: authCookieNames[surface],
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  } satisfies CookieOptionsWithName
}

export function getSupabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required to create a Supabase client.")
  }

  if (!publishableKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required to create a Supabase client.")
  }

  let parsedUrl: URL

  try {
    parsedUrl = new URL(url)
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid URL.")
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must use HTTP or HTTPS.")
  }

  return { url, publishableKey }
}