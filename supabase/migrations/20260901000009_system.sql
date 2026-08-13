-- =============================================================================
-- 0009 — Sistema
-- Tablas: notifications, events, search_queries, app_settings
-- =============================================================================
-- Fuente normativa: PART 8 §8.3.7. Nombres de tabla, columna, constraint y check
-- se copian textualmente. invites y waitlist, que en §8.3.7 comparten sección,
-- ya se crearon en 0003 y no se tocan acá.
--
-- Postura de acceso (§8.3.9) — nada para anon en ninguna de las cuatro tablas:
--   notifications  select propias + update(read_at) propias   inserta: create_comment y RPC de moderación
--   events         select solo mod/admin                      escribe: track_event (SECURITY DEFINER)
--   search_queries select solo mod/admin                      escribe: las funciones search_* (SECURITY DEFINER)
--   app_settings   select y update solo role = admin          las RPC lo leen como definer, sin grant extra
--
-- Convención de este archivo (igual que 0008): los CHECK de columna se declaran
-- con el mismo nombre que Postgres generaría solo (<tabla>_<columna>_check).
-- §8.2.2 pide CHECK con nombre; el DDL de §8.3.7 los muestra inline sin nombre.
-- El nombre resultante es idéntico al del DDL verbatim.
--
-- Predicado mod/admin: subconsulta sobre public.profiles que solo lee la fila
-- propia del llamador, permitida por la política de autolectura de profiles
-- (§8.3.2). auth.uid() envuelto en (select ...) para que sea initplan.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- notifications — avisos in-app (§0.5-R14)
-- -----------------------------------------------------------------------------
-- Única tabla del lado del contenido con acceso directo desde la app: se lee y se
-- marca como leída sin pasar por una RPC. No hay riesgo de anonimato porque
-- actor_display ya es la etiqueta pública (handle o Anónimo N), calculada al
-- insertar: el handle real de un actor anónimo nunca entra en esta tabla.

create table public.notifications (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references public.profiles(id) on delete restrict,
  type          text not null constraint notifications_type_check check (type in
                  ('respuesta_post','respuesta_comentario','decision_mod','reporte_resuelto')),
  post_id       bigint null references public.posts(id) on delete cascade,
  comment_id    bigint null references public.comments(id) on delete cascade,
  mod_action_id bigint null references public.mod_actions(id) on delete set null,
  actor_display text not null constraint notifications_actor_display_check
                  check (char_length(actor_display) <= 40),
  group_key     text null,
  group_count   int not null default 1,
  read_at       timestamptz null,
  created_at    timestamptz not null default now(),
  constraint notifications_target check (
    (type = 'respuesta_post'       and post_id is not null and comment_id is not null) or
    (type = 'respuesta_comentario' and post_id is not null and comment_id is not null) or
    (type = 'decision_mod'         and mod_action_id is not null) or
    (type = 'reporte_resuelto'     and mod_action_id is not null)
  )
);

comment on table public.notifications is
  'Avisos in-app, únicos tipos del MVP (D2, §0.5-R14): respuestas a tu publicación o a tu comentario, decisiones de moderación que te afectan y el cierre de un reporte que hiciste. Punteros efímeros, no material de archivo: se purgan a los 90 días si están leídos y a los 180 si no (§8.7). Preferencias v1 = el booleano profiles.notif_respuestas, que silencia solo los tipos de respuesta; decision_mod y reporte_resuelto son siempre activos y no se pueden desactivar.';

comment on column public.notifications.user_id is
  'Destinatario del aviso.';
comment on column public.notifications.type is
  'Tipo cerrado. La lista es el punto de extensión de P2 (menciones, digest de seguidas).';
comment on column public.notifications.post_id is
  'Publicación referida. CASCADE: si el contenido se purga, el aviso se va con él.';
comment on column public.notifications.comment_id is
  'Comentario que disparó el aviso, para el permalink /p/[postId]#c-[commentId]. CASCADE.';
comment on column public.notifications.mod_action_id is
  'Acción de moderación referida, para mostrar el motivo público y ofrecer apelar. SET NULL es teórico: mod_actions no se borra nunca (§8.3.6).';
