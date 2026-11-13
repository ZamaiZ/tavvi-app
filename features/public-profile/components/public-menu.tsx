"use client"

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type UIEvent as ReactUIEvent } from "react"
import { MotionConfig, motion, useReducedMotion } from "motion/react"
import { LuArrowRight, LuChevronLeft, LuChevronRight } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import type { PublicMenuDTO } from "@/features/public-profile/menu-model"
import { PublicAppearanceToggle } from "@/features/public-profile/components/public-profile-controls"
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
    <img src={media.url} alt={media.altText || `Foto de ${itemName}`} loading="lazy" draggable={false} />
  )
}

type MediaAnimationFrameRef = { current: number | null }
type MediaPointerStart = {
  pointerId: number
  x: number
  y: number
  scrollLeft: number
  index: number
  horizontal: boolean
}

function stopMediaAnimation(rail: HTMLDivElement | null, frameRef: MediaAnimationFrameRef) {
  if (frameRef.current !== null) {
    cancelAnimationFrame(frameRef.current)
    frameRef.current = null
  }
  if (rail) rail.style.scrollSnapType = ""
}

function animateMediaRailTo(rail: HTMLDivElement, targetLeft: number, reducedMotion: boolean, frameRef: MediaAnimationFrameRef) {
  stopMediaAnimation(rail, frameRef)
  const startLeft = rail.scrollLeft
  if (reducedMotion || Math.abs(targetLeft - startLeft) < 1) {
    rail.scrollLeft = targetLeft
    return
  }

  rail.style.scrollSnapType = "none"
  const startedAt = performance.now()
  const duration = 200
  const tick = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / duration)
    const eased = 1 - Math.pow(1 - progress, 3)
    rail.scrollLeft = startLeft + (targetLeft - startLeft) * eased
    if (progress < 1) {
      frameRef.current = requestAnimationFrame(tick)
      return
    }
    rail.scrollLeft = targetLeft
    rail.style.scrollSnapType = ""
    frameRef.current = null
  }
  frameRef.current = requestAnimationFrame(tick)
}

function useMediaRail(mediaCount: number, reducedMotion: boolean) {
  const railRef = useRef<HTMLDivElement>(null)
  const animationFrameRef = useRef<number | null>(null)
  const pointerStartRef = useRef<MediaPointerStart | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => () => stopMediaAnimation(railRef.current, animationFrameRef), [])

  function moveTo(index: number) {
    const rail = railRef.current
    if (!rail || mediaCount < 2) return
    const nextIndex = Math.max(0, Math.min(mediaCount - 1, index))
    animateMediaRailTo(rail, nextIndex * rail.clientWidth, reducedMotion, animationFrameRef)
    setActiveIndex(nextIndex)
  }

  function onScroll(event: ReactUIEvent<HTMLDivElement>) {
    const rail = event.currentTarget
    if (!rail.clientWidth || mediaCount < 1) return
    setActiveIndex(Math.max(0, Math.min(mediaCount - 1, Math.round(rail.scrollLeft / rail.clientWidth))))
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault()
      event.stopPropagation()
      moveTo(activeIndex + (event.key === "ArrowRight" ? 1 : -1))
    }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (mediaCount < 2 || event.button !== 0) return
    if (event.target instanceof Element && event.target.closest("button, video, input, select, textarea, a")) return
    const rail = event.currentTarget
    stopMediaAnimation(rail, animationFrameRef)
    rail.style.scrollSnapType = "none"
    pointerStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      scrollLeft: rail.scrollLeft,
      index: Math.max(0, Math.min(mediaCount - 1, Math.round(rail.scrollLeft / rail.clientWidth))),
      horizontal: false,
    }
    rail.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const start = pointerStartRef.current
    if (!start || start.pointerId !== event.pointerId) return
    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y
    if (!start.horizontal && Math.abs(deltaX) > 7 && Math.abs(deltaX) > Math.abs(deltaY) * 1.1) {
      start.horizontal = true
    }
    if (start.horizontal) {
      event.preventDefault()
      event.currentTarget.scrollLeft = start.scrollLeft - deltaX
    }
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const start = pointerStartRef.current
    if (!start || start.pointerId !== event.pointerId) return
    pointerStartRef.current = null
    const rail = event.currentTarget
    if (rail.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId)
    if (!start.horizontal || !rail.clientWidth) {
      rail.style.scrollSnapType = ""
      return
    }

    const deltaX = event.clientX - start.x
    const threshold = Math.max(36, rail.clientWidth * 0.12)
    const nextIndex = Math.abs(deltaX) >= threshold
      ? start.index + (deltaX < 0 ? 1 : -1)
      : Math.round(rail.scrollLeft / rail.clientWidth)
    moveTo(nextIndex)
  }

  function onPointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    const start = pointerStartRef.current
    if (!start || start.pointerId !== event.pointerId) return
    pointerStartRef.current = null
    const rail = event.currentTarget
    rail.style.scrollSnapType = ""
    if (start.horizontal && rail.clientWidth) moveTo(Math.round(rail.scrollLeft / rail.clientWidth))
  }

  return { railRef, activeIndex, moveTo, onScroll, onKeyDown, onPointerDown, onPointerMove, onPointerUp, onPointerCancel }
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

