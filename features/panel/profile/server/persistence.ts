import "server-only"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import type { ActiveIdentity } from "@/features/panel/profile/schema"
import { getActivePanelRestaurant } from "@/features/panel/workspace/server/restaurants"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type ProfileWriteCode = "invalid_input" | "session_expired" | "context_changed" | "unavailable" | "storage_unavailable" | "storage_policy_denied" | "database_error"
export type ProfileWriteResult = { ok: true; identity?: ActiveIdentity; savedPaths?: { logoPath: string | null; coverPath: string | null } } | { ok: false; code: ProfileWriteCode }
export type BrandFiles = Partial<Record<"logo" | "cover", File>>

const identityRpcResponse = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), restaurantId: z.string().uuid() }),
  z.object({ ok: z.literal(false), code: z.enum(["unauthorized", "not_found", "invalid_input", "unavailable"]) }),
])

const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }
const maxBytes = 5 * 1024 * 1024

function log(stage: string, cause?: unknown) {
  const value = cause && typeof cause === "object" ? cause as Record<string, unknown> : {}
  console.error("[panel-profile]", JSON.stringify({ stage, code: typeof value.code === "string" ? value.code : undefined, name: cause instanceof Error ? cause.name : undefined }))
}

async function removeObjects(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, paths: string[]) {
  if (!paths.length) return
  try {
    const { error } = await supabase.storage.from("restaurant-brand").remove(paths)
    if (error) console.warn("[panel-profile]", JSON.stringify({ stage: "storage_cleanup", code: error.name }))
  } catch (cause) {
    console.warn("[panel-profile]", JSON.stringify({ stage: "storage_cleanup", name: cause instanceof Error ? cause.name : undefined }))
  }
}

export async function persistActiveRestaurantIdentity(
  restaurantId: string,
  identity: ActiveIdentity,
  files: BrandFiles = {},
): Promise<ProfileWriteResult> {
  for (const file of Object.values(files)) {
    if (file && (!extensions[file.type] || file.size <= 0 || file.size > maxBytes)) return { ok: false, code: "invalid_input" }
  }

  let restaurant
  try {
    restaurant = await getActivePanelRestaurant(restaurantId)
  } catch (cause) {
    if (cause instanceof Error && cause.message === "panel_auth_required") return { ok: false, code: "session_expired" }
    if (cause instanceof Error && (cause.message === "panel_restaurant_context_changed" || cause.message === "panel_restaurant_not_found")) return { ok: false, code: "context_changed" }
    log("restaurant_lookup", cause)
    return { ok: false, code: "unavailable" }
  }
  if (!restaurant || restaurant.status !== "active") return { ok: false, code: "context_changed" }

  const supabase = await createSupabaseServerClient("panel")
  const uploaded: string[] = []
  const nextIdentity: ActiveIdentity = { ...identity }
  const previous = { logoPath: restaurant.logoPath, coverPath: restaurant.coverPath }

  for (const slot of ["logo", "cover"] as const) {
    const file = files[slot]
    if (!file) continue
    const path = `${restaurant.id}/${slot}/${crypto.randomUUID()}.${extensions[file.type]}`
    let error
    try {
      ({ error } = await supabase.storage.from("restaurant-brand").upload(path, file, { cacheControl: "3600", contentType: file.type, upsert: false }))
    } catch (cause) {
      log("storage_upload", cause)
      await removeObjects(supabase, uploaded)
      return { ok: false, code: "storage_unavailable" }
    }
    if (error) {
      await removeObjects(supabase, uploaded)
      return { ok: false, code: String(error.statusCode) === "403" ? "storage_policy_denied" : "storage_unavailable" }
    }
    uploaded.push(path)
    if (slot === "logo") nextIdentity.logoPath = path
    else nextIdentity.coverPath = path
  }

  let rpcData: unknown
  try {
    const { data, error } = await supabase.rpc("save_active_restaurant_identity", { p_restaurant_id: restaurant.id, p_identity: nextIdentity })
    if (error) {
      log("identity_rpc", error)
      await removeObjects(supabase, uploaded)
      return { ok: false, code: "database_error" }
    }
    rpcData = data
  } catch (cause) {
    log("identity_rpc_exception", cause)
    await removeObjects(supabase, uploaded)
    return { ok: false, code: "database_error" }
  }

  const response = identityRpcResponse.safeParse(rpcData)
  if (!response.success || !response.data.ok || response.data.restaurantId !== restaurant.id) {
    await removeObjects(supabase, uploaded)
    if (response.success && !response.data.ok && response.data.code === "unauthorized") return { ok: false, code: "session_expired" }
    if (response.success && !response.data.ok && response.data.code === "invalid_input") return { ok: false, code: "invalid_input" }
    return { ok: false, code: "context_changed" }
  }

  await Promise.all([
    previous.logoPath !== nextIdentity.logoPath ? removeObjects(supabase, previous.logoPath ? [previous.logoPath] : []) : Promise.resolve(),
    previous.coverPath !== nextIdentity.coverPath ? removeObjects(supabase, previous.coverPath ? [previous.coverPath] : []) : Promise.resolve(),
  ])
  revalidatePath(`/${restaurant.slug}`)
  return { ok: true, identity: nextIdentity, savedPaths: { logoPath: nextIdentity.logoPath, coverPath: nextIdentity.coverPath } }
}
