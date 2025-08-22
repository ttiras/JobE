-- 001_departments_hierarchy_guards.sql

-- 1) No self-parent
ALTER TABLE public.departments
  ADD CONSTRAINT departments_no_self_parent
  CHECK (parent_id IS NULL OR parent_id <> id);

-- 2) Parent must be in the same organization
--    We enforce this via a composite FK on (parent_id, organization_id)
--    Step 2a: ensure a unique key exists on (id, organization_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'departments_id_organization_id_uidx'
  ) THEN
    CREATE UNIQUE INDEX departments_id_organization_id_uidx
      ON public.departments (id, organization_id);
  END IF;
END$$;

--    Step 2b: add the composite FK (nullable parent_id means FK not checked when NULL)
ALTER TABLE public.departments
  ADD CONSTRAINT departments_parent_same_org_fk
  FOREIGN KEY (parent_id, organization_id)
  REFERENCES public.departments (id, organization_id)
  ON UPDATE RESTRICT
  ON DELETE RESTRICT;

-- 3) Prevent cycles anywhere in the chain
CREATE OR REPLACE FUNCTION public.departments_prevent_cycles()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
DECLARE
  dummy int;
BEGIN
  -- Only act when parent is set
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Sanity: no self-parent (also covered by CHECK, but nice early message)
  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'Department cannot be its own parent';
  END IF;

  -- Walk up the ancestors from the proposed parent; if we hit NEW.id, it forms a cycle
  WITH RECURSIVE ancestors AS (
    SELECT d.id, d.parent_id
    FROM public.departments d
    WHERE d.id = NEW.parent_id

    UNION ALL

    SELECT d2.id, d2.parent_id
    FROM public.departments d2
    JOIN ancestors a ON a.parent_id = d2.id
  )
  SELECT 1 INTO dummy
  FROM ancestors
  WHERE id = NEW.id
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Cycle detected in department hierarchy';
  END IF;

  RETURN NEW;
END
$func$;

DROP TRIGGER IF EXISTS trg_departments_prevent_cycles ON public.departments;

CREATE TRIGGER trg_departments_prevent_cycles
BEFORE INSERT OR UPDATE OF parent_id
ON public.departments
FOR EACH ROW
WHEN (NEW.parent_id IS NOT NULL)
EXECUTE FUNCTION public.departments_prevent_cycles();
-- 001_departments_hierarchy_guards.sql
