-- Create missing enum tables (if any) + seed minimal values so Hasura enum metadata becomes consistent.

-- 1) Ensure the enum tables exist (industries_enum, countries_enum).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'industries_enum'
  ) THEN
    CREATE TABLE public.industries_enum (
      value   text PRIMARY KEY,
      comment text
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'countries_enum'
  ) THEN
    CREATE TABLE public.countries_enum (
      value   text PRIMARY KEY,
      comment text
    );
  END IF;
END
$$;

-- 2) Seed minimal rows for the enums (idempotent).
INSERT INTO public.industries_enum(value, comment) VALUES
  ('CONSUMER', 'Consumer')
ON CONFLICT (value) DO NOTHING;

INSERT INTO public.countries_enum(value, comment) VALUES
  ('TR', 'Türkiye'),
  ('US', 'United States')
ON CONFLICT (value) DO NOTHING;

-- 3) If "currencies" is used as an enum table in metadata, make sure it has at least one row.
--    Try common column names flexibly (value|code). Runs safely on either shape.
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
      INSERT INTO public.currencies(value) VALUES ('TRY'), ('USD')
      ON CONFLICT (value) DO NOTHING;
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='currencies' AND column_name='code'
    ) THEN
      INSERT INTO public.currencies(code) VALUES ('TRY'), ('USD')
      ON CONFLICT (code) DO NOTHING;
    END IF;
  END IF;
END
$$;
