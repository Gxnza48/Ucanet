/**
 * app/(public)/recursos/subir/page.tsx — el formulario de subida (PART 17
 * §17.4.5, PART 14 §14.3).
 *
 * Requiere sesión terminada: `requireProfile()` manda a `/ingresar?next=…` si no
 * hay sesión y a `/registro/continuar` si la cuenta todavía no eligió seudónimo.
 * No se hace acá ningún chequeo de permiso más: la autorización de verdad la
 * aplican `request_upload` y `finalize_upload` en la base, que además son las que
 * conocen la cuota real y los límites de tasa (§14.3, D14.4).
 *
 * El catálogo de materias lo trae la página, no la feature: `UploadForm` recibe
 * las opciones como props porque features/recursos nunca importa features/materias
 * (BUILD-CONTRACT §2). `app/` es justamente el lugar donde las dos se encuentran.
 *
 * Preselección por query (§14.11, subir en tanda): al publicar, el toast ofrece
 * "Subir otro a la misma materia" y vuelve acá con `?materia=…&tipo=…`. Los dos
 * parámetros se validan antes de tocar el formulario.
 *
 * Dinámica y noindex: es una pantalla detrás de sesión, no tiene nada que
 * indexar (§23.1).
 */
import type { Metadata } from 'next'

import { UploadForm } from '@/features/recursos/components/upload-form'
import { getQuotaUsage } from '@/features/recursos/queries'
import { formatBytes, isResourceTipo } from '@/features/recursos/schemas'
import { listMaterias } from '@/features/materias/queries'
import { LIMITS, SITE_NAME } from '@/lib/config'
import { requireProfile } from '@/lib/supabase/server'
import { isSlug } from '@/lib/utils/slug'

export const dynamic = 'force-dynamic'

type PageSearchParams = { [key: string]: string | string[] | undefined }

type PageProps = {
  searchParams: Promise<PageSearchParams>
}

export const metadata: Metadata = {
  title: { absolute: `Subí un recurso | ${SITE_NAME}` },
  description: 'Compartí resúmenes, apuntes, parciales y finales con tu materia.',
  robots: { index: false, follow: false },
}

function readParam(params: PageSearchParams, key: string): string | undefined {
  const value = params[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export default async function SubirRecursoPage({ searchParams }: PageProps) {
  // Redirige por su cuenta cuando no hay sesión o falta el onboarding.
  await requireProfile()

  const sp = await searchParams
  const rawMateria = readParam(sp, 'materia')
  const rawTipo = readParam(sp, 'tipo')

  const [materias, quota] = await Promise.all([listMaterias(), getQuotaUsage()])

  const defaultMateriaSlug =
    rawMateria && isSlug(rawMateria) && materias.some((materia) => materia.slug === rawMateria)
      ? rawMateria
      : undefined
  const defaultTipo = rawTipo && isResourceTipo(rawTipo) ? rawTipo : undefined

  return (
    <div className="mx-auto w-full max-w-170 py-6">
      <header>
        <h1 className="font-serif text-2xl font-semibold text-text-primary">Subí un recurso</h1>
        <p className="mt-2 text-m text-text-secondary">
          Hasta {LIMITS.filesPerResource} archivos por recurso, {formatBytes(LIMITS.fileMaxBytes)}{' '}
          cada uno. Lo que subís queda visible para toda la comunidad.
        </p>
        {/* La cuota que se muestra es una pista, no el veredicto: el número
            verdadero lo tiene `request_upload`, que rechaza con QUOTA_EXCEEDED. */}
        <p className="mt-1 text-s text-text-secondary">
          Llevás usados {formatBytes(quota.usedBytes)} de {formatBytes(quota.limitBytes)}.
        </p>
      </header>

      <UploadForm
        className="mt-6"
        materias={materias.map((materia) => ({ slug: materia.slug, nombre: materia.nombre }))}
        defaultMateriaSlug={defaultMateriaSlug}
        defaultTipo={defaultTipo}
      />

      <p className="mt-6 border-t border-border pt-4 text-s text-text-secondary">
        No subas libros escaneados ni PDFs de editoriales. Tus resúmenes, tus apuntes y tus propias
        fotos de un examen que rendiste, sí.
      </p>
    </div>
  )
}
