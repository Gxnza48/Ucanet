/**
 * features/auth/schemas.ts — validación de identidad y cuenta (PART 9, PART 6 §6.1/§6.8/§6.9).
 *
 * Estos esquemas son la primera de las cinco etapas obligatorias de toda Server Action
 * (BUILD-CONTRACT §4.6). NO son la autoridad: la forma del seudónimo, la blocklist, la
 * cuarentena de 90 días y el consumo de la invitación se vuelven a validar dentro de las
 * funciones SECURITY DEFINER de la base (assert_handle_ok, rename_handle, handle_new_user).
 * Acá se valida para dar un mensaje bueno antes del viaje al servidor, no para proteger nada.
 *
 * Zod 4 (BUILD-CONTRACT §0): formatos de nivel superior (`z.email()`), errores por
 * `result.error.issues`, nunca `.flatten()` ni `.format()`.
 *
 * Los mensajes son los que el estudiante ve tal cual. Copy de PART 6 §6.1 donde existe.
 */
import { z } from 'zod'
import { LIMITS } from '@/lib/config'

/** Un solo texto para las tres reglas de forma: el estudiante no necesita tres errores distintos. */
const HANDLE_SHAPE = `Solo letras, números y guion bajo (${LIMITS.handleMin} a ${LIMITS.handleMax} caracteres).`

/**
 * Seudónimo — §0.5-R8 / PART 9 §9.4.1: `^[a-zA-Z0-9_]{3,24}$` con al menos una letra.
 * Sin puntos, guiones, espacios ni no-ASCII: los handles viven en `/u/[handle]` y el
 * Unicode habilita homoglifos que un equipo chico de moderación no puede vigilar.
 * Espeja el CHECK `profiles_handle_check` de la migración 0004.
 */
export const handleSchema = z
  .string({ error: 'Elegí un seudónimo.' })
  .trim()
  .min(LIMITS.handleMin, HANDLE_SHAPE)
  .max(LIMITS.handleMax, HANDLE_SHAPE)
  .regex(/^[a-zA-Z0-9_]+$/, HANDLE_SHAPE)
  .regex(/[a-zA-Z]/, 'El seudónimo tiene que tener al menos una letra.')

/**
 * Contraseña — mínimo 10 (PART 9 §9.2.1, `LIMITS.passwordMin`). El máximo de 72 no es
 * decorativo: bcrypt trunca ahí y Supabase Auth rechaza cualquier cosa más larga, así que
 * conviene decirlo antes de que lo diga el servidor en inglés.
 */
export const passwordSchema = z
  .string({ error: 'Escribí una contraseña.' })
  .min(
    LIMITS.passwordMin,
    `La contraseña tiene que tener al menos ${LIMITS.passwordMin} caracteres.`,
  )
  .max(72, 'La contraseña no puede tener más de 72 caracteres.')

/** Código de invitación: 8 caracteres del alfabeto no ambiguo de `public.nanoid()` (migración 0003). */
const inviteCodeSchema = z
  .string({ error: 'Falta el código de invitación.' })
  .regex(/^[a-z0-9]{8}$/, 'Ese código de invitación no es válido.')

const emailSchema = z.email({ error: 'Escribí un correo válido.' })

/**
 * Alta de cuenta — PART 6 §6.1 S1.
 *
 * `inviteCode` es opcional a propósito: con el kill-switch `registro_abierto` prendido
 * (migración 0004) el alta no exige código. Cuando viene, se valida de solo lectura antes
 * de crear nada (§0.5-R18) y el trigger `handle_new_user` lo consume atómicamente después.
 *
 * `terminos` es la casilla de Términos + declaración de 16 años de PART 9 §9.2.1 (C15-e).
 */
export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  inviteCode: inviteCodeSchema.optional(),
  terminos: z.literal(true, {
    error: 'Tenés que aceptar los Términos y la Política de Privacidad.',
  }),
})

