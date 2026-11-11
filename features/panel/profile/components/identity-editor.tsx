"use client"

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react"
import { MotionConfig, motion, useReducedMotion } from "motion/react"
import { useRouter } from "next/navigation"
import { LuCheck, LuEye, LuImage, LuLayoutGrid, LuPalette, LuSave, LuStore, LuUtensils, LuX } from "react-icons/lu"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { IconCombobox, IconInput } from "@/features/panel/onboarding/components/icon-input"
import { BrandImageDropzone } from "@/features/panel/onboarding/components/brand-image-dropzone"
import { PANEL_SEGMENTS, PANEL_THEME_PRESETS, suggestPanelTheme } from "@/features/panel/onboarding/identity-options"
import type { PanelRestaurantDTO } from "@/features/panel/onboarding/model"
import { profileFromPanelRestaurant } from "@/features/panel/onboarding/profile"
import { activeIdentitySchema, type ActiveIdentity } from "@/features/panel/profile/schema"
import { restaurantInitials } from "@/features/panel/shell/lib/restaurant-initials"

type Props = { restaurant: PanelRestaurantDTO; publicBasePath: "" | "/painel" }
type BrandSlot = "logo" | "cover"
type ImageUrls = Record<BrandSlot, string | null>
type PendingFiles = Record<BrandSlot, File | null>

function initialIdentity(restaurant: PanelRestaurantDTO): ActiveIdentity {
  const profile = profileFromPanelRestaurant(restaurant)
  return { segment: profile.segment, theme: profile.theme, menuPresentation: profile.menuPresentation, logoPath: profile.logoPath, coverPath: profile.coverPath }
}

function savedImageUrl(slug: string, slot: BrandSlot, path: string | null) {
  return path ? `/${slug}/media/${slot}?version=${encodeURIComponent(path)}` : null
}

function Preview({ restaurant, identity, imageUrls }: { restaurant: PanelRestaurantDTO; identity: ActiveIdentity; imageUrls: ImageUrls }) {
  const preset = PANEL_THEME_PRESETS[identity.theme.preset]
  const initial = restaurantInitials(restaurant.name)
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm" style={{ "--preview-base": identity.theme.base ?? preset.base, "--preview-accent": identity.theme.accent ?? preset.accent } as CSSProperties}>
      <div className="relative h-28 overflow-hidden bg-[radial-gradient(ellipse_at_75%_15%,color-mix(in_srgb,var(--preview-accent)_40%,transparent),transparent_38%),linear-gradient(145deg,var(--preview-accent),var(--preview-base))]">
        {imageUrls.cover ? <img src={imageUrls.cover} alt="" className="size-full object-cover" /> : null}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--preview-base)] to-transparent" />
      </div>
      <div className="relative -mt-8 px-4 pb-4">
        <span className="grid size-14 place-items-center overflow-hidden rounded-2xl border-4 border-card bg-[var(--preview-base)] text-xl font-semibold text-[var(--preview-accent)]">
          {imageUrls.logo ? <img src={imageUrls.logo} alt="" className="size-full object-contain p-1" /> : initial}
        </span>
        <p className="mt-3 text-[0.6rem] font-semibold tracking-[0.15em] text-[var(--preview-accent)] uppercase">{identity.segment || "Seu segmento"}</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">{restaurant.name}</h2>
        <div className="mt-4 rounded-xl border border-border/70 bg-background/75 p-3">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold">Apresentação</span><span className="rounded-full bg-[var(--preview-accent)]/10 px-2 py-1 text-[0.6rem] font-semibold text-[var(--preview-accent)]">{identity.menuPresentation === "immersive" ? "Imersivo" : "Padrão"}</span></div>
          <div className="mt-3 grid grid-cols-3 gap-2" aria-hidden="true"><span className="h-14 rounded-lg bg-[var(--preview-accent)]/15" /><span className="h-14 rounded-lg bg-muted" /><span className="h-14 rounded-lg bg-muted" /></div>
        </div>
      </div>
    </div>
  )
}

function failureMessage(code: string) {
  if (code === "session_expired") return "Sua sessão expirou. Entre novamente para salvar."
  if (code === "context_changed") return "O restaurante ativo mudou. Atualize esta página antes de salvar."
  if (code === "storage_policy_denied") return "Você não tem acesso para enviar imagens a este restaurante."
  if (code === "invalid_input") return "Revise os campos e os arquivos selecionados."
  return "Não foi possível salvar a identidade. Tente novamente."
}

