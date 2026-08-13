# Runbook — Simulacro de restauración

> Un backup que nunca se restauró es un deseo, no un backup.

Este es el procedimiento del simulacro anual de PART 21 §21.7. No es una auditoría ni un ejercicio de papel: se restaura de verdad, se levanta la app contra la base restaurada y se usan seis flujos reales. Lo que no se prueba, no existe.

## Cuándo

**Todos los febrero.** Es el hueco estacional del calendario académico (PART 0 §0.1): nadie está rindiendo, el tráfico está en su piso del año y una tarde perdida no le cuesta nada a nadie.

El plan tiene tres cadencias escritas en tres lugares (PART 26 §26.5 dice mensual, PART 10 §10.15 dice trimestral, PART 21 §21.7 dice anual). La resolución adoptada, porque es la única sostenible a 20 h/semana:

| Cadencia                          | Qué se hace                                                                                                       | Cuánto lleva  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------- |
| Semanal (revisión de los viernes) | Confirmar que el workflow de backup corrió, que el dump no pesa 0 bytes ni 20% menos que el de la semana anterior | 1 min         |
| Mensual (primer viernes)          | Descargar el último dump, desencriptarlo, `pg_restore --list` para probar que el archivo está sano. Sin restaurar | 10 min        |
| **Anual (febrero)**               | **Este runbook completo, de punta a punta**                                                                       | **60–90 min** |

## Qué se mide

| Métrica                                                    | Objetivo                                                  |
| ---------------------------------------------------------- | --------------------------------------------------------- |
| Minutos hasta la app funcionando contra la base restaurada | < 1 día (objetivo real: < 90 min)                         |
| RPO — antigüedad del dump usado                            | ≤ 7 días (≤ 24 h cuando exista Supabase Pro)              |
| Flujos dorados que pasan                                   | 6 de 6                                                    |
| Roturas encontradas                                        | Todas anotadas, cada una convertida en un ítem de backlog |

## Antes de empezar — lo que tenés que tener a mano

- [ ] Acceso al **bucket de backup de R2** (separado del bucket que sirve los archivos: no comparten dominio de falla).
- [ ] La **clave privada de `age`** con la que se desencriptan los dumps: password manager + la copia impresa. Sin ella, no hay restauración y el simulacro terminó en fracaso total antes de empezar.
- [ ] El **último `pg_dump --format=custom`** encriptado y el **manifiesto CSV** de `resource_files` (ruta, tamaño, mime, fecha).
- [ ] Destino de restauración: un **stack local descartable** (opción por defecto) o el **segundo proyecto Supabase free** (el de preview).
- [ ] Herramientas: `age`, `pg_restore`/`psql` 16, CLI de Supabase, `rclone`, Docker, Node ≥ 20.9.
- [ ] El repositorio en el **commit que está en producción** (`git checkout <tag-o-sha>`), no en `main` a secas.
- [ ] Un archivo de entorno aparte (`.env.drill`), nunca `.env.local`, para no pisar tu setup de desarrollo.

**Elección del destino.** Por defecto, stack local descartable: el dump contiene el mapa completo de autoría anónima y todos los emails (es el activo A6 del análisis de PART 10), así que cuanto menos viaje, mejor. Usá el segundo proyecto Supabase solo si querés además probar la restauración contra un entorno hosteado — y en ese caso el paso 9 de limpieza deja de ser opcional: hay que resetearlo antes de que vuelva a servir previews.

---

## Paso a paso

### 1. Traer el backup

```bash
mkdir -p ~/drill-2027-02 && cd ~/drill-2027-02
rclone copy r2-backup:ucanet-backups/latest/ . --progress
ls -la          # anotá el tamaño del dump: es una de las métricas del simulacro
```

Verificá que estén las tres piezas: el dump `.dump.age`, el manifiesto `resource_files.csv` y el archivo de checksum. Si falta alguna, el simulacro ya encontró su primera rotura — anotala y seguí con lo que haya.

### 2. Desencriptar

```bash
age --decrypt -i ~/.age/ucanet-backup.key ucanet-2027-02-07.dump.age > ucanet.dump
pg_restore --list ucanet.dump | head -50    # ¿se lee el índice del archivo?
```

