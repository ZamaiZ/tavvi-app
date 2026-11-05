import { headers } from "next/headers"

import { AdminAppShell } from "@/features/admin/shell/components/admin-app-shell"
import { AdminRestaurantsPageSkeleton } from "@/features/admin/restaurants/components/admin-restaurants-page-skeleton"
import { getAdminPublicBasePath } from "@/features/admin/auth/navigation"
import { getRequestHostname } from "@/lib/routing/host"

export default async function Loading() {
  const requestHeaders = await headers()
  const publicBasePath = getAdminPublicBasePath(
    getRequestHostname(requestHeaders)
  )

  return (
    <AdminAppShell
      publicBasePath={publicBasePath}
      activeItem="restaurants"
    >
      <AdminRestaurantsPageSkeleton />
    </AdminAppShell>
  )
}
