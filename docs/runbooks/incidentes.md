# Runbook — Incidentes

Un equipo de una persona no puede correr un playbook de NIST. Puede correr un ritual de una página con las decisiones ya tomadas. Esto es ese ritual (PART 10 §10.14).

**La forma de todo incidente es la misma:** contener → evaluar → notificar → aprender. Contener primero aunque no entiendas todavía qué pasó; entender después. El error que no se perdona no es tardar en arreglar: es enterarse tarde y contarlo tarde.

## Los primeros cinco minutos

| Mirá               | Dónde                          | Qué te dice                                                  |
| ------------------ | ------------------------------ | ------------------------------------------------------------ |
| Salud del servicio | `GET /api/health`              | 200 + `{ db: ok }` = la base responde                        |
| Errores            | Sentry                         | Pico de errores nuevos, con stack y ruta                     |
| Disponibilidad     | UptimeRobot (mail al fundador) | Desde cuándo está caído                                      |
| Abuso              | `/mod` — cola de reportes      | Volumen y antigüedad; un pico es señal                       |
| Actividad rara     | `/mod/metricas`                | Publicaciones/hora, altas, descargas contra su línea de base |

Si no sabés qué está pasando pero algo está mal en la dirección de "alguien está abusando o filtrando datos": **usá un kill-switch primero y averiguá después**. Volver a prenderlo cuesta un `update`.

---

## Kill-switches

Viven en la tabla `app_settings` (migración 0009) y las RPC de escritura las leen en su paso de guarda: el efecto es instantáneo y **no requiere deploy**. Solo el rol `admin` puede leerlas y cambiarlas por RLS.

| Clave                    | Semántica                                                                | Efecto                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `registro_abierto`       | `false` = el registro público está cerrado; solo se entra con invitación | Lo lee `handle_new_user` (migración 0004): un alta sin código de invitación válido levanta `INVITE_INVALID` y aborta el signup entero |
| `publicaciones_pausadas` | `true` = se corta la creación de contenido                               | Freno de mano ante una ola de abuso                                                                                                   |
| `subidas_pausadas`       | `true` = se corta el pipeline de archivos                                | Freno independiente: cuota de R2, reclamo de derechos de autor                                                                        |
| `read_only`              | `true` = las escrituras se rechazan con `KILL_SWITCH`                    | Modo lectura. Lo leen `create_report` y `create_appeal` (migración 0012)                                                              |
| `uploads_paused`         | `true` = `request_upload` corta con `KILL_SWITCH`                        | Lo lee la RPC de subida (migración 0011)                                                                                              |

**Ausencia de la clave = interruptor apagado.** Así lo interpretan todas las RPC.

### Cómo se accionan

No hay pantalla de administración todavía. En un incidente se hace por SQL, con el rol de servicio (`psql` con `SUPABASE_DB_URL`, o el editor SQL del proyecto — cambiar el **valor de una fila es dato, no esquema**, así que no viola D14.1; lo que nunca se toca desde el dashboard es el DDL).

```sql
-- 1. Ver qué hay realmente cargado, antes de confiar en nada:
select key, value, updated_at from public.app_settings order by key;

-- 2. Prender un freno (ejemplo: pausar subidas de archivos):
update public.app_settings
   set value = 'true'::jsonb, updated_at = now()
 where key = 'subidas_pausadas';

-- 3. Si la clave que la RPC lee todavía no existe, hay que crearla:
insert into public.app_settings (key, value)
values ('read_only', 'true'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

-- 4. Apagar el freno cuando pasó:
update public.app_settings set value = 'false'::jsonb, updated_at = now() where key = '...';
```

**Cada flip se registra a mano** con una línea en `docs/decisions.md` (qué clave, a qué valor, por qué, cuándo se revirtió). El plan pide una fila en `mod_actions` por cada flip; hoy no hay RPC que la escriba, así que la anotación es el registro.

### Deuda conocida — verificá las claves antes de contar con ellas

Las claves que **siembra** la migración 0009 y las que **leen** las RPC no coinciden del todo. Estado real del repositorio:

