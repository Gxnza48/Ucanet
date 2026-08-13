/**
 * app/(public)/acerca/page.tsx — Acerca de (D1, D8, D10, C16).
 *
 * Server Component estático. Explica la tesis del producto (AHORA y SIEMPRE), quién lo hace, por qué
 * es independiente de la universidad y qué no es. El nombre del producto viene de lib/config (D10).
 */
import Link from 'next/link'
import type { Metadata } from 'next'
import { SITE_NAME, SITE_TAGLINE } from '@/lib/config'

// El contenido vive en el repo, así que se revalida solo al deployar. NO es
// `force-static`: el header comparte layout y lee la sesión, así que una persona
// logueada tiene que recibir su propio chrome (su seudónimo, sus avisos) y no el
// HTML congelado del visitante anónimo.
export const revalidate = 86_400

export const metadata: Metadata = {
  title: `Acerca de ${SITE_NAME}`,
  description: `Qué es ${SITE_NAME}, quién lo hace, por qué es independiente de la Universidad Católica Argentina y qué no es.`,
}

const ACTUALIZADO = '13 de agosto de 2026'

export default function AcercaPage() {
  return (
    <article className="mx-auto w-full max-w-170 py-6">
      <header>
        <h1 className="font-serif text-2xl font-semibold text-text-primary">
          Acerca de {SITE_NAME}
        </h1>
        <p className="mt-2 text-s text-text-secondary">
          {SITE_TAGLINE} · Última actualización: {ACTUALIZADO}
        </p>
      </header>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">Qué es</h2>
        <p className="mt-3">
          Es la capa estudiantil de la UCA Rosario: un lugar donde cada materia y cada carrera
          tienen una página pública y permanente, escrita por los que la cursan. Todo lo que se
          publica se lee con seudónimo o de forma anónima, así que se puede contar lo que pasa de
          verdad en una cursada.
        </p>
        <p className="mt-3">Esas páginas acumulan dos cosas al mismo tiempo:</p>
        <ul className="mt-3 space-y-3">
          <li>
            <span className="font-semibold">AHORA:</span> la conversación viva de tu camada. Si se
            sabe algo del parcial, cómo tomó el final ayer, qué comisión conviene, quién entendió el
            tema tres.
          </li>
          <li>
            <span className="font-semibold">SIEMPRE:</span> lo que dejaron todas las camadas
            anteriores. Resúmenes, apuntes, parciales viejos, experiencias, recomendaciones. Dentro
            de diez años, la misma materia va a tener diez años de esto.
          </li>
        </ul>
        <p className="mt-3">
          Ese archivo no es una función que construimos aparte: es lo que queda cuando el sitio
          funciona con normalidad. Por eso las direcciones de las páginas están pensadas para no
          cambiar, y por eso todo es público y se puede encontrar desde un buscador.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">Cómo funciona</h2>
        <ul className="mt-3 space-y-3">
          <li>
            Elegís un seudónimo. No usamos tu nombre real, ni te lo pedimos, ni lo mostramos nunca.
          </li>
          <li>
            Seguís las materias que cursás y tu feed se arma con eso, más lo que pasa en tu carrera.
          </li>
          <li>
            Publicás, preguntás y respondés. Podés hacerlo con tu seudónimo o marcando Anónimo en
            cada publicación.
          </li>
          <li>
            Subís y descargás material de estudio en la sección de recursos, ordenado por materia y
            por tipo.
          </li>
          <li>
            Los votos positivos hacen subir lo que sirve. No hay votos negativos: lo que está mal se
            reporta, no se hunde.
          </li>
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">Quién lo hace</h2>
        <p className="mt-3">
          Lo hacen estudiantes de la UCA Rosario. Hoy es un equipo muy chico: quien lo programa y
          mantiene, y un puñado de personas que ayudaron a llenar las primeras materias con material
          bueno antes de abrirlo a los demás. La moderación la hacen estudiantes de confianza, de
          distintas carreras, con reglas escritas y públicas.
        </p>
        <p className="mt-3">
          No hay empresa detrás, ni inversores, ni un equipo de marketing. Cuando el equipo crezca,
          se va a decir acá.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">
          Por qué es independiente
        </h2>
        <p className="mt-3">
          El sitio no tiene ninguna afiliación con la Universidad Católica Argentina. No lo
          financia, no lo administra ni lo supervisa la universidad, y los nombres de facultades,
          carreras y materias se usan solamente para identificar de qué se está hablando.
        </p>
        <p className="mt-3">
          La independencia no es una postura: es la condición para que esto sirva. Un espacio donde
          se habla de cómo enseña una cátedra solo funciona si nadie tiene que pedir permiso para
          escribir. La contracara es honesta: no tenemos datos oficiales, no podemos resolver un
          trámite, y si necesitás algo formal, el canal es la universidad.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">Qué no es</h2>
        <ul className="mt-3 space-y-3">
          <li>
            <span className="font-semibold">No es un canal oficial de la universidad.</span> Nada de
            lo que se publica acá tiene valor administrativo ni académico.
          </li>
          <li>
            <span className="font-semibold">No es un sitio de denuncias.</span> Una acusación grave
            contra una persona con nombre y apellido no se investiga acá: se denuncia en la
            universidad o en la justicia, que son los lugares donde puede investigarse de verdad.
          </li>
          <li>
            <span className="font-semibold">No es anónimo frente a la plataforma.</span> Anónimo
            significa que la comunidad no ve quién sos. El sistema registra qué cuenta publicó cada
            cosa, y ante una orden judicial válida hay que entregarlo.
          </li>
          <li>
            <span className="font-semibold">
              No es un lugar para material con derechos de autor.
            </span>{' '}
            Tus resúmenes y tus apuntes, sí. Libros escaneados y PDFs de editoriales, no.
          </li>
          <li>
            <span className="font-semibold">No es un mercado de trabajos hechos.</span> Comprar o
            vender trabajos, tesis o parciales robados perjudica a todos los que cursan con vos, y
            está prohibido.
          </li>
          <li>
            <span className="font-semibold">No hay mensajes privados.</span> Para hablar en privado
            ya tenés WhatsApp; un canal privado y anónimo es, sobre todo, un canal de acoso
            imposible de moderar.
          </li>
          <li>
            <span className="font-semibold">No es una red social de seguidores.</span> No hay
            métricas de vanidad, ni rachas, ni insignias, ni tabla de posiciones. Lo que se sigue
            son materias, no personas.
          </li>
          <li>
            <span className="font-semibold">No vive de tus datos.</span> No hay publicidad, no hay
            rastreadores y no se venden datos a nadie.
          </li>
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">Cómo se sostiene</h2>
        <p className="mt-3">
          Por ahora cuesta muy poco y lo paga el equipo. Si algún día hace falta dinero para que el
          sitio siga en pie, se va a decir públicamente y a discutir con la comunidad antes de tocar
          nada. Lo que no vamos a hacer es financiarlo con publicidad ni con la venta de datos.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">Cómo ayudar</h2>
        <p className="mt-3">
          Subí el resumen que ya tenés hecho, contestá una pregunta de tu materia, contá cómo
          tomaron un final y reportá lo que incumple las{' '}
          <Link className="text-accent underline" href="/reglas">
            Reglas
          </Link>
          . Un sitio como este no se llena solo: se llena porque cada camada le deja algo a la
          siguiente.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">Contacto</h2>
        <p className="mt-3">
          Para reportar contenido, usá la opción Reportar del propio contenido. Para apelar una
          decisión de moderación, entrá en{' '}
          <Link className="text-accent underline" href="/apelacion">
            /apelacion
          </Link>
          . La dirección de contacto para consultas, reclamos legales y pedidos sobre datos
          personales se publica acá antes del lanzamiento público.
        </p>
      </section>

      <footer className="mt-6 border-t border-border pt-4">
        <p className="text-m text-text-secondary">
          Ver las{' '}
          <Link className="text-accent underline" href="/reglas">
            Reglas de la comunidad
          </Link>
          , los{' '}
          <Link className="text-accent underline" href="/terminos">
            Términos y Condiciones
          </Link>{' '}
          y la{' '}
          <Link className="text-accent underline" href="/privacidad">
            Política de Privacidad
          </Link>
          .
        </p>
      </footer>
    </article>
  )
}
