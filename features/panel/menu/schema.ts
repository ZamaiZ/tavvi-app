import { z } from "zod"

import {
  MENU_MAX_MEDIA_PER_ITEM,
  MENU_MAX_PRICE_CENTS,
  MENU_MAX_VARIANTS_PER_ITEM,
  MENU_MEDIA_LIMITS,
  MENU_MAX_VIDEO_DURATION_MS,
} from "./model"

const uuid = z.string().uuid()
const normalized = (value: string) => value.normalize("NFC").trim().toLocaleLowerCase("pt-BR")
const menuText = (max: number, min = 0) => z.string().trim().min(min).max(max)

export const menuCategorySaveSchema = z.object({
  expectedRestaurantId: uuid,
  categoryId: uuid.nullable(),
  name: menuText(80, 2),
  description: menuText(300),
  isVisible: z.boolean(),
}).strict()

export const menuAttributeCreateSchema = z.object({
  expectedRestaurantId: uuid,
  kind: z.enum(["diet", "allergen"]),
  label: menuText(40, 2),
}).strict()

const variantSchema = z.object({
  id: uuid,
  name: menuText(60, 1),
  priceCents: z.number().int().min(0).max(MENU_MAX_PRICE_CENTS),
  isAvailable: z.boolean(),
}).strict()

const mediaSchema = z.object({
  id: uuid,
  kind: z.enum(["image", "video"]),
  storagePath: z.string().trim().min(1).max(400),
  posterPath: z.string().trim().min(1).max(400).nullable(),
  altText: menuText(180),
  width: z.number().int().min(1).max(10_000).nullable(),
  height: z.number().int().min(1).max(10_000).nullable(),
  durationMs: z.number().int().min(1).max(MENU_MAX_VIDEO_DURATION_MS).nullable(),
  position: z.number().int().min(0).max(100_000),
}).strict()

const itemAttributeSchema = z.object({
  id: uuid,
  kind: z.enum(["diet", "allergen"]),
  qualifier: z.enum(["contains", "may_contain"]).nullable(),
}).strict().superRefine((attribute, context) => {
  if (attribute.kind === "allergen" && !attribute.qualifier) {
    context.addIssue({ code: "custom", path: ["qualifier"], message: "Escolha contém ou pode conter." })
  }
  if (attribute.kind === "diet" && attribute.qualifier) {
    context.addIssue({ code: "custom", path: ["qualifier"], message: "Dieta não usa qualificador de alergênico." })
  }
})

const pricingSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("single"), basePriceCents: z.number().int().min(0).max(MENU_MAX_PRICE_CENTS) }).strict(),
  z.object({ mode: z.literal("variants"), variants: z.array(variantSchema).min(1).max(MENU_MAX_VARIANTS_PER_ITEM) }).strict(),
])

export const menuItemSaveSchema = z.object({
  expectedRestaurantId: uuid,
  itemId: uuid,
  categoryId: uuid,
  name: menuText(120, 2),
  description: menuText(600),
  isVisible: z.boolean(),
  isAvailable: z.boolean(),
  pricing: pricingSchema,
  highlights: z.array(menuText(30, 1)).max(10),
  attributes: z.array(itemAttributeSchema).max(30),
  media: z.array(mediaSchema).max(MENU_MAX_MEDIA_PER_ITEM),
}).strict().superRefine((item, context) => {
  const mediaIds = new Set<string>()
  const paths = new Set<string>()
  const mediaPathPattern = new RegExp(`^${item.expectedRestaurantId}/${item.itemId}/[0-9a-f-]{36}\\.(jpg|jpeg|png|webp|avif|mp4|webm)$`, "i")

  item.media.forEach((media, index) => {
    if (mediaIds.has(media.id)) {
      context.addIssue({ code: "custom", path: ["media", index, "id"], message: "Mídia repetida." })
    }
    mediaIds.add(media.id)
    if (!mediaPathPattern.test(media.storagePath) || paths.has(media.storagePath)) {
      context.addIssue({ code: "custom", path: ["media", index, "storagePath"], message: "Arquivo de mídia inválido." })
    }
    paths.add(media.storagePath)
    const extension = media.storagePath.split(".").at(-1)?.toLowerCase()
    const kindMatches = media.kind === "image"
      ? ["jpg", "jpeg", "png", "webp", "avif"].includes(extension ?? "")
      : ["mp4", "webm"].includes(extension ?? "")
    if (!kindMatches) context.addIssue({ code: "custom", path: ["media", index, "storagePath"], message: "Formato incompatível com a mídia." })

    if (media.posterPath) {
      if (media.kind !== "video" || !mediaPathPattern.test(media.posterPath) || !["jpg", "jpeg", "png", "webp", "avif"].includes(media.posterPath.split(".").at(-1)?.toLowerCase() ?? "")) {
        context.addIssue({ code: "custom", path: ["media", index, "posterPath"], message: "Capa do vídeo inválida." })
      }
      if (paths.has(media.posterPath)) context.addIssue({ code: "custom", path: ["media", index, "posterPath"], message: "Arquivo de capa repetido." })
      paths.add(media.posterPath)
    }
    if (media.kind === "image" && media.durationMs !== null) {
      context.addIssue({ code: "custom", path: ["media", index, "durationMs"], message: "Imagem não tem duração." })
    }
    if (media.kind === "video" && media.durationMs === null) {
      context.addIssue({ code: "custom", path: ["media", index, "durationMs"], message: "Informe a duração do vídeo." })
    }
  })

  if (item.pricing.mode === "variants") {
    const ids = new Set<string>()
    const names = new Set<string>()
    item.pricing.variants.forEach((variant, index) => {
      const key = normalized(variant.name)
      if (ids.has(variant.id)) context.addIssue({ code: "custom", path: ["pricing", "variants", index, "id"], message: "Variação repetida." })
      if (names.has(key)) context.addIssue({ code: "custom", path: ["pricing", "variants", index, "name"], message: "Use nomes diferentes para as variações." })
      ids.add(variant.id)
      names.add(key)
    })
  }

  const attributeIds = new Set<string>()
  item.attributes.forEach((attribute, index) => {
    if (attributeIds.has(attribute.id)) context.addIssue({ code: "custom", path: ["attributes", index, "id"], message: "Atributo repetido." })
    attributeIds.add(attribute.id)
  })

  const highlightLabels = new Set<string>()
  item.highlights.forEach((highlight, index) => {
    const key = normalized(highlight)
    if (highlightLabels.has(key)) context.addIssue({ code: "custom", path: ["highlights", index], message: "Destaque repetido." })
    highlightLabels.add(key)
  })
})

