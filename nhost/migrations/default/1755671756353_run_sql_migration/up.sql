-- positions: drop composite “same-org” FKs (safe if they don't exist)
ALTER TABLE public.positions
  DROP CONSTRAINT IF EXISTS positions_department_same_org_fkey;

ALTER TABLE public.positions
  DROP CONSTRAINT IF EXISTS positions_reports_to_same_org_fkey;
