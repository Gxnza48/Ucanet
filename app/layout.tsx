/**
 * app/layout.tsx — el esqueleto de toda la aplicación (PART 17 §17.1).
 *
 * Un solo layout para el producto entero: header fijo arriba, una columna de
 * contenido de 680px con riel de 300px en escritorio, y barra inferior en mobile.
 * No hay columna de navegación izquierda en ningún breakpoint (§17.1, decisión
 * vinculante): la navegación es el header o la barra inferior, y el contexto vive
 * en el riel.
 *
 * TEMA SIN DESTELLO (§18.7): el tema se lee de la cookie EN EL SERVIDOR y se
 * estampa como `data-theme` en el `<html>` del primer byte. Sin script bloqueante
 * en el camino crítico y sin el parpadeo blanco→negro que tiene cualquier solución
 * que decide el tema en el cliente. Costo consciente: `getTheme()` lee cookies, así
 * que este layout es dinámico; de todos modos el header también depende de la
 * sesión, así que el árbol nunca iba a ser estático.
 *
 * FUENTE: Source Serif 4 SemiBold (600) es la única fuente cargada — el resto del
 * producto usa la pila del sistema (§18.2). `next/font` la auto-hospeda, así que no
 * hay pedido a Google en runtime (D14: nada de terceros en el camino del usuario) y
 * `display: swap` evita el texto invisible mientras carga.
 *
 * La variable de la fuente se aplica en el `<body>` y no en el `<html>` a
 * propósito: `app/tokens.css` ya declara `--font-serif` en `:root` (es decir, en
 * `<html>`) con la pila de respaldo. Declarándola un nivel más abajo, la clase de
 * next/font gana por cascada sobre el elemento `body` sin depender del orden en que
 * se inserten las hojas de estilo, y todo lo visible hereda de ahí.
 */
import type { Metadata, Viewport } from 'next'
import { Source_Serif_4 } from 'next/font/google'
import type { ReactNode } from 'react'

import './globals.css'

import { ToastProvider } from '@/components/ui/toast'
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from '@/lib/config'
import { siteUrl } from '@/lib/env'
import { getTheme, themeAttribute } from '@/lib/theme'

import { MobileTabBar } from './_components/mobile-tab-bar'
import { SiteFooter } from './_components/site-footer'
import { SiteHeader } from './_components/site-header'

/**
 * Id del `<main>`: destino del enlace "Saltar al contenido" (§17.7).
 *
 * NO se exporta a propósito. Next valida los exports de `layout.tsx` contra una
 * lista cerrada (`metadata`, `viewport`, `revalidate`, `dynamic`…) en los tipos que
 * genera en `.next/types`, y cualquier export extra rompe el `tsc` de CI.
 */
const CONTENT_ID = 'contenido'

/**
 * Imagen de vista previa, una sola y estática para todo el sitio (PART 23 §23.3,
 * PART 20 §20.4). Se declara acá y no por página: la generación por página
 * (`next/og`, satori) es una invocación de función por cada rastreo de compartido
 * —tráfico que no medimos nosotros— a cambio de una ganancia cosmética; queda para
 * P2 y, cuando llegue, generando al publicar y guardando el resultado, no por pedido.
 *
 * ES UN PNG, NO UN SVG, y no es un detalle de gusto: WhatsApp —el canal de
 * compartido que D11 nombra como principal—, Facebook y X no rasterizan SVG en
 * `og:image`; una previsualización con un SVG sale sin imagen. El SVG editable vive
 * al lado, en `public/og-default.svg`, y es la fuente de la que sale este PNG.
 *
 * `metadataBase` (arriba) convierte esta ruta relativa en absoluta: los scrapers de
 * Open Graph no resuelven URLs relativas.
 */
const OG_IMAGE = {
  url: '/og-default.png',
  width: 1200,
  height: 630,
  alt: `${SITE_NAME} — ${SITE_TAGLINE}`,
} as const

const serif = Source_Serif_4({
  subsets: ['latin'],
  weight: '600',
  display: 'swap',
  variable: '--font-serif',
})

export const metadata: Metadata = {
  // Base absoluta para que las URLs de Open Graph y los canónicos de cada página
  // no dependan del host desde el que se sirva (D11, PART 23).
  metadataBase: new URL(siteUrl),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    url: siteUrl,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
  // Sin `creator` ni `authors`: el producto es seudónimo de punta a punta (D3).
  formatDetection: { telephone: false, email: false, address: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Necesario para que `env(safe-area-inset-bottom)` deje de valer 0 en iPhone:
  // sin esto la barra inferior queda debajo de la barra de gestos (§17.1.2).
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const theme = await getTheme()

  return (
    <html lang="es-AR" data-theme={themeAttribute(theme)}>
      <body className={serif.variable}>
        <ToastProvider>
          {/* Primer elemento enfocable de la página (§17.7). */}
          <a href={`#${CONTENT_ID}`} className="skip-link">
            Saltar al contenido
          </a>

          <SiteHeader theme={theme} />

          {/* Región de contenido: 1012px = 680 de columna + 32 de separación + 300
              de riel. El ancho de la columna y la presencia del riel los decide
              cada página; acá vive solo el encuadre y el padding. */}
          <main id={CONTENT_ID} className="mx-auto w-full max-w-253 px-4 lg:px-6">
            {children}
          </main>

          <SiteFooter theme={theme} />

          {/* Va al final del body: es `position: fixed`, y el hueco que deja para
              que el pie siga siendo alcanzable lo pone el propio componente. */}
          <MobileTabBar />
        </ToastProvider>
      </body>
    </html>
  )
}
