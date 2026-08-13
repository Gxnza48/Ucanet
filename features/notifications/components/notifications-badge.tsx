/**
 * features/notifications/components/notifications-badge.tsx — el contador del
 * header y de la barra móvil (PART 17 §17.4.7, §0.5-R14).
 *
 * Server Component asíncrono: cuenta los no leídos con la sesión del que mira y
 * renderiza el `Badge` del design system, que ya recorta en "9+" y no dibuja nada
 * cuando el número es cero. Sin JS, sin polling, sin realtime: el badge se refresca
 * cuando el usuario navega, que es exactamente el modelo de chequeo ambiental de
 * dos minutos del §0.1.
 *
 * `count` se puede pasar cuando el que envuelve ya lo tiene (por ejemplo la propia
 * página de `/avisos`) y así se evita la segunda consulta.
 */
import { Badge } from '@/components/ui/badge'
import { getUnreadCount } from '../queries'

export async function NotificationsBadge({
  count,
  className,
}: {
  count?: number
  className?: string
}) {
  const unread = count ?? (await getUnreadCount())
  return <Badge count={unread} label="avisos sin leer" className={className} />
}
