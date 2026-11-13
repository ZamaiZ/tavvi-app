import { z } from "zod"

const expectedRestaurantId = z.string().uuid()
const identifierId = z.string().uuid()
const operationId = z.string().uuid()
const tableNumber = z.coerce.number().int().positive().max(2_147_483_647)
const serial = z.string().regex(/^[0-9A-F]{14}$/)

export const identifierCreateSchema = z.object({
  expectedRestaurantId,
  tableNumber,
}).strict()

export const identifierUpdateSchema = z.object({
  expectedRestaurantId,
  id: identifierId,
  tableNumber,
}).strict()

export const identifierActiveSchema = z.object({
  expectedRestaurantId,
  id: identifierId,
  isActive: z.boolean(),
}).strict()

export const identifierNfcBeginSchema = z.object({
  expectedRestaurantId,
  id: identifierId,
  operationId,
  serial,
}).strict()

export const identifierNfcOperationSchema = z.object({
  expectedRestaurantId,
  id: identifierId,
  operationId,
}).strict()

export const identifierNfcWriteSchema = identifierNfcOperationSchema.extend({
  attemptId: operationId,
}).strict()

export const identifierNfcWriteClaimSchema = identifierNfcWriteSchema

export const identifierNfcPhysicalStartedSchema = identifierNfcWriteSchema

export const identifierNfcUncertainSchema = identifierNfcOperationSchema.extend({
  attemptId: operationId,
  reason: z.enum(["write_failed", "lock_failed", "server_unavailable", "page_interrupted", "serial_mismatch"]),
}).strict()

export const identifierNfcCompleteSchema = identifierNfcWriteSchema.extend({
  serial,
}).strict()

