import type { PublicMenuDTO } from "@/features/public-profile/menu-model"
import styles from "@/features/public-profile/styles/public-profile.module.css"
import type { CSSProperties } from "react"

function price(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100)
}

function PublicMenuMedia({ media, itemName }: { media: PublicMenuDTO["categories"][number]["items"][number]["media"][number]; itemName: string }) {
  return (
    <div className={styles.menuMedia}>
      {media.kind === "video" ? (
        <video src={media.url} poster={media.posterUrl ?? undefined} muted playsInline loop controls preload="none" aria-label={media.altText || `Vídeo de ${itemName}`} />
      ) : (
        // The media route authorizes and redirects to a short lived Storage URL.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media.url} alt={media.altText || `Foto de ${itemName}`} loading="lazy" />
      )}
    </div>
  )
}

function PublicMenuItem({ item }: { item: PublicMenuDTO["categories"][number]["items"][number] }) {
  return (
    <article className={styles.menuItem}>
      <div
        className={styles.menuGallery}
        role="group"
        tabIndex={item.media.length > 1 ? 0 : undefined}
        aria-label={item.media.length > 1
          ? `Mídias de ${item.name}; ${item.media.length} arquivos. Use a rolagem horizontal para ver os demais.`
          : `Mídia de ${item.name}`}
      >
        {item.media.map((media) => <PublicMenuMedia key={media.id} media={media} itemName={item.name} />)}
      </div>
      <div className={styles.menuItemCopy}>
        <div className={styles.menuItemHeading}>
          <h3>{item.name}</h3>
          {!item.isAvailable ? <span className={styles.menuUnavailable}>Indisponível</span> : null}
        </div>
        {item.description ? <p className={styles.menuDescription}>{item.description}</p> : null}
        <div className={styles.menuPrices}>
          {item.pricing.mode === "single"
            ? <strong>{price(item.pricing.basePriceCents)}</strong>
            : item.pricing.variants.map((variant) => (
              <span key={variant.id} className={variant.isAvailable ? undefined : styles.menuVariantUnavailable}>
                {variant.name} <strong>{price(variant.priceCents)}</strong>{!variant.isAvailable ? " · indisponível" : ""}
              </span>
            ))}
        </div>
        {item.highlights.length ? <div className={styles.menuChips}>{item.highlights.map((highlight) => <span key={highlight}>{highlight}</span>)}</div> : null}
        {item.attributes.length ? (
          <ul className={styles.menuAttributes} aria-label="Dietas e alergênicos">
            {item.attributes.map((attribute) => (
              <li key={`${attribute.kind}-${attribute.label}`}>
                {attribute.kind === "allergen" ? `${attribute.qualifier === "may_contain" ? "Pode conter" : "Contém"} ${attribute.label}` : attribute.label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  )
}

export function PublicMenu({ menu }: { menu: PublicMenuDTO }) {
  return (
    <section className={styles.publicMenu} data-presentation={menu.presentation} aria-labelledby="public-menu-heading">
      <header className={styles.menuHeader}>
        <p className={styles.menuEyebrow}>Cardápio</p>
        <h2 id="public-menu-heading">Feito para você</h2>
        <p>Explore nossos pratos e escolhas da casa.</p>
      </header>
      <nav className={styles.menuCategoryNav} aria-label="Categorias do cardápio">
        {menu.categories.map((category) => <a key={category.id} href={`#menu-${category.id}`}>{category.name}</a>)}
      </nav>
      <div className={styles.menuCategories}>
        {menu.categories.map((category, index) => (
          <section className={styles.menuCategory} key={category.id} id={`menu-${category.id}`} style={{ "--menu-order": index } as CSSProperties}>
            <header className={styles.menuCategoryHeading}>
              <h2>{category.name}</h2>
              {category.description ? <p>{category.description}</p> : null}
            </header>
            <div className={styles.menuItems}>
              {category.items.map((item) => <PublicMenuItem key={item.id} item={item} />)}
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}
