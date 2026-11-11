"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { MotionConfig, motion, useReducedMotion } from "motion/react"
import { useRouter } from "next/navigation"
import { LuAlignLeft, LuAtSign, LuBuilding2, LuCheck, LuCircleAlert, LuEye, LuMapPin, LuMessageCircle, LuPhone, LuSave, LuStore, LuX } from "react-icons/lu"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { IconCombobox, IconInput, IconTextarea } from "@/features/panel/onboarding/components/icon-input"
import { PANEL_UF_CODES } from "@/features/panel/onboarding/identity-options"
import type { PanelRestaurantDTO } from "@/features/panel/onboarding/model"
import { profileFromPanelRestaurant } from "@/features/panel/onboarding/profile"
import { saveActiveRestaurantContactAction } from "@/features/panel/profile/actions"
import type { PanelRestaurantDraftProfile } from "@/features/panel/onboarding/schema"

type Props = { restaurant: PanelRestaurantDTO }
type FieldErrors = Record<string, string>

function formatAddress(profile: PanelRestaurantDraftProfile) {
  const address = profile.contact.address
  return [address.street && address.number ? `${address.street}, ${address.number}` : address.street || address.number, address.complement, address.district, address.city && address.state ? `${address.city} — ${address.state}` : address.city || address.state, address.cep].filter(Boolean).join(" · ")
}

function failureMessage(code: string) {
  if (code === "session_expired") return "Sua sessão expirou. Entre novamente para salvar."
  if (code === "context_changed") return "O restaurante ativo mudou. Atualize esta página antes de salvar."
  if (code === "review_unavailable") return "Não foi possível validar o link do Google agora. Seus dados atuais continuam salvos."
  if (code === "review_invalid") return "O link não corresponde a uma página de avaliações do Google para este restaurante."
  if (code === "invalid_input") return "Revise os campos destacados antes de salvar."
  return "Não foi possível salvar os dados de contato. Tente novamente."
}

