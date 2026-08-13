#!/usr/bin/env bash
# =============================================================================
# scripts/forbidden.sh — el grep de patrones prohibidos (PART 25 §25.8).
#
# Corre igual en local (`npm run forbidden`) que en el job `check` de CI. Cada
# regla imprime QUÉ encontró (archivo:línea con la línea entera) y POR QUÉ está
# prohibido, con la decisión que lo prohíbe. Un hallazgo = build roja: estas no
# son sugerencias de estilo, son las reglas D14 del plan.
#
# Salida:
#   0  el repo está limpio
#   1  hay al menos una violación
#   2  el script no pudo correr (falta una dependencia o el repo está roto)
#
# Portabilidad: bash + POSIX grep/awk/sed. Nada de `grep -P`, `grep -z`,
# `mapfile` ni GNU-ismos: tiene que andar en el runner de Ubuntu, en macOS y en
# Git Bash sobre Windows.
# =============================================================================

set -u
# A propósito NO usamos `set -e`: grep devuelve 1 cuando no encuentra nada, que
# acá es justamente el caso feliz.

ROOT=$(cd -- "$(dirname -- "$0")/.." && pwd) || exit 2
cd "$ROOT" || exit 2

FILES=$(mktemp) || exit 2
LIST=$(mktemp) || exit 2
HITS=$(mktemp) || exit 2
trap 'rm -f "$FILES" "$LIST" "$HITS"' EXIT INT TERM

VIOLATIONS=0

# -----------------------------------------------------------------------------
# Inventario de archivos. Con git tomamos los versionados MÁS los nuevos sin
# ignorar (--others --exclude-standard): en local el script corre antes del
# commit, cuando el archivo recién escrito todavía no está en el índice, y ese
# es justo el que hay que revisar. Sin git, un find equivalente.
# -----------------------------------------------------------------------------
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git ls-files --cached --others --exclude-standard >"$FILES"
else
  find . -type f \
    ! -path './node_modules/*' ! -path './.git/*' ! -path './.next/*' \
    ! -path './playwright-report/*' ! -path './test-results/*' \
    ! -path './.lighthouseci/*' ! -path './supabase/.temp/*' |
    sed 's|^\./||' >"$FILES"
fi

# select_files <ere-incluye> <ere-excluye-o-vacío>  ->  escribe en $LIST
select_files() {
  if [ -n "${2:-}" ]; then
    grep -E "$1" "$FILES" | grep -Ev "$2" >"$LIST"
  else
    grep -E "$1" "$FILES" >"$LIST"
  fi
  return 0
}

# report <título> <por-qué>  — imprime $HITS como violación y suma al contador.
report() {
  VIOLATIONS=$((VIOLATIONS + 1))
  printf '\n  PROHIBIDO · %s\n' "$1"
  printf '  Por qué:   %s\n' "$2"
  printf '  Encontrado:\n'
  sed 's/^/    /' "$HITS"
}

# rule <título> <por-qué> <ere-incluye> <ere-excluye> <ere-contenido> [<ere-descarta>]
#
# Busca <ere-contenido> en los archivos que matchean <ere-incluye> y no
# matchean <ere-excluye>. <ere-descarta> saca falsos positivos línea por línea.
rule() {
  rule_title=$1
  rule_why=$2
  rule_inc=$3
  rule_exc=$4
  rule_pat=$5
  rule_drop=${6:-}

  select_files "$rule_inc" "$rule_exc"
  [ -s "$LIST" ] || return 0

  # xargs con separador de línea: los paths del repo no llevan espacios
  # (convención de nombres de PART 27 §27.3: kebab-case), y -H fuerza el
  # prefijo de archivo aunque quede un solo archivo en la lista.
  if [ -n "$rule_drop" ]; then
    xargs grep -EnHI -e "$rule_pat" <"$LIST" 2>/dev/null | grep -Ev "$rule_drop" >"$HITS"
  else
    xargs grep -EnHI -e "$rule_pat" <"$LIST" 2>/dev/null >"$HITS"
  fi

  [ -s "$HITS" ] || return 0
  report "$rule_title" "$rule_why"
}

printf 'forbidden.sh · PART 25 §25.8 — revisando patrones prohibidos\n'

