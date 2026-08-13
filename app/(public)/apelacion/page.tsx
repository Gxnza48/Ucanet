/**
 * app/(public)/apelacion/page.tsx — apelar una decisión de moderación
 * (§0.5-R15, PART 11 §11.5.2, D7).
 *
 * Requiere sesión y nada más. `requireUser()` y no `requireProfile()` a
 * propósito: una cuenta suspendida o baneada tiene que poder llegar hasta acá —
 * la restricción corta la participación, no el debido proceso. Lo mismo vale
 * para una cuenta sin onboarding terminado: si tiene una decisión encima, puede
 * apelarla sin que la manden a elegir seudónimo primero.
 *
 * El id de la acción de moderación llega por query. El nombre del parámetro es
 * `accion` y lo fija quien enlaza: `features/notifications/queries.ts` arma
 * `/apelacion?accion=<mod_action_id>` para el aviso de la sanción. Sin id no hay
 * nada que apelar y el formulario lo dice: cada apelación cuelga de una decisión
 * concreta (una por decisión, `appeals.mod_action_id` es UNIQUE en la migración
 * 0008).
 *
 * El id de `mod_actions` es un bigint interno y acá sí viaja al navegador: no es
 * contenido público con `public_id` propio, es el número que la propia persona
 * recibió en su aviso, y `create_appeal` vuelve a verificar que quien apela sea
 * el destinatario de esa acción (`is_appeal_appellant`). Enumerarlo no sirve de
 * nada.
 *
 * Dinámica y noindex: pantalla detrás de sesión, sin nada que indexar (§23.1).
 */
import type { Metadata } from 'next'
import Link from 'next/link'

import { AppealForm } from '@/features/mod/components/appeal-form'
import { SITE_NAME } from '@/lib/config'
import { requireUser } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** Lo fija `features/notifications/queries.ts` al armar el link desde el aviso. */
const APPEAL_PARAM = 'accion'

type PageSearchParams = { [key: string]: string | string[] | undefined }

type PageProps = {
  searchParams: Promise<PageSearchParams>
}

export const metadata: Metadata = {
  title: { absolute: `Apelar una decisión | ${SITE_NAME}` },
  description: 'Pedí la revisión de una decisión de moderación.',
  robots: { index: false, follow: false },
}

/** El id de la acción de moderación, o `undefined` si no vino o no es un entero positivo. */
function readModActionId(params: PageSearchParams): number | undefined {
  const raw = params[APPEAL_PARAM]
  if (typeof raw !== 'string') return undefined

  const parsed = Number.parseInt(raw, 10)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined
}

export default async function ApelacionPage({ searchParams }: PageProps) {
  // Redirige a /ingresar?next=/apelacion cuando no hay sesión.
  await requireUser()

  const sp = await searchParams
  const modActionId = readModActionId(sp)

  return (
    <div className="mx-auto w-full max-w-170 py-6">
      <header>
        <h1 className="font-serif text-2xl font-semibold text-text-primary">Apelar una decisión</h1>
        <p className="mt-2 text-m text-text-secondary">
          Si creés que nos equivocamos, contanos por qué. La revisa una persona distinta de la que
          tomó la decisión.
        </p>
      </header>

      <ul className="mt-5 flex flex-col gap-2 border-y border-border py-4 text-s text-text-secondary">
        <li>Se apela una sola vez por decisión.</li>
        <li>Tenés 30 días desde que se tomó.</li>
        <li>Te avisamos el resultado en tus avisos.</li>
      </ul>

      <div className="mt-6">
        <AppealForm modActionId={modActionId} />
      </div>

      <p className="mt-6 border-t border-border pt-4 text-s text-text-secondary">
        Antes de escribir, mirá las{' '}
        <Link
          href="/reglas"
          className="font-semibold text-accent transition-colors duration-150 ease-out hover:text-accent-hover hover:underline"
        >
          reglas de la comunidad
        </Link>
        : ahí está qué se modera y con qué criterio.
      </p>
    </div>
  )
}
