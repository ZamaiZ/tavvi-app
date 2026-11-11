import "server-only"

import { revalidatePath } from "next/cache"

import { getActivePanelRestaurant } from "@/features/panel/workspace/server/restaurants"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type {
  MenuActionFailureCode,
  MenuActionResult,
  MenuRemovedPath,
} from "../model"
import type {
  MenuAttributeCreateInput,
  MenuBatchInput,
  MenuAvailabilityInput,
  MenuCategoryReorderInput,
  MenuCategorySaveInput,
  MenuDeleteInput,
  MenuItemReorderInput,
  MenuItemSaveInput,
  MenuMoveInput,
  MenuVisibilityInput,
} from "../schema"
import { issueMenuUploadTicket, removeMenuStorageFiles } from "./media"

type MenuContext = {
  restaurant: NonNullable<Awaited<ReturnType<typeof getActivePanelRestaurant>>>
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
}

type RpcError = { code?: string; message?: string; name?: string }

function mapMenuError(error: RpcError | Error | unknown): MenuActionFailureCode {
  const source = error && typeof error === "object" ? error as Record<string, unknown> : {}
  const message = typeof source.message === "string" ? source.message : ""
  const code = typeof source.code === "string" ? source.code : ""
  if (message.includes("menu_unauthorized") || message.includes("JWT")) return "session_expired"
  if (message.includes("menu_category_not_found")) return "category_not_found"
  if (message.includes("menu_item_not_found") || message.includes("menu_item_unavailable")) return "item_not_found"
  if (message.includes("menu_category_not_empty")) return "category_not_empty"
  if (message.includes("published_menu_empty")) return "published_menu_empty"
  if (message.includes("menu_requires_public_item")) return "menu_requires_public_item"
  if (message.includes("menu_batch_item_must_be_new")) return "batch_already_saved"
  if (message.includes("menu_media_limit")) return "media_limit"
  if (message.includes("menu_media_object_missing") || message.includes("menu_media_poster_missing")) return "invalid_media"
  if (code === "42501") return "unavailable"
  if (["22003", "22023", "22P02", "23505", "23514"].includes(code)) return "invalid_input"
  if (code === "PGRST301") return "session_expired"
  if (message.includes("menu_invalid") || message.includes("duplicate_variant")) return "invalid_input"
  return "database_error"
}

async function getMenuContext(expectedRestaurantId: string): Promise<MenuContext> {
  const restaurant = await getActivePanelRestaurant(expectedRestaurantId)
  if (!restaurant || restaurant.status !== "active") throw new Error("panel_restaurant_context_changed")
  const supabase = await createSupabaseServerClient("panel")
  return { restaurant, supabase }
}

function invalidateMenu(slug: string) {
  revalidatePath("/painel/cardapio")
  revalidatePath(`/${slug}`)
}

function removedPathsFromRpc(value: unknown, restaurantId: string): MenuRemovedPath[] {
  if (!Array.isArray(value)) return []
  const pathPattern = new RegExp(`^${restaurantId}/[0-9a-f-]{36}/[0-9a-f-]{36}\\.(jpg|jpeg|png|webp|avif|mp4|webm)$`, "i")
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return []
    const candidate = entry as Record<string, unknown>
    if ((candidate.bucket !== "menu-images" && candidate.bucket !== "menu-videos") || typeof candidate.path !== "string" || !pathPattern.test(candidate.path)) return []
    return [{ bucket: candidate.bucket, path: candidate.path }]
  })
}

async function handleContextError(cause: unknown): Promise<MenuActionFailureCode> {
  if (cause instanceof Error) {
    if (cause.message === "panel_auth_required") return "session_expired"
    if (cause.message === "panel_restaurant_context_changed" || cause.message === "panel_restaurant_not_found") return "context_changed"
  }
  return mapMenuError(cause)
}

export async function saveMenuCategory(input: MenuCategorySaveInput): Promise<MenuActionResult<{ categoryId: string }>> {
  try {
    const { restaurant, supabase } = await getMenuContext(input.expectedRestaurantId)
    const { data, error } = await supabase.rpc("save_menu_category", {
      p_restaurant_id: restaurant.id,
      p_category_id: input.categoryId,
      p_name: input.name,
      p_description: input.description,
      p_is_visible: input.isVisible,
    })
    if (error) throw error
    const response = data as { ok?: unknown; categoryId?: unknown } | null
    if (!response || response.ok !== true || typeof response.categoryId !== "string") throw new Error("menu_invalid_response")
    invalidateMenu(restaurant.slug)
    return { ok: true, data: { categoryId: response.categoryId } }
  } catch (cause) {
    return { ok: false, code: await handleContextError(cause) }
  }
}

