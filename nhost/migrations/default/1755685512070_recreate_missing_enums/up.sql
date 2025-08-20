-- Create/seed enum helper tables in a shape-safe way.

-- 1) industries_enum (ensure + seed)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='industries_enum'
  ) THEN
    -- table exists: seed against whichever PK name is present
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='industries_enum' AND column_name='value'
    ) THEN
      INSERT INTO public.industries_enum(value, comment)
      VALUES ('CONSUMER','Consumer')
      ON CONFLICT (value) DO NOTHING;
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='industries_enum' AND column_name='code'
    ) THEN
      INSERT INTO public.industries_enum(code, comment)
      VALUES ('CONSUMER','Consumer')
      ON CONFLICT (code) DO NOTHING;
    ELSE
      RAISE NOTICE 'industries_enum exists with unexpected columns; skipping seed';
    END IF;
  ELSE
    -- table is missing: create with canonical columns
    CREATE TABLE public.industries_enum (
      value   text PRIMARY KEY,
      comment text
    );
    INSERT INTO public.industries_enum(value, comment)
    VALUES ('CONSUMER','Consumer')
    ON CONFLICT (value) DO NOTHING;
  END IF;
END
$$;

-- 2) countries_enum (ensure + seed; handles value|code PK)
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
      INSERT INTO public.countries_enum(value, comment)
      VALUES ('TR','Türkiye'), ('US','United States')
      ON CONFLICT (value) DO NOTHING;
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='countries_enum' AND column_name='code'
    ) THEN
      INSERT INTO public.countries_enum(code, comment)
      VALUES ('TR','Türkiye'), ('US','United States')
      ON CONFLICT (code) DO NOTHING;
    ELSE
      RAISE NOTICE 'countries_enum exists with unexpected columns; skipping seed';
    END IF;
  ELSE
    CREATE TABLE public.countries_enum (
      value   text PRIMARY KEY,
      comment text
    );
    INSERT INTO public.countries_enum(value, comment)
    VALUES ('TR','Türkiye'), ('US','United States')
    ON CONFLICT (value) DO NOTHING;
  END IF;
END
$$;

-- 3) currencies (only seed if table exists; handle value|code)
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
    ELSE
      RAISE NOTICE 'currencies exists with unexpected columns; skipping seed';
    END IF;
  END IF;
END
$$;
