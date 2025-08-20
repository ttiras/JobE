alter table "public"."positions" drop constraint "positions_department_id_organization_id_fkey",
  add constraint "positions_department_same_org_fkey"
  foreign key ("organization_id", "department_id")
  references "public"."departments"
  ("organization_id", "id") on update cascade on delete restrict;