comment on column public.notifications.actor_display is
  'Etiqueta pública del actor, congelada al insertar: el handle del momento, o el alias por hilo (Anónimo N) si el contenido que disparó el aviso era anónimo. No se recalcula ante un rename: un aviso puede mostrar un handle viejo durante su vida acotada, y eso es preferible a un join que podría filtrar o desincronizar (C5).';
comment on column public.notifications.group_key is
  'Balde de agrupación, tipo + post objetivo (ej.: respuesta_post:123). Un evento nuevo cuyo group_key coincide con un aviso NO leído lo actualiza en lugar de insertar otro; una vez leído el grupo se sella y el siguiente evento abre fila nueva (PART 12).';
comment on column public.notifications.group_count is
  'Cuántos eventos colapsó este aviso. 1 = evento único. Habilita el copy 3 respuestas nuevas en tu publicación.';
comment on column public.notifications.read_at is
  'NULL = no leído (alimenta el badge del header, tope 9+). Abrir /avisos marca como leído todo lo listado en un solo UPDATE: es la única columna que la app puede escribir directo.';

-- Índices (§8.3.7).
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
-- Grant acotado a columna: marcar como leído es lo único que la app escribe acá.
-- Ni el tipo, ni el actor, ni el contador de grupo son tocables desde el cliente.
grant update (read_at) on public.notifications to authenticated;

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));


-- -----------------------------------------------------------------------------
-- events — analítica agregada, sin filas por usuario (§0.5-R11, PART 24)
-- -----------------------------------------------------------------------------

create table public.events (
  name       text not null constraint events_name_check check (char_length(name) <= 60),
  day        date not null default current_date,
  dim        text not null default '' constraint events_dim_check check (char_length(dim) <= 60),
  count      bigint not null default 0,
  primary key (name, day, dim)
);

comment on table public.events is
  'Contadores nombrados por día: la analítica entera del producto (PART 24). Cero filas por usuario, cero cookies. Esta tabla no puede reconstruir la conducta de nadie, y eso es el objetivo de diseño, no una limitación. Se incrementa solo con la RPC track_event, que valida name y dim contra las listas cerradas de PART 24 para que no entre basura de alta cardinalidad. No se borra nunca: pesa KB por año y es la materia prima de las estadísticas anonimizadas del archivo.';

comment on column public.events.name is
  'Nombre del evento, de la lista cerrada de PART 24.';
comment on column public.events.day is
  'Día del balde. Hace también de created_at (tenet 8).';
comment on column public.events.dim is
  'Dimensión opcional de baja cardinalidad, de las listas cerradas de PART 24. Cadena vacía = sin dimensión. Nunca texto libre: las consultas de búsqueda van a search_queries (§0.5-R10).';
comment on column public.events.count is
  'Contador acumulado del balde (name, day, dim).';

alter table public.events enable row level security;

revoke all on public.events from anon, authenticated;
grant select on public.events to authenticated;

-- Sin lectura para roles de app salvo el panel de métricas (/mod/metricas).
-- Sin políticas de escritura: track_event es SECURITY DEFINER.
create policy events_select_mod on public.events
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
-- search_queries — telemetría de búsqueda por día, sin vínculo con usuarios (§0.5-R10)
-- -----------------------------------------------------------------------------

create table public.search_queries (
  day           date not null default current_date,
  query_norm    text not null constraint search_queries_query_norm_check
                check (char_length(query_norm) <= 120),
  results_total int not null default 0,
  zero_results  boolean not null default false,
  count         int not null default 1,
  primary key (day, query_norm)
);

comment on table public.search_queries is
  'Qué buscan los estudiantes y qué no devuelve nada: el insumo de las decisiones de contenido semilla y de alias de materias. Sin vínculo con usuarios, jamás: no hay columna de usuario ni la habrá. Las consultas se normalizan y redactan según PART 13 §13.8 antes de tocar esta tabla, y se hace upsert desde las funciones search_*. Retención: 12 meses (§8.7).';

comment on column public.search_queries.day is
  'Día del balde. Hace también de created_at (tenet 8) y es la mitad de la PK.';
comment on column public.search_queries.query_norm is
  'Consulta normalizada y redactada (minúsculas, sin acentos, sin datos personales) según PART 13 §13.8.';
comment on column public.search_queries.results_total is
  'Cantidad de resultados devueltos la última vez que se corrió esta consulta ese día.';
