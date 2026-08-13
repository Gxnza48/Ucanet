import 'server-only'

/**
 * features/auth/queries.ts — lecturas de identidad y cuenta (BUILD-CONTRACT §4.5).
 *
 * Dos lecturas y un ayudante de catálogo:
 *   getInvite(code)      → validación de solo lectura del código, ANTES de crear nada (§0.5-R18).
 *   getSettings()        → todo lo que necesita /ajustes en un solo viaje.
 *   getCarreraOptions()  → el select de carrera del onboarding y de /ajustes.
 *
 * `getCarreraOptions` vive acá y no en features/materias porque una feature nunca importa
 * otra (BUILD-CONTRACT §2): el onboarding es de esta feature y necesita el catálogo. Son dos
 * lecturas planas sobre tablas públicas (`read_all` en la migración 0002), no lógica de materias.
 */
import { createClient, requireProfile, type ProfileRow } from '@/lib/supabase/server'

/** Una carrera lista para pintar en un `<select>` agrupado por facultad (PART 6 §6.1 S4). */
export type CarreraOption = {
  id: number
  slug: string
  nombre: string
  facultad: string
}

/** Cooldown de renombre, en días (D3 / PART 9 §9.5). Espeja el `interval '90 days'` de `rename_handle`. */
const HANDLE_COOLDOWN_DIAS = 90

/**
 * PART 6 §6.1 S1, texto exacto del borde. Es el mismo mensaje para código inexistente,
 * vencido, revocado y agotado: no hay oráculo que le diga a un bot cuál de las cuatro cosas pasó.
 */
const INVITE_INVALIDA =
  'Este link de invitación ya se usó o venció. Pedile uno nuevo a quien te invitó, o anotate en la lista de espera.'

/**
 * Valida un código de invitación sin consumirlo (§0.5-R18, PART 9 §9.2.1 paso 3).
 *
 * Va por `check_invite` (migración 0011), que es SECURITY DEFINER y está otorgada a `anon`
 * justamente porque quien abre `/invitacion/[code]` todavía no tiene cuenta. Leer `invites`
 * directo desde acá NO funciona: la migración 0003 hace `revoke all from anon, authenticated`
 * y sus dos políticas (`select_own`, `select_admin`) solo muestran las invitaciones propias o
 * todas si sos admin — un visitante sin sesión no ve ninguna fila y cualquier código con la
 * forma correcta pasaría como válido.
 *
 * La RPC devuelve `{"valid": bool, "reason": text}` con `reason` en (formato, inexistente,
 * revocada, vencida, agotada). Esos motivos NO se muestran: los cuatro estados rotos comparten
 * el mismo texto para no darle a un bot un oráculo con el que barrer códigos.
 *
 * Si la RPC no responde (red, proyecto pausado) se devuelve válida y la decisión queda donde
 * §0.5-R18 la pone igual: `handle_new_user` consume el código de forma atómica y aborta el
 * alta entera con INVITE_INVALID si no sirve. Nunca se acepta un alta que la base rechazaría.
 */
export async function getInvite(code: string): Promise<{ valid: boolean; reason?: string }> {
  const normalizado = code.trim().toLowerCase()

  if (!/^[a-z0-9]{8}$/.test(normalizado)) {
    return { valid: false, reason: INVITE_INVALIDA }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('check_invite', { p_code: normalizado })

  // Sin respuesta utilizable: la palabra final la tiene el trigger del alta.
  if (error) return { valid: true }

  const esObjeto = typeof data === 'object' && data !== null && !Array.isArray(data)
  if (!esObjeto) return { valid: true }

  return data.valid === true ? { valid: true } : { valid: false, reason: INVITE_INVALIDA }
}

/**
 * Todo lo que /ajustes necesita: el perfil propio, el catálogo de carreras para el select y
 * si el seudónimo se puede cambiar hoy (PART 17 §17.4.8).
 *
 * `requireProfile()` redirige a /ingresar o a /registro/continuar cuando corresponde, así que
 * acá el perfil siempre existe y está onboardeado.
 */
export async function getSettings(): Promise<{
  profile: ProfileRow
  carreras: CarreraOption[]
  canRename: boolean
  renameAvailableAt: string | null
}> {
  const [profile, carreras] = await Promise.all([requireProfile(), getCarreraOptions()])

  // handle_changed_at nulo = nunca renombró: la primera elección del onboarding es gratis y
  // el cooldown recién empieza en el primer rename real (migración 0011, complete_onboarding).
  const cambiadoEn = profile.handle_changed_at
  if (cambiadoEn === null) {
    return { profile, carreras, canRename: true, renameAvailableAt: null }
  }

  const disponibleEn = new Date(cambiadoEn)
  disponibleEn.setDate(disponibleEn.getDate() + HANDLE_COOLDOWN_DIAS)
  const canRename = disponibleEn.getTime() <= Date.now()

  return {
    profile,
    carreras,
    canRename,
    renameAvailableAt: canRename ? null : disponibleEn.toISOString(),
  }
}

/**
 * Catálogo de carreras para los selects, ordenado por facultad y después por nombre.
 *
 * Son dos lecturas planas en vez de un embed PostgREST a propósito: el catálogo entero son
 * decenas de filas, el join en memoria es gratis y así los tipos salen directo de types.gen.ts
 * sin depender de cómo infiere supabase-js las relaciones anidadas.
 */
export async function getCarreraOptions(): Promise<CarreraOption[]> {
  const supabase = await createClient()

  const [carreras, facultades] = await Promise.all([
    supabase.from('carreras').select('id, slug, nombre, facultad_id').order('nombre'),
    supabase.from('facultades').select('id, nombre').order('nombre'),
  ])

  if (carreras.error || !carreras.data || facultades.error || !facultades.data) return []

  const nombreDeFacultad = new Map(facultades.data.map((f) => [f.id, f.nombre]))

  return carreras.data
    .map((carrera) => ({
      id: carrera.id,
      slug: carrera.slug,
      nombre: carrera.nombre,
      facultad: nombreDeFacultad.get(carrera.facultad_id) ?? 'Otras carreras',
    }))
    .sort(
      (a, b) =>
        a.facultad.localeCompare(b.facultad, 'es-AR') || a.nombre.localeCompare(b.nombre, 'es-AR'),
    )
}
