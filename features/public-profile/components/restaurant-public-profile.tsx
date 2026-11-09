import { FaWhatsapp } from "react-icons/fa"
import { FcGoogle } from "react-icons/fc"
import {
  LuBookOpen,
  LuChevronRight,
  LuInstagram,
  LuMapPin,
  LuPhone,
} from "react-icons/lu"
import type { CSSProperties, ReactNode } from "react"

import { BrandImage } from "@/features/public-profile/components/brand-image"
import {
  ExpandableDescription,
  PublicAppearanceToggle,
} from "@/features/public-profile/components/public-profile-controls"
import {
  directionsUrl,
  formatPublicRestaurantAddress,
  type PublicRestaurantProfile as PublicRestaurantProfileData,
} from "@/features/public-profile/model"
import { PUBLIC_THEME_FONT_VARIABLES } from "@/features/public-profile/fonts"
import { resolvePublicTheme } from "@/features/public-profile/theme"

import styles from "@/features/public-profile/styles/public-profile.module.css"

type RestaurantPublicProfileProps = {
  restaurant: PublicRestaurantProfileData
}

type RevealStyle = CSSProperties & { "--reveal-delay": string }

type ContactLink = {
  label: string
  href: string
  icon: ReactNode
  opensNewTab: boolean
}

function telephoneHref(value: string) {
  const phone = value.replace(/\D/g, "")
  return phone ? `tel:${phone}` : null
}

function whatsappHref(value: string) {
  const digits = value.replace(/\D/g, "")
  const isLocalNumber = digits.length === 10 || digits.length === 11
  const isBrazilianInternationalNumber = (digits.length === 12 || digits.length === 13) && digits.startsWith("55")
  if (!isLocalNumber && !isBrazilianInternationalNumber) return null
  const international = isBrazilianInternationalNumber ? digits : `55${digits}`
  return `https://wa.me/${international}`
}

function revealStyle(order: number): RevealStyle {
  return { "--reveal-delay": `${order * 45}ms` } as RevealStyle
}

