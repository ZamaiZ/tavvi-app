import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { getPanelPublicBasePath } from "@/features/panel/auth/navigation"
import { getRequestHostname } from "@/lib/routing/host"

export default async function LegacyPanelSettingsRedirect() {
  const requestHeaders = await headers()
  const base = getPanelPublicBasePath(getRequestHostname(requestHeaders))
  redirect(`${base}/financeiro/configuracoes`)
}