| Clave                    | La siembra 0009 | La lee                                  | Sirve hoy                  |
| ------------------------ | --------------- | --------------------------------------- | -------------------------- |
| `registro_abierto`       | sí (`false`)    | `handle_new_user` (0004)                | sí                         |
| `publicaciones_pausadas` | sí (`false`)    | nadie                                   | **no**                     |
| `subidas_pausadas`       | sí (`false`)    | nadie                                   | **no**                     |
| `uploads_paused`         | no              | RPC de subida (0011)                    | sí, si la insertás         |
| `read_only`              | no              | `create_report`, `create_appeal` (0012) | parcial: solo esas dos RPC |

Antes de apoyarte en un freno, corré la consulta 1 de arriba y, si tenés dudas, `grep -rn "app_setting(\|s.key = " supabase/migrations/` para ver qué clave lee cada función. La corrección —unificar los nombres y chequear el freno en todas las RPC de escritura— es una migración pendiente; mientras tanto, la vía segura para frenar todo es la del escenario 3, punto 2.

---

## Escenario 1 — Fuga de datos

El que importa: sospecha de que alguien accedió al mapa interno de autoría (qué cuenta escribió qué contenido anónimo) o al padrón de emails. Si la plataforma pierde esto, pierde su razón de existir.

**Señales de alarma:** un test pgTAP de negación que se pone rojo · un evento en Sentry que contiene campos de autor en un payload anónimo · un usuario que reporta ver autoría donde no debería haberla · un acceso a `mod_reveal_author` sin justificación en la auditoría · una credencial de servicio publicada por error.

### 1. Contener (primera hora)

- [ ] Poner el sitio en modo lectura (`read_only = true`; ver la deuda conocida de arriba).
- [ ] Rotar la **service-role key** y la **anon key** desde el dashboard de Supabase, y actualizarlas en Vercel.
- [ ] Rotar el **`CRON_SECRET`** y la contraseña de la base.
- [ ] Rotar el **JWT secret** del proyecto: cierra todas las sesiones de todos los usuarios. Es el interruptor global.
- [ ] Rotar las credenciales de **R2** si el vector pudo tocarlas.
- [ ] Si el vector sospechado es la máquina del fundador: cambiar también las credenciales de GitHub, Vercel, Supabase, registrador y correo, todas con TOTP.

### 2. Evaluar (mismo día)

Los logs de Supabase Free retienen poco (del orden de un día): **actuá rápido o perdés la evidencia**. Fuentes: logs de auth y de PostgREST, filas de `mod_actions` (especialmente `revelar_autor`), diferencias entre el último dump y el anterior, logs de Vercel (retención de una hora).

Definí tres cosas por escrito: **qué** era accesible (¿el mapa de autoría, o solo emails?), **para quién**, y **durante qué ventana**.

### 3. Notificar (dentro de las 72 horas, antes si se puede)

A los afectados primero, por aviso in-app y por mail, en el registro honesto:

> "Detectamos un acceso indebido a datos internos entre [fecha] y [fecha]. Pudo haber expuesto qué cuenta escribió contenido anónimo. Te lo contamos porque preferimos que lo sepas por nosotros."

La Ley 25.326 vigente no impone un deber general de notificación; la AAIP la recomienda y los proyectos de reforma la exigen. **[REVISIÓN LEGAL]** pendiente: forma exacta de la notificación y si se notifica a la AAIP de oficio. La dirección del error está elegida de antemano: **se notifica de más, nunca de menos**. Un silencio que se descubre después termina con la plataforma.

### 4. Aprender (dentro de la semana)

Línea de tiempo y postmortem commiteados al repositorio. Cada "no pudimos saberlo" se convierte en un ítem de backlog. Entrada en `docs/decisions.md`.

**Variante sin evidencia de uso** (una credencial se filtró pero nada indica que se haya usado): rotar y monitorear, sin aviso a usuarios salvo que la evaluación cambie. Igual va el postmortem.

---

## Escenario 2 — Contenido ilegal

Cuatro casos distintos con respuestas distintas. No los mezcles.

