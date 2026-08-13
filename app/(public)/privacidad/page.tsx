/**
 * app/(public)/privacidad/page.tsx — Política de Privacidad (C15, PART 9 §9.11).
 *
 * Server Component estático. El inventario de datos es el de PART 9 §9.11.3, sin adornos: lo que
 * decimos que guardamos es exactamente lo que un juez puede pedirnos. Si una migración agrega un
 * dato identificante, esta página se actualiza en el mismo PR (§9.11.3, regla permanente).
 */
import Link from 'next/link'
import type { Metadata } from 'next'

// El contenido vive en el repo, así que se revalida solo al deployar. NO es
// `force-static`: el header comparte layout y lee la sesión, así que una persona
// logueada tiene que recibir su propio chrome (su seudónimo, sus avisos) y no el
// HTML congelado del visitante anónimo.
export const revalidate = 86_400

export const metadata: Metadata = {
  title: 'Política de Privacidad',
  description:
    'Qué datos guardamos, cuáles decidimos no guardar, cuánto tiempo los conservamos, con quién los compartimos y cómo ejercer tus derechos de la Ley 25.326.',
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
        esta. El inventario de datos que sigue es igualmente exacto: describe lo que el sistema
        guarda de verdad, no lo que nos gustaría decir.
      </p>
    </aside>
  )
}

