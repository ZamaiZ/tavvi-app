import type { Metadata } from "next"
import { LuMessageSquareText } from "react-icons/lu"

import { FeedbackWorkspace } from "@/features/panel/feedback/components/feedback-workspace"
import { getFeedbackPage, getUnreadFeedbackCount } from "@/features/panel/feedback/server/read"
import { PanelPageHeading } from "@/features/panel/workspace/components/panel-page-heading"
import { getActivePanelRestaurant } from "@/features/panel/workspace/server/restaurants"

export const metadata: Metadata = { title: "Feedbacks" }

export default async function PanelFeedbackPage() {
  const restaurant = await getActivePanelRestaurant()
  if (!restaurant) throw new Error("panel_restaurant_not_found")
  const [initialPage, unreadCount] = await Promise.all([
    getFeedbackPage(restaurant, "all"),
    getUnreadFeedbackCount(restaurant.id),
  ])

  return (
    <div className="min-h-svh">
      <header className="mx-auto w-full max-w-[1320px] px-4 pt-6 pb-4 sm:px-6 md:pt-5 lg:px-8">
        <PanelPageHeading title="Feedbacks" icon={<LuMessageSquareText aria-hidden="true" className="size-4" />} />
      </header>
      <FeedbackWorkspace restaurantId={restaurant.id} initialPage={initialPage} initialUnreadCount={unreadCount} />
    </div>
  )
}
