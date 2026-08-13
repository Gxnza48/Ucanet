import type { MetadataRoute } from 'next'

import { absoluteUrl } from '@/lib/env'

/**
 * app/robots.ts — `/robots.txt` (PART 23 §23.5).
 *
 * La política es la de §23.1 en una línea: **el contenido se indexa, la identidad
 * no.** Lo que se bloquea acá no es "lo privado" (eso lo cierra la sesión, no un
 * archivo de texto que cualquiera lee): es lo que no tiene ningún valor de aterrizaje
 * y sí gastaría presupuesto de rastreo, más las URLs que jamás deben entrar en un
 * índice — los códigos de invitación, sobre todo.
 *
 * DOS DECISIONES QUE PARECEN ERRORES Y NO LO SON:
 *
 * 1. **`/u/` NO se bloquea** (§23.5, textual: "`/u/` is deliberately *not*
 *    disallowed"). Los perfiles van `noindex,follow` por meta tag, y para VER ese
 *    meta tag el crawler tiene que poder bajar la página. Un `Disallow: /u/` haría
 *    lo contrario de lo que parece: Google no leería el `noindex` y podría igual
 *    listar la URL pelada si la encuentra enlazada desde afuera, que es exactamente
 *    el escenario de linkeo que C16 quiere evitar. Bloquear acá empeora la privacidad
 *    del seudónimo, no la mejora.
 *
 * 2. **No hay reglas por bot de IA** (§23.5, [HUMAN DECISION] ratificada): ni GPTBot,
 *    ni ClaudeBot, ni Google-Extended, ni CCBot. La misión es ser la memoria pública
 *    y durable de la vida estudiantil de UCA (D1); estar en los índices de búsqueda
 *    con IA es el canal de descubrimiento de los años 30 igual que Google lo fue en
 *    los 10. El contenido ya es deliberadamente público y seudónimo. La postura está
 *    dicha en `/privacidad` para que nadie se entere por este archivo.
 *
 * Las previews de Vercel no se protegen desde acá: van con `X-Robots-Tag: noindex`
 * a nivel de deployment (§23.8 punto 7). Un robots.txt de preview igual dejaría
 * indexables las URLs enlazadas.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          // Rutas de máquina: nada acá tiene una versión HTML que valga la pena.
          '/api/',
          '/auth/',
          // Panel de moderación: nunca público (§23.1).
          '/mod/',
          // Superficies personales. Requieren sesión, así que un bot sólo vería el
          // redirect; el bloqueo ahorra el rastreo, no protege el dato.
          '/ajustes',
          '/avisos',
          '/apelacion',
          // Espacio de parámetros infinito: trampa clásica de presupuesto de rastreo.
          '/buscar',
          // Flujos de alta. `/invitacion/` es el importante: un código de invitación
          // dentro de un índice de búsqueda es una puerta abierta (§23.1).
          '/ingresar',
          '/registro',
          '/invitacion/',
        ],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  }
}
