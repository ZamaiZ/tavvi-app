import "server-only"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { PanelRestaurantDTO } from "@/features/panel/onboarding/model"
import type {
  MenuAttributeDTO,
  MenuCategoryDTO,
  MenuItemDTO,
  MenuMediaDTO,
  MenuPresentation,
  PanelMenuDTO,
} from "../model"

type PanelBasePath = "" | "/painel"

type RawAttribute = {
  id: string
  kind: "diet" | "allergen"
  label: string
  is_system: boolean
}

type RawItemAttribute = {
  attribute_id: string
  kind: "diet" | "allergen"
  qualifier: "contains" | "may_contain" | null
  attribute: RawAttribute | null
}

type RawVariant = {
  id: string
  name: string
  price_cents: number
  is_available: boolean
  position: number
}

type RawMedia = {
  id: string
  kind: "image" | "video"
  storage_path: string
  poster_path: string | null
  alt_text: string
  width: number | null
  height: number | null
  duration_ms: number | null
  position: number
}

type RawItem = {
  id: string
  category_id: string
  name: string
  description: string
  price_mode: "single" | "variants"
  base_price_cents: number | null
  is_visible: boolean
  is_available: boolean
  position: number
  highlights: string[]
  menu_item_variants: RawVariant[] | null
  menu_item_attributes: RawItemAttribute[] | null
  menu_item_media: RawMedia[] | null
}

type RawCategory = {
  id: string
  name: string
  description: string
  position: number
  is_visible: boolean
  menu_items: RawItem[] | null
}

function sortByPosition<T extends { position: number; id?: string }>(items: T[]) {
  return [...items].sort((left, right) => left.position - right.position || (left.id ?? "").localeCompare(right.id ?? ""))
}

function toMedia(media: RawMedia, basePath: PanelBasePath): MenuMediaDTO {
  const prefix = `${basePath}/cardapio/media/${encodeURIComponent(media.id)}`
  return {
    id: media.id,
    kind: media.kind,
    storagePath: media.storage_path,
    posterPath: media.poster_path,
    altText: media.alt_text,
    url: prefix,
    posterUrl: media.poster_path ? `${prefix}?poster=1` : null,
    width: media.width,
    height: media.height,
    durationMs: media.duration_ms,
    position: media.position,
  }
}

function toItem(item: RawItem, basePath: PanelBasePath): MenuItemDTO {
  const variants = sortByPosition(item.menu_item_variants ?? []).map((variant) => ({
    id: variant.id,
    name: variant.name,
    priceCents: variant.price_cents,
    isAvailable: variant.is_available,
    position: variant.position,
  }))
  const media = sortByPosition(item.menu_item_media ?? []).map((entry) => toMedia(entry, basePath))

  return {
    id: item.id,
    categoryId: item.category_id,
    name: item.name,
    description: item.description,
    pricing: item.price_mode === "variants"
      ? { mode: "variants", variants }
      : { mode: "single", basePriceCents: item.base_price_cents ?? 0 },
    isVisible: item.is_visible,
    isAvailable: item.is_available,
    position: item.position,
    highlights: item.highlights ?? [],
    attributes: (item.menu_item_attributes ?? []).flatMap((attribute) => attribute.attribute ? [{
      id: attribute.attribute_id,
      kind: attribute.kind,
      qualifier: attribute.qualifier,
    }] : []),
    media,
    missingMedia: media.length === 0,
  }
}

function getCounts(categories: MenuCategoryDTO[]): PanelMenuDTO["counts"] {
  const items = categories.flatMap((category) => category.items)
  return {
    categories: categories.length,
    items: items.length,
    visibleItems: items.filter((item) => item.isVisible).length,
    publicItems: categories.reduce((total, category) => total + category.items.filter(
      (item) => category.isVisible && item.isVisible && item.media.length > 0,
    ).length, 0),
    unavailableItems: items.filter((item) => !item.isAvailable).length,
    missingMediaItems: items.filter((item) => item.missingMedia).length,
  }
}

export async function getPanelMenu(
  restaurant: PanelRestaurantDTO,
  panelBasePath: PanelBasePath,
): Promise<PanelMenuDTO> {
  const supabase = await createSupabaseServerClient("panel")
  const [categoryResult, attributeResult] = await Promise.all([
    supabase
      .from("menu_categories")
      .select(`
        id, name, description, position, is_visible,
        menu_items!menu_items_category_same_restaurant (
          id, category_id, name, description, price_mode, base_price_cents,
          is_visible, is_available, position, highlights,
          menu_item_variants!menu_item_variants_item_same_restaurant (id, name, price_cents, is_available, position),
          menu_item_attributes!menu_item_attributes_item_same_restaurant (
            attribute_id, kind, qualifier,
            attribute:restaurant_menu_attributes!menu_item_attributes_definition_same_restaurant (id, kind, label, is_system)
          ),
          menu_item_media!menu_item_media_item_same_restaurant (id, kind, storage_path, poster_path, alt_text, width, height, duration_ms, position)
        )
      `)
      .eq("restaurant_id", restaurant.id)
      .order("position", { ascending: true }),
    supabase
      .from("restaurant_menu_attributes")
      .select("id,kind,label,is_system")
      .eq("restaurant_id", restaurant.id)
      .order("kind", { ascending: true })
      .order("label", { ascending: true }),
  ])

  if (categoryResult.error || attributeResult.error) {
    console.error("[panel-menu] read failed", {
      categoryCode: categoryResult.error?.code,
      attributeCode: attributeResult.error?.code,
    })
    throw new Error("panel_menu_unavailable")
  }

  const categoryRows = (categoryResult.data ?? []) as unknown as RawCategory[]
  const attributeRows = (attributeResult.data ?? []) as unknown as RawAttribute[]
  const categories = sortByPosition(categoryRows).map((category) => ({
    id: category.id,
    name: category.name,
    description: category.description,
    position: category.position,
    isVisible: category.is_visible,
    items: sortByPosition(category.menu_items ?? []).map((item) => toItem(item, panelBasePath)),
  }))
  const attributes: MenuAttributeDTO[] = attributeRows.map((attribute) => ({
    id: attribute.id,
    kind: attribute.kind,
    label: attribute.label,
    isSystem: attribute.is_system,
  }))

  return {
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    slug: restaurant.slug,
    status: restaurant.menuStatus,
    presentation: restaurant.menuPresentation as MenuPresentation,
    categories,
    attributes,
    counts: getCounts(categories),
  }
}
