-- Reconcile FK names across environments so deploys are idempotent.
DO $$
BEGIN
  -- Drop any legacy/simple-name constraints if they exist in this DB.
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conname = 'positions_reports_to_fkey'
      AND c.conrelid = 'public.positions'::regclass
  ) THEN
    ALTER TABLE public.positions DROP CONSTRAINT positions_reports_to_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conname = 'positions_reports_to_id_fkey'
      AND c.conrelid = 'public.positions'::regclass
  ) THEN
    ALTER TABLE public.positions DROP CONSTRAINT positions_reports_to_id_fkey;
  END IF;

  -- Add the composite same-org FK only if it's not already present.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conname = 'positions_reports_to_same_org_fkey'
      AND c.conrelid = 'public.positions'::regclass
  ) THEN
    ALTER TABLE public.positions
      ADD CONSTRAINT positions_reports_to_same_org_fkey
        FOREIGN KEY (organization_id, reports_to_id)
        REFERENCES public.positions (organization_id, id)
        ON UPDATE NO ACTION
        ON DELETE SET NULL;
  END IF;
END
$$;
