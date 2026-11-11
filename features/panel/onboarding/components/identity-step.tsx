"use client"

import { motion } from "motion/react"
import { LuArrowUpRight, LuImage, LuLayoutGrid, LuPalette, LuStore, LuUtensils } from "react-icons/lu"
import { Button } from "@/components/ui/button"
import { IconCombobox, IconInput } from "./icon-input"
import { BrandImageDropzone } from "./brand-image-dropzone"
import { PANEL_SEGMENTS, PANEL_THEME_PRESETS, suggestPanelTheme } from "../identity-options"
import { useOnboarding } from "./onboarding-wizard"
import { authItemVariants, authStaggerVariants } from "@/features/admin/auth/components/auth-motion"

export function IdentityStep() {
  const {
    restaurant,
    profile,
    updateField,
    setTheme,
    imageUrls,
    pendingFiles,
    selectImage,
    removeImage,
    uploading,
    uploadError,
  } = useOnboarding()
  const theme = profile.theme

  return (
    <motion.div variants={authStaggerVariants} initial="hidden" animate="visible" className="space-y-8">
      <motion.header variants={authItemVariants}>
        <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><LuStore aria-hidden="true" /></div>
        <h2 className="text-xl font-semibold tracking-tight">Identidade do restaurante</h2>
        <p className="mt-1 text-sm text-muted-foreground">Defina como o restaurante será apresentado no cardápio digital.</p>
      </motion.header>

      <motion.div variants={authItemVariants} className="rounded-xl border border-border/70 bg-muted/15 p-4">
        <p className="text-sm font-semibold">{profile.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Endereço público: /{restaurant.slug} · O nome e a apresentação ficam em Contato.</p>
      </motion.div>

      <motion.div variants={authItemVariants}>
        <IconCombobox id="restaurant-segment" label="Segmento (opcional)" icon={<LuUtensils aria-hidden="true" />} value={profile.segment ?? ""} options={PANEL_SEGMENTS.map((value) => ({ value, label: value }))} onChange={(value) => {
          updateField("segment", value || null)
          const suggested = suggestPanelTheme(value || null)
          if (suggested) setTheme({ ...theme, preset: suggested })
        }} placeholder="Busque um segmento" />
      </motion.div>

      <motion.section variants={authItemVariants}>
        <div className="mb-3 flex items-center gap-2"><LuPalette className="size-4 text-primary" aria-hidden="true" /><h3 className="text-sm font-semibold">Identidade visual</h3></div>
        <motion.div variants={authStaggerVariants} initial="hidden" animate="visible" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(PANEL_THEME_PRESETS).map(([id, preset]) => (
            <motion.button key={id} variants={authItemVariants} type="button" aria-pressed={theme.preset === id} onClick={() => setTheme({ ...theme, preset: id as typeof theme.preset, base: null, accent: null })} className={`group rounded-xl border p-3 text-left transition-[border-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-sm ${theme.preset === id ? "border-primary ring-2 ring-primary/15" : "border-border/70 hover:border-primary/40"}`}>
              <span className="mb-2 flex h-9 overflow-hidden rounded-lg border border-black/5"><span className="flex-1" style={{ backgroundColor: preset.base }} /><span className="w-1/3" style={{ backgroundColor: preset.accent }} /></span>
              <span className="text-xs font-medium">{preset.label}</span>
            </motion.button>
          ))}
        </motion.div>
        <motion.div variants={authStaggerVariants} className="mt-4 space-y-4">
          <motion.div variants={authItemVariants} className="flex flex-wrap gap-2">
            {(["confortavel", "compacto"] as const).map((density) => <Button key={density} type="button" size="sm" variant={theme.density === density ? "secondary" : "outline"} onClick={() => setTheme({ ...theme, density })}>{density === "confortavel" ? "Espaçado" : "Compacto"}</Button>)}
          </motion.div>
          <motion.div variants={authStaggerVariants} className="grid gap-5 sm:grid-cols-2">
            <motion.div variants={authItemVariants}><IconInput id="theme-base" label="Cor de fundo" icon={<LuPalette aria-hidden="true" />} type="color" value={theme.base ?? PANEL_THEME_PRESETS[theme.preset].base} onChange={(value) => setTheme({ ...theme, base: value })} /></motion.div>
            <motion.div variants={authItemVariants}><IconInput id="theme-accent" label="Cor de destaque" icon={<LuPalette aria-hidden="true" />} type="color" value={theme.accent ?? PANEL_THEME_PRESETS[theme.preset].accent} onChange={(value) => setTheme({ ...theme, accent: value })} /></motion.div>
          </motion.div>
        </motion.div>
      </motion.section>

      <motion.section variants={authItemVariants}>
        <div className="mb-3 flex items-center gap-2"><LuImage className="size-4 text-primary" aria-hidden="true" /><h3 className="text-sm font-semibold">Imagens da marca</h3></div>
        <motion.div variants={authStaggerVariants} initial="hidden" animate="visible" className="grid gap-4 sm:grid-cols-2">
          <BrandImageDropzone
            id="restaurant-logo-dropzone"
            title="Logo"
            description="Uma marca nítida para identificar seu restaurante."
            previewUrl={imageUrls.logo}
            pendingFile={pendingFiles.logo}
            saved={Boolean(profile.logoPath) && !pendingFiles.logo}
            saving={uploading.logo}
            error={uploadError.logo}
            onSelect={(file) => selectImage("logo", file)}
            onRemove={() => removeImage("logo")}
          />
          <BrandImageDropzone
            id="restaurant-cover-dropzone"
            title="Capa"
            description="Uma imagem horizontal para ambientar a página do restaurante."
            previewUrl={imageUrls.cover}
            pendingFile={pendingFiles.cover}
            saved={Boolean(profile.coverPath) && !pendingFiles.cover}
            saving={uploading.cover}
            error={uploadError.cover}
            onSelect={(file) => selectImage("cover", file)}
            onRemove={() => removeImage("cover")}
          />
        </motion.div>
      </motion.section>

      <motion.section variants={authItemVariants} className="rounded-xl border border-border/70 bg-muted/15 p-4">
        <div className="flex items-center gap-2"><LuLayoutGrid className="size-4 text-primary" aria-hidden="true" /><h3 className="text-sm font-semibold">Apresentação do cardápio</h3></div>
        <motion.div variants={authStaggerVariants} initial="hidden" animate="visible" className="mt-3">
          <motion.div variants={authItemVariants} className="grid gap-3 sm:grid-cols-2">
            {([
              { value: "immersive", label: "Imersivo", copy: "Um prato por tela, com a imagem em primeiro plano.", icon: <LuImage aria-hidden="true" /> },
              { value: "standard", label: "Padrão", copy: "Categorias em sequência e pratos em cartões deslizantes.", icon: <LuLayoutGrid aria-hidden="true" /> },
            ] as const).map((presentation) => {
              const selected = profile.menuPresentation === presentation.value
              return (
                <motion.button key={presentation.value} type="button" aria-pressed={selected} onClick={() => updateField("menuPresentation", presentation.value)} className={`group flex min-h-24 items-start gap-3 rounded-xl border p-4 text-left transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${selected ? "border-primary bg-primary/[0.045] ring-2 ring-primary/15" : "border-border/70 hover:border-primary/40"}`}>
                  <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:text-primary"}`}>{presentation.icon}</span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{presentation.label}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{presentation.copy}</span></span>
                  <LuArrowUpRight aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                </motion.button>
              )
            })}
          </motion.div>
          <motion.p variants={authItemVariants} className="mt-2 text-xs text-muted-foreground">Você pode trocar a apresentação depois em Identidade.</motion.p>
        </motion.div>
      </motion.section>

      <motion.p variants={authItemVariants} className="text-xs text-muted-foreground">Endereço público planejado: <strong>/{restaurant.slug}</strong></motion.p>
    </motion.div>
  )
}
