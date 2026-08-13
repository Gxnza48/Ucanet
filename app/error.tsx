'use client'

/**
 * app/error.tsx — la barrera de error de la aplicación (PART 17 §17.5.6).
 *
 * Next exige que sea Client Component: `reset()` vuelve a montar el segmento que
 * falló sin recargar la página, y eso es interactividad. Es la única excepción a la
 * lista blanca de PART 19 §19.3, y viene impuesta por el framework.
 *
 * El chrome (header, pie, barra inferior) sobrevive: esta barrera está POR DENTRO
 * del layout raíz, así que quien se comió el error sigue teniendo navegación. El
 * que reemplaza el documento entero es `global-error.tsx`, y solo se usa cuando lo
 * que se rompió es el layout raíz mismo.
 *
 * No se muestra el mensaje del error: en producción React lo reemplaza por uno
 * genérico igual, y filtrar internas a la pantalla no ayuda a nadie. Lo que sí sirve
 * es el `digest`, que es la referencia con la que se encuentra el error en los logs.
 */
import { Button, ButtonLink } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="w-full max-w-170 py-6">
      <h1 className="font-serif text-xl font-semibold text-text-primary">
        Se nos rompió algo al cargar esta página.
      </h1>

      <p className="mt-3 text-base text-text-secondary">
        No es culpa tuya. Probá de nuevo; si vuelve a pasar, escribinos contando qué estabas
        haciendo.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button onClick={reset}>Probá de nuevo</Button>
        <ButtonLink href="/" variant="secondary">
          Ir al inicio
        </ButtonLink>
      </div>

      {error.digest ? (
        <p className="mt-6 text-s text-text-secondary">Referencia del error: {error.digest}</p>
      ) : null}
    </div>
  )
}
