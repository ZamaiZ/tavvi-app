import { z } from "zod"

const uuid = z.string().uuid()

export const panelCallsContextSchema = z.object({
  expectedRestaurantId: uuid,
}).strict()

export const panelCallMutationSchema = panelCallsContextSchema.extend({
  callId: uuid,
}).strict()
