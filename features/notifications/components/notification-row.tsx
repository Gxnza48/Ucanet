/**
 * features/notifications/components/notification-row.tsx — una fila de `/avisos`
 * (PART 17 §17.4.7).
 *
 * Server Component: la lista de avisos no lleva JS de ruta. Un aviso sin leer se
 * distingue por dos cosas y nada más — un punto de 6 px en color acento a la
 * izquierda del texto y fondo `--color-surface-raised`. Los leídos se quedan en la
 * lista, en gris: la página se marca leída al visitarla, así que una fila que
 * desaparece al mirarla castigaría justamente al que entró a mirar.
 *
 * El texto ya viene redactado del servidor (`queries.ts`), armado con el `type` y
 * el `actor_display` congelado al insertar. Acá no se recalcula nada del actor: es
 * la garantía de que un aviso jamás puede filtrar quién escribió como anónimo.
 */
import Link from 'next/link'

import { ListRow } from '@/components/ui/list-row'
import { cn } from '@/lib/cn'
import { relativeTime } from '@/lib/utils/dates'
import type { NotificationItem } from '../queries'

function UnreadDot() {
  // 6 px exactos (§17.4.7): media unidad de la base de 4 px, sin valores arbitrarios.
  return (
    <span
      aria-hidden="true"
      className="mr-2 inline-block size-1.5 shrink-0 rounded-input bg-accent align-middle"
    />
  )
}

function Text({ item }: { item: NotificationItem }) {
  return (
    <span className="font-normal">
      {item.read ? null : <UnreadDot />}
      {item.text}
      {item.read ? null : <span className="sr-only"> (sin leer)</span>}
    </span>
  )
}

export function NotificationRow({ item }: { item: NotificationItem }) {
  const time = (
    <time dateTime={item.createdAt} className="text-s text-text-secondary">
      {relativeTime(item.createdAt)}
    </time>
  )

  if (item.href) {
    return (
      <ListRow
        href={item.href}
        title={<Text item={item} />}
        trailing={time}
        className={cn(item.read ? null : 'bg-surface-raised')}
      />
    )
  }

  // Los cierres de reporte no llevan a ningún lado: el denunciante recibe el
  // resultado, no un enlace de vuelta al contenido (§11.3.4).
  return (
    <li
      className={cn(
        'border-b border-border py-3 text-base text-text-primary',
        item.read ? null : 'bg-surface-raised',
      )}
    >
      <Text item={item} />
      <div className="mt-2">{time}</div>
    </li>
  )
}

/**
 * Enlace de cabecera "Marcar todo como leído". Es un link a la propia página y no
 * un botón porque la visita a `/avisos` ya marca todo: sirve de refuerzo visible
 * sin costar JS.
 */
export function MarkAllReadLink({ className }: { className?: string }) {
  return (
    <Link
      href="/avisos"
      className={cn(
        'text-m font-semibold text-accent hover:text-accent-hover hover:underline',
        className,
      )}
    >
      Marcar todo como leído
    </Link>
  )
}