# -----------------------------------------------------------------------------
# 1. Clave service_role fuera del cron y del cliente admin.
#    Los únicos lugares autorizados: app/api/cron/* (el único runtime que la
#    usa), lib/supabase/admin.ts (el cliente que la monta) y lib/env.server.ts
#    (el accessor getServiceRoleKey() que fija el BUILD CONTRACT §3). scripts/
#    queda afuera del request path por definición.
# -----------------------------------------------------------------------------
rule \
  'clave service_role fuera de app/api/cron y lib/supabase/admin.ts' \
  'D14.3 — la service role saltea RLS. Si llega a un módulo alcanzable desde un request, toda la seguridad del producto (D5) deja de existir. Leela solo en el cron, vía lib/supabase/admin.ts.' \
  '^(app|components|features|lib|e2e)/.*\.(ts|tsx)$' \
  '^app/api/cron/|^lib/supabase/admin\.ts$|^lib/env\.server\.ts$' \
  'SUPABASE_SERVICE_ROLE_KEY|[^A-Za-z_]service_role|getServiceRoleKey|createAdminClient|supabase/admin'

# -----------------------------------------------------------------------------
# 2. supabase.from() fuera de las capas de datos.
#    Descartamos Array.from / Object.from / Buffer.from y compañía: la firma que
#    delata a Supabase es .from() con un literal de tabla.
# -----------------------------------------------------------------------------
rule \
  'supabase.from( fuera de features/*/queries.ts, features/*/actions.ts y lib/supabase' \
  'BUILD CONTRACT §7.1 — el acceso a datos vive en tres lugares y solo tres. Una consulta suelta en un componente o en una ruta es una lectura que nadie revisó contra RLS ni contra las vistas _public (D5, D14.5).' \
  '^(app|components|features|lib|e2e)/.*\.(ts|tsx)$' \
  '^features/[^/]+/(queries|actions)\.ts$|^lib/supabase/' \
  '\.from\([[:space:]]*["'"'"'`]' \
  '(Array|Object|Buffer|Uint8Array|Int8Array|Float32Array|String|Date|Set|Map|Number|BigInt)\.from\('

# -----------------------------------------------------------------------------
# 3. select('*') sobre tablas base de contenido.
#    Chequeo con ventana: un .select('*') a menos de 8 líneas de un
#    .from('<tabla base>') es la lectura prohibida. select('*') sobre una vista
#    _public no lo es: para eso están las vistas.
# -----------------------------------------------------------------------------
check_select_star() {
  select_files '^(app|components|features|lib)/.*\.(ts|tsx)$' ''
  [ -s "$LIST" ] || return 0
  : >"$HITS"
  while IFS= read -r file; do
    [ -f "$file" ] || continue
    awk -v f="$file" -v q="'" '
      BEGIN {
        tbl    = "(posts|comments|resources|resource_files|anon_aliases|profiles)"
        quote  = "(\"|" q "|`)"
        fromre = "\\.from\\([ \t]*" quote tbl quote "[ \t]*\\)"
        selre  = "\\.select\\([ \t]*" quote "\\*"
      }
      $0 ~ fromre { from_line = NR }
      $0 ~ selre  { if (from_line > 0 && NR - from_line <= 8) printf "%s:%d: %s\n", f, NR, $0 }
    ' "$file" >>"$HITS"
  done <"$LIST"
  [ -s "$HITS" ] || return 0
  report \
    "select('*') sobre una tabla base de contenido" \
    'BUILD CONTRACT §4.2 — un asterisco sobre posts/comments/resources/profiles arrastra author_id, is_anonymous y columnas internas: exactamente lo que nunca puede salir de la base (D3, D14.5). Leé por la vista _public correspondiente o enumerá columnas.'
}
check_select_star

# -----------------------------------------------------------------------------
# 4. Valores arbitrarios de Tailwind.
#    Matchea utilidad-[#hex], utilidad-[rgb(...)/var(...)] y utilidad-[123px].
#    Exigir que el corchete abra con #, con una función de color o con un
#    dígito deja fuera las clases de caracteres de las expresiones regulares
#    del código (por ejemplo /^[a-z0-9]+(-[a-z0-9]+)*$/ en lib/utils/slug.ts).
# -----------------------------------------------------------------------------
rule \
  'valor arbitrario de Tailwind (corchetes con color o medida)' \
  'PART 17 anti-checklist 13-14 y PART 18 — los valores visuales salen de app/tokens.css, siempre. Un text-[17px] o un bg-[#fff] es un token nuevo que nadie decidió y que el modo oscuro no conoce.' \
  '^(app|components|features)/.*\.(ts|tsx)$' \
  '' \
  '\-\[(#[0-9a-fA-F]|(rgb|rgba|hsl|hsla|oklch|oklab|color-mix|var)\(|-?[0-9])'

