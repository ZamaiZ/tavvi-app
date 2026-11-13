"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import { MotionConfig, motion, useReducedMotion } from "motion/react"
import { LuArrowLeft, LuArrowRight, LuChevronDown, LuChevronLeft, LuChevronRight, LuImages, LuX } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import type { PublicMenuDTO } from "@/features/public-profile/menu-model"
import styles from "@/features/public-profile/styles/public-profile.module.css"

type PublicCategory = PublicMenuDTO["categories"][number]
type PublicItem = PublicCategory["items"][number]
type PublicMedia = PublicItem["media"][number]

function price(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100)
}

const revealPart = {
  hidden: { opacity: 0, y: 7 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.27, ease: [0.23, 1, 0.32, 1] as const } },
}
const itemCopySequence = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.055, delayChildren: 0.035 } },
}

function PublicMenuMedia({ media, itemName }: { media: PublicMedia; itemName: string }) {
  return media.kind === "video" ? (
    <video src={media.url} poster={media.posterUrl ?? undefined} muted playsInline loop controls preload="none" aria-label={media.altText || `Vídeo de ${itemName}`} />
  ) : (
    // The media route authorizes and redirects to a short lived Storage URL.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={media.url} alt={media.altText || `Foto de ${itemName}`} loading="lazy" />
  )
}

function ItemCopy({ item }: { item: PublicItem }) {
  return (
    <motion.div className={styles.menuItemCopy} variants={itemCopySequence}>
      <motion.div variants={revealPart} className={styles.menuItemHeading}>
        <h3>{item.name}</h3>
        {!item.isAvailable ? <span className={styles.menuUnavailable}>Indisponível</span> : null}
      </motion.div>
      {item.description ? <motion.p variants={revealPart} className={styles.menuDescription}>{item.description}</motion.p> : null}
      <motion.div variants={revealPart} className={styles.menuPrices}>
        {item.pricing.mode === "single"
          ? <strong>{price(item.pricing.basePriceCents)}</strong>
          : item.pricing.variants.map((variant) => (
            <span key={variant.id} className={variant.isAvailable ? undefined : styles.menuVariantUnavailable}>
              {variant.name} <strong>{price(variant.priceCents)}</strong>{!variant.isAvailable ? " · indisponível" : ""}
            </span>
          ))}
      </motion.div>
      {item.highlights.length ? <motion.div variants={revealPart} className={styles.menuChips}>{item.highlights.map((highlight) => <span key={highlight}>{highlight}</span>)}</motion.div> : null}
      {item.attributes.length ? (
        <motion.ul variants={revealPart} className={styles.menuAttributes} aria-label="Dietas e alergênicos">
          {item.attributes.map((attribute) => (
            <li key={`${attribute.kind}-${attribute.label}`}>
              {attribute.kind === "allergen" ? `${attribute.qualifier === "may_contain" ? "Pode conter" : "Contém"} ${attribute.label}` : attribute.label}
            </li>
          ))}
        </motion.ul>
      ) : null}
    </motion.div>
  )
}

function ItemMedia({ item, immersive, onOpenGallery }: { item: PublicItem; immersive?: boolean; onOpenGallery: (item: PublicItem) => void }) {
  const first = item.media[0]
  return (
    <div className={`${styles.menuMediaFrame} ${immersive ? styles.immersiveMediaFrame : ""}`}>
      {first ? <PublicMenuMedia media={first} itemName={item.name} /> : (
        <div className={styles.menuNoMedia} role="img" aria-label={`Imagem indisponível para ${item.name}`}>
          <span aria-hidden="true">{item.name.trim().slice(0, 1).toLocaleUpperCase("pt-BR")}</span>
        </div>
      )}
      {item.media.length > 1 ? (
        <Button type="button" variant="secondary" size="sm" className={styles.galleryButton} onClick={() => onOpenGallery(item)}>
          <LuImages aria-hidden="true" />Ver {item.media.length} mídias
        </Button>
      ) : null}
    </div>
  )
}

