import type { Metadata } from "next"
import { IdentityStep } from "@/features/panel/onboarding/components/identity-step"

export const metadata: Metadata = { title: "Identidade do restaurante" }

export default function PanelIdentityPage() {
  return <IdentityStep />
}
