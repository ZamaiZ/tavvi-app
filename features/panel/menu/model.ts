export type MenuStatus = "draft" | "published"
export type MenuAttributeKind = "diet" | "allergen"
export type MenuMediaKind = "image" | "video"
export type MenuPresentation = "immersive" | "standard"
export type MenuPricing =
  | { mode: "single"; basePriceCents: number }
  | { mode: "variants"; variants: MenuVariantDTO[] }

export type MenuAttributeDTO = {
  id: string
  kind: MenuAttributeKind
  label: string
  isSystem: boolean
}

export type MenuVariantDTO = {
  id: string
  name: string
  priceCents: number
  isAvailable: boolean
  position: number
}

export type MenuItemAttributeDTO = {
  id: string
  kind: MenuAttributeKind
  qualifier: "contains" | "may_contain" | null
}

export type MenuMediaDTO = {
  id: string
  kind: MenuMediaKind
  storagePath: string
  posterPath: string | null
  altText: string
  url: string
  posterUrl: string | null
  width: number | null
  height: number | null
  durationMs: number | null
  position: number
}

export type MenuItemDTO = {
  id: string
  categoryId: string
  name: string
  description: string
  pricing: MenuPricing
  isVisible: boolean
  isAvailable: boolean
  position: number
  highlights: string[]
  attributes: MenuItemAttributeDTO[]
  media: MenuMediaDTO[]
  missingMedia: boolean
}

export type MenuCategoryDTO = {
  id: string
  name: string
  description: string
  position: number
  isVisible: boolean
  items: MenuItemDTO[]
}

export type PanelMenuDTO = {
  restaurantId: string
  restaurantName: string
  slug: string
  status: MenuStatus
  presentation: MenuPresentation
  categories: MenuCategoryDTO[]
  attributes: MenuAttributeDTO[]
  counts: {
    categories: number
    items: number
    visibleItems: number
    publicItems: number
    unavailableItems: number
    missingMediaItems: number
  }
}

export type MenuUploadTicket = {
  id: string
  kind: MenuMediaKind
  bucket: "menu-images" | "menu-videos"
  path: string
  token: string
}

export type MenuRemovedPath = {
  bucket: "menu-images" | "menu-videos"
  path: string
}

export type MenuActionFailureCode =
  | "invalid_input"
  | "session_expired"
  | "context_changed"
  | "unavailable"
  | "category_not_found"
  | "item_not_found"
  | "category_not_empty"
  | "published_menu_empty"
  | "menu_requires_public_item"
  | "batch_already_saved"
  | "media_limit"
  | "invalid_media"
  | "storage_unavailable"
  | "storage_policy_denied"
  | "database_error"

export type MenuActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: MenuActionFailureCode }

export const DEFAULT_MENU_ATTRIBUTES = {
  diet: ["Vegetariano", "Vegano", "Sem glúten", "Sem lactose", "Picante"],
  allergen: ["Leite", "Ovos", "Trigo/glúten", "Soja", "Amendoim", "Castanhas", "Peixe", "Crustáceos", "Gergelim"],
} as const

export const MENU_MAX_ITEMS_PER_BATCH = 50
export const MENU_MAX_CATEGORIES_PER_BATCH = 20
export const MENU_MAX_PRICE_CENTS = 99_999_999
export const MENU_MAX_MEDIA_PER_ITEM = 6
export const MENU_MAX_VARIANTS_PER_ITEM = 30
export const MENU_MAX_ATTRIBUTES_PER_ITEM = 30
export const MENU_MAX_VIDEO_DURATION_MS = 15_000

export const MENU_MEDIA_LIMITS = {
  image: {
    bucket: "menu-images",
    maxBytes: 5_242_880,
    mimes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
  },
  video: {
    bucket: "menu-videos",
    maxBytes: 10_485_760,
    mimes: ["video/mp4", "video/webm"],
  },
} as const
