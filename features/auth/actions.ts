'use server'

import 'server-only'

/**
 * features/auth/actions.ts — las Server Actions de identidad y cuenta (BUILD-CONTRACT §4.5).
 *
 * Todas siguen las cinco etapas obligatorias de BUILD-CONTRACT §4.6, en orden:
 *   1. `safeParse` del esquema de ./schemas
 *   2. leer la sesión del servidor (nunca confiar en lo que mandó el formulario)
 *   3. UNA sola RPC / escritura guardada por política
 *   4. revalidar
 *   5. devolver `ok()` o `fail(rpcErrorMessage(error))`
 *
 * Las que hablan con Supabase Auth (alta, ingreso, recuperación, cambio de contraseña) no
 * llaman ninguna RPC: la escritura la hace GoTrue y el trigger `handle_new_user` se encarga
 * del perfil y de consumir la invitación dentro de la misma transacción (§0.5-R18).
 *
 * Firma de formulario: `(prevState, formData) => Promise<ActionResult>`, compatible con
 * `useActionState` (React 19.2).
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { ZodError } from 'zod'
import { LIMITS } from '@/lib/config'
import { absoluteUrl } from '@/lib/env'
import { GENERIC_ERROR, messageForCode, rpcErrorMessage } from '@/lib/errors'
import { fail, ok, type ActionResult } from '@/lib/result'
import { createClient, getProfile, getUser } from '@/lib/supabase/server'
import { getInvite } from './queries'
import {
  deleteAccountSchema,
  handleSchema,
  notificationPrefsSchema,
  onboardingSchema,
  recoverSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  waitlistSchema,
} from './schemas'

// ---------------------------------------------------------------------------
// Ayudantes internos. Nada de esto se exporta: en un módulo 'use server' todo lo
// exportado es una acción invocable desde el navegador.
// ---------------------------------------------------------------------------

/** Texto de un campo del formulario, ya recortado. Los ausentes vuelven como ''. */
function campo(formData: FormData, nombre: string): string {
  const valor = formData.get(nombre)
  return typeof valor === 'string' ? valor.trim() : ''
}

/** Contraseñas SIN recortar: los espacios de los extremos son parte del secreto. */
function secreto(formData: FormData, nombre: string): string {
  const valor = formData.get(nombre)
  return typeof valor === 'string' ? valor : ''
}

/** Campo numérico opcional: '' y basura vuelven como undefined, no como NaN. */
function numeroOpcional(formData: FormData, nombre: string): number | undefined {
  const texto = campo(formData, nombre)
  if (texto === '') return undefined
  const valor = Number(texto)
  return Number.isFinite(valor) ? valor : undefined
}

/**
 * Primer problema de un `safeParse`, listo para `fail()`. Zod 4 se lee por `issues`
 * (BUILD-CONTRACT §0): nada de `.flatten()` ni `.format()`.
 */
function primerProblema<T>(error: ZodError<T>): ActionResult {
  const problema = error.issues[0]
  if (!problema) return fail(GENERIC_ERROR)
  const nombre = problema.path[0]
  return fail(problema.message, typeof nombre === 'string' ? nombre : undefined)
}

/**
 * Copy es-AR para los errores de Supabase Auth, que llegan en inglés y sin códigos estables.
 * Se buscan primero nuestros propios códigos: cuando `handle_new_user` levanta INVITE_INVALID,
 * GoTrue lo envuelve y suele reportarlo como un error genérico de base al crear el usuario —
 * en ese punto del alta el único trigger que puede fallar es el nuestro.
 */
function mensajeDeAuth(error: { message?: string } | null | undefined): string {
  const crudo = error?.message ?? ''
  if (crudo.includes('INVITE_INVALID') || /database error (saving|creating)/i.test(crudo)) {
    return messageForCode('INVITE_INVALID')
  }
  if (/already registered|already exists/i.test(crudo)) {
    return 'Ya existe una cuenta con ese correo. Podés ingresar desde acá.'
  }
  if (/rate limit|only request this after|too many/i.test(crudo)) {
    return 'Probaste demasiadas veces seguidas. Esperá unos minutos.'
  }
  if (/not confirmed/i.test(crudo)) {
    return 'Todavía no confirmaste tu correo. Buscá el mensaje que te mandamos.'
  }
  if (/password/i.test(crudo)) {
    return `La contraseña tiene que tener al menos ${LIMITS.passwordMin} caracteres.`
  }
  return GENERIC_ERROR
}

