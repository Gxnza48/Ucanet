/**
 * features/auth/components/handle-suggestions.ts — el generador de seudónimos sugeridos
 * (PART 9 §9.4.3, PART 6 §6.1 S3).
 *
 * Tres sugerencias regenerables, del registro de la cultura estudiantil rosarina:
 * "MateConBizcochos", "FiscalDelTercerPiso", "SextoIntento", "CursadaRepetida". No es
 * decoración: el generador fija el tono con el que la comunidad se va a nombrar. Elegir a
 * mano siempre se puede — esto es solo la primera propuesta.
 *
 * Propiedades que este módulo garantiza:
 *   · Función pura y determinística: la misma semilla devuelve exactamente las mismas
 *     sugerencias, en el servidor y en el navegador. Sin `Math.random`, sin `Date.now`,
 *     sin estado global — por eso el formulario puede pre-llenar el input en el render del
 *     servidor sin que la hidratación se queje.
 *   · Sin dependencias: solo `LIMITS` de lib/config, para que el largo máximo no se
 *     desincronice del CHECK de `profiles.handle`.
 *   · Salida siempre válida: `^[a-zA-Z0-9_]{3,24}$` con al menos una letra (§0.5-R8).
 *     Todas las palabras son ASCII a propósito (nada de acentos ni eñes: el charset del
 *     handle no los admite porque los seudónimos viven en `/u/[handle]`).
 *   · Segura contra la blocklist por construcción (PART 9 §9.4.3): toda salida es la unión
 *     de dos palabras de estas listas, así que nunca coincide —ni en su forma normalizada
 *     leet— con `moderador`, `anonimo`, `uca` y compañía, ni empieza con los prefijos que el
 *     sistema se reserva (`estudiante_`, `usuario_eliminado_`).
 */
import { LIMITS } from '@/lib/config'

// ---------------------------------------------------------------------------
// Vocabulario. La concordancia de género está horneada en las listas: es más
// simple y más legible que cualquier motor de flexión.
// ---------------------------------------------------------------------------

const NOMBRES_M = [
  'Mate',
  'Termo',
  'Apunte',
  'Parcial',
  'Final',
  'Promedio',
  'Bedel',
  'Fiscal',
  'Pasillo',
  'Coloquio',
  'Resumen',
  'Anotador',
  'Cuaderno',
  'Colectivo',
  'Kiosco',
  'Ascensor',
  'Marcador',
  'Cronograma',
  'Recuperatorio',
  'Borrador',
  'Alfajor',
  'Bizcocho',
] as const

const ADJETIVOS_M = [
  'Lavado',
  'Sufrido',
  'Perdido',
  'Prestado',
  'Repetido',
  'Silencioso',
  'Nocturno',
  'Puntual',
  'Tardio',
  'Optimista',
  'Aprobado',
  'Colgado',
  'Tranquilo',
  'Urgente',
  'Insomne',
  'Vencido',
] as const

const NOMBRES_F = [
  'Birome',
  'Carpeta',
  'Fotocopia',
  'Libreta',
  'Silla',
  'Mesa',
  'Cursada',
  'Guia',
  'Consigna',
  'Ventana',
  'Escalera',
  'Servilleta',
  'Cafetera',
  'Pizarra',
  'Agenda',
  'Bibliografia',
] as const

const ADJETIVOS_F = [
  'Lavada',
  'Sufrida',
  'Perdida',
  'Prestada',
  'Repetida',
  'Silenciosa',
  'Nocturna',
  'Puntual',
  'Tardia',
  'Optimista',
  'Aprobada',
  'Colgada',
  'Tranquila',
  'Urgente',
  'Insomne',
  'Vencida',
] as const

/** Colas que funcionan con cualquier género: son las que dan el sabor local. */
const COMPLEMENTOS = [
  'DeTurno',
  'DelFondo',
  'DelPasillo',
  'ConBizcochos',
  'DelTercerPiso',
  'DeLaManana',
  'DeMadrugada',
  'SinResumen',
  'SinDormir',
  'ConApuntes',
  'DeLaCatedra',
  'DeUltimoMomento',
  'DelAula3',
  'EnLibre',
  'AlLimite',
  'DeVerano',
] as const

