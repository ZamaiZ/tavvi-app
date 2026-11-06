import type { Metadata } from "next"
import { Suspense } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { AdminAppShell } from "@/features/admin/shell/components/admin-app-shell"
import { AdminRestaurantsPage } from "@/features/admin/restaurants/components/admin-restaurants-page"
import { AdminRestaurantsPageSkeleton } from "@/features/admin/restaurants/components/admin-restaurants-page-skeleton"
import { restaurantListQuerySchema } from "@/features/admin/restaurants/schema"
import {
  listPlatformRestaurants,
  RestaurantAccessError,
} from "@/features/admin/restaurants/server/restaurants"
import { getAdminPublicBasePath } from "@/features/admin/auth/navigation"
import { getRequestHostname } from "@/lib/routing/host"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { requireAuthenticatedSurface } from "@/lib/supabase/require-authenticated-surface"

export const metadata: Metadata = {
  title: "Restaurantes",
}

type SearchParams = Record<string, string | string[] | undefined>

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

async function AdminRestaurantsContent({
  searchParams,
  loginPath,
}: {
  searchParams: Promise<SearchParams>
  loginPath: string
}) {
  const rawParams = await searchParams
  const parsedQuery = restaurantListQuerySchema.safeParse({
    search: firstValue(rawParams.search) ?? "",
    status: firstValue(rawParams.status) ?? "all",
    page: firstValue(rawParams.page) ?? "1",
    pageSize: firstValue(rawParams.pageSize) ?? "25",
  })
  const initialQuery = parsedQuery.success
    ? parsedQuery.data
    : restaurantListQuerySchema.parse({})

  try {
    const initialData = await listPlatformRestaurants(initialQuery)
    return (
      <AdminRestaurantsPage
        initialQuery={initialQuery}
        initialData={initialData}
        initialError={false}
      />
    )
  } catch (error) {
    if (error instanceof RestaurantAccessError) {
      try {
        const supabase = await createSupabaseServerClient("admin")
        await supabase.auth.signOut({ scope: "local" })
      } catch {
        // O RPC segue sendo a autoridade; a limpeza da sessão é best-effort.
      }
      redirect(loginPath)
    }

    return (
      <AdminRestaurantsPage
        initialQuery={initialQuery}
        initialData={null}
        initialError
      />
    )
  }
}

export default async function AdminRestaurantsRoute({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requireAuthenticatedSurface("admin")
  const requestHeaders = await headers()
  const publicBasePath = getAdminPublicBasePath(
    getRequestHostname(requestHeaders)
  )
  const loginPath = publicBasePath + "/entrar"

  return (
    <AdminAppShell
      publicBasePath={publicBasePath}
      activeItem="restaurants"
    >
      <Suspense fallback={<AdminRestaurantsPageSkeleton />}>
        <AdminRestaurantsContent
          searchParams={searchParams}
          loginPath={loginPath}
        />
      </Suspense>
    </AdminAppShell>
  )
}
