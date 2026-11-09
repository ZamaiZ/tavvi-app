import { z } from "zod"

import { isReservedRestaurantSlug } from "@/lib/routing/reserved-slugs"

export const publicRestaurantSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .refine((slug) => !isReservedRestaurantSlug(slug))

const brandPathSchema = z
  .string()
  .max(500)
  .regex(/^[0-9a-f-]{36}\/(?:logo|cover)\/[0-9a-f-]{36}\.(?:jpg|jpeg|png|webp)$/i)

const publicRestaurantRowSchema = z.object({
  slug: publicRestaurantSlugSchema,
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).nullable().catch(null),
  segment: z.string().trim().min(2).max(60).nullable().catch(null),
  logo_path: brandPathSchema.nullable().catch(null),
  cover_path: brandPathSchema.nullable().catch(null),
  contact: z.unknown(),
  theme: z.unknown(),
})

const addressKeys = [
  "cep",
  "street",
  "number",
  "complement",
  "district",
  "city",
  "state",
] as const

export type PublicRestaurantAddress = Partial<Record<(typeof addressKeys)[number], string>>

export type PublicRestaurantContact = {
  phone: string | null
  whatsapp: string | null
  instagram: string | null
  address: PublicRestaurantAddress | null
  mapsUrl: string | null
  googleReviewUrl: string | null
}

export type PublicRestaurantProfile = {
  slug: string
  name: string
  description: string | null
  segment: string | null
  logoPath: string | null
  coverPath: string | null
  contact: PublicRestaurantContact
  theme: unknown
}

const publicRestaurantSearchRowSchema = z.object({
  slug: publicRestaurantSlugSchema,
  name: z.string().trim().min(2).max(120),
  segment: z.string().trim().min(2).max(60).nullable().catch(null),
  hasLogo: z.boolean(),
  address: z.unknown(),
}).strict()

const publicRestaurantSearchPageSchema = z.object({
  rows: z.array(publicRestaurantSearchRowSchema).max(20),
  hasMore: z.boolean(),
}).strict()

export const publicRestaurantSearchInputSchema = z.object({
  query: z.string().trim().max(120),
  page: z.number().int().min(1).max(1000),
}).strict()

export type PublicRestaurantSearchResult = {
  slug: string
  name: string
  segment: string | null
  hasLogo: boolean
  address: PublicRestaurantAddress | null
}

export type PublicRestaurantSearchPage = {
  rows: PublicRestaurantSearchResult[]
  hasMore: boolean
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function textValue(value: unknown, maxLength: number): string | null {
  const parsed = z.string().trim().max(maxLength).safeParse(value)
  return parsed.success && parsed.data ? parsed.data : null
}

function isBrazilianPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "")
  return digits.length === 10
    || digits.length === 11
    || ((digits.length === 12 || digits.length === 13) && digits.startsWith("55"))
}

function safeGoogleMapsUrl(value: unknown): string | null {
  const candidate = textValue(value, 500)
  if (!candidate) return null

  try {
    const url = new URL(candidate)
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null

    const host = url.hostname.toLowerCase()
    const anyPathHosts = new Set([
      "maps.app.goo.gl",
      "g.page",
      "maps.google.com",
      "maps.google.com.br",
    ])
    if (anyPathHosts.has(host)) return url.toString()

    const googleHosts = new Set([
      "goo.gl",
      "google.com",
      "www.google.com",
      "google.com.br",
      "www.google.com.br",
    ])
    if (!googleHosts.has(host)) return null
    if (host === "goo.gl") return url.pathname === "/maps" || url.pathname.startsWith("/maps/") ? url.toString() : null
    return url.pathname === "/maps" || url.pathname.startsWith("/maps/") ? url.toString() : null
  } catch {
    return null
  }
}

function safeGoogleReviewUrl(value: unknown): string | null {
  const candidate = textValue(value, 400)
  if (!candidate) return null

  try {
    const url = new URL(candidate)
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null

    if (url.hostname.toLowerCase() === "g.page") {
      return /^\/r\/[A-Za-z0-9_-]+\/review\/?$/.test(url.pathname) ? url.toString() : null
    }
    if (url.hostname.toLowerCase() === "search.google.com") {
      return url.pathname === "/local/writereview" && Boolean(url.searchParams.get("placeid"))
        ? url.toString()
        : null
    }
    return null
  } catch {
    return null
  }
}

