-- Idempotent FK reset for positions.organization_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conname = 'positions_org_fkey'
      AND c.conrelid = 'public.positions'::regclass
  ) THEN
    ALTER TABLE public.positions
      DROP CONSTRAINT positions_org_fkey;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conname = 'positions_organization_id_fkey'
      AND c.conrelid = 'public.positions'::regclass
  ) THEN
    ALTER TABLE public.positions
      ADD CONSTRAINT positions_organization_id_fkey
        FOREIGN KEY (organization_id)
        REFERENCES public.organizations (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE;
  END IF;
END
$$;