/**
 * Destino interno seguro para el redirect posterior al ingreso. Solo rutas relativas de una
 * sola barra: `//otro-sitio` y `/\otro-sitio` son redirecciones abiertas, no rutas nuestras.
 */
function destinoSeguro(valor: string): string {
  return /^\/[^/\\]/.test(valor) ? valor : '/'
}

// ---------------------------------------------------------------------------
// Alta, ingreso y salida
// ---------------------------------------------------------------------------

/**
 * Alta de cuenta — PART 6 §6.1 S1, PART 9 §9.2.1.
 *
 * El código de invitación se valida de SOLO LECTURA antes de crear nada y después viaja en
 * `options.data.invite_code`: el trigger `handle_new_user` (migración 0004) lo consume de
 * forma atómica con el `update ... returning` de §0.5-R18, en la misma transacción que crea
 * el usuario y el perfil. Ni un código puede sobrecanjearse ni puede quedar un usuario sin
 * invitación consumida.
 *
 * No redirige: devuelve `ok()` para que el formulario muestre el intersticial "Revisá tu
 * casilla" (PART 6 §6.1 S2). Con confirmación de correo obligatoria no hay sesión todavía.
 */
export async function signUp(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const codigo = campo(formData, 'inviteCode').toLowerCase()

  const parsed = signUpSchema.safeParse({
    email: campo(formData, 'email').toLowerCase(),
    password: secreto(formData, 'password'),
    inviteCode: codigo === '' ? undefined : codigo,
    terminos: formData.get('terminos') === 'on',
  })
  if (!parsed.success) return primerProblema(parsed.error)

  // §0.5-R18: validación previa de solo lectura. La palabra final la tiene el trigger.
  if (parsed.data.inviteCode !== undefined) {
    const invitacion = await getInvite(parsed.data.inviteCode)
    if (!invitacion.valid) {
      return fail(invitacion.reason ?? messageForCode('INVITE_INVALID'), 'inviteCode')
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Lo consume handle_new_user. Es el único dato de metadata que el alta manda.
      data: parsed.data.inviteCode !== undefined ? { invite_code: parsed.data.inviteCode } : {},
      emailRedirectTo: absoluteUrl(
        `/auth/callback?next=${encodeURIComponent('/registro/continuar')}`,
      ),
    },
  })

  if (error) return fail(mensajeDeAuth(error))

  return ok()
}

/**
 * Ingreso — PART 6 §6.1, PART 9 §9.2.2.
 *
 * El error nunca distingue correo inexistente de contraseña equivocada: el formulario de alta
 * ya es un oráculo de enumeración inevitable, el de ingreso no tiene por qué sumar otro.
 */
export async function signIn(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = signInSchema.safeParse({
    email: campo(formData, 'email').toLowerCase(),
    password: secreto(formData, 'password'),
  })
  if (!parsed.success) return fail('Correo o contraseña incorrectos.')

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    if (/not confirmed/i.test(error.message)) return fail(mensajeDeAuth(error))
    return fail('Correo o contraseña incorrectos.')
  }

  // La sesión cambia lo que renderiza el shell entero (nav, avisos, botones de acción).
  revalidatePath('/', 'layout')
  redirect(destinoSeguro(campo(formData, 'redirectTo')))
}

/** Cierre de sesión. Sin formulario propio: la llama el menú de la cuenta. */
export async function signOutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}

// ---------------------------------------------------------------------------
// Onboarding e identidad
// ---------------------------------------------------------------------------

/**
 * Cierre del alta — PART 6 §6.1 S3 + S4.
 *
 * `complete_onboarding` fija el seudónimo real, la carrera y el año de ingreso, y pasa el
 * perfil de `nuevo` a `activo`. La primera elección de seudónimo no toca `handle_changed_at`:
 * es gratis, y el cooldown de 90 días recién empieza con el primer renombre de verdad.
 */
