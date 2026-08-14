/**
 * app/(me)/guardados/page.tsx — `/guardados` (D7, PART 17 §17.1.1).
 *
 * La tercera lista de uso diario, junto a "Para vos" y "Tendencias": lo que el lector marcó
 * con el ícono de guardar, de lo último guardado a lo primero. No es un feed rankeado y no
 * tiene fórmula — el orden lo pone la persona, y por eso cada fila muestra "Guardado hace
 * 2 días": sin ese dato, una publicación de marzo arriba de una de agosto se lee como un bug.
 *
 * `force-dynamic`: la lista es privada y cambia con cada toque del botón de guardar.
 * Cachearla aunque sea un segundo significaría, en el peor caso, servirle los guardados de
 * alguien a otra persona. Nunca se cachea.
 *
 * DOS GUARDS Y NO UNO. `app/(me)/layout.tsx` ya exige perfil, pero en una navegación de
 * cliente dentro del mismo grupo el layout no se vuelve a ejecutar; por eso la página vuelve
 * a exigir sesión con `requireUser()`. Se usa `requireUser` y no `requireProfile` a propósito:
 * guardar no es publicar, así que una cuenta suspendida o a medio crear conserva el acceso a
 * lo que ya guardó (PART 11 §11.8). La tercera capa es la base: `feed_guardados` corre
 * acotada a `auth.uid()` y está otorgada solo a `authenticated`.
 *
 * SIN RIEL, y es una propiedad del grupo y no un olvido: el layout de `(me)` es la columna de
 * 680px que comparten `/avisos` y `/ajustes`, sin riel derecho. §17.1.1 pide el bloque
 * "Explorar" en todas las páginas de escritorio (§0.5-R19); las tres pantallas de cuenta no
 * lo tienen desde que existe el grupo. Si esa regla tiene que valer también acá, se arregla
 * una vez en `app/(me)/layout.tsx` para las tres, no metiéndole un riel a esta sola.
 *
 * El único JavaScript de la ruta es el botón de guardar de cada fila, que es lo que hace la
 * lista accionable: se quita desde acá, sin entrar a la publicación.
 */
import type { Metadata } from 'next'

import { Pagination } from '@/components/ui/pagination'
import { GuardadosList } from '@/features/bookmarks/components/guardados-list'
import { getGuardados } from '@/features/bookmarks/queries'
import { SITE_NAME } from '@/lib/config'
import { requireUser } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const TITLE = `Guardados | ${SITE_NAME}`
const DESCRIPTION = 'Las publicaciones que guardaste, de lo último a lo primero.'

export async function generateMetadata(): Promise<Metadata> {
  return {
    // `absolute` porque el layout raíz aplica la plantilla `%s · uca.net` (PART 23 §23.2).
    title: { absolute: TITLE },
    description: DESCRIPTION,
    // Pantalla privada detrás de sesión: nada que indexar (§23.1).
    robots: { index: false, follow: false },
  }
}

type SearchParams = Record<string, string | string[] | undefined>

export default async function GuardadosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  // Redirige a /ingresar?next=/guardados cuando no hay sesión.
  await requireUser()

  const sp = await searchParams
  const cursor = typeof sp.cursor === 'string' ? sp.cursor : undefined

  const { items, nextCursor } = await getGuardados({ cursor })

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h1 className="font-serif text-2xl font-semibold text-text-primary">Guardados</h1>
        <p className="mt-2 text-m text-text-secondary">{DESCRIPTION}</p>
      </header>

      {/* El estado vacío lo trae `GuardadosList`: la copy vive junto al botón que la
          resuelve ("Tocá el ícono de guardar en cualquier publicación"). */}
      <GuardadosList items={items} />

      {/*
        Cursor keyset: no hay números de página ni forma de retroceder de a una. "Anteriores"
        vuelve al principio de la lista, que es el único punto anterior que se puede nombrar
        sin arrastrar todos los cursores recorridos por la URL.
      */}
      <Pagination
        prevHref={cursor ? '/guardados' : undefined}
        nextHref={nextCursor ? `/guardados?cursor=${encodeURIComponent(nextCursor)}` : undefined}
      />
    </section>
  )
}