export const menuVisibilitySchema = z.object({
  expectedRestaurantId: uuid,
  kind: z.enum(["category", "item"]),
  id: uuid,
  isVisible: z.boolean(),
}).strict()

export const menuAvailabilitySchema = z.object({
  expectedRestaurantId: uuid,
  itemId: uuid,
  isAvailable: z.boolean(),
}).strict()

export const menuMoveSchema = z.object({
  expectedRestaurantId: uuid,
  itemId: uuid,
  categoryId: uuid,
}).strict()

export const menuDeleteSchema = z.object({
  expectedRestaurantId: uuid,
  id: uuid,
}).strict()

export const menuCategoryReorderSchema = z.object({
  expectedRestaurantId: uuid,
  order: z.array(uuid).max(1000),
}).strict()

export const menuItemReorderSchema = z.object({
  expectedRestaurantId: uuid,
  categoryId: uuid,
  order: z.array(uuid).max(1000),
}).strict()

export const menuUploadTicketSchema = z.object({
  expectedRestaurantId: uuid,
  itemId: uuid,
  kind: z.enum(["image", "video"]),
  mimeType: z.string().min(1).max(100),
  byteSize: z.number().int().positive().max(MENU_MEDIA_LIMITS.video.maxBytes),
}).strict().superRefine((input, context) => {
  const rules = MENU_MEDIA_LIMITS[input.kind]
  if (!(rules.mimes as readonly string[]).includes(input.mimeType) || input.byteSize > rules.maxBytes) {
    context.addIssue({ code: "custom", path: ["mimeType"], message: "Formato ou tamanho de mídia inválido." })
  }
})

export const menuUploadCleanupSchema = z.object({
  expectedRestaurantId: uuid,
  files: z.array(z.object({
    bucket: z.enum(["menu-images", "menu-videos"]),
    path: z.string().min(1).max(400),
  }).strict()).min(1).max(600),
}).strict()

export const menuPublicationSchema = z.object({ expectedRestaurantId: uuid }).strict()

