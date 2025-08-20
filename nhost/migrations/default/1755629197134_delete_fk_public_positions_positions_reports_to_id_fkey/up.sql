-- Some environments used a different legacy name; drop it only if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conname = 'positions_reports_to_id_fkey'
      AND c.conrelid = 'public.positions'::regclass
  ) THEN
    ALTER TABLE public.positions
      DROP CONSTRAINT positions_reports_to_id_fkey;
  END IF;
END
$$;
