/**
 * lib/types.gen.ts — el tipo `Database` de uca.net.
 *
 * ESTE ARCHIVO ESTÁ ESCRITO A MANO. El entorno donde se construyó el MVP no tiene
 * Docker, así que `supabase start` no puede levantar el stack local y por lo tanto
 * `supabase gen types typescript --local` no puede correr. Cada tipo de acá se
 * derivó leyendo `supabase/migrations/*.sql` una por una: las migraciones son la
 * fuente de verdad, no el plan.
 *
 * Para regenerarlo de verdad (en CI, o en cualquier máquina con Docker):
 *
 *     npm run db:start        # supabase start
 *     npm run gen:types       # supabase gen types typescript --local > lib/types.gen.ts
 *
 * Por eso la forma respeta exactamente la que emite `supabase gen types typescript`
 * (BUILD-CONTRACT §4.1): `{ public: { Tables, Views, Functions, Enums, CompositeTypes } }`,
 * con Row / Insert / Update / Relationships por tabla. El reemplazo es 1:1 — cuando CI
 * regenere el archivo, el bloque `Database` de abajo se pisa entero y la aplicación
 * tiene que seguir compilando sin tocar nada más.
 *
 * OJO al regenerar: `npm run gen:types` reescribe el archivo COMPLETO, así que se
 * lleva puestos este encabezado y el bloque de alias de conveniencia del final
 * (Tables<>, Views<>, PostPublic, …), que el resto de la aplicación sí importa.
 * Hay que volver a pegarlos abajo del tipo generado. Están al final, entre marcas.
 *
 * Criterios de traducción Postgres → TypeScript (BUILD-CONTRACT §4.1):
 *   bigint | int | smallint | double precision → number
 *   text | citext | uuid | timestamptz | date   → string
 *   boolean → boolean · jsonb → Json · text[] → string[] · tsvector → unknown
 *   columnas nullable → `| null`
 *   `generated always as identity` y columnas generadas → `?: never` en Insert/Update
 *     (es lo que emite el generador: no se pueden escribir).
 *
 * NULABILIDAD DE LAS VISTAS — leer antes de escribir los `queries.ts` de features.
 * Postgres no propaga NOT NULL a las columnas de una vista (`pg_attribute.attnotnull`
 * es false para todas), así que `supabase gen types` tipa TODAS las columnas de las
 * cinco vistas `_public` como `| null`, incluidas `public_id`, `title` o `created_at`,
 * que en la práctica nunca son null. Acá se replica ese comportamiento a propósito:
 * si el código se escribe contra tipos no-nullables y CI regenera el archivo con los
 * nullables, el build se rompe entero. En el sentido contrario no pasa nada. Las
 * queries que arman `PostListItem`, `PostDetail`, etc. tienen que estrechar esos
 * campos ellas mismas (es el lugar correcto: ahí ya se conoce el invariante).
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      anon_aliases: {
        Row: {
          alias_num: number
          author_id: string
          created_at: string
          post_id: number
        }
        Insert: {
          alias_num: number
          author_id: string
          created_at?: string
          post_id: number
        }
        Update: {
          alias_num?: number
          author_id?: string
          created_at?: string
          post_id?: number
        }
        Relationships: [
          {
            foreignKeyName: 'anon_aliases_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'anon_aliases_post_id_fkey'
            columns: ['post_id']
            isOneToOne: false
            referencedRelation: 'posts'
            referencedColumns: ['id']
          },
        ]
      }
      app_settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: 'app_settings_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      appeals: {
        Row: {
          body: string
          created_at: string
          id: number
          mod_action_id: number
          reviewed_by: string | null
          status: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: never
          mod_action_id: number
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: never
          mod_action_id?: number
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'appeals_mod_action_id_fkey'
            columns: ['mod_action_id']
            isOneToOne: true
            referencedRelation: 'mod_actions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'appeals_reviewed_by_fkey'
            columns: ['reviewed_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      bookmarks: {
        Row: {
          created_at: string
          post_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bookmarks_post_id_fkey'
            columns: ['post_id']
            isOneToOne: false
            referencedRelation: 'posts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bookmarks_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      carreras: {
        Row: {
          created_at: string
          duracion_anios: number | null
          facultad_id: number
          id: number
          nivel: string
          nombre: string
          search: unknown | null
          slug: string
        }
        Insert: {
          created_at?: string
          duracion_anios?: number | null
          facultad_id: number
          id?: never
          nivel?: string
          nombre: string
          search?: never
          slug: string
        }
        Update: {
          created_at?: string
          duracion_anios?: number | null
          facultad_id?: number
          id?: never
          nivel?: string
          nombre?: string
          search?: never
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: 'carreras_facultad_id_fkey'
            columns: ['facultad_id']
            isOneToOne: false
            referencedRelation: 'facultades'
            referencedColumns: ['id']
          },
        ]
      }
      comment_votes: {
        Row: {
          comment_id: number
          created_at: string
          user_id: string
        }
        Insert: {
          comment_id: number
          created_at?: string
          user_id: string
        }
        Update: {
          comment_id?: number
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'comment_votes_comment_id_fkey'
            columns: ['comment_id']
            isOneToOne: false
            referencedRelation: 'comments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comment_votes_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          body: string | null
          created_at: string
          depth: number
          edited_at: string | null
          id: number
          is_anonymous: boolean
          parent_id: number | null
          post_id: number
          public_id: string
          score: number
          status: string
        }
        Insert: {
          author_id: string
          body?: string | null
          created_at?: string
          depth?: number
          edited_at?: string | null
          id?: never
          is_anonymous?: boolean
          parent_id?: number | null
          post_id: number
          public_id?: string
          score?: number
          status?: string
        }
        Update: {
          author_id?: string
          body?: string | null
          created_at?: string
          depth?: number
          edited_at?: string | null
          id?: never
          is_anonymous?: boolean
          parent_id?: number | null
          post_id?: number
          public_id?: string
          score?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'comments_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comments_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'comments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comments_post_id_fkey'
            columns: ['post_id']
            isOneToOne: false
            referencedRelation: 'posts'
            referencedColumns: ['id']
          },
        ]
      }
      download_log: {
        Row: {
          created_at: string
          resource_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          resource_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          resource_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'download_log_resource_id_fkey'
            columns: ['resource_id']
            isOneToOne: false
            referencedRelation: 'resources'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'download_log_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      events: {
        Row: {
          count: number
          day: string
          dim: string
          name: string
        }
        Insert: {
          count?: number
          day?: string
          dim?: string
          name: string
        }
        Update: {
          count?: number
          day?: string
          dim?: string
          name?: string
        }
        Relationships: []
      }
      facultades: {
        Row: {
          created_at: string
          id: number
          nombre: string
          sede_id: number
          slug: string
        }
        Insert: {
          created_at?: string
          id?: never
          nombre: string
          sede_id: number
          slug: string
        }
        Update: {
          created_at?: string
          id?: never
          nombre?: string
          sede_id?: number
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: 'facultades_sede_id_fkey'
            columns: ['sede_id']
            isOneToOne: false
            referencedRelation: 'sedes'
            referencedColumns: ['id']
          },
        ]
      }
      handle_blocklist: {
        Row: {
          created_at: string
          handle: string
        }
        Insert: {
          created_at?: string
          handle: string
        }
        Update: {
          created_at?: string
          handle?: string
        }
        Relationships: []
      }
      handle_history: {
        Row: {
          changed_at: string
          id: number
          old_handle: string
          profile_id: string
        }
        Insert: {
          changed_at?: string
          id?: never
          old_handle: string
          profile_id: string
        }
        Update: {
          changed_at?: string
          id?: never
          old_handle?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'handle_history_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      invites: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: number
          max_uses: number
          note: string | null
          revoked_at: string | null
          uses: number
        }
        Insert: {
          code?: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: never
          max_uses?: number
          note?: string | null
          revoked_at?: string | null
          uses?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: never
          max_uses?: number
          note?: string | null
          revoked_at?: string | null
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: 'invites_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      materia_follows: {
        Row: {
          created_at: string
          materia_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          materia_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          materia_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'materia_follows_materia_id_fkey'
            columns: ['materia_id']
            isOneToOne: false
            referencedRelation: 'materias'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'materia_follows_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      materias: {
        Row: {
          aliases: string[]
          created_at: string
          descripcion: string | null
          id: number
          nombre: string
          search: unknown | null
          slug: string
        }
        Insert: {
          aliases?: string[]
          created_at?: string
          descripcion?: string | null
          id?: never
          nombre: string
          search?: never
          slug: string
        }
        Update: {
          aliases?: string[]
          created_at?: string
          descripcion?: string | null
          id?: never
          nombre?: string
          search?: never
          slug?: string
        }
        Relationships: []
      }
      mod_actions: {
        Row: {
          action: string
          actor_id: string
          comment_id: number | null
          created_at: string
          id: number
          motivo_publico: string
          notas_internas: string | null
          post_id: number | null
          profile_id: string | null
          report_id: number | null
          resource_id: number | null
          target_kind: string
          target_public_id: string
        }
        Insert: {
          action: string
          actor_id: string
          comment_id?: number | null
          created_at?: string
          id?: never
          motivo_publico: string
          notas_internas?: string | null
          post_id?: number | null
          profile_id?: string | null
          report_id?: number | null
          resource_id?: number | null
          target_kind: string
          target_public_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          comment_id?: number | null
          created_at?: string
          id?: never
          motivo_publico?: string
          notas_internas?: string | null
          post_id?: number | null
          profile_id?: string | null
          report_id?: number | null
          resource_id?: number | null
          target_kind?: string
          target_public_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'mod_actions_actor_id_fkey'
            columns: ['actor_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mod_actions_comment_id_fkey'
            columns: ['comment_id']
            isOneToOne: false
            referencedRelation: 'comments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mod_actions_post_id_fkey'
            columns: ['post_id']
            isOneToOne: false
            referencedRelation: 'posts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mod_actions_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mod_actions_report_id_fkey'
            columns: ['report_id']
            isOneToOne: false
            referencedRelation: 'reports'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mod_actions_resource_id_fkey'
            columns: ['resource_id']
            isOneToOne: false
            referencedRelation: 'resources'
            referencedColumns: ['id']
          },
        ]
      }
      notifications: {
        Row: {
          actor_display: string
          comment_id: number | null
          created_at: string
          group_count: number
          group_key: string | null
          id: number
          mod_action_id: number | null
          post_id: number | null
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_display: string
          comment_id?: number | null
          created_at?: string
          group_count?: number
          group_key?: string | null
          id?: never
          mod_action_id?: number | null
          post_id?: number | null
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_display?: string
          comment_id?: number | null
          created_at?: string
          group_count?: number
          group_key?: string | null
          id?: never
          mod_action_id?: number | null
          post_id?: number | null
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notifications_comment_id_fkey'
            columns: ['comment_id']
            isOneToOne: false
            referencedRelation: 'comments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notifications_mod_action_id_fkey'
            columns: ['mod_action_id']
            isOneToOne: false
            referencedRelation: 'mod_actions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notifications_post_id_fkey'
            columns: ['post_id']
            isOneToOne: false
            referencedRelation: 'posts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notifications_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      plan_materias: {
        Row: {
          anio: number
          carrera_id: number
          codigo: string | null
          created_at: string
          cuatrimestre: number
          materia_id: number
          optativa: boolean
          plan: string
        }
        Insert: {
          anio: number
          carrera_id: number
          codigo?: string | null
          created_at?: string
          cuatrimestre: number
          materia_id: number
          optativa?: boolean
          plan: string
        }
        Update: {
          anio?: number
          carrera_id?: number
          codigo?: string | null
          created_at?: string
          cuatrimestre?: number
          materia_id?: number
          optativa?: boolean
          plan?: string
        }
        Relationships: [
          {
            foreignKeyName: 'plan_materias_carrera_id_fkey'
            columns: ['carrera_id']
            isOneToOne: false
            referencedRelation: 'carreras'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'plan_materias_materia_id_fkey'
            columns: ['materia_id']
            isOneToOne: false
            referencedRelation: 'materias'
            referencedColumns: ['id']
          },
        ]
      }
      post_votes: {
        Row: {
          created_at: string
          post_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'post_votes_post_id_fkey'
            columns: ['post_id']
            isOneToOne: false
            referencedRelation: 'posts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'post_votes_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          body: string | null
          carrera_id: number | null
          comments_count: number
          created_at: string
          edited_at: string | null
          id: number
          is_anonymous: boolean
          kind: string
          last_activity_at: string
          locked_at: string | null
          materia_id: number | null
          public_id: string
          score: number
          search: unknown | null
          status: string
          title: string | null
        }
        Insert: {
          author_id: string
          body?: string | null
          carrera_id?: number | null
          comments_count?: number
          created_at?: string
          edited_at?: string | null
          id?: never
          is_anonymous?: boolean
          kind?: string
          last_activity_at?: string
          locked_at?: string | null
          materia_id?: number | null
          public_id?: string
          score?: number
          search?: never
          status?: string
          title?: string | null
        }
        Update: {
          author_id?: string
          body?: string | null
          carrera_id?: number | null
          comments_count?: number
          created_at?: string
          edited_at?: string | null
          id?: never
          is_anonymous?: boolean
          kind?: string
          last_activity_at?: string
          locked_at?: string | null
          materia_id?: number | null
          public_id?: string
          score?: number
          search?: never
          status?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'posts_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'posts_carrera_id_fkey'
            columns: ['carrera_id']
            isOneToOne: false
            referencedRelation: 'carreras'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'posts_materia_id_fkey'
            columns: ['materia_id']
            isOneToOne: false
            referencedRelation: 'materias'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          carrera_id: number | null
          created_at: string
          handle: string
          handle_changed_at: string | null
          id: string
          ingreso_year: number | null
          invited_with: number | null
          karma: number
          last_seen_day: string | null
          notif_respuestas: boolean
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          carrera_id?: number | null
          created_at?: string
          handle: string
          handle_changed_at?: string | null
          id: string
          ingreso_year?: number | null
          invited_with?: number | null
          karma?: number
          last_seen_day?: string | null
          notif_respuestas?: boolean
          role?: string
          status?: string
          updated_at?: string
        }
        Update: {
          carrera_id?: number | null
          created_at?: string
          handle?: string
          handle_changed_at?: string | null
          id?: string
          ingreso_year?: number | null
          invited_with?: number | null
          karma?: number
          last_seen_day?: string | null
          notif_respuestas?: boolean
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_carrera_id_fkey'
            columns: ['carrera_id']
            isOneToOne: false
            referencedRelation: 'carreras'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'profiles_invited_with_fkey'
            columns: ['invited_with']
            isOneToOne: false
            referencedRelation: 'invites'
            referencedColumns: ['id']
          },
        ]
      }
      reports: {
        Row: {
          categoria: string
          comment_id: number | null
          created_at: string
          detalle: string | null
          id: number
          post_id: number | null
          profile_id: string | null
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          resource_id: number | null
          status: string
        }
        Insert: {
          categoria: string
          comment_id?: number | null
          created_at?: string
          detalle?: string | null
          id?: never
          post_id?: number | null
          profile_id?: string | null
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          resource_id?: number | null
          status?: string
        }
        Update: {
          categoria?: string
          comment_id?: number | null
          created_at?: string
          detalle?: string | null
          id?: never
          post_id?: number | null
          profile_id?: string | null
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          resource_id?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'reports_comment_id_fkey'
            columns: ['comment_id']
            isOneToOne: false
            referencedRelation: 'comments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reports_post_id_fkey'
            columns: ['post_id']
            isOneToOne: false
            referencedRelation: 'posts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reports_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reports_reporter_id_fkey'
            columns: ['reporter_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reports_resolved_by_fkey'
            columns: ['resolved_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reports_resource_id_fkey'
            columns: ['resource_id']
            isOneToOne: false
            referencedRelation: 'resources'
            referencedColumns: ['id']
          },
        ]
      }
      resource_files: {
        Row: {
          created_at: string
          id: number
          mime: string
          original_name: string
          position: number
          replaced_at: string | null
          resource_id: number
          sha256: string | null
          size_bytes: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: never
          mime: string
          original_name: string
          position?: number
          replaced_at?: string | null
          resource_id: number
          sha256?: string | null
          size_bytes: number
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: never
          mime?: string
          original_name?: string
          position?: number
          replaced_at?: string | null
          resource_id?: number
          sha256?: string | null
          size_bytes?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: 'resource_files_resource_id_fkey'
            columns: ['resource_id']
            isOneToOne: false
            referencedRelation: 'resources'
            referencedColumns: ['id']
          },
        ]
      }
      resource_votes: {
        Row: {
          created_at: string
          resource_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          resource_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          resource_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'resource_votes_resource_id_fkey'
            columns: ['resource_id']
            isOneToOne: false
            referencedRelation: 'resources'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'resource_votes_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      resources: {
        Row: {
          anio: number | null
          author_id: string
          created_at: string
          description: string | null
          downloads_count: number
          edited_at: string | null
          id: number
          is_anonymous: boolean
          materia_id: number
          price_cents: number | null
          public_id: string
          score: number
          search: unknown | null
          status: string
          tipo: string
          title: string
        }
        Insert: {
          anio?: number | null
          author_id: string
          created_at?: string
          description?: string | null
          downloads_count?: number
          edited_at?: string | null
          id?: never
          is_anonymous?: boolean
          materia_id: number
          price_cents?: number | null
          public_id?: string
          score?: number
          search?: never
          status?: string
          tipo: string
          title: string
        }
        Update: {
          anio?: number | null
          author_id?: string
          created_at?: string
          description?: string | null
          downloads_count?: number
          edited_at?: string | null
          id?: never
          is_anonymous?: boolean
          materia_id?: number
          price_cents?: number | null
          public_id?: string
          score?: number
          search?: never
          status?: string
          tipo?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: 'resources_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'resources_materia_id_fkey'
            columns: ['materia_id']
            isOneToOne: false
            referencedRelation: 'materias'
            referencedColumns: ['id']
          },
        ]
      }
      search_queries: {
        Row: {
          count: number
          day: string
          query_norm: string
          results_total: number
          zero_results: boolean
        }
        Insert: {
          count?: number
          day?: string
          query_norm: string
          results_total?: number
          zero_results?: boolean
        }
        Update: {
          count?: number
          day?: string
          query_norm?: string
          results_total?: number
          zero_results?: boolean
        }
        Relationships: []
      }
      sedes: {
        Row: {
          ciudad: string
          created_at: string
          direccion: string | null
          id: number
          nombre: string
          slug: string
          universidad_id: number
        }
        Insert: {
          ciudad: string
          created_at?: string
          direccion?: string | null
          id?: never
          nombre: string
          slug: string
          universidad_id: number
        }
        Update: {
          ciudad?: string
          created_at?: string
          direccion?: string | null
          id?: never
          nombre?: string
          slug?: string
          universidad_id?: number
        }
        Relationships: [
          {
            foreignKeyName: 'sedes_universidad_id_fkey'
            columns: ['universidad_id']
            isOneToOne: false
            referencedRelation: 'universidades'
            referencedColumns: ['id']
          },
        ]
      }
      universidades: {
        Row: {
          created_at: string
          id: number
          nombre: string
          sigla: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          id?: never
          nombre: string
          sigla?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          id?: never
          nombre?: string
          sigla?: string | null
          slug?: string
        }
        Relationships: []
      }
      user_restrictions: {
        Row: {
          created_at: string
          created_by: string
          id: number
          motivo: string
          revoked_at: string | null
          revoked_by: string | null
          starts_at: string
          tipo: string
          until: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: never
          motivo: string
          revoked_at?: string | null
          revoked_by?: string | null
          starts_at?: string
          tipo: string
          until?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: never
          motivo?: string
          revoked_at?: string | null
          revoked_by?: string | null
          starts_at?: string
          tipo?: string
          until?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_restrictions_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'user_restrictions_revoked_by_fkey'
            columns: ['revoked_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'user_restrictions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: number
          invited_at: string | null
          source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: never
          invited_at?: string | null
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: never
          invited_at?: string | null
          source?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      comments_public: {
        Row: {
          anon_alias_num: number | null
          author_handle: string | null
          body: string | null
          created_at: string | null
          depth: number | null
          edited_at: string | null
          id: number | null
          is_anonymous: boolean | null
          parent_id: number | null
          post_id: number | null
          public_id: string | null
          score: number | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'comments_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'comments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comments_post_id_fkey'
            columns: ['post_id']
            isOneToOne: false
            referencedRelation: 'posts'
            referencedColumns: ['id']
          },
        ]
      }
      posts_public: {
        Row: {
          author_handle: string | null
          body: string | null
          carrera_id: number | null
          comments_count: number | null
          created_at: string | null
          edited_at: string | null
          id: number | null
          is_anonymous: boolean | null
          kind: string | null
          last_activity_at: string | null
          locked_at: string | null
          materia_id: number | null
          public_id: string | null
          score: number | null
          search: unknown | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'posts_carrera_id_fkey'
            columns: ['carrera_id']
            isOneToOne: false
            referencedRelation: 'carreras'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'posts_materia_id_fkey'
            columns: ['materia_id']
            isOneToOne: false
            referencedRelation: 'materias'
            referencedColumns: ['id']
          },
        ]
      }
      profiles_public: {
        Row: {
          carrera_id: number | null
          created_at: string | null
          handle: string | null
          id: string | null
          ingreso_year: number | null
          karma: number | null
          role: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_carrera_id_fkey'
            columns: ['carrera_id']
            isOneToOne: false
            referencedRelation: 'carreras'
            referencedColumns: ['id']
          },
        ]
      }
      resource_files_public: {
        Row: {
          id: number | null
          mime: string | null
          original_name: string | null
          position: number | null
          resource_id: number | null
          size_bytes: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'resource_files_resource_id_fkey'
            columns: ['resource_id']
            isOneToOne: false
            referencedRelation: 'resources'
            referencedColumns: ['id']
          },
        ]
      }
      resources_public: {
        Row: {
          anio: number | null
          author_handle: string | null
          created_at: string | null
          description: string | null
          downloads_count: number | null
          edited_at: string | null
          id: number | null
          is_anonymous: boolean | null
          materia_id: number | null
          public_id: string | null
          score: number | null
          search: unknown | null
          tipo: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'resources_materia_id_fkey'
            columns: ['materia_id']
            isOneToOne: false
            referencedRelation: 'materias'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Functions: {
      account_tier: {
        Args: { p_created_at: string }
        Returns: string
      }
      app_setting: {
        Args: { p_key: string }
        Returns: Json
      }
      assert_can_write: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      assert_handle_ok: {
        Args: { p_handle: string; p_profile_id: string }
        Returns: undefined
      }
      complete_onboarding: {
        Args: { p_handle: string; p_carrera_id?: number; p_ingreso_year?: number }
        Returns: undefined
      }
      create_appeal: {
        Args: { p_mod_action_id: number; p_body: string }
        Returns: undefined
      }
      create_comment: {
        Args: {
          p_post_public_id: string
          p_parent_public_id?: string
          p_body?: string
          p_anonymous?: boolean
        }
        Returns: string
      }
      create_invite: {
        Args: { p_max_uses?: number; p_expires_at?: string; p_note?: string }
        Returns: string
      }
      create_post: {
        Args: {
          p_body: string
          p_title?: string
          p_materia_slug?: string
          p_kind?: string
          p_anonymous?: boolean
        }
        Returns: string
      }
      create_report: {
        Args: {
          p_target_kind: string
          p_target_public_id: string
          p_categoria: string
          p_detalle?: string
        }
        Returns: undefined
      }
      cron_heartbeat: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      current_profile: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          handle: string
          handle_changed_at: string
          carrera_id: number
          ingreso_year: number
          karma: number
          notif_respuestas: boolean
          role: string
          status: string
          invited_with: number
          created_at: string
          updated_at: string
        }[]
      }
      delete_account: {
        Args: { p_mode: string }
        Returns: undefined
      }
      delete_own_comment: {
        Args: { p_public_id: string }
        Returns: undefined
      }
      delete_own_post: {
        Args: { p_public_id: string }
        Returns: undefined
      }
      delete_own_resource: {
        Args: { p_public_id: string }
        Returns: undefined
      }
      f_array_to_string: {
        Args: { p_values: string[]; p_sep: string }
        Returns: string
      }
      f_unaccent: {
        Args: { p_text: string }
        Returns: string
      }
      feed_guardados: {
        Args: { p_limit?: number; p_after_created_at?: string; p_after_id?: number }
        Returns: {
          id: number
          public_id: string
          materia_id: number
          carrera_id: number
          kind: string
          title: string
          body: string
          is_anonymous: boolean
          author_handle: string
          score: number
          comments_count: number
          locked_at: string
          created_at: string
          edited_at: string
          last_activity_at: string
          saved_at: string
        }[]
      }
      feed_para_vos: {
        Args: { p_now: string; p_limit?: number; p_after_rank?: number; p_after_id?: number }
        Returns: {
          id: number
          public_id: string
          materia_id: number
          carrera_id: number
          kind: string
          title: string
          body: string
          is_anonymous: boolean
          author_handle: string
          score: number
          comments_count: number
          locked_at: string
          created_at: string
          edited_at: string
          last_activity_at: string
          rank: number
          motivo: string
        }[]
      }
      feed_tendencias: {
        Args: { p_now: string; p_limit?: number }
        Returns: {
          id: number
          public_id: string
          materia_id: number
          carrera_id: number
          kind: string
          title: string
          body: string
          is_anonymous: boolean
          author_handle: string
          score: number
          comments_count: number
          locked_at: string
          created_at: string
          edited_at: string
          last_activity_at: string
          velocidad: number
        }[]
      }
      finalize_upload: {
        Args: { p_resource_public_id: string; p_files: Json }
        Returns: undefined
      }
      handle_new_user: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      has_active_restriction: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      is_appeal_appellant: {
        Args: { p_mod_action_id: number }
        Returns: boolean
      }
      is_own_content: {
        Args: { p_kind: string; p_public_id: string }
        Returns: boolean
      }
      check_invite: {
        Args: { p_code: string }
        Returns: Json
      }
      compute_activity_rollups: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      join_waitlist: {
        Args: { p_email: string; p_source?: string | null }
        Returns: undefined
      }
      log_search_query: {
        Args: { p_query: string; p_results_total?: number }
        Returns: undefined
      }
      materia_follower_count: {
        Args: { p_materia_id: number }
        Returns: number
      }
      touch_last_seen: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      track_event: {
        Args: { p_name: string; p_dim?: string }
        Returns: undefined
      }
      mod_legal_takedown_resource: {
        Args: { p_public_id: string; p_motivo: string; p_notas?: string }
        Returns: undefined
      }
      mod_lock_thread: {
        Args: { p_public_id: string; p_motivo: string; p_notas?: string }
        Returns: undefined
      }
      mod_remove_comment: {
        Args: { p_public_id: string; p_motivo: string; p_notas?: string }
        Returns: undefined
      }
      mod_remove_post: {
        Args: { p_public_id: string; p_motivo: string; p_notas?: string }
        Returns: undefined
      }
      mod_remove_resource: {
        Args: { p_public_id: string; p_motivo: string; p_notas?: string }
        Returns: undefined
      }
      mod_restore_comment: {
        Args: { p_public_id: string; p_motivo: string; p_notas?: string }
        Returns: undefined
      }
      mod_restore_post: {
        Args: { p_public_id: string; p_motivo: string; p_notas?: string }
        Returns: undefined
      }
      mod_restore_resource: {
        Args: { p_public_id: string; p_motivo: string; p_notas?: string }
        Returns: undefined
      }
      mod_restrict_user: {
        Args: { p_handle: string; p_tipo: string; p_until: string; p_motivo: string }
        Returns: undefined
      }
      mod_resolve_report: {
        Args: { p_report_id: number; p_resolution: string }
        Returns: undefined
      }
      mod_reveal_author: {
        Args: {
          p_target_kind: string
          p_target_public_id: string
          p_motivo: string
          p_notas?: string
        }
        Returns: string
      }
      mod_review_appeal: {
        Args: { p_appeal_id: number; p_resolucion: string }
        Returns: undefined
      }
      mod_revoke_restriction: {
        Args: { p_restriction_id: number }
        Returns: undefined
      }
      mod_warn_user: {
        Args: { p_handle: string; p_motivo: string }
        Returns: undefined
      }
      nanoid: {
        Args: { size?: number }
        Returns: string
      }
      purge_retention: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      raise_immutable: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      rate_limit_for: {
        Args: { p_action: string; p_account_created_at: string }
        Returns: number
      }
      rate_limits: {
        Args: Record<PropertyKey, never>
        Returns: {
          accion: string
          tier: string
          ventana: unknown
          limite: number
        }[]
      }
      reconcile_counters: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      register_download: {
        Args: { p_resource_public_id: string }
        Returns: {
          storage_path: string
          original_name: string
          mime: string
          size_bytes: number
        }[]
      }
      rename_handle: {
        Args: { p_handle: string }
        Returns: undefined
      }
      request_upload: {
        Args: {
          p_materia_slug: string
          p_tipo: string
          p_anio?: number
          p_title?: string
          p_description?: string
          p_anonymous?: boolean
        }
        Returns: string
      }
      search_catalog: {
        Args: { p_query: string; p_limit?: number }
        Returns: {
          kind: string
          id: number
          slug: string
          nombre: string
          rank: number
        }[]
      }
      search_posts: {
        Args: {
          p_query: string
          p_materia_slug?: string
          p_desde?: number
          p_hasta?: number
          p_limit?: number
          p_cursor_rank?: number
          p_cursor_id?: number
        }
        Returns: {
          id: number
          public_id: string
          materia_id: number
          carrera_id: number
          kind: string
          title: string
          body: string
          is_anonymous: boolean
          author_handle: string
          score: number
          comments_count: number
          created_at: string
          last_activity_at: string
          rank: number
        }[]
      }
      search_resources: {
        Args: {
          p_query: string
          p_materia_slug?: string
          p_desde?: number
          p_hasta?: number
          p_limit?: number
          p_cursor_rank?: number
          p_cursor_id?: number
        }
        Returns: {
          id: number
          public_id: string
          materia_id: number
          tipo: string
          anio: number
          title: string
          description: string
          is_anonymous: boolean
          author_handle: string
          score: number
          downloads_count: number
          created_at: string
          rank: number
        }[]
      }
      set_updated_at: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      toggle_comment_vote: {
        Args: { p_public_id: string }
        Returns: number
      }
      toggle_post_vote: {
        Args: { p_public_id: string }
        Returns: number
      }
      toggle_resource_vote: {
        Args: { p_public_id: string }
        Returns: number
      }
      update_notification_prefs: {
        Args: { p_notif_respuestas: boolean }
        Returns: undefined
      }
      update_own_comment: {
        Args: { p_public_id: string; p_body: string }
        Returns: undefined
      }
      update_own_post: {
        Args: { p_public_id: string; p_body: string; p_title?: string }
        Returns: undefined
      }
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}

// ---------------------------------------------------------------------------
// ALIAS DE CONVENIENCIA — escritos a mano (BUILD-CONTRACT §4.1).
// `npm run gen:types` NO los genera: si se regenera el archivo, hay que volver a
// pegar todo lo que sigue debajo del tipo `Database`. Media aplicación los importa.
// ---------------------------------------------------------------------------

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type Views<T extends keyof Database['public']['Views']> =
  Database['public']['Views'][T]['Row']

export type PostPublic = Views<'posts_public'>
export type CommentPublic = Views<'comments_public'>
export type ResourcePublic = Views<'resources_public'>
export type ResourceFilePublic = Views<'resource_files_public'>
export type ProfilePublic = Views<'profiles_public'>
