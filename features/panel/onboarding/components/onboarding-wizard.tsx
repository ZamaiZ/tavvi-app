"use client"

import Image from "next/image"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from "motion/react"
import { LuArrowLeft, LuArrowRight, LuCheck, LuCircleAlert, LuCircleCheck, LuSave } from "react-icons/lu"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { authItemVariants, authStaggerVariants } from "@/features/admin/auth/components/auth-motion"
import { completePanelRestaurantOnboardingAction, savePanelRestaurantDraftAction } from "@/features/panel/onboarding/actions"
import {
  completePanelRestaurantProfileSchema,
  savePanelRestaurantDraftSchema,
  type PanelOnboardingStep,
  type PanelRestaurantDraftProfile,
} from "@/features/panel/onboarding/schema"
import { panelOnboardingSaveResponseSchema } from "@/features/panel/onboarding/model"
import { panelOnboardingErrorMessage } from "@/features/panel/onboarding/errors"

type FieldErrors = Record<string, string>
type BrandSlot = "logo" | "cover"
type SaveStatus = "saved" | "pending" | "saving" | "error"
type PendingBrandFiles = Record<BrandSlot, File | null>
type BrandUploadState = Record<BrandSlot, boolean>
const emptyBrandFiles: PendingBrandFiles = { logo: null, cover: null }
const emptyUploadState: BrandUploadState = { logo: false, cover: false }

type OnboardingContextValue = {
  restaurant: { id: string; name: string; slug: string }
  profile: PanelRestaurantDraftProfile
  updateProfile: (next: PanelRestaurantDraftProfile) => void
  updateField: <K extends keyof PanelRestaurantDraftProfile>(key: K, value: PanelRestaurantDraftProfile[K]) => void
  updateContact: <K extends keyof PanelRestaurantDraftProfile["contact"]>(key: K, value: PanelRestaurantDraftProfile["contact"][K]) => void
  updateAddress: <K extends keyof PanelRestaurantDraftProfile["contact"]["address"]>(key: K, value: PanelRestaurantDraftProfile["contact"]["address"][K]) => void
  setTheme: (next: PanelRestaurantDraftProfile["theme"]) => void
  imageUrls: Record<BrandSlot, string | null>
  selectImage: (slot: BrandSlot, file: File) => void
  removeImage: (slot: BrandSlot) => void
  pendingFiles: PendingBrandFiles
  uploading: BrandUploadState
  uploadError: Record<BrandSlot, string>
  saveStatus: SaveStatus
  fieldErrors: FieldErrors
  busy: boolean
  currentStep: PanelOnboardingStep
  moveToStep: (step: PanelOnboardingStep) => Promise<void>
  saveNow: () => Promise<void>
  finish: () => Promise<void>
  message: string
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null)

export function useOnboarding() {
  const context = useContext(OnboardingContext)
  if (!context) throw new Error("Onboarding context is unavailable.")
  return context
}

const stepLabels: Record<PanelOnboardingStep, string> = {
  identity: "Identidade",
  contact: "Contato",
}