function parseAddress(value: unknown): PublicRestaurantAddress | null {
  const source = recordValue(value)
  if (!source) return null

  const address = Object.fromEntries(
    addressKeys
      .map((key) => [
        key,
        textValue(
          source[key],
          key === "street"
            ? 120
            : key === "district" || key === "city"
              ? 80
              : key === "complement"
                ? 60
                : key === "number"
                  ? 10
                  : 9,
        ),
      ] as const)
      .filter((entry): entry is readonly [typeof addressKeys[number], string] => entry[1] !== null),
  ) as PublicRestaurantAddress

  return Object.keys(address).length ? address : null
}

export function parsePublicRestaurantContact(value: unknown): PublicRestaurantContact {
  const source = recordValue(value) ?? {}
  const phone = textValue(source.phone, 30)
  const whatsapp = textValue(source.whatsapp, 30)
  const instagramValue = textValue(source.instagram, 60)?.replace(/^@+/, "") ?? null

  return {
    phone: phone && /^\+?[\d\s().-]{8,24}$/.test(phone) && isBrazilianPhone(phone) ? phone : null,
    whatsapp: whatsapp && /^\+?[\d\s().-]{8,24}$/.test(whatsapp) && isBrazilianPhone(whatsapp) ? whatsapp : null,
    instagram: instagramValue && /^[A-Za-z0-9._]{1,60}$/.test(instagramValue)
      ? instagramValue
      : null,
    address: parseAddress(source.address),
    mapsUrl: safeGoogleMapsUrl(source.mapsUrl),
    googleReviewUrl: safeGoogleReviewUrl(source.googleReviewUrl),
  }
}

export function formatPublicRestaurantAddress(address: PublicRestaurantAddress | null): string | null {
  if (!address) return null

  const street = [address.street, address.number, address.complement]
    .filter(Boolean)
    .join(", ")
  const locality = [address.city, address.state].filter(Boolean).join(" / ")
  const formattedCep = address.cep?.replace(/\D/g, "")
  const cep = formattedCep && formattedCep.length === 8
    ? formattedCep.slice(0, 5) + "-" + formattedCep.slice(5)
    : address.cep
  const parts = [street, address.district, locality, cep ? "CEP: " + cep : null].filter(Boolean)

  return parts.length ? parts.join(" · ") : null
}

export function directionsUrl(contact: PublicRestaurantContact): string | null {
  if (contact.mapsUrl) return contact.mapsUrl
  const address = formatPublicRestaurantAddress(contact.address)
  if (!address) return null

  const url = new URL("https://www.google.com/maps/search/")
  url.searchParams.set("api", "1")
  url.searchParams.set("query", address)
  return url.toString()
}

export function parsePublicRestaurantProfile(value: unknown): PublicRestaurantProfile | null {
  const parsed = publicRestaurantRowSchema.safeParse(value)
  if (!parsed.success) return null

  return {
    slug: parsed.data.slug,
    name: parsed.data.name,
    description: parsed.data.description || null,
    segment: parsed.data.segment || null,
    logoPath: parsed.data.logo_path,
    coverPath: parsed.data.cover_path,
    contact: parsePublicRestaurantContact(parsed.data.contact),
    theme: parsed.data.theme,
  }
}

export function parsePublicRestaurantSearchPage(value: unknown): PublicRestaurantSearchPage | null {
  const parsed = publicRestaurantSearchPageSchema.safeParse(value)
  if (!parsed.success) return null

  return {
    rows: parsed.data.rows.map((row) => ({
      slug: row.slug,
      name: row.name,
      segment: row.segment || null,
      hasLogo: row.hasLogo,
      address: parsePublicRestaurantContact({ address: row.address }).address,
    })),
    hasMore: parsed.data.hasMore,
  }
}
