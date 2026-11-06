import "server-only"

import { notFound } from "next/navigation"

import type { AuthSurface } from "@/lib/supabase/config"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function requireAuthenticatedSurface(
  surface: AuthSurface
): Promise<void> {
  const supabase = await createSupabaseServerClient(surface)
  const { data, error } = await supabase.auth.getClaims()

  if (error || !data?.claims?.sub) {
    notFound()
  }
}
