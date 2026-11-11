import { z } from "zod"

import { publicRestaurantSlugSchema } from "./model"

const publicMenuSchema = z.object({
  slug: publicRestaurantSlugSchema,
  presentation: z.enum(["immersive", "standard", "catalog-list", "catalog-grid"]).transform((value) => value === "immersive" ? "immersive" : "standard"),
  categories: z.array(z.object({
    id: z.string().uuid(),
    name: z.string().trim().min(2).max(80),
    description: z.string().max(300),
    items: z.array(z.object({
      id: z.string().uuid(),
      name: z.string().trim().min(2).max(120),
      description: z.string().max(600),
      isAvailable: z.boolean(),
      highlights: z.array(z.string().max(30)).max(10),
      pricing: z.discriminatedUnion("mode", [
        z.object({ mode: z.literal("single"), basePriceCents: z.number().int().min(0) }).strict(),
        z.object({ mode: z.literal("variants"), variants: z.array(z.object({
          id: z.string().uuid(),
          name: z.string().max(60),
          priceCents: z.number().int().min(0),
          isAvailable: z.boolean(),
        }).strict()).min(1).max(30) }).strict(),
      ]),
      attributes: z.array(z.object({
        kind: z.enum(["diet", "allergen"]),
        label: z.string().max(40),
        qualifier: z.enum(["contains", "may_contain"]).nullable(),
      }).strict()),
      media: z.array(z.object({
        id: z.string().uuid(),
        kind: z.enum(["image", "video"]),
        altText: z.string().max(180),
        hasPoster: z.boolean(),
        width: z.number().int().nullable(),
        height: z.number().int().nullable(),
        durationMs: z.number().int().nullable(),
      }).strict()).max(6),
    }).strict()).min(1),
  }).strict()).min(1).max(1000),
}).strict()

export type PublicMenuDTO = {
  slug: string
  presentation: "immersive" | "standard"
  categories: {
    id: string
    name: string
    description: string
    items: {
      id: string
      name: string
      description: string
      isAvailable: boolean
      highlights: string[]
      pricing: { mode: "single"; basePriceCents: number } | {
        mode: "variants"
        variants: { id: string; name: string; priceCents: number; isAvailable: boolean }[]
      }
      attributes: { kind: "diet" | "allergen"; label: string; qualifier: "contains" | "may_contain" | null }[]
      media: {
        id: string
        kind: "image" | "video"
        altText: string
        url: string
        posterUrl: string | null
        width: number | null
        height: number | null
        durationMs: number | null
      }[]
    }[]
  }[]
}

export function parsePublicMenu(value: unknown): PublicMenuDTO | null {
  const parsed = publicMenuSchema.safeParse(value)
  if (!parsed.success) return null
  const { slug, presentation, categories } = parsed.data
  return {
    slug,
    presentation,
    categories: categories.map((category) => ({
      ...category,
      items: category.items.map((item) => ({
        ...item,
        media: item.media.map((media) => {
          const url = `/${slug}/menu/media/${encodeURIComponent(media.id)}`
          return {
            id: media.id,
            kind: media.kind,
            altText: media.altText,
            url,
            posterUrl: media.hasPoster ? `${url}?poster=1` : null,
            width: media.width,
            height: media.height,
            durationMs: media.durationMs,
          }
        }),
      })),
    })),
  }
}