### a. Reclamo de derechos de autor (Ley 11.723)

Argentina no tiene DMCA, pero la forma operativa es la misma: los reclamos de copyright suelen ser **verificables a simple vista**, así que se honran ante una notificación privada plausible, sin exigir orden judicial.

1. **Entrada**: categoría de reporte `infraccion_autor`, o el formulario enlazado desde `/reglas` (también lo usan quienes no tienen cuenta: una editorial, CADRA). Campos obligatorios: obra identificada, titularidad alegada, contacto del reclamante.
2. **Revisión dentro de 72 horas** (SLA). Si el reclamo es plausible —capítulos escaneados de libros, diapositivas de cátedra, PDF de editorial— se remueve con `mod_legal_takedown_resource` y se notifica al autor con el resumen del reclamo y un strike.
3. **Contra-notificación**: quien subió puede alegar autoría propia ("es mi propio resumen") por `/apelacion`. Un mod re-revisa. **En la duda, queda abajo**: sobre-remover un resumen es más barato que la exposición penal de los artículos 71–72.
4. **Todo queda registrado**: cada notificación, decisión y timestamp. Ese papel es la defensa de diligencia.

### b. Contenido manifiestamente ilegal

Amenazas creíbles, material de abuso infantil, doxxing con datos personales de terceros, incitación a la violencia. **Se actúa el mismo día, sin esperar reporte formal**: `mod_remove_post` / `mod_remove_comment` / `mod_remove_resource`, restricción del autor según la escalera de PART 11, y `mod_actions` deja la auditoría. En el caso de material de abuso infantil, además: preservar la evidencia sin difundirla y hacer la denuncia. **[REVISIÓN LEGAL]** para el canal exacto de denuncia.

### c. Difamación discutible

No es lo mismo. Un ataque a una persona nombrada que el reclamante considera injurioso pero que podría ser opinión o experiencia legítima: se aplica la regla de la comunidad ("experiencias sí, ataques a personas no") por la vía de moderación normal, y la remoción por vía legal **espera una orden judicial**. Las páginas de profesores no existen en el MVP justamente por esto (C9).

### d. Requerimiento judicial o policial

**No se borra ni se revela nada el mismo día, en pánico.** Se acusa recibo, se consulta con el abogado, y recién después se responde. Si el pedido es identificar a un autor anónimo, la revelación pasa sí o sí por `mod_reveal_author` con razón declarada, que deja fila inmutable en `mod_actions`. Lo que nunca se hizo no se puede entregar: la minimización de datos es parte de la respuesta.

---

## Escenario 3 — Brigada de spam o raid

Una ola de cuentas nuevas publicando basura, o un grupo externo cayendo sobre un hilo.

**Cómo se ve:** pico de altas en `/mod/metricas`, pico de reportes en la cola, un hilo marcado como "hilo con actividad inusual" (≥10 comentarios de cuentas T0/T1 o ≥5 reportes en 60 minutos), muchas cuentas que comparten el mismo código de invitación.

1. **Cerrar la puerta**: `registro_abierto = false` si estaba abierto, y congelar la creación de invitaciones. El registro por invitación ya es la defensa principal: farmear cuentas exige farmear invitaciones, y el árbol de invitaciones (`invites.created_by`) hace visible —y baneable en bloque— a la granja entera.
2. **Frenar la escritura** si sigue escalando: `read_only = true`, o `subidas_pausadas`/`uploads_paused` si el abuso es de archivos. Prendelo temprano: cortar diez minutos es barato, limpiar dos mil filas no.
3. **Cerrar el hilo** puntual con `mod_lock_thread`: el contenido queda, no entran comentarios nuevos. El aviso dice "Este hilo fue cerrado por moderación".
4. **Limpiar y restringir**: `mod_remove_*` sobre el contenido, `mod_restrict_user` sobre las cuentas (suspensión con `until`, o ban permanente). Toda acción deja auditoría.
5. **Cuando bajó**: revisar el reporte de anomalías del cron nocturno (pares de votantes concentrados, cuentas de la misma invitación votándose entre sí, velocidad de votos anómala) para encontrar lo que no se vio, y ahí recién apagar los frenos.
6. **Registrar** en `docs/decisions.md`: qué se prendió, cuándo, cuándo se apagó, qué se aprendió.

