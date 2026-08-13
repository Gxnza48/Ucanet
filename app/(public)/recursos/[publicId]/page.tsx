/**
 * app/(public)/recursos/[publicId]/page.tsx — la ficha de un recurso (PART 17
 * §17.4.5, PART 14 §14.5, PART 23 §23.1-23.2).
 *
 * Metadatos públicos, bytes privados. Esta página es la que Google indexa y la
 * que alguien va a abrir en 2036: título, materia, tipo, año, quién lo subió,
 * lista de archivos con nombre y tamaño, descripción. El archivo en sí sale por
 * `/recursos/[publicId]/descargar`, que exige sesión y firma una URL de 120 s.
 *
 * SIN VISOR DE PDF (§17.4.5, D13). Un visor embebido descarga el archivo entero
 * para mostrarlo, así que cada consulta pagaría el egreso de una descarga
 * completa sin siquiera contarla como tal. El botón de descarga es el único
 * camino a los bytes.
 *
 * ISR de 300 s: la ficha cambia cuando el autor la edita o cuando alguien vota,
 * y cinco minutos de desfasaje en un contador de descargas no le importa a nadie
 * (PART 20 §20.2). Igual que en la estantería, el cliente de Supabase lee
 * cookies y en la práctica Next la sirve dinámica; el `revalidate` queda
 * declarado como contrato de la ruta.
 *
 * Lápida: misma regla que las publicaciones (§0.5-R23c) y misma deuda — una
 * página del App Router no puede emitir 410, así que la lápida responde 200 con
 * `noindex`. Reportado.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import { Breadcrumb } from '@/components/ui/breadcrumb'
import { ButtonLink } from '@/components/ui/button'
import { ReportDialog } from '@/features/mod/components/report-dialog'
import { ResourceView } from '@/features/recursos/components/resource-view'
import { getResource } from '@/features/recursos/queries'
import { TIPO_LABELS, type ResourceTipo } from '@/features/recursos/schemas'
import { SITE_NAME } from '@/lib/config'
import { absoluteUrl } from '@/lib/env'
import { getUser } from '@/lib/supabase/server'
import { isPublicId } from '@/lib/utils/public-id'
import { excerpt } from '@/lib/utils/text'

export const revalidate = 300

/** Largo de la meta description y del extracto de Open Graph (§23.2). */
const DESCRIPTION_LENGTH = 155

type PageParams = { publicId: string }

type PageProps = {
  params: Promise<PageParams>
}

/**
 * La ficha se pide dos veces por request —`generateMetadata` y el render— y
 * `getResource` son tres consultas (recurso, materia, archivos). `cache()` de
 * React memoriza por request y las deja en una sola pasada.
 */
const loadResource = cache(getResource)

/** `{Tipo} de {materia}{ (año)}: {title}` — la receta de §23.2. */
function seoTitle(
  tipo: ResourceTipo,
  materia: string | null,
  anio: number | null,
  title: string,
): string {
  const scope = materia ? ` de ${materia}` : ''
  const year = anio === null ? '' : ` (${anio})`
  return `${TIPO_LABELS[tipo]}${scope}${year}: ${title}`
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { publicId } = await params

  if (!isPublicId(publicId)) {
    return { title: { absolute: `Recurso | ${SITE_NAME}` }, robots: { index: false } }
  }

  const resource = await loadResource(publicId)

  if (!resource) {
    return {
      title: { absolute: `Recurso eliminado | ${SITE_NAME}` },
      robots: { index: false, follow: true },
    }
  }

  const canonical = absoluteUrl(`/recursos/${resource.publicId}`)
  const title = `${seoTitle(resource.tipo, resource.materia?.nombre ?? null, resource.anio, resource.title)} | ${SITE_NAME}`
  // La descripción propia primero; si no hay, una plantilla con los datos duros,
  // que es lo que hace clicable un resultado de búsqueda (§23.2).
  const description =
    excerpt(resource.description ?? '', DESCRIPTION_LENGTH) ||
    `${TIPO_LABELS[resource.tipo]}${resource.materia ? ` de ${resource.materia.nombre}` : ''} en ${SITE_NAME}. ${resource.downloadsCount === 1 ? '1 descarga' : `${resource.downloadsCount} descargas`}.`

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: {
      type: 'article',
      locale: 'es_AR',
      siteName: SITE_NAME,
      url: canonical,
      title,
      description,
      publishedTime: resource.createdAt,
      modifiedTime: resource.editedAt ?? undefined,
    },
    twitter: { card: 'summary', title, description },
  }
}

export default async function RecursoPage({ params }: PageProps) {
  const { publicId } = await params
  if (!isPublicId(publicId)) notFound()

  const resource = await loadResource(publicId)
  if (!resource) return <Tombstone />

  const user = await getUser()
  const signedIn = user !== null

  return (
    <div className="mx-auto w-full max-w-170 py-6">
      <Breadcrumb
        items={[
          { href: '/recursos', label: 'Recursos' },
          ...(resource.materia
            ? [{ href: `/materias/${resource.materia.slug}`, label: resource.materia.nombre }]
            : []),
          { label: resource.title },
        ]}
      />

      <ResourceView
        className="mt-4"
        resource={resource}
        authenticated={signedIn}
        actions={
          signedIn ? (
            <ReportDialog targetKind="resource" targetPublicId={resource.publicId} />
          ) : null
        }
      />

      <p className="mt-6 border-t border-border pt-4 text-s text-text-secondary">
        Si este material infringe derechos de autor o no debería estar acá, reportalo. Lo revisa una
        persona.
      </p>
    </div>
  )
}

/** Lápida del recurso (§0.5-R23c): se fue y la dirección no se recicla. */
function Tombstone() {
  return (
    <div className="mx-auto w-full max-w-170 py-6">
      <h1 className="font-serif text-xl font-semibold text-text-primary">
        Este recurso ya no está.
      </h1>
      <p className="mt-3 text-base text-text-secondary">
        Lo eliminó quien lo subió, o el equipo de moderación tras un reporte o un pedido legal.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <ButtonLink variant="secondary" href="/recursos">
          Ver todos los recursos
        </ButtonLink>
        <Link
          href="/recursos/subir"
          className="text-m font-semibold text-accent transition-colors duration-150 ease-out hover:text-accent-hover hover:underline"
        >
          Subí uno vos
        </Link>
      </div>
    </div>
  )
}
