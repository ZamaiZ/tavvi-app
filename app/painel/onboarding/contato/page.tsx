import type { Metadata } from "next"
import { ContactStep } from "@/features/panel/onboarding/components/contact-step"

export const metadata: Metadata = { title: "Contato do restaurante" }

export default function PanelContactPage() {
  return <ContactStep />
}
