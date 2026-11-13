import { LuCircleAlert, LuCircleDashed, LuShieldCheck } from "react-icons/lu"

import { Badge } from "@/components/ui/badge"
import type { IdentifierDTO } from "../model"

export function IdentifierNfcStatus({
  identifier,
}: {
  identifier: IdentifierDTO
}) {
  if (identifier.nfcStatus === "protected") {
    return (
      <Badge
        variant="outline"
        className="h-7 border-emerald-600/20 bg-emerald-600/[0.07] px-2.5 text-emerald-700 dark:text-emerald-400"
      >
        <LuShieldCheck aria-hidden="true" className="size-3.5" />
        Protegida
      </Badge>
    )
  }
  if (identifier.nfcStatus === "uncertain") {
    return (
      <Badge
        variant="outline"
        className="h-7 border-amber-600/25 bg-amber-500/[0.08] px-2.5 text-amber-800 dark:text-amber-300"
      >
        <LuCircleAlert aria-hidden="true" className="size-3.5" />
        Proteção incerta
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className="h-7 border-border/80 bg-muted/50 px-2.5 text-muted-foreground"
    >
      <LuCircleDashed aria-hidden="true" className="size-3.5" />
      NFC pendente
    </Badge>
  )
}