const itemReveal = {
  hidden: { opacity: 0, y: 10, scale: 0.99 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.34, ease: [0.23, 1, 0.32, 1] as const, staggerChildren: 0.055, delayChildren: 0.045 } },
}
function ProductRail({ category, onOpenGallery }: { category: PublicCategory; onOpenGallery: (item: PublicItem) => void }) {
  const railRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const reducedMotion = useReducedMotion() === true

  function moveTo(index: number) {
    const rail = railRef.current
    if (!rail) return
    const nextIndex = Math.max(0, Math.min(category.items.length - 1, index))
    rail.scrollTo({ left: nextIndex * rail.clientWidth, behavior: reducedMotion ? "auto" : "smooth" })
    setActiveIndex(nextIndex)
  }

  return (
    <div className={styles.railWrap}>
      <div className={styles.railControls} aria-label={`Navegação dos itens de ${category.name}`}>
        <span aria-live="polite" aria-atomic="true">{activeIndex + 1} de {category.items.length}</span>
        <div>
          <Button type="button" variant="outline" size="icon-sm" aria-label={`Prato anterior em ${category.name}`} disabled={activeIndex === 0} onClick={() => moveTo(activeIndex - 1)}><LuChevronLeft aria-hidden="true" /></Button>
          <Button type="button" variant="outline" size="icon-sm" aria-label={`Próximo prato em ${category.name}`} disabled={activeIndex >= category.items.length - 1} onClick={() => moveTo(activeIndex + 1)}><LuChevronRight aria-hidden="true" /></Button>
        </div>
      </div>
      <div
        className={styles.menuItems}
        ref={railRef}
        role="region"
        aria-label={`Pratos de ${category.name}. Deslize horizontalmente ou use os controles anterior e próximo.`}
        tabIndex={0}
        onScroll={(event) => {
          const rail = event.currentTarget
          if (rail.clientWidth) setActiveIndex(Math.round(rail.scrollLeft / rail.clientWidth))
        }}
      >
        {category.items.map((item, index) => (
          <motion.article
            key={item.id}
            id={`menu-item-${item.id}`}
            className={styles.menuItem}
            style={{ "--item-index": index } as CSSProperties}
            variants={itemReveal}
            initial={reducedMotion ? "visible" : "hidden"}
            whileInView="visible"
            viewport={{ once: true, amount: 0.18 }}
          >
            <motion.div variants={revealPart}><ItemMedia item={item} onOpenGallery={onOpenGallery} /></motion.div>
            <motion.div variants={revealPart}><ItemCopy item={item} /></motion.div>
          </motion.article>
        ))}
      </div>
      {category.items.length > 1 ? <p className={styles.swipeHint}><LuArrowRight aria-hidden="true" />Deslize para ver os outros pratos</p> : null}
    </div>
  )
}