function ItemMedia({ item }: { item: PublicItem }) {
  const reducedMotion = useReducedMotion() === true
  const media = useMediaRail(item.media.length, reducedMotion)
  return (
    <div className={styles.menuMediaFrame}>
      {item.media.length ? (
        <div
          ref={media.railRef}
          className={styles.menuMediaRail}
          role={item.media.length > 1 ? "region" : undefined}
          aria-label={item.media.length > 1 ? "Mídias de " + item.name + ". Deslize na área da foto para trocar." : undefined}
          tabIndex={item.media.length > 1 ? 0 : undefined}
          onScroll={media.onScroll}
          onKeyDown={media.onKeyDown}
          onPointerDown={media.onPointerDown}
          onPointerMove={media.onPointerMove}
          onPointerUp={media.onPointerUp}
          onPointerCancel={media.onPointerCancel}
        >
          {item.media.map((entry) => (
            <div key={entry.id} className={styles.menuMediaSlide}>
              <PublicMenuMedia media={entry} itemName={item.name} />
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.menuNoMedia} role="img" aria-label={`Imagem indisponível para ${item.name}`}>
          <span aria-hidden="true">{item.name.trim().slice(0, 1).toLocaleUpperCase("pt-BR")}</span>
        </div>
      )}
      {item.media.length > 1 ? (
        <>
          <Button type="button" variant="secondary" size="icon-sm" className={styles.mediaArrowPrevious} aria-label={"Mídia anterior de " + item.name} disabled={media.activeIndex === 0} onClick={() => media.moveTo(media.activeIndex - 1)}><LuChevronLeft aria-hidden="true" /></Button>
          <Button type="button" variant="secondary" size="icon-sm" className={styles.mediaArrowNext} aria-label={"Próxima mídia de " + item.name} disabled={media.activeIndex >= item.media.length - 1} onClick={() => media.moveTo(media.activeIndex + 1)}><LuChevronRight aria-hidden="true" /></Button>
          <span className={styles.mediaCounter} aria-live="polite" aria-atomic="true">{media.activeIndex + 1} / {item.media.length}</span>
        </>
      ) : null}
    </div>
  )
}

const itemReveal = {
  hidden: { opacity: 0, y: 10, scale: 0.99 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.34, ease: [0.23, 1, 0.32, 1] as const, staggerChildren: 0.055, delayChildren: 0.045 } },
}
function ProductRail({ category }: { category: PublicCategory }) {
  const railRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const reducedMotion = useReducedMotion() === true

  return (
    <div className={styles.railWrap}>
      {category.items.length > 1 ? <div className={styles.railControls}><span aria-live="polite" aria-atomic="true">{activeIndex + 1} de {category.items.length}</span></div> : null}
      <div
        className={styles.menuItems}
        ref={railRef}
        role="region"
        aria-label={`Pratos de ${category.name}. Deslize horizontalmente para mudar de prato.`}
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
            <motion.div variants={revealPart}><ItemMedia item={item} /></motion.div>
            <motion.div variants={revealPart}><ItemCopy item={item} /></motion.div>
          </motion.article>
        ))}
      </div>
      {category.items.length > 1 ? <p className={styles.swipeHint}><LuArrowRight aria-hidden="true" />Deslize para ver os outros pratos</p> : null}
    </div>
  )
}

