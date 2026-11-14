import type { Metadata } from "next"

import { TeamPage } from "@/features/panel/team/components/team-page"
import { teamListQuerySchema } from "@/features/panel/team/schema"
import { getPanelTeamPage } from "@/features/panel/team/server/read"

export const metadata: Metadata = { title: "Equipe" }

type TeamRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function PanelTeamPage({ searchParams }: TeamRouteProps) {
  const params = await searchParams
  const parsed = teamListQuerySchema.safeParse({
    search: firstParam(params.search) ?? "",
    status: firstParam(params.status) ?? "all",
    page: firstParam(params.page) ?? "1",
    pageSize: firstParam(params.pageSize) ?? "25",
  })
  const query = parsed.success
    ? parsed.data
    : teamListQuerySchema.parse({})
  const initialData = await getPanelTeamPage(query)

  return <TeamPage initialData={initialData} />
}
