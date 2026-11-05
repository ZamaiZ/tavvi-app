import "server-only"

import { z } from "zod"

import type {
  RestaurantAdmin,
  RestaurantCounts,
  RestaurantListQuery,
  RestaurantListResult,
  RestaurantStatus,
} from "@/features/admin/restaurants/model"
import {
  restaurantIdSchema,
  restaurantListQuerySchema,
  restaurantSlugSchema,
  updateRestaurantSlugSchema,
  type UpdateRestaurantSlugInput,
} from "@/features/admin/restaurants/schema"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const restaurantStatusSchema = z.enum(["draft", "active", "suspended"])

const restaurantAdminSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  slug: restaurantSlugSchema,
  status: restaurantStatusSchema,
  statusBeforeSuspension: z.enum(["draft", "active"]).nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
}) satisfies z.ZodType<RestaurantAdmin>

const restaurantCountsSchema = z.object({
  all: z.number().int().nonnegative(),
  draft: z.number().int().nonnegative(),
  active: z.number().int().nonnegative(),
  suspended: z.number().int().nonnegative(),
}) satisfies z.ZodType<RestaurantCounts>

const restaurantListResponseSchema = z.object({
  rows: z.array(restaurantAdminSchema),
  counts: restaurantCountsSchema,
  totalRows: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive().max(100),
}) satisfies z.ZodType<RestaurantListResult>

const statusMutationResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    id: z.string().uuid(),
    status: restaurantStatusSchema,
    statusBeforeSuspension: z.enum(["draft", "active"]).nullable(),
  }),
  z.object({ ok: z.literal(false), code: z.literal("not_found") }),
])

const slugMutationResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), slug: restaurantSlugSchema }),
  z.object({
    ok: z.literal(false),
    code: z.enum(["not_found", "slug_unavailable"]),
  }),
])

export class RestaurantAccessError extends Error {}
export class RestaurantInputError extends Error {}
export class RestaurantServiceError extends Error {}

export type RestaurantStatusMutation =
  | {
      status: "updated"
      restaurantId: string
      restaurantStatus: RestaurantStatus
      statusBeforeSuspension: "draft" | "active" | null
    }
  | { status: "not-found" }

export type RestaurantSlugMutation =
  | { status: "updated"; slug: string }
  | { status: "not-found" }
  | { status: "slug-unavailable" }

function throwRpcError(error: { code?: string }) {
  if (error.code === "42501") throw new RestaurantAccessError()
  if (error.code === "22023") throw new RestaurantInputError()
  throw new RestaurantServiceError()
}

function reportInvalidResponse(
  name: string,
  issues: { code: string; path: PropertyKey[] }[]
): never {
  console.error(`[admin.restaurants] ${name} returned invalid data`, {
    issues: issues.map(({ code, path }) => ({ code, path: path.join(".") })),
  })
  throw new RestaurantServiceError()
}

export async function listPlatformRestaurants(
  input: RestaurantListQuery
): Promise<RestaurantListResult> {
  const parsedInput = restaurantListQuerySchema.safeParse(input)
  if (!parsedInput.success) throw new RestaurantInputError()

  const supabase = await createSupabaseServerClient("admin")
  const { data, error } = await supabase.rpc("list_platform_restaurants", {
    p_search: parsedInput.data.search,
    p_status: parsedInput.data.status,
    p_page: parsedInput.data.page,
    p_page_size: parsedInput.data.pageSize,
  })

  if (error) {
    if (error.code !== "42501" && error.code !== "22023") {
      console.error("[admin.restaurants] list_platform_restaurants RPC failed", {
        code: error.code ?? "unknown",
      })
    }
    throwRpcError(error)
  }

  const parsedResponse = restaurantListResponseSchema.safeParse(data)
  if (!parsedResponse.success) {
    reportInvalidResponse(
      "list_platform_restaurants",
      parsedResponse.error.issues
    )
  }

  return parsedResponse.data
}

export async function setPlatformRestaurantStatus(input: {
  restaurantId: string
  action: "suspend" | "restore"
}): Promise<RestaurantStatusMutation> {
  const parsedId = restaurantIdSchema.safeParse(input.restaurantId)
  if (!parsedId.success) throw new RestaurantInputError()

  const supabase = await createSupabaseServerClient("admin")
  const { data, error } = await supabase.rpc("set_platform_restaurant_status", {
    p_restaurant_id: parsedId.data,
    p_action: input.action,
  })

  if (error) throwRpcError(error)

  const parsedResponse = statusMutationResponseSchema.safeParse(data)
  if (!parsedResponse.success) {
    reportInvalidResponse(
      "set_platform_restaurant_status",
      parsedResponse.error.issues
    )
  }

  if (!parsedResponse.data.ok) return { status: "not-found" }
  return {
    status: "updated",
    restaurantId: parsedResponse.data.id,
    restaurantStatus: parsedResponse.data.status,
    statusBeforeSuspension: parsedResponse.data.statusBeforeSuspension,
  }
}

export async function updatePlatformRestaurantSlug(
  input: UpdateRestaurantSlugInput
): Promise<RestaurantSlugMutation> {
  const parsedInput = updateRestaurantSlugSchema.safeParse(input)
  if (!parsedInput.success) throw new RestaurantInputError()

  const supabase = await createSupabaseServerClient("admin")
  const { data, error } = await supabase.rpc(
    "update_platform_restaurant_slug",
    {
      p_restaurant_id: parsedInput.data.restaurantId,
      p_slug: parsedInput.data.slug,
    }
  )

  if (error) throwRpcError(error)

  const parsedResponse = slugMutationResponseSchema.safeParse(data)
  if (!parsedResponse.success) {
    reportInvalidResponse(
      "update_platform_restaurant_slug",
      parsedResponse.error.issues
    )
  }

  if (!parsedResponse.data.ok) {
    return { status: parsedResponse.data.code === "not_found" ? "not-found" : "slug-unavailable" }
  }

  return { status: "updated", slug: parsedResponse.data.slug }
}
