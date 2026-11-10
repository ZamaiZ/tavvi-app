"use server"

import type { MenuActionResult, MenuUploadTicket } from "./model"
import {
  menuAttributeCreateSchema,
  menuAvailabilitySchema,
  menuBatchSchema,
  menuCategoryReorderSchema,
  menuCategorySaveSchema,
  menuDeleteSchema,
  menuItemReorderSchema,
  menuItemSaveSchema,
  menuMoveSchema,
  menuPublicationSchema,
  menuUploadCleanupSchema,
  menuUploadTicketSchema,
  menuVisibilitySchema,
} from "./schema"
import {
  changeMenuPublication,
  createMenuAttribute,
  createMenuUploadTicket,
  saveMenuBatch,
  deleteMenuCategory,
  deleteMenuItem,
  discardMenuUploads,
  moveMenuItem,
  reorderMenuCategories,
  reorderMenuItems,
  saveMenuCategory,
  saveMenuItem,
  setMenuAvailability,
  setMenuVisibility,
} from "./server/write"

function invalidInput<T>(): MenuActionResult<T> {
  return { ok: false, code: "invalid_input" }
}

export async function saveMenuCategoryAction(rawInput: unknown) {
  const parsed = menuCategorySaveSchema.safeParse(rawInput)
  return parsed.success ? saveMenuCategory(parsed.data) : invalidInput<{ categoryId: string }>()
}

export async function createMenuAttributeAction(rawInput: unknown) {
  const parsed = menuAttributeCreateSchema.safeParse(rawInput)
  return parsed.success ? createMenuAttribute(parsed.data) : invalidInput<{ attributeId: string }>()
}

export async function saveMenuItemAction(rawInput: unknown) {
  const parsed = menuItemSaveSchema.safeParse(rawInput)
  return parsed.success ? saveMenuItem(parsed.data) : invalidInput<{ itemId: string }>()
}

export async function saveMenuBatchAction(rawInput: unknown) {
  const parsed = menuBatchSchema.safeParse(rawInput)
  return parsed.success
    ? saveMenuBatch(parsed.data)
    : invalidInput<{ categoryIds: string[]; itemIds: string[] }>()
}

export async function setMenuVisibilityAction(rawInput: unknown) {
  const parsed = menuVisibilitySchema.safeParse(rawInput)
  return parsed.success ? setMenuVisibility(parsed.data) : invalidInput<{ isVisible: boolean }>()
}

export async function setMenuAvailabilityAction(rawInput: unknown) {
  const parsed = menuAvailabilitySchema.safeParse(rawInput)
  return parsed.success ? setMenuAvailability(parsed.data) : invalidInput<{ isAvailable: boolean }>()
}

export async function moveMenuItemAction(rawInput: unknown) {
  const parsed = menuMoveSchema.safeParse(rawInput)
  return parsed.success ? moveMenuItem(parsed.data) : invalidInput<{ categoryId: string }>()
}

export async function reorderMenuCategoriesAction(rawInput: unknown) {
  const parsed = menuCategoryReorderSchema.safeParse(rawInput)
  return parsed.success ? reorderMenuCategories(parsed.data) : invalidInput<null>()
}

export async function reorderMenuItemsAction(rawInput: unknown) {
  const parsed = menuItemReorderSchema.safeParse(rawInput)
  return parsed.success ? reorderMenuItems(parsed.data) : invalidInput<null>()
}

export async function deleteMenuItemAction(rawInput: unknown) {
  const parsed = menuDeleteSchema.safeParse(rawInput)
  return parsed.success ? deleteMenuItem(parsed.data) : invalidInput<null>()
}

export async function deleteMenuCategoryAction(rawInput: unknown) {
  const parsed = menuDeleteSchema.safeParse(rawInput)
  return parsed.success ? deleteMenuCategory(parsed.data) : invalidInput<null>()
}

export async function publishMenuAction(rawInput: unknown) {
  const parsed = menuPublicationSchema.safeParse(rawInput)
  return parsed.success
    ? changeMenuPublication(parsed.data.expectedRestaurantId, true)
    : invalidInput<{ status: "draft" | "published" }>()
}

export async function unpublishMenuAction(rawInput: unknown) {
  const parsed = menuPublicationSchema.safeParse(rawInput)
  return parsed.success
    ? changeMenuPublication(parsed.data.expectedRestaurantId, false)
    : invalidInput<{ status: "draft" | "published" }>()
}

export async function createMenuUploadTicketAction(rawInput: unknown): Promise<MenuActionResult<MenuUploadTicket>> {
  const parsed = menuUploadTicketSchema.safeParse(rawInput)
  return parsed.success ? createMenuUploadTicket(parsed.data) : invalidInput<MenuUploadTicket>()
}

export async function discardMenuUploadsAction(rawInput: unknown) {
  const parsed = menuUploadCleanupSchema.safeParse(rawInput)
  return parsed.success
    ? discardMenuUploads(parsed.data.expectedRestaurantId, parsed.data.files)
    : invalidInput<null>()
}
