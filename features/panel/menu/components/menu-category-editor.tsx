"use client"

import { useEffect, useState, type FormEvent } from "react"
import { LuAlignLeft, LuLayers2, LuLoaderCircle } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { MenuIconInput, MenuIconTextarea } from "./menu-fields"
import { saveMenuCategoryAction } from "../actions"
import type { MenuCategoryDTO } from "../model"

export function MenuCategoryEditor({
  restaurantId,
  category,
  open,
  onOpenChange,
  onSaved,
}: {
  restaurantId: string
  category: MenuCategoryDTO | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isVisible, setIsVisible] = useState(true)
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  useEffect(() => {
    setName(category?.name ?? "")
    setDescription(category?.description ?? "")
    setIsVisible(category?.isVisible ?? true)
    setError("")
  }, [category, open])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError("")
    try {
      const result = await saveMenuCategoryAction({
        expectedRestaurantId: restaurantId,
        categoryId: category?.id ?? null,
        name,
        description,
        isVisible,
      })
      if (!result.ok) {
        setError(result.code === "published_menu_empty"
          ? "O cardápio está publicado. Mantenha pelo menos um item público com mídia ou despublique primeiro."
          : "Não foi possível salvar a categoria. Confira os dados e tente novamente.")
        return
      }
      onOpenChange(false)
      onSaved()
    } catch {
      setError("Não foi possível salvar a categoria. Tente novamente.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <span className="mb-1 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><LuLayers2 aria-hidden="true" /></span>
          <DialogTitle>{category ? "Editar categoria" : "Nova categoria"}</DialogTitle>
          <DialogDescription>Organize os itens em grupos fáceis de percorrer.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="menu-category-name">Nome</Label>
            <MenuIconInput id="menu-category-name" icon={<LuLayers2 aria-hidden="true" />} autoFocus maxLength={80} value={name} onValueChange={setName} placeholder="Ex.: Pratos principais" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="menu-category-description">Descrição <span className="font-normal text-muted-foreground">(opcional)</span></Label>
            <MenuIconTextarea id="menu-category-description" icon={<LuAlignLeft aria-hidden="true" />} maxLength={300} value={description} onValueChange={setDescription} placeholder="Uma breve introdução para esta seção" />
            <p className="text-right text-[0.6875rem] text-muted-foreground">{description.length}/300</p>
          </div>
          <label className="flex min-h-11 items-center justify-between gap-4 rounded-xl border border-border/70 px-3 py-2.5">
            <span><span className="block text-sm font-medium">Categoria visível</span><span className="text-xs text-muted-foreground">Categorias ocultas não aparecem no cardápio público.</span></span>
            <input type="checkbox" checked={isVisible} onChange={(event) => setIsVisible(event.target.checked)} className="size-4 accent-primary" />
          </label>
          {error ? <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={pending || name.trim().length < 2}>
              {pending ? <LuLoaderCircle className="animate-spin" aria-hidden="true" /> : null}
              {pending ? "Salvando…" : "Salvar categoria"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
