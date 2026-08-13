-- =============================================================================
-- 0008 — Seguridad y moderación
-- Tablas: reports, mod_actions (+ trigger de inmutabilidad), user_restrictions, appeals
-- =============================================================================
-- Fuente normativa: PART 8 §8.3.6. Nombres de tabla, columna, constraint y check
-- se copian textualmente de ese spec. Las 12 categorías de reporte son las de
-- PART 11 §11.3.1, verbatim (§0.5-R4); el vocabulario de acciones de moderación
-- es el de §0.5-R5 (nombres de PART 8 + revelar_autor + bloquear_hilo).
--
-- Patrón estructural (tenet 2): nada de pares polimórficos tipo/id. Cada tabla
-- multi-objetivo lleva una FK nullable por objetivo posible más un CHECK sobre
-- num_nonnulls(). La integridad referencial queda nativa y el ON DELETE se
-- define por objetivo.
--
-- Postura de acceso (§8.3.9) — ninguna tabla de este archivo otorga nada a anon:
--   reports            select: mod/admin            escrituras: create_report (0012)
--   mod_actions        select: mod/admin            escrituras: RPC de moderación; update/delete: nadie, nunca
--   user_restrictions  select: propias + mod/admin  escrituras: RPC de moderación
--   appeals            select: apelante + mod/admin escrituras: create_appeal / mod_review_appeal (0012)
--
-- Convención de este archivo: los CHECK de columna se declaran con el mismo
-- nombre que Postgres generaría solo (<tabla>_<columna>_check). §8.2.2 exige
-- CHECK con nombre (para poder evolucionar una enumeración con DROP/ADD
-- CONSTRAINT en una migración); el DDL de §8.3.6 los muestra inline sin nombre.
-- Nombrarlos así cumple las dos cosas: el nombre es idéntico al que produce el
-- DDL verbatim y queda explícito en el archivo.
--
-- Predicado mod/admin: se escribe como subconsulta sobre public.profiles. Bajo
-- RLS funciona porque la subconsulta solo lee la fila propia del llamador
-- (id = auth.uid()), que es exactamente lo que habilita la política de
-- autolectura de profiles (§8.3.2). auth.uid() va envuelto en (select ...) para
-- que el planner lo evalúe una vez por sentencia (initplan, PART 10 §10.11).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- reports — reportes de usuarios contra exactamente un objetivo
-- -----------------------------------------------------------------------------

create table public.reports (
  id          bigint generated always as identity primary key,
  reporter_id uuid not null references public.profiles(id) on delete restrict,
  post_id     bigint null references public.posts(id) on delete cascade,
  comment_id  bigint null references public.comments(id) on delete cascade,
  resource_id bigint null references public.resources(id) on delete cascade,
  profile_id  uuid null references public.profiles(id) on delete restrict,
  categoria   text not null constraint reports_categoria_check check (categoria in
                ('spam','acoso','amenazas','datos_personales','ataque_persona',
                 'suplantacion','contenido_ilegal','compraventa','infraccion_autor',
                 'contenido_sexual','manipulacion','otro')),
  detalle     text null constraint reports_detalle_check check (char_length(detalle) <= 1000),
  status      text not null default 'abierto'
              constraint reports_status_check
              check (status in ('abierto','en_revision','resuelto','desestimado','resuelto_duplicado')),
  resolved_by uuid null references public.profiles(id) on delete restrict,
  resolved_at timestamptz null,
  created_at  timestamptz not null default now(),
  constraint reports_one_target
    check (num_nonnulls(post_id, comment_id, resource_id, profile_id) = 1)
);

comment on table public.reports is
  'Reportes de usuarios contra exactamente un objetivo: post, comentario, recurso o perfil (patrón FK-nullable + CHECK, tenet 2). Las 12 categorías son las de PART 11 §11.3.1, normativas (§0.5-R4). Se escribe únicamente desde la RPC create_report; los reportantes no leen esta tabla (la cola de moderación es ciega para ellos, lo que corta el brigading informado). Retención: 2 años después de resolver, luego purga (§8.7) [LEGAL REVIEW].';

comment on column public.reports.reporter_id is
  'Quien reporta. ON DELETE RESTRICT: las cuentas eliminadas sobreviven como cáscara anonimizada, así que la FK nunca se rompe (D3).';
comment on column public.reports.post_id is
  'Objetivo post. ON DELETE CASCADE: si el contenido se purga físicamente años después, el reporte se va con él.';
comment on column public.reports.comment_id is
  'Objetivo comentario. Mismo criterio de cascada que post_id.';
comment on column public.reports.resource_id is
  'Objetivo recurso. Mismo criterio de cascada que post_id.';
comment on column public.reports.profile_id is
  'Objetivo perfil (reporte contra una cuenta, no contra una pieza de contenido). RESTRICT porque los perfiles nunca se borran físicamente.';