const ORDINALES_M = ['Segundo', 'Tercer', 'Cuarto', 'Quinto', 'Sexto', 'Septimo'] as const
const NUCLEOS_M = [
  'Intento',
  'Parcial',
  'Final',
  'Turno',
  'Recuperatorio',
  'Coloquio',
  'Cuatrimestre',
] as const

const ORDINALES_F = ['Segunda', 'Tercera', 'Cuarta', 'Quinta', 'Sexta'] as const
const NUCLEOS_F = ['Fila', 'Mesa', 'Cursada', 'Semana', 'Consigna', 'Fecha'] as const

/** Última red: si todo lo demás fallara, esto sigue siendo un handle válido. */
const RESERVA = 'MateLavado'

// ---------------------------------------------------------------------------
// Azar determinístico: FNV-1a para convertir la semilla en un entero, mulberry32
// para la secuencia. Treinta líneas de aritmética entera, cero dependencias.
// ---------------------------------------------------------------------------

function semillaNumerica(semilla: string | number): number {
  const texto = String(semilla)
  let hash = 0x811c9dc5
  for (let i = 0; i < texto.length; i += 1) {
    hash ^= texto.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function generador(semilla: number): () => number {
  let estado = semilla >>> 0
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0
    let t = estado
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type ListaNoVacia = readonly [string, ...string[]]

function elegir(lista: ListaNoVacia, azar: () => number): string {
  return lista[Math.floor(azar() * lista.length)] ?? lista[0]
}

/**
 * Pega una cola a la base respetando el máximo de 24 caracteres. Si la primera elegida no
 * entra, recorre la lista desde ahí en vez de reintentar al azar: así el resultado sigue
 * siendo determinístico y siempre termina.
 */
function pegar(base: string, colas: ListaNoVacia, azar: () => number): string {
  const inicio = Math.floor(azar() * colas.length)
  for (let i = 0; i < colas.length; i += 1) {
    const cola = colas[(inicio + i) % colas.length]
    if (cola !== undefined && base.length + cola.length <= LIMITS.handleMax) return base + cola
  }
  return base
}

/** Un candidato de cualquiera de los cinco patrones. */
function componer(azar: () => number): string {
  switch (Math.floor(azar() * 5)) {
    case 0:
      return pegar(elegir(NOMBRES_M, azar), ADJETIVOS_M, azar)
    case 1:
      return pegar(elegir(NOMBRES_F, azar), ADJETIVOS_F, azar)
    case 2:
      return pegar(elegir(ORDINALES_M, azar), NUCLEOS_M, azar)
    case 3:
      return pegar(elegir(ORDINALES_F, azar), NUCLEOS_F, azar)
    default:
      return pegar(
        azar() < 0.5 ? elegir(NOMBRES_M, azar) : elegir(NOMBRES_F, azar),
        COMPLEMENTOS,
        azar,
      )
  }
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Devuelve `count` seudónimos sugeridos, distintos entre sí, siempre los mismos para la
 * misma semilla. La semilla puede ser cualquier cosa estable: el id del usuario, un contador
 * de "Probar otro", o los dos concatenados.
 */
export function suggestHandles(semilla: string | number, count = 3): string[] {
  const cantidad = Math.max(1, Math.min(12, Math.trunc(count)))
  const azar = generador(semillaNumerica(semilla))

  const sugerencias: string[] = []
  const vistos = new Set<string>()

  for (let intento = 0; intento < cantidad * 12 && sugerencias.length < cantidad; intento += 1) {
    const candidato = componer(azar)
    const clave = candidato.toLowerCase()
    if (vistos.has(clave)) continue
    vistos.add(clave)
    sugerencias.push(candidato)
  }

  // Relleno acotado por si el azar repitió demasiado: base recortada + número.
  for (let sufijo = 2; sugerencias.length < cantidad && sufijo < 100; sufijo += 1) {
    const base = (sugerencias[0] ?? RESERVA).slice(0, LIMITS.handleMax - 2)
    const candidato = `${base}${sufijo}`
    const clave = candidato.toLowerCase()
    if (vistos.has(clave)) continue
    vistos.add(clave)
    sugerencias.push(candidato)
  }

  return sugerencias
}

/** Una sola sugerencia: lo que pre-llena el input del onboarding. */
export function suggestHandle(semilla: string | number): string {
  return suggestHandles(semilla, 1)[0] ?? RESERVA
}
