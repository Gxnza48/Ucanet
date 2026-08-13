/**
 * app/(public)/terminos/page.tsx — Términos y Condiciones (C6, C15, C16, PART 11 §11.2/§11.7).
 *
 * Server Component estático. Borrador para revisión de un abogado argentino: cubre edad mínima,
 * carácter público del contenido, propiedad y licencia, material con derechos de autor, ausencia de
 * promesa de preservación (C6), sanciones, límite de responsabilidad, ley aplicable e independencia.
 * El nombre del producto sale de lib/config (D10): no se escribe a mano en ningún string.
 */
import Link from 'next/link'
import type { Metadata } from 'next'
import { SITE_NAME } from '@/lib/config'

// El contenido vive en el repo, así que se revalida solo al deployar. NO es
// `force-static`: el header comparte layout y lee la sesión, así que una persona
// logueada tiene que recibir su propio chrome (su seudónimo, sus avisos) y no el
// HTML congelado del visitante anónimo.
export const revalidate = 86_400

export const metadata: Metadata = {
  title: 'Términos y Condiciones',
  description:
    'Las condiciones de uso: edad mínima de 16 años, todo lo publicado es público, propiedad del contenido, material con derechos de autor, moderación y ley argentina aplicable.',
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
        esta. Lo publicamos igual porque preferimos decir desde el primer día bajo qué condiciones
        funciona el sitio, aunque la redacción todavía no sea la final.
      </p>
    </aside>
  )
}