function RestaurantPublicProfile({ restaurant }: RestaurantPublicProfileProps) {
  const theme = resolvePublicTheme(restaurant.theme)
  const address = formatPublicRestaurantAddress(restaurant.contact.address)
  const mapHref = directionsUrl(restaurant.contact)
  const initial = restaurant.name.trim().charAt(0).toLocaleUpperCase("pt-BR")
  const contactLinks: ContactLink[] = []

  const phoneHref = restaurant.contact.phone ? telephoneHref(restaurant.contact.phone) : null
  const whatsappLink = restaurant.contact.whatsapp ? whatsappHref(restaurant.contact.whatsapp) : null
  const instagramHandle = restaurant.contact.instagram?.replace(/^@+/, "") ?? ""

  if (phoneHref) {
    contactLinks.push({ label: "Ligar", href: phoneHref, icon: <LuPhone aria-hidden="true" />, opensNewTab: false })
  }
  if (whatsappLink) {
    contactLinks.push({ label: "WhatsApp", href: whatsappLink, icon: <FaWhatsapp aria-hidden="true" />, opensNewTab: true })
  }
  if (instagramHandle) {
    contactLinks.push({
      label: `Instagram @${instagramHandle}`,
      href: `https://www.instagram.com/${encodeURIComponent(instagramHandle)}/`,
      icon: <LuInstagram aria-hidden="true" />,
      opensNewTab: true,
    })
  }
  if (mapHref) {
    contactLinks.push({ label: "Como chegar", href: mapHref, icon: <LuMapPin aria-hidden="true" />, opensNewTab: true })
  }

  const hasDescription = Boolean(restaurant.description)
  const hasExpandableDescription = (restaurant.description?.length ?? 0) > 180
  const descriptionRevealCount = hasDescription ? (hasExpandableDescription ? 2 : 1) : 0
  const contactRevealOrder = 4 + descriptionRevealCount
  const appearanceRevealOrder = contactRevealOrder + contactLinks.length
  const addressRevealOrder = appearanceRevealOrder + 1
  const actionsRevealOrder = addressRevealOrder + (address ? 1 : 0)
  const constructionRevealOrder = actionsRevealOrder + (restaurant.contact.googleReviewUrl ? 4 : 0)

  return (
    <main
      className={`${styles.profile} ${PUBLIC_THEME_FONT_VARIABLES}`}
      data-preset={theme.presetId}
      data-density={theme.density}
      style={theme.style as CSSProperties}
    >
      <div className={styles.cover} aria-hidden="true">
        <div className={styles.coverArtwork}>
          {restaurant.coverPath ? (
            <BrandImage
              key={`${restaurant.slug}-cover`}
              slug={restaurant.slug}
              slot="cover"
              alt=""
              sizes="100vw"
              className={styles.coverImage}
              fetchPriority="high"
            />
          ) : null}
        </div>
        <div className={styles.coverFade} />
      </div>

      <div className={styles.content}>
        <p className={`${styles.heroEyebrow} ${styles.reveal}`} style={revealStyle(0)}>
          Perfil do restaurante
        </p>

        <section className={styles.identitySection} aria-label={`Sobre ${restaurant.name}`}>
          <div className={styles.identity}>
            <div
              className={`${styles.logoFrame} ${styles.reveal}`}
              style={revealStyle(1)}
              role="img"
              aria-label={`Logotipo de ${restaurant.name}`}
            >
              {restaurant.logoPath ? (
                <BrandImage
                  key={`${restaurant.slug}-logo`}
                  slug={restaurant.slug}
                  slot="logo"
                  alt=""
                  sizes="(max-width: 767px) 68px, 78px"
                  className={styles.logoImage}
                  fallback={<span className={styles.logoInitial}>{initial}</span>}
                />
              ) : (
                <span className={styles.logoInitial}>{initial}</span>
              )}
            </div>

            <div className={styles.identityCopy}>
              {restaurant.segment ? (
                <p className={`${styles.segment} ${styles.reveal}`} style={revealStyle(2)}>
                  {restaurant.segment}
                </p>
              ) : null}
              <h1 className={`${styles.name} ${styles.reveal}`} style={revealStyle(3)}>
                {restaurant.name}
              </h1>
            </div>
          </div>
        </section>

        {restaurant.description ? (
          <ExpandableDescription
            description={restaurant.description}
            id={`restaurant-description-${restaurant.slug}`}
            revealOrder={4}
          />
        ) : null}

        <div className={styles.contactRow}>
          {contactLinks.length ? (
            <nav className={styles.contactLinks} aria-label="Contato do restaurante">
              {contactLinks.map((link, index) => (
                <a
                  key={link.href}
                  className={`${styles.contactIcon} ${styles.reveal}`}
                  style={revealStyle(contactRevealOrder + index)}
                  href={link.href}
                  target={link.opensNewTab ? "_blank" : undefined}
                  rel={link.opensNewTab ? "noopener noreferrer" : undefined}
                  aria-label={link.label}
                  title={link.label}
                >
                  {link.icon}
                </a>
              ))}
            </nav>
          ) : null}
          <PublicAppearanceToggle revealOrder={appearanceRevealOrder} />
        </div>

        {address ? (
          <p className={`${styles.address} ${styles.reveal}`} style={revealStyle(addressRevealOrder)}>
            {address}
          </p>
        ) : null}

        <ul className={styles.actions} aria-label="Ações do restaurante">
          {restaurant.contact.googleReviewUrl ? (
            <li className={`${styles.actionItem} ${styles.reveal}`} style={revealStyle(actionsRevealOrder)}>
              <a
                className={styles.action}
                href={restaurant.contact.googleReviewUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span
                  className={`${styles.actionIcon} ${styles.brandIcon} ${styles.reveal}`}
                  style={revealStyle(actionsRevealOrder + 1)}
                  aria-hidden="true"
                >
                  <FcGoogle />
                </span>
                <span className={`${styles.actionLabel} ${styles.reveal}`} style={revealStyle(actionsRevealOrder + 2)}>
                  Avaliar no Google
                </span>
                <LuChevronRight
                  className={`${styles.actionChevron} ${styles.reveal}`}
                  style={revealStyle(actionsRevealOrder + 3)}
                  aria-hidden="true"
                />
              </a>
            </li>
          ) : null}
          <li
            className={`${styles.actionItem} ${styles.reveal}`}
            style={revealStyle(constructionRevealOrder)}
          >
            <div className={`${styles.action} ${styles.constructionAction}`}>
              <span
                className={`${styles.actionIcon} ${styles.reveal}`}
                style={revealStyle(constructionRevealOrder + 1)}
                aria-hidden="true"
              >
                <LuBookOpen />
              </span>
              <span className={`${styles.actionLabel} ${styles.reveal}`} style={revealStyle(constructionRevealOrder + 2)}>
                Cardápio em construção
              </span>
              <span
                className={`${styles.constructionMark} ${styles.reveal}`}
                style={revealStyle(constructionRevealOrder + 3)}
                aria-hidden="true"
              />
            </div>
          </li>
        </ul>
      </div>
    </main>
  )
}

export { RestaurantPublicProfile }
