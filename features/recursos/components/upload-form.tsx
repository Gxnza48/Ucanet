'use client'

/**
 * features/recursos/components/upload-form.tsx — el formulario de subida
 * (PART 17 §17.4.5 sobre el pipeline de PART 14 §14.3).
 *
 * Es uno de los siete componentes de cliente que permite el producto (PART 19
 * §19.3, "campo de subida de archivos"), y lo es por una razón concreta: la
 * subida tiene dos fases y una barra de progreso determinada.
 *
 *   1. `createResourceDraft` valida los metadatos contra la base y devuelve una
 *      URL firmada por archivo.
 *   2. El navegador sube los bytes DIRECTO a R2. No pasan por Vercel (§14.3).
 *   3. `finalizeResource` verifica lo que aterrizó y publica el recurso.
 *
 * El progreso va con XMLHttpRequest y no con `fetch`: `fetch` no expone eventos
 * de progreso de SUBIDA en ningún navegador (el `ReadableStream` de request
 * sigue siendo experimental y necesita HTTP/2 más un fallback), y una barra
 * indeterminada frente a un PDF de 10 MB en el 4G de una facultad es lo mismo
 * que no tener barra.
 *
 * Requiere un `<ToastProvider>` en el árbol (PART 18 §18.4): el aviso de éxito
 * viaja al llegar a la ficha del recurso.
 */

import { useRouter } from 'next/navigation'
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/cn'
import { ACCEPTED_MIME, LIMITS } from '@/lib/config'

import { createResourceDraft, finalizeResource } from '../actions'
import {
  RESOURCE_TIPOS,
  TIPO_LABELS,
  TIPO_PLURALS,
  TIPOS_EXAMEN,
  formatBytes,
  isAcceptedMime,
  resourceYearOptions,
  type ResourceTipo,
} from '../schemas'

/** El campo de archivos nunca viaja al servidor: los bytes van a R2. */
const FILE_INPUT_NAME = 'archivos'

type Phase = 'idle' | 'creando' | 'subiendo' | 'finalizando' | 'listo'

export type UploadMateriaOption = {
  slug: string
  nombre: string
}

export type UploadFormProps = {
  /** Materias elegibles. Las trae la página; la feature no lee el catálogo. */
  materias: UploadMateriaOption[]
  /** Preselección desde `/recursos/subir?materia=…&tipo=…` (§14.11, subir en tanda). */
  defaultMateriaSlug?: string
  defaultTipo?: ResourceTipo
  /**
   * Cuántos recursos del mismo par (materia, tipo) ya existen, con clave
   * `"<materiaSlug>:<tipo>"`. Alimenta el aviso de duplicados de §14.8, que es
   * un empujón y no una barrera: si la página no lo pasa, no se muestra nada.
   */
  duplicateCounts?: Record<string, number>
  className?: string
}

