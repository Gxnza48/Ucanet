# Runbook — Cuotas y el primer dólar pagado

Los gatillos están decididos de antemano (D13) para que el día que se disparen la decisión sea **mecánica y no emocional**. Una plataforma pensada para durar diez años que se muere a los 5 GB nunca fue una institución; una que paga por las dudas quema el presupuesto antes de tener comunidad. Este runbook es el punto medio: umbrales fijos, orden de pago fijo, y una revisión de tres minutos por semana.

**El orden en que se rompe todo** (D13, corregido después de mudar los archivos a R2):

1. **El trabajo de moderación.** No es un límite de infraestructura y aun así llega primero.
2. **El tamaño de la base de datos.** Es el único que no se puede descargar a otro lado.
3. **El almacenamiento de R2.** A cuatro años vista al ritmo de 1.000 MAU, y su solución cuesta centavos.

El viejo primer muro —el egress de archivos de Supabase, con las descargas cortadas en semana de parciales— dejó de existir: R2 no cobra egress, así que un pico de descargas cuesta $0 a cualquier escala.

---

## Qué se mide, dónde y cada cuánto

| Qué                                     | Dónde se mira                                                                                | Frecuencia                                     |
| --------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Tamaño de la base                       | Consulta SQL (abajo) o Dashboard de Supabase → Database → Usage                              | Semanal                                        |
| Egress de Supabase                      | Dashboard de Supabase → Usage                                                                | Semanal                                        |
| MAU de Auth                             | Dashboard de Supabase → Authentication                                                       | Mensual                                        |
| Bytes en R2                             | Dashboard de Cloudflare → R2, o `rclone size`. El cron diario además los escribe en `events` | Semanal                                        |
| Ancho de banda e invocaciones de Vercel | Dashboard de Vercel → Usage                                                                  | Semanal                                        |
| Emails enviados                         | Dashboard de Resend (100/día, 3.000/mes)                                                     | Semanal, y antes de cada tanda de invitaciones |
| Errores de Sentry                       | Dashboard de Sentry (5.000/mes)                                                              | Semanal                                        |
| Minutos de GitHub Actions               | GitHub → Settings → Billing (2.000 min/mes)                                                  | Mensual                                        |
| **Cola de moderación**                  | `/mod` — cantidad y antigüedad mediana                                                       | Semanal                                        |

Tamaño de la base, desglosado — la consulta que importa:

```sql
select pg_size_pretty(pg_database_size(current_database())) as base_total;

select relname                                       as tabla,
       pg_size_pretty(pg_total_relation_size(c.oid)) as total,
       pg_size_pretty(pg_indexes_size(c.oid))        as indices
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'
 order by pg_total_relation_size(c.oid) desc
 limit 15;
```

Los inflacionarios reales no son los cuerpos de las publicaciones (Postgres los comprime con TOAST): son los índices, los `tsvector` y las tablas con forma de log. Si una tabla de historial aparece arriba en esa lista, la respuesta es la purga de retención, no pagar.

---

## Umbrales

Regla general: **se actúa al 70% del límite gratuito**, no al 95%. El margen es lo que convierte un gatillo en una decisión tranquila en vez de una emergencia.

| Recurso                  | Límite free (verificado 2026-08-13) | Umbral de acción               | Primera respuesta                                               |
| ------------------------ | ----------------------------------- | ------------------------------ | --------------------------------------------------------------- |
| **Base de datos**        | 500 MB                              | **350 MB**                     | **Supabase Pro. No es diferible**                               |
| **R2 (archivos)**        | 10 GB, egress $0                    | **7 GB**                       | Almacenamiento pago de R2 (~USD 0,015/GB-mes)                   |
| Egress de Supabase       | 5 GB + 5 GB cacheado                | 3,5 GB                         | Ampliar ventanas de ISR. Los bytes de archivos no pasan por acá |
| MAU de Auth              | 50.000                              | dos meses seguidos con presión | Supabase Pro                                                    |
| Ancho de banda de Vercel | 100 GB/mes                          | 70 GB                          | Vercel Pro                                                      |
| Invocaciones de Vercel   | 1M/mes                              | 500k                           | Ampliar ISR antes de pagar                                      |
| Optimización de imágenes | 5.000 transformaciones              | —                              | No aplica: el MVP no renderiza imágenes de usuarios, por diseño |
| Resend                   | 100/día, 3.000/mes                  | 80/día                         | Escalonar las tandas de invitaciones                            |
| Sentry                   | 5.000 errores/mes                   | 3.500                          | Rate limit por clave + lista `ignoreErrors`                     |
| GitHub Actions           | 2.000 min/mes                       | 1.400 min                      | Podar la matriz de CI                                           |
| **Pausado del proyecto** | tras 1 semana sin actividad         | cualquier falla del keepalive  | Revisar el cron diario **hoy**, no el viernes                   |

Dos umbrales que no son de cuota y aun así mandan:

- **Cola de moderación**: antigüedad mediana de un reporte > 24 h de forma sostenida. Lo que se "paga" no es dinero: son moderadores (estudiantes de confianza, uno por facultad). Es la pared número uno y llega antes que cualquier factura.
- **Uso comercial**: el Hobby de Vercel prohíbe uso comercial, **donaciones incluidas**. El primer peso de monetización obliga a Vercel Pro _antes_ de cobrarlo, no después.

---

## Qué se paga y en qué orden

La escalera es fija. No se saltean escalones ni se paga "de una para no pensar".

| #   | Gatillo (cualquiera alcanza)                                                                                                                                                          | Paso                                                         | Total mensual |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------- |
| 0   | —                                                                                                                                                                                     | Todo gratis; el dominio (USD 15–40/año) es el único gasto    | **$0**        |
| 1   | Base > 350 MB · o presión de MAU dos meses seguidos · o ya existe una comunidad real y el riesgo de no tener backups ni protección contra pausas es inaceptable **[DECISIÓN HUMANA]** | **Supabase Pro**: 8 GB de disco, backups diarios, sin pausas | **$25**       |
| 2   | R2 > 7 GB                                                                                                                                                                             | Almacenamiento pago de R2                                    | +$0,05–0,50   |
| 3   | Primer peso de monetización · o ancho de banda > 70 GB/mes · o necesidad de más de un cron diario                                                                                     | **+ Vercel Pro**                                             | **$45**       |
| 4   | Digests de email a > 100 destinatarios/día · o meses de más de 3.000 mails                                                                                                            | + Resend Pro (opcional)                                      | $65           |
| 5   | El volumen de errores tapa señal real a 5.000/mes                                                                                                                                     | + Sentry Team (opcional)                                     | ~$91          |

**$45/mes es la barra completa** de una institución que funciona, con backups y sin pausarse. Cualquier plan de monetización tiene que superar esa cifra antes de discutir cualquier otra cosa.

---

## Qué se hace antes de pagar (y qué no admite postergación)

**Base de datos — no admite postergación.** Los archivos se pueden mudar a otro proveedor; los bytes de la base, no. Lo que sí se hace mientras tanto: verificar que las purgas de retención del cron diario estén corriendo (`search_queries` a 12 meses, `download_log` a 7 días, avisos leídos a 90 días y no leídos a 180, borradores de recursos a 24 h, historial del cron). `events` **no se purga nunca**: son agregados de KB por año y alimentan el archivo. Si con las purgas al día la base sigue creciendo hacia 350 MB, el gatillo es el gatillo.

**R2.** Los topes estructurales ya están puestos: 10 MB por archivo, 3 archivos por recurso, 100 MB de cuota por usuario, solo PDF e imágenes. A tope de caps, los 10 GB gratis son más de 3.000 recursos típicos. Cuando se dispare, el paso son centavos por GB-mes, no una mudanza de plataforma: `storage_path` es agnóstico del proveedor a propósito.

**Vercel.** Primero se amplían las ventanas de ISR y se revisa la disciplina del `matcher` del proxy (que no corra sobre estáticos). Recién después se paga.

**Email.** Tandas de invitaciones de 80 por día como máximo. Los digests por mail son P2 y ya vienen con la cuenta hecha: 3.000/mes ÷ 30 = 100 destinatarios diarios de techo en el plan gratis.

**Sentry.** Si una release empieza a errorear en volumen, el interruptor es volver al build anterior (instantáneo en Vercel), no subir la cuota.

---

## El ritual

**Viernes, 3 de los 15 minutos de la revisión de operaciones** (PART 24 §24.8): cuotas contra los umbrales de arriba. Después vienen Sentry (4 min), cola de moderación (3 min), `/mod/metricas` (4 min) y una línea en `docs/decisions.md` si cambió algo (1 min).

Si la revisión pasa de 15 minutos dos semanas seguidas, algo está estructuralmente mal: se anota como riesgo, no se absorbe en silencio.

## Cuando un gatillo se dispara

1. **Verificar el número** en la fuente, no en la memoria. Un pico de un día no es una tendencia.
2. **Confirmar que las mitigaciones ya están aplicadas** (purgas corriendo, ISR ampliado, topes vigentes). Pagar para tapar un job que no corre es pagar dos veces.
3. **Ejecutar el paso de la escalera.** Sin negociar con uno mismo: la decisión ya se tomó hoy, en frío.
4. **Registrar en `docs/decisions.md`**: qué gatillo, con qué número medido, qué se pagó, desde cuándo. D13 lo pide explícitamente y es lo que le permite al que venga entender por qué la cuenta dice lo que dice.
5. **Revisar qué gatillo sigue.** Después de Supabase Pro, el keepalive del cron se puede retirar (en Pro no hay pausas) y el RPO baja a 24 h automáticamente: dos líneas de este plan quedan obsoletas el mismo día y hay que sacarlas.
