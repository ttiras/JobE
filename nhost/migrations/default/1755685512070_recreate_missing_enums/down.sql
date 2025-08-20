-- Remove only the seed rows inserted above; do not drop tables.

-- industries_enum
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='industries_enum'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='industries_enum' AND column_name='value'
    ) THEN
      DELETE FROM public.industries_enum WHERE value IN ('CONSUMER');
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='industries_enum' AND column_name='code'
    ) THEN
      DELETE FROM public.industries_enum WHERE code IN ('CONSUMER');
    END IF;
  END IF;
END
$$;

-- countries_enum
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='countries_enum'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='countries_enum' AND column_name='value'
    ) THEN
      DELETE FROM public.countries_enum WHERE value IN ('TR','US');
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='countries_enum' AND column_name='code'
    ) THEN
      DELETE FROM public.countries_enum WHERE code IN ('TR','US');
    END IF;
  END IF;
END
$$;

-- currencies (only remove the pairs we may have inserted)
DO $$
BEGIN
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
