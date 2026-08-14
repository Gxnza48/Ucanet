-- =====================================================================================
-- BORRA TODO EL CONTENIDO DE DEMOSTRACIÓN
--
-- Corré esto ANTES de mandar la primera invitación real. D11 no admite señales
-- fabricadas conviviendo con gente real: una comunidad chica y densa se da cuenta, y el
-- carácter de institución no se recupera después.
--
-- Se apoya en dos marcas puestas a propósito por 00_contenido_demo.sql: el dominio
-- @demo.ucanet.test en auth.users y el prefijo "demo" en profiles.handle. Nada que no
-- lleve una de las dos se toca.
--
-- El borrado es FÍSICO, no el soft-delete del producto (§8.7): esto nunca fue contenido
-- de nadie, así que no hay derecho de autoría ni historial que preservar.
-- =====================================================================================

begin;

create temporary table _demo_ids on commit drop as
select id from public.profiles where handle like 'demo%';

-- El orden importa: primero lo que apunta a posts y comments, después ellos, al final
-- los perfiles. Varias FK son ON DELETE RESTRICT justamente para que un borrado
-- descuidado falle en vez de dejar el grafo inconsistente.
delete from public.post_votes    where user_id in (select id from _demo_ids);
delete from public.comment_votes where user_id in (select id from _demo_ids);
delete from public.resource_votes where user_id in (select id from _demo_ids);
delete from public.bookmarks     where user_id in (select id from _demo_ids);
delete from public.materia_follows where user_id in (select id from _demo_ids);
delete from public.notifications where user_id in (select id from _demo_ids);

delete from public.post_votes    where post_id in (select id from public.posts where author_id in (select id from _demo_ids));
delete from public.comment_votes where comment_id in (select id from public.comments where author_id in (select id from _demo_ids));
delete from public.bookmarks     where post_id in (select id from public.posts where author_id in (select id from _demo_ids));

delete from public.comments where author_id in (select id from _demo_ids);
delete from public.comments where post_id in (select id from public.posts where author_id in (select id from _demo_ids));
delete from public.anon_aliases where author_id in (select id from _demo_ids);
delete from public.anon_aliases where post_id in (select id from public.posts where author_id in (select id from _demo_ids));
delete from public.posts where author_id in (select id from _demo_ids);

delete from public.resource_files where resource_id in (select id from public.resources where author_id in (select id from _demo_ids));
delete from public.resources where author_id in (select id from _demo_ids);

delete from public.invites where created_by in (select id from _demo_ids);
delete from public.profiles where id in (select id from _demo_ids);
delete from auth.users where email like '%@demo.ucanet.test';

commit;

select public.reconcile_counters();

select 'Contenido de demostración eliminado. Perfiles restantes: '
       || (select count(*) from public.profiles)::text as resultado;