comment on column public.reports.categoria is
  'Categoría cerrada de PART 11 §11.3.1. Cada valor mapea a exactamente una regla de la comunidad. infraccion_autor y otro exigen detalle en la UI.';
comment on column public.reports.detalle is
  'Texto libre opcional del reportante, máximo 1000 caracteres (LIMITS.reportDetail).';
comment on column public.reports.status is
  'Estado en la cola de moderación. resuelto_duplicado es el auto-cierre de reportes sobre contenido ya accionado (§11.3.3).';
comment on column public.reports.resolved_by is
  'Moderador que cerró el reporte. Se llena desde mod_resolve_report.';
comment on column public.reports.resolved_at is
  'Momento del cierre. Ancla la retención de 2 años del §8.7.';

-- Índices (§8.3.6): la cola, más deduplicación estructural por objetivo.
create index reports_queue_idx
  on public.reports (status, created_at)
  where status in ('abierto','en_revision');

-- Un reportante puede reportar una cosa una sola vez: la unicidad es estructural,
-- no procedural. Un índice parcial por tipo de objetivo, porque las columnas de
-- objetivo son nullables y NULL no dedupea.
create unique index reports_dedup_post_uidx
  on public.reports (reporter_id, post_id)
  where post_id is not null;

create unique index reports_dedup_comment_uidx
  on public.reports (reporter_id, comment_id)
  where comment_id is not null;

create unique index reports_dedup_resource_uidx
  on public.reports (reporter_id, resource_id)
  where resource_id is not null;

create unique index reports_dedup_profile_uidx
  on public.reports (reporter_id, profile_id)
  where profile_id is not null;

alter table public.reports enable row level security;

revoke all on public.reports from anon, authenticated;
grant select on public.reports to authenticated;

-- Solo moderación lee la cola. Sin política de insert/update/delete: se escribe
-- desde funciones SECURITY DEFINER (create_report, mod_resolve_report).
create policy reports_select_mod on public.reports
  for select to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('mod','admin')
    )
  );


-- -----------------------------------------------------------------------------
-- mod_actions — bitácora inmutable de toda decisión de moderación
-- -----------------------------------------------------------------------------
-- Las FK de contenido son ON DELETE SET NULL: la fila de auditoría tiene que
-- sobrevivir a cualquier purga. Por eso cada fila además congela target_kind y
-- target_public_id como texto al momento de escribir; el CHECK de objetivo es
-- <= 1 (no = 1) justamente porque después de una purga puede quedar en 0. La RPC
-- que inserta garantiza exactamente 1 en el momento del alta.

create table public.mod_actions (
  id               bigint generated always as identity primary key,
  actor_id         uuid not null references public.profiles(id) on delete restrict,
  action           text not null constraint mod_actions_action_check check (action in
                     ('remover','restaurar','advertir','suspender','banear','desbanear',
                      'resolver_reporte','desestimar_reporte','retiro_legal',
                      'bloquear_hilo','revelar_autor')),
  post_id          bigint null references public.posts(id) on delete set null,
  comment_id       bigint null references public.comments(id) on delete set null,
  resource_id      bigint null references public.resources(id) on delete set null,
  profile_id       uuid null references public.profiles(id) on delete restrict,
  report_id        bigint null references public.reports(id) on delete set null,
  target_kind      text not null constraint mod_actions_target_kind_check
                     check (target_kind in ('post','comment','resource','profile')),
  target_public_id text not null constraint mod_actions_target_public_id_check
                     check (char_length(target_public_id) <= 40),
  motivo_publico   text not null constraint mod_actions_motivo_publico_check
                     check (char_length(motivo_publico) between 3 and 500),
  notas_internas   text null constraint mod_actions_notas_internas_check
                     check (char_length(notas_internas) <= 2000),
  created_at       timestamptz not null default now(),
  constraint mod_actions_max_one_target
    check (num_nonnulls(post_id, comment_id, resource_id, profile_id) <= 1)
);

comment on table public.mod_actions is
  'Bitácora append-only de toda decisión de moderación (D14.10, PART 10 §10.12). Nunca se borra ni se corrige: una corrección es una fila nueva. Es el registro de rendición de cuentas del proyecto, así que la inmutabilidad se defiende dos veces: sin grants de update/delete y con el trigger mod_actions_immutable.';

comment on column public.mod_actions.actor_id is
  'Moderador que ejecutó la acción. En la UI pública la moderación se muestra siempre como Moderación, nunca con el handle del mod (PART 10 §10.11); el interno queda acá.';
comment on column public.mod_actions.action is
  'Vocabulario cerrado de §0.5-R5. Dos acciones tienen semántica extra: bloquear_hilo setea posts.locked_at (create_comment rechaza hilos bloqueados) y revelar_autor ES la auditoría del Ver autor break-glass (no hay tabla de reveals aparte).';
