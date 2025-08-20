-- Recreate legacy FK only if missing (idempotent rollback)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conname = 'positions_reports_to_fkey'
      AND c.conrelid = 'public.positions'::regclass
  ) THEN
    ALTER TABLE public.positions
      ADD CONSTRAINT positions_reports_to_fkey
        FOREIGN KEY (reports_to_id)
        REFERENCES public.positions (id)
        ON UPDATE NO ACTION
        ON DELETE SET NULL;
  END IF;
END
$$;
