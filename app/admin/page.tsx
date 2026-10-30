import type { Metadata } from "next"
import { Suspense } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { AdminInvitesPage } from "@/features/admin/invites/components/admin-invites-page"
import { AdminInvitesPageSkeleton } from "@/features/admin/invites/components/admin-invites-page-skeleton"
import { AdminAppShell } from "@/features/admin/shell/components/admin-app-shell"
import { getAdminPublicBasePath } from "@/features/admin/auth/navigation"
import { inviteListQuerySchema } from "@/features/admin/invites/schema"
import {
  listPlatformInvites,
  PlatformInviteAccessError,
} from "@/features/admin/invites/server/invites"
import { getRequestHostname } from "@/lib/routing/host"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Convites",
}

type SearchParams = Record<string, string | string[] | undefined>

type AdminHomePageProps = {
  searchParams: Promise<SearchParams>
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

async function AdminInvitesContent({
  searchParams,
  loginPath,
}: {
  searchParams: Promise<SearchParams>
  loginPath: string
}) {
  const rawParams = await searchParams
  const parsedQuery = inviteListQuerySchema.safeParse({
    search: firstValue(rawParams.search) ?? "",
    status: firstValue(rawParams.status) ?? "all",
    page: firstValue(rawParams.page) ?? "1",
    pageSize: firstValue(rawParams.pageSize) ?? "25",
  })
  const initialQuery = parsedQuery.success
    ? parsedQuery.data
    : inviteListQuerySchema.parse({})

  try {
    const initialData = await listPlatformInvites(initialQuery)

    return (
      <AdminInvitesPage
        initialQuery={initialQuery}
        initialData={initialData}
        initialError={false}
      />
    )
  } catch (error) {
    if (error instanceof PlatformInviteAccessError) {
      try {
        const supabase = await createSupabaseServerClient("admin")
        await supabase.auth.signOut({ scope: "local" })
      } catch {
        // The access decision remains the database RPC; a failed cleanup must not expose the page.
      }
      redirect(loginPath)
    }

    return (
      <AdminInvitesPage
        initialQuery={initialQuery}
        initialData={null}
        initialError
      />
    )
  }
}

export default async function AdminHomePage({
  searchParams,
}: AdminHomePageProps) {
  const requestHeaders = await headers()
  const hostname = getRequestHostname(requestHeaders)
  const publicBasePath = getAdminPublicBasePath(hostname)
  const loginPath = publicBasePath + "/entrar"

  return (
    <AdminAppShell publicBasePath={publicBasePath}>
      <Suspense fallback={<AdminInvitesPageSkeleton />}>
        <AdminInvitesContent searchParams={searchParams} loginPath={loginPath} />
      </Suspense>
    </AdminAppShell>
  )
}
