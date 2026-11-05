import { Badge } from "@/components/ui/badge"
import {
  restaurantStatusLabels,
  type RestaurantStatus,
} from "@/features/admin/restaurants/model"

const statusClasses: Record<RestaurantStatus, string> = {
  draft:
    "border-border/70 bg-muted/60 text-muted-foreground",
  active:
    "border-emerald-600/15 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300",
  suspended:
    "border-amber-600/20 bg-amber-500/10 text-amber-800 dark:text-amber-300",
}

export function RestaurantStatusBadge({ status }: { status: RestaurantStatus }) {
  return (
    <Badge variant="outline" className={`gap-1.5 rounded-full px-2.5 py-1 font-medium ${statusClasses[status]}`}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {restaurantStatusLabels[status]}
    </Badge>
  )
}
