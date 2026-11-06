"use client"

import { motion } from "motion/react"
import { LuAlignLeft, LuAtSign, LuBuilding2, LuMapPin, LuPhone, LuStar, LuMessageCircle, LuStore } from "react-icons/lu"
import { IconCombobox, IconInput, IconTextarea } from "./icon-input"
import { useOnboarding } from "./onboarding-wizard"
import { PANEL_UF_CODES } from "../identity-options"
import { authItemVariants, authStaggerVariants } from "@/features/admin/auth/components/auth-motion"

export function ContactStep() {
  const { profile, updateField, updateContact, updateAddress, fieldErrors } = useOnboarding()
  const contact = profile.contact
  const address = contact.address
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
        <p className="mb-4 text-xs text-muted-foreground">Se ainda não tiver algum dado, deixe em branco e complete depois.</p>
        <motion.div variants={authStaggerVariants} initial="hidden" animate="visible" className="grid gap-5 sm:grid-cols-2">
          <motion.div variants={authItemVariants}><IconInput id="contact-phone" label="Telefone" icon={<LuPhone aria-hidden="true" />} value={contact.phone} onChange={(value) => updateContact("phone", value)} error={fieldErrors["contact.phone"]} type="tel" autoComplete="tel" placeholder="(11) 3333-4444" /></motion.div>
          <motion.div variants={authItemVariants}><IconInput id="contact-whatsapp" label="WhatsApp" icon={<LuMessageCircle aria-hidden="true" />} value={contact.whatsapp} onChange={(value) => updateContact("whatsapp", value)} error={fieldErrors["contact.whatsapp"]} type="tel" autoComplete="tel" placeholder="(11) 99999-9999" /></motion.div>
          <motion.div variants={authItemVariants}><IconInput id="contact-instagram" label="Instagram" icon={<LuAtSign aria-hidden="true" />} value={contact.instagram} onChange={(value) => updateContact("instagram", value.replace(/^@+/, ""))} error={fieldErrors["contact.instagram"]} autoCapitalize="none" placeholder="seu.restaurante" /></motion.div>
          <motion.div variants={authItemVariants}><IconInput id="contact-google-review" label="Link para avaliações" icon={<LuStar aria-hidden="true" />} value={contact.googleReviewUrl} onChange={(value) => updateContact("googleReviewUrl", value)} error={fieldErrors["contact.googleReviewUrl"]} type="url" placeholder="https://g.page/.../review" /></motion.div>
        </motion.div>
      </motion.section>

      <motion.section variants={authItemVariants}>
        <h3 className="mb-1 text-sm font-semibold">Endereço</h3>
        <p className="mb-4 text-xs text-muted-foreground">Opcional. Se preencher, complete todos os campos do endereço.</p>
        <motion.div variants={authStaggerVariants} initial="hidden" animate="visible" className="grid gap-5 sm:grid-cols-2">
          <motion.div variants={authItemVariants}><IconInput id="address-cep" label="CEP" icon={<LuMapPin aria-hidden="true" />} value={address.cep} onChange={(value) => updateAddress("cep", value)} error={fieldErrors["contact.address"]} autoComplete="postal-code" placeholder="00000-000" /></motion.div>
          <motion.div variants={authItemVariants}><IconInput id="address-street" label="Rua ou avenida" icon={<LuMapPin aria-hidden="true" />} value={address.street} onChange={(value) => updateAddress("street", value)} autoComplete="address-line1" /></motion.div>
          <motion.div variants={authItemVariants}><IconInput id="address-number" label="Número" icon={<LuBuilding2 aria-hidden="true" />} value={address.number} onChange={(value) => updateAddress("number", value)} /></motion.div>
          <motion.div variants={authItemVariants}><IconInput id="address-complement" label="Complemento" icon={<LuBuilding2 aria-hidden="true" />} value={address.complement} onChange={(value) => updateAddress("complement", value)} autoComplete="address-line2" /></motion.div>
          <motion.div variants={authItemVariants}><IconInput id="address-district" label="Bairro" icon={<LuMapPin aria-hidden="true" />} value={address.district} onChange={(value) => updateAddress("district", value)} /></motion.div>
          <motion.div variants={authItemVariants}><IconInput id="address-city" label="Cidade" icon={<LuMapPin aria-hidden="true" />} value={address.city} onChange={(value) => updateAddress("city", value)} autoComplete="address-level2" /></motion.div>
          <motion.div variants={authItemVariants}><IconCombobox id="address-state" label="Estado" icon={<LuMapPin aria-hidden="true" />} value={address.state} options={PANEL_UF_CODES.map((value) => ({ value, label: value }))} onChange={(value) => updateAddress("state", value)} placeholder="Selecione o estado" /></motion.div>
          <motion.div variants={authItemVariants}><IconInput id="address-maps" label="Link do Google Maps" icon={<LuMapPin aria-hidden="true" />} value={contact.mapsUrl} onChange={(value) => updateContact("mapsUrl", value)} error={fieldErrors["contact.mapsUrl"]} type="url" placeholder="https://maps.app.goo.gl/..." /></motion.div>
        </motion.div>
        {fieldErrors["contact.address"] ? <p role="alert" className="mt-3 text-sm text-destructive">{fieldErrors["contact.address"]}</p> : null}
      </motion.section>
    </motion.div>
  )
}
