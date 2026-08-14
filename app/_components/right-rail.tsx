/**
 * app/_components/right-rail.tsx — el riel derecho (PART 17 §17.1.1).
 *
 * 300px, alineado arriba y NO pegajoso: un riel que persigue el scroll es
 * decoración; este es contexto que se consulta y se deja (§17.1.1).
 *
 * El primer bloque es permanente en TODAS las páginas: "Explorar". No es adorno —
 * es el camino de alcanzabilidad de los índices en escritorio (§0.5-R19). Sin
 * columna izquierda y con un header de cinco slots, `/materias` y `/recursos`
 * quedarían a dos clics; con este bloque están a uno, igual que en la barra
 * inferior de mobile.
 *
 * "Archivo" (`/archivo`) es el tercer renglón de ese bloque en el plan, y entra
 * cuando exista la ruta en P3 (D2, D7). Está comentado abajo, en su lugar exacto,
 * para que agregarlo sea descomentar una línea y no redescubrir la decisión.
 *
 * Los bloques específicos de cada página (materia, publicación, home) los pasa la
 * página como `children`: el riel es el encuadre, no el catálogo de contenidos.
 * Renderizarlo o no en mobile también lo decide la página (§17.6: se descarta en
 * la home y baja debajo del contenido en materia y publicación).
 *
 * ---------------------------------------------------------------------------------
 * LOS DOS BLOQUES QUE VIENEN POR PROP Y NO POR `children` (2026-08-14)
 * ---------------------------------------------------------------------------------
 * "Tendencias" y "Materias para seguir" son la dieta del riel en la home de uso
 * diario, y entran como props tipadas en vez de `children` por tres razones que
 * `children` no puede dar:
 *
 *   1. La FORMA queda fija. Un renglón de tendencia es título + cantidad de
 *      comentarios, y una sugerencia es nombre + slug: pasando datos, todas las
 *      páginas los dibujan igual. Pasando JSX, cada página inventa su variante.
 *   2. Las dos reglas duras —se omite el bloque entero si viene vacío, y nunca más
 *      de cinco renglones— se cumplen en un solo lugar. Con `children` habría que
 *      confiar en que cada llamador se acuerde de las dos.
 *   3. Se lee de un vistazo que el riel NO CONSULTA LA BASE. No hay imports de
 *      features acá y no los va a haber: los datos los trae la página, que ya está
 *      pagando su propia consulta. Un riel que consulta por su cuenta agrega una
 *      lectura por página en el camino caliente (PART 21) y se vuelve imposible de
 *      cachear con el resto.
 *
 * No hay esqueletos ni "cargando": si todavía no hay datos, el bloque no existe.
 * Un hueco gris que promete contenido es la estética de dashboard que §5 prohíbe, y
 * §17.5.4 prohíbe además el desplazamiento de layout que traería al llegar.
 *
 * ORDEN: "Explorar" (permanente) → estos dos → `children`. Los bloques de la página
 * van últimos porque todas las páginas cierran su riel con el bloque de enlaces del
 * sitio ("Reglas · Acerca de"), que por convención es el último de la columna.
 */
import Link from 'next/link'
import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * Tope de renglones de los bloques de datos: cinco (§17.1.1, que fija cinco para
 * "Actividad" y la misma densidad para el resto). El recorte se hace acá, no en la
 * página: es la garantía de que el riel no crece aunque quien llame se distraiga.
 */
const RAIL_ROWS = 5

/** Una publicación del bloque "Tendencias". Sin ids internos: sólo lo que se pinta (D14.7). */
export type RailTendencia = {
  /** nanoid de 10 caracteres; es la URL: `/p/[publicId]`. */
  publicId: string
  /** Ya resuelto por la página: el título propio o el recorte del cuerpo. */
  title: string
  commentsCount: number
}

/** Una materia del bloque "Materias para seguir". */
export type RailMateriaSugerida = {
  slug: string
  nombre: string
}

/** Renglón compacto del riel: un enlace de una línea, con meta opcional a la derecha. */
export function RailLink({
  href,
  children,
  meta,
}: {
  href: string
  children: ReactNode
  meta?: ReactNode
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-11 items-center justify-between gap-3 rounded-input py-1 text-m text-text-primary hover:text-accent lg:min-h-8"
      >
        <span className="min-w-0 truncate">{children}</span>
        {meta ? <span className="shrink-0 text-s text-text-secondary">{meta}</span> : null}
      </Link>
    </li>
  )
}

/** Bloque del riel: rótulo de 13px en secundario y debajo los renglones. */
export function RailSection({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('mt-6 first:mt-0', className)}>
      <h2 className="text-s font-semibold text-text-secondary">{title}</h2>
      <ul className="mt-2">{children}</ul>
    </section>
  )
}

export function RightRail({
  children,
  className,
  tendencias,
  materiasSugeridas,
}: {
  children?: ReactNode
  className?: string
  /**
   * Lo que más se mueve ahora, ya ordenado por quien llama (`feed_tendencias` las
   * devuelve en orden). Se recortan a cinco; vacío o ausente, el bloque no se dibuja.
   */
  tendencias?: readonly RailTendencia[]
  /**
   * Materias de la carrera del lector que todavía no sigue. Mismo trato: hasta cinco,
   * y sin nada que ofrecer no hay bloque. Quien no tiene sesión o ya las sigue todas
   * simplemente no lo ve — no hay estado vacío que escribir.
   */
  materiasSugeridas?: readonly RailMateriaSugerida[]
}) {
  const masMovidas = (tendencias ?? []).slice(0, RAIL_ROWS)
  const paraSeguir = (materiasSugeridas ?? []).slice(0, RAIL_ROWS)

  return (
    <aside aria-label="Contexto" className={cn('w-full lg:w-75 lg:shrink-0', className)}>
      <RailSection title="Explorar">
        <RailLink href="/materias">Materias</RailLink>
        <RailLink href="/recursos">Recursos</RailLink>
        {/* P3, cuando exista la ruta `/archivo` (D2, D7):
        <RailLink href="/archivo">Archivo</RailLink>
        */}
      </RailSection>

      {masMovidas.length > 0 ? (
        <RailSection title="Tendencias">
          {masMovidas.map((post) => (
            <RailLink
              key={post.publicId}
              href={`/p/${post.publicId}`}
              meta={comentarios(post.commentsCount)}
            >
              {post.title}
            </RailLink>
          ))}
        </RailSection>
      ) : null}

      {paraSeguir.length > 0 ? (
        <RailSection title="Materias para seguir">
          {paraSeguir.map((materia) => (
            <RailLink key={materia.slug} href={`/materias/${materia.slug}`}>
              {materia.nombre}
            </RailLink>
          ))}
        </RailSection>
      ) : null}

      {children}
    </aside>
  )
}

/**
 * "12 comentarios" · "1 comentario" · nada en cero.
 *
 * El cero es silencio, igual que en la fila del feed (§12.5 y el `trailing` de
 * `features/posts/components/post-row.tsx`): una tendencia puede estar subiendo por
 * votos, y "0 comentarios" no informa, ocupa. El separador de miles sale de es-AR.
 */
function comentarios(count: number): string | undefined {
  if (count <= 0) return undefined
  return `${count.toLocaleString('es-AR')} ${count === 1 ? 'comentario' : 'comentarios'}`
}
