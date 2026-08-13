-- =============================================================================
-- 0003 — Invitaciones y lista de espera
-- =============================================================================
-- Implementa PART 8 §8.3.7: `invites` y `waitlist`. Las dos tablas gobiernan el
-- portón de registro mientras el alta es por invitación (D3, §0.5-R22).
--
-- Orden dentro del set de migraciones (§8.10.1) — el único dos pasos intencional:
--   profiles.invited_with -> invites  obliga a crear invites ANTES que profiles,
--   pero invites.created_by -> profiles apunta en sentido contrario. Por eso acá
--   `created_by` existe como columna uuid not null pero SIN foreign key: la
--   restricción se agrega en 0004, después de crear profiles, con
--
--     alter table public.invites
--       add constraint invites_created_by_fkey
--       foreign key (created_by) references public.profiles(id) on delete restrict;
--
--   Por el mismo motivo, la política de lectura para administradores (que
--   consulta profiles.role) tampoco puede existir todavía: crearla acá haría
--   fallar la migración porque public.profiles aún no existe. 0004 la agrega:
--
--     create policy select_admin on public.invites
--       for select to authenticated
--       using (exists (select 1 from public.profiles p
--                      where p.id = auth.uid() and p.role = 'admin'));
--
--   En 0003 queda solamente la política `select_own`, que no depende de nada.
--
-- Reglas que rigen este archivo:
--   * tenet 1 (RLS everywhere): las dos tablas habilitan RLS. `waitlist` queda
--     con CERO políticas y CERO grants a propósito (§0.5-R22).
--   * §8.2.6: 0001 revocó los privilegios por defecto, así que `invites` recibe
--     su `grant select` explícito para authenticated, y `waitlist` ninguno.
--   * Ninguna de las dos tablas recibe grants de escritura: se escriben desde
--     funciones SECURITY DEFINER de 0011 y desde el trigger handle_new_user.
--
-- Depende de 0001: public.nanoid() y la extensión extensions.citext.
-- Forward-only: una vez aplicada, esta migración no se edita (§8.10.3).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- invites
-- -----------------------------------------------------------------------------
create table public.invites (
  id         bigint generated always as identity primary key,
  code       text not null unique default public.nanoid(8)
             constraint invites_code_check
             check (code ~ '^[a-z0-9]{8}$'),
  created_by uuid not null,
  max_uses   int not null default 10
             constraint invites_max_uses_check
             check (max_uses between 1 and 500),
  uses       int not null default 0,
  expires_at timestamptz null,
  note       text null
             constraint invites_note_check
             check (char_length(note) <= 200),
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint invites_uses_bound check (uses >= 0 and uses <= max_uses)
);

comment on table public.invites is
  'Links de invitación que habilitan el registro temprano (D3). El canje se registra en profiles.invited_with, lo que deja un árbol de invitaciones para análisis de abuso (PART 11) sin necesidad de una tabla de redenciones. Las filas no se borran nunca: la baja es revoked_at.';
comment on column public.invites.code is
  'Código público de la invitación; aparece en la URL /invitacion/[code]. Ocho caracteres del alfabeto no ambiguo de public.nanoid() (§8.2.1).';
comment on column public.invites.created_by is
  'Perfil que emitió la invitación. SIN foreign key en esta migración a propósito: public.profiles todavía no existe (§8.10.1). La restricción invites_created_by_fkey se agrega en 0004 con ON DELETE RESTRICT.';
comment on column public.invites.max_uses is
  'Cantidad máxima de canjes del código. Junto con uses acota el reparto: un link filtrado no abre el registro sin límite.';
comment on column public.invites.uses is
  'Canjes consumidos. Lo incrementa handle_new_user de forma atómica al crear el usuario (§0.5-R18): un UPDATE condicional que devuelve cero filas aborta el alta con INVITE_INVALID.';
comment on column public.invites.expires_at is
  'Vencimiento opcional. Null significa que el código no vence por tiempo, solo por max_uses o por revocación.';
comment on column public.invites.note is
  'Nota interna de quien emitió el código, para acordarse a quién se lo dio. Nunca se muestra a quien lo canjea.';
comment on column public.invites.revoked_at is
  'Momento de revocación manual. No null significa que el código dejó de ser canjeable aunque le sobren usos.';
comment on constraint invites_uses_bound on public.invites is
  'Los canjes nunca son negativos ni superan max_uses: la invariante del canje vive en la base, no en la aplicación (D14.9).';

-- Listado de invitaciones emitidas por una persona (panel de moderación).
create index idx_invites_created_by on public.invites (created_by);

alter table public.invites enable row level security;

-- Cada quien ve las invitaciones que emitió. La lectura de administradores llega
-- en 0004 como política `select_admin` (necesita profiles).
create policy select_own on public.invites
  for select
  to authenticated
  using (created_by = auth.uid());

-- Sin grants de escritura: los códigos se crean con la RPC create_invite (0011).
-- Sin grant para anon: §8.3.9 no le da a anon ningún acceso a esta tabla. La
-- validación del código previa al alta (§0.5-R18) la resuelve una RPC SECURITY
-- DEFINER, no una lectura directa: quien todavía no tiene cuenta es anon.
revoke all on table public.invites from anon, authenticated;
grant select on table public.invites to authenticated;


-- -----------------------------------------------------------------------------
-- waitlist
-- -----------------------------------------------------------------------------
create table public.waitlist (
  id         bigint generated always as identity primary key,
  email      extensions.citext not null unique,
  created_at timestamptz not null default now(),
  invited_at timestamptz null,
  source     text null
             constraint waitlist_source_check
             check (char_length(source) <= 60)
);

comment on table public.waitlist is
  'Correos capturados mientras el registro está cerrado por invitación (§0.5-R22; flujo en PART 6 §6.10-A). Es PII pura, sin ningún valor de producto después de la conversión, así que la postura es de máximo encierro: RLS habilitada, cero políticas y cero grants. Se escribe desde la función SECURITY DEFINER que llama el formulario público y se lee únicamente desde scripts de servicio con la service-role key.';
comment on column public.waitlist.email is
  'Correo de contacto, citext para que la deduplicación por mayúsculas sea estructural y no dependa de que la aplicación normalice.';
comment on column public.waitlist.invited_at is
  'Momento en que se le envió la invitación. Null es la cola de pendientes. Una vez invitada y honrada, la fila se borra desde el lado servidor.';
comment on column public.waitlist.source is
  'Origen de la captura, por ejemplo cartel con QR o link compartido. Lo fija el servidor con una etiqueta corta, nunca es texto libre escrito por la persona.';

-- Cola de pendientes: solo interesan las filas todavía no invitadas.
create index idx_waitlist_invited_at_pending on public.waitlist (invited_at) where invited_at is null;

-- RLS habilitada y deliberadamente SIN políticas: toda lectura o escritura de un
-- rol de aplicación queda bloqueada. Es un lockdown de servicio, no un olvido
-- (tenet 1, §0.5-R22). Cualquier política que se agregue acá en el futuro debe
-- justificarse contra la matriz de acceso de §8.3.9.
alter table public.waitlist enable row level security;

-- Sin grants: ni anon ni authenticated tocan esta tabla, ni siquiera para leer.
revoke all on table public.waitlist from anon, authenticated;