export function OnboardingWizard({
  restaurant,
  initialProfile,
  initialImageUrls,
  publicBasePath,
  children,
}: {
  restaurant: { id: string; name: string; slug: string }
  initialProfile: PanelRestaurantDraftProfile
  initialImageUrls: Record<BrandSlot, string | null>
  publicBasePath: "" | "/painel"
  children: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const reduceMotion = useReducedMotion()
  const currentStep: PanelOnboardingStep = pathname.endsWith("/contato") ? "contact" : "identity"
  const currentStepRef = useRef(currentStep)
  currentStepRef.current = currentStep
  const [profile, setProfile] = useState(initialProfile)
  const profileRef = useRef(initialProfile)
  const [imageUrls, setImageUrls] = useState(initialImageUrls)
  const [pendingFiles, setPendingFiles] = useState<PendingBrandFiles>(emptyBrandFiles)
  const pendingFilesRef = useRef<PendingBrandFiles>(emptyBrandFiles)
  const objectUrlsRef = useRef<Partial<Record<BrandSlot, string>>>({})
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved")
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [uploading, setUploading] = useState<BrandUploadState>(emptyUploadState)
  const [uploadError, setUploadError] = useState<Record<BrandSlot, string>>({ logo: "", cover: "" })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [retryKind, setRetryKind] = useState<"draft" | "complete">("draft")
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editVersionRef = useRef(0)
  const saveSequenceRef = useRef(0)
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())

  const sendProfileWithFiles = useCallback(async (
    intent: "draft" | "complete",
    snapshot: PanelRestaurantDraftProfile,
    step: PanelOnboardingStep,
    files: PendingBrandFiles,
  ) => {
    if (!files.logo && !files.cover) {
      return intent === "draft"
        ? savePanelRestaurantDraftAction({ restaurantId: restaurant.id, expectedRestaurantId: restaurant.id, step, profile: snapshot })
        : completePanelRestaurantOnboardingAction({ restaurantId: restaurant.id, expectedRestaurantId: restaurant.id, profile: snapshot })
    }

    const formData = new FormData()
    formData.set("intent", intent)
    formData.set("restaurantId", restaurant.id)
    formData.set("expectedRestaurantId", restaurant.id)
    formData.set("profile", JSON.stringify(snapshot))
    if (intent === "draft") formData.set("step", step)
    if (files.logo) formData.set("logo", files.logo, files.logo.name)
    if (files.cover) formData.set("cover", files.cover, files.cover.name)

    setUploading({ logo: Boolean(files.logo), cover: Boolean(files.cover) })
    try {
      const response = await fetch(publicBasePath + "/onboarding/save", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      })
      const payload: unknown = await response.json()
      const parsed = panelOnboardingSaveResponseSchema.safeParse(payload)
      if (!parsed.success) return { ok: false as const, code: "unexpected_response" as const }
      return parsed.data
    } catch {
      return { ok: false as const, code: "network_error" as const }
    } finally {
      setUploading(emptyUploadState)
    }
  }, [publicBasePath, restaurant.id])

  const persist = useCallback(async (
    snapshot: PanelRestaurantDraftProfile,
    step: PanelOnboardingStep,
    version: number,
  ) => {
    const sequence = ++saveSequenceRef.current
    setSaveStatus("saving")
    const operation = saveQueueRef.current.then(async () => {
      const latestSnapshot = version === editVersionRef.current ? snapshot : profileRef.current
      const files = { ...pendingFilesRef.current }
      const parsed = savePanelRestaurantDraftSchema.safeParse({
        restaurantId: restaurant.id,
        expectedRestaurantId: restaurant.id,
        step,
        profile: latestSnapshot,
      })
      if (!parsed.success) return { ok: false as const, code: "invalid_input" as const }
      const result = await sendProfileWithFiles("draft", parsed.data.profile, parsed.data.step, files)
      if (!result.ok) {
        if (result.code === "storage_unavailable" || result.code === "storage_policy_denied") {
          setUploadError((current) => ({
            logo: files.logo ? "Não foi possível salvar esta imagem. Ela continua na prévia. Tente novamente ou remova-a para continuar sem ela." : current.logo,
            cover: files.cover ? "Não foi possível salvar esta imagem. Ela continua na prévia. Tente novamente ou remova-a para continuar sem ela." : current.cover,
          }))
        }
        return result
      }

      let reconciledProfile = profileRef.current
      const nextPending = { ...pendingFilesRef.current }
      let changed = false
      for (const slot of ["logo", "cover"] as const) {
        const uploadedFile = files[slot]
        if (!uploadedFile || pendingFilesRef.current[slot] !== uploadedFile) continue
        const pathKey = slot === "logo" ? "logoPath" : "coverPath"
        reconciledProfile = { ...reconciledProfile, [pathKey]: result.savedPaths[pathKey] }
        setImageUrls((current) => ({ ...current, [slot]: `${publicBasePath}/onboarding/brand?slot=${slot}&restaurant=${restaurant.id}&version=${encodeURIComponent(result.savedPaths[pathKey] ?? "")}` }))
        nextPending[slot] = null
        changed = true
        setUploadError((current) => ({ ...current, [slot]: "" }))
      }
      if (changed) {
        profileRef.current = reconciledProfile
        setProfile(reconciledProfile)
        pendingFilesRef.current = nextPending
        setPendingFiles(nextPending)
      }
      return result
    })
    saveQueueRef.current = operation.then(() => undefined, () => undefined)
    let result: Awaited<typeof operation>
    try {
      result = await operation
    } catch {
      if (version === editVersionRef.current) {
        setSaveStatus("error")
        setRetryKind("draft")
        setMessage(panelOnboardingErrorMessage("network_error"))
      }
      return false
    }
    if (version !== editVersionRef.current || sequence !== saveSequenceRef.current) return result.ok
    setSaveStatus(result.ok ? "saved" : "error")
    if (!result.ok) {
      setRetryKind("draft")
      setMessage(panelOnboardingErrorMessage(result.code))
      return false
    }
    setMessage("")
    return true
  }, [publicBasePath, restaurant.id, sendProfileWithFiles])

  const scheduleSave = useCallback((snapshot: PanelRestaurantDraftProfile, step: PanelOnboardingStep) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setSaveStatus("pending")
    const version = editVersionRef.current
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      void persist(snapshot, step, version)
    }, 2500)
  }, [persist])

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    for (const url of Object.values(objectUrlsRef.current)) {
      if (url) URL.revokeObjectURL(url)
    }
  }, [])

  const updateProfile = useCallback((next: PanelRestaurantDraftProfile) => {
    profileRef.current = next
    setProfile(next)
    editVersionRef.current += 1
    setFieldErrors({})
    setMessage("")
    scheduleSave(next, currentStepRef.current)
  }, [scheduleSave])

  const updateField = useCallback(<K extends keyof PanelRestaurantDraftProfile>(key: K, value: PanelRestaurantDraftProfile[K]) => {
    updateProfile({ ...profileRef.current, [key]: value })
  }, [updateProfile])

  const updateContact = useCallback(<K extends keyof PanelRestaurantDraftProfile["contact"]>(key: K, value: PanelRestaurantDraftProfile["contact"][K]) => {
    updateProfile({ ...profileRef.current, contact: { ...profileRef.current.contact, [key]: value, ...(key === "mapsUrl" && value !== profileRef.current.contact.mapsUrl ? { googleReviewUrl: "" } : {}) } })
  }, [updateProfile])

  const updateAddress = useCallback(<K extends keyof PanelRestaurantDraftProfile["contact"]["address"]>(key: K, value: PanelRestaurantDraftProfile["contact"]["address"][K]) => {
    updateProfile({
      ...profileRef.current,
      contact: {
        ...profileRef.current.contact,
        address: { ...profileRef.current.contact.address, [key]: value },
      },
    })
  }, [updateProfile])

  const setTheme = useCallback((next: PanelRestaurantDraftProfile["theme"]) => {
    updateField("theme", next)
  }, [updateField])

  const selectImage = useCallback((slot: BrandSlot, file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setUploadError((current) => ({ ...current, [slot]: "Use uma imagem JPG, PNG ou WebP." }))
      return
    }
    if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
      setUploadError((current) => ({ ...current, [slot]: "A imagem deve ter até 5 MB." }))
      return
    }

    const previousUrl = objectUrlsRef.current[slot]
    if (previousUrl) URL.revokeObjectURL(previousUrl)
    const previewUrl = URL.createObjectURL(file)
    objectUrlsRef.current[slot] = previewUrl
    setImageUrls((current) => ({ ...current, [slot]: previewUrl }))
    const nextFiles = { ...pendingFilesRef.current, [slot]: file }
    pendingFilesRef.current = nextFiles
    setPendingFiles(nextFiles)
    setUploadError((current) => ({ ...current, [slot]: "" }))
    editVersionRef.current += 1
    setSaveStatus("pending")
    setMessage("")
    scheduleSave(profileRef.current, currentStepRef.current)
  }, [scheduleSave])

  const removeImage = useCallback((slot: BrandSlot) => {
    const objectUrl = objectUrlsRef.current[slot]
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    delete objectUrlsRef.current[slot]
    setImageUrls((current) => ({ ...current, [slot]: null }))
    const nextFiles = { ...pendingFilesRef.current, [slot]: null }
    pendingFilesRef.current = nextFiles
    setPendingFiles(nextFiles)
    setUploadError((current) => ({ ...current, [slot]: "" }))
    updateField(slot === "logo" ? "logoPath" : "coverPath", null)
  }, [updateField])

  const moveToStep = useCallback(async (step: PanelOnboardingStep) => {
    if (step === currentStepRef.current || busy) return
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setBusy(true)
    setMessage("")
    const version = editVersionRef.current
    const saved = await persist(profileRef.current, step, version)
    setBusy(false)
    if (!saved) return
    router.push(publicBasePath + (step === "identity" ? "/identidade" : "/contato"))
  }, [busy, persist, publicBasePath, router])

  const saveNow = useCallback(async () => {
    if (busy) return
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    await persist(profileRef.current, currentStepRef.current, editVersionRef.current)
  }, [busy, persist])

  const finish = useCallback(async () => {
    if (busy) return
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setBusy(true)
    setMessage("")
    setSaveStatus("saving")
    try {
      await saveQueueRef.current
      const saved = await persist(profileRef.current, currentStepRef.current, editVersionRef.current)
      if (!saved) { setBusy(false); return }
      const parsed = completePanelRestaurantProfileSchema.safeParse(profileRef.current)
      if (!parsed.success) {
        const errors: FieldErrors = {}
        for (const issue of parsed.error.issues) {
          const path = issue.path.map(String).join(".")
          errors[path] ??= issue.message
        }
        setFieldErrors(errors)
        setMessage("Revise os campos destacados para ativar seu restaurante.")
        setSaveStatus("saved")
        setBusy(false)
        return
      }
      const files = { ...pendingFilesRef.current }
      const result = files.logo || files.cover
        ? await sendProfileWithFiles("complete", parsed.data, currentStepRef.current, files)
        : await completePanelRestaurantOnboardingAction({
            restaurantId: restaurant.id,
            expectedRestaurantId: restaurant.id,
            profile: parsed.data,
          })
      if (!result.ok) {
        if (result.code === "review_unavailable" || result.code === "review_invalid") {
          setFieldErrors({ "contact.mapsUrl": panelOnboardingErrorMessage(result.code) })
          setMessage(panelOnboardingErrorMessage(result.code))
          setSaveStatus("saved")
          setBusy(false)
          return
        }
        setSaveStatus("error")
        setRetryKind("complete")
        if (result.code === "storage_unavailable" || result.code === "storage_policy_denied") {
          setUploadError((current) => ({
            logo: files.logo ? "Não foi possível salvar esta imagem. Ela continua na prévia. Tente novamente ou remova-a para continuar sem ela." : current.logo,
            cover: files.cover ? "Não foi possível salvar esta imagem. Ela continua na prévia. Tente novamente ou remova-a para continuar sem ela." : current.cover,
          }))
        }
        setMessage(panelOnboardingErrorMessage(result.code))
        setBusy(false)
        return
      }
      let updatedProfile = profileRef.current
      const nextFiles = { ...pendingFilesRef.current }
      let changed = false
      for (const slot of ["logo", "cover"] as const) {
        if (!files[slot] || pendingFilesRef.current[slot] !== files[slot]) continue
        const pathKey = slot === "logo" ? "logoPath" : "coverPath"
        updatedProfile = { ...updatedProfile, [pathKey]: result.savedPaths[pathKey] }
        nextFiles[slot] = null
        changed = true
      }
      if (changed) {
        profileRef.current = updatedProfile
        setProfile(updatedProfile)
        pendingFilesRef.current = nextFiles
        setPendingFiles(nextFiles)
      }
      setSaveStatus("saved")
      router.replace(publicBasePath + "/cardapio")
    } catch {
      setSaveStatus("error")
      setRetryKind("complete")
      setMessage(panelOnboardingErrorMessage("network_error"))
      setBusy(false)
    }
  }, [busy, persist, publicBasePath, restaurant.id, router, sendProfileWithFiles])

  const contextValue = useMemo<OnboardingContextValue>(() => ({
    restaurant,
    profile,
    updateProfile,
    updateField,
    updateContact,
    updateAddress,
    setTheme,
    imageUrls,
    selectImage,
    removeImage,
    pendingFiles,
    uploading,
    uploadError,
    saveStatus,
    fieldErrors,
    busy,
    currentStep,
    moveToStep,
    saveNow,
    finish,
    message,
  }), [restaurant, profile, updateProfile, updateField, updateContact, updateAddress, setTheme, imageUrls, selectImage, removeImage, pendingFiles, uploading, uploadError, saveStatus, fieldErrors, busy, currentStep, moveToStep, saveNow, finish, message])

  const steps: PanelOnboardingStep[] = ["identity", "contact"]
  const currentIndex = steps.indexOf(currentStep)
  const isUploading = uploading.logo || uploading.cover
  const statusText = saveStatus === "saved" ? "Rascunho salvo" : saveStatus === "pending" ? "Salvando em instantes…" : saveStatus === "saving" ? "Salvando…" : "Falha ao salvar"

  return (
    <OnboardingContext.Provider value={contextValue}>
      <MotionConfig reducedMotion="user">
        <motion.main initial="hidden" animate="visible" variants={authStaggerVariants} className="min-h-svh bg-muted/30 px-4 py-6 sm:px-6 sm:py-9">
          <motion.div variants={authStaggerVariants} className="mx-auto w-full max-w-5xl">
            <motion.header variants={authItemVariants} className="mb-7 flex items-center justify-between gap-4">
              <Image src="/brand/tavvi-lockup-horizontal-light.png" alt="Tavvi" width={240} height={94} priority className="h-auto w-28 object-contain dark:hidden sm:w-32" />
              <Image src="/brand/tavvi-lockup-horizontal-dark.png" alt="Tavvi" width={240} height={94} priority className="hidden h-auto w-28 object-contain dark:block sm:w-32" />
              <motion.div variants={authItemVariants} className="flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <LuSave aria-hidden="true" className="size-3.5" />
                <span role="status" aria-live="polite">{statusText}</span>
              </motion.div>
            </motion.header>

            <motion.section variants={authItemVariants} className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm sm:rounded-3xl">
              <div className="border-b border-border/60 bg-gradient-to-br from-primary/[0.07] via-card to-card px-5 py-6 sm:px-8 sm:py-8">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Configuração inicial</p>
                    <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Vamos preparar seu restaurante</h1>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">Essas informações serão usadas para apresentar seu cardápio digital.</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-background/80 px-3.5 py-2.5 sm:max-w-64">
                    <p className="truncate text-sm font-semibold">{profile.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">/{restaurant.slug}</p>
                  </div>
                </div>

                <motion.nav variants={authItemVariants} aria-label="Etapas de configuração" className="mt-7">
                  <ol className="grid grid-cols-2 gap-3">
                    {steps.map((step, index) => {
                      const complete = index < currentIndex
                      const active = step === currentStep
                      return (
                        <li key={step}>
                          <button type="button" onClick={() => void moveToStep(step)} disabled={busy || isUploading} aria-current={active ? "step" : undefined} className="group w-full text-left disabled:cursor-wait">
                            <span className={`flex items-center gap-2.5 border-b-2 pb-3 transition-colors ${active ? "border-primary text-foreground" : complete ? "border-primary/50 text-foreground" : "border-border text-muted-foreground"}`}>
                              <motion.span layout className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${active ? "bg-primary text-primary-foreground" : complete ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                                {complete ? <LuCheck aria-hidden="true" className="size-4" /> : index + 1}
                              </motion.span>
                              <span className="text-sm font-medium">{stepLabels[step]}</span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ol>
                </motion.nav>
              </div>

              <div className="px-5 py-6 sm:px-8 sm:py-8">
                <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                    key={currentStep}
                        variants={authStaggerVariants}
                    initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                    transition={{ duration: reduceMotion ? 0 : 0.22, ease: "easeOut" }}
                  >
                    <fieldset disabled={busy || isUploading} className="m-0 min-w-0 border-0 p-0">
                      {children}
                    </fieldset>
                  </motion.div>
                </AnimatePresence>

                <AnimatePresence initial={false}>
                  {message ? (
                    <motion.div initial={reduceMotion ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5">
                      <Alert variant={saveStatus === "error" ? "destructive" : "default"}>
                        {saveStatus === "error" ? <LuCircleAlert aria-hidden="true" /> : <LuCircleCheck aria-hidden="true" />}
                        <AlertTitle>{saveStatus === "error" ? "Não foi possível salvar" : "Não foi possível continuar"}</AlertTitle>
                        <AlertDescription className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <span>{message}</span>
                          {saveStatus === "error" ? <Button type="button" size="sm" variant="outline" disabled={busy || isUploading} onClick={() => void (retryKind === "complete" ? finish() : saveNow())}>Tentar novamente</Button> : null}
                        </AlertDescription>
                      </Alert>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <motion.footer variants={authItemVariants} className="mt-7 flex flex-col-reverse gap-3 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">Você pode continuar depois. As mudanças são salvas automaticamente.</p>
                  {currentStep === "identity" ? (
                    <Button type="button" disabled={busy || isUploading} onClick={() => void moveToStep("contact")} className="w-full sm:w-auto">
                      {busy ? <><Spinner aria-hidden="true" />Salvando…</> : <>Continuar para contato<LuArrowRight data-icon="inline-end" aria-hidden="true" /></>}
                    </Button>
                  ) : (
                    <div className="flex w-full items-center justify-between gap-3 sm:w-auto">
                      <Button type="button" variant="ghost" disabled={busy || isUploading} onClick={() => void moveToStep("identity")}>
                        <LuArrowLeft data-icon="inline-start" aria-hidden="true" />Voltar
                      </Button>
                      <Button type="button" disabled={busy || isUploading} onClick={() => void finish()} className="min-w-36">
                        {busy ? <><Spinner aria-hidden="true" />Ativando…</> : <>Finalizar<LuCheck data-icon="inline-end" aria-hidden="true" /></>}
                      </Button>
                    </div>
                  )}
                </motion.footer>
              </div>
            </motion.section>
            <motion.p variants={authItemVariants} className="mt-4 text-center text-xs text-muted-foreground">Seu rascunho fica salvo para você retomar depois.</motion.p>
          </motion.div>
        </motion.main>
      </MotionConfig>
    </OnboardingContext.Provider>
  )
}
