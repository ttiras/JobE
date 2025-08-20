-- A) Drop any triggers whose name OR trigger function mention "slug"
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schem, c.relname AS tbl, t.tgname AS trg
    FROM pg_trigger t
    JOIN pg_class c   ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc pf   ON pf.oid = t.tgfoid
    WHERE n.nspname='public'
      AND (t.tgname ILIKE '%slug%' OR pf.proname ILIKE '%slug%')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I;', r.trg, r.schem, r.tbl);
  END LOOP;
END$$;

-- B) Drop functions whose NAME mentions "slug"
-- (uses pg_get_function_identity_arguments for a robust signature)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schem,
           p.proname  AS fname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public'
      AND p.proname ILIKE '%slug%'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE;', r.schem, r.fname, r.args);
  END LOOP;
END$$;

-- C) Drop any indexes on organizations that reference the slug column
DO $$
DECLARE idx text;
BEGIN
  FOR idx IN
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname='public'
      AND tablename='organizations'
      AND indexdef ILIKE '%(slug)%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I;', idx);
  END LOOP;
END$$;

-- D) Finally, remove the slug column if it still exists (idempotent)
ALTER TABLE public.organizations
  DROP COLUMN IF EXISTS slug;