comment on column public.search_queries.zero_results is
  'True si la consulta no devolvió nada: la señal más útil de la tabla, marca huecos del catálogo y del contenido.';
comment on column public.search_queries.count is
  'Cuántas veces se buscó esa cadena ese día.';

alter table public.search_queries enable row level security;

revoke all on public.search_queries from anon, authenticated;
grant select on public.search_queries to authenticated;

-- Sin políticas para roles de app salvo moderación; las escrituras ocurren dentro
-- de las funciones search_* (SECURITY DEFINER).
create policy search_queries_select_mod on public.search_queries
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
-- app_settings — banderas de runtime y kill-switches (§0.5-R22, PART 10 §10.14)
-- -----------------------------------------------------------------------------

create table public.app_settings (
  key        text primary key constraint app_settings_key_check check (char_length(key) <= 60),
  value      jsonb not null,
  updated_by uuid null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.app_settings is
  'Banderas de runtime y kill-switches sin deploy (§0.5-R22, PART 10 §10.14). Deliberadamente diminuta: clave-valor que las RPC leen en su paso de guarda. Las altas y bajas de claves son migraciones; los valores los cambian los admins desde el panel, y cada cambio deja su fila en mod_actions. Claves vigentes: registro_abierto (false = registro público cerrado, solo se entra con invitación), publicaciones_pausadas (true = las RPC de creación de contenido cortan con KILL_SWITCH), subidas_pausadas (true = request_upload y finalize_upload cortan con KILL_SWITCH).';

comment on column public.app_settings.key is
  'Nombre de la bandera. Se agrega y se retira por migración, nunca desde la app.';
comment on column public.app_settings.value is
  'Valor jsonb. Las kill-switches guardan booleanos (true/false); el tipo jsonb deja lugar a banderas con estructura sin cambiar el esquema.';
comment on column public.app_settings.updated_by is
  'Admin que cambió el valor por última vez. NULL en las filas creadas por migración.';
comment on column public.app_settings.updated_at is
  'Último cambio de valor. Lo escribe el mismo update del admin.';

alter table public.app_settings enable row level security;

revoke all on public.app_settings from anon, authenticated;
grant select on public.app_settings to authenticated;
-- Update acotado a columna: un admin cambia valores, no renombra claves.
-- El alta y la baja de claves siguen siendo una migración.
grant update (value, updated_by, updated_at) on public.app_settings to authenticated;

create policy app_settings_select_admin on public.app_settings
  for select to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
    )
  );

create policy app_settings_update_admin on public.app_settings
  for update to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
    )
  );

-- Kill-switches iniciales. Esto es configuración, no datos: las filas son parte
-- del esquema porque las RPC las leen en su paso de guarda y una clave ausente no
-- tiene semántica definida. Por eso van acá y no en supabase/seed.sql, que es solo
-- para fixtures de desarrollo. ON CONFLICT DO NOTHING: la migración no pisa un
-- valor que un admin ya haya cambiado.
insert into public.app_settings (key, value) values
  ('registro_abierto',       'false'::jsonb),
  ('publicaciones_pausadas', 'false'::jsonb),
  ('subidas_pausadas',       'false'::jsonb),
  ('sitio_solo_lectura',     'false'::jsonb)
on conflict (key) do nothing;

-- Semántica de cada bandera:
--   registro_abierto       false = el registro público está cerrado; solo se entra
--                          con invitación (D3, D11: la beta arranca invite-only).
--                          Ponerlo en true abre el registro abierto.
--   publicaciones_pausadas true = las RPC de creación de contenido cortan con
--                          KILL_SWITCH. Freno de mano ante una ola de abuso.
--   sitio_solo_lectura     true = el sitio entero queda en modo lectura: create_report
--                          y create_appeal cortan con KILL_SWITCH. Las RPC de
--                          moderación NO lo consultan a propósito: el modo lectura se
--                          prende JUSTAMENTE durante un incidente, y es cuando el
--                          equipo de moderación más tiene que poder actuar
--                          (PART 10 §10.14).
--   subidas_pausadas       true = request_upload y finalize_upload cortan con
--                          KILL_SWITCH. Freno independiente para el pipeline de
--                          archivos (cuota de R2, reclamo de derechos de autor).