export async function createMenuAttribute(input: MenuAttributeCreateInput): Promise<MenuActionResult<{ attributeId: string }>> {
  try {
    const { restaurant, supabase } = await getMenuContext(input.expectedRestaurantId)
    const { data, error } = await supabase.rpc("save_menu_attribute", {
      p_restaurant_id: restaurant.id,
      p_kind: input.kind,
      p_label: input.label,
    })
    if (error) throw error
    const response = data as { ok?: unknown; attributeId?: unknown } | null
    if (!response || response.ok !== true || typeof response.attributeId !== "string") throw new Error("menu_invalid_response")
    invalidateMenu(restaurant.slug)
    return { ok: true, data: { attributeId: response.attributeId } }
  } catch (cause) {
    return { ok: false, code: await handleContextError(cause) }
  }
}

export async function saveMenuItem(input: MenuItemSaveInput): Promise<MenuActionResult<{ itemId: string }>> {
  try {
    const { restaurant, supabase } = await getMenuContext(input.expectedRestaurantId)
    const payload = {
      name: input.name,
      description: input.description,
      isVisible: input.isVisible,
      isAvailable: input.isAvailable,
      pricing: input.pricing,
      highlights: input.highlights,
      attributes: input.attributes,
      media: input.media.map((media, position) => ({ ...media, position })),
    }
    const { data, error } = await supabase.rpc("save_menu_item", {
      p_restaurant_id: restaurant.id,
      p_item_id: input.itemId,
      p_category_id: input.categoryId,
      p_payload: payload,
    })
    if (error) throw error
    const response = data as { ok?: unknown; itemId?: unknown; removedPaths?: unknown } | null
    if (!response || response.ok !== true || typeof response.itemId !== "string") throw new Error("menu_invalid_response")
    await removeMenuStorageFiles(removedPathsFromRpc(response.removedPaths, restaurant.id))
    invalidateMenu(restaurant.slug)
    return { ok: true, data: { itemId: response.itemId } }
  } catch (cause) {
    return { ok: false, code: await handleContextError(cause) }
  }
}

export async function saveMenuBatch(input: MenuBatchInput): Promise<MenuActionResult<{ categoryIds: string[]; itemIds: string[] }>> {
  try {
    const { restaurant, supabase } = await getMenuContext(input.expectedRestaurantId)
    const payload = {
      categories: input.categories,
      items: input.items.map(({ id, categoryId, name, description, isVisible, isAvailable, pricing, highlights, attributes, media }) => ({
        id,
        categoryId,
        payload: {
          name,
          description,
          isVisible,
          isAvailable,
          pricing,
          highlights,
          attributes,
          media: media.map((entry, position) => ({ ...entry, position })),
        },
      })),
    }
    const { data, error } = await supabase.rpc("save_menu_batch", {
      p_restaurant_id: restaurant.id,
      p_categories: payload.categories,
      p_items: payload.items,
    })
    if (error) throw error
    const response = data as { ok?: unknown; categoryIds?: unknown; itemIds?: unknown } | null
    if (!response || response.ok !== true || !Array.isArray(response.categoryIds) || !Array.isArray(response.itemIds)) {
      throw new Error("menu_invalid_response")
    }
    invalidateMenu(restaurant.slug)
    return {
      ok: true,
      data: {
        categoryIds: response.categoryIds.filter((id): id is string => typeof id === "string"),
        itemIds: response.itemIds.filter((id): id is string => typeof id === "string"),
      },
    }
  } catch (cause) {
    return { ok: false, code: await handleContextError(cause) }
  }
}

export async function setMenuVisibility(input: MenuVisibilityInput): Promise<MenuActionResult<{ isVisible: boolean }>> {
  try {
    const { restaurant, supabase } = await getMenuContext(input.expectedRestaurantId)
    const { error } = await supabase.rpc("set_menu_visibility", {
      p_restaurant_id: restaurant.id,
      p_kind: input.kind,
      p_id: input.id,
      p_is_visible: input.isVisible,
    })
    if (error) throw error
    invalidateMenu(restaurant.slug)
    return { ok: true, data: { isVisible: input.isVisible } }
  } catch (cause) {
    return { ok: false, code: await handleContextError(cause) }
  }
}

export async function setMenuAvailability(input: MenuAvailabilityInput): Promise<MenuActionResult<{ isAvailable: boolean }>> {
  try {
    const { restaurant, supabase } = await getMenuContext(input.expectedRestaurantId)
    const { error } = await supabase.rpc("set_menu_item_availability", {
      p_restaurant_id: restaurant.id,
      p_item_id: input.itemId,
      p_is_available: input.isAvailable,
    })
    if (error) throw error
    invalidateMenu(restaurant.slug)
    return { ok: true, data: { isAvailable: input.isAvailable } }
  } catch (cause) {
    return { ok: false, code: await handleContextError(cause) }
  }
}

export async function moveMenuItem(input: MenuMoveInput): Promise<MenuActionResult<{ categoryId: string }>> {
  try {
    const { restaurant, supabase } = await getMenuContext(input.expectedRestaurantId)
    const { error } = await supabase.rpc("move_menu_item", {
      p_restaurant_id: restaurant.id,
      p_item_id: input.itemId,
      p_category_id: input.categoryId,
    })
    if (error) throw error
    invalidateMenu(restaurant.slug)
    return { ok: true, data: { categoryId: input.categoryId } }
  } catch (cause) {
    return { ok: false, code: await handleContextError(cause) }
  }
}

