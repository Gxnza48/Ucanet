/**
 * app/(public)/reglas/page.tsx — Reglas de la comunidad (PART 11 §11.2, §11.3, §11.5).
 *
 * Server Component estático: sin JS de ruta, sin datos. El texto de las doce reglas es normativo
 * (PART 11 §11.2) y las acciones de moderación lo citan por número, así que cada regla lleva un
 * ancla estable (#regla-N). Cambiar la redacción de una regla exige actualizar PART 11 primero.
 */
import Link from 'next/link'
import type { Metadata } from 'next'

// El contenido vive en el repo, así que se revalida solo al deployar. NO es
// `force-static`: el header comparte layout y lee la sesión, así que una persona
// logueada tiene que recibir su propio chrome (su seudónimo, sus avisos) y no el
// HTML congelado del visitante anónimo.
export const revalidate = 86_400

export const metadata: Metadata = {
  title: 'Reglas de la comunidad',
  description:
    'Las doce reglas de la comunidad, las doce categorías de reporte, las sanciones posibles y cómo se apela una decisión de moderación.',
}

const ACTUALIZADO = '13 de agosto de 2026'

/** Aviso de borrador legal (C15, [LEGAL REVIEW]). Inline y local: no es una primitiva del sistema. */
function AvisoBorrador() {
  return (
    <aside className="mt-4 rounded-container border border-border bg-surface-raised p-4">
      <p className="text-m font-semibold text-text-primary">
        Borrador pendiente de revisión por un abogado
      </p>
      <p className="mt-1 text-m text-text-secondary">
        Este texto lo escribió el equipo del sitio y todavía no lo revisó un abogado argentino.
        Antes del lanzamiento público lo revisa un profesional y la versión definitiva reemplaza a
        esta. Mientras tanto vale como descripción honesta de cómo moderamos, no como asesoramiento
        legal.
      </p>
    </aside>
  )
}

const CATEGORIAS: ReadonlyArray<{ label: string; regla: string; detalle: string }> = [
  {
    label: 'Spam o publicidad',
    regla: 'Regla 5',
    detalle:
      'Publicaciones repetidas, cadenas, publicidad de terceros, links de referidos o promoción constante de un emprendimiento.',
  },
  {
    label: 'Acoso u hostigamiento',
    regla: 'Regla 2',
    detalle:
      'Alguien insiste contra una persona, coordina cargadas o la sigue de hilo en hilo para atacarla.',
  },
  {
    label: 'Amenazas o violencia',
    regla: 'Regla 3',
    detalle:
      'Se amenaza a alguien, se incita a lastimarlo o se celebra el daño. Categoría prioritaria: se revisa primero.',
  },
  {
    label: 'Datos personales de alguien',
    regla: 'Regla 1',
    detalle:
      'Teléfonos, direcciones, mails, fotos privadas, capturas de chat con nombres visibles o cuentas de redes de una persona que no lo eligió. Categoría prioritaria.',
  },
  {
    label: 'Ataque o acusación a una persona con nombre',
    regla: 'Regla 4',
    detalle:
      'Se acusa a una persona identificada de un delito o una falta grave, o se la ataca por su aspecto o su vida privada en lugar de hablar de la cursada.',
  },
  {
    label: 'Se hace pasar por otro',
    regla: 'Regla 6',
    detalle:
      'Una cuenta se presenta como otra persona real, como una cátedra, como la universidad o como el equipo de moderación.',
  },
  {
    label: 'Contenido ilegal',
    regla: 'Regla 7',
    detalle:
      'Contenido cuya sola publicación es un delito. Categoría prioritaria: se revisa primero y puede terminar en denuncia.',
  },
  {
    label: 'Venta indebida o fraude académico',
    regla: 'Regla 8',
    detalle:
      'Venta de cosas que no son material de estudio, parciales obtenidos sin autorización, trabajos por encargo o suplantación en un examen.',
  },
  {
    label: 'Infringe derechos de autor',
    regla: 'Regla 9',
    detalle:
      'Material de un tercero subido sin derecho: libros escaneados, capítulos, PDFs de editoriales, diapositivas completas de una cátedra. Pedimos que cuentes qué obra es y quién es el titular, porque sin eso no se puede revisar.',
  },
  {
    label: 'Contenido sexual explícito',
    regla: 'Regla 10',
    detalle: 'Pornografía o material sexual explícito, que no tiene lugar acá.',
  },
  {
    label: 'Votos manipulados o cuentas falsas',
    regla: 'Regla 11',
    detalle:
      'Votos coordinados, autovotos con otra cuenta o cuentas creadas para esquivar límites o suspensiones.',
  },
  {
    label: 'Otro',
    regla: 'Sin regla fija',
    detalle:
      'Algo que incumple el espíritu de las reglas y no entra en ninguna categoría. Pedimos que expliques qué pasa, porque sin explicación no se puede actuar.',
  },
]