# -----------------------------------------------------------------------------
# 5. console.log en código de aplicación.
#    console.error dentro de un catch sigue permitido: eso es telemetría, no
#    depuración olvidada.
# -----------------------------------------------------------------------------
rule \
  'console.log en código de aplicación' \
  'Depuración olvidada en producción: en el servidor ensucia los logs de Vercel y en el cliente puede filtrar payloads a la consola del navegador. Para errores va console.error o Sentry (PART 24 §24.7).' \
  '^(app|components|features|lib)/.*\.(ts|tsx)$' \
  '\.test\.(ts|tsx)$' \
  'console\.log\('

# -----------------------------------------------------------------------------
# 6. Texto de UI en inglés.
#    Solo en posición de texto JSX (>Palabra) o abriendo un literal ("Palabra),
#    para no chocar con type="submit" ni con los iconos de lucide (<Search />).
#    Se descartan las líneas de comentario: los comentarios pueden citar la
#    especificación en inglés, no son cadenas que vea nadie.
# -----------------------------------------------------------------------------
rule \
  'texto de UI en inglés' \
  'D9 y D14.6 — toda cadena visible es es-AR con voseo: "Enviá", "Cancelar", "Cargando", "Buscar", "Eliminá". Vale también para placeholders y aria-labels.' \
  '^(app|components|features)/.*\.tsx$' \
  '' \
  '(>|["'"'"'])(Submit|Cancel|Loading|Search|Delete)([^A-Za-z]|$)' \
  ':[0-9]+:[[:space:]]*(\*|//|/\*)'

# -----------------------------------------------------------------------------
# 7. dangerouslySetInnerHTML.
# -----------------------------------------------------------------------------
rule \
  'dangerouslySetInnerHTML' \
  'PART 25 §25.8 — superficie de XSS. El contenido de usuario se renderiza como texto (la clase .user-content de globals.css ya respeta saltos de línea); no hay markdown ni HTML crudo en el MVP.' \
  '^(app|components|features|lib)/.*\.(ts|tsx)$' \
  '' \
  'dangerouslySetInnerHTML'

# -----------------------------------------------------------------------------
# 8. Supresiones de tipos y de lint.
#    ESLint acepta justificación con la sintaxis ` -- motivo`: si está, pasa.
# -----------------------------------------------------------------------------
rule \
  'supresión de TypeScript o de ESLint sin justificación' \
  'PART 25 §25.8 — es la alfombra preferida del código generado por IA. Si de verdad hace falta, la línea lleva su motivo con la sintaxis " -- motivo" y se revisa en el PR.' \
  '^(app|components|features|lib|e2e)/.*\.(ts|tsx)$' \
  '' \
  '@ts-ignore|@ts-nocheck|eslint-disable' \
  ' -- .'

# -----------------------------------------------------------------------------
# 9. TODO sin referencia a un issue.
#    Solo la forma de comentario de código (TODO: … / TODO(…)), para no pisar el
#    castellano de los comentarios ("TODOS los perfiles" no es un TODO).
# -----------------------------------------------------------------------------
rule \
  'TODO sin referencia a un issue' \
  'PART 25 §25.8 — un TODO sin issue es trabajo que nadie va a volver a mirar. Escribilo como TODO(#12) o abrí el issue y borralo.' \
  '^(app|components|features|lib|e2e)/.*\.(ts|tsx)$' \
  '' \
  'TODO[:(]' \
  'TODO\(#[0-9]+\)'

# -----------------------------------------------------------------------------
# 10. DDL en código de aplicación.
# -----------------------------------------------------------------------------
rule \
  'DDL en código de aplicación' \
  'D14.1 — el esquema cambia solo por migraciones commiteadas en supabase/migrations. Un CREATE/ALTER/DROP en TypeScript es un cambio de esquema que no vive en la fuente de verdad y que ninguna corrida de pgTAP revisó.' \
  '^(app|components|features|lib)/.*\.(ts|tsx)$' \
  '' \
  '(create|alter|drop)[[:space:]]+(table|policy|function|trigger|index|view|type|schema)[[:space:]]'