function ImmersiveItemSlide({
  category,
  item,
  index,
  reducedMotion,
}: {
  category: PublicCategory
  item: PublicItem
  index: number
  reducedMotion: boolean
}) {
  const media = useMediaRail(item.media.length, reducedMotion)
  const mediaTouchStartRef = useRef<{ x: number; y: number; startedOnMedia: boolean } | null>(null)

  return (
    <motion.article
      key={item.id}
      id={`menu-item-${item.id}`}
      className={styles.immersiveSlide}
      role="group"
      aria-label={`${item.name}, categoria ${category.name}. Role para mudar de prato${item.media.length > 1 ? " e deslize na horizontal para ver outras mídias" : ""}.`}
      tabIndex={0}
      style={{ "--item-index": index } as CSSProperties}
      variants={itemReveal}
      initial={reducedMotion ? "visible" : "hidden"}
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      onTouchStart={(event) => {
        const touch = event.touches[0]
        if (!touch) return
        mediaTouchStartRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          startedOnMedia: event.target instanceof Node && Boolean(media.railRef.current?.contains(event.target)),
        }
      }}
      onTouchEnd={(event) => {
        const start = mediaTouchStartRef.current
        const touch = event.changedTouches[0]
        mediaTouchStartRef.current = null
        if (!start || !touch || start.startedOnMedia) return

        const deltaX = touch.clientX - start.x
        const deltaY = touch.clientY - start.y
        if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return
        media.moveTo(media.activeIndex + (deltaX < 0 ? 1 : -1))
      }}
      onTouchCancel={() => { mediaTouchStartRef.current = null }}
    >
      <div className={styles.immersiveArtwork} data-has-media={item.media.length > 0}>
        {item.media.length ? (
          <div
            ref={media.railRef}
            className={styles.immersiveMediaRail}
            role={item.media.length > 1 ? "region" : undefined}
            aria-label={item.media.length > 1 ? "Mídias de " + item.name + ". Deslize horizontalmente ou use as setas para trocar." : undefined}
            tabIndex={item.media.length > 1 ? 0 : undefined}
            onScroll={media.onScroll}
            onKeyDown={media.onKeyDown}
            onPointerDown={media.onPointerDown}
            onPointerMove={media.onPointerMove}
            onPointerUp={media.onPointerUp}
            onPointerCancel={media.onPointerCancel}
          >
            {item.media.map((media) => (
              <div key={media.id} className={styles.immersiveMediaSlide}>
                <PublicMenuMedia media={media} itemName={item.name} />
              </div>
            ))}
          </div>
        ) : <div className={styles.immersiveFallback} aria-hidden="true" />}
        <div className={styles.immersiveScrim} />
      </div>
      <div className={styles.immersiveCopy}>
        <motion.div variants={revealPart} className={styles.immersiveCategory}>{category.name}</motion.div>
        <motion.div variants={revealPart} className={styles.immersiveItemContent}>
          <ItemCopy item={item} />
        </motion.div>
      </div>
      {item.media.length > 1 ? (
        <div className={styles.immersiveFooter} role="group" aria-label={`Navegação das mídias de ${item.name}`}>
          <span aria-live="polite" aria-atomic="true">{media.activeIndex + 1} / {item.media.length}</span>
          <div>
            <Button type="button" variant="outline" size="icon-sm" aria-label={"Mídia anterior de " + item.name} disabled={media.activeIndex === 0} onClick={() => media.moveTo(media.activeIndex - 1)}><LuChevronLeft aria-hidden="true" /></Button>
            <Button type="button" variant="outline" size="icon-sm" aria-label={"Próxima mídia de " + item.name} disabled={media.activeIndex >= item.media.length - 1} onClick={() => media.moveTo(media.activeIndex + 1)}><LuChevronRight aria-hidden="true" /></Button>
          </div>
        </div>
      ) : null}
    </motion.article>
  )
}

