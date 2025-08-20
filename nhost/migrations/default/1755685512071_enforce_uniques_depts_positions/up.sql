-- 1) Clean up any duplicates so the unique indexes can be created safely
WITH dupe_depts AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY organization_id, dept_code ORDER BY created_at, id) AS rn
  FROM public.departments
)
DELETE FROM public.departments d
USING dupe_depts x
WHERE d.id = x.id AND x.rn > 1;

WITH dupe_pos AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY organization_id, department_id, pos_code ORDER BY created_at, id) AS rn
  FROM public.positions
)
DELETE FROM public.positions p
USING dupe_pos x
WHERE p.id = x.id AND x.rn > 1;

-- 2) Enforce uniqueness (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS departments_org_dept_code_uidx
  ON public.departments (organization_id, dept_code);

CREATE UNIQUE INDEX IF NOT EXISTS positions_org_dept_pos_code_uidx
  ON public.positions (organization_id, department_id, pos_code);