export async function reorderMenuCategories(input: MenuCategoryReorderInput): Promise<MenuActionResult<null>> {
  try {
    const { restaurant, supabase } = await getMenuContext(input.expectedRestaurantId)
    const { error } = await supabase.rpc("reorder_menu_categories", {
      p_restaurant_id: restaurant.id,
      p_order: input.order,
    })
    if (error) throw error
    invalidateMenu(restaurant.slug)
    return { ok: true, data: null }
  } catch (cause) {
    return { ok: false, code: await handleContextError(cause) }
  }
}

export async function reorderMenuItems(input: MenuItemReorderInput): Promise<MenuActionResult<null>> {
  try {
    const { restaurant, supabase } = await getMenuContext(input.expectedRestaurantId)
    const { error } = await supabase.rpc("reorder_menu_items", {
      p_restaurant_id: restaurant.id,
      p_category_id: input.categoryId,
      p_order: input.order,
    })
    if (error) throw error
    invalidateMenu(restaurant.slug)
    return { ok: true, data: null }
  } catch (cause) {
    return { ok: false, code: await handleContextError(cause) }
  }
}

export async function deleteMenuItem(input: MenuDeleteInput): Promise<MenuActionResult<null>> {
  try {
    const { restaurant, supabase } = await getMenuContext(input.expectedRestaurantId)
    const { data, error } = await supabase.rpc("delete_menu_item", {
      p_restaurant_id: restaurant.id,
      p_item_id: input.id,
    })
    if (error) throw error
    const response = data as { ok?: unknown; removedPaths?: unknown } | null
    if (!response || response.ok !== true) throw new Error("menu_invalid_response")
    await removeMenuStorageFiles(removedPathsFromRpc(response.removedPaths, restaurant.id))
    invalidateMenu(restaurant.slug)
    return { ok: true, data: null }
  } catch (cause) {
    return { ok: false, code: await handleContextError(cause) }
  }
}

export async function deleteMenuCategory(input: MenuDeleteInput): Promise<MenuActionResult<null>> {
  try {
    const { restaurant, supabase } = await getMenuContext(input.expectedRestaurantId)
    const { error } = await supabase.rpc("delete_menu_category", {
      p_restaurant_id: restaurant.id,
      p_category_id: input.id,
    })
    if (error) throw error
    invalidateMenu(restaurant.slug)
    return { ok: true, data: null }
  } catch (cause) {
    return { ok: false, code: await handleContextError(cause) }
  }
}

export async function changeMenuPublication(expectedRestaurantId: string, publish: boolean): Promise<MenuActionResult<{ status: "draft" | "published" }>> {
  try {
    const { restaurant, supabase } = await getMenuContext(expectedRestaurantId)
    const { data, error } = await supabase.rpc(publish ? "publish_menu" : "unpublish_menu", {
      p_restaurant_id: restaurant.id,
    })
    if (error) throw error
    const expectedStatus = publish ? "published" : "draft"
    const response = data as { ok?: unknown; menuStatus?: unknown } | null
    if (!response || response.ok !== true || response.menuStatus !== expectedStatus) throw new Error("menu_invalid_response")
    invalidateMenu(restaurant.slug)
    return { ok: true, data: { status: expectedStatus } }
  } catch (cause) {
    return { ok: false, code: await handleContextError(cause) }
  }
}

export async function createMenuUploadTicket(input: import("../schema").MenuUploadTicketInput): Promise<MenuActionResult<import("../model").MenuUploadTicket>> {
  try {
    const { restaurant } = await getMenuContext(input.expectedRestaurantId)
    const ticket = await issueMenuUploadTicket({
      restaurantId: restaurant.id,
      itemId: input.itemId,
      kind: input.kind,
      mimeType: input.mimeType,
      byteSize: input.byteSize,
    })
    if (!ticket) return { ok: false, code: "storage_unavailable" }
    return { ok: true, data: ticket }
  } catch (cause) {
    return { ok: false, code: await handleContextError(cause) }
  }
}

export async function discardMenuUploads(
  expectedRestaurantId: string,
  files: MenuRemovedPath[],
): Promise<MenuActionResult<null>> {
  try {
    const { restaurant } = await getMenuContext(expectedRestaurantId)
    const pathPattern = new RegExp(`^${restaurant.id}/[0-9a-f-]{36}/[0-9a-f-]{36}\\.(jpg|jpeg|png|webp|avif|mp4|webm)$`, "i")
    if (!files.length || files.some((file) => !pathPattern.test(file.path)
      || (file.bucket === "menu-images" && !/\.(jpg|jpeg|png|webp|avif)$/i.test(file.path))
      || (file.bucket === "menu-videos" && !/\.(mp4|webm)$/i.test(file.path)))) {
      return { ok: false, code: "invalid_input" }
    }
    await removeMenuStorageFiles(files)
    return { ok: true, data: null }
  } catch (cause) {
    return { ok: false, code: await handleContextError(cause) }
  }
}
