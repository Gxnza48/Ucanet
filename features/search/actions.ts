'use server'

import 'server-only'

/**
 * features/search/actions.ts — el único puente cliente → servidor de la búsqueda.
 *
 * El typeahead (PART 13 §13.6) es un componente de cliente y no puede importar
 * `queries.ts`, que es `server-only`. El mapa de rutas (D7) no tiene endpoint de
 * sugerencias, así que el canal es una Server Action de sólo lectura: recibe el
 * término, devuelve como mucho 8 materias. No escribe nada, no toca la sesión más
 * allá de la que ya trae la request y no registra la consulta — el typeahead no es
 * una búsqueda (`search_queries` sólo se escribe desde `searchAll`).
 */
import { suggestMaterias, type MateriaHit } from './queries'

export async function suggestMateriasAction(q: string): Promise<MateriaHit[]> {
  if (typeof q !== 'string') return []
  return suggestMaterias(q)
}
