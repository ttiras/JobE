-- Drop legacy single-column FK only if it exists (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conname = 'positions_reports_to_fkey'
      AND c.conrelid = 'public.positions'::regclass
  ) THEN
    ALTER TABLE public.positions
      DROP CONSTRAINT positions_reports_to_fkey;
  END IF;
END
$$;
