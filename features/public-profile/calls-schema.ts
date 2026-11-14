import { z } from "zod"

export const publicServiceCallSchema = z.object({
  token: z.string().regex(/^[0-9A-F]{32}$/),
}).strict()
