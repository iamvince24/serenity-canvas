


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_group_members"("p_group_ids" "uuid"[], "p_members" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
  begin
    delete from public.group_members
    where group_id = any(p_group_ids);

    insert into public.group_members (group_id, node_id)
    select
      (m->>'group_id')::uuid,
      (m->>'node_id')::uuid
    from jsonb_array_elements(coalesce(p_members, '[]'::jsonb)) as m;
  end;
  $$;


ALTER FUNCTION "public"."sync_group_members"("p_group_ids" "uuid"[], "p_members" "jsonb") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."boards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "title" "text" DEFAULT 'Untitled'::"text" NOT NULL,
    "node_order" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."boards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."edges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "board_id" "uuid" NOT NULL,
    "source_id" "uuid" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "label" "text",
    "line_style" "text" DEFAULT 'solid'::"text" NOT NULL,
    "direction" "text" DEFAULT 'forward'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "source_anchor" "text" DEFAULT 'right'::"text",
    "target_anchor" "text" DEFAULT 'left'::"text"
);


ALTER TABLE "public"."edges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "board_id" "uuid" NOT NULL,
    "asset_id" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "size_bytes" bigint DEFAULT 0 NOT NULL,
    "image_path" "text",
    "original_width" integer,
    "original_height" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_members" (
    "group_id" "uuid" NOT NULL,
    "node_id" "uuid" NOT NULL
);


ALTER TABLE "public"."group_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "board_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "label" "text",
    "color" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."nodes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "board_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "x" double precision NOT NULL,
    "y" double precision NOT NULL,
    "width" double precision NOT NULL,
    "height" double precision NOT NULL,
    "color" "text",
    "content" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "nodes_type_check" CHECK (("type" = ANY (ARRAY['text'::"text", 'image'::"text"])))
);


ALTER TABLE "public"."nodes" OWNER TO "postgres";


ALTER TABLE ONLY "public"."boards"
    ADD CONSTRAINT "boards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."edges"
    ADD CONSTRAINT "edges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_pkey" PRIMARY KEY ("group_id", "node_id");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nodes"
    ADD CONSTRAINT "nodes_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_group_members_group_id" ON "public"."group_members" USING "btree" ("group_id");



CREATE INDEX "idx_group_members_node_id" ON "public"."group_members" USING "btree" ("node_id");



CREATE INDEX "idx_groups_board_id" ON "public"."groups" USING "btree" ("board_id");



CREATE INDEX "idx_groups_user_id" ON "public"."groups" USING "btree" ("user_id");



ALTER TABLE ONLY "public"."boards"
    ADD CONSTRAINT "boards_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."edges"
    ADD CONSTRAINT "edges_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nodes"
    ADD CONSTRAINT "nodes_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE CASCADE;



ALTER TABLE "public"."boards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."edges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."files" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "files_delete_owner" ON "public"."files" FOR DELETE USING (("board_id" IN ( SELECT "boards"."id"
   FROM "public"."boards"
  WHERE ("boards"."owner_id" = "auth"."uid"()))));



CREATE POLICY "files_insert_owner" ON "public"."files" FOR INSERT WITH CHECK (("board_id" IN ( SELECT "boards"."id"
   FROM "public"."boards"
  WHERE ("boards"."owner_id" = "auth"."uid"()))));



CREATE POLICY "files_select_owner" ON "public"."files" FOR SELECT USING (("board_id" IN ( SELECT "boards"."id"
   FROM "public"."boards"
  WHERE ("boards"."owner_id" = "auth"."uid"()))));



CREATE POLICY "files_update_owner" ON "public"."files" FOR UPDATE USING (("board_id" IN ( SELECT "boards"."id"
   FROM "public"."boards"
  WHERE ("boards"."owner_id" = "auth"."uid"()))));



ALTER TABLE "public"."group_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."nodes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "owner can do all on boards" ON "public"."boards" USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "owner can do all on edges" ON "public"."edges" USING ((EXISTS ( SELECT 1
   FROM "public"."boards"
  WHERE (("boards"."id" = "edges"."board_id") AND ("boards"."owner_id" = "auth"."uid"())))));



CREATE POLICY "owner can do all on nodes" ON "public"."nodes" USING ((EXISTS ( SELECT 1
   FROM "public"."boards"
  WHERE (("boards"."id" = "nodes"."board_id") AND ("boards"."owner_id" = "auth"."uid"())))));



CREATE POLICY "users_own_group_members" ON "public"."group_members" USING ((EXISTS ( SELECT 1
   FROM "public"."groups" "g"
  WHERE (("g"."id" = "group_members"."group_id") AND ("g"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."groups" "g"
  WHERE (("g"."id" = "group_members"."group_id") AND ("g"."user_id" = "auth"."uid"())))));



CREATE POLICY "users_own_groups" ON "public"."groups" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_group_members"("p_group_ids" "uuid"[], "p_members" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_group_members"("p_group_ids" "uuid"[], "p_members" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_group_members"("p_group_ids" "uuid"[], "p_members" "jsonb") TO "service_role";


















GRANT ALL ON TABLE "public"."boards" TO "anon";
GRANT ALL ON TABLE "public"."boards" TO "authenticated";
GRANT ALL ON TABLE "public"."boards" TO "service_role";



GRANT ALL ON TABLE "public"."edges" TO "anon";
GRANT ALL ON TABLE "public"."edges" TO "authenticated";
GRANT ALL ON TABLE "public"."edges" TO "service_role";



GRANT ALL ON TABLE "public"."files" TO "anon";
GRANT ALL ON TABLE "public"."files" TO "authenticated";
GRANT ALL ON TABLE "public"."files" TO "service_role";



GRANT ALL ON TABLE "public"."group_members" TO "anon";
GRANT ALL ON TABLE "public"."group_members" TO "authenticated";
GRANT ALL ON TABLE "public"."group_members" TO "service_role";



GRANT ALL ON TABLE "public"."groups" TO "anon";
GRANT ALL ON TABLE "public"."groups" TO "authenticated";
GRANT ALL ON TABLE "public"."groups" TO "service_role";



GRANT ALL ON TABLE "public"."nodes" TO "anon";
GRANT ALL ON TABLE "public"."nodes" TO "authenticated";
GRANT ALL ON TABLE "public"."nodes" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































drop extension if exists "pg_net";


  create policy "owner can manage their images 1d6itdr_0"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'board-images'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "owner can manage their images 1d6itdr_1"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'board-images'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "owner can manage their images 1d6itdr_2"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'board-images'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "owner can manage their images 1d6itdr_3"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'board-images'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