export function ContactEditor({ restaurant }: Props) {
  const router = useRouter()
  const reducedMotion = useReducedMotion() === true
  const [profile, setProfile] = useState(() => profileFromPanelRestaurant(restaurant))
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [cepNotice, setCepNotice] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const latestProfile = useRef(profile)
  latestProfile.current = profile
  const lastCep = useRef(profile.contact.address.cep)
  const initialProfile = useRef(JSON.stringify(profile))
  const dirty = JSON.stringify(profile) !== initialProfile.current

  useEffect(() => {
    if (profile.contact.address.cep === lastCep.current) return
    lastCep.current = profile.contact.address.cep
    const digits = profile.contact.address.cep.replace(/\D/g, "")
    if (digits.length !== 8) { setCepNotice(""); return }
    const original = latestProfile.current.contact.address
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setCepNotice("Buscando CEP…")
      try {
        const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal: controller.signal })
        if (!response.ok) throw new Error("unavailable")
        const data: unknown = await response.json()
        if (controller.signal.aborted || !data || typeof data !== "object") return
        const result = data as Record<string, unknown>
        if (result.erro === true || result.erro === "true") { setCepNotice("CEP não encontrado. Confira os números ou preencha o endereço manualmente."); return }
        if (typeof result.localidade !== "string" || !PANEL_UF_CODES.includes(result.uf as typeof PANEL_UF_CODES[number])) throw new Error("unavailable")
        const current = latestProfile.current
        if (current.contact.address.cep.replace(/\D/g, "") !== digits) return
        const nextAddress = { ...current.contact.address }
        for (const [key, source] of [["street", "logradouro"], ["district", "bairro"], ["city", "localidade"], ["state", "uf"]] as const) {
          if (nextAddress[key] === original[key] && typeof result[source] === "string") nextAddress[key] = result[source] as string
        }
        setProfile((currentProfile) => ({ ...currentProfile, contact: { ...currentProfile.contact, address: nextAddress } }))
        setCepNotice(!result.logradouro || !result.bairro ? "Complete a rua e o bairro se não vieram no CEP." : "Endereço encontrado. Confira e informe o número.")
      } catch {
        if (!controller.signal.aborted) setCepNotice("Não foi possível consultar o CEP. Preencha o endereço manualmente.")
      }
    }, 450)
    return () => { clearTimeout(timer); controller.abort() }
  }, [profile.contact.address.cep])

  function updatePublicField(key: "name" | "description", value: string) {
    setProfile((current) => key === "name" ? { ...current, name: value } : { ...current, description: value })
    setFieldErrors((current) => { const next = { ...current }; delete next[key]; return next })
    setMessage("")
    setSaved(false)
  }

  function updateContact<K extends keyof PanelRestaurantDraftProfile["contact"]>(key: K, value: PanelRestaurantDraftProfile["contact"][K]) {
    setProfile((current) => ({ ...current, contact: { ...current.contact, [key]: value } }))
    setFieldErrors((current) => { const next = { ...current }; delete next[`contact.${String(key)}`]; return next })
    setMessage("")
    setSaved(false)
  }

  function updateAddress<K extends keyof PanelRestaurantDraftProfile["contact"]["address"]>(key: K, value: PanelRestaurantDraftProfile["contact"]["address"][K]) {
    setProfile((current) => ({ ...current, contact: { ...current.contact, address: { ...current.contact.address, [key]: value } } }))
    setFieldErrors((current) => { const next = { ...current }; delete next[`contact.address.${String(key)}`]; return next })
    setMessage("")
    setSaved(false)
  }

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

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!dirty || busy) return
    setBusy(true)
    setFieldErrors({})
    setMessage("")
    try {
      const result = await saveActiveRestaurantContactAction({ restaurantId: restaurant.id, expectedRestaurantId: restaurant.id, fields: { name: profile.name, description: profile.description, contact: profile.contact } })
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {})
        setMessage(failureMessage(result.code))
        return
      }
      const savedProfile = { ...profile, ...result.fields }
      setProfile(savedProfile)
      initialProfile.current = JSON.stringify(savedProfile)
      setSaved(true)
      router.refresh()
    } catch {
      setMessage("A conexão falhou. Suas alterações continuam nesta página; tente novamente.")
    } finally {
      setBusy(false)
    }
  }

  const address = formatAddress(profile)
  const variants = { hidden: {}, visible: { transition: { staggerChildren: reducedMotion ? 0 : 0.045 } } }
  const item = { hidden: { opacity: 0, y: reducedMotion ? 0 : 7 }, visible: { opacity: 1, y: 0, transition: { duration: reducedMotion ? 0.12 : 0.2, ease: [0.23, 1, 0.32, 1] as const } } }

  return (
    <MotionConfig reducedMotion="user">
      <form onSubmit={save} className="min-h-svh">
        <div className="mx-auto w-full max-w-[1320px] px-4 py-4 sm:px-6 md:py-3 lg:px-8">
          <div className="mb-5"><p className="text-xs text-muted-foreground">Mantenha atualizados os canais e as informações que seus clientes veem.</p></div>
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
            <motion.div initial={reducedMotion ? false : "hidden"} animate="visible" variants={variants} className="space-y-5">
              <motion.section variants={item} className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><LuStore aria-hidden="true" /></span><div><h2 className="text-sm font-semibold">Apresentação pública</h2><p className="mt-0.5 text-xs text-muted-foreground">Nome e texto de abertura do restaurante.</p></div></div>
                <div className="space-y-4"><IconInput id="active-contact-name" label="Nome do restaurante" icon={<LuStore aria-hidden="true" />} value={profile.name} onChange={(value) => updatePublicField("name", value)} error={fieldErrors.name} maxLength={120} autoComplete="organization" /><IconTextarea id="active-contact-description" label="Descrição" icon={<LuAlignLeft aria-hidden="true" />} value={profile.description} onChange={(value) => updatePublicField("description", value)} error={fieldErrors.description} maxLength={500} placeholder="Conte em poucas palavras o que torna seu restaurante especial." description="Essa descrição aparece na apresentação pública." /></div>
              </motion.section>

              <motion.section variants={item} className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><LuMessageCircle aria-hidden="true" /></span><div><h2 className="text-sm font-semibold">Canais de contato</h2><p className="mt-0.5 text-xs text-muted-foreground">WhatsApp é obrigatório; os demais canais são opcionais.</p></div></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <IconInput id="active-contact-phone" label="Telefone (opcional)" icon={<LuPhone aria-hidden="true" />} value={profile.contact.phone} onChange={(value) => updateContact("phone", maskPhone(value))} error={fieldErrors["contact.phone"]} type="tel" autoComplete="tel" placeholder="(11) 3333-4444" />
                  <IconInput id="active-contact-whatsapp" label="WhatsApp" icon={<LuMessageCircle aria-hidden="true" />} value={profile.contact.whatsapp} onChange={(value) => updateContact("whatsapp", maskPhone(value))} error={fieldErrors["contact.whatsapp"]} type="tel" autoComplete="tel" required placeholder="(11) 99999-9999" />
                  <IconInput id="active-contact-instagram" label="Instagram" icon={<LuAtSign aria-hidden="true" />} value={profile.contact.instagram} onChange={(value) => updateContact("instagram", value.replace(/^@+/, ""))} error={fieldErrors["contact.instagram"]} autoCapitalize="none" placeholder="seu.restaurante" />
                </div>
              </motion.section>

              <motion.section variants={item} className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><LuMapPin aria-hidden="true" /></span><div><h2 className="text-sm font-semibold">Endereço</h2><p className="mt-0.5 text-xs text-muted-foreground">CEP, rua, número, bairro, cidade e estado são obrigatórios.</p></div></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <IconInput id="active-address-cep" label="CEP" icon={<LuMapPin aria-hidden="true" />} value={profile.contact.address.cep} onChange={(value) => updateAddress("cep", maskCep(value))} error={fieldErrors["contact.address.cep"]} inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" description={cepNotice || undefined} />
                  <IconInput id="active-address-street" label="Rua ou avenida" icon={<LuMapPin aria-hidden="true" />} value={profile.contact.address.street} onChange={(value) => updateAddress("street", value)} error={fieldErrors["contact.address.street"]} autoComplete="address-line1" />
                  <IconInput id="active-address-number" label="Número" icon={<LuBuilding2 aria-hidden="true" />} value={profile.contact.address.number} onChange={(value) => updateAddress("number", value)} error={fieldErrors["contact.address.number"]} />
                  <IconInput id="active-address-complement" label="Complemento (opcional)" icon={<LuBuilding2 aria-hidden="true" />} value={profile.contact.address.complement} onChange={(value) => updateAddress("complement", value)} autoComplete="address-line2" />
                  <IconInput id="active-address-district" label="Bairro" icon={<LuMapPin aria-hidden="true" />} value={profile.contact.address.district} onChange={(value) => updateAddress("district", value)} error={fieldErrors["contact.address.district"]} />
                  <IconInput id="active-address-city" label="Cidade" icon={<LuMapPin aria-hidden="true" />} value={profile.contact.address.city} onChange={(value) => updateAddress("city", value)} error={fieldErrors["contact.address.city"]} autoComplete="address-level2" />
                  <IconCombobox id="active-address-state" label="Estado" icon={<LuMapPin aria-hidden="true" />} value={profile.contact.address.state} options={PANEL_UF_CODES.map((value) => ({ value, label: value }))} onChange={(value) => updateAddress("state", value)} placeholder="Selecione o estado" error={fieldErrors["contact.address.state"]} />
                  <div className="sm:col-span-2"><IconInput id="active-contact-maps" label="Perfil no Google Maps (opcional)" icon={<LuMapPin aria-hidden="true" />} value={profile.contact.mapsUrl} onChange={(value) => updateContact("mapsUrl", value)} error={fieldErrors["contact.mapsUrl"]} type="url" placeholder="https://maps.app.goo.gl/..." description="Quando você salvar, vamos conferir o link para habilitar as avaliações do Google." />
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><span aria-hidden="true" className={`size-1.5 rounded-full ${profile.contact.googleReviewUrl ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />{profile.contact.googleReviewUrl ? "Link de avaliações ativo" : "Link de avaliações ainda não configurado"}</div>
                  </div>
                </div>
                {fieldErrors["contact.address"] ? <p role="alert" className="mt-3 text-sm text-destructive">{fieldErrors["contact.address"]}</p> : null}
              </motion.section>

              {message ? <Alert variant="destructive"><LuCircleAlert aria-hidden="true" /><AlertTitle>Não foi possível salvar</AlertTitle><AlertDescription>{message}</AlertDescription></Alert> : null}
              <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/90 p-3 shadow-lg backdrop-blur-xl">
                <p role="status" aria-live="polite" className="flex items-center gap-2 text-xs text-muted-foreground">{saved ? <><LuCheck aria-hidden="true" className="text-primary" />Alterações salvas.</> : dirty ? "Alterações não salvas." : "Tudo atualizado."}</p>
                <Button type="submit" disabled={!dirty || busy} className="ml-auto">{busy ? "Salvando…" : <><LuSave aria-hidden="true" />Salvar contato</>}</Button>
              </div>
            </motion.div>

            <aside className="hidden xl:block xl:sticky xl:top-6">
              <div className="mb-3"><h2 className="text-sm font-semibold">Prévia do perfil público</h2><p className="mt-1 text-xs text-muted-foreground">Veja o que os clientes encontram.</p></div>
              <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><LuStore aria-hidden="true" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold">{profile.name}</p><p className="mt-0.5 text-xs text-muted-foreground">/{restaurant.slug}</p></div></div><p className="mt-4 text-sm leading-6 text-muted-foreground">{profile.description || "A descrição do restaurante aparecerá aqui."}</p><div className="mt-4 flex flex-wrap gap-2">{profile.contact.phone ? <Badge variant="outline"><LuPhone aria-hidden="true" />Telefone</Badge> : null}{profile.contact.whatsapp ? <Badge variant="outline"><LuMessageCircle aria-hidden="true" />WhatsApp</Badge> : null}{profile.contact.instagram ? <Badge variant="outline"><LuAtSign aria-hidden="true" />Instagram</Badge> : null}</div>{address ? <p className="mt-4 flex gap-2 border-t border-border/60 pt-4 text-xs leading-5 text-muted-foreground"><LuMapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{address}</p> : null}</div>
            </aside>
            <Sheet>
              <SheetTrigger render={<Button type="button" variant="outline" className="w-full justify-center xl:hidden"><LuEye aria-hidden="true" />Ver prévia do perfil público</Button>} />
              <SheetContent side="bottom" showCloseButton={false} className="max-h-[88dvh] overflow-y-auto rounded-t-[1.75rem] border-border/70 bg-background/95 px-4 pb-[calc(1rem_+_env(safe-area-inset-bottom))] pt-3 shadow-2xl backdrop-blur-2xl sm:max-w-none">
                <SheetHeader className="relative border-b border-border/60 px-1 pt-2 pb-4">
                  <SheetTitle>Prévia do perfil público</SheetTitle>
                  <SheetDescription>Veja como nome, canais e endereço aparecem para os clientes.</SheetDescription>
                  <SheetClose render={<Button type="button" variant="ghost" size="icon" aria-label="Fechar prévia" className="absolute top-1 right-0 rounded-full text-muted-foreground" />}><LuX aria-hidden="true" className="size-4" /></SheetClose>
                </SheetHeader>
                <div className="mx-auto mt-4 w-full max-w-[520px] rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
                  <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><LuStore aria-hidden="true" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold">{profile.name}</p><p className="mt-0.5 text-xs text-muted-foreground">/{restaurant.slug}</p></div></div>
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">{profile.description || "A descrição do restaurante aparecerá aqui."}</p>
                  <div className="mt-4 flex flex-wrap gap-2">{profile.contact.phone ? <Badge variant="outline"><LuPhone aria-hidden="true" />Telefone</Badge> : null}{profile.contact.whatsapp ? <Badge variant="outline"><LuMessageCircle aria-hidden="true" />WhatsApp</Badge> : null}{profile.contact.instagram ? <Badge variant="outline"><LuAtSign aria-hidden="true" />Instagram</Badge> : null}</div>
                  {address ? <p className="mt-4 flex gap-2 border-t border-border/60 pt-4 text-xs leading-5 text-muted-foreground"><LuMapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{address}</p> : null}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </form>
    </MotionConfig>
  )
}