export default function ReglasPage() {
  return (
    <article className="mx-auto w-full max-w-170 py-6">
      <header>
        <h1 className="font-serif text-2xl font-semibold text-text-primary">
          Reglas de la comunidad
        </h1>
        <p className="mt-2 text-s text-text-secondary">
          Versión 1 · Última actualización: {ACTUALIZADO}
        </p>
      </header>

      <AvisoBorrador />

      <section className="mt-6">
        <p>
          Acá podés hablar con libertad: con tu seudónimo o como Anónimo, nadie sabe quién sos. Pero
          el anonimato no es impunidad: el sistema sabe qué cuenta publicó cada cosa, y estas reglas
          se aplican a todas las cuentas por igual. Son las únicas reglas; no hay reglas secretas.
        </p>
        <p className="mt-3">
          Todo lo demás se ordena con una sola línea rectora:{' '}
          <span className="font-semibold">experiencias sí, ataques a personas no</span>. Podés
          contar con total libertad cómo te fue en una cursada, cómo toma una cátedra o qué te
          pareció una materia. Lo que no podés hacer es usar el sitio para atacar a alguien.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">Las doce reglas</h2>
        <ol className="mt-4 space-y-4">
          <li id="regla-1" className="scroll-mt-6">
            <p>
              <span className="font-semibold">
                1. No publiques datos personales de otras personas.
              </span>{' '}
              Nombres junto a teléfonos, direcciones, mails, fotos privadas, capturas de chats con
              nombres visibles, cuentas de redes: nada que permita identificar o contactar a alguien
              que no lo eligió. Esto aplica a estudiantes, docentes y cualquier tercero. Es la regla
              que más rápido se modera.
            </p>
          </li>
          <li id="regla-2" className="scroll-mt-6">
            <p>
              <span className="font-semibold">2. No acoses ni hostigues.</span> Insistir sobre una
              persona, coordinar cargadas contra alguien, seguir a un usuario de hilo en hilo para
              atacarlo. Una crítica es una crítica; una campaña es acoso.
            </p>
          </li>
          <li id="regla-3" className="scroll-mt-6">
            <p>
              <span className="font-semibold">3. Nada de amenazas ni violencia.</span> Amenazas,
              incitación a la violencia o celebración del daño a una persona. Sin excepciones ni
              «era un chiste». Es remoción inmediata y casi siempre suspensión.
            </p>
          </li>
          <li id="regla-4" className="scroll-mt-6">
            <p>
              <span className="font-semibold">4. Contá tu experiencia; no ataques a personas.</span>{' '}
              Podés opinar con total libertad sobre cátedras, materias, parciales y formas de
              enseñar y de tomar examen: «las clases son un caos», «toma más difícil de lo que
              enseña», «recomiendo la comisión de la tarde». Lo que no podés hacer es (a) acusar a
              una persona con nombre y apellido de un delito o de una falta grave (coimas, acoso,
              discriminación) — si viviste o presenciaste algo así, denuncialo en los canales
              formales de la universidad o en la justicia, donde puede investigarse de verdad; acá
              solo expone a la comunidad y no ayuda a nadie —, (b) burlarte del aspecto, la vida
              privada o la persona en lugar de la cursada, o (c) publicar datos personales de
              docentes más allá del nombre y el cargo. Opinión sobre el trabajo: sí. Ataque a la
              persona o acusación de delito: no.
            </p>
          </li>
          <li id="regla-5" className="scroll-mt-6">
            <p>
              <span className="font-semibold">5. No hagas spam.</span> Publicaciones repetidas,
              cadenas, publicidad de terceros, links de referidos, promoción constante de tu propio
              emprendimiento. La autopromoción ocasional y relevante (tu resumen, tu grupo de
              estudio) está bien; el resto no.
            </p>
          </li>
          <li id="regla-6" className="scroll-mt-6">
            <p>
              <span className="font-semibold">6. No te hagas pasar por otro.</span> Ni por otra
              persona real, ni por una cátedra, ni por la universidad, ni por los moderadores. Los
              seudónimos son libres; la suplantación no.
            </p>
          </li>
          <li id="regla-7" className="scroll-mt-6">
            <p>
              <span className="font-semibold">7. Nada de contenido ilegal.</span> Contenido sexual
              de menores, venta de drogas, instrucciones para dañar a otros, o cualquier contenido
              cuya publicación sea un delito. Remoción inmediata, ban y, cuando corresponda,
              denuncia.
            </p>
          </li>
          <li id="regla-8" className="scroll-mt-6">
            <p>
              <span className="font-semibold">
                8. La compraventa va solo en Recursos, y solo de material de estudio.
              </span>{' '}
              No uses la plataforma para vender otra cosa (entradas, ropa, servicios), y nunca para
              fraude académico: comprar o vender parciales robados, hacer trabajos o tesis por
              encargo, o suplantar a alguien en un examen. Eso perjudica a todos los que cursan con
              vos.
            </p>
          </li>
          <li id="regla-9" className="scroll-mt-6">
            <p>
              <span className="font-semibold">9. Subí material que puedas compartir.</span> Tus
              resúmenes, tus apuntes, tus guías: bienvenidos. Libros escaneados, capítulos enteros,
              PDFs de editoriales o diapositivas completas de una cátedra: no, porque tienen
              derechos de autor y ponen en riesgo al sitio. Si un titular reclama, el material se
              baja y las infracciones repetidas suspenden tu cuenta (ver{' '}
              <Link className="text-accent underline" href="/reglas#derechos-de-autor">
                Reclamos por derechos de autor
              </Link>
              , más abajo).
            </p>
          </li>
          <li id="regla-10" className="scroll-mt-6">
            <p>
              <span className="font-semibold">10. Nada de contenido sexual explícito.</span> Este es
              un espacio de vida universitaria, no un sitio de adultos. El humor subido de tono
              sobrevive; la pornografía no.
            </p>
          </li>
          <li id="regla-11" className="scroll-mt-6">
            <p>
              <span className="font-semibold">
                11. No manipules los votos ni uses cuentas múltiples.
              </span>{' '}
              Votarte con otra cuenta, coordinar votos, crear cuentas para esquivar límites o
              suspensiones. El sistema lo detecta y las sanciones caen sobre todas las cuentas
              involucradas.
            </p>
          </li>
          <li id="regla-12" className="scroll-mt-6">
            <p>
              <span className="font-semibold">12. Respetá las decisiones de moderación.</span> Toda
              acción te llega con su motivo y podés apelarla una vez desde el aviso o en{' '}
              <Link className="text-accent underline" href="/apelacion">
                /apelacion
              </Link>
              ; la revisa otra persona distinta de quien decidió. Lo que no podés hacer es evadir
              una suspensión con otra cuenta: eso convierte la suspensión en ban.
            </p>
          </li>
        </ol>
        <p className="mt-4">
          Estas reglas pueden ajustarse; cada cambio se anuncia y queda registrado. Lo que era
          válido cuando lo publicaste no se sanciona retroactivamente, pero puede removerse si una
          regla nueva lo prohíbe.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">
          Cómo reportar: las doce categorías
        </h2>
        <p className="mt-3">
          Toda publicación, comentario, recurso y perfil tiene un menú con la opción Reportar.
          Elegís una de estas doce categorías y, si querés, agregás un detalle. Reportar necesita
          cuenta: los reportes nunca se muestran a quien fue reportado, pero quedan asociados a
          quien los hizo, porque el reporte falso también es un abuso.
        </p>
        <dl className="mt-4 space-y-4">
          {CATEGORIAS.map((categoria) => (
            <div key={categoria.label}>
              <dt className="font-semibold text-text-primary">
                {categoria.label}{' '}
                <span className="text-s font-normal text-text-secondary">· {categoria.regla}</span>
              </dt>
              <dd className="mt-1 text-text-secondary">{categoria.detalle}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">
          Qué pasa después de tu reporte
        </h2>
        <ul className="mt-3 space-y-3">
          <li>
            Cada reporte termina siempre en un aviso para vos, tanto si removimos el contenido como
            si no encontramos un incumplimiento. Sin ese aviso, reportar sería trabajo a ciegas.
          </li>
          <li>
            No te contamos qué sanción recibió la otra cuenta. Las sanciones son entre la plataforma
            y la cuenta sancionada.
          </li>
          <li>
            Si reportás dos veces lo mismo, no se duplica: el sistema te avisa que ya está en
            revisión.
          </li>
          <li>
            Amenazas, datos personales y contenido ilegal se revisan antes que el resto, sin
            importar el orden de llegada.
          </li>
          <li>
            Reportar todo lo que no te gusta no se castiga, pero baja tu límite diario de reportes:
            la cola es un recurso compartido.
          </li>
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">
          Qué puede hacer un moderador
        </h2>
        <p className="mt-3">
          Las sanciones son estas, en orden. Toda sanción por contenido incluye la remoción de ese
          contenido: no suspendemos a alguien y dejamos publicado lo que motivó la suspensión.
        </p>
        <ul className="mt-3 space-y-3">
          <li>
            <span className="font-semibold">Remoción.</span> El contenido deja de verse. Te llega el
            aviso con la regla que incumplió.
          </li>
          <li>
            <span className="font-semibold">Advertencia.</span> Queda registrada y cuenta para la
            escalera.
          </li>
          <li>
            <span className="font-semibold">Suspensión de 7 o 30 días.</span> Podés leer, no podés
            publicar, comentar, votar, subir recursos ni reportar.
          </li>
          <li>
            <span className="font-semibold">Baneo permanente.</span> Se reserva para amenazas,
            contenido ilegal, evasión de suspensiones y reincidencia grave.
          </li>
          <li>
            <span className="font-semibold">Cierre de un hilo.</span> Cuando una discusión se
            descontrola, se cierra a comentarios nuevos y el contenido queda visible.
          </li>
        </ul>
        <p className="mt-3">
          Las sanciones vencen: una acción de hace más de doce meses no cuenta para la escalera. La
          gente cambia entre primer año y quinto.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">Apelaciones</h2>
        <p className="mt-3">
          Podés apelar una vez cada decisión, dentro de los 30 días, desde el aviso que recibiste o
          en{' '}
          <Link className="text-accent underline" href="/apelacion">
            /apelacion
          </Link>
          . Estar suspendido o baneado no te impide apelar: la restricción bloquea la participación,
          no el derecho a que te revisen. La apelación la revisa alguien distinto de quien tomó la
          decisión. Somos honestos con el límite: mientras el equipo sea muy chico, puede tocarle a
          la misma persona, esta vez leyendo tu descargo.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">
          Moderación y anonimato
        </h2>
        <p className="mt-3">
          Los moderadores ven el contenido reportado sin saber quién lo escribió: se juzga el
          contenido, no la persona. Existe una acción de excepción para revelar la autoría cuando
          hace falta detectar un patrón (la misma cuenta hostigando en varios hilos), y cada uso
          queda registrado de forma permanente con quién lo hizo, cuándo y por qué. Nunca revelamos
          públicamente la identidad de nadie, por ninguna falta: una cuenta baneada está baneada, no
          exhibida.
        </p>
      </section>

      <section id="derechos-de-autor" className="mt-6 scroll-mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">
          Reclamos por derechos de autor
        </h2>
        <p className="mt-3">
          Si sos titular de derechos sobre material publicado acá, o representás a quien lo es,
          podés reclamar aunque no tengas cuenta. Necesitamos tres cosas: qué obra es y dónde está
          publicada en el sitio, en qué carácter reclamás, y un contacto para responderte.
        </p>
        <p className="mt-3">
          Revisamos el reclamo dentro de las 72 horas. Si es verosímil, el material se baja y se
          avisa a quien lo subió con el resumen del reclamo. Quien lo subió puede responder que el
          material es propio y pedir revisión; en caso de duda razonable el material queda abajo.
          Todo el trámite queda registrado con sus fechas.
        </p>
        <p className="mt-3">
          Las infracciones confirmadas escalan: la primera es advertencia, la segunda dentro de doce
          meses suspende la subida de recursos por 30 días, la tercera la suspende de forma
          permanente.
        </p>
      </section>

      <footer className="mt-6 border-t border-border pt-4">
        <p className="text-m text-text-secondary">
          Ver también los{' '}
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
