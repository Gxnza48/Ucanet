/**
 * app/(me)/avisos/page.tsx — `/avisos` (PART 17 §17.4.7, §0.5-R14, D7).
 *
 * `force-dynamic`: la lista es privada y cambia con cada respuesta que recibe la persona.
 * Cachearla aunque sea un segundo significaría, en el peor caso, servirle los avisos de alguien
 * a otro. Nunca se cachea.
 *
 * MARCADO AL VISITAR, NO POR FILA (§17.4.7). La página se pinta con los no leídos todavía
 * marcados —punto de acento y fondo raised— y el UPDATE sale DESPUÉS de mandar la respuesta,
 * dentro de `after()`. Ese orden es el que hace que la visita sirva: si se marcara antes de
 * renderizar, la persona entraría a mirar y encontraría todo gris, que es exactamente el
 * castigo que §17.4.7 no quiere. En la visita siguiente ya están leídos, y siguen en la lista.
 *
 * Por qué `after()` y no un `await` suelto: `markAllRead()` termina en `revalidatePath`, y Next
 * tira `used "revalidatePath" during render which is unsupported` si eso ocurre durante el
 * render. Dentro de `after()` la fase del request pasa a 'after' y la revalidación es legal.
 * Además el UPDATE deja de estar en el camino crítico de la respuesta.
 *
 * Server Component puro: ni una línea de JS de ruta. Las filas son links y la paginación son
 * dos anchors con el cursor keyset en la query.
 */
import type { Metadata } from 'next'
import { after } from 'next/server'

import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { markAllRead } from '@/features/notifications/actions'
import {
  MarkAllReadLink,
  NotificationRow,
} from '@/features/notifications/components/notification-row'
import { getUnreadCount, listNotifications } from '@/features/notifications/queries'
import { SITE_NAME } from '@/lib/config'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: `Avisos · ${SITE_NAME}`,
  robots: { index: false, follow: false },
}

type SearchParams = Record<string, string | string[] | undefined>

function uno(valor: string | string[] | undefined): string | undefined {
  if (typeof valor === 'string') return valor
  return Array.isArray(valor) ? valor[0] : undefined
}

export default async function AvisosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const cursor = uno(sp.cursor)

  const [{ items, nextCursor }, sinLeer] = await Promise.all([
    listNotifications({ cursor }),
    getUnreadCount(),
  ])

  // Sin no leídos el UPDATE no tocaría ninguna fila: se ahorra el viaje.
  if (sinLeer > 0) {
    after(async () => {
      await markAllRead()
    })
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-serif text-2xl font-semibold text-text-primary">Avisos</h1>
        {/* Acción terciaria de cabecera (§17.4.7). Refuerza lo que la visita ya hizo. */}
        {sinLeer > 0 ? <MarkAllReadLink /> : null}
      </header>

      {items.length === 0 ? (
        <EmptyState
          title="No tenés avisos."
          description="Acá van a aparecer las respuestas a lo que publiques y las decisiones de moderación."
        />
      ) : (
        <ul className="flex flex-col">
          {items.map((item) => (
            <NotificationRow key={item.cursor} item={item} />
          ))}
        </ul>
      )}

      {/*
        Cursor keyset: no hay números de página ni forma de retroceder de a una. "Anteriores"
        vuelve al principio de la lista, que es el único punto anterior que se puede nombrar
        sin arrastrar todos los cursores recorridos por la URL.
      */}
      <Pagination
        prevHref={cursor ? '/avisos' : undefined}
        nextHref={nextCursor ? `/avisos?cursor=${encodeURIComponent(nextCursor)}` : undefined}
      />
    </section>
  )
}
