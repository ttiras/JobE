-- Remove only the seed rows inserted by this migration. (No table drops.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='industries_enum'
  ) THEN
    DELETE FROM public.industries_enum WHERE value IN ('CONSUMER');
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='countries_enum'
  ) THEN
    DELETE FROM public.countries_enum WHERE value IN ('TR','US');
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='currencies'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='currencies' AND column_name='value'
    ) THEN
      DELETE FROM public.currencies WHERE value IN ('TRY','USD');
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='currencies' AND column_name='code'
    ) THEN
      DELETE FROM public.currencies WHERE code IN ('TRY','USD');
    END IF;
  END IF;
END
$$;