function ImmersiveFeed({ categories, onOpenGallery }: { categories: PublicCategory[]; onOpenGallery: (item: PublicItem) => void }) {
  const feedRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? "")
  const items = categories.flatMap((category) => category.items.map((item) => ({ category, item })))
  const reducedMotion = useReducedMotion() === true

  function moveTo(index: number) {
    const feed = feedRef.current
    if (!feed) return
    const nextIndex = Math.max(0, Math.min(items.length - 1, index))
    feed.scrollTo({ left: nextIndex * feed.clientWidth, behavior: reducedMotion ? "auto" : "smooth" })
    setActiveIndex(nextIndex)
    setActiveCategory(items[nextIndex]?.category.id ?? "")
  }

  return (
    <div className={styles.immersiveLayout}>
      <nav className={styles.immersiveCategories} aria-label="Ir para uma categoria">
        {categories.map((category) => (
          <button key={category.id} type="button" aria-current={activeCategory === category.id ? "true" : undefined} onClick={() => {
            const firstItem = items.findIndex((entry) => entry.category.id === category.id)
            if (firstItem >= 0) moveTo(firstItem)
          }}>{category.name}</button>
        ))}
      </nav>
      <div
        ref={feedRef}
        className={styles.immersiveFeed}
        role="region"
        aria-label="Pratos do cardápio imersivo. Deslize horizontalmente entre os pratos."
        tabIndex={0}
        onScroll={(event) => {
          const feed = event.currentTarget
          if (!feed.clientWidth) return
          const index = Math.round(feed.scrollLeft / feed.clientWidth)
          setActiveIndex(index)
          setActiveCategory(items[index]?.category.id ?? "")
        }}
      >
        {items.map(({ category, item }, index) => (
          <motion.article
            key={item.id}
            id={`menu-item-${item.id}`}
            className={styles.immersiveSlide}
            role="group"
            aria-label={`${item.name}. Este prato ocupa uma tela; role para ler os detalhes e deslize para trocar.`}
            tabIndex={0}
            style={{ "--item-index": index } as CSSProperties}
            variants={itemReveal}
            initial={reducedMotion ? "visible" : "hidden"}
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
          >
            <div className={styles.immersiveArtwork} data-has-media={item.media.length > 0}>
              {item.media[0] ? <PublicMenuMedia media={item.media[0]} itemName={item.name} /> : <div className={styles.immersiveFallback} aria-hidden="true" />}
              <div className={styles.immersiveScrim} />
            </div>
            <div className={styles.immersiveCopy}>
              <motion.div variants={revealPart} className={styles.immersiveCategory}>{category.name}</motion.div>
              <motion.div variants={revealPart} className={styles.immersiveItemContent}>
                <ItemCopy item={item} />
                {item.media.length > 1 ? <Button type="button" variant="secondary" size="sm" className={styles.immersiveGalleryButton} onClick={() => onOpenGallery(item)}><LuImages aria-hidden="true" />Ver todas as mídias</Button> : null}
              </motion.div>
            </div>
          </motion.article>
        ))}
      </div>
      <div className={styles.immersiveFooter}>
        <span aria-live="polite" aria-atomic="true">{activeIndex + 1} / {items.length}</span>
        <div>
          <Button type="button" variant="outline" size="icon-sm" aria-label="Prato anterior" disabled={activeIndex === 0} onClick={() => moveTo(activeIndex - 1)}><LuChevronLeft aria-hidden="true" /></Button>
          <Button type="button" variant="outline" size="icon-sm" aria-label="Próximo prato" disabled={activeIndex >= items.length - 1} onClick={() => moveTo(activeIndex + 1)}><LuChevronRight aria-hidden="true" /></Button>
        </div>
      </div>
    </div>
  )
}