export async function completeOnboarding(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  // "Prefiero no decir mi carrera" (PART 6 §6.1 S4) manda `omitir`: gana sobre lo que haya
  // quedado seleccionado en los selects. La última decisión de la persona es la que vale.
  const omitir = campo(formData, 'omitir') === '1'

  const parsed = onboardingSchema.safeParse({
    handle: campo(formData, 'handle'),
    carreraId: omitir ? undefined : numeroOpcional(formData, 'carreraId'),
    ingresoYear: omitir ? undefined : numeroOpcional(formData, 'ingresoYear'),
  })
  if (!parsed.success) return primerProblema(parsed.error)

  const user = await getUser()
  if (!user) return fail(messageForCode('NOT_AUTHENTICATED'))

  const supabase = await createClient()
  const { error } = await supabase.rpc('complete_onboarding', {
    p_handle: parsed.data.handle,
    // Las claves ausentes dejan que valgan los defaults de la función; mandar null explícito
    // significaría "sin carrera", que es lo mismo, pero omitir es lo que espera la firma.
    ...(parsed.data.carreraId !== undefined ? { p_carrera_id: parsed.data.carreraId } : {}),
    ...(parsed.data.ingresoYear !== undefined ? { p_ingreso_year: parsed.data.ingresoYear } : {}),
  })

  if (error) return fail(rpcErrorMessage(error), 'handle')

  revalidatePath('/', 'layout')
  redirect('/')
}

/**
 * Cambio de seudónimo — PART 9 §9.5, /ajustes.
 *
 * `rename_handle` es la autoridad: cooldown de 90 días, blocklist normalizada, cuarentena de
 * nombres liberados y la fila de `handle_history`, todo dentro de la misma transacción.
 * El renombre reescribe el nombre en todo lo publicado (el display se arma con un join en
 * cada lectura), así que hay que invalidar el árbol entero.
 */
export async function renameHandle(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = handleSchema.safeParse(campo(formData, 'handle'))
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR, 'handle')
  }

  const user = await getUser()
  if (!user) return fail(messageForCode('NOT_AUTHENTICATED'))

  const supabase = await createClient()
  const { error } = await supabase.rpc('rename_handle', { p_handle: parsed.data })

  if (error) return fail(rpcErrorMessage(error), 'handle')

  revalidatePath('/', 'layout')
  return ok()
}

// ---------------------------------------------------------------------------
// Contraseña
// ---------------------------------------------------------------------------

/**
 * Pedido de recuperación — PART 6 §6.8.
 *
 * La respuesta es siempre la misma exista o no la cuenta, así que esta acción devuelve `ok()`
 * incluso cuando Supabase falla por correo inexistente: lo contrario convertiría el formulario
 * en un verificador de direcciones registradas. El correo que sale nunca menciona el seudónimo
 * (PART 9 §9.2.3): una casilla comprometida no puede revelar qué identidad pública hay detrás.
 */
export async function requestPasswordReset(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = recoverSchema.safeParse({ email: campo(formData, 'email').toLowerCase() })
  if (!parsed.success) return primerProblema(parsed.error)

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: absoluteUrl(`/auth/callback?next=${encodeURIComponent('/recuperar')}`),
  })

  // Solo el freno por abuso se cuenta: cualquier otro error se traga a propósito.
  if (error && /rate limit|only request this after|too many/i.test(error.message)) {
    return fail(mensajeDeAuth(error))
  }

  return ok()
}

/**
 * Contraseña nueva — PART 6 §6.8, con la sesión de recuperación ya activa.
 * Supabase revoca el resto de las sesiones al cambiarla (PART 9 §9.3).
 */
export async function updatePassword(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    password: secreto(formData, 'password'),
    confirmacion: secreto(formData, 'confirmacion'),
  })
  if (!parsed.success) return primerProblema(parsed.error)

  const user = await getUser()
  if (!user) {
    return fail('El link de recuperación venció. Pedí uno nuevo desde "Recuperar cuenta".')
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })

  if (error) return fail(mensajeDeAuth(error), 'password')

  revalidatePath('/', 'layout')
  return ok()
}

