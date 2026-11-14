import { z } from "zod"

const uuidSchema = z.string().uuid()
const cursorSchema = z.object({
  publishedAt: z.iso.datetime({ offset: true }),
  id: uuidSchema,
}).strict()

export const feedbackListSchema = z.object({
  expectedRestaurantId: uuidSchema,
  filter: z.enum(["all", "unread"]),
  cursor: cursorSchema.optional(),
}).strict()

export const feedbackReadSchema = z.object({
  expectedRestaurantId: uuidSchema,
  feedbackId: uuidSchema,
  read: z.boolean(),
}).strict()

export const feedbackDeleteSchema = z.object({
  expectedRestaurantId: uuidSchema,
  feedbackId: uuidSchema,
}).strict()

