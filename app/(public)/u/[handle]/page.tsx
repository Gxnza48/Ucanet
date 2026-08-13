/**
 * app/(public)/u/[handle]/page.tsx — el perfil (PART 17 §17.4.4, C16, D3).
 *
 * NOINDEX (C16, PART 23 §23.1). El historial agregado de un seudónimo en Google
 * es un amplificador de vinculación: cada publicación suelta es inofensiva, la
 * lista completa de todo lo que alguien escribió en tres años no. `noindex,
 * follow` — se rastrea para que la etiqueta se vea y para que los links sigan
 * repartiendo el crawl, pero la página no entra al índice.
 *
 * LO ANÓNIMO NO APARECE ACÁ, NI SIQUIERA PARA VOS (D3). No hace falta filtrarlo:
 * `posts_public` anula `author_handle` cuando la publicación es anónima, así que
 * el filtro por handle de `getPostsByAuthor` no las puede alcanzar.
 * En la vista propia se dice con todas las letras — la frase de §17.4.4 es la
 * misma promesa que hace el compositor, escrita donde se la busca.
 *
 * Dinámica y sin caché: la vista cambia según quién mira (propia vs. pública) y
 * el karma se mueve con el batch nocturno. Cachear una página que depende de la
 * sesión es la forma más rápida de mostrarle a alguien el perfil de otro.
 *
 * DEUDA CONOCIDA — no hay lectura de perfil público. Ni el BUILD-CONTRACT §4.5 ni
 * ninguna feature exponen algo tipo `getPublicProfile(handle)` sobre
 * `profiles_public`, y `app/` no puede consultar la base por su cuenta
 * (BUILD-CONTRACT §7.1). Consecuencias, las dos reportadas:
 *   1. La ficha (carrera, año de ingreso, karma, antigüedad) sólo se puede armar
 *      para la vista propia, que sale de `getProfile()`.
 *   2. El perfil de un handle inexistente renderiza vacío en vez de 404. Se
 *      eligió a conciencia: 404ear sería romper el link `/u/<handle>` que ya
 *      emiten las publicaciones y los recursos firmados de alguien que todavía no
 *      publicó nada visible.
 * La pestaña "Recursos" de §17.4.4 tampoco se puede armar: no existe una lectura
 * de recursos por autor (`listResources` filtra por materia y tipo, no por
 * handle). Se omite en lugar de renderizar una pestaña que siempre diría "no hay
 * nada" — una pestaña que miente es peor que una pestaña que falta.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { getCarreraOptions } from '@/features/auth/queries'
import { PostRow } from '@/features/posts/components/post-row'
import { getPostsByAuthor } from '@/features/posts/queries'
import { LIMITS, SITE_NAME } from '@/lib/config'
import { getProfile } from '@/lib/supabase/server'
import { formatMonthYear } from '@/lib/utils/dates'

export const dynamic = 'force-dynamic'

/** Forma de un seudónimo (PART 9 §9.5, espejo de `handleSchema`). */
const HANDLE_PATTERN = new RegExp(`^[a-zA-Z0-9_]{${LIMITS.handleMin},${LIMITS.handleMax}}$`)

/** Parámetro del cursor keyset de la lista de publicaciones. */
const CURSOR_PARAM = 'cursor'

/**
 * CADENA PROTEGIDA (§17.4.4). Es la contracara de la promesa del compositor: lo
 * anónimo no aparece en ningún listado de perfil, tampoco en el tuyo.
 */
const ANON_NOTICE = 'Tus publicaciones anónimas no aparecen acá ni en tu perfil público.'

type PageParams = { handle: string }
type PageSearchParams = { [key: string]: string | string[] | undefined }

type PageProps = {
  params: Promise<PageParams>
  searchParams: Promise<PageSearchParams>
}

