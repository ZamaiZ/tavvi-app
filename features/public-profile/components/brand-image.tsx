"use client"

import Image from "next/image"
import { useState } from "react"
import type { ReactNode } from "react"

type BrandImageProps = {
  slug: string
  slot: "logo" | "cover"
  alt: string
  sizes: string
  className: string
  fallback?: ReactNode
  fetchPriority?: "high" | "low" | "auto"
}

export function BrandImage({
  slug,
  slot,
  alt,
  sizes,
  className,
  fallback = null,
  fetchPriority,
}: BrandImageProps) {
  const [failed, setFailed] = useState(false)

  if (failed) return fallback

  return (
    <Image
      src={`/${slug}/media/${slot}`}
      alt={alt}
      fill
      sizes={sizes}
      className={className}
      unoptimized
      fetchPriority={fetchPriority}
      loading={fetchPriority === "high" ? "eager" : "lazy"}
      onError={() => setFailed(true)}
    />
  )
}