export default function PrivacidadPage() {
  return (
    <article className="mx-auto w-full max-w-170 py-6">
      <header>
        <h1 className="font-serif text-2xl font-semibold text-text-primary">
          Política de Privacidad
        </h1>
        <p className="mt-2 text-s text-text-secondary">Última actualización: {ACTUALIZADO}</p>
      </header>

      <AvisoBorrador />

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">Lo esencial</h2>
        <ul className="mt-3 space-y-3">
          <li>
            Guardamos lo mínimo para que el sitio funcione. Lo que no existe no se puede entregar.
          </li>
          <li>No guardamos tu dirección IP en nuestra base de datos.</li>
          <li>No usamos cookies de seguimiento ni analítica por usuario. No vendemos datos.</li>
          <li>
            Publicar como Anónimo te oculta frente a la comunidad, no frente al sistema:
            internamente queda registrado qué cuenta publicó cada cosa.
          </li>
          <li>Podés borrar tu cuenta cuando quieras, y elegís qué pasa con lo que publicaste.</li>
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">
          Quién trata tus datos
        </h2>
        <p className="mt-3">
          El responsable es el equipo de estudiantes que mantiene el sitio, en Argentina. El
          tratamiento se rige por la Ley 25.326 de Protección de los Datos Personales. La autoridad
          de control es la Agencia de Acceso a la Información Pública (AAIP), ante la cual podés
          hacer un reclamo si considerás que no respetamos tus derechos.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">Qué guardamos</h2>
        <dl className="mt-3 space-y-4">
          <div>
            <dt className="font-semibold text-text-primary">Tu correo electrónico</dt>
            <dd className="mt-1 text-text-secondary">
              Vive en el sistema de autenticación, junto con tu contraseña guardada como hash
              irreversible. Sirve para iniciar sesión, confirmar la cuenta y recuperar la
              contraseña. Nunca se muestra a otros usuarios. Es el único dato que conecta tu cuenta
              con el mundo real.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text-primary">Tu seudónimo</dt>
            <dd className="mt-1 text-text-secondary">
              Lo elegís vos y es lo que ve la comunidad. Si lo cambiás, guardamos el seudónimo
              anterior en cuarentena durante 90 días para que nadie más lo tome de inmediato. No
              publicamos el historial de nombres.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text-primary">Tu carrera y tu año, si los cargás</dt>
            <dd className="mt-1 text-text-secondary">
              Son opcionales. Sirven para armar tu feed y sugerirte materias. Podés dejarlos vacíos
              o borrarlos después.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text-primary">Lo que publicás</dt>
            <dd className="mt-1 text-text-secondary">
              Publicaciones, comentarios, recursos y los archivos que subís, con sus fechas de
              creación y de edición. Todo eso es público. Internamente cada contenido guarda qué
              cuenta lo publicó, también cuando elegiste Anónimo, y a qué alias de Anónimo
              correspondés dentro de cada hilo.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text-primary">Tus votos y tus materias seguidas</dt>
            <dd className="mt-1 text-text-secondary">
              Qué votaste y qué materias seguís. Los votos son anónimos para el resto de la
              comunidad, pero quedan asociados a tu cuenta para impedir la manipulación.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text-primary">Reportes y moderación</dt>
            <dd className="mt-1 text-text-secondary">
              Los reportes que hacés (asociados a tu cuenta, nunca visibles para la persona
              reportada) y las decisiones de moderación sobre tu contenido o tu cuenta, con su
              motivo y su fecha.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text-primary">Con qué invitación entraste</dt>
            <dd className="mt-1 text-text-secondary">
              Queda registrado qué código de invitación usaste y quién lo creó. Sirve contra las
              granjas de cuentas. Nunca le decimos a nadie quién usó su invitación.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text-primary">Descargas de los últimos 7 días</dt>
            <dd className="mt-1 text-text-secondary">
              Un registro efímero que existe solo para limitar abusos y para no contar dos veces la
              misma descarga. Se borra a los 7 días y no queda historial.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text-primary">Tus preferencias</dt>
            <dd className="mt-1 text-text-secondary">
              El tema claro u oscuro, guardado en una cookie del navegador, y si querés recibir
              avisos de respuestas.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text-primary">
              Un código irreversible de tu correo, solo si tu cuenta fue baneada
            </dt>
            <dd className="mt-1 text-text-secondary">
              Cuando una cuenta recibe un baneo permanente y luego se borra, conservamos un hash con
              clave secreta del correo. Sirve exactamente para una cosa: impedir que la misma
              persona se registre de nuevo. No permite reconstruir la dirección ni contactarte.
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">Qué no guardamos</h2>
        <p className="mt-3">
          Esta lista es tan importante como la anterior: lo que decidimos no registrar no puede
          filtrarse, ni venderse, ni ser exigido por nadie.
        </p>
        <ul className="mt-3 space-y-3">
          <li>
            <span className="font-semibold">Tu dirección IP</span> no se guarda en nuestra base de
            datos. Se usa de forma transitoria para limitar registros e intentos abusivos, y no
            queda asociada a tu perfil.
          </li>
          <li>
            <span className="font-semibold">Cookies de seguimiento: ninguna.</span> No hay
            publicidad, ni píxeles, ni redes de terceros. Las únicas cookies son la de tu sesión y
            la del tema visual.
          </li>
          <li>
            <span className="font-semibold">Analítica por usuario: ninguna.</span> No registramos
            qué páginas leés, cuánto tiempo te quedás ni desde dónde entrás. No hay historial de
            lectura.
          </li>
          <li>
            <span className="font-semibold">Historial durable de descargas: no existe.</span> Solo
            el registro de 7 días descripto arriba.
          </li>
          <li>
            <span className="font-semibold">Texto libre en la tabla de eventos: nunca.</span>{' '}
            Nuestra medición interna guarda un nombre de evento, un día y un contador, y nada más.
          </li>
          <li>
            No pedimos ni guardamos nombre real, DNI, teléfono, ubicación, contactos ni fotos de
            perfil.
          </li>
          <li>
            No hay indicador de conexión, ni última vez visto, ni confirmación de lectura: quién
            está en línea es información sobre vos que preferimos no tener.
          </li>
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">
          Cómo medimos el uso del sitio
        </h2>
        <p className="mt-3">
          Necesitamos saber si el sitio sirve, y lo medimos de la forma más pobre posible a
          propósito: contadores por día, sin ninguna vinculación con usuarios. Por ejemplo, cuántas
          publicaciones se crearon hoy o cuántas descargas hubo, nunca quién las hizo.
        </p>
        <p className="mt-3">
          Las búsquedas se guardan aparte, normalizadas y agrupadas por día, sin ninguna vinculación
          con la cuenta que buscó. Sirven para descubrir qué material falta en el sitio.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">
          Cuánto tiempo guardamos cada cosa
        </h2>
        <ul className="mt-3 space-y-3">
          <li>
            <span className="font-semibold">Avisos:</span> 90 días desde que los leíste, 180 días si
            nunca los abriste. Después se borran.
          </li>
          <li>
            <span className="font-semibold">Búsquedas:</span> 12 meses, agrupadas por día y sin
            vinculación con ninguna cuenta.
          </li>
          <li>
            <span className="font-semibold">Registro de descargas:</span> 7 días.
          </li>
          <li>
            <span className="font-semibold">Copias de seguridad:</span> un máximo de 90 días. Lo que
            borrás puede sobrevivir en una copia hasta ese plazo, y después desaparece.
          </li>
          <li>
            <span className="font-semibold">Contenido publicado:</span> mientras vos lo mantengas
            publicado y el sitio siga funcionando.
          </li>
          <li>
            <span className="font-semibold">Registro de moderación:</span> se conserva como registro
            inmutable. Si borrás tu cuenta, queda solo el identificador interno, sin correo ni
            seudónimo.
          </li>
          <li>
            <span className="font-semibold">Contadores agregados:</span> se conservan sin plazo,
            porque no identifican a nadie.
          </li>
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">
          Qué significa Anónimo, y qué no
        </h2>
        <p className="mt-3">
          Anónimo significa que los demás usuarios y los visitantes no ven tu identidad. El sistema
          sí registra qué cuenta publicó cada contenido, porque de eso dependen los límites, la
          moderación y la respuesta a un pedido judicial.
        </p>
        <p className="mt-3">
          Nunca publicamos, vendemos ni compartimos tu identidad. La entregamos únicamente ante una
          orden judicial u otra obligación legal válida en Argentina, y ese es un límite de la ley,
          no una decisión nuestra.
        </p>
        <p className="mt-3">
          El anonimato tiene límites técnicos que ninguna arquitectura resuelve: tu forma de
          escribir, los horarios en que publicás o los detalles que contás pueden delatarte en un
          curso de treinta personas. Los archivos que subís también pueden traer tu nombre adentro:
          quitamos los metadatos de las imágenes y, en lo posible, de los PDF, pero si algo no se
          puede limpiar te lo avisamos antes de publicar.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">Quién ve qué</h2>
        <ul className="mt-3 space-y-3">
          <li>
            <span className="font-semibold">La comunidad</span> ve lo que publicás y tu perfil
            público. Los perfiles no se indexan en los buscadores.
          </li>
          <li>
            <span className="font-semibold">Los moderadores</span> revisan el contenido reportado
            sin ver quién lo escribió. Existe una acción de excepción para revelar la autoría cuando
            hace falta detectar un patrón de abuso, y cada uso queda registrado de forma permanente.
          </li>
          <li>
            <span className="font-semibold">Quien opera la base de datos</span> tiene acceso técnico
            a todo, incluida la autoría del contenido anónimo. No hay tecnología que evite eso; hay
            disciplina, registros y el hecho de que lo digamos en voz alta.
          </li>
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">
          Proveedores que intervienen
        </h2>
        <p className="mt-3">
          El sitio se apoya en servicios de terceros que actúan como encargados del tratamiento: la
          base de datos y la autenticación, el alojamiento de la aplicación, el almacenamiento de
          los archivos, el envío de correos de la cuenta y el registro de errores técnicos. Esos
          proveedores mantienen sus propios registros técnicos, que pueden incluir direcciones IP,
          bajo sus propias políticas y fuera de nuestro control. Sus servidores pueden estar fuera
          de Argentina.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">
          Tus derechos (Ley 25.326)
        </h2>
        <ul className="mt-3 space-y-3">
          <li>
            <span className="font-semibold">Acceso:</span> podés pedirnos qué datos tenemos sobre
            vos. Respondemos dentro de los 10 días corridos. Es gratuito, con intervalos no menores
            a seis meses, salvo que acredites un interés legítimo.
          </li>
          <li>
            <span className="font-semibold">Rectificación y actualización:</span> si algún dato es
            inexacto, lo corregimos dentro de los 5 días hábiles.
          </li>
          <li>
            <span className="font-semibold">Supresión:</span> podés pedir que borremos tus datos,
            dentro de los mismos 5 días hábiles. Borrar la cuenta desde el sitio hace exactamente
            eso, sin trámite.
          </li>
          <li>
            Si considerás que no cumplimos, podés reclamar ante la Agencia de Acceso a la
            Información Pública.
          </li>
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">
          Cómo borrar tu cuenta
        </h2>
        <p className="mt-3">
          Se hace desde Ajustes, sin pedir permiso ni dar explicaciones. Antes de confirmar elegís
          qué pasa con lo que publicaste:
        </p>
        <ul className="mt-3 space-y-3">
          <li>
            <span className="font-semibold">Borrar también mis publicaciones.</span> Tus
            publicaciones, comentarios y recursos dejan de mostrarse y su texto se elimina.
          </li>
          <li>
            <span className="font-semibold">Conservarlas como usuario eliminado.</span> Lo que
            escribiste sigue disponible para quien lo esté leyendo, atribuido a una cuenta
            anonimizada sin ningún dato tuyo. Es la opción para no dejar hilos rotos ni vaciar la
            materia que ayudaste a armar.
          </li>
        </ul>
        <p className="mt-3">
          En los dos casos se borran tu correo, tu contraseña y tu seudónimo, y tu perfil queda como
          una cuenta eliminada. Del registro de moderación queda solo el identificador interno. Si
          tu cuenta tenía un baneo permanente, se conserva el código irreversible del correo
          descripto más arriba. La eliminación es definitiva: no hay forma de recuperar la cuenta
          después.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">Menores de edad</h2>
        <p className="mt-3">
          El sitio es para mayores de 16 años, según los{' '}
          <Link className="text-accent underline" href="/terminos">
            Términos y Condiciones
          </Link>
          . Si nos enteramos de que una cuenta pertenece a alguien menor de esa edad, la damos de
          baja y borramos sus datos.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">
          Cambios en esta política
        </h2>
        <p className="mt-3">
          Si cambia lo que guardamos o por cuánto tiempo, actualizamos esta página y anunciamos el
          cambio en el sitio. La fecha de última actualización está arriba.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-xl font-semibold text-text-primary">Contacto</h2>
        <p className="mt-3">
          La dirección de contacto para ejercer los derechos de acceso, rectificación y supresión se
          publica en{' '}
          <Link className="text-accent underline" href="/acerca">
            Acerca de
          </Link>{' '}
          antes del lanzamiento público. Mientras tanto, borrar la cuenta desde Ajustes ejerce el
          derecho de supresión de forma inmediata y sin intermediarios.
        </p>
      </section>

      <footer className="mt-6 border-t border-border pt-4">
        <p className="text-m text-text-secondary">
          Ver también las{' '}
          <Link className="text-accent underline" href="/reglas">
            Reglas de la comunidad
          </Link>{' '}
          y los{' '}
          <Link className="text-accent underline" href="/terminos">
            Términos y Condiciones
          </Link>
          .
        </p>
      </footer>
    </article>
  )
}
