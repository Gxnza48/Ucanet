'use client'

/**
 * app/global-error.tsx — la última red (PART 17 §17.5.6).
 *
 * Solo entra cuando lo que falló es el layout raíz: por eso reemplaza el documento
 * completo y tiene que traer sus propios `<html>` y `<body>`. Nada de lo que arma
 * `app/layout.tsx` está disponible acá — ni el header, ni el pie, ni la fuente, ni
 * el `data-theme` de la cookie.
 *
 * Importa `globals.css` para no quedar como texto pelado del navegador: sin el
 * atributo `data-theme`, los tokens caen en `prefers-color-scheme`, que es
 * exactamente el comportamiento correcto cuando no se pudo leer la preferencia.
 *
 * `lang="es-AR"` se repite acá porque este `<html>` no es el del layout (§17.7).
 */
import './globals.css'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="es-AR">
      <body>
        <main className="mx-auto w-full max-w-170 px-4 py-6">
          <h1 className="font-serif text-xl font-semibold text-text-primary">
            El sitio no pudo cargar.
          </h1>

          <p className="mt-3 text-base text-text-secondary">
            Fue un error nuestro, no tuyo. Probá de nuevo en unos segundos.
          </p>

          <div className="mt-6">
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-11 cursor-pointer items-center justify-center rounded-input border border-accent bg-accent px-4 text-m font-semibold text-on-accent lg:h-9"
            >
              Probá de nuevo
            </button>
          </div>

          {error.digest ? (
            <p className="mt-6 text-s text-text-secondary">Referencia del error: {error.digest}</p>
          ) : null}
        </main>
      </body>
    </html>
  )
}
