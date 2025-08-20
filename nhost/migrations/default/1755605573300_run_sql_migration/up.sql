-- minimal enum table (GraphQL enum)
CREATE TABLE IF NOT EXISTS public.countries_enum (
  code    text PRIMARY KEY,  -- ISO-3166-1 alpha-2
  comment text               -- optional, used as GraphQL enum description
);

-- metadata table with localized names
CREATE TABLE IF NOT EXISTS public.countries (
  code       text PRIMARY KEY REFERENCES public.countries_enum(code),
  name_en    text NOT NULL,
  name_tr    text NOT NULL,
  iso3       text,           -- ISO-3166-1 alpha-3 (optional)
  sort_order int,
  is_active  boolean NOT NULL DEFAULT true
);

-- ensure organizations.country points to the enum table
ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_country_fkey;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_country_fkey
  FOREIGN KEY (country) REFERENCES public.countries_enum(code);