export function IdentityEditor({ restaurant, publicBasePath }: Props) {
  const router = useRouter()
  const reducedMotion = useReducedMotion() === true
  const initial = initialIdentity(restaurant)
  const [identity, setIdentity] = useState<ActiveIdentity>(initial)
  const [baseline, setBaseline] = useState<ActiveIdentity>(initial)
  const [files, setFiles] = useState<PendingFiles>({ logo: null, cover: null })
  const [imageUrls, setImageUrls] = useState<ImageUrls>({ logo: savedImageUrl(restaurant.slug, "logo", initial.logoPath), cover: savedImageUrl(restaurant.slug, "cover", initial.coverPath) })
  const [imageErrors, setImageErrors] = useState<Record<BrandSlot, string>>({ logo: "", cover: "" })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [saved, setSaved] = useState(false)
  const objectUrls = useRef<Record<BrandSlot, string | null>>({ logo: null, cover: null })
  const dirty = JSON.stringify(identity) !== JSON.stringify(baseline) || Boolean(files.logo || files.cover)

  useEffect(() => () => {
    for (const url of Object.values(objectUrls.current)) if (url) URL.revokeObjectURL(url)
  }, [])

  function selectImage(slot: BrandSlot, file: File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setImageErrors((current) => ({ ...current, [slot]: "Use uma imagem JPG, PNG ou WebP." })); return }
    if (file.size <= 0 || file.size > 5 * 1024 * 1024) { setImageErrors((current) => ({ ...current, [slot]: "A imagem deve ter até 5 MB." })); return }
    const previousUrl = objectUrls.current[slot]
    if (previousUrl) URL.revokeObjectURL(previousUrl)
    const url = URL.createObjectURL(file)
    objectUrls.current[slot] = url
    setFiles((current) => ({ ...current, [slot]: file }))
    setImageUrls((current) => ({ ...current, [slot]: url }))
    setImageErrors((current) => ({ ...current, [slot]: "" }))
    setSaved(false)
    setMessage("")
  }

  function removeImage(slot: BrandSlot) {
    const objectUrl = objectUrls.current[slot]
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    objectUrls.current[slot] = null
    setFiles((current) => ({ ...current, [slot]: null }))
    setImageUrls((current) => ({ ...current, [slot]: null }))
    setIdentity((current) => ({ ...current, [slot === "logo" ? "logoPath" : "coverPath"]: null }))
    setImageErrors((current) => ({ ...current, [slot]: "" }))
    setSaved(false)
  }

  function discardChanges() {
    for (const slot of ["logo", "cover"] as const) {
      const objectUrl = objectUrls.current[slot]
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      objectUrls.current[slot] = null
    }
    setIdentity(baseline)
    setFiles({ logo: null, cover: null })
    setImageUrls({ logo: savedImageUrl(restaurant.slug, "logo", baseline.logoPath), cover: savedImageUrl(restaurant.slug, "cover", baseline.coverPath) })
    setImageErrors({ logo: "", cover: "" })
    setMessage("")
    setSaved(false)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!dirty || busy || imageErrors.logo || imageErrors.cover) return
    const parsed = activeIdentitySchema.safeParse(identity)
    if (!parsed.success) { setMessage("Revise os campos da identidade antes de salvar."); return }
    setBusy(true)
    setMessage("")
    try {
      const data = new FormData()
      data.set("restaurantId", restaurant.id)
      data.set("expectedRestaurantId", restaurant.id)
      data.set("identity", JSON.stringify(parsed.data))
      if (files.logo) data.set("logo", files.logo)
      if (files.cover) data.set("cover", files.cover)
      const response = await fetch(`${publicBasePath}/profile/identity`, { method: "POST", body: data, cache: "no-store" })
      const result: unknown = await response.json()
      if (!response.ok || !result || typeof result !== "object" || (result as Record<string, unknown>).ok !== true) {
        const code = result && typeof result === "object" ? String((result as Record<string, unknown>).code ?? "unavailable") : "unavailable"
        setMessage(failureMessage(code))
        return
      }
      const resultData = result as Record<string, unknown>
      const nextIdentity = activeIdentitySchema.safeParse(resultData.identity)
      if (!nextIdentity.success) { setMessage("A identidade foi salva. Atualize a página para sincronizar a prévia."); router.refresh(); return }
      for (const slot of ["logo", "cover"] as const) {
        const objectUrl = objectUrls.current[slot]
        if (objectUrl) URL.revokeObjectURL(objectUrl)
        objectUrls.current[slot] = null
      }
      setIdentity(nextIdentity.data)
      setBaseline(nextIdentity.data)
      setFiles({ logo: null, cover: null })
      setImageUrls({ logo: savedImageUrl(restaurant.slug, "logo", nextIdentity.data.logoPath), cover: savedImageUrl(restaurant.slug, "cover", nextIdentity.data.coverPath) })
      setSaved(true)
      router.refresh()
    } catch {
      setMessage("A conexão falhou. Suas alterações continuam nesta página; tente novamente.")
    } finally {
      setBusy(false)
    }
  }

  const theme = identity.theme
  const activePreset = PANEL_THEME_PRESETS[theme.preset]
  const motionVariants = { hidden: {}, visible: { transition: { staggerChildren: reducedMotion ? 0 : 0.045 } } }
  const itemVariants = { hidden: { opacity: 0, y: reducedMotion ? 0 : 7 }, visible: { opacity: 1, y: 0, transition: { duration: reducedMotion ? 0.12 : 0.2, ease: [0.23, 1, 0.32, 1] as const } } }

  return (
    <MotionConfig reducedMotion="user">
      <form onSubmit={save} className="min-h-svh">
        <div className="mx-auto w-full max-w-[1320px] px-4 py-4 sm:px-6 md:py-3 lg:px-8">
          <div className="mb-6"><p className="text-xs text-muted-foreground">Ajuste como o restaurante aparece no cardápio público.</p></div>
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
            <motion.div initial={reducedMotion ? false : "hidden"} animate="visible" variants={motionVariants} className="space-y-5">
              <motion.section variants={itemVariants} className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><LuStore aria-hidden="true" /></span><div><h2 className="text-sm font-semibold">Identidade visual</h2><p className="mt-0.5 text-xs text-muted-foreground">Segmento, cores e presença de marca.</p></div></div>
                <IconCombobox id="active-restaurant-segment" label="Segmento" icon={<LuUtensils aria-hidden="true" />} value={identity.segment ?? ""} options={PANEL_SEGMENTS.map((value) => ({ value, label: value }))} onChange={(value) => {
                  const segment = value || null
                  const suggested = suggestPanelTheme(segment)
                  setIdentity((current) => ({ ...current, segment, ...(suggested ? { theme: { ...current.theme, preset: suggested, base: null, accent: null } } : {}) }))
                  setSaved(false)
                }} placeholder="Busque um segmento" />
                <div className="mt-5"><p className="mb-2 text-sm font-medium">Tema</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {Object.entries(PANEL_THEME_PRESETS).map(([id, preset]) => <button key={id} type="button" aria-pressed={theme.preset === id} onClick={() => { setIdentity((current) => ({ ...current, theme: { ...current.theme, preset: id as typeof theme.preset, base: null, accent: null } })); setSaved(false) }} className={`rounded-xl border p-2.5 text-left transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring ${theme.preset === id ? "border-primary ring-2 ring-primary/15" : "border-border/70 hover:border-primary/40"}`}>
                    <span className="mb-2 flex h-7 overflow-hidden rounded-md border border-black/5"><span className="flex-1" style={{ backgroundColor: preset.base }} /><span className="w-1/3" style={{ backgroundColor: preset.accent }} /></span><span className="text-xs font-medium">{preset.label}</span>
                  </button>)}
                </div></div>
                <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Densidade da página"><Button type="button" size="sm" variant={theme.density === "confortavel" ? "secondary" : "outline"} aria-pressed={theme.density === "confortavel"} onClick={() => { setIdentity((current) => ({ ...current, theme: { ...current.theme, density: "confortavel" } })); setSaved(false) }}>Espaçada</Button><Button type="button" size="sm" variant={theme.density === "compacto" ? "secondary" : "outline"} aria-pressed={theme.density === "compacto"} onClick={() => { setIdentity((current) => ({ ...current, theme: { ...current.theme, density: "compacto" } })); setSaved(false) }}>Compacta</Button></div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2"><IconInput id="active-theme-base" label="Cor de fundo" icon={<LuPalette aria-hidden="true" />} type="color" value={theme.base ?? activePreset.base} onChange={(value) => { setIdentity((current) => ({ ...current, theme: { ...current.theme, base: value } })); setSaved(false) }} /><IconInput id="active-theme-accent" label="Cor de destaque" icon={<LuPalette aria-hidden="true" />} type="color" value={theme.accent ?? activePreset.accent} onChange={(value) => { setIdentity((current) => ({ ...current, theme: { ...current.theme, accent: value } })); setSaved(false) }} /></div>
              </motion.section>

              <motion.section variants={itemVariants} className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><LuImage aria-hidden="true" /></span><div><h2 className="text-sm font-semibold">Imagens da marca</h2><p className="mt-0.5 text-xs text-muted-foreground">Use imagens claras e nítidas em qualquer tela.</p></div></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <BrandImageDropzone id="active-logo" title="Logo" description="Identifica seu restaurante na página pública." previewUrl={imageUrls.logo} pendingFile={files.logo} saved={Boolean(identity.logoPath) && !files.logo} saving={busy && Boolean(files.logo)} error={imageErrors.logo} onSelect={(file) => selectImage("logo", file)} onRemove={() => removeImage("logo")} />
                  <BrandImageDropzone id="active-cover" title="Capa" description="A imagem de abertura da sua apresentação." previewUrl={imageUrls.cover} pendingFile={files.cover} saved={Boolean(identity.coverPath) && !files.cover} saving={busy && Boolean(files.cover)} error={imageErrors.cover} onSelect={(file) => selectImage("cover", file)} onRemove={() => removeImage("cover")} />
                </div>
              </motion.section>

              <motion.section variants={itemVariants} className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><LuLayoutGrid aria-hidden="true" /></span><div><h2 className="text-sm font-semibold">Apresentação do cardápio</h2><p className="mt-0.5 text-xs text-muted-foreground">Escolha como seus clientes vão explorar os pratos.</p></div></div>
                <div className="grid gap-3 sm:grid-cols-2">{([
                  { value: "immersive", label: "Imersivo", copy: "Um prato por tela, com a imagem em primeiro plano.", icon: <LuImage aria-hidden="true" /> },
                  { value: "standard", label: "Padrão", copy: "Categorias em sequência e pratos em cartões deslizantes.", icon: <LuLayoutGrid aria-hidden="true" /> },
                ] as const).map((option) => <button key={option.value} type="button" aria-pressed={identity.menuPresentation === option.value} onClick={() => { setIdentity((current) => ({ ...current, menuPresentation: option.value })); setSaved(false) }} className={`flex min-h-24 items-start gap-3 rounded-xl border p-4 text-left transition-[border-color,background-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring ${identity.menuPresentation === option.value ? "border-primary bg-primary/[0.045] ring-2 ring-primary/15" : "border-border/70 hover:border-primary/40"}`}><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${identity.menuPresentation === option.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{option.icon}</span><span><span className="block text-sm font-semibold">{option.label}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.copy}</span></span></button>)}</div>
              </motion.section>

              {message ? <Alert variant="destructive"><AlertTitle>Não foi possível salvar</AlertTitle><AlertDescription>{message}</AlertDescription></Alert> : null}
              <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/90 p-3 shadow-lg backdrop-blur-xl">
                <p role="status" aria-live="polite" className="flex items-center gap-2 text-xs text-muted-foreground">{saved ? <><LuCheck aria-hidden="true" className="text-primary" />Alterações salvas.</> : dirty ? "Alterações não salvas." : "Tudo atualizado."}</p>
                <div className="ml-auto flex gap-2"><Button type="button" variant="ghost" disabled={!dirty || busy} onClick={discardChanges}>Descartar</Button><Button type="submit" disabled={!dirty || busy || Boolean(imageErrors.logo || imageErrors.cover)}>{busy ? "Salvando…" : <><LuSave aria-hidden="true" />Salvar identidade</>}</Button></div>
              </div>
            </motion.div>
            <aside className="hidden xl:block xl:sticky xl:top-6"><div className="mb-3"><h2 className="text-sm font-semibold">Prévia da página</h2><p className="mt-1 text-xs text-muted-foreground">A prévia acompanha as alterações desta tela.</p></div><Preview restaurant={restaurant} identity={identity} imageUrls={imageUrls} /></aside>
            <Sheet>
              <SheetTrigger render={<Button type="button" variant="outline" className="w-full justify-center xl:hidden"><LuEye aria-hidden="true" />Ver prévia da página</Button>} />
              <SheetContent side="bottom" showCloseButton={false} className="max-h-[88dvh] overflow-y-auto rounded-t-[1.75rem] border-border/70 bg-background/95 px-4 pb-[calc(1rem_+_env(safe-area-inset-bottom))] pt-3 shadow-2xl backdrop-blur-2xl sm:max-w-none">
                <SheetHeader className="relative border-b border-border/60 px-1 pt-2 pb-4">
                  <SheetTitle>Prévia da página</SheetTitle>
                  <SheetDescription>A prévia acompanha as alterações desta tela.</SheetDescription>
                  <SheetClose render={<Button type="button" variant="ghost" size="icon" aria-label="Fechar prévia" className="absolute top-1 right-0 rounded-full text-muted-foreground" />}><LuX aria-hidden="true" className="size-4" /></SheetClose>
                </SheetHeader>
                <div className="mx-auto mt-4 w-full max-w-[420px]"><Preview restaurant={restaurant} identity={identity} imageUrls={imageUrls} /></div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </form>
    </MotionConfig>
  )
}