# -----------------------------------------------------------------------------
# 11. security definer sin search_path fijo (migraciones).
#     La búsqueda se acota a la CABECERA de cada función: desde su `create
#     function` hasta la línea que abre el cuerpo (`as $$`). Una ventana de
#     ±N líneas no sirve: el search_path de la función siguiente taparía la
#     falta de search_path de la anterior.
#     Se ignora la prosa: líneas de comentario (--) y líneas con comilla
#     simple, que son los COMMENT ON ... IS '...' donde estas migraciones citan
#     la regla a cada rato. Una cláusula real de DDL no lleva comillas.
# -----------------------------------------------------------------------------
check_security_definer() {
  select_files '^supabase/migrations/.*\.sql$' ''
  [ -s "$LIST" ] || return 0
  : >"$HITS"
  while IFS= read -r file; do
    [ -f "$file" ] || continue
    awk -v f="$file" -v q="'" '
      function is_ddl(s) { return (s !~ /^[ \t]*--/ && index(s, q) == 0) }
      { raw[NR] = $0; low[NR] = tolower($0) }
      END {
        for (i = 1; i <= NR; i++) {
          if (!is_ddl(low[i])) continue
          if (low[i] !~ /security[ \t]+definer/) continue

          # Arranque de la cabecera: el create function más cercano hacia atrás.
          head = i
          for (j = i; j >= 1 && i - j <= 40; j--)
            if (is_ddl(low[j]) && low[j] ~ /create[ \t]+(or[ \t]+replace[ \t]+)?function/) { head = j; break }

          # Fin de la cabecera: la línea que abre el cuerpo.
          tail = i
          for (j = head; j <= NR && j - head <= 40; j++) { tail = j; if (low[j] ~ /as[ \t]*\$/) break }

          ok = 0
          for (j = head; j <= tail; j++)
            if (is_ddl(low[j]) && low[j] ~ /set[ \t]+search_path/) ok = 1
          if (!ok) printf "%s:%d: %s\n", f, i, raw[i]
        }
      }
    ' "$file" >>"$HITS"
  done <"$LIST"
  [ -s "$HITS" ] || return 0
  report \
    'security definer sin set search_path' \
    'D5 y BUILD CONTRACT §5 — una función definer sin search_path fijo es escalada de privilegios: cualquiera que pueda crear un objeto en un esquema del path secuestra la función. Va siempre "set search_path = public, pg_temp".'
}
check_security_definer

# -----------------------------------------------------------------------------
# 12. Variables NEXT_PUBLIC_ fuera de la lista autorizada.
#     Todo lo que lleva ese prefijo se embebe en el bundle del navegador.
#     La lista vive en lib/env.ts (BUILD CONTRACT §3) y en .env.example.
# -----------------------------------------------------------------------------
check_next_public() {
  select_files '^(app|components|features|lib|e2e)/.*\.(ts|tsx)$' ''
  [ -s "$LIST" ] || return 0
  xargs grep -EonHI -e 'NEXT_PUBLIC_[A-Z0-9_]+' <"$LIST" 2>/dev/null |
    grep -Ev ':(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|NEXT_PUBLIC_SITE_URL|NEXT_PUBLIC_SENTRY_DSN)$' >"$HITS"
  [ -s "$HITS" ] || return 0
  report \
    'variable NEXT_PUBLIC_ nueva' \
    'D14.3 y PART 25 §25.8 — cada NEXT_PUBLIC_ viaja al navegador de todos los visitantes. Agregar una exige revisión explícita: entrada en docs/decisions.md, alta en lib/env.ts y en .env.example, y sumarla a la lista de este script.'
}
check_next_public

# -----------------------------------------------------------------------------
# Veredicto
# -----------------------------------------------------------------------------
if [ "$VIOLATIONS" -eq 0 ]; then
  printf '\nforbidden.sh · sin hallazgos.\n'
  exit 0
fi

printf '\nforbidden.sh · %s regla(s) violada(s). Corregí lo de arriba antes de commitear.\n' "$VIOLATIONS"
printf 'Referencia: docs/plan/10-seo-analytics-testing-devflow-repo.md (PART 25 §25.8) y docs/BUILD-CONTRACT.md.\n'
exit 1