/**
 * Ingreso — PART 6 §6.1 / PART 9 §9.2.2.
 *
 * La contraseña se valida solo como "no vacía": exigir acá el mínimo de 10 le contaría a
 * quien intenta entrar cuál es la política de contraseñas y, peor, distinguiría el error de
 * forma del error de credenciales. El fallo real siempre es el mismo texto (higiene
 * antienumeración).
 */
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string({ error: 'Escribí tu contraseña.' }).min(1, 'Escribí tu contraseña.'),
})

/**
 * Onboarding — PART 6 §6.1 S3 + S4.
 *
 * Carrera y año de ingreso son opcionales porque "Prefiero no decir mi carrera" tiene que
 * poder saltearlos (PART 6 §6.1 S4). Los límites de `ingresoYear` espejan el CHECK
 * `profiles_ingreso_year_check` de la migración 0004.
 */
export const onboardingSchema = z.object({
  handle: handleSchema,
  carreraId: z
    .number({ error: 'Elegí una carrera de la lista.' })
    .int('Elegí una carrera de la lista.')
    .positive('Elegí una carrera de la lista.')
    .optional(),
  ingresoYear: z
    .number({ error: 'Elegí tu año de ingreso.' })
    .int('Elegí tu año de ingreso.')
    .min(2000, 'Elegí un año de ingreso entre 2000 y 2100.')
    .max(2100, 'Elegí un año de ingreso entre 2000 y 2100.')
    .optional(),
})

/** Recuperación de contraseña — PART 6 §6.8. Solo el correo; la respuesta nunca revela si existe. */
export const recoverSchema = z.object({
  email: emailSchema,
})

/**
 * Contraseña nueva desde el enlace de recuperación — PART 6 §6.8.
 * La repetición existe porque un error de tipeo acá deja a la persona afuera de una cuenta
 * que, por diseño, nadie puede devolverle (PART 9 §9.8).
 */
export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmacion: z.string({ error: 'Repetí la contraseña nueva.' }),
  })
  .refine((valores) => valores.password === valores.confirmacion, {
    error: 'Las dos contraseñas tienen que ser iguales.',
    path: ['confirmacion'],
  })

/**
 * Lista de espera — PART 6 §6.10 estado A (beta cerrada).
 * La carrera es opcional y sirve para abrir carrera por carrera (D11). No se guarda como
 * texto libre: la Server Action la convierte en la etiqueta corta de `waitlist.source`.
 */
export const waitlistSchema = z.object({
  email: emailSchema,
  carrera: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Elegí una carrera de la lista.')
    .max(60, 'Elegí una carrera de la lista.')
    .optional(),
})

/**
 * Baja de cuenta — PART 6 §6.9 y PART 9 §9.9.
 *
 * `modo` espeja exactamente los dos valores que acepta la RPC `delete_account`:
 *   'borrar'    → publicaciones, comentarios y recursos pasan a eliminado_autor.
 *   'conservar' → el contenido queda atribuido a la cáscara `usuario_eliminado_<id>`.
 *
 * `confirmacion` es el seudónimo escrito a mano ("Escribí tu seudónimo para confirmar",
 * PART 6 §6.9 paso 2 y PART 17 §17.4.8). Acá solo se exige que no esté vacío: la comparación
 * contra el handle real la hace la Server Action, que es la única que lo conoce.
 */
export const deleteAccountSchema = z.object({
  modo: z.enum(['borrar', 'conservar'], {
    error: 'Elegí qué pasa con lo que publicaste.',
  }),
  confirmacion: z
    .string({ error: 'Escribí tu seudónimo para confirmar.' })
    .trim()
    .min(1, 'Escribí tu seudónimo para confirmar.'),
})

/** Preferencias de notificaciones v1 — §0.5-R14: un solo interruptor (`profiles.notif_respuestas`). */
export const notificationPrefsSchema = z.object({
  respuestas: z.boolean(),
})

export type SignUpInput = z.infer<typeof signUpSchema>
export type SignInInput = z.infer<typeof signInSchema>
export type OnboardingInput = z.infer<typeof onboardingSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type WaitlistInput = z.infer<typeof waitlistSchema>
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>
