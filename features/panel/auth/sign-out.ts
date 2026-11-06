"use server"

import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { clearActivePanelRestaurantId } from "@/features/panel/workspace/server/active-restaurant-cookie"
import { getPanelSignInPath, getPanelPublicBasePath } from "@/features/panel/auth/navigation"
import { getRequestHostname } from "@/lib/routing/host"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function signOutPanelAction() {
  const supabase = await createSupabaseServerClient("panel")
  await supabase.auth.signOut({ scope: "local" })
  await clearActivePanelRestaurantId()
  const requestHeaders = await headers()
  redirect(getPanelSignInPath(getPanelPublicBasePath(getRequestHostname(requestHeaders))))
}
