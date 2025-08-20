alter table "public"."positions" drop constraint "positions_department_same_org_fkey",
  add constraint "positions_department_id_organization_id_fkey"
  foreign key ("department_id", "organization_id")
  references "public"."departments"
  ("id", "organization_id") on update cascade on delete cascade;