export const menuBatchSchema = z.object({
  expectedRestaurantId: uuid,
  categories: z.array(z.object({
    id: uuid,
    name: menuText(80, 2),
    description: menuText(300),
    isVisible: z.boolean(),
  }).strict()).max(20),
  items: z.array(z.object({
    id: uuid,
    categoryId: uuid,
    name: menuText(120, 2),
    description: menuText(600),
    isVisible: z.boolean(),
    isAvailable: z.boolean(),
    pricing: pricingSchema,
    media: z.array(mediaSchema).max(MENU_MAX_MEDIA_PER_ITEM),
  }).strict()).min(1).max(50),
}).strict().superRefine((batch, context) => {
  const newCategoryIds = new Set(batch.categories.map((category) => category.id))
  if (newCategoryIds.size !== batch.categories.length) {
    context.addIssue({ code: "custom", path: ["categories"], message: "Categoria repetida." })
  }
  const categoryNames = new Set<string>()
  batch.categories.forEach((category, index) => {
    const key = normalized(category.name)
    if (categoryNames.has(key)) context.addIssue({ code: "custom", path: ["categories", index, "name"], message: "Categoria repetida." })
    categoryNames.add(key)
  })
  const itemIds = new Set<string>()
  const itemNamesByCategory = new Map<string, Set<string>>()
  const variantIds = new Set<string>()
  const mediaIds = new Set<string>()
  const mediaPaths = new Set<string>()
  batch.items.forEach((item, index) => {
    if (itemIds.has(item.id)) context.addIssue({ code: "custom", path: ["items", index, "id"], message: "Item repetido." })
    itemIds.add(item.id)
    if (!newCategoryIds.has(item.categoryId)) {
      // Existing category IDs are checked again transactionally by the RPC.
      if (!uuid.safeParse(item.categoryId).success) context.addIssue({ code: "custom", path: ["items", index, "categoryId"], message: "Categoria inválida." })
    }
    const names = itemNamesByCategory.get(item.categoryId) ?? new Set<string>()
    const key = normalized(item.name)
    if (names.has(key)) context.addIssue({ code: "custom", path: ["items", index, "name"], message: "Nome repetido nesta categoria." })
    names.add(key)
    itemNamesByCategory.set(item.categoryId, names)
    if (item.pricing.mode === "variants") {
      const variantNames = new Set<string>()
      item.pricing.variants.forEach((variant, variantIndex) => {
        const variantKey = normalized(variant.name)
        if (variantIds.has(variant.id)) {
          context.addIssue({ code: "custom", path: ["items", index, "pricing", "variants", variantIndex, "id"], message: "Variação repetida no lote." })
        }
        if (variantNames.has(variantKey)) {
          context.addIssue({ code: "custom", path: ["items", index, "pricing", "variants", variantIndex, "name"], message: "Use nomes diferentes para as variações." })
        }
        variantIds.add(variant.id)
        variantNames.add(variantKey)
      })
    }
    item.media.forEach((media, mediaIndex) => {
      const pathPattern = new RegExp(`^${batch.expectedRestaurantId}/${item.id}/[0-9a-f-]{36}\\.(jpg|jpeg|png|webp|avif|mp4|webm)$`, "i")
      if (!pathPattern.test(media.storagePath) || (media.kind === "image" && !/\.(jpg|jpeg|png|webp|avif)$/i.test(media.storagePath)) || (media.kind === "video" && !/\.(mp4|webm)$/i.test(media.storagePath))) {
        context.addIssue({ code: "custom", path: ["items", index, "media", mediaIndex], message: "Arquivo de mídia inválido." })
      }
      if (media.posterPath && (!pathPattern.test(media.posterPath) || !/\.(jpg|jpeg|png|webp|avif)$/i.test(media.posterPath))) {
        context.addIssue({ code: "custom", path: ["items", index, "media", mediaIndex, "posterPath"], message: "Capa inválida." })
      }
      if (media.kind === "video" && media.durationMs === null) {
        context.addIssue({ code: "custom", path: ["items", index, "media", mediaIndex, "durationMs"], message: "Informe a duração do vídeo." })
      }
      if (mediaIds.has(media.id)) context.addIssue({ code: "custom", path: ["items", index, "media", mediaIndex, "id"], message: "Mídia repetida no lote." })
      mediaIds.add(media.id)
      for (const path of [media.storagePath, ...(media.posterPath ? [media.posterPath] : [])]) {
        if (mediaPaths.has(path)) context.addIssue({ code: "custom", path: ["items", index, "media", mediaIndex], message: "Arquivo repetido no lote." })
        mediaPaths.add(path)
      }
    })
  })
})

export type MenuCategorySaveInput = z.infer<typeof menuCategorySaveSchema>
export type MenuAttributeCreateInput = z.infer<typeof menuAttributeCreateSchema>
export type MenuItemSaveInput = z.infer<typeof menuItemSaveSchema>
export type MenuUploadTicketInput = z.infer<typeof menuUploadTicketSchema>
export type MenuUploadCleanupInput = z.infer<typeof menuUploadCleanupSchema>
export type MenuVisibilityInput = z.infer<typeof menuVisibilitySchema>
export type MenuAvailabilityInput = z.infer<typeof menuAvailabilitySchema>
export type MenuMoveInput = z.infer<typeof menuMoveSchema>
export type MenuDeleteInput = z.infer<typeof menuDeleteSchema>
export type MenuCategoryReorderInput = z.infer<typeof menuCategoryReorderSchema>
export type MenuItemReorderInput = z.infer<typeof menuItemReorderSchema>
export type MenuBatchInput = z.infer<typeof menuBatchSchema>
