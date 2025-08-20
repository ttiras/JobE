ALTER TABLE public.industries
  ADD CONSTRAINT industries_value_fkey
  FOREIGN KEY (value) REFERENCES public.industries_enum(value);