export function UploadForm({
  materias,
  defaultMateriaSlug,
  defaultTipo,
  duplicateCounts,
  className,
}: UploadFormProps) {
  const router = useRouter()
  const toast = useToast()
  const fileInput = useRef<HTMLInputElement>(null)

  const [materiaSlug, setMateriaSlug] = useState(defaultMateriaSlug ?? '')
  const [tipo, setTipo] = useState<ResourceTipo>(defaultTipo ?? 'resumen')
  const [files, setFiles] = useState<File[]>([])
  const [sent, setSent] = useState<Record<number, number>>({})
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  const busy = phase !== 'idle'
  const totalBytes = files.reduce((total, file) => total + file.size, 0)
  const sentBytes = Object.values(sent).reduce((total, value) => total + value, 0)
  const percent = totalBytes === 0 ? 0 : Math.min(100, Math.round((sentBytes / totalBytes) * 100))
  const duplicates = duplicateCounts?.[`${materiaSlug}:${tipo}`] ?? 0

  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? [])
    // El input vuelve a cero: nuestra lista es la fuente de verdad y así se puede
    // volver a elegir el mismo archivo después de quitarlo.
    if (fileInput.current) fileInput.current.value = ''

    const accepted: File[] = []
    let problem: string | null = null

    for (const file of chosen) {
      if (!isAcceptedMime(file.type)) {
        problem ??= `«${file.name}» no es PDF, JPG, PNG ni WebP.`
        continue
      }
      if (file.size < 1) {
        problem ??= `«${file.name}» está vacío.`
        continue
      }
      if (file.size > LIMITS.fileMaxBytes) {
        problem ??= `«${file.name}» pesa más de 10 MB.`
        continue
      }
      accepted.push(file)
    }

    const merged = [...files, ...accepted]
    if (merged.length > LIMITS.filesPerResource) problem ??= 'Podés subir hasta 3 archivos.'

    setFiles(merged.slice(0, LIMITS.filesPerResource))
    setFileError(problem)
  }

  function removeFile(index: number) {
    setFiles((previous) => previous.filter((_, position) => position !== index))
    setFileError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return

    setError(null)
    if (files.length === 0) {
      setFileError('Elegí al menos un archivo.')
      return
    }

    // Los archivos viajan como metadatos (nombre, tamaño, tipo); los bytes van
    // por su cuenta a R2 en el paso siguiente.
    const formData = new FormData(event.currentTarget)
    formData.delete(FILE_INPUT_NAME)
    formData.set(
      'files',
      JSON.stringify(files.map((file) => ({ name: file.name, size: file.size, type: file.type }))),
    )

    setSent({})
    setPhase('creando')

    const draft = await createResourceDraft(null, formData)
    if (!draft.ok) {
      setError(draft.error)
      setPhase('idle')
      return
    }

    setPhase('subiendo')
    try {
      // De a uno: tres PUT de 10 MB en paralelo se pelean por el mismo ancho de
      // banda y hacen que la barra avance a saltos.
      for (const upload of draft.data.uploads) {
        const file = files[upload.index]
        if (!file) throw new Error('ARCHIVO_FALTANTE')

        await putWithProgress(upload.url, file, (loaded) => {
          setSent((previous) => ({ ...previous, [upload.index]: loaded }))
        })
      }
    } catch (cause) {
      console.error('UploadForm: falló la subida a R2', cause)
      setError('No pudimos subir los archivos. Revisá tu conexión y probá de nuevo.')
      setPhase('idle')
      return
    }

    setPhase('finalizando')
    const finalizeData = new FormData()
    finalizeData.set('publicId', draft.data.publicId)
    finalizeData.set('materiaSlug', materiaSlug)
    finalizeData.set(
      'files',
      JSON.stringify(files.map((file, index) => ({ index, name: file.name, size: file.size }))),
    )

    const published = await finalizeResource(null, finalizeData)
    if (!published.ok) {
      // El borrador queda sin publicar y el reintento empieza de cero: las URLs
      // firmadas duran 120 s y no hay forma de volver a firmarlas sin pedir otro
      // borrador. El anterior lo limpia el cron a las 24 h (§14.3 paso 5).
      setError(published.error)
      setPhase('idle')
      return
    }

    setPhase('listo')
    toast.show('Recurso publicado. Queda visible para toda la comunidad.', {
      label: 'Subir otro a la misma materia',
      onClick: () => {
        router.push(`/recursos/subir?materia=${encodeURIComponent(materiaSlug)}&tipo=${tipo}`)
      },
    })
    router.push(`/recursos/${published.data.publicId}`)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className={cn('flex flex-col gap-5', className)}>
      <Field label="Título" htmlFor="title" required>
        <Input
          name="title"
          maxLength={LIMITS.resourceTitle}
          placeholder="Resumen de Derecho Civil, unidades 1 a 7"
          required
          disabled={busy}
        />
      </Field>

      <Field label="Materia" htmlFor="materiaSlug" required>
        <Select
          name="materiaSlug"
          value={materiaSlug}
          onChange={(event) => setMateriaSlug(event.target.value)}
          required
          disabled={busy}
        >
          <option value="">Elegí una materia</option>
          {materias.map((materia) => (
            <option key={materia.slug} value={materia.slug}>
              {materia.nombre}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Tipo" htmlFor="tipo" required>
        <Select
          name="tipo"
          value={tipo}
          onChange={(event) => setTipo(event.target.value as ResourceTipo)}
          disabled={busy}
        >
          {RESOURCE_TIPOS.map((value) => (
            <option key={value} value={value}>
              {TIPO_LABELS[value]}
            </option>
          ))}
        </Select>
      </Field>

      {duplicates > 0 ? (
        <p className="text-s text-text-secondary">
          {`Ya hay ${duplicates} ${duplicates === 1 ? TIPO_LABELS[tipo].toLowerCase() : TIPO_PLURALS[tipo]} de esta materia. Fijate que el tuyo aporte algo distinto.`}
        </p>
      ) : null}

      {TIPOS_EXAMEN.includes(tipo) ? (
        <p className="border-l border-border pl-3 text-s text-text-secondary">
          Subí el enunciado transcripto o tus propias fotos del examen que rendiste. No subas
          material con logo o membrete de la universidad ni archivos oficiales.
        </p>
      ) : null}

      <Field label="Año" htmlFor="anio" hint="¿De qué año es el parcial/final?">
        <Select name="anio" defaultValue="" disabled={busy}>
          <option value="">Sin especificar</option>
          {resourceYearOptions().map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Descripción" htmlFor="description">
        <Textarea
          name="description"
          rows={4}
          maxLength={LIMITS.resourceDescription}
          placeholder="Contá qué incluye: unidades, cátedra, si está actualizado."
          disabled={busy}
        />
      </Field>

      <Field
        label="Archivos"
        htmlFor={FILE_INPUT_NAME}
        required
        hint="PDF, JPG, PNG o WebP. Hasta 3 archivos de 10 MB cada uno."
        error={fileError ?? undefined}
      >
        <input
          ref={fileInput}
          type="file"
          name={FILE_INPUT_NAME}
          multiple
          accept={ACCEPTED_MIME.join(',')}
          onChange={addFiles}
          disabled={busy || files.length >= LIMITS.filesPerResource}
          className="w-full text-m text-text-primary file:mr-3 file:rounded-input file:border file:border-border file:bg-surface-raised file:px-3 file:py-2 file:text-m file:font-semibold file:text-text-primary"
        />
      </Field>

      {files.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              className="flex items-center justify-between gap-3 border-b border-border pb-2"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-m text-text-primary">{file.name}</span>
                <span className="text-s text-text-secondary">{formatBytes(file.size)}</span>
              </span>
              <Button variant="tertiary" onClick={() => removeFile(index)} disabled={busy}>
                Quitar
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-col gap-1">
        <Checkbox
          name="anonymous"
          label="Publicar como anónimo"
          hint="Tu nombre no se muestra. El equipo de moderación puede ver el autor."
          disabled={busy}
        />
        <p className="pl-6 text-s text-text-secondary">
          Si publicás como Anónimo, el recurso no aparecerá en tu perfil público ni sumará
          reputación visible.
        </p>
      </div>

      {busy ? (
        <div className="flex flex-col gap-2">
          <div
            role="progressbar"
            aria-label="Progreso de la subida"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="h-1 w-full overflow-hidden rounded-input bg-surface-raised"
          >
            <div className="h-full bg-accent" style={{ width: `${percent}%` }} />
          </div>
          <p role="status" className="text-s text-text-secondary">
            {phaseLabel(phase, percent)}
          </p>
        </div>
      ) : null}

      {error ? (
        <p role="status" className="text-s text-danger">
          {error}
        </p>
      ) : null}

      <div>
        <Button type="submit" pending={busy} pendingLabel="Publicando…" disabled={busy}>
          Publicá el recurso
        </Button>
      </div>
    </form>
  )
}

function phaseLabel(phase: Phase, percent: number): string {
  switch (phase) {
    case 'creando':
      return 'Preparando la subida…'
    case 'subiendo':
      return `Subiendo archivos… ${percent}%`
    case 'finalizando':
      return 'Verificando los archivos…'
    case 'listo':
      return 'Listo. Te llevamos al recurso.'
    default:
      return ''
  }
}

/**
 * PUT directo a R2 con progreso real.
 *
 * El `Content-Type` tiene que ser exactamente el que se firmó del lado del
 * servidor: R2 valida la firma contra ese header y rechaza el pedido si no
 * coincide.
 */
function putWithProgress(
  url: string,
  file: File,
  onProgress: (loaded: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url, true)
    xhr.setRequestHeader('Content-Type', file.type)

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(event.loaded)
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(file.size)
        resolve()
        return
      }
      reject(new Error(`R2_PUT_${xhr.status}`))
    })

    xhr.addEventListener('error', () => reject(new Error('R2_PUT_RED')))
    xhr.addEventListener('abort', () => reject(new Error('R2_PUT_CANCELADO')))

    xhr.send(file)
  })
}
