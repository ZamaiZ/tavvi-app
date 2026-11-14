import { z } from "zod"

const uuid = z.string().uuid()
const resolvedCallsCursorSchema = z.object({
  resolvedAt: z.iso.datetime({ offset: true }),
  id: uuid,
}).strict()

export const panelCallsContextSchema = z.object({
  expectedRestaurantId: uuid,
}).strict()

export const panelResolvedCallsSchema = panelCallsContextSchema.extend({
  cursor: resolvedCallsCursorSchema.nullable(),
}).strict()

export const panelCallMutationSchema = panelCallsContextSchema.extend({
  callId: uuid,
}).strict()
