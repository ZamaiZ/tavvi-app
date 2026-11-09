"use client"

import { motion } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { LuAlignLeft, LuAtSign, LuBuilding2, LuMapPin, LuPhone, LuMessageCircle, LuStore } from "react-icons/lu"
import { IconCombobox, IconInput, IconTextarea } from "./icon-input"
import { useOnboarding } from "./onboarding-wizard"
import { PANEL_UF_CODES } from "../identity-options"
import { authItemVariants, authStaggerVariants } from "@/features/admin/auth/components/auth-motion"

export function ContactStep() {
  const { profile, updateProfile, updateField, updateContact, updateAddress, fieldErrors } = useOnboarding()
  const contact = profile.contact
  const address = contact.address
  const latestProfile = useRef(profile)
  latestProfile.current = profile
  const lastCep = useRef(address.cep)
  const [cepNotice, setCepNotice] = useState("")

  useEffect(() => {
    if (address.cep === lastCep.current) return
    lastCep.current = address.cep
    const digits = address.cep.replace(/\D/g, "")
    if (digits.length !== 8) { setCepNotice(""); return }
    const original = latestProfile.current.contact.address
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setCepNotice("Buscando CEP…")
      try {
        const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal: controller.signal })
        if (!response.ok) throw new Error("unavailable")
        const data: unknown = await response.json()
        if (controller.signal.aborted) return
        if (!data || typeof data !== "object") throw new Error("unavailable")
        const result = data as Record<string, unknown>
        if (result.erro === true || result.erro === "true") { setCepNotice("CEP não encontrado. Confira os números ou preencha o endereço manualmente. (Código: cep_not_found)"); return }
        if (typeof result.localidade !== "string" || !PANEL_UF_CODES.includes(result.uf as typeof PANEL_UF_CODES[number])) throw new Error("unavailable")
        const current = latestProfile.current
        if (current.contact.address.cep.replace(/\D/g, "") !== digits) return
        const next = { ...current.contact.address }
        for (const [key, source] of [["street", "logradouro"], ["district", "bairro"], ["city", "localidade"], ["state", "uf"]] as const) {
          if (next[key] === original[key] && typeof result[source] === "string") next[key] = result[source] as string
        }
        updateProfile({ ...current, contact: { ...current.contact, address: next } })
        setCepNotice(!result.logradouro || !result.bairro ? "Complete a rua e o bairro se não vieram no CEP." : "Endereço encontrado. Confira os dados e informe o número.")
      } catch {
        if (!controller.signal.aborted) setCepNotice("Não foi possível consultar o CEP. Preencha o endereço manualmente. (Código: cep_unavailable)")
      }
    }, 500)
    return () => { clearTimeout(timer); controller.abort() }
  }, [address.cep, updateProfile])

  function maskPhone(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 11)
    if (digits.length <= 2) return digits ? `(${digits}` : ""
    const middle = digits.length > 10 ? 7 : 6
    return `(${digits.slice(0, 2)}) ${digits.slice(2, middle)}${digits.length > middle ? `-${digits.slice(middle)}` : ""}`
  }
  function maskCep(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 8)
    return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
  }
  return (
    <motion.div variants={authStaggerVariants} initial="hidden" animate="visible" className="space-y-8">
      <motion.header variants={authItemVariants}>
        <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><LuPhone aria-hidden="true" /></div>
        <h2 className="text-xl font-semibold tracking-tight">Contato e localização</h2>
        <p className="mt-1 text-sm text-muted-foreground">Informe como seus clientes podem encontrar e falar com o restaurante.</p>
      </motion.header>

      <motion.section variants={authItemVariants}>
        <h3 className="mb-4 text-sm font-semibold">Apresentação pública</h3>
        <motion.div variants={authStaggerVariants} initial="hidden" animate="visible" className="space-y-5">
          <motion.div variants={authItemVariants}><IconInput id="contact-restaurant-name" label="Nome do restaurante" icon={<LuStore aria-hidden="true" />} value={profile.name} onChange={(value) => updateField("name", value)} error={fieldErrors.name} maxLength={120} autoComplete="organization" /></motion.div>
          <motion.div variants={authItemVariants}><IconTextarea id="contact-restaurant-description" label="Descrição" icon={<LuAlignLeft aria-hidden="true" />} value={profile.description} onChange={(value) => updateField("description", value)} error={fieldErrors.description} maxLength={500} placeholder="Conte em poucas palavras o que torna seu restaurante especial." description="Essa descrição poderá aparecer na página pública do restaurante." /></motion.div>
        </motion.div>
      </motion.section>

      <motion.section variants={authItemVariants}>
        <h3 className="mb-4 text-sm font-semibold">Canais de contato</h3>
        <p className="mb-4 text-xs text-muted-foreground">WhatsApp é obrigatório. Os demais canais são opcionais.</p>
        <motion.div variants={authStaggerVariants} initial="hidden" animate="visible" className="grid gap-5 sm:grid-cols-2">
          <motion.div variants={authItemVariants}><IconInput id="contact-phone" label="Telefone (opcional)" icon={<LuPhone aria-hidden="true" />} value={contact.phone} onChange={(value) => updateContact("phone", maskPhone(value))} error={fieldErrors["contact.phone"]} type="tel" autoComplete="tel" placeholder="(11) 3333-4444" /></motion.div>
          <motion.div variants={authItemVariants}><IconInput id="contact-whatsapp" label="WhatsApp" icon={<LuMessageCircle aria-hidden="true" />} value={contact.whatsapp} onChange={(value) => updateContact("whatsapp", maskPhone(value))} error={fieldErrors["contact.whatsapp"]} type="tel" autoComplete="tel" required placeholder="(11) 99999-9999" /></motion.div>
          <motion.div variants={authItemVariants}><IconInput id="contact-instagram" label="Instagram" icon={<LuAtSign aria-hidden="true" />} value={contact.instagram} onChange={(value) => updateContact("instagram", value.replace(/^@+/, ""))} error={fieldErrors["contact.instagram"]} autoCapitalize="none" placeholder="seu.restaurante" /></motion.div>
        </motion.div>
      </motion.section>

      <motion.section variants={authItemVariants}>
        <h3 className="mb-1 text-sm font-semibold">Endereço</h3>
        <p className="mb-4 text-xs text-muted-foreground">Informe o endereço completo. Apenas o complemento é opcional.</p>
        <motion.div variants={authStaggerVariants} initial="hidden" animate="visible" className="grid gap-5 sm:grid-cols-2">
          <motion.div variants={authItemVariants}><IconInput id="address-cep" label="CEP" icon={<LuMapPin aria-hidden="true" />} value={address.cep} onChange={(value) => updateAddress("cep", maskCep(value))} error={fieldErrors["contact.address.cep"]} inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" description={cepNotice || undefined} /></motion.div>
          <motion.div variants={authItemVariants}><IconInput id="address-street" label="Rua ou avenida" icon={<LuMapPin aria-hidden="true" />} value={address.street} onChange={(value) => updateAddress("street", value)} error={fieldErrors["contact.address.street"]} autoComplete="address-line1" /></motion.div>
          <motion.div variants={authItemVariants}><IconInput id="address-number" label="Número" icon={<LuBuilding2 aria-hidden="true" />} value={address.number} onChange={(value) => updateAddress("number", value)} error={fieldErrors["contact.address.number"]} /></motion.div>
          <motion.div variants={authItemVariants}><IconInput id="address-complement" label="Complemento (opcional)" icon={<LuBuilding2 aria-hidden="true" />} value={address.complement} onChange={(value) => updateAddress("complement", value)} autoComplete="address-line2" /></motion.div>
          <motion.div variants={authItemVariants}><IconInput id="address-district" label="Bairro" icon={<LuMapPin aria-hidden="true" />} value={address.district} onChange={(value) => updateAddress("district", value)} error={fieldErrors["contact.address.district"]} /></motion.div>
          <motion.div variants={authItemVariants}><IconInput id="address-city" label="Cidade" icon={<LuMapPin aria-hidden="true" />} value={address.city} onChange={(value) => updateAddress("city", value)} error={fieldErrors["contact.address.city"]} autoComplete="address-level2" /></motion.div>
          <motion.div variants={authItemVariants}><IconCombobox id="address-state" label="Estado" icon={<LuMapPin aria-hidden="true" />} value={address.state} options={PANEL_UF_CODES.map((value) => ({ value, label: value }))} onChange={(value) => updateAddress("state", value)} placeholder="Selecione o estado" />{fieldErrors["contact.address.state"] ? <p role="alert" className="mt-1 text-sm text-destructive">{fieldErrors["contact.address.state"]}</p> : null}</motion.div>
          <motion.div variants={authItemVariants}><IconInput id="address-maps" label="Perfil no Google Maps (opcional)" icon={<LuMapPin aria-hidden="true" />} value={contact.mapsUrl} onChange={(value) => updateContact("mapsUrl", value)} error={fieldErrors["contact.mapsUrl"]} type="url" placeholder="https://maps.app.goo.gl/..." description="Usaremos este link para gerar o acesso às avaliações ao finalizar." /></motion.div>
        </motion.div>
        {fieldErrors["contact.address"] ? <p role="alert" className="mt-3 text-sm text-destructive">{fieldErrors["contact.address"]}</p> : null}
      </motion.section>
    </motion.div>
  )
}