Si `pg_restore --list` falla, el archivo está corrupto: probá el dump de la semana anterior y **registrá el hallazgo como incidente**, no solo como línea del simulacro.

### 3. Levantar el Postgres destino

Opción A — stack local descartable (recomendada):

```bash
cd ~/drill-2027-02 && git clone <url-del-repo> app && cd app
git checkout <sha-de-produccion>
npm ci
npx supabase init      # si hace falta
npx supabase start     # anotá API URL, anon key y la URL de Postgres (54322)
```

Opción B — segundo proyecto Supabase: creá o vaciá el proyecto de preview y anotá su cadena de conexión directa.

### 4. Restaurar

```bash
# Sobre el stack local: la base se llama postgres y el usuario es postgres.
pg_restore \
  --dbname "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  --no-owner --no-privileges --clean --if-exists \
  --verbose ../ucanet.dump 2>&1 | tee ../restore.log
```

**Arrancá el cronómetro acá y no lo pares hasta el paso 7.**

Errores esperables que hay que mirar con atención, no ignorar:

- Roles gestionados de Supabase que no existen en destino (`supabase_admin`, `authenticator`): con `--no-owner --no-privileges` no debería frenar, pero cada línea de error dice qué grant se perdió.
- **El esquema `auth`.** Es la pieza que hace portables las cuentas: sin `auth.users` y sus hashes bcrypt, nadie puede volver a entrar. PART 20 §20.9 dejó marcado como "verificar en S0" el set exacto de flags del `pg_dump`; **este simulacro es donde se verifica**. Contá las filas:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "select count(*) as usuarios from auth.users;" \
  -c "select count(*) as perfiles from public.profiles;" \
  -c "select count(*) as posts from public.posts;" \
  -c "select count(*) as recursos from public.resources;"
```

Si `auth.users` vino vacío y `profiles` no, la exportación está incompleta: es la rotura más grave que este simulacro puede encontrar y arreglarla es prioridad uno.

### 5. Verificar el corpus de archivos

Los archivos no se restauran: viven en R2 y el bucket de backup es un espejo del bucket que sirve (§0.5-R17). Lo que se verifica es que el espejo y el manifiesto coincidan.

```bash
wc -l ../resource_files.csv
rclone size r2-backup:ucanet-files-mirror
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "select count(*) from public.resource_files;"
```

Las tres cifras tienen que contar la misma historia. Una diferencia de unos pocos archivos entre el manifiesto y la base es esperable (subidas entre el dump y el `rclone sync`); una diferencia grande es una rotura.

### 6. Apuntar la app a la base restaurada

```bash
cp .env.example .env.drill
# Completá con la URL y la anon key que imprimió `supabase start`,
# NEXT_PUBLIC_SITE_URL=http://localhost:3000 y las credenciales del bucket de R2.
npm run dev
```

No hace falta `db:reset` ni seeds: la base ya tiene los datos reales restaurados. Si corrés `db:reset` por costumbre, borrás la restauración y volvés al paso 4.

### 7. Los seis flujos dorados, a mano

Cronómetro parado cuando el primero de estos pasa. Se hacen todos, en escritorio y una vez en 390 px:

- [ ] **1. Entrar.** Login con una cuenta real restaurada (usá una tuya, o la cuenta de drill). Si el login falla, el problema es el esquema `auth` (paso 4).
- [ ] **2. Leer deslogueado.** Home, una materia, una publicación. Contenido presente y correcto.
- [ ] **3. Abrir una publicación con comentarios.** Los anónimos siguen anónimos: ningún campo de autor visible, los alias por hilo consistentes.
- [ ] **4. Descargar un recurso.** El redirect firmado a R2 funciona y el archivo baja completo.
- [ ] **5. Buscar.** Una consulta con acentos ("constitucional", "administración") devuelve resultados: la configuración FTS `public.es` y `f_unaccent()` sobrevivieron al restore.
- [ ] **6. Escribir algo.** Publicar un comentario de prueba: prueba que las RPC, los rate limits y los triggers están vivos, no solo las tablas.

Anotá qué falló y **por qué**, no solo que falló.

### 8. Registrar el resultado

Una entrada nueva arriba de todo en **`docs/decisions.md`**, con el formato del log:

```markdown
## 2027-02-06 — Simulacro de restauración 2027