function ImmersiveFeed({ categories }: { categories: PublicCategory[] }) {
  const feedRef = useRef<HTMLDivElement>(null)
  const categoryNavRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [activeCategory, setActiveCategory] = useState(categories.find((category) => category.items.length > 0)?.id ?? categories[0]?.id ?? "")
  const items = categories.flatMap((category) => category.items.map((item) => ({ category, item })))
  const reducedMotion = useReducedMotion() === true

  function moveTo(index: number) {
    const feed = feedRef.current
    if (!feed) return
    const nextIndex = Math.max(0, Math.min(items.length - 1, index))
    feed.scrollTo({ top: nextIndex * feed.clientHeight, behavior: reducedMotion ? "auto" : "smooth" })
    setActiveIndex(nextIndex)
    setActiveCategory(items[nextIndex]?.category.id ?? "")
  }

  useEffect(() => {
    const list = categoryNavRef.current
    const activeButton = list?.querySelector<HTMLButtonElement>('[aria-current="true"]')
    if (!list || !activeButton) return

    const listRect = list.getBoundingClientRect()
    const buttonRect = activeButton.getBoundingClientRect()
    if (buttonRect.left >= listRect.left && buttonRect.right <= listRect.right) return

    const centeredLeft = list.scrollLeft + buttonRect.left - listRect.left - (list.clientWidth - buttonRect.width) / 2
    list.scrollTo({ left: Math.max(0, Math.min(centeredLeft, list.scrollWidth - list.clientWidth)), behavior: reducedMotion ? "auto" : "smooth" })
  }, [activeCategory, reducedMotion])

  return (
    <div className={styles.immersiveLayout}>
      <nav className={styles.immersiveCategories} aria-label="Ir para uma categoria">
        <div className={styles.immersiveCategoryList} ref={categoryNavRef}>
          {categories.map((category) => (
            <button key={category.id} type="button" aria-current={activeCategory === category.id ? "true" : undefined} onClick={() => {
              const firstItem = items.findIndex((entry) => entry.category.id === category.id)
              if (firstItem >= 0) moveTo(firstItem)
            }}>{category.name}</button>
          ))}
        </div>
        <PublicAppearanceToggle revealOrder={0} className={styles.immersiveThemeToggle} showLabel />
      </nav>
      <div
        ref={feedRef}
        className={styles.immersiveFeed}
        role="region"
        aria-label="Pratos do cardápio imersivo. Role para cima ou para baixo para mudar de prato; deslize para os lados para trocar as mídias."
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.target instanceof HTMLElement && event.target !== event.currentTarget && event.target.closest("button, video, input, textarea, select, [contenteditable='true']")) return
          if (event.key === "ArrowDown") {
            event.preventDefault()
            moveTo(activeIndex + 1)
          } else if (event.key === "ArrowUp") {
            event.preventDefault()
            moveTo(activeIndex - 1)
          }
        }}
        onScroll={(event) => {
          const feed = event.currentTarget
          if (!feed.clientHeight) return
          const index = Math.round(feed.scrollTop / feed.clientHeight)
          setActiveIndex(index)
          setActiveCategory(items[index]?.category.id ?? "")
        }}
      >
        {items.map(({ category, item }, index) => (
          <ImmersiveItemSlide key={item.id} category={category} item={item} index={index} reducedMotion={reducedMotion} />
        ))}
      </div>
    </div>
  )
}

export function PublicMenu({ menu }: { menu: PublicMenuDTO }) {
  const [activeCategoryId, setActiveCategoryId] = useState(menu.categories[0]?.id ?? "")
  const menuRef = useRef<HTMLElement | null>(null)
  const reducedMotion = useReducedMotion() === true

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

  return (
    <MotionConfig reducedMotion="user">
      <section ref={menuRef} id="public-menu" className={styles.publicMenu} data-presentation={menu.presentation} aria-labelledby="public-menu-heading">
        {menu.presentation === "standard" ? (
          <div className={styles.standardMenuLayout}>
            <nav className={styles.menuCategoryNav} aria-label="Categorias do cardápio">
              {menu.categories.map((category) => <a key={category.id} href={`#menu-${category.id}`} aria-current={activeCategoryId === category.id ? "location" : undefined} onClick={() => setActiveCategoryId(category.id)}>{category.name}</a>)}
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
                  <ProductRail category={category} />
                </motion.section>
              ))}
            </div>
          </div>
        ) : (
          <>
            <ImmersiveFeed categories={menu.categories} />
          </>
        )}
      </section>
    </MotionConfig>
  )
}