export default function TerminosPage() {
  return (
    <article className="mx-auto w-full max-w-170 py-6">
      <header>
        <h1 className="font-serif text-2xl font-semibold text-text-primary">
          Términos y Condiciones
        </h1>
        <p className="mt-2 text-s text-text-secondary">Última actualización: {ACTUALIZADO}</p>
      </header>

      <AvisoBorrador />

      <section className="mt-6">
        <p>
          Estas condiciones regulan el uso de {SITE_NAME}. Usar el sitio, con cuenta o sin ella,
          significa aceptarlas. Están escritas para que se entiendan: si algo no se entiende,
          escribinos y lo reescribimos.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">1. Qué es este sitio</h2>
        <p className="mt-3">
          Es una comunidad estudiantil de la UCA Rosario hecha por estudiantes: cada materia y cada
          carrera tiene una página pública donde se publica, se pregunta y se comparte material de
          estudio. Es un servicio gratuito, sin publicidad y sin fines de lucro.
        </p>
        <p className="mt-3">
          El sitio es <span className="font-semibold">independiente</span> y no tiene ninguna
          afiliación con la Universidad Católica Argentina ni con ninguna otra institución. No es un
          canal oficial, no habla en nombre de la universidad y la universidad no responde por lo
          que se publica acá. Los nombres de la universidad, sus facultades y sus carreras se usan
          únicamente para identificar de qué se está hablando.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">
          2. Edad mínima: 16 años
        </h2>
        <p className="mt-3">
          Para tener cuenta necesitás 16 años cumplidos. Es una decisión de minimización: por debajo
          de esa edad la ley argentina exige recaudos adicionales que este sitio, con el equipo que
          tiene, no puede administrar con seriedad. No pedimos DNI ni verificamos la edad. Si nos
          enteramos de que una cuenta pertenece a alguien menor de 16 años, la damos de baja.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">3. Tu cuenta</h2>
        <ul className="mt-3 space-y-3">
          <li>
            El registro se hace con un enlace de invitación, un correo electrónico que puedas abrir
            y una contraseña. Elegís un seudónimo, y podés cambiarlo cada 90 días.
          </li>
          <li>
            Una persona, una cuenta. Crear cuentas adicionales para esquivar límites o sanciones
            está prohibido.
          </li>
          <li>
            Sos responsable de lo que se publica desde tu cuenta. No compartas la contraseña ni tu
            enlace de invitación con quien no conocés.
          </li>
          <li>
            Si perdés el acceso al correo y también la contraseña, la cuenta no se recupera. No
            tenemos otra forma de comprobar que sos vos, y no vamos a inventarla: eso mismo protege
            tu anonimato.
          </li>
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">
          4. Todo lo que publicás es público
        </h2>
        <p className="mt-3">
          <span className="font-semibold">
            Todo lo que publicás es público. Tu identidad real no.
          </span>{' '}
          Las publicaciones, los comentarios y los recursos se leen sin cuenta y los buscadores los
          indexan. No existe contenido privado, ni listas de amigos, ni mensajes directos. Si no
          querés que algo se lea, no lo publiques.
        </p>
        <p className="mt-3">
          Publicar como <span className="font-semibold">Anónimo</span> significa que los demás
          usuarios y los visitantes no ven tu seudónimo. El sistema sí registra qué cuenta publicó
          cada cosa: el anonimato es frente a la comunidad, no frente a la plataforma ni frente a
          una orden judicial válida.
        </p>
        <p className="mt-3">
          El anonimato también tiene límites técnicos que no dependen de nosotros: tu forma de
          escribir, los horarios en que publicás o los detalles que contás pueden identificarte en
          un curso chico. Publicá con criterio.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">
          5. De quién es lo que publicás
        </h2>
        <ul className="mt-3 space-y-3">
          <li>
            Lo que escribís y subís <span className="font-semibold">sigue siendo tuyo</span>. No te
            compramos nada ni te pedimos que nos cedas la titularidad.
          </li>
          <li>
            Al publicar nos das una licencia gratuita, no exclusiva y sin límite geográfico para
            alojar tu contenido, mostrarlo, permitir que los buscadores lo indexen y copiarlo en las
            copias de seguridad, con el único fin de hacer funcionar el sitio. No lo vendemos ni lo
            licenciamos a terceros.
          </li>
          <li>
            La licencia dura mientras el contenido esté publicado. Podés borrar lo tuyo cuando
            quieras y deja de mostrarse. Puede sobrevivir hasta 90 días en las copias de seguridad,
            y de forma indefinida en cachés y archivos de terceros que no controlamos, como los
            buscadores.
          </li>
          <li>
            Al publicar afirmás que tenés derecho a hacerlo: que el material es tuyo o que estás
            autorizado a compartirlo.
          </li>
          <li>
            Podemos remover contenido que incumpla las{' '}
            <Link className="text-accent underline" href="/reglas">
              Reglas de la comunidad
            </Link>{' '}
            o sobre el que un tercero acredite un derecho.
          </li>
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">
          6. Apuntes, parciales viejos y derechos de autor
        </h2>
        <p className="mt-3">
          Tus resúmenes, tus apuntes y tus guías son exactamente lo que el sitio existe para
          compartir. Lo que no se puede subir es material de otros: libros escaneados, capítulos
          enteros, PDFs de editoriales o las diapositivas completas de una cátedra. La ley argentina
          de propiedad intelectual (Ley 11.723) no tiene una excepción de copia privada equivalente
          a la de otros países, y subir ese material pone en riesgo a la persona que lo sube y al
          sitio entero.
        </p>
        <p className="mt-3">
          <span className="font-semibold">Sobre los parciales viejos</span>, que son parte de cómo
          se estudia en toda universidad, nuestra postura es esta, y está entre los puntos que un
          abogado tiene que revisar antes del lanzamiento:
        </p>
        <ul className="mt-3 space-y-3">
          <li>
            Se admite el enunciado de un parcial o final que rendiste o que circuló entre
            estudiantes, y se prefiere transcripto y acompañado de tu resolución o tus apuntes: el
            valor está en cómo se estudia para esa materia, no en la fotocopia.
          </li>
          <li>
            No se admite material obtenido sin autorización. Un examen filtrado antes de tomarse, o
            material entregado con la condición expresa de no compartirlo, no se publica ni se vende
            (Regla 8).
          </li>
          <li>
            No se admiten las resoluciones oficiales de la cátedra ni el material propio de la
            cátedra publicado como si fuera un apunte de estudiante.
          </li>
          <li>
            Si el titular de derechos reclama, el material se baja mientras se revisa el reclamo. El
            procedimiento y la escalera de reincidencia están en las{' '}
            <Link className="text-accent underline" href="/reglas#derechos-de-autor">
              Reglas
            </Link>
            .
          </li>
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">
          7. Conducta, suspensiones y baneos
        </h2>
        <p className="mt-3">
          Las{' '}
          <Link className="text-accent underline" href="/reglas">
            Reglas de la comunidad
          </Link>{' '}
          forman parte de estas condiciones y son las únicas reglas: no hay reglas secretas.
          Incumplirlas puede derivar, según la gravedad y los antecedentes, en la remoción del
          contenido, una advertencia, una suspensión de 7 o 30 días o un baneo permanente.
        </p>
        <p className="mt-3">Se sanciona con baneo, sin escalera previa:</p>
        <ul className="mt-3 space-y-3">
          <li>publicar contenido ilegal o amenazas (Reglas 3 y 7);</li>
          <li>evadir una suspensión con otra cuenta (Regla 12);</li>
          <li>subir un archivo malicioso;</li>
          <li>
            revelar o intentar revelar la identidad de otro usuario, con más razón si sos moderador.
          </li>
        </ul>
        <p className="mt-3">
          Toda sanción te llega con su motivo y la regla que la fundamenta, y podés apelarla una vez
          dentro de los 30 días en{' '}
          <Link className="text-accent underline" href="/apelacion">
            /apelacion
          </Link>
          . También podemos suspender el servicio a una cuenta cuando sea necesario para proteger a
          la comunidad o al sitio de un daño inminente, informando el motivo.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">
          8. No prometemos guardar todo para siempre
        </h2>
        <p className="mt-3">
          El sitio está pensado para durar y las direcciones de sus páginas son un compromiso de
          largo plazo: lo que hoy está en una materia debería seguir ahí dentro de diez años. Aun
          así,{' '}
          <span className="font-semibold">no prometemos conservar todo de forma permanente</span>, y
          no queremos prometerlo: tu derecho a borrar lo que escribiste vale más que nuestro deseo
          de archivarlo.
        </p>
        <p className="mt-3">Contenido puede desaparecer porque:</p>
        <ul className="mt-3 space-y-3">
          <li>su autor lo borró o borró su cuenta;</li>
          <li>la moderación lo removió por incumplir las Reglas;</li>
          <li>un titular de derechos reclamó y el reclamo prosperó;</li>
          <li>una orden judicial lo dispuso;</li>
          <li>el servicio dejó de funcionar.</li>
        </ul>
        <p className="mt-3">
          El archivo del sitio es lo que sigue existiendo, más estadísticas agregadas y anónimas;
          nunca una copia congelada que reviva contenido borrado. Si algo te importa de verdad,
          guardá tu propia copia.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">
          9. El servicio se ofrece como está
        </h2>
        <p className="mt-3">
          El sitio es gratuito y se ofrece tal como está, sin garantía de disponibilidad continua,
          de conservación de datos ni de que funcione para un fin determinado. Puede haber caídas,
          mantenimiento, cambios de funcionalidades o cierre del servicio. Si el cierre llegara a
          ocurrir, avisaremos con la mayor anticipación posible y con tiempo para que descargues lo
          tuyo.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">
          10. Límite de responsabilidad
        </h2>
        <p className="mt-3">
          El contenido lo escriben estudiantes. No verificamos si un resumen es correcto, si una
          fecha de parcial es cierta, si un apunte está actualizado ni si una opinión sobre una
          cátedra es justa. Contrastar esa información es tu responsabilidad.
        </p>
        <p className="mt-3">En la medida en que la ley argentina lo permita, no respondemos por:</p>
        <ul className="mt-3 space-y-3">
          <li>decisiones académicas o de cualquier otro tipo tomadas a partir del contenido;</li>
          <li>el contenido publicado por otros usuarios, ni por los archivos que descargues;</li>
          <li>interrupciones del servicio, pérdida de datos o cierre del sitio;</li>
          <li>
            el uso que terceros hagan de lo que publicaste, que es público y puede copiarse fuera
            del sitio.
          </li>
        </ul>
        <p className="mt-3">
          Nada de esto limita los derechos que la ley argentina te reconozca de manera indisponible,
          incluidos los que surgen de las normas de defensa del consumidor y de protección de datos
          personales.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">
          11. Cambios en estas condiciones
        </h2>
        <p className="mt-3">
          Podemos actualizar estas condiciones. Los cambios relevantes se anuncian en el sitio con
          una fecha de vigencia y la fecha de última actualización queda arriba de esta página. Si
          no estás de acuerdo con una versión nueva, podés borrar tu cuenta. Los cambios no se
          aplican de forma retroactiva a sanciones ya resueltas.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">
          12. Ley aplicable y jurisdicción
        </h2>
        <p className="mt-3">
          Estas condiciones se rigen por las leyes de la República Argentina. Cualquier controversia
          se somete a los tribunales ordinarios de la ciudad de Rosario, provincia de Santa Fe,
          salvo que una norma imperativa disponga otro fuero, como ocurre con las normas de defensa
          del consumidor. Este punto está marcado para revisión del abogado.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">13. Contacto</h2>
        <p className="mt-3">
          Para reportar contenido, usá la opción Reportar del propio contenido. Para apelar una
          decisión de moderación, entrá en{' '}
          <Link className="text-accent underline" href="/apelacion">
            /apelacion
          </Link>
          . La dirección de contacto para reclamos legales y pedidos sobre datos personales se
          publica en{' '}
          <Link className="text-accent underline" href="/acerca">
            Acerca de
          </Link>{' '}
          antes del lanzamiento público.
        </p>
      </section>

      <footer className="mt-6 border-t border-border pt-4">
        <p className="text-m text-text-secondary">
          Ver también las{' '}
          <Link className="text-accent underline" href="/reglas">
            Reglas de la comunidad
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