export function PublicMenu({ menu }: { menu: PublicMenuDTO }) {
  const [galleryItem, setGalleryItem] = useState<PublicItem | null>(null)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [activeCategoryId, setActiveCategoryId] = useState(menu.categories[0]?.id ?? "")
  const reducedMotion = useReducedMotion() === true
  const menuRef = useRef<HTMLElement | null>(null)
  const selectedMedia = galleryItem?.media[galleryIndex]

  useEffect(() => {
    const root = menuRef.current
    if (!root || menu.presentation !== "standard" || typeof IntersectionObserver === "undefined") return
    const visible = new Map<string, number>()
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = entry.target.id.replace("menu-", "")
        if (entry.isIntersecting) visible.set(id, entry.intersectionRatio)
        else visible.delete(id)
      }
      const next = [...visible.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
      if (next) setActiveCategoryId(next)
    }, { root, threshold: [0.15, 0.35, 0.6, 0.8] })
    for (const category of menu.categories) {
      const section = root.querySelector(`#menu-${CSS.escape(category.id)}`)
      if (section) observer.observe(section)
    }
    return () => observer.disconnect()
  }, [menu.categories, menu.presentation])

  function openGallery(item: PublicItem) {
    setGalleryItem(item)
    setGalleryIndex(0)
  }

  function returnToWelcome() {
    const welcome = document.getElementById("restaurant-welcome")
    if (!welcome) return
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`)
    welcome.focus({ preventScroll: true })
    welcome.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest", inline: "start" })
  }

  return (
    <MotionConfig reducedMotion="user">
      <section ref={menuRef} id="public-menu" className={styles.publicMenu} data-presentation={menu.presentation} aria-labelledby="public-menu-heading">
        {menu.presentation === "standard" ? (
          <div className={styles.standardMenuLayout}>
            <header className={styles.menuHeader}>
              <button type="button" className={styles.backToWelcome} onClick={returnToWelcome}><LuArrowLeft aria-hidden="true" />Apresentação do restaurante</button>
              <p className={styles.menuEyebrow}>Cardápio</p>
              <h2 id="public-menu-heading">Escolha o seu próximo favorito</h2>
              <p>Explore as categorias e deslize para conhecer cada prato.</p>
            </header>
            <nav className={styles.menuCategoryNav} aria-label="Categorias do cardápio">
              {menu.categories.map((category) => <a key={category.id} href={`#menu-${category.id}`} aria-current={activeCategoryId === category.id ? "location" : undefined} onClick={() => setActiveCategoryId(category.id)}>{category.name}<LuChevronDown aria-hidden="true" /></a>)}
            </nav>
            <div className={styles.menuCategories}>
              {menu.categories.map((category, index) => (
                <motion.section
                  className={styles.menuCategory}
                  key={category.id}
                  id={`menu-${category.id}`}
                  style={{ "--menu-order": index } as CSSProperties}
                  initial={reducedMotion ? "visible" : "hidden"}
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.12 }}
                  variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.055 } } }}
                >
                  <motion.header variants={revealPart} className={styles.menuCategoryHeading}>
                    <span className={styles.categoryIndex}>{String(index + 1).padStart(2, "0")}</span>
                    <div><h3>{category.name}</h3>{category.description ? <p>{category.description}</p> : null}</div>
                  </motion.header>
                  <ProductRail category={category} onOpenGallery={openGallery} />
                </motion.section>
              ))}
            </div>
          </div>
        ) : (
          <>
            <ImmersiveFeed categories={menu.categories} onOpenGallery={openGallery} />
          </>
        )}
        <Dialog open={Boolean(galleryItem)} onOpenChange={(open) => { if (!open) setGalleryItem(null) }}>
          <DialogContent className={styles.galleryDialog} showCloseButton={false}>
            <div className={styles.galleryDialogHeader}>
              <div><DialogTitle>{galleryItem?.name}</DialogTitle><DialogDescription>{selectedMedia?.altText || `Mídia ${galleryIndex + 1} de ${galleryItem?.name}`}</DialogDescription></div>
              <DialogClose render={<Button type="button" size="icon-sm" variant="ghost" aria-label="Fechar mídias" />}><LuX aria-hidden="true" /></DialogClose>
            </div>
            {selectedMedia ? <div className={styles.galleryDialogMedia}><PublicMenuMedia media={selectedMedia} itemName={galleryItem?.name ?? "prato"} /></div> : null}
            {galleryItem && galleryItem.media.length > 1 ? <div className={styles.galleryDialogFooter}>
              <Button type="button" variant="outline" size="sm" disabled={galleryIndex === 0} onClick={() => setGalleryIndex((current) => Math.max(0, current - 1))}><LuChevronLeft aria-hidden="true" />Anterior</Button>
              <span>{galleryIndex + 1} / {galleryItem.media.length}</span>
              <Button type="button" variant="outline" size="sm" disabled={galleryIndex >= galleryItem.media.length - 1} onClick={() => setGalleryIndex((current) => Math.min(galleryItem.media.length - 1, current + 1))}>Próxima<LuChevronRight aria-hidden="true" /></Button>
            </div> : null}
          </DialogContent>
        </Dialog>
      </section>
    </MotionConfig>
  )
}