Los rate limits por antigüedad de cuenta (T0 < 48 h: 3 posts/día, 1 subida/día) están en la base, no en el middleware, así que siguen valiendo aunque alguien saltee la app. Si la ola pasa igual, la escalada preparada es Turnstile en el registro **[DECISIÓN HUMANA]**, no una carrera de parches.

---

## Escenario 4 — Caída de Supabase

### Diagnóstico

```
GET /api/health          → si devuelve 200 con { db: ok }, la base está viva
status.supabase.com      → incidente del proveedor
Dashboard del proyecto   → ¿dice "paused"?
```

**Tres causas, tres respuestas:**

| Causa                       | Cómo se reconoce                                                            | Qué hacer                                                                                                                                                                                                    |
| --------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Proyecto pausado**        | El dashboard lo dice; pasó una semana sin actividad (típico: enero–febrero) | Despausar desde el dashboard. Después, revisar por qué el cron diario de keepalive no corrió: `/api/cron/aggregates`, el `CRON_SECRET`, los logs de Vercel. La pausa es una falla del keepalive, no del azar |
| **Incidente del proveedor** | status.supabase.com, errores de conexión en Sentry                          | Esperar y comunicar. No hay failover: es el costo aceptado del stack de $0                                                                                                                                   |
| **Base llena o saturada**   | Escrituras que fallan, timeouts, tamaño cerca de 500 MB                     | `docs/runbooks/cuotas.md` — si el disparador de los 350 MB no se atendió a tiempo, esta es su factura                                                                                                        |

### Mientras dura

Lo que sigue funcionando: las páginas públicas con ISR se siguen sirviendo desde la caché de Vercel para usuarios deslogueados. Es decir, **el sitio se lee y no se escribe**. Lo que falla: login, feed personalizado, cualquier escritura, y las descargas (el redirect firmado necesita contar la descarga en la base).

Comunicación: no hay página de estado. El canal real son los grupos de WhatsApp de la beta. Regla: si pasa **más de una hora** en horario de cursada, se avisa; el mensaje dice qué pasa y qué no se puede hacer, sin promesas de horario que no controlamos.

### Si no vuelve

Si la caída deja de parecer un incidente y empieza a parecer una pérdida de datos, se abre **`docs/runbooks/restauracion.md`**: el dump semanal encriptado, el espejo de R2 y el camino de reconstrucción en VPS existen exactamente para este día. RPO ≤ 7 días.

---

## Rotación de credenciales

Por calendario, cada 6 meses (es un ritual de 15 minutos): service-role key y `CRON_SECRET`. Ante sospecha de exposición: inmediatamente y todo. El JWT secret no rota por calendario — es el revocador de sesiones de emergencia y cierra la sesión de todos.

Dónde vive cada cosa: Supabase (service-role, anon, JWT, contraseña de base, SMTP de Resend) · Vercel (variables de entorno de producción, `CRON_SECRET`) · GitHub Actions (`SUPABASE_DB_URL`, token de acceso, credenciales de R2 para el backup) · Cloudflare (R2, DNS) · registrador (el dominio: la raíz de todo, nunca en una cuenta de plataforma) · gestor de contraseñas del fundador (todo, con TOTP) · offline (la clave privada de `age` de los backups, más una copia impresa).

Una clave filtrada y rotada igual se gana un postmortem de una línea en `docs/decisions.md`.

## Lo que nunca se hace

- Borrar datos en pánico, o "arreglar" el esquema desde el editor SQL del dashboard.
- Responder el mismo día a un requerimiento legal sin abogado.
- Revelar la autoría de contenido anónimo por fuera de `mod_reveal_author` con razón declarada.
- Contar una versión que no se pueda sostener después. La comunidad tolera un error; no tolera enterarse por otro lado.
- Cerrar un incidente sin postmortem. La semana siguiente, un archivo en el repositorio y una entrada en `docs/decisions.md`.
