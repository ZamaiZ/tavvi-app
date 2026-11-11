import { z } from "zod"
import { MENU_MAX_ATTRIBUTES_PER_ITEM, MENU_MAX_VARIANTS_PER_ITEM } from "../model"

const uuid = z.string().uuid()
const localFile = z.custom<File>((value) => typeof File !== "undefined" && value instanceof File)
const draftVariantSchema = z.object({
  id: uuid,
  name: z.string().max(60),
  price: z.string().max(24),
  isAvailable: z.boolean(),
}).strict()
const draftAttributeSchema = z.object({
  id: uuid,
  kind: z.enum(["diet", "allergen"]),
  qualifier: z.enum(["contains", "may_contain"]).nullable(),
}).strict()

export const menuBatchDraftSchema = z.object({
  schemaVersion: z.literal(1),
  restaurantId: uuid,
  updatedAt: z.number().int().positive(),
  categories: z.array(z.object({
    id: uuid,
    name: z.string().max(80),
    description: z.string().max(300),
  }).strict()).max(20),
  items: z.array(z.object({
    id: uuid,
    categoryId: uuid.or(z.literal("")),
    name: z.string().max(120),
    description: z.string().max(600),
    price: z.string().max(24),
    pricingMode: z.enum(["single", "variants"]).default("single"),
    variants: z.array(draftVariantSchema).max(MENU_MAX_VARIANTS_PER_ITEM).default([]),
    highlights: z.string().max(320).default(""),
    attributes: z.array(draftAttributeSchema).max(MENU_MAX_ATTRIBUTES_PER_ITEM).default([]),
    files: z.array(localFile).max(6),
  }).strict()).max(50),
}).strict()

export type MenuBatchDraft = z.infer<typeof menuBatchDraftSchema>

export function parseMenuBatchDraft(value: unknown, restaurantId: string): MenuBatchDraft | null {
  const parsed = menuBatchDraftSchema.safeParse(value)
  return parsed.success && parsed.data.restaurantId === restaurantId ? parsed.data : null
}
