import "server-only"

import type { PanelRestaurantDTO } from "@/features/panel/onboarding/model"
import { createPublicMenuTagUrl } from "@/lib/routing/panel"
import { createSupabaseServerClient } from "@/lib/supabase/server"

import type {
  IdentifierDTO,
  IdentifierNfcOperationStatus,
  PanelIdentifiersDTO,
} from "../model"

type RawIdentifier = {
  id: string
  public_token: string
  table_number: number
  is_active: boolean
  nfc_serial: string | null
  nfc_protected_at: string | null
}

type RawOperation = {
  operation_id: string
  tag_id: string
  status: IdentifierNfcOperationStatus
  serial: string
}

function toIdentifier(row: RawIdentifier, operation: RawOperation | undefined): IdentifierDTO {
  const protectedTag = Boolean(row.nfc_protected_at)
  const uncertain = !protectedTag && (operation?.status === "writing" || operation?.status === "uncertain")
  const recoverable = !protectedTag && (operation?.status === "ready" || operation?.status === "authorizing" || operation?.status === "writing" || operation?.status === "uncertain")

  return {
    id: row.id,
    publicToken: row.public_token,
    publicUrl: createPublicMenuTagUrl(row.public_token),
    tableNumber: row.table_number,
    isActive: row.is_active,
    nfcSerial: row.nfc_serial,
    nfcProtectedAt: row.nfc_protected_at,
    nfcStatus: protectedTag ? "protected" : uncertain ? "uncertain" : "pending",
    nfcOperationId: recoverable ? operation?.operation_id ?? null : null,
    nfcOperationStatus: operation?.status ?? null,
  }
}

export async function getPanelIdentifiers(restaurant: PanelRestaurantDTO): Promise<PanelIdentifiersDTO> {
  const supabase = await createSupabaseServerClient("panel")
  const rows: RawIdentifier[] = []
  const pageSize = 500
  for (let offset = 0; ; offset += pageSize) {
    const result = await supabase
      .from("menu_tags")
      .select("id,public_token,table_number,is_active,nfc_serial,nfc_protected_at")
      .eq("restaurant_id", restaurant.id)
      .order("table_number", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (result.error || !result.data) {
      console.error("[panel-identifiers]", JSON.stringify({ stage: "identifier_list", code: result.error?.code }))
      throw new Error("panel_identifiers_unavailable")
    }

    rows.push(...(result.data as unknown as RawIdentifier[]))
    if (result.data.length < pageSize) break
  }

  const ids = rows.map((row) => row.id)
  let operations: RawOperation[] = []

  if (ids.length) {
    const tagIdBatches = Array.from({ length: Math.ceil(ids.length / 500) }, (_, index) => ids.slice(index * 500, (index + 1) * 500))
    const results = await Promise.all(tagIdBatches.map((tagIds) => supabase
      .from("menu_tag_nfc_operations")
      .select("operation_id,tag_id,status,serial")
      .eq("restaurant_id", restaurant.id)
      .in("status", ["ready", "authorizing", "writing", "uncertain"])
      .in("tag_id", tagIds)))
    const failedResult = results.find((result) => result.error || !result.data)
    if (failedResult) {
      console.error("[panel-identifiers]", JSON.stringify({ stage: "nfc_operations", code: failedResult.error?.code }))
      throw new Error("panel_identifiers_unavailable")
    }
    operations = results.flatMap((result) => result.data as unknown as RawOperation[])
  }

  const latestOperationByTag = new Map<string, RawOperation>()
  for (const operation of operations) {
    latestOperationByTag.set(operation.tag_id, operation)
  }

  const identifiers = rows.map((row) => toIdentifier(row, latestOperationByTag.get(row.id)))
  return {
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    slug: restaurant.slug,
    identifiers,
    counts: {
      all: identifiers.length,
      pending: identifiers.filter((entry) => entry.isActive && entry.nfcStatus !== "protected").length,
      protected: identifiers.filter((entry) => entry.isActive && entry.nfcStatus === "protected").length,
      inactive: identifiers.filter((entry) => !entry.isActive).length,
    },
  }
}

