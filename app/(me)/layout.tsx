/**
 * app/(me)/layout.tsx — la caja de `/avisos` y `/ajustes` (D7, PART 17 §17.1.1).
 *
 * Guard único del grupo: `requireProfile()`. Es más fuerte que "hay sesión" a propósito —
 * redirige a `/ingresar?next=<destino>` sin sesión y a `/registro/continuar` cuando la cuenta
 * existe pero sigue en `status = 'nuevo'`. Las dos páginas de acá le hablan a una persona con
 * seudónimo elegido: `/ajustes` lo muestra y lo hace cambiar, y `/avisos` de una cuenta a medio
 * crear está siempre vacío.
 *
 * NO redirige por cuenta suspendida, baneada ni eliminada: esas cuentas conservan el derecho a
 * leer sus avisos, apelar y borrarse (PART 9 §9.9, PART 11 §11.8). El corte de escritura lo
 * hace `assert_can_write()` adentro de cada RPC, que es donde no se puede saltear.
 *
 * El guard del layout no reemplaza al de cada página: en una navegación de cliente dentro del
 * mismo grupo el layout no se vuelve a ejecutar. `/ajustes` vuelve a exigir perfil por
 * `getSettings()` y `/avisos` acota por sesión en la consulta. Esto es la primera capa, no la
 * única.
 *
 * Ancho 680px (`max-w-170` con la base de 4px): la columna de contenido de §17.1.1. El header,
 * el pie y el `<main>` los pone el esqueleto general, una sola vez.
 */
import type { ReactNode } from 'react'

import { requireProfile } from '@/lib/supabase/server'

export default async function MeLayout({ children }: { children: ReactNode }) {
  await requireProfile()

  return <div className="mx-auto w-full max-w-170 py-6">{children}</div>
}