comment on column public.mod_actions.post_id is
  'Objetivo post. SET NULL en purga: la auditoría sobrevive al contenido.';
comment on column public.mod_actions.comment_id is
  'Objetivo comentario. SET NULL en purga.';
comment on column public.mod_actions.resource_id is
  'Objetivo recurso. SET NULL en purga.';
comment on column public.mod_actions.profile_id is
  'Objetivo perfil (sanciones de cuenta). RESTRICT: los perfiles no se borran físicamente, quedan como cáscara.';
comment on column public.mod_actions.report_id is
  'Reporte que originó la acción, si vino de la cola. SET NULL cuando el reporte se purga a los 2 años.';
comment on column public.mod_actions.target_kind is
  'Tipo de objetivo congelado al insertar. Junto con target_public_id mantiene legible la fila aunque la FK haya quedado en NULL.';
comment on column public.mod_actions.target_public_id is
  'public_id (nanoid) o handle del objetivo, congelado como texto al insertar. Nunca un id de secuencia (D14.7).';
comment on column public.mod_actions.motivo_publico is
  'Lo que ve el usuario afectado en su aviso, en es-AR. La moderación de tu contenido nunca es anónima para vos (D3). Ej.: Se removió tu publicación por datos personales de terceros.';
comment on column public.mod_actions.notas_internas is
  'Notas del equipo de moderación. Nunca sale del panel /mod: no aparece en avisos, ni en vistas públicas, ni en apelaciones.';

-- Índices (§8.3.6).
create index mod_actions_created_at_idx on public.mod_actions (created_at desc);
create index mod_actions_actor_idx on public.mod_actions (actor_id, created_at desc);
create index mod_actions_profile_idx on public.mod_actions (profile_id) where profile_id is not null;
create index mod_actions_target_public_id_idx on public.mod_actions (target_public_id);

-- Inmutabilidad, cinturón y tiradores. El helper raise_immutable() vive en 0001
-- y NO parametriza el código: levanta siempre NOT_ALLOWED (el único código de
-- RPC_ERROR_CODES aplicable) y manda el detalle forense por DETAIL. §8.3.6
-- describe la guardia como `raise exception 'MOD_ACTIONS_IMMUTABLE'`, pero ese
-- string no está en RPC_ERROR_CODES (lib/errors.ts) y ningún rol de la app puede
-- alcanzar el trigger (no hay grants de update ni de delete), así que nunca
-- necesita copy en es-AR. El argumento se conserva sólo como etiqueta legible en
-- el catálogo de triggers; la función lo ignora.
create trigger mod_actions_immutable
  before update or delete on public.mod_actions
  for each row
  execute function public.raise_immutable('MOD_ACTIONS_IMMUTABLE');

alter table public.mod_actions enable row level security;

revoke all on public.mod_actions from anon, authenticated;
grant select on public.mod_actions to authenticated;

-- Lectura solo para moderación. Sin políticas de insert (las RPC de moderación
-- son SECURITY DEFINER) y sin políticas de update/delete: nadie, nunca.
create policy mod_actions_select_mod on public.mod_actions
  for select to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('mod','admin')
    )
  );


-- -----------------------------------------------------------------------------
-- user_restrictions — suspensiones y baneos; fuente de verdad de la aplicación
-- -----------------------------------------------------------------------------

create table public.user_restrictions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete restrict,
  tipo       text not null constraint user_restrictions_tipo_check
             check (tipo in ('suspension','ban')),
  motivo     text not null constraint user_restrictions_motivo_check
             check (char_length(motivo) between 3 and 500),
  created_by uuid not null references public.profiles(id) on delete restrict,
  starts_at  timestamptz not null default now(),
  until      timestamptz null,
  revoked_at timestamptz null,
  revoked_by uuid null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint restrictions_window check (until is null or until > starts_at)
);

comment on table public.user_restrictions is
  'Restricciones de cuenta, temporales o permanentes. Es la fuente de verdad que lee toda RPC de escritura en su paso de guarda. Restricción activa = revoked_at is null and (until is null or until > now()); el helper has_active_restriction(uid) centraliza ese predicado. profiles.status espeja la peor restricción vigente (suspendido/baneado) para chequeos baratos y para la vista pública; el espejo lo mantienen las RPC de moderación y lo re-deriva el job nocturno cuando una suspensión vence.';

comment on column public.user_restrictions.user_id is
  'Cuenta restringida.';
comment on column public.user_restrictions.tipo is
  'suspension = temporal o revocable; ban = expulsión. La duración no se codifica en el nombre: vive en until (§0.5-R5).';
comment on column public.user_restrictions.motivo is
  'Motivo en es-AR, visible para el usuario restringido en su aviso.';
comment on column public.user_restrictions.created_by is
  'Moderador que aplicó la restricción.';
