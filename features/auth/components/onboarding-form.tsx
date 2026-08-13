'use client'

/**
 * features/auth/components/onboarding-form.tsx — `/registro/continuar`
 * (PART 6 §6.1 S3 y S4, PART 17 §17.4.9).
 *
 * Dos pantallas, un solo envío. Las pantallas son estado del cliente y no rutas distintas
 * porque `complete_onboarding` escribe seudónimo, carrera y año en una sola transacción: dos
 * rutas obligarían a dos escrituras o a arrastrar el seudónimo por la URL.
 *
 * El paso 1 no manda nada al servidor: valida la forma del seudónimo con el mismo esquema Zod
 * que usa la Server Action y avanza. Lo que la base tiene que decir —si está tomado, si está
 * reservado, si está en cuarentena— lo dice recién al enviar, porque solo la base lo sabe.
 *
 * El input llega pre-llenado por el generador de PART 9 §9.4.3. La semilla viaja por prop y
 * es determinística: el mismo HTML en el servidor y en la hidratación, sin parpadeo.
 */
import { useActionState, useMemo, useState } from 'react'
import { Button, SubmitButton } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { LIMITS } from '@/lib/config'
import type { ActionResult } from '@/lib/result'
import { completeOnboarding } from '../actions'
import type { CarreraOption } from '../queries'
import { handleSchema } from '../schemas'
import { suggestHandles } from './handle-suggestions'

export type OnboardingFormProps = {
  /** Catálogo para el select, ya ordenado por facultad (features/auth/queries.ts). */
  carreras: CarreraOption[]
  /**
   * Semilla del generador de seudónimos. Cualquier valor estable por persona sirve — el id de
   * usuario es el natural. Si no llega, todos ven la misma primera terna, que es feo pero no roto.
   */
  seed?: string
}

/** Diez años para atrás: cubre a cualquiera que esté cursando hoy sin volver el select una lista. */
function aniosDeIngreso(): number[] {
  const actual = new Date().getFullYear()
  return Array.from({ length: 10 }, (_, i) => actual - i)
}

export function OnboardingForm({ carreras, seed = 'uca.net' }: OnboardingFormProps) {
  const [estado, enviar] = useActionState<ActionResult | null, FormData>(completeOnboarding, null)

  const [paso, setPaso] = useState<1 | 2>(1)
  const [tirada, setTirada] = useState(0)
  const [handle, setHandle] = useState(() => suggestHandles(seed, 3)[0] ?? '')
  const [errorLocal, setErrorLocal] = useState<string | undefined>(undefined)

  const sugerencias = useMemo(() => suggestHandles(`${seed}:${tirada}`, 3), [seed, tirada])
  const anios = useMemo(() => aniosDeIngreso(), [])

  // Facultades en el orden en que vienen: la query ya ordenó por facultad y nombre.
  const grupos = useMemo(() => {
    const porFacultad = new Map<string, CarreraOption[]>()
    for (const carrera of carreras) {
      const actuales = porFacultad.get(carrera.facultad)
      if (actuales) actuales.push(carrera)
      else porFacultad.set(carrera.facultad, [carrera])
    }
    return [...porFacultad.entries()]
  }, [carreras])

  const errorServidor = estado && !estado.ok ? estado.error : undefined
  const errorHandle = paso === 1 ? (errorLocal ?? errorServidor) : undefined

  function avanzar() {
    const revisado = handleSchema.safeParse(handle)
    if (!revisado.success) {
      setErrorLocal(revisado.error.issues[0]?.message)
      return
    }
    setErrorLocal(undefined)
    setHandle(revisado.data)
    setPaso(2)
  }

  function usarSugerencia(sugerida: string) {
    setHandle(sugerida)
    setErrorLocal(undefined)
  }

  return (
    <form
      action={enviar}
      onSubmit={(evento) => {
        // Paso 1: Enter y "Continuar" avanzan, no envían. El envío es una sola vez, al final.
        if (paso === 1) {
          evento.preventDefault()
          avanzar()
        }
      }}
      className="flex flex-col gap-4"
    >
      <p className="text-s text-text-secondary">Paso {paso} de 2</p>

      <div hidden={paso !== 1} className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <h2 className="font-serif text-l font-semibold text-text-primary">Elegí tu seudónimo</h2>
          <p className="text-s text-text-secondary">
            Así te va a ver la comunidad. Tu nombre real no se pide nunca.
          </p>
        </header>

        <Field
          label="Seudónimo"
          htmlFor="handle"
          hint="Lo podés cambiar cada 90 días."
          error={errorHandle}
          required
        >
          <Input
            name="handle"
            type="text"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            minLength={LIMITS.handleMin}
            maxLength={LIMITS.handleMax}
            required
            autoFocus
            value={handle}
            onChange={(evento) => {
              setHandle(evento.target.value)
              setErrorLocal(undefined)
            }}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-2">
          {sugerencias.map((sugerida) => (
            <Button
              key={sugerida}
              variant="tertiary"
              onClick={() => usarSugerencia(sugerida)}
              aria-label={`Usar el seudónimo ${sugerida}`}
            >
              {sugerida}
            </Button>
          ))}
          <Button variant="tertiary" onClick={() => setTirada((valor) => valor + 1)}>
            Probar otro
          </Button>
        </div>

        <Button type="submit">Continuar</Button>
      </div>

      <div hidden={paso !== 2} className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <h2 className="font-serif text-l font-semibold text-text-primary">¿Qué estudiás?</h2>
          <p className="text-s text-text-secondary">
            Esto arma tu feed. Lo podés cambiar cuando quieras.
          </p>
        </header>

        <p className="text-s text-text-secondary">
          Tu seudónimo: <span className="font-semibold text-text-primary">{handle}</span>{' '}
          <Button variant="tertiary" onClick={() => setPaso(1)}>
            Cambiar
          </Button>
        </p>

        <Field label="Carrera" htmlFor="carreraId">
          <Select name="carreraId" defaultValue="">
            <option value="">Elegí tu carrera</option>
            {grupos.map(([facultad, opciones]) => (
              <optgroup key={facultad} label={facultad}>
                {opciones.map((carrera) => (
                  <option key={carrera.id} value={carrera.id}>
                    {carrera.nombre}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>

        <Field label="Año de ingreso" htmlFor="ingresoYear">
          <Select name="ingresoYear" defaultValue="">
            <option value="">Elegí tu año de ingreso</option>
            {anios.map((anio) => (
              <option key={anio} value={anio}>
                {anio}
              </option>
            ))}
          </Select>
        </Field>

        {errorServidor ? (
          <p role="alert" className="text-s text-danger">
            {errorServidor}
          </p>
        ) : null}

        <SubmitButton pendingLabel="Preparando tu feed…">Ir al feed</SubmitButton>

        <SubmitButton variant="tertiary" name="omitir" value="1" pendingLabel="Un momento…">
          Prefiero no decir mi carrera
        </SubmitButton>
      </div>
    </form>
  )
}