function readParam(params: PageSearchParams, key: string): string | undefined {
  const value = params[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params

  return {
    title: { absolute: `${handle} | ${SITE_NAME}` },
    description: `Publicaciones de ${handle} en ${SITE_NAME}.`,
    // C16: los perfiles no se indexan. `follow` deja pasar el crawl para que los
    // links a materias y publicaciones se sigan descubriendo desde acá.
    robots: { index: false, follow: true },
  }
}

export default async function PerfilPage({ params, searchParams }: PageProps) {
  const { handle } = await params
  if (!HANDLE_PATTERN.test(handle)) notFound()

  const sp = await searchParams
  const cursor = readParam(sp, CURSOR_PARAM)

  const [profile, posts] = await Promise.all([getProfile(), getPostsByAuthor(handle, { cursor })])

  // citext en la base: el handle no distingue mayúsculas y la comparación de acá
  // tiene que hacer lo mismo, o `/u/MateConBizcochos` no sería tu propio perfil.
  // `getPostsByAuthor` compara con la misma insensibilidad (`ilike`, ver
  // lib/utils/handle.ts): si un lado ignorara las mayúsculas y el otro no, la
  // cabecera diría "tu perfil" arriba de una lista vacía.
  // `own` guarda la fila en vez de un booleano para que el estrechamiento de tipos
  // valga en todo el render sin repetir la comparación.
  const own =
    profile !== null && profile.handle.toLowerCase() === handle.toLowerCase() ? profile : null

  // El nombre de la carrera sale del catálogo público (migración 0002); el perfil
  // sólo guarda el id.
  const carreraId = own?.carrera_id ?? null
  const carreras = carreraId === null ? [] : await getCarreraOptions()
  const carrera = carreras.find((option) => option.id === carreraId) ?? null

  const facts: string[] = []
  if (own) {
    if (carrera) facts.push(carrera.nombre)
    if (own.ingreso_year !== null) facts.push(`Ingreso ${own.ingreso_year}`)
  }

  const nextHref = posts.nextCursor
    ? `/u/${handle}?${CURSOR_PARAM}=${encodeURIComponent(posts.nextCursor)}`
    : undefined

  return (
    <div className="mx-auto w-full max-w-170 py-6">
      <header>
        <h1 className="font-serif text-2xl font-semibold text-text-primary">
          {own ? own.handle : handle}
        </h1>

        {facts.length > 0 ? (
          <p className="mt-2 text-m text-text-secondary">{facts.join(' · ')}</p>
        ) : null}

        {own ? (
          <p className="mt-1 text-m text-text-secondary">
            {own.karma === 1 ? '1 punto' : `${own.karma.toLocaleString('es-AR')} puntos`}
            {' · '}
            {`En ${SITE_NAME} desde ${formatMonthYear(own.created_at)}`}
          </p>
        ) : null}

        {own ? (
          <p className="mt-3">
            <Link
              href="/ajustes"
              className="text-m font-semibold text-accent transition-colors duration-150 ease-out hover:text-accent-hover hover:underline"
            >
              Editar perfil
            </Link>
          </p>
        ) : null}
      </header>

      {own ? <p className="mt-4 text-s text-text-secondary">{ANON_NOTICE}</p> : null}

      <section className="mt-6" aria-labelledby="perfil-publicaciones">
        <h2 id="perfil-publicaciones" className="text-s font-semibold text-text-secondary">
          Publicaciones
        </h2>

        {posts.items.length === 0 ? (
          <EmptyState
            title={
              own
                ? 'Todavía no publicaste nada con tu seudónimo.'
                : 'Todavía no hay publicaciones firmadas con este seudónimo.'
            }
            description={own ? 'Lo que publicás como Anónimo no se lista acá.' : undefined}
          />
        ) : (
          <ul className="mt-2 border-t border-border">
            {posts.items.map((post) => (
              <PostRow key={post.publicId} post={post} />
            ))}
          </ul>
        )}

        <Pagination className="mt-2" nextHref={nextHref} />
      </section>
    </div>
  )
}