// ---------------------------------------------------------------------------
// Preferencias y baja
// ---------------------------------------------------------------------------

/**
 * Preferencias de notificaciones — §0.5-R14: un único interruptor, `notif_respuestas`.
 * Las decisiones de moderación y el cierre de un reporte se avisan siempre y no tienen control.
 *
 * Va por `update_notification_prefs` (migración 0014) y no por un UPDATE directo: `profiles`
 * tiene una sola política —`profiles_select_self`— y un solo grant —`select`—, así que el rol
 * `authenticated` no puede escribir la tabla. La RPC no exige `status = 'activo'`: una cuenta
 * suspendida conserva el derecho a silenciar sus propios avisos (PART 11 §11.8).
 */
export async function updateNotificationPrefs(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = notificationPrefsSchema.safeParse({
    respuestas: formData.get('respuestas') === 'on',
  })
  if (!parsed.success) return primerProblema(parsed.error)

  const user = await getUser()
  if (!user) return fail(messageForCode('NOT_AUTHENTICATED'))

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_notification_prefs', {
    p_notif_respuestas: parsed.data.respuestas,
  })

  if (error) return fail(rpcErrorMessage(error))

  revalidatePath('/ajustes')
  return ok()
}

/**
 * Baja de cuenta — PART 6 §6.9, PART 9 §9.9.
 *
 * La confirmación escrita es el seudónimo, comparado sin distinguir mayúsculas porque
 * `profiles.handle` es citext y así lo ve la persona en pantalla. `delete_account` hace el
 * resto en una transacción: contenido según el modo elegido, follows y avisos borrados,
 * seudónimo en cuarentena y perfil anonimizado en el lugar. La fila de `auth.users` la
 * destruye el cron administrativo dentro de las 24 h; la sesión se cierra acá mismo.
 */
export async function deleteAccount(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = deleteAccountSchema.safeParse({
    modo: campo(formData, 'modo'),
    confirmacion: campo(formData, 'confirmacion'),
  })
  if (!parsed.success) return primerProblema(parsed.error)

  const profile = await getProfile()
  if (!profile) return fail(messageForCode('NOT_AUTHENTICATED'))

  if (parsed.data.confirmacion.toLowerCase() !== profile.handle.toLowerCase()) {
    return fail('Escribí tu seudónimo tal cual para confirmar.', 'confirmacion')
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_account', { p_mode: parsed.data.modo })

  if (error) return fail(rpcErrorMessage(error))

  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}

/**
 * Lista de espera — PART 6 §6.10 estado A (beta cerrada).
 *
 * `waitlist.source` la fija el servidor con una etiqueta corta, nunca es texto de la persona
 * (migración 0003): cuando eligió carrera queda `registro:<slug>`, que es lo que después
 * permite abrir carrera por carrera (D11).
 *
 * Va por `join_waitlist` (migración 0011), la ÚNICA puerta de escritura de la tabla: `waitlist`
 * tiene RLS con cero políticas y cero grants (`revoke all from anon, authenticated`, migración
 * 0003) porque es PII pura, así que un INSERT directo desde acá siempre termina en permiso
 * denegado. La RPC es SECURITY DEFINER, está otorgada a `anon` —el formulario vive en /registro,
 * antes de que exista cuenta— y es idempotente: reenviar el mismo mail no crea filas ni revela
 * si ya estaba, para no confirmarle una dirección a un tercero que la pruebe.
 */
export async function joinWaitlist(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const carrera = campo(formData, 'carrera')
  const parsed = waitlistSchema.safeParse({
    email: campo(formData, 'email').toLowerCase(),
    carrera: carrera === '' ? undefined : carrera,
  })
  if (!parsed.success) return primerProblema(parsed.error)

  const supabase = await createClient()
  const { error } = await supabase.rpc('join_waitlist', {
    p_email: parsed.data.email,
    p_source: parsed.data.carrera !== undefined ? `registro:${parsed.data.carrera}` : 'registro',
  })

  if (error) return fail(rpcErrorMessage(error))

  return ok()
}