Decisión: simulacro anual ejecutado (§21.7). Dump del 2027-02-01, 84 MB, RPO 5 días.
Por qué: 41 minutos hasta la app funcionando; 6/6 flujos dorados; auth.users restauró 312 filas.
Salida: dos roturas — el manifiesto CSV llegó vacío (workflow de backup, arreglado en <sha>)
y pg_restore perdió los grants de `authenticated` sobre las vistas _public (se resuelve con
--no-privileges + re-aplicar la migración 0010). Ambas en el backlog.
```

Lo que se registra siempre: fecha, tamaño del dump, antigüedad del dump (RPO real), minutos hasta funcionar, flujos que pasaron, roturas encontradas y a dónde fue cada una. **Cada "no pudimos saberlo" es un ítem de backlog**, no una nota al pie.

### 9. Limpieza (no es opcional)

```bash
npx supabase stop --no-backup     # tira los contenedores y sus volúmenes
shred -u ~/drill-2027-02/ucanet.dump 2>/dev/null || rm -f ~/drill-2027-02/ucanet.dump
rm -f ~/drill-2027-02/.env.drill
```

- [ ] El dump desencriptado **no queda en disco**. Es el mapa de autoría anónima de toda la comunidad.
- [ ] Si usaste el segundo proyecto Supabase: vaciarlo y re-sembrarlo con el catálogo + fixtures antes de que vuelva a servir previews.
- [ ] Ninguna credencial de drill queda en un `.env` ni en el historial del shell.
- [ ] La copia local del manifiesto CSV también se borra: tiene rutas de archivos de usuarios.

---

## Anexo — Reconstruir afuera de Supabase

Este es el plan de salida de §21.7 punto 4, el que responde "si Vercel y Supabase desaparecen mañana, ¿podemos mudarnos?". No se ejecuta todos los años; se lee todos los años, y se ejecuta el año que el simulacro normal encuentre algo que lo justifique (o cuando el que desapareció sea el proveedor mismo).

1. **VPS** (~USD 5/mes) con Coolify instalado. Alternativa documentada: fly.io, si lo que murió fue el proveedor de VPS.
2. **Postgres 16** por `docker compose` y `pg_restore` del último dump de R2 — los pasos 1 a 4 de arriba, sin cambios.
3. **La app**: `next build && next start` corre en cualquier host Node. Lo que se pierde de Vercel (ISR, tags de caché, cron) degrada a render dinámico y cron del sistema: más lento, no roto. Variables de entorno según la matriz de PART 20 §20.6.
4. **Autenticación**: GoTrue self-hosted (el servidor de auth open source de Supabase) contra el esquema `auth` restaurado — los hashes bcrypt hacen que los logins sigan funcionando sin resetear a nadie. Si GoTrue derivó y no levanta, el plan B es un flujo único de "restablecé tu contraseña" contra los emails preservados: _"Actualizamos la plataforma. Ingresá tu email para crear una nueva contraseña."_
5. **Archivos**: nada que mover, ya están en R2.
6. **DNS**: el dominio vive en la cuenta de registrador del fundador con DNS en Cloudflare desde el día uno. Repuntar son minutos y no requiere el permiso de ningún proveedor.

Objetivo del camino completo: **menos de un día**, con RPO ≤ 7 días.

---

## Notas señaladas para verificar en el simulacro

Cosas que el plan dejó marcadas como no verificadas y que este ejercicio es el lugar natural para cerrar:

- Los flags exactos de `pg_dump` que exportan `auth` completo bajo los roles gestionados de Supabase (PART 20 §20.9, marcado "verificar en S0").
- Si GoTrue self-hosted todavía levanta contra un esquema `auth` exportado de Supabase (PART 21 §21.7).
- La retención de dumps: 8 semanales + 3 mensuales, **tope duro de 90 días** — es un compromiso de privacidad, no housekeeping, porque las cuentas y el contenido borrados siguen vivos dentro de los backups hasta que rotan. La política de privacidad lo dice textual: "Las copias de seguridad se conservan un máximo de 90 días."
