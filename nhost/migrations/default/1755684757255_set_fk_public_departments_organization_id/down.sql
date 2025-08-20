-- Safe rollback
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conname = 'departments_organization_id_fkey'
      AND c.conrelid = 'public.departments'::regclass
  ) THEN
    ALTER TABLE public.departments
      DROP CONSTRAINT departments_organization_id_fkey;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conname = 'departments_org_fkey'
      AND c.conrelid = 'public.departments'::regclass
  ) THEN
    ALTER TABLE public.departments
      ADD CONSTRAINT departments_org_fkey
        FOREIGN KEY (organization_id)
        REFERENCES public.organizations (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE;
  END IF;
END
$$;
