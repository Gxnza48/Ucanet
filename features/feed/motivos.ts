/**
 * features/feed/motivos.ts — por qué "Para vos" te muestra cada fila (PART 12 §12.3).
 *
 * POR QUÉ ESTE ARCHIVO EXISTE Y NO ES PARTE DE `queries.ts`, por la misma razón exacta que
 * `ranking.ts`: `queries.ts` abre con `import 'server-only'`, y ese paquete TIRA apenas se lo
 * importa desde el bundle del navegador. El rótulo del motivo lo tiene que poder resolver
 * también el cliente —`feed-infinite.tsx` recibe filas nuevas por Server Action y las
 * renderiza sin volver al servidor—, así que el copy vive acá: cero imports, cero efectos,
 * un objeto congelado y una función pura. `queries.ts` lo reexporta para que el resto de la
 * aplicación lo consuma desde un solo lugar.
 *
 * ESTO NO ES DECORACIÓN. Un feed personalizado que no dice por qué te muestra algo es una
 * caja negra, y una caja negra es exactamente el producto que uca.net no quiere ser (D8). El
 * compromiso que /acerca publica es que el orden se pueda explicar en una línea; estas cuatro
 * líneas SON esa explicación, fila por fila. Si alguna vez hay un motivo que no se puede
 * escribir en cinco palabras honestas, el problema es el motivo, no el rótulo.
 */

/**
 * Los cuatro canales de "Para vos". El union es cerrado: lo decide `feed_para_vos` y una
 * fila que llegue con cualquier otro valor se renderiza SIN motivo, nunca con el texto crudo
 * de la base.
 *
 * - `seguis`         viene de una materia que el lector sigue. La señal más fuerte y explícita.
 * - `te_interesa`    se parece a lo que el lector viene leyendo o comentando.
 * - `tu_carrera`     es de su carrera, sin materia etiquetada.
 * - `descubrimiento` no cae en ninguna de las anteriores: la cuota que impide que el feed se
 *                    cierre sobre sí mismo. Sin esta cuarta, "Para vos" sería un espejo.
 */
export type FeedMotivo = 'seguis' | 'te_interesa' | 'tu_carrera' | 'descubrimiento'

/**
 * El rótulo visible, en la línea de meta de la fila. Copy corto y sobrio: la fila ya está
 * densa (D8) y esto es contexto, no título. Sin emoji, sin "porque", sin signos de admiración
 * (D9 y el anti-checklist de §17.8). Voseo donde corresponde: "que seguís".
 */
export const MOTIVO_LABEL: Record<FeedMotivo, string> = {
  seguis: 'De una materia que seguís',
  te_interesa: 'Parecido a lo que te interesa',
  tu_carrera: 'De tu carrera',
  descubrimiento: 'Para descubrir',
}

/** Type guard contra el `text` crudo de la RPC. Fuera del union, no hay motivo. */
export function isMotivo(value: string): value is FeedMotivo {
  return Object.hasOwn(MOTIVO_LABEL, value)
}

/**
 * `text | null` de Postgres → `FeedMotivo | undefined`.
 *
 * Un valor desconocido se descarta callado: que la RPC agregue un canal antes que la UI no
 * puede traducirse en una fila con un rótulo que nadie escribió en es-AR.
 */
export function toMotivo(value: string | null | undefined): FeedMotivo | undefined {
  return typeof value === 'string' && isMotivo(value) ? value : undefined
}
