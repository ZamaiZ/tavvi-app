import { z } from "zod"
import { isReservedRestaurantSlug } from "@/lib/routing/reserved-slugs"

export const restaurantStatusSchema = z.enum(["draft", "active", "suspended"])

export const restaurantFilterSchema = z.enum([
  "all",
  "draft",
  "active",
  "suspended",
])

export const restaurantSlugSchema = z
  .string()
  .trim()
  .min(1, "Informe um endereço.")
  .max(80, "O endereço deve ter no máximo 80 caracteres.")
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use letras minúsculas, números e hífens.")

export const restaurantListQuerySchema = z.object({
  search: z.string().trim().max(120).default(""),
  status: restaurantFilterSchema.default("all"),
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
})

export const restaurantIdSchema = z.string().uuid("Restaurante inválido.")

export const updateRestaurantSlugSchema = z.object({
  restaurantId: restaurantIdSchema,
  slug: restaurantSlugSchema.refine((slug) => !isReservedRestaurantSlug(slug), {
    message: "Esse endereço é reservado pela plataforma.",
  }),
})

export type UpdateRestaurantSlugInput = z.infer<
  typeof updateRestaurantSlugSchema
>
