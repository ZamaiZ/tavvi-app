import { MenuWorkspace } from "@/features/panel/menu/components/menu-workspace"
import type { PanelMenuDTO } from "@/features/panel/menu/model"

export function PanelMenuTemplate({ menu, publicUrl }: { menu: PanelMenuDTO; publicUrl: string }) {
  return <MenuWorkspace initialMenu={menu} publicUrl={publicUrl} />
}