comment on column public.user_restrictions.starts_at is
  'Inicio de la ventana. Normalmente now(), separado de created_at para poder programar o corregir sin perder el momento del alta.';
comment on column public.user_restrictions.until is
  'Fin de la ventana. NULL = permanente. La escalera de duraciones (7 y 30 días) es la de PART 11 §11.6.';
comment on column public.user_restrictions.revoked_at is
  'Momento de la revocación. Las restricciones no se borran: se revocan (mod_revoke_restriction).';
comment on column public.user_restrictions.revoked_by is
  'Moderador que revocó.';

-- Índices (§8.3.6): camino caliente de la guarda, y barrido de vencimientos.
create index user_restrictions_active_idx
  on public.user_restrictions (user_id)
  where revoked_at is null;

create index user_restrictions_until_idx
  on public.user_restrictions (until)
  where revoked_at is null;

alter table public.user_restrictions enable row level security;

revoke all on public.user_restrictions from anon, authenticated;
grant select on public.user_restrictions to authenticated;

-- Podés ver por qué estás restringido: transparencia sobre la propia sanción.
create policy user_restrictions_select_own on public.user_restrictions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy user_restrictions_select_mod on public.user_restrictions
  for select to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('mod','admin')
    )
  );


-- -----------------------------------------------------------------------------
-- appeals — una apelación por acción de moderación (§0.5-R15)
-- -----------------------------------------------------------------------------

create table public.appeals (
  id            bigint generated always as identity primary key,
  mod_action_id bigint not null unique references public.mod_actions(id) on delete restrict,
  body          text not null constraint appeals_body_check
                check (char_length(body) between 1 and 2000),
  status        text not null default 'pendiente'
                constraint appeals_status_check
                check (status in ('pendiente','aceptada','rechazada')),
  reviewed_by   uuid null references public.profiles(id) on delete restrict,
  created_at    timestamptz not null default now()
);

comment on table public.appeals is
  'Flujo estructurado de /apelacion (PART 11 §11.5.2, §0.5-R15): una apelación por acción de moderación, resuelta por un revisor distinto del actor original. El apelante no se guarda redundante: la autoría se verifica contra el objetivo de la mod_action enlazada, al insertar (create_appeal) y al leer (política de RLS).';

comment on column public.appeals.mod_action_id is
  'Acción apelada. UNIQUE: una apelación por acción, estructuralmente. RESTRICT: la cadena de auditoría no se rompe.';
comment on column public.appeals.body is
  'Texto de la apelación, máximo 2000 caracteres (LIMITS.appealBody).';
comment on column public.appeals.status is
  'pendiente hasta que un segundo moderador la resuelve con mod_review_appeal.';
comment on column public.appeals.reviewed_by is
  'Revisor. Debe ser distinto del actor de la mod_action original (PART 11 §11.5.2); la RPC lo verifica.';

-- Índice de la cola de revisión (§8.3.6). La PK y el UNIQUE de mod_action_id ya
-- traen sus propios índices.
create index appeals_pending_idx
  on public.appeals (status)
  where status = 'pendiente';

-- Resolución del apelante. Tiene que ser SECURITY DEFINER: una subconsulta común
-- dentro de una política se evalúa con los permisos del llamador, y el apelante
-- no puede leer mod_actions (política mod/admin) ni posts/comments/resources
-- (cero grants, tenet 5), así que la subconsulta le daría siempre falso. La
-- función corre como owner, no toma el uuid por parámetro (leerlo de auth.uid()
-- evita que sirva de oráculo para preguntar por terceros) y devuelve solo un
-- booleano.
create or replace function public.is_appeal_appellant(p_mod_action_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.mod_actions ma
    left join public.posts     po on po.id = ma.post_id
    left join public.comments  co on co.id = ma.comment_id
    left join public.resources re on re.id = ma.resource_id
    where ma.id = p_mod_action_id
      and auth.uid() is not null
      and auth.uid() = coalesce(po.author_id, co.author_id, re.author_id, ma.profile_id)
  );
$$;

comment on function public.is_appeal_appellant(bigint) is
  'True si quien llama es el usuario afectado por esa acción de moderación: autor del post, del comentario o del recurso, o el perfil sancionado. Existe para la política de select de appeals (§8.3.6) y la reutiliza create_appeal. Devuelve booleano y nunca expone identidades.';

revoke execute on function public.is_appeal_appellant(bigint) from public, anon;
grant execute on function public.is_appeal_appellant(bigint) to authenticated;

alter table public.appeals enable row level security;

revoke all on public.appeals from anon, authenticated;
grant select on public.appeals to authenticated;

create policy appeals_select_appellant on public.appeals
  for select to authenticated
  using (public.is_appeal_appellant(mod_action_id));

create policy appeals_select_mod on public.appeals
  for select to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('mod','admin')
    )
  );
